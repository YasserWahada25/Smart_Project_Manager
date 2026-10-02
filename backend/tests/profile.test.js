const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const { User, ROLES } = require('../src/models/user.model');
const { signAccessToken } = require('../src/services/token.service');
const { startTestDatabase, stopTestDatabase, clearTestDatabase } = require('./helpers/db');

const app = createApp();
const PASSWORD = 'Secret123';

let user;
let token;

const withAuth = (req, authToken = token) => req.set('Authorization', `Bearer ${authToken}`);
const getProfile = (authToken) => withAuth(request(app).get('/api/v1/profile'), authToken);
const patchProfile = (body) => withAuth(request(app).patch('/api/v1/profile').send(body));
const changePassword = (body) => withAuth(request(app).patch('/api/v1/profile/password').send(body));
const putSkills = (body, authToken) => withAuth(request(app).put('/api/v1/profile/skills').send(body), authToken);
const login = (password) => request(app).post('/api/v1/auth/login').send({ email: 'youssef@example.com', password });

beforeAll(startTestDatabase);

beforeEach(async () => {
  user = await User.create({
    firstName: 'Youssef',
    lastName: 'Ben Ali',
    email: 'youssef@example.com',
    password: PASSWORD,
  });
  token = signAccessToken(user);
});

afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

describe('Profile endpoints require authentication', () => {
  it.each([
    ['get', '/api/v1/profile'],
    ['patch', '/api/v1/profile'],
    ['patch', '/api/v1/profile/password'],
    ['put', '/api/v1/profile/skills'],
  ])('%s %s → 401 without token', async (method, url) => {
    const res = await request(app)[method](url);

    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/profile', () => {
  it('returns the profile with default values and no sensitive fields', async () => {
    const res = await getProfile();

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: user.id,
      email: 'youssef@example.com',
      jobTitle: '',
      bio: '',
      skills: [],
    });
    expect(res.body.user).not.toHaveProperty('password');
    expect(res.body.user).not.toHaveProperty('passwordChangedAt');
  });
});

describe('PATCH /api/v1/profile', () => {
  it('updates names, job title and bio (trimmed)', async () => {
    const res = await patchProfile({
      firstName: ' Youssef-Amine ',
      lastName: 'Ben Salah',
      jobTitle: '  Backend developer ',
      bio: 'Node.js and Python enthusiast.',
    });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      firstName: 'Youssef-Amine',
      lastName: 'Ben Salah',
      jobTitle: 'Backend developer',
      bio: 'Node.js and Python enthusiast.',
    });
    expect((await User.findById(user.id)).jobTitle).toBe('Backend developer');
  });

  it('allows a partial update and clearing a text field', async () => {
    await patchProfile({ jobTitle: 'Developer' });

    const res = await patchProfile({ jobTitle: '' });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ firstName: 'Youssef', jobTitle: '' });
  });

  it('ignores email, role, isActive and password', async () => {
    const res = await patchProfile({
      firstName: 'Changed',
      email: 'other@example.com',
      role: 'ADMIN',
      isActive: false,
      password: 'Hacked123',
    });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      firstName: 'Changed',
      email: 'youssef@example.com',
      role: 'DEVELOPER',
      isActive: true,
    });
    expect((await login(PASSWORD)).status).toBe(200);
  });

  it('returns 400 when no updatable field is provided', async () => {
    const res = await patchProfile({ role: 'ADMIN' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe(
      'Provide at least one field to update: firstName, lastName, jobTitle, bio',
    );
  });

  it.each([
    [{ firstName: '' }, 'firstName', 'First name is required'],
    [{ lastName: 'x'.repeat(51) }, 'lastName', 'Last name must be at most 50 characters'],
    [{ jobTitle: 42 }, 'jobTitle', 'Job title must be a string'],
    [{ bio: 'x'.repeat(501) }, 'bio', 'Bio must be at most 500 characters'],
  ])('returns 400 for %j', async (body, field, message) => {
    const res = await patchProfile(body);

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field, message }]);
  });
});

