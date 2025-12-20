# 🏗️ Building AutoOC Executable

Complete guide to building AutoOC as a standalone Windows executable (.exe installer).

---

## 📋 Prerequisites

### For Building on Windows

- **Windows 10/11** (64-bit)
- **Node.js 20 LTS** and npm 9+
- **Git**
- **Administrator privileges** (for testing)
- **NVIDIA GPU** with drivers 527+ (for testing)
- **~2 GB free disk space** (for node_modules and build output)

### For Building on macOS/Linux (Cross-Platform)

⚠️ **Important**: Electron Forge can only build Windows installers (.exe) when running on Windows. Building on macOS/Linux will produce ZIP archives but not the Squirrel installer.

If you're on macOS/Linux, you have these options:
1. Use a Windows VM (recommended)
2. Use GitHub Actions / CI pipeline on Windows runner
3. Use a Windows cloud instance

---

## 🚀 Quick Build (Windows Only)

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Executable

```bash
npm run make
```

This will:
1. ✅ Compile TypeScript backend (`npm run build:backend`)
2. ✅ Package Electron app with all dependencies
3. ✅ Create Windows installer with Squirrel
4. ✅ Output to `out/make/squirrel.windows/x64/`

### 3. Find Your Installer

The installer will be located at:

```
out/make/squirrel.windows/x64/AutoOC-Setup.exe
```

**File Size**: Approximately 150-200 MB (includes Electron runtime and Node.js)

---

## 📦 What Gets Packaged

The built executable includes:

✅ **Electron Runtime** - Chromium + Node.js
✅ **Backend Service** - GPU control and optimization engine (compiled JavaScript)
✅ **Frontend UI** - HTML/CSS/JavaScript interface
✅ **Dependencies** - All npm packages (Winston, ws, etc.)
✅ **Assets** - Icons and resources

**Excluded from package** (to reduce size):
- Source TypeScript files (`src/backend/`)
- Tests (`tests/`)
- Documentation (`docs/`)
- Coverage reports
- Git history
- TypeScript declaration files (`.d.ts`)
- Source maps (`.map`)

See `forge.config.js` for full exclusion list.

---

## 🔧 Build Configuration

### forge.config.js

The build is configured via `forge.config.js`:

```javascript
module.exports = {
  packagerConfig: {
    asar: true,                    // Package app as ASAR archive
    icon: './assets/icon',         // App icon (multi-format)
    executableName: 'AutoOC',      // Name of the .exe
    win32metadata: {
      CompanyName: 'AutoOC',
      FileDescription: 'AutoOC – Intelligent GPU Performance Tuning',
      ProductName: 'AutoOC',
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'autooc',
        setupExe: 'AutoOC-Setup.exe',
        setupIcon: './assets/icon.ico',
      },
    },
    {
      name: '@electron-forge/maker-zip',  // Fallback: ZIP archive
    },
  ],
};
```

### Package.json Scripts

```json
{
  "scripts": {
    "build": "npm run build:backend",
    "build:backend": "tsc -p tsconfig.backend.json",
    "package": "npm run build:backend && electron-forge package",
    "make": "npm run build:backend && electron-forge make"
  }
}
```

---

## 🎯 Build Process Details

### What `npm run make` Does

```
Step 1: Compile TypeScript
  ├─ Input:  src/backend/**/*.ts
  └─ Output: dist/backend/**/*.js

Step 2: Package Application
  ├─ Copy frontend files (src/frontend/)
  ├─ Copy Electron main process (src/electron/)
  ├─ Copy compiled backend (dist/backend/)
  ├─ Copy dependencies (node_modules/)
  ├─ Copy assets (assets/)
  └─ Create ASAR archive

Step 3: Create Installer (Squirrel)
  ├─ Generate AutoOC.exe (application)
  ├─ Generate Update.exe (updater)
  ├─ Create RELEASES file
  ├─ Package into AutoOC-Setup.exe (installer)
  └─ Output to out/make/squirrel.windows/x64/
```

### Output Structure

