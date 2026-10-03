/**
 * AI-01 — planning of a project from its specification (cahier des charges, product backlog…).
 *
 *  1. generatePlan: the manager's text and/or file go to the AI service, which proposes sprints and
 *     tasks. The answer is validated strictly (never trusted) and returned. Nothing is stored.
 *  2. applyPlan: the plan reviewed (and possibly edited) by the manager is created: PLANNED sprints
 *     and TODO tasks, all or nothing.
 */
const mongoose = require('mongoose');
const { Sprint, SPRINT_LIMITS } = require('../models/sprint.model');
const { Task, TASK_TYPES, TASK_PRIORITIES, COMPLEXITY_POINTS, TASK_LIMITS } = require('../models/task.model');
const { User } = require('../models/user.model');
const { ACTIVITY_TYPES } = require('../models/activity.model');
const { PLAN_LIMITS } = require('../validators/aiPlan.validator');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const aiClient = require('./aiClient.service');
const activityService = require('./activity.service');

const DAY_MS = 24 * 60 * 60 * 1000;

const isoDate = (date) => date.toISOString().slice(0, 10);
const startOfToday = () => new Date(isoDate(new Date()));

/** Default start: today, the project start if later, or the day after the last sprint of the project. */
function defaultStartDate(project, lastSprint) {
  let start = startOfToday();
  if (project.startDate > start) start = project.startDate;
  if (lastSprint && lastSprint.endDate >= start) start = new Date(lastSprint.endDate.getTime() + DAY_MS);
  return start;
}

/** Skills of the team (unique, ignoring case), given to the AI to tag the tasks. */
async function teamSkills(project) {
  const members = await User.find({ _id: { $in: project.members } }).select('skills');
  const skills = new Map();
  members.forEach((member) =>
    member.skills.forEach(({ name }) => skills.set(name.toLowerCase(), skills.get(name.toLowerCase()) ?? name)),
  );
  return [...skills.values()].slice(0, 200);
}

async function extractDocument(file) {
  const form = new FormData();
  form.append('file', new Blob([file.buffer]), file.originalname);
  const extracted = await aiClient.request('/api/v1/ai/documents/extract', { method: 'POST', form });
  if (typeof extracted?.text !== 'string' || typeof extracted.truncated !== 'boolean') {
    logger.error('Invalid extraction answer from the AI service');
    throw new ApiError(502, 'AI_ERROR', 'The AI service returned an invalid response');
  }
  return extracted;
}

// ---------- validation of the AI answer ----------
const isString = (value, max, { allowEmpty = false } = {}) =>
  typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0);
const isIsoDay = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

function checkTask(task, path, errors) {
  if (typeof task !== 'object' || task === null) return errors.push(`${path} is not an object`);
  if (!isString(task.title, TASK_LIMITS.titleMaxLength)) errors.push(`${path}.title`);
  if (!isString(task.description ?? '', TASK_LIMITS.descriptionMaxLength, { allowEmpty: true })) {
    errors.push(`${path}.description`);
  }
  if (!Object.values(TASK_TYPES).includes(task.type)) errors.push(`${path}.type`);
  if (!Object.values(TASK_PRIORITIES).includes(task.priority)) errors.push(`${path}.priority`);
  if (!COMPLEXITY_POINTS.includes(task.complexity)) errors.push(`${path}.complexity`);
  if (!isString(task.epic ?? 'General', PLAN_LIMITS.epicMaxLength)) errors.push(`${path}.epic`);
  const skills = task.requiredSkills ?? [];
  if (
    !Array.isArray(skills) ||
    skills.length > TASK_LIMITS.maxRequiredSkills ||
    !skills.every((skill) => isString(skill, TASK_LIMITS.skillMaxLength))
  ) {
    errors.push(`${path}.requiredSkills`);
  }
  return errors;
}

/** Only the known fields; skills unique ignoring case (the task validation refuses duplicates). */
function cleanTask(task) {
  const skills = new Map();
  (task.requiredSkills ?? []).forEach((skill) => {
    const name = skill.trim();
    if (!skills.has(name.toLowerCase())) skills.set(name.toLowerCase(), name);
  });
  return {
    title: task.title.trim(),
    description: (task.description ?? '').trim(),
    type: task.type,
    priority: task.priority,
    complexity: task.complexity,
    requiredSkills: [...skills.values()],
    epic: (task.epic ?? 'General').trim(),
  };
}

