// Minimal console logger, silenced during automated tests to keep test output readable.
const silent = process.env.NODE_ENV === 'test';

function write(method, level, args) {
  if (silent) return;
  console[method](`[${new Date().toISOString()}] ${level}`, ...args);
}

module.exports = {
  info: (...args) => write('log', 'INFO ', args),
  warn: (...args) => write('warn', 'WARN ', args),
  error: (...args) => write('error', 'ERROR', args),
};
