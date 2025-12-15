# Developer Quick Start Guide

**AutoOC MVP - Production Ready**

Get up and running with AutoOC development in 5 minutes.

---

## Prerequisites

- **Windows 10/11** (64-bit)
- **Node.js 20 LTS** (recommended) and npm 9+
- **NVIDIA GPU** (GTX 10+ or RTX series) with drivers 527+
- **Administrator privileges**
- **Git**

---

## Quick Setup

### 1. Clone & Install (2 minutes)

```bash
cd AutoOC
# If you use nvm:
# nvm use
npm install
```

### 2. Build (1 minute)

```bash
npm run build
```

### 3. Run Tests (1 minute)

```bash
npm test
```

### 4. Start Development (1 minute)

**Terminal 1 - Backend Service**:
```bash
npm run dev:backend
```

**Terminal 2 - Frontend (optional)**:
```bash
npm run dev:frontend
```

---

## Project Structure

```
AutoOC/
├── src/backend/              # Production backend
│   ├── service/
│   │   └── production-service.ts  ← Main service entry
│   ├── hardware/
│   │   ├── nvidia-interface.ts    ← Real GPU control
│   │   ├── telemetry-service.ts   ← Live metrics
│   │   └── windows-event-monitor.ts
│   ├── optimization/
│   │   └── production-optimizer.ts ← Auto-tuning
│   ├── benchmarking/
│   │   ├── workload-runner.ts     ← GPU workloads
│   │   └── benchmark-engine.ts
│   ├── stability/
│   │   └── stability-engine.ts    ← 5-layer validation
│   └── profiles/
│       └── production-profile-manager.ts
│
├── src/frontend/             # Frontend UI
│   ├── index.html
│   ├── app.js                ← WebSocket client
│   └── styles/main.css
│
└── tests/
    ├── unit/                 # Unit tests
    ├── integration/          # Integration tests
    └── mocks/                # Test harnesses
```

---

## Development Workflow

### Running the Backend

```bash
# Development mode (auto-reload)
npm run dev:backend

# Production mode
npm run build
npm run start:service
```

**Optional security**: Set `AUTOOC_WS_TOKEN` to require an auth token on every WebSocket command.

**Output**:
```
✅ AutoOC Service is running
📡 WebSocket server: ws://localhost:8080
🎮 GPU: NVIDIA GeForce RTX 3080
```

### Building the Windows Installer (.exe)

AutoOC packages as an Electron app via Electron Forge.

On **Windows**:
```bash
npm run make
```

Artifacts are written under `out/make/` (look for `AutoOC-Setup.exe`).

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests (requires GPU)
npm run test:integration

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Making Changes

1. **Backend**: Edit files in `src/backend/`
2. **Frontend**: Edit `src/frontend/app.js` or `index.html`
3. **Tests**: Add tests to `tests/unit/` or `tests/integration/`
4. **Run tests**: `npm test`
5. **Rebuild**: `npm run build`

---

## Key Files to Know

### Backend Entry Points

**Main Service** (`src/backend/service/production-service.ts`):
- Initializes all components
- WebSocket server
- Command handlers
- Event forwarding

**Types** (`src/backend/types/index.ts`):
- All TypeScript interfaces
- Reference for API contracts

### Frontend

**App Logic** (`src/frontend/app.js`):
- WebSocket client
- UI updates
- Command sending
- Event handling

**UI** (`src/frontend/index.html`):
- HTML structure
- All DOM IDs referenced in app.js

### Testing

**Mock GPU** (`tests/mocks/mock-gpu-interface.ts`):
- Simulates GPU for testing
- Controllable behavior
- No real hardware needed

---

## Common Tasks

### Add a New WebSocket Command

**1. Backend** - Add handler in `production-service.ts`:
```typescript
case 'my-new-command':
  const result = await this.handleMyCommand(message.data);
  respond(result);
  break;
```

**2. Frontend** - Use in `app.js`:
```javascript
const result = await this.sendCommand('my-new-command', { param: value });
```

### Add New Telemetry Field

**1. Types** - Update in `types/index.ts`:
```typescript
export interface GPUTelemetry {
  // ... existing fields
  newField?: number;
}
```

**2. Backend** - Collect in `nvidia-interface.ts`:
```typescript
const telemetry: GPUTelemetry = {
  // ... existing fields
  newField: await this.getNewField(),
};
```

**3. Frontend** - Display in `app.js`:
```javascript
updateTelemetry(telemetry) {
  // ... existing updates
  document.getElementById('new-field').textContent = telemetry.newField;
}
```

