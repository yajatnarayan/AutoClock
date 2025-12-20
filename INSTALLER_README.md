# AutoOC - Ready-to-Use Installer

> **Note**: This file is intended to accompany the `AutoOC-Setup.exe` installer when distributed to end users.

---

## 🎯 What is AutoOC?

**AutoOC** is an intelligent GPU performance tuning tool that safely optimizes your NVIDIA GPU for better performance. It automatically finds the best clock speeds for your specific GPU through stress testing and validation.

**Key Features**:
- ✅ **Safe & Automatic** - Extensive safety checks and automatic rollback
- ✅ **Smart Optimization** - Tests thousands of configurations to find the best
- ✅ **Multiple Modes** - Quiet, Balanced, and Max Performance
- ✅ **Real-time Monitoring** - Live GPU stats (temp, clocks, power)
- ✅ **Profile Management** - Save and switch between configurations
- ✅ **Emergency Protection** - Automatic reset on any issues

---

## 📥 Installation

### System Requirements

**Required**:
- Windows 10/11 (64-bit)
- NVIDIA GPU (GTX 10 series or newer, RTX series)
- NVIDIA Drivers 527 or newer
- Administrator privileges

**Recommended**:
- 8 GB RAM
- 500 MB free disk space
- GPU temperature monitoring software (GPU-Z, MSI Afterburner)

### Installation Steps

1. **Download** `AutoOC-Setup.exe`

2. **Right-click** the installer → **"Run as Administrator"**
   - ⚠️ Administrator privileges are required for GPU control

