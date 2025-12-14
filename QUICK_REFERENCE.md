# AutoOC Quick Reference Guide

## Quick Commands

### Development
```bash
# Install dependencies
npm install

# Development mode (both backend and frontend)
npm run dev

# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend

# Build project
npm run build

# Run tests
npm test
npm run test:unit
npm run test:integration
npm run test:coverage

# Lint code
npm run lint
```

### Service Management
```bash
# Install Windows service (requires admin)
npm run install-service

# Uninstall service
npm run uninstall-service

# Start frontend application
npm start
```

### Package Management
```bash
# Create distributable packages
npm run make

# Package without creating installers
npm run package
```

---

## Project File Structure Quick Map

```
AutoOC/
├── 📄 Core Files
│   ├── README.md              # Project overview
│   ├── PROJECT_SUMMARY.md     # Implementation summary
│   ├── LICENSE                # MIT License
│   ├── package.json           # Dependencies & scripts
│   └── tsconfig.json          # TypeScript config
│
├── 📁 src/backend/            # Backend service (Node.js/TypeScript)
│   ├── hardware/              # GPU detection & telemetry
│   │   ├── nvidia-api.ts      # NVIDIA driver interface
│   │   └── telemetry-collector.ts
│   ├── optimization/          # Auto-tuning engine
│   │   ├── optimizer.ts       # Main optimization logic
│   │   └── benchmark.ts       # Performance testing
│   ├── stability/             # Safety validation
│   │   └── validator.ts       # Multi-layer testing
│   ├── profiles/              # Profile management
│   │   └── profile-manager.ts
│   ├── service/               # Main service
│   │   └── index.ts           # Entry point
│   ├── types/                 # TypeScript definitions
│   │   └── index.ts
│   └── utils/                 # Utilities
│       └── logger.ts
│
├── 📁 src/frontend/           # Desktop UI (Electron)
│   ├── index.html             # Main UI
│   ├── styles/
│   │   └── main.css           # Styling
│   └── api/
│       └── service-client.ts  # Backend communication
│
├── 📁 docs/                   # Documentation
│   ├── ARCHITECTURE.md        # System architecture
│   ├── ROADMAP.md             # Product roadmap
│   ├── FUTURE_VISION.md       # Long-term vision
│   └── GETTING_STARTED.md     # User guide
│
├── 📁 scripts/                # Build & deployment
│   ├── install-service.js
│   └── uninstall-service.js
│
└── 📁 tests/                  # Tests (Future)
    ├── unit/
    └── integration/
```

---

## Key Components at a Glance

### Backend Service Components

| Component | File | Purpose |
|-----------|------|---------|
| **Service Controller** | `service/index.ts` | Main orchestrator, event management |
| **NVIDIA API** | `hardware/nvidia-api.ts` | GPU detection & control interface |
| **Telemetry Collector** | `hardware/telemetry-collector.ts` | Real-time metrics collection |
| **Optimizer** | `optimization/optimizer.ts` | Auto-tuning algorithm |
| **Benchmark** | `optimization/benchmark.ts` | Performance testing |
| **Validator** | `stability/validator.ts` | Stability validation |
| **Profile Manager** | `profiles/profile-manager.ts` | Profile CRUD operations |
| **Logger** | `utils/logger.ts` | Logging system |
| **Types** | `types/index.ts` | TypeScript type definitions |

### Frontend Components

| Component | File | Purpose |
|-----------|------|---------|
| **Main UI** | `index.html` | User interface markup |
| **Styles** | `styles/main.css` | UI styling |
| **Service Client** | `api/service-client.ts` | WebSocket communication |

---

## Common Tasks

### Add a New Type
1. Edit `src/backend/types/index.ts`
2. Export the new interface/type
3. Use in other components

### Modify Optimization Algorithm
1. Edit `src/backend/optimization/optimizer.ts`
2. Update `tuneMemory()`, `tuneCore()`, etc.
3. Test with mock GPU data

### Add Telemetry Metric
1. Edit `src/backend/types/index.ts` → `GPUTelemetry`
2. Update `src/backend/hardware/nvidia-api.ts` → `getTelemetry()`
3. Update frontend display

### Create New Profile Field
1. Edit `src/backend/types/index.ts` → `Profile`
2. Update `src/backend/profiles/profile-manager.ts`
3. Update UI to display new field

### Add Safety Check
1. Edit `src/backend/stability/validator.ts`
2. Add new validation method
3. Call from `validate()` method

---

## Important Constants & Limits

### Optimization Limits
```typescript
// Memory Clock
MAX_MEMORY_OFFSET = 1500  // MHz

// Core Clock
MAX_CORE_OFFSET = 300     // MHz

// Power Limit
MIN_POWER_LIMIT = 80      // %
MAX_POWER_LIMIT = 110     // %

// Temperature
MAX_TEMP_WARNING = 85     // °C
MAX_TEMP_CRITICAL = 95    // °C
```

### Timing
```typescript
// Telemetry
DEFAULT_TELEMETRY_INTERVAL = 1000    // ms

// Benchmarks
QUICK_TEST_DURATION = 10             // seconds
FULL_BENCHMARK_DURATION = 30         // seconds
STRESS_TEST_DURATION = 30            // seconds

// History
MAX_TELEMETRY_HISTORY = 3600         // samples (1 hour at 1s)
```

