// Test helpers (excluded from the application build, see tsconfig.app.json).
import { computed, signal } from '@angular/core';

import { AuthService } from '../core/auth/auth.service';
import { AiPlan, PlanTask } from '../core/models/ai-plan';
import { SprintRisk } from '../core/models/ai-risk';
import { Project, ProjectMember } from '../core/models/project';
import { Sprint } from '../core/models/sprint';
import { Task } from '../core/models/task';
import { Role, User } from '../core/models/user';

export function testUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    firstName: 'Sara',
    lastName: 'Manager',
    email: 'sara@example.com',
    role: 'PROJECT_MANAGER',
    isActive: true,
    jobTitle: '',
    bio: '',
    skills: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Project managed by testUser() (id u1), without members by default. */
export function testProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'E-commerce platform',
    description: 'Online shop with Stripe payment',
    startDate: '2026-10-01T00:00:00.000Z',
    deadline: '2027-01-31T00:00:00.000Z',
    status: 'PLANNING',
    technologies: ['Angular', 'Node.js'],
    manager: {
      id: 'u1',
      firstName: 'Sara',
      lastName: 'Manager',
      email: 'sara@example.com',
      jobTitle: '',
    },
    members: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

export function testMember(overrides: Partial<ProjectMember> = {}): ProjectMember {
  return {
    id: 'd1',
    firstName: 'Youssef',
    lastName: 'Alami',
    email: 'youssef@example.com',
    jobTitle: 'Full-stack developer',
    isActive: true,
    skills: [{ name: 'Angular', level: 'ADVANCED' }],
    ...overrides,
  };
}

export function testSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 's1',
    name: 'Sprint 1',
    objective: 'Authentication and catalog',
    project: 'p1',
    startDate: '2026-10-05T00:00:00.000Z',
    endDate: '2026-10-18T00:00:00.000Z',
    status: 'PLANNED',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    stats: {
      totalTasks: 3,
      completedTasks: 1,
      blockedTasks: 1,
      totalPoints: 10,
      completedPoints: 5,
      progress: 50,
      tasksByStatus: { TODO: 1, IN_PROGRESS: 0, CODE_REVIEW: 0, TESTING: 0, DONE: 1, BLOCKED: 1 },
    },
    ...overrides,
  };
}

/** Task of testProject(), assigned to testMember() (d1), in sprint s1. */
export function testTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Implement login page',
    description: 'Reactive form + JWT',
    type: 'FEATURE',
    priority: 'HIGH',
    complexity: 5,
    status: 'TODO',
    deadline: '2026-11-15T00:00:00.000Z',
    isOverdue: false,
    requiredSkills: ['Angular'],
    project: 'p1',
    sprint: 's1',
    assignee: { id: 'd1', firstName: 'Youssef', lastName: 'Alami', email: 'youssef@example.com' },
    createdBy: { id: 'u1', firstName: 'Sara', lastName: 'Manager', email: 'sara@example.com' },
    createdAt: '2026-10-02T09:00:00.000Z',
    updatedAt: '2026-10-02T09:00:00.000Z',
    ...overrides,
  };
}

export function testPlanTask(overrides: Partial<PlanTask> = {}): PlanTask {
  return {
    title: 'Sign in with email',
    description: 'As a customer, I want to sign in with my email.',
    type: 'FEATURE',
    priority: 'HIGH',
    complexity: 5,
    requiredSkills: ['Angular'],
    epic: 'Authentication',
    ...overrides,
  };
}

/** Plan proposed by the local analyzer: 2 sprints (2 + 1 tasks) and 1 backlog task. */
export function testPlan(overrides: Partial<AiPlan> = {}): AiPlan {
  return {
    method: 'local',
    model: 'naive-bayes-v3',
    warnings: ['The project deadline is passed by the last sprint.'],
    sprints: [
      {
        name: 'Sprint 1',
        objective: 'Authentication',
        startDate: '2026-10-05',
        endDate: '2026-10-18',
        tasks: [
          testPlanTask(),
          testPlanTask({ title: 'Reset the password', priority: 'MEDIUM', complexity: 3 }),
        ],
      },
      {
        name: 'Sprint 2',
        objective: 'Catalog',
        startDate: '2026-10-19',
        endDate: '2026-11-01',
        tasks: [testPlanTask({ title: 'Browse products', epic: 'Catalog', complexity: 8 })],
      },
    ],
    backlog: [testPlanTask({ title: 'Dark mode', priority: 'LOW', complexity: 2, epic: 'UI' })],
    stats: {
      taskCount: 4,
      sprintCount: 2,
      totalPoints: 16,
      epics: ['Authentication', 'Catalog', 'UI'],
    },
    options: { startDate: '2026-10-05', sprintLengthDays: 14, capacityPerSprint: 20 },
    source: { filename: 'cahier.docx', characters: 1200 },
    ...overrides,
  };
}

/** AI-03 answer: high risk of sprint s1 with two factors. */
export function testRisk(overrides: Partial<SprintRisk> = {}): SprintRisk {
  return {
    sprint: {
      id: 's1',
      name: 'Sprint 1',
      status: 'ACTIVE',
      startDate: '2026-10-05T00:00:00.000Z',
      endDate: '2026-10-18T00:00:00.000Z',
    },
    asOf: '2026-10-12',
    riskLevel: 'HIGH',
    probability: 0.82,
    method: 'model',
    factors: [
      {
        code: 'progress_gap',
        label: 'Behind schedule: 57% of the time elapsed, 20% of the story points done',
        impact: 2.1,
      },
      { code: 'blocked_ratio', label: '1 blocked task (50% of the open tasks)', impact: 0.6 },
    ],
    measures: {
      total: 3,
      done: 1,
      blocked: 1,
      highComplexityOpen: 0,
      unassignedOpen: 0,
      totalPoints: 10,
      donePoints: 2,
      teamSize: 2,
      historicalVelocity: null,
    },
    features: { progress_gap: 0.37 },
    model: {
      name: 'logistic regression (7 features, synthetic sprints)',
      accuracy: 0.864,
      rocAuc: 0.934,
    },
    warnings: [],
    ...overrides,
  };
}

/** Paginated response of a list endpoint. */
export function testPage<T>(data: T[], total = data.length) {
  return { data, pagination: { page: 1, limit: 20, total, totalPages: Math.ceil(total / 20) } };
}

function base64Url(value: object): string {
  return btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

/** Unsigned JWT-like token whose payload expires in `expiresInSeconds` (negative = expired). */
export function testToken(expiresInSeconds = 3600, claims: object = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: 'u1',
    role: 'PROJECT_MANAGER',
    iat: now,
    exp: now + expiresInSeconds,
    ...claims,
  };
  return `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url(payload)}.signature`;
}

/** AuthService replacement with a fixed session; methods are vi.fn() spies. */
export function fakeAuthService(user: User | null) {
  const session = signal(user);
  return {
    currentUser: session.asReadonly(),
    token: computed(() => (session() ? 'test-token' : null)),
    isAuthenticated: computed(() => session() !== null),
    hasRole: (...roles: Role[]) => {
      const current = session();
      return current !== null && roles.includes(current.role);
    },
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(() => session.set(null)),
    expireSession: vi.fn(),
    refreshOnStartup: vi.fn(),
    refreshCurrentUser: vi.fn(),
    updateCurrentUser: vi.fn((next: User) => session.set(next)),
    replaceSession: vi.fn(({ user: next }: { user: User }) => {
      session.set(next);
      return next;
    }),
  } satisfies Partial<Record<keyof AuthService, unknown>>;
}

export type FakeAuthService = ReturnType<typeof fakeAuthService>;
