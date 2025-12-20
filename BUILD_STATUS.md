# 🏗️ AutoOC Build Status

**Last Updated**: December 15, 2024
**Status**: ✅ Ready to Build

---

## Current Build Configuration

### Executable Type
- **Format**: Windows installer (.exe)
- **Builder**: Electron Forge with Squirrel
- **Size**: ~150-200 MB (includes Electron + Node.js runtime)

### What's Included in the Build
✅ Electron runtime (Chromium + Node.js)
✅ Compiled backend service (JavaScript from TypeScript)
✅ Frontend UI (HTML/CSS/JavaScript)
✅ All npm dependencies (Winston, ws, etc.)
✅ Application assets (icons)

### What's Excluded (for size optimization)
❌ Source TypeScript files
❌ Tests and test fixtures
❌ Documentation markdown files
❌ TypeScript declaration files (.d.ts)
❌ Source maps (.map files)
❌ Git history

---

## Platform Requirements

### ⚠️ Important: Platform Limitations

**Windows installer can ONLY be built on Windows**

The Squirrel maker that creates `AutoOC-Setup.exe` requires:
- Windows 10/11 (64-bit)
- PowerShell
- .NET Framework

**Current development platform**: macOS (darwin)

### Options for Building

Since you're on macOS, you have these options:

#### Option 1: Use GitHub Actions (Recommended)
✅ **Already configured**: `.github/workflows/build-windows-installer.yml`

**How to use**:
```bash
# Tag a release
git tag v0.1.0
git push origin v0.1.0
```

GitHub will:
1. Run tests on Windows runner
2. Build the installer
3. Upload as artifact
4. Create GitHub release with installer attached

#### Option 2: Use a Windows VM
- Install Windows 10/11 in VMware/Parallels/VirtualBox
- Clone repo in VM
- Run `npm run make` in VM

#### Option 3: Use a Windows Cloud Instance
- Spin up Windows instance on AWS/Azure/GCP
- Clone repo
- Build and download installer

#### Option 4: Use a Windows Machine
- Build on actual Windows PC
- Most reliable, fastest option

---

## Build Commands

### On Windows
```bash
# Install dependencies
npm install

# Build installer (includes tests + TypeScript compilation)
npm run make

# Output location
# → out/make/squirrel.windows/x64/AutoOC-Setup.exe
```

### On macOS/Linux (Current Platform)
```bash
# You can still build TypeScript and run tests
npm run build      # Compiles TypeScript
npm test           # Runs all tests

# But this will only create a ZIP, not the Windows installer
npm run package    # Creates unpacked app in out/
```

---

## CI/CD Setup

### GitHub Actions Workflow

**File**: `.github/workflows/build-windows-installer.yml`

**Triggers**:
- On version tags: `v0.1.0`, `v1.2.3`, etc.
- Manual dispatch (Actions tab in GitHub)

**What it does**:
1. ✅ Checks out code
2. ✅ Sets up Node.js 20
3. ✅ Installs dependencies
4. ✅ Runs tests
5. ✅ Builds TypeScript backend
6. ✅ Creates Windows installer
7. ✅ Uploads installer as artifact
8. ✅ Creates GitHub Release (on tags)

**Usage**:
```bash
# Create and push a version tag
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0

# Check GitHub Actions tab for build progress
# Download installer from:
# - Actions artifacts, or
# - Releases page (automatic)
```

---

## Build Configuration Files

### forge.config.js
Electron Forge configuration:
- **Packager settings**: ASAR, icons, metadata
- **Makers**: Squirrel (Windows installer), ZIP (fallback)
- **Ignore patterns**: Excludes tests, docs, source files

### package.json
Build scripts:
- `npm run build` - Compile TypeScript
- `npm run package` - Package app (no installer)
- `npm run make` - Build installer (Windows only)

### tsconfig.backend.json
TypeScript compilation:
- **Input**: `src/backend/**/*.ts`
- **Output**: `dist/backend/**/*.js`
- **Target**: ES2020
- **Module**: CommonJS

---

## Testing the Build

