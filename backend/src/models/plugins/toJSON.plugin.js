/**
 * Common JSON shape for every model: `id` (string) instead of `_id`, no `__v`,
 * virtuals included, and optional fields that must never leave the server.
 *   schema.plugin(toJSONPlugin, { hide: ['password'] })
 */
function toJSONPlugin(schema, { hide = [] } = {}) {
  schema.set('toJSON', {
    virtuals: true,
    transform(doc, ret) {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.__v;
      hide.forEach((field) => {
        delete ret[field];
      });
      return ret;
    },
  });
}

module.exports = toJSONPlugin;
