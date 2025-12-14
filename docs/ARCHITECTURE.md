# AutoOC Architecture

## System Overview

AutoOC is designed as a two-tier architecture with a privileged backend service and an unprivileged frontend application, communicating via WebSocket.

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (UI)                         │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐     │
│  │ Dashboard  │  │  Profile     │  │  Optimization   │     │
│  │  View      │  │  Manager UI  │  │  Controls       │     │
│  └────────────┘  └──────────────┘  └─────────────────┘     │
│                           │                                  │
│                    ┌──────┴──────┐                          │
│                    │   API Client │                          │
│                    │  (WebSocket) │                          │
└────────────────────┴──────────────┴──────────────────────────┘
                             │
                    WebSocket Connection
                             │
┌────────────────────────────┴──────────────────────────────────┐
│                  Backend Service (Privileged)                  │
│  ┌──────────────────────────────────────────────────────┐    │
│  │                  Service Controller                   │    │
│  │         Event Orchestration & State Management       │    │
│  └─────────┬────────────┬────────────┬───────────────┬──┘    │
│            │            │            │               │        │
│  ┌─────────▼────┐ ┌────▼─────┐ ┌───▼────────┐ ┌────▼─────┐ │
│  │   Hardware   │ │Optimizer │ │ Stability  │ │ Profile  │ │
│  │   Detection  │ │  Engine  │ │ Validator  │ │ Manager  │ │
│  │              │ │          │ │            │ │          │ │
│  │ - GPU Info   │ │ - Memory │ │ - Stress   │ │ - Save   │ │
│  │ - Telemetry  │ │ - Core   │ │   Tests    │ │ - Load   │ │
│  │ - Apply OC   │ │ - Power  │ │ - Rollback │ │ - Apply  │ │
│  └──────────────┘ └──────────┘ └────────────┘ └──────────┘ │
│            │                                                  │
│  ┌─────────▼──────────────────────────────────────────┐     │
│  │             NVIDIA API / Driver Interface           │     │
│  │  (nvidia-smi, NVML, WMI for Windows)               │     │
│  └─────────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### Frontend Layer

#### Technology Stack
- **Framework**: Electron (cross-platform desktop)
- **UI**: HTML5, CSS3, Vanilla JavaScript
- **Communication**: WebSocket client
- **State Management**: Event-driven updates

#### Components

**Dashboard View**
- Real-time telemetry visualization
- Live performance metrics
- Status indicators

**Optimization Controls**
- Mode selection (Max Performance, Balanced, Quiet)
- Progress tracking
- One-click optimization trigger

**Profile Manager UI**
- Profile list and selection
- Import/export functionality
- Profile metadata display

**API Client**
- WebSocket connection management
- Command/response handling
- Event streaming
- Auto-reconnect logic

### Backend Layer

#### Technology Stack
- **Runtime**: Node.js (TypeScript)
- **Service**: Windows Service (node-windows)
- **GPU Interface**: nvidia-smi, NVML wrapper
- **Logging**: Winston
- **Storage**: File-based JSON profiles

#### Core Components

**Service Controller**
- Lifecycle management (start, stop, restart)
- Event orchestration between components
- Global state management
- Safety monitoring
- Emergency rollback coordination

**Hardware Detection & Telemetry**
- GPU model and capabilities detection
- Real-time metric collection
  - Clock speeds (core, memory)
  - Temperature (GPU, hotspot)
  - Power draw
  - Utilization (GPU, VRAM)
  - Fan speed
  - Throttle reasons
- Persistent logging
- Telemetry streaming to frontend

**Optimization Engine**
- Stepwise coordinate optimization algorithm
- Memory clock tuning (0-1500 MHz increments)
- Core clock tuning (0-300 MHz increments)
- Power limit optimization
- Fan curve generation
- Benchmark execution and scoring
- Configuration validation

**Stability Validator**
- Multi-layer testing framework
  - Layer 1: Synthetic stress test (30s)
  - Layer 2: Real-world rendering (20s)
  - Layer 3: Telemetry analysis
  - Layer 4: Driver stability check
- Failure detection
  - Driver resets
  - Thermal throttling
  - Power throttling
  - Performance regression
  - Clock instability
- Automatic rollback on failure
- Known-good configuration preservation

**Profile Manager**
- Profile CRUD operations
- JSON-based storage
- Default profile enforcement
- Profile validation
- Import/export functionality
- Active profile tracking

## Data Flow

### Optimization Workflow

```
User Clicks "Optimize" → Frontend sends command
                              ↓
            Service Controller receives command
                              ↓
            Optimizer Engine initializes
                              ↓
┌──────────────────────────────────────────────────┐
│         Step 1: Baseline Benchmark               │
│  - Reset to stock clocks                         │
│  - Run 30s benchmark                             │
│  - Record baseline performance                   │
└────────────────┬─────────────────────────────────┘
                 ↓
┌────────────────▼─────────────────────────────────┐
│         Step 2: Memory Tuning                    │
│  - Increment memory clock by 50 MHz             │
│  - Quick stability test (10s)                    │
│  - If stable: full benchmark                     │
│  - If unstable: revert and stop                  │
│  - Repeat until max offset or instability        │
└────────────────┬─────────────────────────────────┘
                 ↓
┌────────────────▼─────────────────────────────────┐
│         Step 3: Core Tuning                      │
│  - Keep best memory offset                       │
│  - Increment core clock by 25 MHz               │
│  - Quick stability test                          │
│  - Full benchmark if stable                      │
│  - Repeat until max offset or instability        │
└────────────────┬─────────────────────────────────┘
                 ↓
┌────────────────▼─────────────────────────────────┐
│         Step 4: Power Tuning                     │
│  - Test power limits: 90%, 95%, 100%, 105%, 110%│
│  - Evaluate performance per watt                 │
│  - Select optimal for mode                       │
└────────────────┬─────────────────────────────────┘
                 ↓
┌────────────────▼─────────────────────────────────┐
│         Step 5: Fan Curve                        │
│  - Generate mode-specific fan curve              │
│  - Apply thermal constraints                     │
└────────────────┬─────────────────────────────────┘
                 ↓
┌────────────────▼─────────────────────────────────┐
│         Step 6: Final Validation                 │
│  - Full stability test suite                     │
│  - 60s stress test                               │
│  - Driver stability verification                 │
│  - If fails: rollback to best known config       │
└────────────────┬─────────────────────────────────┘
                 ↓
         Save profile and apply
                 ↓
       Notify frontend completion
```

