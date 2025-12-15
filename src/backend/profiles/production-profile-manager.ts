/**
 * Production Profile Manager
 * Enhanced profile management with validation, app data storage, and metadata
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Profile, TuningConfiguration, OptimizationMode, BenchmarkResult } from '../types';
import { IGPUInterface } from '../hardware/gpu-interface';
import { logger } from '../utils/production-logger';

const WINDOWS_APPDATA_DIR =
  process.env.APPDATA ||
  (process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, 'AppData', 'Roaming')
    : path.join(os.homedir(), 'AppData', 'Roaming'));

const APP_DATA_DIR =
  process.platform === 'win32'
    ? WINDOWS_APPDATA_DIR
    : path.join(os.homedir(), '.autooc');
const AUTOOC_DIR = path.join(APP_DATA_DIR, 'AutoOC');
const PROFILES_DIR = path.join(AUTOOC_DIR, 'profiles');

/**
 * Profile validation schema
 */
interface ProfileValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Production Profile Manager
 */
export class ProductionProfileManager {
  private profilesDir: string;
  private profiles: Map<string, Profile>;
  private activeProfileId?: string;
  private gpuInterface: IGPUInterface;
  private knownGoodProfile?: Profile;
  private usesDefaultDir: boolean;

  constructor(gpuInterface: IGPUInterface, profilesDir?: string) {
    this.profilesDir = profilesDir || PROFILES_DIR;
    this.usesDefaultDir = !profilesDir;
    this.profiles = new Map();
    this.gpuInterface = gpuInterface;

    this.ensureDirectories();
    this.loadProfiles();
  }

