const mongoose = require('mongoose');
const errorHandler = require('../src/middleware/errorHandler');
const ApiError = require('../src/utils/ApiError');

function mockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function handle(err) {
  const res = mockResponse();
  errorHandler(err, { method: 'GET', originalUrl: '/test' }, res, jest.fn());
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
}

describe('errorHandler middleware', () => {
  it('uses the status, code and message of an ApiError', () => {
    const { status, body } = handle(ApiError.conflict('Email already used'));

    expect(status).toBe(409);
    expect(body).toEqual({ error: { status: 409, code: 'CONFLICT', message: 'Email already used' } });
  });

  it('maps a Mongoose ValidationError to 400 with field details', () => {
    const err = new mongoose.Error.ValidationError();
    err.addError('name', new mongoose.Error.ValidatorError({ path: 'name', message: 'Name is required' }));

    const { status, body } = handle(err);

    expect(status).toBe(400);
    expect(body.error.code).toBe('BAD_REQUEST');
    expect(body.error.details).toEqual([{ field: 'name', message: 'Name is required' }]);
  });

  it('maps a Mongoose CastError (invalid ObjectId) to 400', () => {
    const err = new mongoose.Error.CastError('ObjectId', 'not-an-id', '_id');

    const { status, body } = handle(err);

    expect(status).toBe(400);
    expect(body.error.message).toBe('Invalid value for field "_id"');
  });

  it('maps a MongoDB duplicate key error to 409', () => {
    const err = Object.assign(new Error('E11000 duplicate key'), { code: 11000, keyValue: { email: 'a@b.c' } });

    const { status, body } = handle(err);

    expect(status).toBe(409);
    expect(body.error.details).toEqual([{ field: 'email', message: 'Already exists' }]);
  });

  it('hides internal details of unexpected errors behind a generic 500', () => {
    const { status, body } = handle(new Error('connection string mongodb://user:pass@host leaked'));

    expect(status).toBe(500);
    expect(body).toEqual({
      error: { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' },
    });
  });
});