### Add Unit Test

Create `tests/unit/my-feature.test.ts`:
```typescript
import { MyFeature } from '../../src/backend/my-feature';

describe('MyFeature', () => {
  it('should do something', () => {
    const feature = new MyFeature();
    expect(feature.doSomething()).toBe(true);
  });
});
```

Run: `npm run test:unit`

---

## Debugging

### Enable Debug Logging

**Backend**:
```typescript
// In production-logger.ts
logger.setLevel('debug');
```

**Frontend**:
```javascript
// In app.js constructor
console.log('Debug mode enabled');
```

### Check Logs

```bash
# Backend logs
cat logs/autooc.log
cat logs/autooc-error.log

# Watch logs
tail -f logs/autooc.log
```

### Common Issues

**Service won't start**:
```bash
# Check nvidia-smi
nvidia-smi

# Check port
netstat -an | findstr 8080

# Run as admin
```

**Tests failing**:
```bash
# Skip GPU tests (no hardware)
SKIP_GPU_TESTS=true npm test

# Run specific test
npm test -- profile-manager.test.ts
```

**Frontend won't connect**:
```bash
# Ensure backend is running
npm run dev:backend

# Check WebSocket URL in app.js
# Should be: ws://localhost:8080
```

---

## Architecture Overview

### Data Flow

```
User clicks "Optimize" button
    ↓
Frontend sends WebSocket command
    ↓
Production Service receives command
    ↓
Optimizer runs with GPU Interface
    ↓
Progress events → WebSocket → Frontend
    ↓
Results saved to Profile Manager
    ↓
Profile applied to GPU
    ↓
Telemetry updates show changes
```

### Safety Flow

```
Apply GPU settings
    ↓
Quick stability check (10s)
    ↓
Full benchmark (30s)
    ↓
5-layer validation
    ↓
If ANY fail → Automatic rollback
    ↓
If ALL pass → Save configuration
```

---

## Performance Tips

### Fast Iteration

```bash
# Backend only (faster)
npm run dev:backend

# Skip slow tests
npm run test:unit

# Build specific component
tsc src/backend/specific-file.ts
```

### Profiling

```typescript
// Add timing
const start = Date.now();
await doWork();
console.log(`Took ${Date.now() - start}ms`);
```

---

## Code Style

### TypeScript

- Use strict mode (already configured)
- Prefer interfaces over types
- Always handle errors with try/catch
- Document public methods with JSDoc

**Example**:
```typescript
/**
 * Apply clock offset to GPU
 * @param offset - Clock offset configuration
 * @throws Error if GPU not responsive
 */
async applyClockOffset(offset: ClockOffset): Promise<void> {
  try {
    await this.gpu.setClocks(offset);
  } catch (error) {
    logger.error('Failed to apply offset', error);
    throw error;
  }
}
```

### Logging

```typescript
logger.debug('Component', 'Detailed info');
logger.info('Component', 'General info');
logger.warn('Component', 'Warning');
logger.error('Component', 'Error', error);
```

---

## Testing Best Practices

### Unit Tests
- Test one thing at a time
- Use mocks for external dependencies
- Fast execution (<1s per test)

### Integration Tests
- Test component interactions
- Use real classes (not mocks)
- Can take longer (mark with `@slow`)

### Manual Tests
- Always test on real GPU before release
- Verify safety mechanisms work
- Check UI responsiveness

---

## Documentation

- **Docs index**: See [docs/README.md](docs/README.md)
- **Architecture**: See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Roadmap**: See [docs/ROADMAP.md](docs/ROADMAP.md)
- **User Guide**: See [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)
- **Contributing**: See [CONTRIBUTING.md](CONTRIBUTING.md)
- **Ship Status**: See [docs/dev/SHIP_CHECKLIST.md](docs/dev/SHIP_CHECKLIST.md)
- **Stress Testing**: See [docs/STRESS_TESTING.md](docs/STRESS_TESTING.md)

---

## Getting Help

1. **Check docs** in `docs/` folder
2. **Run tests** to see examples
3. **Read code** - well commented
4. **Check logs** in `logs/` folder

---

## Quick Reference Commands

```bash
# Install
npm install

# Build
npm run build

# Test
npm test
npm run test:unit
npm run test:integration
npm run test:coverage

# Run
npm run dev:backend
npm run dev:frontend
npm start

# Lint
npm run lint
npm run lint:fix

# Clean
npm run clean
```

---

**Ready to code!** 🚀

Make changes → Run tests → Commit

Questions? Check the docs or read the code.