### Telemetry Collection Flow

```
Telemetry Collector (1s interval)
          ↓
  Call nvidia-smi for metrics
          ↓
  Parse and normalize data
          ↓
  Add to history buffer (max 3600 samples)
          ↓
  ┌──────┴──────┐
  ↓             ↓
Emit event   Check for issues
  ↓             ↓
Frontend    Safety Monitor
  ↓             ↓
Display     Trigger rollback if needed
```

## Safety Architecture

### Multi-Layer Safety System

**Layer 1: Preventive**
- Conservative defaults
- Incremental tuning steps
- Hardware capability detection
- Thermal/power limit respect

**Layer 2: Active Monitoring**
- Real-time telemetry analysis
- Throttle detection
- Temperature monitoring
- Driver stability tracking

**Layer 3: Reactive**
- Quick stability tests between changes
- Immediate rollback on failure
- Known-good configuration preservation
- Emergency shutdown on critical temperature

**Layer 4: Fail-Safe**
- Default profile always available
- Service crash recovery
- Configuration backup
- Persistent logging for diagnosis

### Rollback Decision Tree

```
Configuration Applied
        ↓
   Quick Test (10s)
        ↓
    ┌───┴───┐
    PASS    FAIL → Immediate Rollback
    ↓
Full Benchmark (30s)
    ↓
    ┌───┴───┐
    PASS    FAIL → Rollback to last stable
    ↓
Telemetry Analysis
    ↓
    ┌───┴───┐
    PASS    FAIL → Rollback + Flag issue
    ↓
Driver Check
    ↓
    ┌───┴───┐
    PASS    FAIL → Rollback + Critical error
    ↓
Configuration Accepted
    ↓
Update best known config
```

## Performance Considerations

### Optimization Targets
- **Telemetry Latency**: <100ms from GPU to frontend
- **Optimization Time**: 5-10 minutes for full auto-tune
- **UI Responsiveness**: 60 FPS dashboard updates
- **Memory Footprint**: <200 MB total (backend + frontend)
- **CPU Overhead**: <2% during normal operation

### Scalability
- Telemetry history: Ring buffer (max 1 hour at 1s intervals)
- Profile storage: File-based, lazy loading
- Event streaming: Throttled to prevent UI overload
- Log rotation: Daily files, 7-day retention

## Security Model

### Privilege Separation
- **Backend**: Runs as admin/system service
- **Frontend**: Runs as user
- **Communication**: Local WebSocket only (127.0.0.1)

### Attack Surface Minimization
- No network exposure (localhost only)
- Input validation on all commands
- Signed configuration files (future)
- Audit logging of all changes

### Data Privacy
- All data stored locally
- No telemetry sent to cloud (MVP)
- No user tracking
- No analytics collection

## Extensibility

### Plugin Architecture (Future)
```
┌──────────────────────────────────┐
│     Plugin Interface Layer        │
├──────────────────────────────────┤
│  - GPU Vendor Plugins (AMD, Intel)│
│  - Benchmark Plugins              │
│  - Notification Plugins           │
│  - Cloud Sync Plugins             │
└──────────────────────────────────┘
```

### API Design Principles
- Event-driven architecture
- Loose coupling between components
- Dependency injection for testability
- Interface-based abstractions

## Deployment Architecture

### File Structure
```
C:/Program Files/AutoOC/
├── service/
│   ├── autooc-service.exe
│   ├── node.exe
│   └── backend/
│       └── [compiled JS]
├── frontend/
│   ├── AutoOC.exe
│   └── resources/
│       └── app/
└── data/
    ├── profiles/
    │   └── *.json
    ├── logs/
    │   └── *.log
    └── config/
        └── service-config.json
```

### Service Installation
1. Copy binaries to Program Files
2. Install Windows service (node-windows)
3. Configure service to auto-start
4. Create desktop shortcut for frontend
5. Add to Windows Firewall exceptions (localhost only)

## Error Handling

### Error Categories
1. **Recoverable**: Log, retry, notify user
2. **Critical**: Rollback, log, notify user, stop operation
3. **Fatal**: Service shutdown, emergency rollback to default

### Error Propagation
```
Component Error
     ↓
Log to file
     ↓
Emit error event
     ↓
Service Controller
     ↓
┌────┴────┐
↓         ↓
Rollback  Notify Frontend
          ↓
      User sees error message
```

## Testing Strategy

### Unit Tests
- Component isolation
- Mocked hardware interfaces
- Configuration validation
- Algorithm correctness

### Integration Tests
- Service startup/shutdown
- Frontend-backend communication
- Profile save/load
- Telemetry collection

### System Tests
- Full optimization workflow
- Stability validation
- Rollback scenarios
- Multi-GPU scenarios

### Hardware-in-the-Loop Tests
- Actual GPU testing
- Stress testing
- Long-duration stability
- Edge case hardware

---

**Last Updated**: December 2024