### Tuning Steps
```typescript
MEMORY_STEP = 50   // MHz
CORE_STEP = 25     // MHz
POWER_STEP = 5     // %
```

---

## Type Reference Quick Lookup

### Main Interfaces

**GPUInfo** - GPU hardware information
```typescript
{
  id: string
  name: string
  vendor: 'NVIDIA' | 'AMD' | 'Intel'
  driverVersion: string
  vramSize: number
  powerLimit: { default, min, max, current }
}
```

**GPUTelemetry** - Real-time metrics
```typescript
{
  timestamp: number
  coreClock: number
  memoryClock: number
  powerDraw: number
  temperature: number
  fanSpeed: number
  utilization: { gpu, memory }
  throttleReasons: ThrottleReason[]
}
```

**Profile** - Saved configuration
```typescript
{
  id: string
  name: string
  configuration: TuningConfiguration
  mode: OptimizationMode
  isDefault: boolean
  isActive: boolean
}
```

**TuningConfiguration** - GPU settings
```typescript
{
  id: string
  name: string
  clockOffset: { core, memory }
  powerLimit: number
  fanCurve?: FanCurvePoint[]
}
```

---

## Event System

### Backend Events

**Service Events**
- `started` - Service started
- `stopped` - Service stopped
- `telemetry` - New telemetry data
- `thermal-warning` - High temperature
- `power-warning` - Power throttling
- `emergency-rollback` - Emergency rollback triggered

**Optimizer Events**
- `progress` - Optimization progress update
- `optimization-complete` - Optimization finished
- `optimization-failed` - Optimization failed

**Telemetry Events**
- `telemetry` - Telemetry sample
- `thermal-throttle` - Thermal throttling detected
- `power-throttle` - Power throttling detected
- `high-temperature` - Temperature warning

### Frontend Events

**WebSocket Messages**
- `telemetry` - Real-time telemetry
- `optimization-progress` - Progress update
- `optimization-complete` - Optimization done
- `thermal-warning` - Temperature warning
- `emergency-rollback` - Safety rollback

---

## Debugging Tips

### View Logs
```bash
# Logs location
./logs/autooc-YYYY-MM-DD.log

# Tail logs (PowerShell)
Get-Content ./logs/autooc-*.log -Wait -Tail 50

# Tail logs (CMD)
type logs\autooc-*.log
```

### Check Service Status
```powershell
# Open Services
services.msc

# Find "AutoOC" service
# Check status, start/stop

# Or via PowerShell
Get-Service -Name "AutoOC"
Start-Service -Name "AutoOC"
Stop-Service -Name "AutoOC"
```

### Test GPU Interface
```bash
# Test nvidia-smi
nvidia-smi

# Query specific info
nvidia-smi --query-gpu=gpu_name,driver_version --format=csv
```

### WebSocket Connection
```javascript
// Test connection in browser console
const ws = new WebSocket('ws://localhost:8080');
ws.onopen = () => console.log('Connected');
ws.onerror = (e) => console.error('Error:', e);
```

---

## Safety Checklist

Before deploying or testing:

- [ ] Default profile always preserved
- [ ] Rollback mechanism tested
- [ ] Temperature monitoring active
- [ ] Thermal limits enforced
- [ ] Power limits enforced
- [ ] Driver stability checks working
- [ ] Emergency shutdown triggers work
- [ ] All validation layers active
- [ ] Logging enabled
- [ ] Error handling comprehensive

---

## Performance Optimization

### Backend
- Use incremental tuning (small steps)
- Cache telemetry results
- Throttle event emissions
- Use ring buffer for history
- Async/await for GPU operations

### Frontend
- Update UI at max 60 FPS
- Debounce rapid events
- Use CSS transforms for animations
- Minimize DOM manipulations
- Virtual scrolling for long lists

---

## Common Issues & Solutions

**Issue**: Service won't start
- **Check**: Administrator privileges
- **Check**: Port 8080 availability
- **Check**: Node.js installation
- **Solution**: Run install script as admin

**Issue**: GPU not detected
- **Check**: NVIDIA drivers installed
- **Check**: nvidia-smi works
- **Solution**: Update drivers, restart

**Issue**: Optimization fails
- **Check**: GPU in use by other apps
- **Check**: Thermal state (too hot)
- **Solution**: Close apps, improve cooling

**Issue**: Frontend won't connect
- **Check**: Service running
- **Check**: Firewall settings
- **Solution**: Restart service, check firewall

---

## Version History

- **v0.1.0** (Current) - MVP Implementation
  - Core optimization engine
  - Safety validation
  - Profile management
  - Basic UI

---

## Useful Resources

### Documentation
- [README.md](README.md) - Overview
- [GETTING_STARTED.md](docs/GETTING_STARTED.md) - User guide
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Technical details
- [ROADMAP.md](docs/ROADMAP.md) - Future plans

### External Links
- NVIDIA Developer: https://developer.nvidia.com/
- Electron Docs: https://www.electronjs.org/
- TypeScript Handbook: https://www.typescriptlang.org/

---

**Quick Reference Last Updated**: December 14, 2024
