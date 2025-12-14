/**
 * AutoOC Frontend Application
 * WebSocket client and UI management
 */

class AutoOCApp {
  constructor() {
    this.ws = null;
    this.reconnectInterval = 5000;
    this.reconnectTimer = null;
    this.isConnected = false;
    this.currentProfile = null;
    this.profiles = [];
    this.gpuInfo = null;

    this.init();
  }

  /**
   * Initialize the application
   */
  init() {
    console.log('AutoOC Frontend initializing...');

    // Setup event listeners
    this.setupEventListeners();

    // Connect to backend
    this.connect();
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    try {
      this.ws = new WebSocket('ws://localhost:8080');

      this.ws.onopen = () => {
        console.log('Connected to AutoOC service');
        this.isConnected = true;
        this.updateConnectionStatus(true);

        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        // Fetch initial data
        this.fetchGPUInfo();
        this.fetchProfiles();
        this.fetchActiveProfile();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('Disconnected from AutoOC service');
        this.isConnected = false;
        this.updateConnectionStatus(false);
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('Failed to connect:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.connect();
    }, this.reconnectInterval);
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(message) {
    // Handle events (no 'id' field)
    if (message.type) {
      this.handleEvent(message);
      return;
    }

    // Handle responses (has 'id' field)
    // Responses are handled by sendCommand promise resolution
  }

  /**
   * Handle WebSocket events
   */
  handleEvent(event) {
    switch (event.type) {
      case 'connected':
        console.log('Service connected:', event.data);
        break;

      case 'telemetry':
        this.updateTelemetry(event.data);
        break;

      case 'optimization-progress':
        this.updateOptimizationProgress(event.data);
        break;

      case 'optimization-complete':
        this.handleOptimizationComplete(event.data);
        break;

      case 'optimization-failed':
        this.handleOptimizationFailed(event.data);
        break;

      case 'thermal-warning':
        this.showWarning('High temperature detected!');
        break;

      case 'power-warning':
        this.showWarning('Power throttling detected!');
        break;

      case 'emergency-rollback':
        this.showError(`Emergency rollback: ${event.data.reason}`);
        break;

      default:
        console.log('Unknown event type:', event.type);
    }
  }

  /**
   * Send command to backend
   */
  sendCommand(command, data = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Not connected to service'));
        return;
      }

      const id = Math.random().toString(36).substring(7);
      const message = { id, command, data };

      const handler = (event) => {
        try {
          const response = JSON.parse(event.data);
          if (response.id === id) {
            this.ws.removeEventListener('message', handler);

            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response.data);
            }
          }
        } catch (error) {
          // Not our response, ignore
        }
      };

      this.ws.addEventListener('message', handler);

      // Timeout after 30 seconds
      setTimeout(() => {
        this.ws.removeEventListener('message', handler);
        reject(new Error('Command timeout'));
      }, 30000);