### Before Building
```bash
# Ensure all tests pass
npm test
# Result: 28/28 tests passing ✅

# Ensure TypeScript compiles
npm run build
# Result: 0 errors ✅
```

### After Building (Windows only)
```bash
# Install the built executable
.\out\make\squirrel.windows\x64\AutoOC-Setup.exe

# Test basic functionality
# 1. Launch AutoOC from Start Menu
# 2. Verify GPU detection
# 3. Check telemetry collection
# 4. Test profile creation
```

See [READY_FOR_HARDWARE_TEST.md](READY_FOR_HARDWARE_TEST.md) for comprehensive testing procedures.

---

## Current Development Status

### Code Status: ✅ Ready
- All critical issues fixed
- All 28 tests passing
- TypeScript compiles without errors
- No linter warnings
- Production logger in use everywhere

### Safety Status: ✅ Maximum
- Graceful shutdown handlers (SIGTERM, SIGINT, SIGHUP)
- Temperature checks (blocks if >65°C)
- Emergency rollback on crashes
- Profile import security
- Memory leak protection (RingBuffer)
- Automatic GPU reset on all exit paths

### Documentation Status: ✅ Complete
- [x] User documentation (INSTALLER_README.md)
- [x] Build instructions (BUILD_INSTRUCTIONS.md)
- [x] Testing guide (READY_FOR_HARDWARE_TEST.md)
- [x] Developer quickstart (DEVELOPER_QUICKSTART.md)
- [x] Architecture docs (docs/ARCHITECTURE.md)

---

## Next Steps

### For Development (macOS/Linux)
```bash
# Continue developing and testing
npm run dev           # Development mode
npm test              # Run tests
npm run build         # Compile TypeScript
```

### For Building Installer

**Option A: Use GitHub Actions**
```bash
git add .
git commit -m "feat: ready for release"
git tag v0.1.0
git push origin main --tags
# Check GitHub Actions tab for build
```

**Option B: Use Windows Machine/VM**
1. Clone repo on Windows
2. `npm install`
3. `npm run make`
4. Find installer: `out/make/squirrel.windows/x64/AutoOC-Setup.exe`

---

## Distribution Checklist

When ready to distribute:

- [ ] All tests passing
- [ ] Code reviewed
- [ ] Version bumped in package.json
- [ ] CHANGELOG.md updated
- [ ] Built on Windows (or via GitHub Actions)
- [ ] Installer tested on clean Windows install
- [ ] GPU functionality tested
- [ ] Emergency stop tested
- [ ] (Optional) Code signed
- [ ] (Optional) Scanned with VirusTotal
- [ ] Released on GitHub
- [ ] INSTALLER_README.md included with download

---

## File Outputs

### Successful Build Produces

```
out/
├── autooc-win32-x64/                    # Unpacked app
│   ├── AutoOC.exe                       # Main executable
│   ├── resources/
│   │   └── app.asar                     # Packaged code
│   └── ...
│
└── make/
    └── squirrel.windows/
        └── x64/
            ├── AutoOC-Setup.exe         # 🎯 Distribute this
            ├── AutoOC-0.1.0-full.nupkg  # Update package
            └── RELEASES                 # Update metadata
```

**File to distribute**: `AutoOC-Setup.exe` (~150-200 MB)

---

## Troubleshooting

### "Cannot find module" errors after build
- Ensure `npm run build` was run first
- Check `dist/backend/` exists and has .js files

### Build works but installer crashes
- Check logs: `%APPDATA%\AutoOC\logs\`
- Ensure NVIDIA drivers installed
- Run as Administrator

### Build is too large (>500 MB)
- Check `forge.config.js` ignore patterns
- Ensure dev dependencies not included

---

## Resources

- **Electron Forge Docs**: https://www.electronforge.io/
- **Squirrel.Windows**: https://github.com/Squirrel/Squirrel.Windows
- **Build Instructions**: [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md)
- **Installer Guide**: [INSTALLER_README.md](INSTALLER_README.md)

---

**Status**: ✅ Ready to build on Windows or via GitHub Actions

**Recommendation**: Use GitHub Actions workflow for automated, reproducible builds.