```
out/
├── autooc-win32-x64/              # Packaged app (unpacked)
│   ├── AutoOC.exe                 # Main executable
│   ├── resources/
│   │   └── app.asar               # Packaged application code
│   ├── locales/
│   └── ...
│
└── make/
    └── squirrel.windows/
        └── x64/
            ├── AutoOC-Setup.exe   # 🎯 INSTALLER (distribute this)
            ├── AutoOC-0.1.0-full.nupkg
            └── RELEASES
```

---

## 🧪 Testing the Built Executable

### 1. Test Installation

```powershell
# Right-click "Run as Administrator"
.\out\make\squirrel.windows\x64\AutoOC-Setup.exe
```

**What happens**:
1. Installer extracts to `%LOCALAPPDATA%\AutoOC\`
2. Creates Start Menu shortcut
3. Registers uninstaller
4. Launches AutoOC

### 2. Test the Application

**Expected behavior**:
- ✅ Window opens showing AutoOC interface
- ✅ GPU detected automatically
- ✅ Telemetry starts collecting (1s interval)
- ✅ Default profile created
- ✅ Logs written to `%APPDATA%\AutoOC\logs\`

### 3. Test GPU Control

⚠️ **IMPORTANT**: Only test on a system you're comfortable modifying GPU settings on.

1. **Check default profile** - Should show stock settings (0/0 offsets)
2. **Run optimization** (Quiet mode first) - Monitor temperature
3. **Test emergency stop** (Ctrl+C or close app) - GPU should reset to stock
4. **Check logs** - Verify no errors in `%APPDATA%\AutoOC\logs\`

### 4. Test Uninstallation

```
Settings → Apps → AutoOC → Uninstall
```

**Should**:
- Remove app from `%LOCALAPPDATA%\AutoOC\`
- Remove Start Menu shortcut
- **Keep user data** in `%APPDATA%\AutoOC\` (profiles, logs)

---

## 🐛 Common Build Issues

### Issue 1: "npm run make" fails on macOS/Linux

**Error**:
```
Cannot build Windows installer on non-Windows platform
```

**Solution**:
- Use a Windows machine or VM
- Or use GitHub Actions with a Windows runner

### Issue 2: Icon not found

**Error**:
```
Could not find icon at assets/icon.ico
```

**Solution**:
```bash
# Check icons exist
ls -la assets/
# Should show: icon.ico, icon.png, icon.icns
```

### Issue 3: TypeScript compilation errors

**Error**:
```
src/backend/service/index.ts:42:10 - error TS2304
```

**Solution**:
```bash
# Fix TypeScript errors first
npm run build
# Then build installer
npm run make
```

### Issue 4: Large installer size (>500 MB)

**Cause**: Including unnecessary files (tests, source maps, etc.)

**Solution**: Check `forge.config.js` `ignore` patterns are correct.

### Issue 5: App crashes on launch

**Check**:
1. Open `%APPDATA%\AutoOC\logs\autooc-error.log`
2. Look for error messages
3. Common issues:
   - Missing NVIDIA drivers
   - Not running as Administrator
   - Missing `dist/backend/` files

---

## 📝 Code Signing (Optional)

For production releases, you should sign the executable:

### 1. Get a Code Signing Certificate

Purchase from:
- DigiCert
- Sectigo
- GlobalSign

Or use a free EV certificate for open source projects.

### 2. Set Environment Variables

```powershell
$env:WINDOWS_CERT_FILE="C:\path\to\certificate.pfx"
$env:WINDOWS_CERT_PASSWORD="your_password"
```

### 3. Build

```bash
npm run make
```

Electron Forge will automatically sign if certificate is configured.

**Benefits**:
- No "Unknown Publisher" warning
- Users trust the installer more
- Required for some enterprise deployments

---

## 🚢 Distribution

### Hosting the Installer

**Options**:

1. **GitHub Releases** (Recommended)
   ```bash
   # Tag version
   git tag v0.1.0
   git push origin v0.1.0

   # Upload AutoOC-Setup.exe to GitHub Release
   ```

2. **Direct Download**
   - Host on your own server
   - Use CDN for faster downloads

3. **Microsoft Store** (Future)
   - Requires Store Developer account ($19)
   - More complex submission process

### File to Distribute

**Only distribute**:
```
AutoOC-Setup.exe  (~150-200 MB)
```

**Do NOT distribute**:
- The unpacked `out/autooc-win32-x64/` folder
- `.nupkg` files
- Source code (unless separately)

---

## 🔄 Auto-Updates (Future Enhancement)

Squirrel supports automatic updates. To enable:

### 1. Host Update Server

Host the following files:
```
https://your-domain.com/releases/
├── AutoOC-Setup.exe
├── AutoOC-0.1.0-full.nupkg
├── AutoOC-0.2.0-full.nupkg
└── RELEASES
```

### 2. Configure Update URL

In `src/electron/main.js`:

```javascript
const { autoUpdater } = require('electron');

