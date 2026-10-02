/** Escapes user input so it is matched literally inside a RegExp (no regex injection / ReDoS). */
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive "contains" matcher for MongoDB queries. */
function containsInsensitive(text) {
  return new RegExp(escapeRegex(text), 'i');
}

/** Case-insensitive exact matcher for MongoDB queries. */
function equalsInsensitive(text) {
  return new RegExp(`^${escapeRegex(text)}$`, 'i');
}

module.exports = { escapeRegex, containsInsensitive, equalsInsensitive };