3. **Follow the installer** wizard
   - Install location: `C:\Users\YourName\AppData\Local\AutoOC\`
   - Creates Start Menu shortcut

4. **Launch AutoOC** from Start Menu

### First Launch

On first launch, AutoOC will:
1. Detect your NVIDIA GPU
2. Create a default profile (stock settings)
3. Start collecting telemetry (temperature, clocks, etc.)
4. Create logs folder: `%APPDATA%\AutoOC\logs\`

**Expected**: Window opens showing your GPU information and current status.

---

## 🚀 Quick Start Guide

### Step 1: Verify GPU Detection

- Check that your GPU name appears in the dashboard
- Verify temperature and clock speeds are showing

### Step 2: Create Your First Optimized Profile

1. Click **"Start Optimization"**
2. Choose a mode:
   - **Quiet** - Conservative, low temperatures (recommended first)
   - **Balanced** - Good performance, moderate temperatures
   - **Max Performance** - Maximum performance, higher temperatures

3. Wait for optimization to complete (10-20 minutes)
   - Monitor temperature during the process
   - AutoOC will test many configurations automatically

4. Review the results:
   - New profile created with optimized settings
   - Performance improvement shown
   - Stability score displayed

### Step 3: Use Your Optimized Profile

- **Apply Profile** - Click to activate optimized settings
- **Switch Back** - Click "Default" profile to return to stock
- **Monitor** - Watch temperature and performance in real-time

### Step 4: Test in Real Usage

1. Apply your optimized profile
2. Launch a game or GPU-intensive application
3. Monitor temperature and stability
4. If any issues occur, switch back to Default profile

---

## ⚙️ Usage Tips

### Best Practices

✅ **Start Conservative**
- Use "Quiet" mode for your first optimization
- Gradually try more aggressive modes if stable

✅ **Monitor Temperature**
- Keep GPU under 80°C for longevity
- AutoOC blocks optimization if GPU > 65°C at start

✅ **Test Thoroughly**
- Run games/apps for 30+ minutes with new profile
- Watch for crashes, artifacts, or instability

✅ **Keep Default Profile**
- Never delete the "Default" profile
- It's your safety fallback (stock settings)

✅ **Emergency Stop**
- Press Ctrl+C or close AutoOC to immediately reset GPU
- GPU automatically resets to stock on app exit

### Understanding Modes

| Mode | Temperature Target | Power Limit | Use Case |
|------|-------------------|-------------|----------|
| **Quiet** | <70°C | 85-95% | Silent operation, low temps |
| **Balanced** | <75°C | 95-105% | Daily gaming, good balance |
| **Max Performance** | <80°C | 105-115% | Benchmarking, max FPS |

### Profile Management

**Create Custom Profiles**:
- Adjust clock offsets manually
- Set custom power limits
- Save multiple configurations

**Import/Export Profiles**:
- Share profiles with friends (same GPU model)
- Backup your configurations
- **Security**: Imported profiles are never set as default

**Profile Safety**:
- Profiles are validated before applying
- Temperature checks before optimization
- Automatic rollback on instability

---

## 🛡️ Safety Features

AutoOC has **multiple layers of protection**:

### 1. Pre-Flight Checks
- ✅ Temperature check (blocks if >65°C)
- ✅ Driver verification
- ✅ GPU capability detection

### 2. During Optimization
- ✅ Real-time temperature monitoring (aborts if >95°C)
- ✅ Power throttle detection
- ✅ Driver reset detection
- ✅ Incremental testing (tests each offset separately)

### 3. Validation Testing
- ✅ 15-second stress test per offset
- ✅ 60-second final validation
- ✅ Stability score calculation (requires ≥90%)
- ✅ Automatic rollback on failure

### 4. Emergency Protection
- ✅ GPU resets to stock on any crash
- ✅ Ctrl+C immediately resets GPU
- ✅ Default profile always preserved
- ✅ Graceful shutdown handlers (SIGTERM, SIGINT)

---

## 🚨 Troubleshooting

### AutoOC won't start

**Symptoms**: Error dialog on launch

**Solutions**:
1. **Run as Administrator** - Required for GPU control
2. **Check NVIDIA drivers** - Run `nvidia-smi` in Command Prompt
3. **Update drivers** - Download latest from nvidia.com
4. **Check logs** - Open `%APPDATA%\AutoOC\logs\autooc-error.log`

### GPU not detected

**Solutions**:
1. Verify NVIDIA GPU is present (Device Manager)
2. Check `nvidia-smi` works: Open Command Prompt → `nvidia-smi`
3. Update NVIDIA drivers to version 527+
4. Restart computer

### Optimization fails immediately

**Possible causes**:
- GPU temperature too high (>65°C) - Let GPU cool down
- GPU already overclocked by another tool - Reset to stock first
- Insufficient power supply - Check PSU capacity
- Driver issue - Update or reinstall drivers

**Check logs**:
```
%APPDATA%\AutoOC\logs\autooc-error.log
```

### Display driver crash during optimization

**What happened**: GPU settings were too aggressive

**What AutoOC does**:
1. Detects driver reset
2. Automatically rolls back to last stable settings
3. Marks configuration as unstable
4. Logs the event

**What you should do**:
1. Check logs to see what offset failed
2. Try a more conservative mode (Quiet instead of Balanced)
3. Verify GPU cooling is adequate
4. Check for GPU hardware issues

### App freezes or becomes unresponsive

**Solutions**:
1. **Wait 30 seconds** - May be running stress test
2. **Check Task Manager** - Look for high GPU usage (expected)
3. **Force close** - Ctrl+C or close window (GPU will reset to stock)
4. **Check logs** - See what was happening when it froze

### High temperature during optimization

**Normal**:
- Optimization runs stress tests, causing high GPU load
- Temperature up to 80°C is expected

**Concerning**:
- Temperature exceeds 90°C
- AutoOC will automatically abort and rollback

**Action**:
1. Improve GPU cooling (clean fans, reapply thermal paste)
2. Use more conservative mode (Quiet)
3. Reduce ambient temperature (room cooling)

---

## 📊 Understanding the Interface

### Dashboard

- **GPU Info** - Name, driver version, capabilities
- **Current Status** - Temperature, clocks, power draw, utilization
- **Active Profile** - Currently applied configuration

### Optimization Tab

- **Mode Selection** - Choose Quiet/Balanced/Max Performance
- **Progress** - Shows current step and time remaining
- **Live Updates** - Real-time temperature and clock changes
- **Results** - Final offsets, stability score, performance gain

### Profiles Tab

- **Profile List** - All saved configurations
- **Apply** - Activate a profile
- **Edit** - Modify clock offsets and power limit
- **Export** - Save profile to file
- **Import** - Load profile from file
- **Delete** - Remove profile (can't delete Default)

### Telemetry Tab

- **Real-time Graphs** - Temperature, clocks, power over time
- **Statistics** - Min/max/average values
- **Throttle Warnings** - Shows if GPU is throttling

---

## 🗂️ File Locations

### Application Files
```
C:\Users\YourName\AppData\Local\AutoOC\
├── AutoOC.exe              (Main application)
├── resources/
│   └── app.asar            (Application code)
└── Update.exe              (Auto-updater)
```

### User Data
```
C:\Users\YourName\AppData\Roaming\AutoOC\
├── profiles/               (Saved configurations)
│   ├── default.json
│   └── optimized-*.json
└── logs/                   (Application logs)
    ├── autooc-combined.log
    └── autooc-error.log
