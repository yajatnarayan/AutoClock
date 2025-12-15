# AutoOC — Project Summary (MVP)

**Last updated**: December 14, 2025

AutoOC is an automation-first GPU tuning app that targets measurable performance uplift while prioritizing stability and rollback safety.

## MVP Goal

Provide a safe, guided “Optimize” flow that:
- benchmarks baseline performance
- explores memory/core offsets and power limits
- validates each step under load
- automatically rolls back on instability
- saves the best stable result as a repeatable profile

## Scope

**Supported**
- Windows 10/11
- NVIDIA GPUs

**Out of scope**
- BIOS/firmware flashing
- CPU/RAM overclocking
- OEM laptop lock bypass
- deep manual tuning controls (automation-first MVP)

## Architecture Snapshot

- **Desktop app**: Electron (`src/electron/`, `src/frontend/`)
- **Backend service**: Node.js/TypeScript (`src/backend/service/production-service.ts`)
- **Transport**: local WebSocket
- **Safety**: telemetry monitoring + stability validation + rollback

## Packaging

- `npm run make` on Windows produces `AutoOC-Setup.exe` under `out/make/`
- CI workflow builds the Windows installer on `windows-latest`: `.github/workflows/windows-installer.yml`

## Documentation

- Docs index: `docs/README.md`
- Development notes: `docs/dev/README.md`