      this.ws.send(JSON.stringify(message));
    });
  }

  /**
   * Setup UI event listeners
   */
  setupEventListeners() {
    // Optimization mode buttons
    document.querySelectorAll('.mode-button').forEach(button => {
      button.addEventListener('click', () => {
        const mode = button.dataset.mode;
        this.startOptimization(mode);
      });
    });

    // Manage profiles button
    const manageProfilesBtn = document.getElementById('manage-profiles-btn');
    if (manageProfilesBtn) {
      manageProfilesBtn.addEventListener('click', () => {
        this.showProfilesModal();
      });
    }

    // Close modal
    const closeModalBtn = document.getElementById('close-modal');
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', () => {
        this.hideProfilesModal();
      });
    }

    // Import profile button
    const importBtn = document.getElementById('import-profile-btn');
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        this.importProfile();
      });
    }
  }

  /**
   * Update connection status indicator
   */
  updateConnectionStatus(connected) {
    const indicator = document.getElementById('connection-status');
    const text = document.getElementById('connection-text');

    if (connected) {
      indicator.classList.add('connected');
      indicator.classList.remove('disconnected');
      text.textContent = 'Connected';
    } else {
      indicator.classList.add('disconnected');
      indicator.classList.remove('connected');
      text.textContent = 'Disconnected';
    }
  }

  /**
   * Fetch GPU information
   */
  async fetchGPUInfo() {
    try {
      const gpuInfo = await this.sendCommand('get-gpu-info');
      this.gpuInfo = gpuInfo;
      this.displayGPUInfo(gpuInfo);
    } catch (error) {
      console.error('Failed to fetch GPU info:', error);
    }
  }

  /**
   * Display GPU information
   */
  displayGPUInfo(gpuInfo) {
    document.getElementById('gpu-name').textContent = gpuInfo.name;
    document.getElementById('gpu-arch').textContent = gpuInfo.architecture;
    document.getElementById('gpu-vram').textContent = `${gpuInfo.vramSize} MB ${gpuInfo.vramType}`;
    document.getElementById('gpu-driver').textContent = gpuInfo.driverVersion;
  }

  /**
   * Update telemetry display
   */
  updateTelemetry(telemetry) {
    // Core clock
    document.getElementById('core-clock').textContent = `${telemetry.coreClock} MHz`;

    // Memory clock
    document.getElementById('memory-clock').textContent = `${telemetry.memoryClock} MHz`;

    // Temperature (with color coding)
    const tempElement = document.getElementById('temperature');
    tempElement.textContent = `${telemetry.temperature}°C`;

    // Color code temperature
    tempElement.style.color = this.getTemperatureColor(telemetry.temperature);

    // Power draw
    document.getElementById('power-draw').textContent = `${telemetry.powerDraw.toFixed(1)} W`;

    // GPU usage
    document.getElementById('gpu-usage').textContent = `${telemetry.utilization.gpu}%`;

    // Fan speed
    document.getElementById('fan-speed').textContent = `${telemetry.fanSpeed}%`;
  }

  /**
   * Get color for temperature display
   */
  getTemperatureColor(temp) {
    if (temp < 75) return '#4caf50'; // Green
    if (temp < 85) return '#ff9800'; // Orange
    return '#f44336'; // Red
  }

  /**
   * Start optimization
   */
  async startOptimization(mode) {
    try {
      // Disable all mode buttons
      document.querySelectorAll('.mode-button').forEach(btn => {
        btn.disabled = true;
      });

      // Show progress
      const progressDiv = document.getElementById('optimization-progress');
      progressDiv.classList.remove('hidden');

      // Send command
      await this.sendCommand('start-optimization', { mode });

      console.log('Optimization started:', mode);
    } catch (error) {
      console.error('Failed to start optimization:', error);
      this.showError(`Failed to start optimization: ${error.message}`);

      // Re-enable buttons
      document.querySelectorAll('.mode-button').forEach(btn => {
        btn.disabled = false;
      });

      // Hide progress
      document.getElementById('optimization-progress').classList.add('hidden');
    }
  }

  /**
   * Update optimization progress
   */
  updateOptimizationProgress(progress) {
    const progressFill = document.getElementById('progress-fill');
    const progressMessage = document.getElementById('progress-message');

    const percentage = (progress.currentStep / progress.totalSteps) * 100;
    progressFill.style.width = `${percentage}%`;
    progressMessage.textContent = progress.message;
  }

  /**
   * Handle optimization completion
   */
  handleOptimizationComplete(profile) {
    console.log('Optimization complete:', profile);

    // Hide progress
    document.getElementById('optimization-progress').classList.add('hidden');

    // Re-enable buttons
    document.querySelectorAll('.mode-button').forEach(btn => {
      btn.disabled = false;
    });

    // Show success message
    this.showSuccess('Optimization completed successfully!');

    // Refresh profiles and active profile
    this.fetchProfiles();
    this.fetchActiveProfile();
  }

  /**
   * Handle optimization failure
   */
  handleOptimizationFailed(data) {
    console.error('Optimization failed:', data);

    // Hide progress
    document.getElementById('optimization-progress').classList.add('hidden');

    // Re-enable buttons
    document.querySelectorAll('.mode-button').forEach(btn => {
      btn.disabled = false;
    });

    // Show error
    this.showError(`Optimization failed: ${data.error}`);
  }

  /**
   * Fetch profiles list
   */
  async fetchProfiles() {
    try {
      this.profiles = await this.sendCommand('get-profiles');
      console.log('Profiles loaded:', this.profiles.length);
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
    }
  }

  /**
   * Fetch active profile
   */
  async fetchActiveProfile() {
    try {
      this.currentProfile = await this.sendCommand('get-active-profile');
      this.displayActiveProfile(this.currentProfile);
    } catch (error) {
      console.error('Failed to fetch active profile:', error);
    }
  }

  /**
   * Display active profile
   */
  displayActiveProfile(profile) {
    if (!profile) return;

    document.getElementById('active-profile-name').textContent = profile.name;
    document.getElementById('profile-mode').textContent = profile.mode;
    document.getElementById('profile-clocks').textContent =
      `Core: +${profile.configuration.clockOffset.core}MHz | Memory: +${profile.configuration.clockOffset.memory}MHz`;
  }

  /**
   * Show profiles modal
   */
  async showProfilesModal() {
    await this.fetchProfiles();

    const modal = document.getElementById('profiles-modal');
    const profilesList = document.getElementById('profiles-list');

    // Clear existing profiles
    profilesList.innerHTML = '';

    // Add each profile
    this.profiles.forEach(profile => {
      const profileDiv = document.createElement('div');
      profileDiv.className = 'profile-item' + (profile.isActive ? ' active' : '');

      profileDiv.innerHTML = `
        <div class="profile-item-info">
          <h3>${profile.name}${profile.isDefault ? ' (Default)' : ''}</h3>
          <p>${profile.description || 'No description'}</p>
          <p>Core: +${profile.configuration.clockOffset.core}MHz | Memory: +${profile.configuration.clockOffset.memory}MHz</p>
        </div>
        <div class="profile-item-actions">
          <button onclick="app.applyProfile('${profile.id}')" ${profile.isActive ? 'disabled' : ''}>
            ${profile.isActive ? 'Active' : 'Apply'}
          </button>
          ${!profile.isDefault ? `<button onclick="app.deleteProfile('${profile.id}')">Delete</button>` : ''}
          <button onclick="app.exportProfile('${profile.id}')">Export</button>
        </div>
      `;

      profilesList.appendChild(profileDiv);
    });

    modal.classList.remove('hidden');
  }

  /**
   * Hide profiles modal
   */
  hideProfilesModal() {
    document.getElementById('profiles-modal').classList.add('hidden');
  }

  /**
   * Apply profile
   */
  async applyProfile(profileId) {
    try {
      await this.sendCommand('apply-profile', { profileId });
      this.showSuccess('Profile applied successfully');
      await this.fetchActiveProfile();
      this.hideProfilesModal();
    } catch (error) {
      this.showError(`Failed to apply profile: ${error.message}`);
    }
  }

  /**
   * Delete profile
   */
  async deleteProfile(profileId) {
    if (!confirm('Are you sure you want to delete this profile?')) {
      return;
    }

    try {
      await this.sendCommand('delete-profile', { profileId });
      this.showSuccess('Profile deleted');
      await this.showProfilesModal(); // Refresh list
    } catch (error) {
      this.showError(`Failed to delete profile: ${error.message}`);
    }
  }

  /**
   * Export profile
   */
  async exportProfile(profileId) {
    try {
      const result = await this.sendCommand('export-profile', { profileId });
      const blob = new Blob([result.json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `autooc-profile-${profileId}.json`;
      a.click();

      URL.revokeObjectURL(url);

      this.showSuccess('Profile exported');
    } catch (error) {
      this.showError(`Failed to export profile: ${error.message}`);
    }
  }

  /**
   * Import profile
   */
  importProfile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const profile = await this.sendCommand('import-profile', { jsonString: text });
        this.showSuccess(`Profile imported: ${profile.name}`);
        await this.showProfilesModal(); // Refresh list
      } catch (error) {
        this.showError(`Failed to import profile: ${error.message}`);
      }
    };

    input.click();
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    console.log('✅', message);
    // TODO: Add toast notification
    alert(message);
  }

  /**
   * Show warning message
   */
  showWarning(message) {
    console.warn('⚠️', message);
    // TODO: Add toast notification
    alert(`Warning: ${message}`);
  }

  /**
   * Show error message
   */
  showError(message) {
    console.error('❌', message);
    // TODO: Add toast notification
    alert(`Error: ${message}`);
  }
}

// Initialize app when DOM is ready
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new AutoOCApp();
});
