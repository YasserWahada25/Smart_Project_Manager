import { Activity, describeActivity } from './activity';

describe('describeActivity', () => {
  const activity = (overrides: Partial<Activity>): Activity => ({
    id: 'a1',
    type: 'TASK_CREATED',
    project: 'p1',
    actor: { id: 'u1', firstName: 'Sara', lastName: 'Manager' },
    details: {},
    createdAt: '2026-10-02T10:00:00.000Z',
    ...overrides,
  });
  const youssef = { id: 'd1', firstName: 'Youssef', lastName: 'Alami' };

  it.each<[Partial<Activity>, string]>([
    [{ type: 'PROJECT_CREATED', details: { name: 'Shop' } }, 'created the project «Shop»'],
    [
      { type: 'PROJECT_STATUS_CHANGED', details: { from: 'PLANNING', to: 'ACTIVE' } },
      'changed the project status from Planning to Active',
    ],
    [
      { type: 'PROJECT_UPDATED', details: { fields: ['name', 'deadline'] } },
      'updated the project (name, deadline)',
    ],
    [
      { type: 'MEMBER_ADDED', details: { name: 'Youssef Alami' } },
      'added Youssef Alami to the team',
    ],
    [{ type: 'MEMBER_REMOVED', targetUser: youssef }, 'removed Youssef Alami from the team'],
    [{ type: 'MEMBER_REMOVED', targetUser: null }, 'removed a former member from the team'],
    [
      { type: 'SPRINT_STATUS_CHANGED', details: { name: 'S1', from: 'PLANNED', to: 'ACTIVE' } },
      'moved the sprint «S1» from Planned to Active',
    ],
    [
      { type: 'TASK_ASSIGNED', details: { title: 'Login' }, targetUser: youssef },
      'assigned «Login» to Youssef Alami',
    ],
    [
      { type: 'TASK_UNASSIGNED', details: { title: 'Login' }, targetUser: youssef },
      'unassigned Youssef Alami from «Login»',
    ],
    [
      { type: 'TASK_STATUS_CHANGED', details: { title: 'Login', from: 'TODO', to: 'IN_PROGRESS' } },
      'moved «Login» from To do to In progress',
    ],
    [{ type: 'TASK_DELETED', details: { title: 'Cart' } }, 'deleted the task «Cart»'],
    [{ type: 'COMMENT_ADDED', details: { title: 'Login' } }, 'commented on «Login»'],
  ])('%o → "%s"', (overrides, expected) => {
    expect(describeActivity(activity(overrides))).toBe(expected);
  });
});
