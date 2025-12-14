/**
 * Electron Forge configuration for AutoOC.
 * Produces a Windows installer (.exe) via Squirrel when built on Windows.
 */

const path = require('path');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: path.resolve(__dirname, 'assets', 'icon'),
    executableName: 'AutoOC',
    win32metadata: {
      CompanyName: 'AutoOC',
      FileDescription: 'AutoOC \u2013 Intelligent GPU Performance Tuning',
      ProductName: 'AutoOC',
      InternalName: 'AutoOC',
      OriginalFilename: 'AutoOC.exe',
    },
    // Reduce installer size by excluding development-only artifacts.
    ignore: [
      /^\/\.git($|\/)/,
      /^\/coverage($|\/)/,
      /^\/tests($|\/)/,
      /^\/docs($|\/)/,
      /^\/scripts($|\/)/,
      /^\/AppData($|\/)/,
      /^\/logs($|\/)/,
      /^\/src\/backend($|\/)/,
      /^\/src\/frontend\/api($|\/)/,
      /^\/src\/frontend\/components($|\/)/,
      /^\/src\/frontend\/store($|\/)/,
      /^\/src\/frontend\/views($|\/)/,
      /^\/dist\/backend\/.*\.d\.ts$/,
      /^\/dist\/backend\/.*\.map$/,
    ],
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'autooc',
        setupExe: 'AutoOC-Setup.exe',
        setupIcon: path.resolve(__dirname, 'assets', 'icon.ico'),
        certificateFile: process.env.WINDOWS_CERT_FILE,
        certificatePassword: process.env.WINDOWS_CERT_PASSWORD,
      },
    },
    {
      name: '@electron-forge/maker-zip',
    },
  ],
};
