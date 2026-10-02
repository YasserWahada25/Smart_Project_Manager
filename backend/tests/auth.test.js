const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const { User } = require('../src/models/user.model');
const { startTestDatabase, stopTestDatabase, clearTestDatabase } = require('./helpers/db');

const app = createApp();

const validUser = {
  firstName: 'Youssef',
  lastName: 'Ben Ali',
  email: 'youssef@example.com',
  password: 'Secret123',
};

const register = (body) => request(app).post('/api/v1/auth/register').send(body);
const login = (body) => request(app).post('/api/v1/auth/login').send(body);
const me = (authorization) => {
  const req = request(app).get('/api/v1/auth/me');
  return authorization ? req.set('Authorization', authorization) : req;
};

beforeAll(async () => {
  await startTestDatabase();
  await User.init(); // build the unique email index before tests run
});
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

describe('POST /api/v1/auth/register', () => {
  it('creates a DEVELOPER by default and returns a token without the password', async () => {
    const res = await register(validUser);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ tokenType: 'Bearer', expiresIn: '1h' });
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({
      firstName: 'Youssef',
      lastName: 'Ben Ali',
      email: 'youssef@example.com',
      role: 'DEVELOPER',
      isActive: true,
    });
    expect(res.body.user.id).toBeDefined();
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user._id).toBeUndefined();

    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload).toMatchObject({ sub: res.body.user.id, role: 'DEVELOPER' });
  });

  it('stores the password as a bcrypt hash', async () => {
    await register(validUser);

    const stored = await User.findOne({ email: validUser.email }).select('+password');
    expect(stored.password).not.toBe(validUser.password);
    expect(stored.password).toMatch(/^\$2[aby]\$/);
  });

  it('allows self-registration as PROJECT_MANAGER', async () => {
    const res = await register({ ...validUser, role: 'PROJECT_MANAGER' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('PROJECT_MANAGER');
  });

  it('rejects self-registration as ADMIN', async () => {
    const res = await register({ ...validUser, role: 'ADMIN' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: 'role', message: 'Role must be one of: DEVELOPER, PROJECT_MANAGER' },
    ]);
    expect(await User.countDocuments()).toBe(0);
  });

  it('ignores fields that are not part of the registration form', async () => {
    const res = await register({ ...validUser, isActive: false, _id: '507f1f77bcf86cd799439011' });

    expect(res.status).toBe(201);
    expect(res.body.user.isActive).toBe(true);
    expect(res.body.user.id).not.toBe('507f1f77bcf86cd799439011');
  });

  it('normalizes the email (trim + lowercase)', async () => {
    const res = await register({ ...validUser, email: '  Youssef@Example.COM ' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('youssef@example.com');
  });

  it('returns 409 when the email is already registered (case-insensitive)', async () => {
    await register(validUser);
    const res = await register({ ...validUser, email: 'YOUSSEF@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'CONFLICT', message: 'Email is already registered' });
  });

  it('returns 400 with one message per invalid field', async () => {
    const res = await register({ email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        { field: 'firstName', message: 'First name is required' },
        { field: 'lastName', message: 'Last name is required' },
        { field: 'email', message: 'Email is invalid' },
        { field: 'password', message: 'Password must be at least 8 characters' },
      ]),
    );
  });

  it.each([
    ['without a digit', 'Password', 'Password must contain at least one digit'],
    ['without a letter', '12345678', 'Password must contain at least one letter'],
    ['longer than 72 bytes', `a1${'x'.repeat(71)}`, 'Password must be at most 72 bytes'],
  ])('rejects a password %s', async (_label, password, message) => {
    const res = await register({ ...validUser, password });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'password', message }]);
  });

  it('rejects non-string values', async () => {
    const res = await register({ ...validUser, firstName: { $gt: '' } });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'firstName', message: 'First name is required' }]);
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => register(validUser));

  it('returns a token and the user for valid credentials', async () => {
    const res = await login({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({ email: validUser.email, role: 'DEVELOPER' });
    expect(res.body.user.password).toBeUndefined();
  });

  it('accepts the email in any case', async () => {
    const res = await login({ email: 'YOUSSEF@EXAMPLE.COM', password: validUser.password });

    expect(res.status).toBe(200);
  });

  it('returns 401 for a wrong password', async () => {
    const res = await login({ email: validUser.email, password: 'Wrong1234' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
  });

  it('returns the same 401 for an unknown email (no account enumeration)', async () => {
    const res = await login({ email: 'nobody@example.com', password: validUser.password });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('returns 403 for a deactivated account', async () => {
    await User.updateOne({ email: validUser.email }, { isActive: false });

    const res = await login({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: 'FORBIDDEN', message: 'Account is deactivated' });
  });

  it('returns 400 when credentials are missing', async () => {
    const res = await login({});

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { field: 'email', message: 'Email is required' },
      { field: 'password', message: 'Password is required' },
    ]);
  });

  it('rejects a NoSQL injection attempt in the email field', async () => {
    const res = await login({ email: { $ne: null }, password: validUser.password });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/auth/me', () => {
  let token;
  let userId;

  beforeEach(async () => {
    const res = await register(validUser);
    token = res.body.token;
    userId = res.body.user.id;
  });

  const signToken = (payload, options = {}) =>
    jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h', ...options });

  it('returns the current user for a valid token', async () => {
    const res = await me(`Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: userId, email: validUser.email, role: 'DEVELOPER' });
    expect(res.body.user.password).toBeUndefined();
  });

  it('returns 401 without an Authorization header', async () => {
    const res = await me();

    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  });

  it('returns 401 for a non-Bearer Authorization header', async () => {
    const res = await me(`Basic ${token}`);

    expect(res.status).toBe(401);
  });

  it('returns 401 for a token signed with another secret', async () => {
    const forged = jwt.sign({ role: 'ADMIN' }, 'another-secret-another-secret-123', { subject: userId });

    const res = await me(`Bearer ${forged}`);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid token');
  });

  it('returns 401 for an unsigned token (alg "none")', async () => {
    const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: userId, role: 'ADMIN' })}.`;

    const res = await me(`Bearer ${unsigned}`);

    expect(res.status).toBe(401);
  });

  it('returns 401 for an expired token', async () => {
    const expired = signToken({ role: 'DEVELOPER' }, { subject: userId, expiresIn: -10 });

    const res = await me(`Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Token has expired');
  });

  it('returns 401 when the user no longer exists', async () => {
    await User.deleteOne({ _id: userId });

    const res = await me(`Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it('returns 401 when the account has been deactivated', async () => {
    await User.updateOne({ _id: userId }, { isActive: false });

    const res = await me(`Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Account is deactivated');
  });

  it('uses the role stored in MongoDB, not the role claimed in the token', async () => {
    const tampered = signToken({ role: 'ADMIN' }, { subject: userId });

    const res = await me(`Bearer ${tampered}`);

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('DEVELOPER');
  });
});
