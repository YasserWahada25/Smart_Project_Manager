const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { config } = require('../config/env');
const toJSONPlugin = require('./plugins/toJSON.plugin');

const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  DEVELOPER: 'DEVELOPER',
});

// Ordered from lowest to highest; AI features map them to 1..4.
const SKILL_LEVELS = Object.freeze({
  BEGINNER: 'BEGINNER',
  INTERMEDIATE: 'INTERMEDIATE',
  ADVANCED: 'ADVANCED',
  EXPERT: 'EXPERT',
});

const NAME_MAX_LENGTH = 50;
const EMAIL_MAX_LENGTH = 254;

const PROFILE_LIMITS = Object.freeze({
  jobTitleMaxLength: 100,
  bioMaxLength: 500,
  skillNameMaxLength: 50,
  maxSkills: 50,
  maxYearsOfExperience: 50,
});

const skillSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Skill name is required'],
      trim: true,
      maxlength: PROFILE_LIMITS.skillNameMaxLength,
    },
    level: {
      type: String,
      required: [true, 'Skill level is required'],
      enum: Object.values(SKILL_LEVELS),
    },
    yearsOfExperience: {
      type: Number,
      min: 0,
      max: PROFILE_LIMITS.maxYearsOfExperience,
    },
  },
  { _id: false },
);

function hasUniqueSkillNames(skills) {
  const names = skills.map((skill) => skill.name.trim().toLowerCase());
  return new Set(names).size === names.length;
}

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: NAME_MAX_LENGTH,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: NAME_MAX_LENGTH,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: EMAIL_MAX_LENGTH,
      match: [/^\S+@\S+\.\S+$/, 'Email is invalid'],
    },
    // bcrypt hash; never returned by queries unless explicitly selected with '+password'
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.DEVELOPER,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    jobTitle: {
      type: String,
      trim: true,
      maxlength: PROFILE_LIMITS.jobTitleMaxLength,
      default: '',
    },
    bio: {
      type: String,
      trim: true,
      maxlength: PROFILE_LIMITS.bioMaxLength,
      default: '',
    },
    // Used by AI-02 (developer recommendation) to match task required skills.
    skills: {
      type: [skillSchema],
      default: [],
      validate: [
        {
          validator: (skills) => skills.length <= PROFILE_LIMITS.maxSkills,
          message: `A user can have at most ${PROFILE_LIMITS.maxSkills} skills`,
        },
        { validator: hasUniqueSkillNames, message: 'Skill names must be unique' },
      ],
    },
    // Tokens issued before this date are rejected (see middleware/authenticate.js).
    passwordChangedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

// The password hash and its change date never leave the server.
userSchema.plugin(toJSONPlugin, { hide: ['password', 'passwordChangedAt'] });

// Validation runs before this hook, so `minlength` applies to the plain-text password.
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, config.bcryptSaltRounds);
  if (!this.isNew) {
    this.passwordChangedAt = new Date();
  }
});

/** True when the token (JWT `iat`, in seconds) was issued before the last password change. */
userSchema.methods.isTokenIssuedBeforePasswordChange = function isTokenIssuedBeforePasswordChange(iat) {
  if (!this.passwordChangedAt) return false;
  return iat < Math.floor(this.passwordChangedAt.getTime() / 1000);
};

/** Requires the document to have been loaded with `.select('+password')`. */
userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = { User, ROLES, SKILL_LEVELS, PROFILE_LIMITS };
