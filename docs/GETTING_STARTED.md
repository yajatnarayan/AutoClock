# Getting Started with AutoOC

Welcome to AutoOC! This guide will help you get up and running with intelligent GPU performance tuning.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation](#installation)
3. [First-Time Setup](#first-time-setup)
4. [Running Your First Optimization](#running-your-first-optimization)
5. [Understanding Optimization Modes](#understanding-optimization-modes)
6. [Managing Profiles](#managing-profiles)
7. [Monitoring Performance](#monitoring-performance)
8. [Troubleshooting](#troubleshooting)
9. [Safety Tips](#safety-tips)

---

## System Requirements

### Minimum Requirements

- **OS**: Windows 10 (64-bit) or Windows 11
- **GPU**: NVIDIA GeForce GTX 1050 or newer
- **Driver**: NVIDIA Driver 527.xx or newer
- **RAM**: 4 GB
- **Storage**: 200 MB free space
- **Privileges**: Administrator access

### Recommended Requirements

- **OS**: Windows 11
- **GPU**: NVIDIA GeForce RTX 20 series or newer
- **Driver**: Latest NVIDIA Driver
- **RAM**: 8 GB or more
- **Cooling**: Adequate GPU cooling (good airflow or aftermarket cooler)
- **PSU**: Sufficient power supply for your GPU

### Compatibility Check

Before installing, verify:

1. **NVIDIA GPU Required**
   - Open Device Manager → Display adapters
   - Confirm you have an NVIDIA GPU

2. **Driver Version**
   - Right-click desktop → NVIDIA Control Panel
   - Help → System Information
   - Driver Version should be 527.xx or newer

3. **Admin Access**
   - You'll need administrator privileges to install

---

## Installation

### Method 1: Installer (Recommended)

1. **Download AutoOC**
   - Visit [releases page](https://github.com/yourusername/AutoOC/releases)
   - Download `AutoOC-Setup.exe`

2. **Run Installer**
   - Double-click the installer
   - Click "Yes" to UAC prompt
   - Follow installation wizard
   - Choose installation directory

3. **Launch Application**
   - Desktop shortcut created automatically
   - Or find in Start Menu → AutoOC
   - **Tip**: Run as Administrator for tuning features

### Method 2: Manual Installation

1. **Clone Repository**
   ```bash
   git clone https://github.com/yourusername/AutoOC.git
   cd AutoOC
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run in Development Mode (Recommended)**
   ```bash
   npm run dev
   ```

4. **Run the Backend Only (Optional)**
   ```bash
   npm run build:backend
   npm run start:service
   ```

5. **Install as a Windows Service (Advanced / Optional)**
   ```bash
   npm run build:backend
   npm run install-service
   ```

---

## First-Time Setup

### 1. Initial Launch

When you first launch AutoOC:

1. **GPU Detection**
   - AutoOC automatically detects your GPU
   - Displays GPU name, architecture, VRAM
   - Verifies driver compatibility

2. **Default Profile Creation**
   - Creates a "Default (Stock)" profile
   - This profile preserves your factory settings
   - **Never delete this profile** - it's your safety net

3. **Connection Verification**
   - Frontend connects to backend service
   - Status indicator turns green when connected
   - If connection fails, see [Troubleshooting](#troubleshooting)

### 2. Hardware Information

Review your GPU information:

- **GPU Name**: Your graphics card model
- **Architecture**: GPU microarchitecture
- **VRAM**: Video memory capacity
- **Driver**: Current driver version

### 3. Live Telemetry

Observe real-time metrics:

- **Core Clock**: Current GPU clock speed
- **Memory Clock**: Current VRAM clock speed
- **Temperature**: GPU temperature
- **Power Draw**: Current power consumption
- **GPU Usage**: Utilization percentage
- **Fan Speed**: Current fan speed

Let the system run for a few minutes to establish baseline metrics.

---

## Running Your First Optimization

### Before You Start

⚠️ **Important Safety Checks:**

1. **Close Resource-Intensive Applications**
   - Close games, rendering software, browsers
   - Free up GPU resources

2. **Check Cooling**
   - Ensure fans are working
   - Clean dust from GPU if needed
   - Verify case airflow

3. **Check Power Supply**
   - Ensure PSU is adequate for your GPU
   - Check power cables are secure

4. **Monitor Temperature**
   - Note current idle temperature
   - Should be below 50°C before starting

### Step-by-Step Optimization

1. **Choose Optimization Mode**

   Three modes available:

   - **⚡ Max Performance**: Maximum FPS, higher power/heat
   - **⚖️ Balanced**: Best performance per watt (recommended)
   - **🔇 Quiet**: Lower noise, cooler, slightly lower performance

   **For first time, choose Balanced**

2. **Click the Mode Button**
   - Click on "Balanced" card
   - Confirmation dialog appears
   - Review estimated time: 5-10 minutes
   - Click "Start Optimization"

3. **Optimization Process**

   Progress bar shows six stages:

   ```
   Stage 1/6: Initializing        [Resetting to stock]
   Stage 2/6: Baseline Benchmark  [Testing stock performance]
   Stage 3/6: Memory Tuning       [Finding best VRAM clock]
   Stage 4/6: Core Tuning         [Finding best core clock]
   Stage 5/6: Power Tuning        [Optimizing power limit]
   Stage 6/6: Final Validation    [Confirming stability]
   ```

4. **During Optimization**

   - **Don't** interrupt the process
   - **Don't** close the application
   - **Do** monitor the temperature (should stay below 85°C)
   - **Do** watch for any system instability

5. **Completion**

   When finished, you'll see:
   - New optimized profile created
   - Performance improvement percentage
   - Profile automatically applied
   - "Optimization Complete" message

### What to Expect

**Typical Results:**
- 5-12% FPS improvement in games
- 8-15% better benchmark scores
- Stable operation with no crashes
- Temperatures within safe limits

**Optimization Time:**
- Usually 5-10 minutes
- Depends on GPU model
- Faster GPUs may take longer (more tuning headroom)

---

## Understanding Optimization Modes

### Max Performance ⚡

**Best For:**
- Gaming at maximum FPS
- Benchmarking
- Short gaming sessions
- Well-cooled systems

**Characteristics:**
- Highest clock speeds
- Maximum power limit
- Highest temperatures (up to 90°C)
- Maximum fan speed (can be loud)
- Best raw performance

**Trade-offs:**
- Higher power consumption
- More heat
- More fan noise
- Slightly reduced efficiency

### Balanced ⚖️ (Recommended)

**Best For:**
- Daily gaming
- General use
- Most users
- Moderate cooling

**Characteristics:**
- Optimized for performance/watt
- Moderate temperatures (up to 80°C)
- Balanced fan speeds
- Great performance with efficiency

**Trade-offs:**
- Slightly lower peak performance vs Max
- Best all-around choice

### Quiet 🔇

**Best For:**
- Quiet computing
- Video streaming
- Content consumption
- Noise-sensitive environments
- Compact cases with limited cooling

**Characteristics:**
- Lower clock speeds
- Reduced power limit
- Lower temperatures (up to 75°C)
- Minimal fan noise
- Power efficient

**Trade-offs:**
- Lower performance
- Best for non-gaming workloads

---

## Managing Profiles

### Viewing Profiles

1. Click "Manage Profiles" button
2. See list of all saved profiles
3. Active profile highlighted in green

### Switching Profiles

1. Open profile manager
2. Click "Apply" on desired profile
3. GPU settings change immediately
4. Frontend updates to show new profile

### Creating Custom Profiles

(Available in future version with manual controls)

### Deleting Profiles

1. Open profile manager
2. Click "Delete" on profile
3. Confirm deletion
4. **Cannot delete Default profile** (safety)
5. **Cannot delete active profile** (switch first)

### Exporting Profiles

1. Open profile manager
2. Click "Export" on profile
3. JSON file saved to Downloads
4. Share with others or backup

### Importing Profiles

1. Open profile manager
2. Click "Import Profile"
3. Select JSON file
4. Profile added to library
5. Review before applying

---

## Monitoring Performance

### Real-Time Dashboard

The dashboard updates every second:

- **Core Clock**: Should be higher when under load
- **Memory Clock**: Should match your profile
- **Temperature**: Monitor for excessive heat
- **Power Draw**: Should match your power limit
- **GPU Usage**: 0% idle, near 100% under load
- **Fan Speed**: Should increase with temperature

### Warning Indicators

Watch for:

- 🔥 **High Temperature** (>85°C): Check cooling
- ⚡ **Power Throttling**: May need more power headroom
- 🌡️ **Thermal Throttling**: Improve cooling
- ⚠️ **Driver Reset**: Instability detected

### Performance Testing

After optimization, test in your workloads:

1. **Gaming**
   - Launch your favorite games
   - Monitor FPS improvement
   - Ensure no crashes or artifacts

2. **Benchmarks**
   - 3DMark, Unigine Heaven, etc.
   - Compare before/after scores
   - Should see 5-15% improvement

3. **Stability**
   - Run for extended period
   - No crashes or freezes
   - Consistent performance

---

## Troubleshooting

### Frontend Won't Connect

**Symptoms**: Red status indicator, "Disconnected"

**Solutions:**
1. If you’re running from source, start the backend:
   ```bash
   npm run dev:backend
   ```
   Or run everything together:
   ```bash
   npm run dev
   ```

2. If you installed the backend as a Windows service (advanced):
   - Open Services (`services.msc`)
   - Find "AutoOC" and ensure it’s running
   - Reinstall if needed:
     ```bash
     npm run uninstall-service
     npm run install-service
     ```

3. Check firewall:
   - Allow AutoOC through Windows Firewall
   - Port 8080 should be accessible locally

### GPU Not Detected

**Symptoms**: No GPU information shown

**Solutions:**
1. Verify NVIDIA GPU installed
2. Update NVIDIA drivers
3. Ensure nvidia-smi works:
   ```bash
   nvidia-smi
   ```
4. Restart computer

### Optimization Fails

**Symptoms**: Optimization stops with error

**Solutions:**
1. Close other GPU applications
2. Update NVIDIA drivers
3. Check cooling - may be too hot
4. Review logs (desktop app: Help → Open Logs Folder; from source: `logs/`)
5. Try more conservative mode (Quiet)

### Instability After Optimization

**Symptoms**: Crashes, freezes, artifacts

**Solutions:**
1. **Immediate**: Apply "Default (Stock)" profile
2. System should auto-rollback
3. If not, manually apply default profile
4. Restart computer
5. Try optimization again with Quiet mode

### High Temperatures

**Symptoms**: GPU temperature >85°C

**Solutions:**
1. Improve case airflow
2. Clean GPU heatsink/fans
3. Reapply thermal paste (advanced)
4. Use Quiet mode instead
5. Lower ambient room temperature

---

## Safety Tips

### Do's ✅

- ✅ **Monitor temperatures** during first optimization
- ✅ **Keep Default profile** as safety fallback
- ✅ **Start with Balanced mode** for first time
- ✅ **Ensure adequate cooling** before optimizing
- ✅ **Close other applications** during optimization
- ✅ **Test stability** in your actual workloads

### Don'ts ❌

- ❌ **Don't delete Default profile**
- ❌ **Don't interrupt** optimization process
- ❌ **Don't overclock** on inadequate cooling
- ❌ **Don't ignore** thermal warnings
- ❌ **Don't use Max Performance** 24/7 without monitoring
- ❌ **Don't modify** profiles manually (MVP version)

### Best Practices

1. **Regular Monitoring**
   - Check temperatures weekly
   - Ensure fan operation
   - Monitor for performance changes

2. **Cooling Maintenance**
   - Clean dust every 3-6 months
   - Ensure proper airflow
   - Monitor ambient temperature

3. **Driver Updates**
   - Keep NVIDIA drivers updated
   - Re-optimize after driver updates
   - Check compatibility

4. **Profile Management**
   - Create profiles for different scenarios
   - Use Quiet for idle/light work
   - Use Max Performance for gaming only

---

## Next Steps

### Learn More

- Read [ROADMAP.md](ROADMAP.md) for future features
- Check [ARCHITECTURE.md](ARCHITECTURE.md) for technical details
- Join community discussions

### Advanced Usage (Future)

- Manual tuning controls
- Custom fan curves
- Benchmark integration
- API access

### Get Help

- Check [GitHub Issues](https://github.com/yourusername/AutoOC/issues)
- Join Discord community
- Read FAQ

---

## Disclaimer

**USE AT YOUR OWN RISK**

Overclocking carries inherent risks. While AutoOC includes extensive safety mechanisms, the authors are not responsible for hardware damage, data loss, or system instability. Always ensure adequate cooling and power supply.

---

**Welcome to the AutoOC community! Enjoy your optimized GPU! 🚀**