autoUpdater.setFeedURL({
  url: 'https://your-domain.com/releases/'
});

autoUpdater.checkForUpdates();
```

### 3. Handle Update Events

```javascript
autoUpdater.on('update-downloaded', () => {
  // Prompt user to restart and install update
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'A new version is ready to install.',
    buttons: ['Restart', 'Later']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});
```

---

## 📊 Build Sizes

**Typical sizes**:

| Component | Size |
|-----------|------|
| Electron Runtime | ~120 MB |
| Node.js Dependencies | ~30 MB |
| Backend Code | ~2 MB |
| Frontend Code | ~1 MB |
| Assets | ~1 MB |
| **Total Installer** | **~150-200 MB** |

**Installed size**: ~250-300 MB

---

## ✅ Checklist Before Release

- [ ] All tests passing (`npm test`)
- [ ] TypeScript compiles (`npm run build`)
- [ ] Version number updated in `package.json`
- [ ] CHANGELOG.md updated
- [ ] Built on Windows machine
- [ ] Executable tested on clean Windows install
- [ ] GPU control tested safely
- [ ] Emergency stop tested (Ctrl+C)
- [ ] Logs verified (no critical errors)
- [ ] Uninstaller tested
- [ ] (Optional) Code signed
- [ ] (Optional) Scanned for viruses (VirusTotal)

---

## 🎓 Advanced: CI/CD Build Pipeline

### GitHub Actions Example

Create `.github/workflows/build.yml`:

```yaml
name: Build Windows Installer

on:
  push:
    tags:
      - 'v*'

jobs:
  build-windows:
    runs-on: windows-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build installer
        run: npm run make

      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: AutoOC-Setup
          path: out/make/squirrel.windows/x64/AutoOC-Setup.exe

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: out/make/squirrel.windows/x64/AutoOC-Setup.exe
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Usage**:
```bash
git tag v0.1.0
git push origin v0.1.0
# GitHub automatically builds and creates release
```

---

## 📞 Troubleshooting

### Get Build Logs

```bash
# Verbose build output
npm run make -- --verbose
```

### Check Packaged Files

```bash
# Extract ASAR to inspect contents
npx asar extract out/autooc-win32-x64/resources/app.asar extracted/
ls -R extracted/
```

### Test Without Building

```bash
# Run in development mode
npm run dev:backend  # Terminal 1
npm run dev:frontend # Terminal 2
```

---

## 🔗 Resources

- [Electron Forge Documentation](https://www.electronforge.io/)
- [Squirrel.Windows](https://github.com/Squirrel/Squirrel.Windows)
- [Code Signing Guide](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- [ASAR Format](https://github.com/electron/asar)

---

## 🎉 Success!

If the build succeeds, you'll have:

✅ **AutoOC-Setup.exe** - Ready to distribute!

Users can simply:
1. Download `AutoOC-Setup.exe`
2. Right-click → "Run as Administrator"
3. Follow installer
4. Launch AutoOC from Start Menu

No Node.js, Git, or build tools required for end users!

---

**Next Steps**: See [READY_FOR_HARDWARE_TEST.md](READY_FOR_HARDWARE_TEST.md) for testing the built executable on real hardware.