describe('PATCH /api/v1/profile/password', () => {
  it('changes the password and returns a new working token', async () => {
    const res = await changePassword({ currentPassword: PASSWORD, newPassword: 'NewSecret456' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ tokenType: 'Bearer', user: { id: user.id } });
    expect((await getProfile(res.body.token)).status).toBe(200);
    expect((await login('NewSecret456')).status).toBe(200);
    expect((await login(PASSWORD)).status).toBe(401);
  });

  it('invalidates tokens issued before the change', async () => {
    const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60;
    const oldToken = jwt.sign({ role: user.role, iat: oneMinuteAgo }, process.env.JWT_SECRET, {
      subject: user.id,
      expiresIn: '1h',
    });
    expect((await getProfile(oldToken)).status).toBe(200);

    await changePassword({ currentPassword: PASSWORD, newPassword: 'NewSecret456' });

    const res = await getProfile(oldToken);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Password has been changed, please log in again');
  });

  it('returns 400 (not 401) when the current password is wrong', async () => {
    const res = await changePassword({ currentPassword: 'Wrong1234', newPassword: 'NewSecret456' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'currentPassword', message: 'Current password is incorrect' }]);
    expect((await login(PASSWORD)).status).toBe(200);
  });

  it.each([
    [{ newPassword: 'NewSecret456' }, 'currentPassword', 'Current password is required'],
    [{ currentPassword: PASSWORD }, 'newPassword', 'New password is required'],
    [{ currentPassword: PASSWORD, newPassword: 'short1' }, 'newPassword', 'New password must be at least 8 characters'],
    [{ currentPassword: PASSWORD, newPassword: 'NoDigitsHere' }, 'newPassword', 'New password must contain at least one digit'],
    [
      { currentPassword: PASSWORD, newPassword: PASSWORD },
      'newPassword',
      'New password must be different from the current password',
    ],
  ])('returns 400 for %j', async (body, field, message) => {
    const res = await changePassword(body);

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field, message }]);
  });
});

describe('PUT /api/v1/profile/skills', () => {
  const skills = [
    { name: ' Node.js ', level: 'ADVANCED', yearsOfExperience: 3 },
    { name: 'MongoDB', level: 'INTERMEDIATE' },
  ];

  it('replaces the skill list', async () => {
    const res = await putSkills({ skills });

    expect(res.status).toBe(200);
    expect(res.body.user.skills).toEqual([
      { name: 'Node.js', level: 'ADVANCED', yearsOfExperience: 3 },
      { name: 'MongoDB', level: 'INTERMEDIATE' },
    ]);

    const second = await putSkills({ skills: [{ name: 'Python', level: 'EXPERT', yearsOfExperience: '5' }] });

    expect(second.body.user.skills).toEqual([{ name: 'Python', level: 'EXPERT', yearsOfExperience: 5 }]);
    expect((await User.findById(user.id)).skills).toHaveLength(1);
  });

  it('removes every skill with an empty array', async () => {
    await putSkills({ skills });

    const res = await putSkills({ skills: [] });

    expect(res.status).toBe(200);
    expect(res.body.user.skills).toEqual([]);
  });

  it('is available to every role (here a project manager)', async () => {
    const manager = await User.create({
      firstName: 'Sara',
      lastName: 'PM',
      email: 'sara@example.com',
      password: PASSWORD,
      role: ROLES.PROJECT_MANAGER,
    });

    const res = await putSkills({ skills }, signAccessToken(manager));

    expect(res.status).toBe(200);
    expect(res.body.user.skills).toHaveLength(2);
  });

  it('does not store unknown fields of a skill', async () => {
    const res = await putSkills({ skills: [{ name: 'React', level: 'BEGINNER', verified: true }] });

    expect(res.status).toBe(200);
    expect(res.body.user.skills).toEqual([{ name: 'React', level: 'BEGINNER' }]);
  });

  it('rejects duplicate skill names, case-insensitively', async () => {
    const res = await putSkills({
      skills: [
        { name: 'React', level: 'BEGINNER' },
        { name: ' react ', level: 'EXPERT' },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'skills', message: 'Duplicate skill: react' }]);
  });

  it('reports the errors of every invalid skill', async () => {
    const res = await putSkills({
      skills: [
        { name: '', level: 'ADVANCED' },
        { name: 'Docker', level: 'GURU' },
        { name: 'Git', level: 'EXPERT', yearsOfExperience: 51 },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: 'skills[0].name', message: 'Skill name is required (at most 50 characters)' },
      { field: 'skills[1].level', message: 'Skill level must be one of: BEGINNER, INTERMEDIATE, ADVANCED, EXPERT' },
      { field: 'skills[2].yearsOfExperience', message: 'Years of experience must be an integer between 0 and 50' },
    ]);
  });

  it.each([
    [{}, 'skills must be an array of at most 50 items'],
    [{ skills: 'Node.js' }, 'skills must be an array of at most 50 items'],
    [
      { skills: Array.from({ length: 51 }, (_, i) => ({ name: `Skill ${i}`, level: 'BEGINNER' })) },
      'skills must be an array of at most 50 items',
    ],
  ])('returns 400 for an invalid skills value (%#)', async (body, message) => {
    const res = await putSkills(body);

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'skills', message }]);
  });
});
