const path = require('path');
const multer = require('multer');
const ApiError = require('../utils/ApiError');

const UPLOAD_LIMITS = Object.freeze({
  maxFileBytes: 5 * 1024 * 1024,
  // Text fields of the same form (the pasted specification can be long).
  maxFieldBytes: 1024 * 1024,
  extensions: Object.freeze(['.txt', '.md', '.pdf', '.docx']),
});

const upload = multer({
  // Kept in memory and forwarded to the AI service: never written to disk.
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_LIMITS.maxFileBytes, files: 1, fields: 10, fieldSize: UPLOAD_LIMITS.maxFieldBytes },
  fileFilter(req, file, callback) {
    if (UPLOAD_LIMITS.extensions.includes(path.extname(file.originalname).toLowerCase())) {
      return callback(null, true);
    }
    return callback(
      new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', `Unsupported file type: use ${UPLOAD_LIMITS.extensions.join(', ')}`),
    );
  },
});

function toApiError(err, fieldName) {
  if (err instanceof ApiError) return err;
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return new ApiError(413, 'PAYLOAD_TOO_LARGE', `The file exceeds ${UPLOAD_LIMITS.maxFileBytes / (1024 * 1024)} MB`);
    }
    if (err.code === 'LIMIT_FIELD_VALUE') return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'A form field is too large');
    return ApiError.badRequest('Validation failed', [{ field: err.field ?? fieldName, message: err.message }]);
  }
  return err;
}

/**
 * Optional single document in the multipart field `fieldName` (req.file), with the other form
 * fields in req.body. JSON requests pass through untouched.
 */
function singleDocument(fieldName) {
  const handler = upload.single(fieldName);
  return (req, res, next) =>
    handler(req, res, (err) => {
      if (err) return next(toApiError(err, fieldName));
      if (req.file) {
        // Busboy reads the file name as latin1: restore the UTF-8 name ("cahier-des-charges-é.pdf").
        req.file.originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      }
      return next();
    });
}

module.exports = { singleDocument, UPLOAD_LIMITS };
