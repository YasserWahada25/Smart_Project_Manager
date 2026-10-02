const mongoose = require('mongoose');
const { User, ROLES } = require('../src/models/user.model');
const { startTestDatabase, stopTestDatabase, clearTestDatabase } = require('./helpers/db');

const userData = {
  firstName: 'Amira',
  lastName: 'Trabelsi',
  email: 'amira@example.com',
  password: 'Secret123',
};

beforeAll(async () => {
  await startTestDatabase();
  await User.init();
});
afterEach(clearTestDatabase);
afterAll(stopTestDatabase);

describe('User model', () => {
  it('applies defaults: DEVELOPER role, active account, timestamps', async () => {
    const user = await User.create(userData);

    expect(user.role).toBe(ROLES.DEVELOPER);
    expect(user.isActive).toBe(true);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('hashes the password on save and verifies it with comparePassword', async () => {
    await User.create(userData);
    const user = await User.findOne({ email: userData.email }).select('+password');

    expect(user.password).not.toBe(userData.password);
    await expect(user.comparePassword('Secret123')).resolves.toBe(true);
    await expect(user.comparePassword('Wrong1234')).resolves.toBe(false);
  });

  it('does not re-hash the password when another field changes', async () => {
    await User.create(userData);
    const user = await User.findOne({ email: userData.email }).select('+password');
    const originalHash = user.password;

    user.firstName = 'Amira-Updated';
    await user.save();

    const reloaded = await User.findById(user.id).select('+password');
    expect(reloaded.password).toBe(originalHash);
  });

  it('does not return the password by default', async () => {
    await User.create(userData);
    const user = await User.findOne({ email: userData.email });

    expect(user.password).toBeUndefined();
  });

  it('serializes to JSON with "id" and without password, _id or __v', async () => {
    const user = await User.create(userData);
    const json = user.toJSON();

    expect(json.id).toBe(user._id.toString());
    expect(json).not.toHaveProperty('password');
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('__v');
  });

  it('rejects an unknown role', async () => {
    await expect(User.create({ ...userData, role: 'SUPERUSER' })).rejects.toBeInstanceOf(
      mongoose.Error.ValidationError,
    );
  });

  it('rejects duplicate skill names (case-insensitive) and unknown skill levels', async () => {
    const duplicate = User.create({
      ...userData,
      skills: [
        { name: 'React', level: 'BEGINNER' },
        { name: 'react', level: 'EXPERT' },
      ],
    });
    await expect(duplicate).rejects.toThrow('Skill names must be unique');

    const badLevel = User.create({ ...userData, skills: [{ name: 'React', level: 'GURU' }] });
    await expect(badLevel).rejects.toBeInstanceOf(mongoose.Error.ValidationError);
  });

  it('rejects more than 50 skills', async () => {
    const skills = Array.from({ length: 51 }, (_, i) => ({ name: `Skill ${i}`, level: 'BEGINNER' }));

    await expect(User.create({ ...userData, skills })).rejects.toThrow('A user can have at most 50 skills');
  });

  it('records passwordChangedAt when the password changes, not at creation', async () => {
    await User.create(userData);
    const user = await User.findOne({ email: userData.email }).select('+password');
    expect(user.passwordChangedAt).toBeUndefined();

    user.password = 'NewSecret456';
    await user.save();

    expect(user.passwordChangedAt).toBeInstanceOf(Date);
    const changedAtSeconds = Math.floor(user.passwordChangedAt.getTime() / 1000);
    expect(user.isTokenIssuedBeforePasswordChange(changedAtSeconds - 1)).toBe(true);
    expect(user.isTokenIssuedBeforePasswordChange(changedAtSeconds)).toBe(false);
  });

  it('enforces unique emails at the database level', async () => {
    await User.create(userData);

    await expect(User.create({ ...userData, email: 'AMIRA@example.com' })).rejects.toMatchObject({ code: 11000 });
  });
});
