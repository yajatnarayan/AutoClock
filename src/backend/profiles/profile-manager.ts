/**
 * Profile management system
 * Save, load, and manage GPU tuning profiles
 */

import * as fs from 'fs';
import * as path from 'path';
import { Profile, TuningConfiguration, OptimizationMode, BenchmarkResult } from '../types';
import { NvidiaAPI } from '../hardware/nvidia-api';
import { logger } from '../utils/production-logger';

export class ProfileManager {
  private profilesDir: string;
  private profiles: Map<string, Profile>;
  private activeProfileId?: string;
  private nvapi: NvidiaAPI;

  constructor(profilesDir: string = './profiles', nvapi: NvidiaAPI) {
    this.profilesDir = profilesDir;
    this.profiles = new Map();
    this.nvapi = nvapi;
    this.ensureProfilesDirectory();
    this.loadProfiles();
  }

  /**
   * Ensure profiles directory exists
   */
  private ensureProfilesDirectory(): void {
    if (!fs.existsSync(this.profilesDir)) {
      fs.mkdirSync(this.profilesDir, { recursive: true });
      logger.info('ProfileManager', 'Created profiles directory', { path: this.profilesDir });
    }
  }

  /**
   * Load all profiles from disk
   */
  private loadProfiles(): void {
    try {
      const files = fs.readdirSync(this.profilesDir);

      files.forEach(file => {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.profilesDir, file);
          const data = fs.readFileSync(filePath, 'utf-8');
          const profile: Profile = JSON.parse(data);
          this.profiles.set(profile.id, profile);

          if (profile.isActive) {
            this.activeProfileId = profile.id;
          }
        }
      });

      logger.info('ProfileManager', `Loaded ${this.profiles.size} profiles`);
    } catch (error) {
      logger.error('ProfileManager', 'Failed to load profiles', error);
    }
  }

  /**
   * Save a profile to disk
   */
  private saveProfile(profile: Profile): void {
    try {
      const filePath = path.join(this.profilesDir, `${profile.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(profile, null, 2));
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
      id: `profile-${Date.now()}`,
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
  createDefaultProfile(): Profile {
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
      description: 'Factory default settings - always safe to return to',
      configuration: defaultConfig,
      mode: OptimizationMode.BALANCED,
      isDefault: true,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.profiles.set(profile.id, profile);
    this.activeProfileId = profile.id;
    this.saveProfile(profile);

    logger.info('ProfileManager', 'Default profile created');
    return profile;
  }

  /**
   * Get a profile by ID
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
   * Apply a profile (set as active and apply configuration to GPU)
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
      await this.nvapi.applyClockOffset(profile.configuration.clockOffset);
      await this.nvapi.setPowerLimit(profile.configuration.powerLimit);

      // Set as active
      profile.isActive = true;
      profile.updatedAt = Date.now();
      this.activeProfileId = id;
      this.saveProfile(profile);

      logger.info('ProfileManager', 'Profile applied successfully', { id, name: profile.name });
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
   * Rename a profile
   */
  renameProfile(id: string, newName: string): Profile {
    const profile = this.profiles.get(id);

    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    profile.name = newName;
    profile.updatedAt = Date.now();
    this.saveProfile(profile);

    logger.info('ProfileManager', 'Profile renamed', { id, newName });
    return profile;
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

      // Generate new ID to avoid conflicts
      profile.id = `imported-${Date.now()}`;
      profile.isActive = false;
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
   * Get profiles by mode
   */
  getProfilesByMode(mode: OptimizationMode): Profile[] {
    return Array.from(this.profiles.values()).filter(p => p.mode === mode);
  }

  /**
   * Ensure default profile exists
   */
  ensureDefaultProfile(): void {
    const hasDefault = Array.from(this.profiles.values()).some(p => p.isDefault);

    if (!hasDefault) {
      this.createDefaultProfile();
    }
  }
}
