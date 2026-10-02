const authorize = require('../src/middleware/authorize');
const ApiError = require('../src/utils/ApiError');

function run(middleware, req) {
  const next = jest.fn();
  middleware(req, {}, next);
  return next.mock.calls[0][0];
}

describe('authorize middleware', () => {
  it('lets a user with an allowed role through', () => {
    const result = run(authorize('ADMIN', 'PROJECT_MANAGER'), { user: { role: 'PROJECT_MANAGER' } });

    expect(result).toBeUndefined();
  });

  it('rejects a user whose role is not allowed with 403', () => {
    const result = run(authorize('ADMIN'), { user: { role: 'DEVELOPER' } });

    expect(result).toBeInstanceOf(ApiError);
    expect(result).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  it('rejects an unauthenticated request with 401', () => {
    const result = run(authorize('ADMIN'), {});

    expect(result).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });
});
