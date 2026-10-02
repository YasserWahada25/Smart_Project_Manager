const { Project } = require('../models/project.model');
const { Task } = require('../models/task.model');
const { containsInsensitive } = require('../utils/regex');
const access = require('./projectAccess.service');

const DEFAULT_LIMIT = 5;

/**
 * Global search over the projects and tasks the user can see.
 * Projects: name or description; tasks: title or description (case-insensitive "contains").
 */
async function search(user, { q, limit = DEFAULT_LIMIT }) {
  const pattern = containsInsensitive(q);
  const visible = access.visibleProjectsFilter(user);
  const projectIds = await Project.find(visible).distinct('_id');

  const projectFilter = { _id: { $in: projectIds }, $or: [{ name: pattern }, { description: pattern }] };
  const taskFilter = { project: { $in: projectIds }, $or: [{ title: pattern }, { description: pattern }] };

  const [projects, projectTotal, tasks, taskTotal] = await Promise.all([
    Project.find(projectFilter).select('name description status startDate deadline').sort({ updatedAt: -1 }).limit(limit),
    Project.countDocuments(projectFilter),
    Task.find(taskFilter)
      .select('title status priority type project sprint assignee')
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate([
        { path: 'project', select: 'name' },
        { path: 'assignee', select: 'firstName lastName' },
      ]),
    Task.countDocuments(taskFilter),
  ]);

  return {
    query: q,
    projects: { total: projectTotal, items: projects },
    tasks: { total: taskTotal, items: tasks },
  };
}

module.exports = { search };