/** The AI answer must match the contract exactly (docs/api.md); otherwise 502. */
function parseAiPlan(payload) {
  const errors = [];
  const sprints = payload?.sprints;
  const backlog = payload?.backlog;
  if (!PLAN_LIMITS.methods.includes(payload?.method)) errors.push('method');
  if (!isString(payload?.model, 200)) errors.push('model');
  if (!Array.isArray(payload?.warnings) || !payload.warnings.every((warning) => isString(warning, 2000))) {
    errors.push('warnings');
  }
  if (!Array.isArray(sprints) || sprints.length > PLAN_LIMITS.maxSprints) errors.push('sprints');
  if (!Array.isArray(backlog)) errors.push('backlog');
  if (errors.length === 0) {
    sprints.forEach((sprint, index) => {
      const path = `sprints[${index}]`;
      if (!isString(sprint?.objective ?? '', SPRINT_LIMITS.objectiveMaxLength, { allowEmpty: true })) {
        errors.push(`${path}.objective`);
      }
      if (!isIsoDay(sprint?.startDate) || !isIsoDay(sprint?.endDate) || sprint.endDate < sprint.startDate) {
        errors.push(`${path} dates`);
      }
      if (!Array.isArray(sprint?.tasks)) errors.push(`${path}.tasks`);
      else sprint.tasks.forEach((task, taskIndex) => checkTask(task, `${path}.tasks[${taskIndex}]`, errors));
    });
    backlog.forEach((task, index) => checkTask(task, `backlog[${index}]`, errors));
  }
  const taskCount = errors.length === 0 ? sprints.reduce((count, sprint) => count + sprint.tasks.length, backlog.length) : 0;
  if (errors.length === 0 && taskCount > PLAN_LIMITS.maxTasks) errors.push(`${taskCount} tasks`);

  if (errors.length > 0) {
    logger.error(`Invalid plan from the AI service: ${errors.slice(0, 5).join(', ')}`);
    throw new ApiError(502, 'AI_ERROR', 'The AI service returned an invalid plan');
  }
  return {
    method: payload.method,
    model: payload.model,
    warnings: [...payload.warnings],
    sprints: sprints.map((sprint) => ({
      name: '', // numbered by generatePlan
      objective: (sprint.objective ?? '').trim(),
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      tasks: sprint.tasks.map(cleanTask),
    })),
    backlog: backlog.map(cleanTask),
  };
}

function summarize(plan) {
  const tasks = [...plan.sprints.flatMap((sprint) => sprint.tasks), ...plan.backlog];
  return {
    taskCount: tasks.length,
    sprintCount: plan.sprints.length,
    totalPoints: plan.sprints.reduce(
      (total, sprint) => total + sprint.tasks.reduce((points, task) => points + task.complexity, 0),
      0,
    ),
    epics: [...new Set(tasks.map((task) => task.epic))],
  };
}

