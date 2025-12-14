/**
 * AutoOC Service Uninstallation Script
 * Removes the AutoOC backend Windows service
 */

const { Service } = require('node-windows');
const path = require('path');

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

// Main uninstallation function
function uninstallService() {
  console.log('AutoOC Service Uninstaller');
  console.log('==========================\n');

  // Check admin privileges
  if (!isAdmin()) {
    console.error('ERROR: This script requires administrator privileges.');
    console.error('Please run this script from an elevated command prompt.');
    process.exit(1);
  }

  const scriptPath = path.join(__dirname, '../dist/backend/service/index.js');

  // Create service reference
  const svc = new Service({
    name: 'AutoOC',
    script: scriptPath,
  });

  // Event handlers
  svc.on('uninstall', () => {
    console.log('✓ Service uninstalled successfully!');
    console.log('\nAutoOC backend service has been removed.');
    process.exit(0);
  });

  svc.on('alreadyuninstalled', () => {
    console.log('⚠ Service is not installed.');
    process.exit(0);
  });

  svc.on('error', (err) => {
    console.error('\n✗ Error:', err.message);
    process.exit(1);
  });

  // Uninstall the service
  console.log('Stopping and removing AutoOC service...');
  svc.uninstall();
}

// Run uninstallation
uninstallService();
