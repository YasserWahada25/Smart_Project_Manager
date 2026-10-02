const ApiError = require('../utils/ApiError');

/**
 * Role-based access control. Must be placed after `authenticate`.
 * Usage: router.post('/', authenticate, authorize(ROLES.PROJECT_MANAGER), controller.create)
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden());
    }
    next();
  };
}

module.exports = authorize;