// ---------- 1. proposal ----------
async function generatePlan(project, { text = '', file, sprintLengthDays, capacityPerSprint, startDate }) {
  const parts = [];
  const warnings = [];
  if (text.trim()) parts.push(text.trim());
  if (file) {
    const extracted = await extractDocument(file);
    parts.push(extracted.text);
    if (extracted.truncated) {
      warnings.push(`The file «${file.originalname}» is long: only its first ${extracted.text.length} characters were analysed.`);
    }
  }
  let document = parts.join('\n\n');
  if (document.trim().length < PLAN_LIMITS.textMinLength) {
    throw ApiError.badRequest('Validation failed', [
      { field: 'text', message: `Paste the specification or attach a file (at least ${PLAN_LIMITS.textMinLength} characters)` },
    ]);
  }
  if (document.length > PLAN_LIMITS.textMaxLength) {
    document = document.slice(0, PLAN_LIMITS.textMaxLength);
    warnings.push(`The specification is long: only its first ${PLAN_LIMITS.textMaxLength} characters were analysed.`);
  }

  const [lastSprint, sprintCount, skills] = await Promise.all([
    Sprint.findOne({ project: project._id }).sort({ endDate: -1 }).select('endDate'),
    Sprint.countDocuments({ project: project._id }),
    teamSkills(project),
  ]);
  const options = {
    startDate: isoDate(startDate ?? defaultStartDate(project, lastSprint)),
    sprintLengthDays: sprintLengthDays ?? PLAN_LIMITS.sprintLengthDays.default,
    capacityPerSprint: capacityPerSprint ?? PLAN_LIMITS.capacityPerSprint.default,
  };

  const payload = await aiClient.request('/api/v1/ai/projects/plan', {
    method: 'POST',
    json: {
      text: document,
      project: {
        name: project.name,
        description: project.description,
        technologies: project.technologies,
        deadline: project.deadline ? isoDate(project.deadline) : null,
      },
      options,
      teamSkills: skills,
    },
  });
  const plan = parseAiPlan(payload);
  // The new sprints continue the numbering of the existing ones.
  plan.sprints.forEach((sprint, index) => {
    sprint.name = `Sprint ${sprintCount + index + 1}`;
  });
  return {
    ...plan,
    warnings: [...warnings, ...plan.warnings],
    stats: summarize(plan),
    options,
    source: { filename: file ? file.originalname : null, characters: document.length },
  };
}

// ---------- 2. creation of the reviewed plan ----------
function toTaskDocument(task, project, actor, sprintId) {
  return {
    _id: new mongoose.Types.ObjectId(),
    title: task.title,
    description: task.description ?? '',
    type: task.type,
    priority: task.priority,
    complexity: task.complexity,
    requiredSkills: task.requiredSkills ?? [],
    sprint: sprintId,
    project: project._id,
    createdBy: actor._id,
  };
}

async function applyPlan(actor, project, { sprints, backlog = [], method }) {
  const taskCount = sprints.reduce((count, sprint) => count + sprint.tasks.length, backlog.length);
  if (taskCount === 0) {
    throw ApiError.badRequest('Validation failed', [{ field: 'sprints', message: 'The plan contains no task' }]);
  }
  if (taskCount > PLAN_LIMITS.maxTasks) {
    throw ApiError.badRequest('Validation failed', [
      { field: 'sprints', message: `A plan can create at most ${PLAN_LIMITS.maxTasks} tasks (${taskCount} given)` },
    ]);
  }
  const dateErrors = sprints
    .map((sprint, index) => (sprint.endDate < sprint.startDate ? index : -1))
    .filter((index) => index >= 0)
    .map((index) => ({ field: `sprints[${index}].endDate`, message: 'End date must be on or after the start date' }));
  if (dateErrors.length > 0) throw ApiError.badRequest('Validation failed', dateErrors);

  // Ids chosen in advance: on failure, everything already inserted can be removed.
  const sprintDocuments = sprints.map((sprint) => ({
    _id: new mongoose.Types.ObjectId(),
    name: sprint.name,
    objective: sprint.objective ?? '',
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    project: project._id,
  }));
  const taskDocuments = [
    ...sprints.flatMap((sprint, index) =>
      sprint.tasks.map((task) => toTaskDocument(task, project, actor, sprintDocuments[index]._id)),
    ),
    ...backlog.map((task) => toTaskDocument(task, project, actor, null)),
  ];

  let createdSprints;
  try {
    createdSprints = await Sprint.insertMany(sprintDocuments);
    await Task.insertMany(taskDocuments);
  } catch (err) {
    await Promise.all([
      Sprint.deleteMany({ _id: { $in: sprintDocuments.map((sprint) => sprint._id) } }),
      Task.deleteMany({ _id: { $in: taskDocuments.map((task) => task._id) } }),
    ]);
    throw err;
  }

  await activityService.record({
    project,
    actor,
    type: ACTIVITY_TYPES.AI_PLAN_APPLIED,
    details: { sprints: createdSprints.length, tasks: taskDocuments.length, method: method ?? null },
  });
  return { sprints: createdSprints, tasksCreated: taskDocuments.length, backlogTasks: backlog.length };
}

module.exports = { generatePlan, applyPlan, parseAiPlan, defaultStartDate };
