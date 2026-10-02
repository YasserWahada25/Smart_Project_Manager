const { matchedData } = require('express-validator');
const profileService = require('../services/profile.service');

function get(req, res) {
  res.json({ user: req.user });
}

async function update(req, res) {
  const user = await profileService.updateProfile(req.user, matchedData(req));
  res.json({ user });
}

async function changePassword(req, res) {
  const result = await profileService.changePassword(req.user.id, matchedData(req));
  res.json(result);
}

async function replaceSkills(req, res) {
  const { skills } = matchedData(req);
  const user = await profileService.replaceSkills(req.user, skills);
  res.json({ user });
}

module.exports = { get, update, changePassword, replaceSkills };