```

**Note**: User data is NOT deleted when uninstalling (your profiles are safe).

---

## 🔄 Uninstallation

### Using Windows Settings

1. Open **Settings** → **Apps**
2. Find **AutoOC**
3. Click **Uninstall**
4. Follow prompts

### What Gets Removed

✅ **Deleted**:
- Application files (`%LOCALAPPDATA%\AutoOC\`)
- Start Menu shortcut
- Registry entries

❌ **Kept** (you can manually delete if desired):
- User profiles (`%APPDATA%\AutoOC\profiles\`)
- Logs (`%APPDATA%\AutoOC\logs\`)

### Clean Uninstall

To remove ALL AutoOC data:

```powershell
# After uninstalling via Settings, run:
Remove-Item -Recurse -Force "$env:APPDATA\AutoOC"
```

---

## ⚠️ Important Warnings

### GPU Overclocking Risks

**Understand**:
- Overclocking can reduce GPU lifespan
- Excessive heat can damage hardware
- Warranty may be voided (check manufacturer)
- Results vary by GPU quality ("silicon lottery")

**AutoOC's Safety**:
- Conservative limits
- Extensive stress testing
- Temperature monitoring
- Automatic rollback
- **Still**: Monitor your GPU closely

### Power Supply

- Overclocking increases power draw
- Ensure PSU can handle the load
- Typical increase: 10-30W
- Check PSU capacity before Max Performance mode

### Laptop Users

⚠️ **Caution**: Laptops have limited cooling

- Start with Quiet mode only
- Monitor temperature closely
- Ensure proper ventilation
- Consider external cooling pad
- May not benefit much from overclocking

---

## 🎓 Learning More

### Documentation

Located in the application folder or online:
- `GETTING_STARTED.md` - Detailed user guide
- `ARCHITECTURE.md` - How AutoOC works
- `READY_FOR_HARDWARE_TEST.md` - Testing procedures

### View Logs

**Open logs folder**:
- In AutoOC: Help → Open Logs Folder
- Or navigate to: `%APPDATA%\AutoOC\logs\`

**Log files**:
- `autooc-combined.log` - All events
- `autooc-error.log` - Errors only

### Support

- Check documentation first
- Review logs for errors
- Search online for similar issues
- Report bugs (if open source, via GitHub Issues)

---

## ❓ FAQ

**Q: Is AutoOC safe?**
A: AutoOC has extensive safety measures, but overclocking always carries some risk. Start conservatively and monitor your GPU.

**Q: Will this void my warranty?**
A: Depends on manufacturer. Many don't allow overclocking. Check your GPU's warranty terms.

**Q: Can I use AutoOC with MSI Afterburner?**
A: Not recommended. Only use one overclocking tool at a time to avoid conflicts.

**Q: Does AutoOC work on AMD GPUs?**
A: No, currently NVIDIA only (GTX 10+, RTX series).

**Q: Can I run AutoOC at Windows startup?**
A: Future feature. For now, launch manually when needed.

**Q: How much performance gain can I expect?**
A: Varies by GPU: 5-15% typical, up to 20% in some cases. Results depend on silicon quality.

**Q: Does optimization need to be re-run?**
A: Generally no. Once you have a stable profile, it should work indefinitely. Re-run if you update drivers or notice instability.

**Q: Can I share profiles with friends?**
A: Yes, export and share. However, **only share with identical GPU models**. Different GPUs require different settings.

**Q: What if my PC crashes during optimization?**
A: Your GPU will reset to BIOS defaults on reboot. Run AutoOC again and apply Default profile, or use a less aggressive mode.

---

## ✅ Quick Reference

### Safe Workflow

1. ✅ Launch AutoOC as Administrator
2. ✅ Verify GPU detected
3. ✅ Start with Quiet mode
4. ✅ Monitor temperature during optimization
5. ✅ Test profile in real usage
6. ✅ Keep Default profile for rollback
7. ✅ Close AutoOC when done (GPU resets)

### Emergency Actions

| Situation | Action |
|-----------|--------|
| **Too hot** | Close AutoOC (Ctrl+C) |
| **Display crash** | Restart PC → Apply Default |
| **System freeze** | Hard reset → Check logs |
| **Artifacts** | Switch to Default profile |
| **Instability** | Use less aggressive mode |

---

## 📞 Getting Help

1. **Read documentation** in app folder
2. **Check logs** at `%APPDATA%\AutoOC\logs\`
3. **Search online** for error messages
4. **Contact support** (if available)

---

**Enjoy safer, smarter GPU overclocking with AutoOC!** 🚀

---

*AutoOC v0.1.0 - Intelligent GPU Performance Tuning*
