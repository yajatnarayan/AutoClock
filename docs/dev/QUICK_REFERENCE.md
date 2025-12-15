# AutoOC Quick Reference

## Common Commands

```bash
npm install
npm run dev
```

- Backend (hot reload): `npm run dev:backend`
- Frontend (Electron): `npm run dev:frontend`

```bash
npm run lint
npm test
npm run test:coverage
```

Coverage report: `coverage/lcov-report/index.html`

```bash
npm run build:backend
npm run start:service
```

```bash
npm run package
npm run make
```

On Windows, `npm run make` produces `AutoOC-Setup.exe` under `out/make/`.

## Key Files

- Electron main: `src/electron/main.js`
- Electron preload: `src/electron/preload.js`
- Frontend UI: `src/frontend/index.html`, `src/frontend/app.js`, `src/frontend/styles/main.css`
- Backend service: `src/backend/service/production-service.ts`
- Optimizer: `src/backend/optimization/production-optimizer.ts`
- Profiles: `src/backend/profiles/production-profile-manager.ts`

## Environment Variables

- `AUTOOC_WS_TOKEN`: Require a per-command auth token for WebSocket clients.
- `AUTOOC_LOG_DIR`: Override backend log directory.
- `AUTOOC_DOCS_URL`: URL opened by the desktop app “Documentation” menu item.

