/**
 * AI-04 — manager assistant (chat) of a project.
 *
 * chat(): the backend drives the conversation. It sends the messages to the AI service (which calls the LLM
 * with the tools), runs the READ tools itself with the rights of the signed-in manager (project data only),
 * and turns every WRITE tool call into a PROPOSAL: nothing is changed until the manager confirms it.
 * executeAction(): runs a confirmed proposal through the usual validation rules and services (same checks,
 * history and notifications as the interface). There is no delete tool.
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const { validationResult, matchedData } = require('express-validator');
const { Task, TASK_STATUSES } = require('../models/task.model');
const { Sprint } = require('../models/sprint.model');
const { User } = require('../models/user.model');
const { createTaskRules, updateTaskRules, changeStatusRules, assignRules } = require('../validators/task.validator');
const { createSprintRules } = require('../validators/sprint.validator');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const access = require('./projectAccess.service');
const aiClient = require('./aiClient.service');
const taskService = require('./task.service');
const sprintService = require('./sprint.service');
const aiRiskService = require('./aiRisk.service');
const aiRecommendationService = require('./aiRecommendation.service');

const ASSISTANT_LIMITS = Object.freeze({
  maxMessages: 20,
  messageMaxLength: 4000,
  maxSteps: 6, // AI service calls per manager message
  maxToolCalls: 12, // tool calls per manager message
  toolResultMaxLength: 15000,
  listTasksLimit: 50,
});
const READ_TOOLS = ['get_project_overview', 'list_tasks', 'get_sprint_risk', 'recommend_developers'];
const WRITE_TOOLS = ['create_task', 'update_task', 'assign_task', 'change_task_status', 'create_sprint'];
const STATUS_LABELS = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  CODE_REVIEW: 'Code review',
  TESTING: 'Testing',
  DONE: 'Done',
  BLOCKED: 'Blocked',
};

const isoDate = (date) => (date ? new Date(date).toISOString().slice(0, 10) : null);
const fullName = (user) => `${user.firstName} ${user.lastName}`;
const isObjectId = (value) => typeof value === 'string' && mongoose.isValidObjectId(value) && /^[a-f\d]{24}$/i.test(value);

/** A tool error reported to the model (it can correct its call), never thrown to the manager. */
class ToolError extends Error {}

// ---------- references (always inside the manager's project) ----------
async function projectTask(project, taskId) {
  if (!isObjectId(taskId)) throw new ToolError(`Unknown taskId "${taskId}": use an id returned by list_tasks`);
  const task = await Task.findOne({ _id: taskId, project: project._id });
  if (!task) throw new ToolError(`No task "${taskId}" in this project`);
  return task;
}

async function projectSprint(project, sprintId, { open = false } = {}) {
  if (!isObjectId(sprintId)) throw new ToolError(`Unknown sprintId "${sprintId}": use an id from get_project_overview`);
  const sprint = await Sprint.findOne({ _id: sprintId, project: project._id });
  if (!sprint) throw new ToolError(`No sprint "${sprintId}" in this project`);
  if (open && sprint.isClosed()) throw new ToolError(`The sprint «${sprint.name}» is ${sprint.status.toLowerCase()}`);
  return sprint;
}

async function projectMember(project, userId) {
  if (!isObjectId(userId) || !access.isProjectMember(project, userId)) {
    throw new ToolError(`"${userId}" is not a member of the project: use an id from get_project_overview`);
  }
  const user = await User.findById(userId).select('firstName lastName isActive');
  if (!user?.isActive) throw new ToolError('This member account is deactivated');
  return user;
}

// ---------- read tools ----------
async function projectOverview(actor, project) {
  const [members, sprints, counts, overdue, workload] = await Promise.all([
    User.find({ _id: { $in: project.members } }).select('firstName lastName jobTitle skills isActive'),
    sprintService.listSprints(actor, project._id, { limit: 100 }),
    Task.aggregate([{ $match: { project: project._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Task.countDocuments({ project: project._id, status: { $ne: TASK_STATUSES.DONE }, deadline: { $lt: new Date() } }),
    Task.aggregate([
      { $match: { project: project._id, status: { $ne: TASK_STATUSES.DONE }, assignee: { $ne: null } } },
      { $group: { _id: '$assignee', openTasks: { $sum: 1 }, openPoints: { $sum: '$complexity' } } },
    ]),
  ]);
  const load = new Map(workload.map((row) => [String(row._id), row]));
  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      startDate: isoDate(project.startDate),
      deadline: isoDate(project.deadline),
      technologies: project.technologies,
    },
    team: members.map((member) => ({
      id: member.id,
      name: fullName(member),
      jobTitle: member.jobTitle || undefined,
      active: member.isActive,
      skills: member.skills.map((skill) => `${skill.name} (${skill.level.toLowerCase()})`),
      openTasksInProject: load.get(member.id)?.openTasks ?? 0,
      openPointsInProject: load.get(member.id)?.openPoints ?? 0,
    })),
    sprints: sprints.data.map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      status: sprint.status,
      startDate: isoDate(sprint.startDate),
      endDate: isoDate(sprint.endDate),
      objective: sprint.objective || undefined,
      stats: sprint.stats,
    })),
    tasksByStatus: Object.fromEntries(counts.map((row) => [row._id, row.count])),
    overdueTasks: overdue,
  };
}

