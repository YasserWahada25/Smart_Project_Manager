# Smart Project Manager — Frontend

Angular application of Smart Project Manager. See the [root README](../README.md) and [docs/architecture.md](../docs/architecture.md) for the overall project.

## Development

```bash
npm install
npm start            # ng serve on http://localhost:4200
```

The backend must run on `http://localhost:3000` (see `../backend`). Requests to `/api` are forwarded to it by `proxy.conf.json`, so the browser only talks to `localhost:4200`.

| Script | Purpose |
|--------|---------|
| `npm start` | Development server with live reload and API proxy |
| `npm run build` | Production build into `dist/smart-project-manager/` |
| `npm test` | Unit tests (Vitest) in watch mode |
| `npm run test:ci` | Unit tests, single run |
| `npm run lint` | ESLint (angular-eslint, incl. template accessibility rules) |
| `npm run format` / `npm run format:check` | Prettier |
