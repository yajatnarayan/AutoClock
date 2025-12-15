# Production Readiness Notes

**Last updated**: December 14, 2025

This document captures the main considerations for shipping AutoOC as a polished Windows desktop installer.

## Packaging & Distribution

- Build system: Electron Forge (`forge.config.js`)
- Windows installer: Squirrel (produces `AutoOC-Setup.exe` when built on Windows)
- Optional code signing: set `WINDOWS_CERT_FILE` and `WINDOWS_CERT_PASSWORD` at build time
- CI build pipeline: `.github/workflows/windows-installer.yml`

## Privileges / Safety

- Tuning operations require Administrator privileges.
- The backend monitors telemetry and can trigger an emergency rollback on critical temperature.

## Security Posture (MVP)

- WebSocket server binds localhost and is intended for local UI ↔ service communication.
- Packaged desktop builds generate a per-launch WebSocket auth token and inject it into the renderer automatically.
- You can additionally enforce tokens in development runs by setting `AUTOOC_WS_TOKEN`.

## Data Locations

- Profiles: `%APPDATA%\\AutoOC\\profiles` (via `ProductionProfileManager`)
- Logs:
  - source runs: `./logs` (default)
  - packaged app: userData folder (set via `AUTOOC_LOG_DIR`)

## Operational Checks Before Release

- Confirm installer metadata + icon are correct (`forge.config.js`).
- Verify “Optimize” completes and rollback works under forced failure conditions.
- Verify logs are written to a user-writable directory (not Program Files).
- Run CI on Windows and upload installer artifacts.

## Known Follow-Ups (Post-MVP)

- Fan curve application (currently TODO).
- True workload-specific optimization (beyond bundled workloads/fallbacks).
- Rich onboarding/help system inside the desktop app.

