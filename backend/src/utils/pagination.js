// Shared by every paginated list endpoint: GET /resource?page=1&limit=20
const PAGINATION = Object.freeze({ defaultPage: 1, defaultLimit: 20, maxLimit: 100 });

function buildPagination(page, limit, total) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

module.exports = { PAGINATION, buildPagination };