async function listTasks(actor, project, args) {
  const filters = { limit: ASSISTANT_LIMITS.listTasksLimit };
  if (args.status) filters.status = args.status;
  if (args.search) filters.search = args.search;
  if (args.overdue) filters.overdue = true;
  if (args.sprintId) filters.sprint = args.sprintId === 'backlog' ? 'backlog' : (await projectSprint(project, args.sprintId)).id;
  if (args.assigneeId) {
    filters.assignee = args.assigneeId === 'unassigned' ? 'unassigned' : args.assigneeId;
    if (filters.assignee !== 'unassigned' && !isObjectId(filters.assignee)) throw new ToolError('Unknown assigneeId');
  }
  const [{ data, pagination }, sprints] = await Promise.all([
    taskService.listTasks(actor, project._id, filters),
    Sprint.find({ project: project._id }).select('name'),
  ]);
  const sprintNames = new Map(sprints.map((sprint) => [sprint.id, sprint.name]));
  return {
    total: pagination.total,
    shown: data.length,
    tasks: data.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      type: task.type,
      complexity: task.complexity,
      assignee: task.assignee ? { id: task.assignee.id, name: fullName(task.assignee) } : null,
      sprint: task.sprint ? { id: String(task.sprint), name: sprintNames.get(String(task.sprint)) } : 'backlog',
      deadline: isoDate(task.deadline),
      overdue: task.isOverdue || undefined,
      blockedReason: task.blockedReason || undefined,
      requiredSkills: task.requiredSkills,
    })),
  };
}

async function sprintRisk(actor, project, args) {
  const sprint = await projectSprint(project, args.sprintId);
  const risk = await aiRiskService.predictSprintRisk(actor, sprint.id);
  return {
    sprint: risk.sprint.name,
    riskLevel: risk.riskLevel,
    probability: risk.probability,
    factors: risk.factors.map((factor) => factor.label),
    measures: risk.measures,
    warnings: risk.warnings,
  };
}

async function recommendDevelopers(actor, project, args) {
  const task = await projectTask(project, args.taskId);
  const result = await aiRecommendationService.recommendDevelopers(actor, task.id);
  return {
    task: result.task.title,
    skills: result.skills,
    recommendations: result.recommendations.map((item) => ({
      developerId: item.developer.id,
      name: fullName(item.developer),
      score: item.score,
      explanation: item.explanation,
      isAssignee: item.isAssignee,
    })),
    warnings: result.warnings,
  };
}

const READERS = {
  get_project_overview: projectOverview,
  list_tasks: listTasks,
  get_sprint_risk: sprintRisk,
  recommend_developers: recommendDevelopers,
};

// ---------- write tools → proposals ----------
async function sprintLabel(project, sprintId) {
  if (sprintId === undefined) return undefined;
  if (sprintId === null || sprintId === 'backlog') return 'the backlog';
  return `«${(await projectSprint(project, sprintId, { open: true })).name}»`;
}