  /**
   * Ensure necessary directories exist
   */
  private ensureDirectories(): void {
    const dirs = this.usesDefaultDir ? [AUTOOC_DIR, this.profilesDir] : [this.profilesDir];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info('ProfileManager', `Created directory: ${dir}`);
      }
    });
  }

  /**
   * Load all profiles from disk with validation
   */
  private loadProfiles(): void {
    try {
      if (!fs.existsSync(this.profilesDir)) {
        logger.warn('ProfileManager', 'Profiles directory does not exist');
        return;
      }

      const files = fs.readdirSync(this.profilesDir);
      let loaded = 0;
      let failed = 0;

      files.forEach(file => {
        if (!file.endsWith('.json')) {
          return;
        }

        try {
          const filePath = path.join(this.profilesDir, file);
          const data = fs.readFileSync(filePath, 'utf-8');
          const profile: Profile = JSON.parse(data);

          // Validate profile
          const validation = this.validateProfile(profile);
          if (!validation.valid) {
            logger.error('ProfileManager', `Invalid profile: ${file}`, {
              errors: validation.errors,
            });
            failed++;
            return;
          }

          this.profiles.set(profile.id, profile);

          if (profile.isActive) {
            this.activeProfileId = profile.id;
          }

          if (profile.isDefault) {
            this.knownGoodProfile = profile;
          }

          loaded++;
        } catch (error) {
          logger.error('ProfileManager', `Failed to load profile: ${file}`, error);
          failed++;
        }
      });

      logger.info('ProfileManager', `Loaded ${loaded} profiles (${failed} failed)`);
    } catch (error) {
      logger.error('ProfileManager', 'Failed to load profiles', error);
    }
  }

  /**
   * Validate profile structure and data
   */
  private validateProfile(profile: any): ProfileValidation {
    const errors: string[] = [];

    // Check required fields
    if (!profile.id) errors.push('Missing id');
    if (!profile.name) errors.push('Missing name');
    if (!profile.configuration) errors.push('Missing configuration');
    if (!profile.mode) errors.push('Missing mode');
    if (profile.isDefault === undefined) errors.push('Missing isDefault');
    if (profile.isActive === undefined) errors.push('Missing isActive');
    if (!profile.createdAt) errors.push('Missing createdAt');
    if (!profile.updatedAt) errors.push('Updated updatedAt');

    // Validate configuration
    if (profile.configuration) {
      if (!profile.configuration.id) errors.push('Configuration missing id');
      if (!profile.configuration.clockOffset) errors.push('Configuration missing clockOffset');
      if (profile.configuration.powerLimit === undefined) {
        errors.push('Configuration missing powerLimit');
      }

      // Validate clock offsets are within reasonable limits
      if (profile.configuration.clockOffset) {
        const { core, memory } = profile.configuration.clockOffset;
        if (core < -500 || core > 500) {
          errors.push('Core clock offset out of range (-500 to 500)');
        }
        if (memory < -2000 || memory > 2000) {
          errors.push('Memory clock offset out of range (-2000 to 2000)');
        }
      }

      // Validate power limit
      if (profile.configuration.powerLimit < 50 || profile.configuration.powerLimit > 150) {
        errors.push('Power limit out of range (50 to 150)');
      }
    }

    // Validate mode
    const validModes = Object.values(OptimizationMode);
    if (profile.mode && !validModes.includes(profile.mode)) {
      errors.push(`Invalid mode: ${profile.mode}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Save a profile to disk
   */
  private saveProfile(profile: Profile): void {
    try {
      // Validate before saving
      const validation = this.validateProfile(profile);
      if (!validation.valid) {
        throw new Error(`Invalid profile: ${validation.errors.join(', ')}`);
      }

      const filePath = path.join(this.profilesDir, `${profile.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), 'utf-8');
      logger.info('ProfileManager', `Profile saved: ${profile.name}`, { id: profile.id });
    } catch (error) {
      logger.error('ProfileManager', 'Failed to save profile', error);
      throw error;
    }
  }

  /**
   * Create a new profile
   */
  createProfile(
    name: string,
    description: string,
    configuration: TuningConfiguration,
    mode: OptimizationMode,
    benchmarkResult?: BenchmarkResult
  ): Profile {
    const profile: Profile = {
      id: `profile-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name,
      description,
      configuration,
      benchmarkResult,
      mode,
      isDefault: false,
      isActive: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.profiles.set(profile.id, profile);
    this.saveProfile(profile);

    logger.info('ProfileManager', 'Profile created', { id: profile.id, name });
    return profile;
  }

  /**
   * Create default stock profile
   */
  async createDefaultProfile(): Promise<Profile> {
    const defaultConfig: TuningConfiguration = {
      id: 'default-config',
      name: 'Stock Settings',
      clockOffset: { core: 0, memory: 0 },
      powerLimit: 100,
      timestamp: Date.now(),
    };

    const profile: Profile = {
      id: 'default',
      name: 'Default (Stock)',
      description: 'Factory default settings - safe fallback',
      configuration: defaultConfig,
      mode: OptimizationMode.BALANCED,
      isDefault: true,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.profiles.set(profile.id, profile);
    this.activeProfileId = profile.id;
    this.knownGoodProfile = profile;
    this.saveProfile(profile);

    logger.info('ProfileManager', 'Default profile created');
    return profile;
  }

  /**
   * Get profile by ID
   */
  getProfile(id: string): Profile | undefined {
    return this.profiles.get(id);
  }

  /**
   * Get all profiles
   */
  getAllProfiles(): Profile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get active profile
   */
  getActiveProfile(): Profile | undefined {
    if (!this.activeProfileId) {
      return undefined;
    }
    return this.profiles.get(this.activeProfileId);
  }

  /**
   * Get known-good (default) profile
   */
  getKnownGoodProfile(): Profile | undefined {
    return this.knownGoodProfile;
  }

  /**
   * Apply a profile
   */
  async applyProfile(id: string): Promise<void> {
    const profile = this.profiles.get(id);

    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    logger.info('ProfileManager', `Applying profile: ${profile.name}`, { id });

    try {
      // Deactivate current profile
      if (this.activeProfileId) {
        const currentProfile = this.profiles.get(this.activeProfileId);
        if (currentProfile) {
          currentProfile.isActive = false;
          this.saveProfile(currentProfile);
        }
      }

      // Apply configuration to GPU
      await this.gpuInterface.applyClockOffset(profile.configuration.clockOffset);
      await this.gpuInterface.setPowerLimit(profile.configuration.powerLimit);

      // TODO: Apply fan curve when supported
      // if (profile.configuration.fanCurve) {
      //   await this.gpuInterface.setFanCurve(profile.configuration.fanCurve);
      // }

      // Set as active
      profile.isActive = true;
      profile.updatedAt = Date.now();
      this.activeProfileId = id;
      this.saveProfile(profile);

      logger.info('ProfileManager', 'Profile applied successfully', {
        id,
        name: profile.name,
      });
    } catch (error) {
      logger.error('ProfileManager', 'Failed to apply profile', error);
      throw error;
    }
  }

  /**
   * Update a profile
   */
  updateProfile(
    id: string,
    updates: Partial<Omit<Profile, 'id' | 'createdAt'>>
  ): Profile {
    const profile = this.profiles.get(id);

    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    const updatedProfile: Profile = {
      ...profile,
      ...updates,
      updatedAt: Date.now(),
    };

    // Validate updated profile
    const validation = this.validateProfile(updatedProfile);
    if (!validation.valid) {
      throw new Error(`Invalid profile update: ${validation.errors.join(', ')}`);
    }

    this.profiles.set(id, updatedProfile);
    this.saveProfile(updatedProfile);

    logger.info('ProfileManager', 'Profile updated', { id });
    return updatedProfile;
  }

  /**
   * Delete a profile
   */
  deleteProfile(id: string): void {
    const profile = this.profiles.get(id);

    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    if (profile.isDefault) {
      throw new Error('Cannot delete default profile');
    }

    if (profile.isActive) {
      throw new Error('Cannot delete active profile. Switch to another profile first.');
    }

    // Remove from memory
    this.profiles.delete(id);

    // Remove from disk
    const filePath = path.join(this.profilesDir, `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    logger.info('ProfileManager', 'Profile deleted', { id, name: profile.name });
  }

  /**
   * Export profile to JSON string
   */
  exportProfile(id: string): string {
    const profile = this.profiles.get(id);

    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    return JSON.stringify(profile, null, 2);
  }

  /**
   * Import profile from JSON string
   */
  importProfile(jsonString: string): Profile {
    try {
      const profile: Profile = JSON.parse(jsonString);

      // Validate imported profile
      const validation = this.validateProfile(profile);
      if (!validation.valid) {
        throw new Error(`Invalid profile: ${validation.errors.join(', ')}`);
      }

      // SECURITY: Force safety flags on imported profiles
      // Generate new ID to avoid conflicts
      profile.id = `imported-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      profile.isActive = false;
      profile.isDefault = false; // CRITICAL: Never allow imported profiles to be default
      profile.createdAt = Date.now();
      profile.updatedAt = Date.now();

      this.profiles.set(profile.id, profile);
      this.saveProfile(profile);

      logger.info('ProfileManager', 'Profile imported', { id: profile.id, name: profile.name });
      return profile;
    } catch (error) {
      logger.error('ProfileManager', 'Failed to import profile', error);
      throw new Error(`Invalid profile JSON: ${error}`);
    }
  }

  /**
   * Ensure default profile exists
   */
  async ensureDefaultProfile(): Promise<void> {
    const hasDefault = Array.from(this.profiles.values()).some(p => p.isDefault);

    if (!hasDefault) {
      await this.createDefaultProfile();
    } else {
      // Set known-good reference
      this.knownGoodProfile = Array.from(this.profiles.values()).find(p => p.isDefault);
    }
  }

  /**
   * Get profiles directory path
   */
  getProfilesDirectory(): string {
    return this.profilesDir;
  }

  /**
   * Backup profiles to a ZIP or JSON file
   */
  async backupProfiles(backupPath: string): Promise<void> {
    const profiles = this.getAllProfiles();
    const backup = {
      version: '0.1.0',
      timestamp: Date.now(),
      profiles,
    };

    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf-8');
    logger.info('ProfileManager', `Profiles backed up to: ${backupPath}`);
  }

  /**
   * Restore profiles from backup
   */
  async restoreProfiles(backupPath: string): Promise<number> {
    try {
      const data = fs.readFileSync(backupPath, 'utf-8');
      const backup = JSON.parse(data);

      if (!backup.profiles || !Array.isArray(backup.profiles)) {
        throw new Error('Invalid backup format');
      }

      let restored = 0;
      for (const profile of backup.profiles) {
        try {
          this.importProfile(JSON.stringify(profile));
          restored++;
        } catch (error) {
          logger.error('ProfileManager', 'Failed to restore profile', error);
        }
      }

      logger.info('ProfileManager', `Restored ${restored} profiles from backup`);
      return restored;
    } catch (error) {
      logger.error('ProfileManager', 'Failed to restore profiles', error);
      throw error;
    }
  }
}
