const { Project, PROJECT_STATUSES } = require('../models/project.model');
const { Sprint, SPRINT_STATUSES } = require('../models/sprint.model');
const { Task, TASK_STATUSES, TASK_PRIORITIES } = require('../models/task.model');
const { User, ROLES } = require('../models/user.model');
const access = require('./projectAccess.service');
const { computeSprintStats } = require('./sprint.service');

const DAY_MS = 24 * 60 * 60 * 1000;
const USER_SUMMARY = 'firstName lastName email';

function zeroCounts(values) {
  return Object.fromEntries(values.map((value) => [value, 0]));
}

function toCounts(values, rows) {
  const counts = zeroCounts(values);
  rows.forEach(({ _id, count }) => {
    counts[_id] = count;
  });
  return counts;
}

/** Days left before a date (negative when the date has passed). */
function daysUntil(date, now = Date.now()) {
  return date ? Math.ceil((date.getTime() - now) / DAY_MS) : null;
}

/** Task indicators for the tasks matching `match` (one aggregation). */
async function taskIndicators(match) {
  const [result] = await Task.aggregate([
    { $match: match },
    {
      $facet: {
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        byPriority: [{ $group: { _id: '$priority', count: { $sum: 1 } } }],
        overdue: [{ $match: { deadline: { $lt: new Date() }, status: { $ne: TASK_STATUSES.DONE } } }, { $count: 'count' }],
      },
    },
  ]);

  const byStatus = toCounts(Object.values(TASK_STATUSES), result.byStatus);
  return {
    total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
    completed: byStatus.DONE,
    blocked: byStatus.BLOCKED,
    overdue: result.overdue[0]?.count ?? 0,
    byStatus,
    byPriority: toCounts(Object.values(TASK_PRIORITIES), result.byPriority),
  };
}

/**
 * Open work (tasks not DONE) per assignee, heaviest first.
 * `members`: when given, every listed user appears, even with no task.
 */
async function workload(projectIds, members) {
  const rows = await Task.aggregate([
    { $match: { project: { $in: projectIds }, status: { $ne: TASK_STATUSES.DONE }, assignee: { $ne: null } } },
    {
      $group: {
        _id: '$assignee',
        openTasks: { $sum: 1 },
        openPoints: { $sum: '$complexity' },
        inProgressTasks: { $sum: { $cond: [{ $eq: ['$status', TASK_STATUSES.IN_PROGRESS] }, 1, 0] } },
        blockedTasks: { $sum: { $cond: [{ $eq: ['$status', TASK_STATUSES.BLOCKED] }, 1, 0] } },
      },
    },
  ]);

  const userIds = members ?? rows.map((row) => row._id);
  const users = await User.find({ _id: { $in: userIds } }).select(USER_SUMMARY);
  const rowByUser = new Map(rows.map((row) => [String(row._id), row]));

  return users
    .map((user) => {
      const row = rowByUser.get(user.id) ?? {};
      return {
        user,
        openTasks: row.openTasks ?? 0,
        openPoints: row.openPoints ?? 0,
        inProgressTasks: row.inProgressTasks ?? 0,
        blockedTasks: row.blockedTasks ?? 0,
      };
    })
    .sort((a, b) => b.openPoints - a.openPoints || b.openTasks - a.openTasks);
}

/** Active sprints with their progress and the number of days left. */
async function activeSprints(projectIds) {
  const sprints = await Sprint.find({ project: { $in: projectIds }, status: SPRINT_STATUSES.ACTIVE })
    .sort({ endDate: 1 })
    .populate({ path: 'project', select: 'name' });
  const statsBySprint = await computeSprintStats(sprints.map((sprint) => sprint._id));

  return sprints.map((sprint) => ({
    ...sprint.toJSON(),
    daysRemaining: daysUntil(sprint.endDate),
    stats: statsBySprint.get(sprint.id),
  }));
}

async function platformIndicators() {
  const rows = await User.aggregate([{ $group: { _id: { role: '$role', isActive: '$isActive' }, count: { $sum: 1 } } }]);
  const byRole = zeroCounts(Object.values(ROLES));
  let active = 0;
  let total = 0;
  rows.forEach(({ _id, count }) => {
    byRole[_id.role] += count;
    total += count;
    if (_id.isActive) active += count;
  });
  return { users: { total, active, inactive: total - active, byRole } };
}

/**
 * Global dashboard, scoped to the projects the user can see:
 *  - everyone: project, sprint and task indicators;
 *  - PROJECT_MANAGER / ADMIN: developer workload;
 *  - DEVELOPER: indicators of their own tasks;
 *  - ADMIN: platform (users) indicators.
 */
async function getDashboard(user) {
  const projects = await Project.find(access.visibleProjectsFilter(user)).select('status');
  const projectIds = projects.map((project) => project._id);

  const projectsByStatus = zeroCounts(Object.values(PROJECT_STATUSES));
  projects.forEach((project) => {
    projectsByStatus[project.status] += 1;
  });

  const [tasks, sprints] = await Promise.all([taskIndicators({ project: { $in: projectIds } }), activeSprints(projectIds)]);

  const dashboard = {
    role: user.role,
    projects: { total: projects.length, active: projectsByStatus.ACTIVE, byStatus: projectsByStatus },
    sprints: { active: sprints.length, activeSprints: sprints },
    tasks,
  };

  if (user.role === ROLES.DEVELOPER) {
    dashboard.myTasks = await taskIndicators({ project: { $in: projectIds }, assignee: user._id });
  } else {
    dashboard.workload = await workload(projectIds);
  }
  if (user.role === ROLES.ADMIN) {
    dashboard.platform = await platformIndicators();
  }
  return dashboard;
}

/** Dashboard of one project (any project viewer). */
async function getProjectDashboard(user, projectId) {
  const project = await access.findViewableProject(projectId, user);

  const [tasks, sprints, sprintRows, team] = await Promise.all([
    taskIndicators({ project: project._id }),
    activeSprints([project._id]),
    Sprint.aggregate([{ $match: { project: project._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    workload([project._id], project.members),
  ]);

  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      startDate: project.startDate,
      deadline: project.deadline,
      daysRemaining: daysUntil(project.deadline),
      memberCount: project.members.length,
    },
    tasks,
    sprints: {
      total: sprintRows.reduce((sum, row) => sum + row.count, 0),
      byStatus: toCounts(Object.values(SPRINT_STATUSES), sprintRows),
      activeSprint: sprints[0] ?? null,
    },
    workload: team,
  };
}

module.exports = { getDashboard, getProjectDashboard };
