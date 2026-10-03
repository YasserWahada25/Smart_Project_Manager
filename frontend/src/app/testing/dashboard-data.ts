// Test data of the dashboards (used by the specs only).
import {
  ActiveSprint,
  DashboardData,
  ProjectDashboardData,
  TaskIndicators,
  WorkloadRow,
} from '../core/models/dashboard';
import { testSprint } from './test-data';

export function testIndicators(overrides: Partial<TaskIndicators> = {}): TaskIndicators {
  return {
    total: 6,
    completed: 2,
    blocked: 1,
    overdue: 1,
    byStatus: { TODO: 2, IN_PROGRESS: 1, CODE_REVIEW: 0, TESTING: 0, DONE: 2, BLOCKED: 1 },
    byPriority: { LOW: 1, MEDIUM: 2, HIGH: 2, CRITICAL: 1 },
    ...overrides,
  };
}

export function testWorkloadRow(overrides: Partial<WorkloadRow> = {}): WorkloadRow {
  return {
    user: { id: 'd1', firstName: 'Youssef', lastName: 'Alami', email: 'youssef@example.com' },
    openTasks: 3,
    openPoints: 8,
    inProgressTasks: 1,
    blockedTasks: 1,
    ...overrides,
  };
}

export function testActiveSprint(overrides: Partial<ActiveSprint> = {}): ActiveSprint {
  const { stats, ...sprint } = testSprint({ status: 'ACTIVE' });
  return {
    ...sprint,
    project: { id: 'p1', name: 'E-commerce platform' },
    daysRemaining: 5,
    stats: stats!,
    ...overrides,
  };
}

export function testDashboard(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    role: 'PROJECT_MANAGER',
    projects: {
      total: 2,
      active: 1,
      byStatus: { PLANNING: 1, ACTIVE: 1, PAUSED: 0, COMPLETED: 0, ARCHIVED: 0 },
    },
    sprints: { active: 1, activeSprints: [testActiveSprint()] },
    tasks: testIndicators(),
    ...overrides,
  };
}

export function testProjectDashboard(
  overrides: Partial<ProjectDashboardData> = {},
): ProjectDashboardData {
  return {
    project: {
      id: 'p1',
      name: 'E-commerce platform',
      status: 'ACTIVE',
      startDate: '2026-10-01T00:00:00.000Z',
      deadline: '2027-01-31T00:00:00.000Z',
      daysRemaining: 120,
      memberCount: 2,
    },
    tasks: testIndicators(),
    sprints: {
      total: 2,
      byStatus: { PLANNED: 0, ACTIVE: 1, COMPLETED: 1, CANCELLED: 0 },
      activeSprint: testActiveSprint(),
    },
    workload: [
      testWorkloadRow(),
      testWorkloadRow({
        user: { id: 'd2', firstName: 'Lina', lastName: 'Ben', email: 'l@b.c' },
        openTasks: 0,
        openPoints: 0,
        inProgressTasks: 0,
        blockedTasks: 0,
      }),
    ],
    ...overrides,
  };
}
