# AutoOC — Intelligent GPU Performance Tuning

AutoOC is a Windows desktop app that safely tunes NVIDIA GPUs for higher performance (or better efficiency) using automated benchmarking, stability validation, and rollback.

## Highlights

- One-click optimization modes: Max Performance, Balanced, Quiet
- Real-time telemetry + persistent logs
- Multi-layer stability validation with automatic rollback
- Profile system (save/apply/revert, import/export)
- Desktop UI (Electron) with a privileged backend service

## Scope (MVP)

**Supported**
- Windows 10/11
- NVIDIA GPUs

**Out of scope**
- BIOS/firmware flashing
- CPU/RAM overclocking
- Advanced voltage curve editing beyond driver-exposed limits

## Documentation

Start here: [docs/README.md](docs/README.md)

Common entry points:
- User guide: [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Stress testing: [docs/STRESS_TESTING.md](docs/STRESS_TESTING.md)
- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)

## Development

```bash
npm install
npm run dev
```

Useful commands:
- Backend (hot reload): `npm run dev:backend`
- Frontend (Electron): `npm run dev:frontend`
- Build backend: `npm run build:backend`
- Run backend only: `npm run start:service`

## Testing

```bash
npm test
npm run test:coverage
```

Coverage HTML report: `coverage/lcov-report/index.html`

## Build a Windows `.exe` Installer

AutoOC uses Electron Forge (Squirrel) to produce a Windows installer.

On **Windows**:
```bash
npm install
npm run make
```

Artifacts are written under `out/make/` (look for `AutoOC-Setup.exe`).

If you’re developing on macOS/Linux, build the Windows installer via GitHub Actions: `.github/workflows/windows-installer.yml`.

## Contributing

See `CONTRIBUTING.md`.

## License

MIT — see `LICENSE`.