async function describeProposal(project, tool, args) {
  switch (tool) {
    case 'create_task': {
      const where = (await sprintLabel(project, args.sprintId ?? null)) ?? 'the backlog';
      const parts = [
        `Create the task «${args.title}» (${args.type ?? 'FEATURE'}, ${args.priority ?? 'MEDIUM'}, ${args.complexity ?? 3} points) in ${where}`,
      ];
      if (args.assigneeId) parts.push(`assigned to ${fullName(await projectMember(project, args.assigneeId))}`);
      if (args.deadline) parts.push(`deadline ${args.deadline}`);
      return parts.join(', ');
    }
    case 'update_task': {
      const task = await projectTask(project, args.taskId);
      const changes = ['title', 'description', 'type', 'priority', 'complexity', 'requiredSkills', 'deadline']
        .filter((field) => args[field] !== undefined)
        .map((field) => {
          if (field === 'description') return 'description';
          const value = Array.isArray(args[field]) ? args[field].join(', ') || 'none' : args[field];
          return `${field} → ${value}`;
        });
      if (args.sprintId !== undefined) changes.push(`sprint → ${await sprintLabel(project, args.sprintId)}`);
      if (changes.length === 0) throw new ToolError('update_task needs at least one field to change');
      return `Update «${task.title}»: ${changes.join(', ')}`;
    }
    case 'assign_task': {
      const task = await projectTask(project, args.taskId);
      if (!args.assigneeId) return `Unassign «${task.title}»`;
      return `Assign «${task.title}» to ${fullName(await projectMember(project, args.assigneeId))}`;
    }
    case 'change_task_status': {
      const task = await projectTask(project, args.taskId);
      if (!task.canTransitionTo(args.status)) {
        throw new ToolError(`«${task.title}» cannot move from ${task.status} to ${args.status}`);
      }
      const reason = args.status === TASK_STATUSES.BLOCKED && args.blockedReason ? ` (reason: ${args.blockedReason})` : '';
      return `Move «${task.title}» from ${STATUS_LABELS[task.status]} to ${STATUS_LABELS[args.status]}${reason}`;
    }
    case 'create_sprint':
      if (args.endDate < args.startDate) throw new ToolError('endDate must be on or after startDate');
      return `Create the sprint «${args.name}» (${args.startDate} → ${args.endDate})`;
    default:
      throw new ToolError(`Unknown tool ${tool}`);
  }
}

async function runTool(actor, project, call, proposals) {
  if (call.error) return { error: call.error };
  try {
    if (READ_TOOLS.includes(call.name)) return await READERS[call.name](actor, project, call.arguments);
    if (WRITE_TOOLS.includes(call.name)) {
      const summary = await describeProposal(project, call.name, call.arguments);
      const proposal = { id: crypto.randomUUID(), tool: call.name, arguments: call.arguments, summary };
      proposals.push(proposal);
      return { status: 'proposed', proposalId: proposal.id, summary, note: 'Waiting for the manager to confirm: it is NOT done yet.' };
    }
    return { error: `Unknown tool ${call.name}` };
  } catch (err) {
    if (err instanceof ToolError || err instanceof ApiError) return { error: err.message };
    throw err;
  }
}

// ---------- validation of the AI answer ----------
function parseTurn(payload) {
  const calls = payload?.toolCalls;
  const valid =
    ['message', 'tool_calls'].includes(payload?.type) &&
    typeof payload.content === 'string' &&
    payload.content.length <= 10000 &&
    Array.isArray(calls) &&
    calls.length <= 20 &&
    calls.every(
      (call) =>
        typeof call?.id === 'string' &&
        typeof call.name === 'string' &&
        call.arguments !== null &&
        typeof call.arguments === 'object' &&
        !Array.isArray(call.arguments) &&
        (call.error === null || call.error === undefined || typeof call.error === 'string') &&
        // Opaque provider data (Gemini thought_signature), sent back unchanged on the next turn.
        (call.extra === null ||
          call.extra === undefined ||
          (typeof call.extra === 'object' && !Array.isArray(call.extra) && JSON.stringify(call.extra).length <= 20000)),
    ) &&
    (payload.type === 'message' ? payload.content.trim().length > 0 : calls.length > 0);
  if (!valid) {
    logger.error('Invalid assistant answer from the AI service');
    throw new ApiError(502, 'AI_ERROR', 'The AI service returned an invalid assistant answer');
  }
  return payload;
}

async function assertAssistantAvailable() {
  const status = await aiClient.getStatus();
  if (!status.available) throw new ApiError(503, 'AI_UNAVAILABLE', 'The AI service is unavailable');
  if (!status.llm?.configured) {
    throw new ApiError(
      503,
      'LLM_NOT_CONFIGURED',
      'The assistant needs an LLM API key: set OPENAI_API_KEY (OpenAI, Google Gemini or another OpenAI-compatible provider) in ai-service/.env and restart the AI service',
    );
  }
}

