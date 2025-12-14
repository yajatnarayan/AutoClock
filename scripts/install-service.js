/**
 * AutoOC Service Installation Script
 * Installs the AutoOC backend as a Windows service
 */

const { Service } = require('node-windows');
const path = require('path');
const fs = require('fs');

// Check if running with admin privileges
function isAdmin() {
  try {
    const { execSync } = require('child_process');
    execSync('net session', { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

// Main installation function
function installService() {
  console.log('AutoOC Service Installer');
  console.log('========================\n');

  // Check admin privileges
  if (!isAdmin()) {
    console.error('ERROR: This script requires administrator privileges.');
    console.error('Please run this script from an elevated command prompt.');
    process.exit(1);
  }

  // Determine paths
  const scriptPath = path.join(__dirname, '../dist/backend/service/index.js');
  const logPath = path.join(__dirname, '../logs');

  // Ensure script exists
  if (!fs.existsSync(scriptPath)) {
    console.error('ERROR: Backend service script not found.');
    console.error('Please run "npm run build" first.');
    console.error(`Expected path: ${scriptPath}`);
    process.exit(1);
  }

  // Ensure log directory exists
  if (!fs.existsSync(logPath)) {
    fs.mkdirSync(logPath, { recursive: true });
    console.log(`Created log directory: ${logPath}`);
  }

  // Create service
  const svc = new Service({
    name: 'AutoOC',
    description: 'AutoOC - Intelligent GPU Performance Tuning Service',
    script: scriptPath,
    nodeOptions: ['--harmony', '--max_old_space_size=4096'],
    env: [
      {
        name: 'NODE_ENV',
        value: 'production',
      },
      {
        name: 'AUTOOC_LOG_DIR',
        value: logPath,
      },
    ],
    workingDirectory: path.join(__dirname, '..'),
  });

  // Event handlers
  svc.on('install', () => {
    console.log('\n✓ Service installed successfully!');
    console.log('\nStarting service...');
    svc.start();
  });

  svc.on('alreadyinstalled', () => {
    console.log('\n⚠ Service is already installed.');
    console.log('To reinstall, first run: npm run uninstall-service');
    process.exit(0);
  });

  svc.on('start', () => {
    console.log('✓ Service started successfully!');
    console.log('\nAutoOC backend service is now running.');
    console.log('You can now launch the AutoOC desktop application.');
    process.exit(0);
  });

  svc.on('error', (err) => {
    console.error('\n✗ Error:', err.message);
    process.exit(1);
  });

  // Install the service
  console.log('Installing AutoOC service...');
  svc.install();
}

// Run installation
installService();
