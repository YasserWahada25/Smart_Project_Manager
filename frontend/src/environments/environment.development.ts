// Development build (`ng serve`). `/api` requests are forwarded to http://localhost:3000 by
// proxy.conf.json, so the browser never makes cross-origin calls.
export const environment = {
  production: false,
  apiUrl: '/api/v1',
};
