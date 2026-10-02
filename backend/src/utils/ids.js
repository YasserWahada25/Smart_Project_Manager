/** Compares two ids that may be ObjectIds, strings or (populated) documents. */
function sameId(a, b) {
  if (!a || !b) return false;
  return String(a._id ?? a) === String(b._id ?? b);
}

module.exports = { sameId };
