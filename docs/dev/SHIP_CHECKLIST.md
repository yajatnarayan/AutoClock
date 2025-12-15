# AutoOC Release Checklist (MVP)

**Last updated**: December 14, 2025

This checklist focuses on shipping a clean Windows installer and verifying core safety behavior.

## Build & CI

- [ ] `npm run lint` is clean
- [ ] `npm test` is green
- [ ] `npm run test:coverage` reviewed
- [ ] Windows CI build is green (`.github/workflows/windows-installer.yml`)

## Installer / Packaging

- [ ] `npm run make` on Windows produces `AutoOC-Setup.exe` under `out/make/`
- [ ] App icon + metadata are correct (`forge.config.js`)
- [ ] Installer runs cleanly on a fresh Windows VM
- [ ] App launches and loads UI without requiring a separate backend process

## Safety & Stability

- [ ] Baseline profile is preserved and recoverable
- [ ] Optimization rollback works on induced instability
- [ ] Critical temperature triggers emergency rollback (telemetry-driven)
- [ ] Logs are written to a user-writable directory

## Docs

- [ ] `README.md` matches current behavior and scripts
- [ ] User guide is up to date (`docs/GETTING_STARTED.md`)
- [ ] Docs index is current (`docs/README.md`, `docs/dev/README.md`)

