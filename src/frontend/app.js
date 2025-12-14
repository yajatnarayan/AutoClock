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
    this.authToken = null;
    this.currentProfile = null;
    this.profiles = [];
    this.gpuInfo = null;
    this.confirmState = {
      resolve: null,
      lastActiveElement: null,
    };

    this.init();
  }

  /**
   * Initialize the application
   */
  init() {
    console.log('AutoOC Frontend initializing...');

    this.initializeTheme();
    this.initializeVersion();

    // Setup event listeners
    this.setupEventListeners();

    // Fetch auth token (Electron packaged mode) before connecting
    this.initializeAuthToken().finally(() => {
      this.connect();
    });
  }

  async initializeAuthToken() {
    try {
      if (window.autooc && typeof window.autooc.getWsAuthToken === 'function') {
        this.authToken = await window.autooc.getWsAuthToken();
        return;
      }

      // Backward-compatible fallback (older preload implementations)
      if (window.autooc && typeof window.autooc.wsAuthToken === 'string') {
        this.authToken = window.autooc.wsAuthToken;
      }
    } catch (error) {
      console.warn('Failed to initialize WS auth token:', error);
      this.authToken = null;
    }
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
      const message = { id, command, data, authToken: this.authToken };

      const handler = (event) => {
        try {
          const response = JSON.parse(event.data);
          if (response.id === id) {
            this.ws.removeEventListener('message', handler);
            clearTimeout(timeoutId);

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
      const timeoutId = setTimeout(() => {
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

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        this.toggleTheme();
      });
    }

    // Close modal on escape / backdrop click
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.isConfirmModalOpen()) {
          this.hideConfirmModal(false);
        } else {
          this.hideProfilesModal();
        }
      }
    });

    const modal = document.getElementById('profiles-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.hideProfilesModal();
        }
      });
    }

    const confirmModal = document.getElementById('confirm-modal');
    if (confirmModal) {
      confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
          this.hideConfirmModal(false);
        }
      });
    }

    const confirmCancel = document.getElementById('confirm-cancel');
    if (confirmCancel) {
      confirmCancel.addEventListener('click', () => this.hideConfirmModal(false));
    }

    const confirmClose = document.getElementById('confirm-close');
    if (confirmClose) {
      confirmClose.addEventListener('click', () => this.hideConfirmModal(false));
    }

    const confirmOk = document.getElementById('confirm-ok');
    if (confirmOk) {
      confirmOk.addEventListener('click', () => this.hideConfirmModal(true));
    }
  }

  isConfirmModalOpen() {
    const modal = document.getElementById('confirm-modal');
    return !!modal && !modal.classList.contains('hidden');
  }

  showConfirmModal({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', dangerous = false }) {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-title');
    const messageEl = document.getElementById('confirm-message');
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');

    if (!modal || !titleEl || !messageEl || !okBtn || !cancelBtn) {
      return Promise.resolve(window.confirm(message || title || 'Are you sure?'));
    }

    titleEl.textContent = title || 'Confirm';
    messageEl.textContent = message || '';
    okBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    okBtn.classList.toggle('danger-button', dangerous);

    this.confirmState.lastActiveElement = document.activeElement;

    modal.classList.remove('hidden');
    cancelBtn.focus();

    return new Promise((resolve) => {
      this.confirmState.resolve = resolve;
    });
  }

  hideConfirmModal(result) {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;

    modal.classList.add('hidden');

    const resolve = this.confirmState.resolve;
    this.confirmState.resolve = null;

    const last = this.confirmState.lastActiveElement;
    this.confirmState.lastActiveElement = null;
    if (last && typeof last.focus === 'function') {
      last.focus();
    }

    if (resolve) resolve(!!result);
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

    // Disable optimization controls when disconnected
    document.querySelectorAll('.mode-button').forEach(btn => {
      btn.disabled = !connected;
    });

    const manageProfilesBtn = document.getElementById('manage-profiles-btn');
    if (manageProfilesBtn) manageProfilesBtn.disabled = !connected;
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
      this.showError('Failed to fetch GPU information. Is the service running?');
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

      const info = document.createElement('div');
      info.className = 'profile-item-info';

      const title = document.createElement('h3');
      title.textContent = `${profile.name}${profile.isDefault ? ' (Default)' : ''}`;
      info.appendChild(title);

      const description = document.createElement('p');
      description.textContent = profile.description || 'No description';
      info.appendChild(description);

      const coreOffset = profile.configuration?.clockOffset?.core ?? 0;
      const memOffset = profile.configuration?.clockOffset?.memory ?? 0;
      const offsets = document.createElement('p');
      offsets.textContent = `Core: +${coreOffset}MHz | Memory: +${memOffset}MHz`;
      info.appendChild(offsets);

      const actions = document.createElement('div');
      actions.className = 'profile-item-actions';

      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.disabled = !!profile.isActive;
      applyBtn.textContent = profile.isActive ? 'Active' : 'Apply';
      applyBtn.addEventListener('click', () => this.applyProfile(profile.id));
      actions.appendChild(applyBtn);

      if (!profile.isDefault) {
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'danger-button';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => this.deleteProfile(profile));
        actions.appendChild(deleteBtn);
      }

      const exportBtn = document.createElement('button');
      exportBtn.type = 'button';
      exportBtn.textContent = 'Export';
      exportBtn.addEventListener('click', () => this.exportProfile(profile.id));
      actions.appendChild(exportBtn);

      profileDiv.appendChild(info);
      profileDiv.appendChild(actions);
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
  async deleteProfile(profile) {
    const ok = await this.showConfirmModal({
      title: 'Delete profile?',
      message: `Delete "${profile.name}"? This can’t be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      dangerous: true,
    });
    if (!ok) return;

    try {
      await this.sendCommand('delete-profile', { profileId: profile.id });
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
      const json = result.json;

      // Electron: use native save dialog if available
      if (window.autooc && typeof window.autooc.saveTextFile === 'function') {
        const res = await window.autooc.saveTextFile(`autooc-profile-${profileId}.json`, json);
        if (!res.canceled) {
          this.showSuccess('Profile exported');
        }
        return;
      }

      // Browser fallback
      const blob = new Blob([json], { type: 'application/json' });
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
    // Electron: use native open dialog if available
    if (window.autooc && typeof window.autooc.openTextFile === 'function') {
      window.autooc.openTextFile().then(async (res) => {
        if (res.canceled) return;
        try {
          const profile = await this.sendCommand('import-profile', { jsonString: res.content });
          this.showSuccess(`Profile imported: ${profile.name}`);
          await this.showProfilesModal();
        } catch (error) {
          this.showError(`Failed to import profile: ${error.message}`);
        }
      });
      return;
    }

    // Browser fallback
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
    this.showToast('success', 'Success', message);
  }

  /**
   * Show warning message
   */
  showWarning(message) {
    console.warn('⚠️', message);
    this.showToast('warning', 'Warning', message);
  }

  /**
   * Show error message
   */
  showError(message) {
    console.error('❌', message);
    this.showToast('error', 'Error', message);
  }

  showToast(type, title, message, options = {}) {
    const container = document.getElementById('toast-container');
    if (!container) {
      console.log(`[${type}] ${title}: ${message}`);
      return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    const body = document.createElement('div');
    body.className = 'toast-body';

    const titleEl = document.createElement('div');
    titleEl.className = 'toast-title';
    titleEl.textContent = String(title);
    body.appendChild(titleEl);

    const messageEl = document.createElement('div');
    messageEl.className = 'toast-message';
    messageEl.textContent = String(message);
    body.appendChild(messageEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.textContent = '×';

    toast.appendChild(body);
    toast.appendChild(closeBtn);

    closeBtn.addEventListener('click', () => {
      toast.remove();
    });

    container.appendChild(toast);

    const duration = typeof options.durationMs === 'number' ? options.durationMs : 4500;
    setTimeout(() => {
      if (toast.isConnected) toast.remove();
    }, duration);
  }

  initializeVersion() {
    const versionEl = document.getElementById('app-version');
    if (!versionEl) return;

    if (window.autooc && typeof window.autooc.getVersion === 'function') {
      window.autooc.getVersion().then((v) => {
        versionEl.textContent = `v${v}`;
      }).catch(() => {
        versionEl.textContent = '';
      });
    }
  }

  initializeTheme() {
    const saved = localStorage.getItem('autooc-theme');
    if (saved === 'light' || saved === 'dark') {
      document.body.dataset.theme = saved;
    }
  }

  toggleTheme() {
    const current = document.body.dataset.theme === 'light' ? 'light' : 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    document.body.dataset.theme = next;
    localStorage.setItem('autooc-theme', next);
  }
}

// Initialize app when DOM is ready
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new AutoOCApp();
});
