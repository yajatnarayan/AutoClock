/**
 * Profile Manager Unit Tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { ProductionProfileManager } from '../../src/backend/profiles/production-profile-manager';
import { MockGPUInterface } from '../mocks/mock-gpu-interface';
import { OptimizationMode } from '../../src/backend/types';

describe('ProductionProfileManager', () => {
  let profileManager: ProductionProfileManager;
  let mockGPU: MockGPUInterface;
  let testProfilesDir: string;

  beforeEach(() => {
    // Create temp directory for test profiles
    testProfilesDir = path.join(__dirname, '../temp-profiles');
    if (!fs.existsSync(testProfilesDir)) {
      fs.mkdirSync(testProfilesDir, { recursive: true });
    }

    mockGPU = new MockGPUInterface();
    profileManager = new ProductionProfileManager(mockGPU, testProfilesDir);
  });

  afterEach(() => {
    // Clean up test profiles
    if (fs.existsSync(testProfilesDir)) {
      const files = fs.readdirSync(testProfilesDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testProfilesDir, file));
      });
      fs.rmdirSync(testProfilesDir);
    }
  });

  describe('Profile Creation', () => {
    it('should create a new profile', () => {
      const profile = profileManager.createProfile(
        'Test Profile',
        'A test profile',
        {
          id: 'test-config',
          name: 'Test Config',
          clockOffset: { core: 100, memory: 500 },
          powerLimit: 110,
          timestamp: Date.now(),
        },
        OptimizationMode.BALANCED
      );

      expect(profile).toBeDefined();
      expect(profile.name).toBe('Test Profile');
      expect(profile.mode).toBe(OptimizationMode.BALANCED);
      expect(profile.isDefault).toBe(false);
      expect(profile.isActive).toBe(false);
    });

    it('should create default profile', async () => {
      const profile = await profileManager.createDefaultProfile();

      expect(profile.id).toBe('default');
      expect(profile.isDefault).toBe(true);
      expect(profile.isActive).toBe(true);
      expect(profile.configuration.clockOffset.core).toBe(0);
      expect(profile.configuration.clockOffset.memory).toBe(0);
    });

    it('should validate profile on creation', () => {
      expect(() => {
        profileManager.createProfile(
          'Invalid Profile',
          'Test',
          {
            id: 'invalid',
            name: 'Invalid',
            clockOffset: { core: 9999, memory: 9999 }, // Out of range
            powerLimit: 200, // Out of range
            timestamp: Date.now(),
          },
          OptimizationMode.BALANCED
        );
      }).toThrow();
    });
  });

  describe('Profile Management', () => {
    it('should get all profiles', () => {
      profileManager.createProfile(
        'Profile 1',
        'Test 1',
        {
          id: 'config-1',
          name: 'Config 1',
          clockOffset: { core: 0, memory: 0 },
          powerLimit: 100,
          timestamp: Date.now(),
        },
        OptimizationMode.BALANCED
      );

      profileManager.createProfile(
        'Profile 2',
        'Test 2',
        {
          id: 'config-2',
          name: 'Config 2',
          clockOffset: { core: 50, memory: 250 },
          powerLimit: 105,
          timestamp: Date.now(),
        },
        OptimizationMode.MAX_PERFORMANCE
      );

      const profiles = profileManager.getAllProfiles();
      expect(profiles.length).toBe(2);
    });

    it('should get profile by ID', () => {
      const created = profileManager.createProfile(
        'Test Profile',
        'Test',
        {
          id: 'test-config',
          name: 'Test',
          clockOffset: { core: 0, memory: 0 },
          powerLimit: 100,
          timestamp: Date.now(),
        },
        OptimizationMode.BALANCED
      );

      const retrieved = profileManager.getProfile(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should delete non-default profile', () => {
      const profile = profileManager.createProfile(
        'Deletable',
        'Test',
        {
          id: 'deletable-config',
          name: 'Deletable',
          clockOffset: { core: 0, memory: 0 },
          powerLimit: 100,
          timestamp: Date.now(),
        },
        OptimizationMode.BALANCED
      );

      profileManager.deleteProfile(profile.id);

      const retrieved = profileManager.getProfile(profile.id);
      expect(retrieved).toBeUndefined();
    });

    it('should not delete default profile', async () => {
      const defaultProfile = await profileManager.createDefaultProfile();

      expect(() => {
        profileManager.deleteProfile(defaultProfile.id);
      }).toThrow('Cannot delete default profile');
    });

    it('should not delete active profile', async () => {
      const profile = profileManager.createProfile(
        'Active Profile',
        'Test',
        {
          id: 'active-config',
          name: 'Active',
          clockOffset: { core: 0, memory: 0 },
          powerLimit: 100,
          timestamp: Date.now(),
        },
        OptimizationMode.BALANCED
      );

      await profileManager.applyProfile(profile.id);

      expect(() => {
        profileManager.deleteProfile(profile.id);
      }).toThrow('Cannot delete active profile');
    });
  });

  describe('Profile Import/Export', () => {
    it('should export profile to JSON', () => {
      const profile = profileManager.createProfile(
        'Export Test',
        'Test export',
        {
          id: 'export-config',
          name: 'Export',
          clockOffset: { core: 100, memory: 500 },
          powerLimit: 110,
          timestamp: Date.now(),
        },
        OptimizationMode.MAX_PERFORMANCE
      );

      const json = profileManager.exportProfile(profile.id);
      expect(json).toBeDefined();

      const parsed = JSON.parse(json);
      expect(parsed.name).toBe('Export Test');
      expect(parsed.mode).toBe(OptimizationMode.MAX_PERFORMANCE);
    });

    it('should import profile from JSON', () => {
      const originalProfile = profileManager.createProfile(
        'Original',
        'Original profile',
        {
          id: 'original-config',
          name: 'Original',
          clockOffset: { core: 75, memory: 375 },
          powerLimit: 105,
          timestamp: Date.now(),
        },
        OptimizationMode.BALANCED
      );

      const json = profileManager.exportProfile(originalProfile.id);
      const imported = profileManager.importProfile(json);

      expect(imported.id).not.toBe(originalProfile.id); // New ID assigned
      expect(imported.name).toBe('Original');
      expect(imported.configuration.clockOffset.core).toBe(75);
    });

    it('should reject invalid JSON on import', () => {
      expect(() => {
        profileManager.importProfile('{ invalid json }');
      }).toThrow();
    });

    it('should reject invalid profile data on import', () => {
      const invalidProfile = JSON.stringify({
        name: 'Invalid',
        // Missing required fields
      });

      expect(() => {
        profileManager.importProfile(invalidProfile);
      }).toThrow();
    });
  });

  describe('Profile Application', () => {
    it('should apply profile to GPU', async () => {
      const profile = profileManager.createProfile(
        'Apply Test',
        'Test',
        {
          id: 'apply-config',
          name: 'Apply',
          clockOffset: { core: 100, memory: 500 },
          powerLimit: 110,
          timestamp: Date.now(),
        },
        OptimizationMode.BALANCED
      );

      await profileManager.applyProfile(profile.id);

      const settings = mockGPU.getAppliedSettings();
      expect(settings.clockOffset.core).toBe(100);
      expect(settings.clockOffset.memory).toBe(500);
    });

    it('should track active profile', async () => {
      const profile = profileManager.createProfile(
        'Active',
        'Test',
        {
          id: 'active-config',
          name: 'Active',
          clockOffset: { core: 0, memory: 0 },
          powerLimit: 100,
          timestamp: Date.now(),
        },
        OptimizationMode.BALANCED
      );

      await profileManager.applyProfile(profile.id);

      const active = profileManager.getActiveProfile();
      expect(active?.id).toBe(profile.id);
    });
  });
});