async function chat(actor, projectId, { messages }) {
  const project = await access.findManagedProject(projectId, actor);
  await assertAssistantAvailable();

  const conversation = messages.map(({ role, content }) => ({ role, content }));
  const context = {
    name: project.name,
    description: (project.description ?? '').slice(0, 500),
    status: project.status,
    startDate: isoDate(project.startDate),
    deadline: isoDate(project.deadline),
    technologies: project.technologies,
    manager: fullName(actor),
  };
  const proposals = [];
  const toolsUsed = [];
  let model = null;
  for (let step = 0; step < ASSISTANT_LIMITS.maxSteps; step += 1) {
    const turn = parseTurn(
      await aiClient.request('/api/v1/ai/assistant/chat', {
        method: 'POST',
        json: { messages: conversation, project: context, today: isoDate(new Date()) },
      }),
    );
    model = turn.model ?? model;
    if (turn.type === 'message') return { reply: turn.content, proposals, toolsUsed, model };

    const calls = turn.toolCalls.slice(0, ASSISTANT_LIMITS.maxToolCalls - toolsUsed.length);
    if (calls.length === 0) break;
    conversation.push({
      role: 'assistant',
      content: turn.content,
      toolCalls: calls.map(({ id, name, arguments: args, extra }) => ({ id, name, arguments: args, ...(extra ? { extra } : {}) })),
    });
    for (const call of calls) {
      toolsUsed.push(call.name);
      const result = await runTool(actor, project, call, proposals);
      conversation.push({
        role: 'tool',
        toolCallId: call.id,
        content: JSON.stringify(result).slice(0, ASSISTANT_LIMITS.toolResultMaxLength),
      });
    }
  }
  return {
    reply: 'I could not finish this request within the allowed number of steps. Please ask a more specific question.',
    proposals,
    toolsUsed,
    model,
  };
}

// ---------- confirmed proposals ----------
/** Runs existing express-validator rules on a synthetic request: the same checks as the REST API. */
async function validated(rules, params, body) {
  const req = { params, body, query: {}, headers: {} };
  await Promise.all(rules.map((rule) => rule.run(req)));
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const details = result.array({ onlyFirstError: true }).map((err) => ({ field: err.path, message: err.msg }));
    throw ApiError.badRequest('Validation failed', details);
  }
  return matchedData(req, { locations: ['body'] });
}

const defined = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));

async function assertInProject(project, Model, id, label) {
  if (!isObjectId(id) || !(await Model.exists({ _id: id, project: project._id }))) {
    throw ApiError.notFound(`${label} not found in this project`);
  }
}

async function executeAction(actor, projectId, { tool, arguments: args }) {
  const project = await access.findManagedProject(projectId, actor);
  const id = project.id;
  switch (tool) {
    case 'create_task': {
      const data = await validated(createTaskRules, { id }, defined({
        title: args.title,
        description: args.description,
        type: args.type,
        priority: args.priority,
        complexity: args.complexity,
        requiredSkills: args.requiredSkills,
        deadline: args.deadline,
        sprint: args.sprintId ?? null,
        assignee: args.assigneeId ?? null,
      }));
      const task = await taskService.createTask(actor, id, data);
      return { tool, message: `Task «${task.title}» created.`, task };
    }
    case 'update_task': {
      await assertInProject(project, Task, args.taskId, 'Task');
      const sprint = args.sprintId === undefined ? undefined : args.sprintId === 'backlog' ? null : args.sprintId;
      const data = await validated(updateTaskRules, { id: args.taskId }, defined({
        title: args.title,
        description: args.description,
        type: args.type,
        priority: args.priority,
        complexity: args.complexity,
        requiredSkills: args.requiredSkills,
        deadline: args.deadline,
        sprint,
      }));
      const task = await taskService.updateTask(actor, args.taskId, data);
      return { tool, message: `Task «${task.title}» updated.`, task };
    }
    case 'assign_task': {
      await assertInProject(project, Task, args.taskId, 'Task');
      const data = await validated(assignRules, { id: args.taskId }, { assigneeId: args.assigneeId ?? null });
      const task = await taskService.assignTask(actor, args.taskId, data.assigneeId);
      return {
        tool,
        message: task.assignee ? `«${task.title}» assigned to ${fullName(task.assignee)}.` : `«${task.title}» unassigned.`,
        task,
      };
    }
    case 'change_task_status': {
      await assertInProject(project, Task, args.taskId, 'Task');
      const data = await validated(changeStatusRules, { id: args.taskId }, defined({ status: args.status, blockedReason: args.blockedReason }));
      const task = await taskService.changeTaskStatus(actor, args.taskId, data);
      return { tool, message: `«${task.title}» moved to ${STATUS_LABELS[task.status]}.`, task };
    }
    case 'create_sprint': {
      const data = await validated(createSprintRules, { id }, defined({
        name: args.name,
        objective: args.objective,
        startDate: args.startDate,
        endDate: args.endDate,
      }));
      const sprint = await sprintService.createSprint(actor, id, data);
      return { tool, message: `Sprint «${sprint.name}» created.`, sprint };
    }
    default:
      throw ApiError.badRequest('Validation failed', [{ field: 'tool', message: `Unknown tool: ${tool}` }]);
  }
}

module.exports = { chat, executeAction, ASSISTANT_LIMITS, READ_TOOLS, WRITE_TOOLS };
