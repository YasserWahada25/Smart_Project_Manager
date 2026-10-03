/**
 * AI-02 — developer recommendation for a task.
 *
 * The backend gathers the data (active members, their skills, current workload and DONE tasks), the AI
 * service ranks them (transparent scoring), and the answer is validated before being returned. Nothing
 * is stored: assigning the task remains the manager's action (PATCH /tasks/:id/assignee).
 */
const { Task, TASK_STATUSES } = require('../models/task.model');
const { User } = require('../models/user.model');
const { PLAN_LIMITS } = require('../validators/aiPlan.validator');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { sameId } = require('../utils/ids');
const aiClient = require('./aiClient.service');
const taskService = require('./task.service');

const MAX_RECOMMENDATIONS = 5;
const EXPLANATION_MAX = 1000;
const PUBLIC_FIELDS = 'firstName lastName email jobTitle skills';

/** Open tasks and story points per developer, in every project (the task itself excluded). */
async function workloads(ids, taskId) {
  const rows = await Task.aggregate([
    { $match: { assignee: { $in: ids }, status: { $ne: TASK_STATUSES.DONE }, _id: { $ne: taskId } } },
    { $group: { _id: '$assignee', openTasks: { $sum: 1 }, openPoints: { $sum: '$complexity' } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row]));
}

/** DONE tasks per developer, and how many of them required each skill. */
async function experiences(ids) {
  const [totals, skills] = await Promise.all([
    Task.aggregate([
      { $match: { assignee: { $in: ids }, status: TASK_STATUSES.DONE } },
      { $group: { _id: '$assignee', completedTasks: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: { assignee: { $in: ids }, status: TASK_STATUSES.DONE } },
      { $unwind: '$requiredSkills' },
      { $group: { _id: { assignee: '$assignee', skill: '$requiredSkills' }, count: { $sum: 1 } } },
      { $limit: 5000 },
    ]),
  ]);
  const result = new Map(totals.map((row) => [String(row._id), { completedTasks: row.completedTasks, completedSkills: {} }]));
  skills.forEach(({ _id, count }) => {
    const entry = result.get(String(_id.assignee));
    if (entry && Object.keys(entry.completedSkills).length < 300) entry.completedSkills[_id.skill] = count;
  });
  return result;
}

// ---------- validation of the AI answer ----------
const isStringList = (value) =>
  Array.isArray(value) && value.length <= 50 && value.every((item) => typeof item === 'string' && item.length <= 100);
const isRatio = (value) => typeof value === 'number' && value >= 0 && value <= 1;

function parseAnswer(payload, candidateIds) {
  const items = payload?.recommendations;
  const valid =
    payload?.method === 'scoring' &&
    typeof payload.model === 'string' &&
    ['required', 'inferred', 'none'].includes(payload.skillsSource) &&
    isStringList(payload.skills) &&
    isStringList(payload.warnings) &&
    Array.isArray(items) &&
    items.length <= MAX_RECOMMENDATIONS &&
    new Set(items.map((item) => item?.id)).size === items.length &&
    items.every(
      (item) =>
        candidateIds.has(item?.id) &&
        Number.isInteger(item.score) &&
        item.score >= 0 &&
        item.score <= 100 &&
        isStringList(item.matchingSkills) &&
        isStringList(item.missingSkills) &&
        Number.isInteger(item.similarCompletedTasks) &&
        item.similarCompletedTasks >= 0 &&
        isRatio(item.breakdown?.skills) &&
        isRatio(item.breakdown?.workload) &&
        isRatio(item.breakdown?.experience) &&
        typeof item.explanation === 'string' &&
        item.explanation.length <= EXPLANATION_MAX,
    );
  if (!valid) {
    logger.error('Invalid recommendation answer from the AI service');
    throw new ApiError(502, 'AI_ERROR', 'The AI service returned an invalid recommendation');
  }
  return payload;
}

async function recommendDevelopers(actor, taskId) {
  const { task, project } = await taskService.findManagedTask(taskId, actor);
  const members = await User.find({ _id: { $in: project.members }, isActive: true }).select(PUBLIC_FIELDS);
  const base = { task: { id: task.id, title: task.title, requiredSkills: task.requiredSkills } };
  if (members.length === 0) {
    return {
      ...base,
      method: 'scoring',
      model: null,
      skillsSource: task.requiredSkills.length > 0 ? 'required' : 'none',
      skills: task.requiredSkills,
      recommendations: [],
      warnings: ['The project has no active developer: add members to the team first.'],
    };
  }

  const ids = members.map((member) => member._id);
  const [load, history] = await Promise.all([workloads(ids, task._id), experiences(ids)]);
  const candidates = members.map((member) => {
    const id = String(member._id);
    return {
      id,
      name: `${member.firstName} ${member.lastName}`,
      skills: member.skills.map(({ name, level, yearsOfExperience }) => ({
        name,
        level,
        ...(yearsOfExperience !== undefined && yearsOfExperience !== null ? { yearsOfExperience } : {}),
      })),
      openTasks: load.get(id)?.openTasks ?? 0,
      openPoints: load.get(id)?.openPoints ?? 0,
      completedTasks: history.get(id)?.completedTasks ?? 0,
      completedSkills: history.get(id)?.completedSkills ?? {},
    };
  });

  const answer = parseAnswer(
    await aiClient.request('/api/v1/ai/developers/recommend', {
      method: 'POST',
      json: {
        task: {
          title: task.title,
          description: task.description ?? '',
          type: task.type,
          complexity: task.complexity,
          requiredSkills: task.requiredSkills,
        },
        candidates,
        options: { workloadCapacity: PLAN_LIMITS.capacityPerSprint.default, limit: MAX_RECOMMENDATIONS },
      },
    }),
    new Set(candidates.map((candidate) => candidate.id)),
  );

  const byId = new Map(members.map((member) => [String(member._id), member]));
  const workloadOf = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  return {
    ...base,
    method: answer.method,
    model: answer.model,
    skillsSource: answer.skillsSource,
    skills: answer.skills,
    warnings: answer.warnings,
    recommendations: answer.recommendations.map((item) => {
      const member = byId.get(item.id);
      return {
        developer: {
          id: item.id,
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          jobTitle: member.jobTitle ?? '',
        },
        score: item.score,
        matchingSkills: item.matchingSkills,
        missingSkills: item.missingSkills,
        openTasks: workloadOf.get(item.id).openTasks,
        openPoints: workloadOf.get(item.id).openPoints,
        similarCompletedTasks: item.similarCompletedTasks,
        breakdown: item.breakdown,
        explanation: item.explanation,
        isAssignee: sameId(task.assignee, item.id),
      };
    }),
  };
}

module.exports = { recommendDevelopers };
