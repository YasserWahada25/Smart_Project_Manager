const { User, ROLES } = require('../src/models/user.model');
const { createAdminAccount } = require('../src/services/user.service');
const { startTestDatabase, stopTestDatabase, clearTestDatabase } = require('./helpers/db');

const adminData = {
  firstName: 'Platform',
  lastName: 'Administrator',
  email: 'admin@example.com',
  password: 'AdminPass1',
};

beforeAll(startTestDatabase);
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

describe('createAdminAccount (npm run create-admin)', () => {
  it('creates an active ADMIN account with a hashed password', async () => {
    const { created, user } = await createAdminAccount(adminData);

    expect(created).toBe(true);
    expect(user).toMatchObject({ email: 'admin@example.com', role: ROLES.ADMIN, isActive: true });

    const stored = await User.findById(user.id).select('+password');
    await expect(stored.comparePassword('AdminPass1')).resolves.toBe(true);
  });

  it('normalizes the email', async () => {
    const { user } = await createAdminAccount({ ...adminData, email: '  Admin@Example.COM ' });

    expect(user.email).toBe('admin@example.com');
  });

  it('is idempotent when the admin already exists', async () => {
    await createAdminAccount(adminData);

    const { created } = await createAdminAccount({ ...adminData, password: 'Different1' });

    expect(created).toBe(false);
    expect(await User.countDocuments()).toBe(1);
    const stored = await User.findOne({ email: adminData.email }).select('+password');
    await expect(stored.comparePassword('AdminPass1')).resolves.toBe(true);
  });

  it('refuses to take over an existing non-admin account', async () => {
    await User.create({ ...adminData, role: ROLES.DEVELOPER });

    await expect(createAdminAccount(adminData)).rejects.toMatchObject({
      statusCode: 409,
      message: 'A non-admin user with the email admin@example.com already exists',
    });
    expect((await User.findOne({ email: adminData.email })).role).toBe(ROLES.DEVELOPER);
  });

  it('enforces the password policy', async () => {
    await expect(createAdminAccount({ ...adminData, password: 'weak' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'Password must be at least 8 characters',
    });
    expect(await User.countDocuments()).toBe(0);
  });
});
