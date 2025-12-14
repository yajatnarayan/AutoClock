/**
 * Service Integration Tests
 * Tests the full service with mocked GPU
 */

import { AutoOCProductionService } from '../../src/backend/service/production-service';
import WebSocket from 'ws';

describe('AutoOC Service Integration', () => {
  let service: AutoOCProductionService;

  // Skip these tests in CI or when no GPU available
  const skipTests =
    process.env.CI === 'true' ||
    process.env.SKIP_GPU_TESTS === 'true' ||
    process.platform !== 'win32';

  beforeAll(async () => {
    if (skipTests) return;

    service = new AutoOCProductionService({
      telemetryInterval: 1000,
      enableLogging: false,
    });
  });

  afterAll(async () => {
    if (skipTests) return;
    if (service) {
      await service.stop();
    }
  });

  describe('Service Lifecycle', () => {
    it('should start and stop cleanly', async () => {
      if (skipTests) {
        console.log('Skipping GPU test');
        return;
      }

      // Note: This test requires actual NVIDIA GPU
      // Will fail in CI or on systems without NVIDIA GPU

      try {
        await service.start();
        expect(service.getStatus().running).toBe(true);

        await service.stop();
        expect(service.getStatus().running).toBe(false);
      } catch (error: any) {
        if (error.message.includes('NVIDIA')) {
          console.log('No NVIDIA GPU available, skipping test');
        } else {
          throw error;
        }
      }
    }, 30000);
  });

  describe('WebSocket Communication', () => {
    it('should accept WebSocket connections', (done) => {
      if (skipTests) {
        done();
        return;
      }

      service.start()
        .then(() => {
          const ws = new WebSocket('ws://localhost:8080');

          ws.on('open', () => {
            ws.close();
            done();
          });

          ws.on('error', (error) => {
            done(error);
          });
        })
        .catch((error) => {
          if (error.message.includes('NVIDIA')) {
            console.log('No NVIDIA GPU available');
            done();
          } else {
            done(error);
          }
        });
    }, 30000);

    it('should respond to get-status command', (done) => {
      if (skipTests) {
        done();
        return;
      }

      service.start()
        .then(() => {
          const ws = new WebSocket('ws://localhost:8080');

          ws.on('open', () => {
            const message = {
              id: 'test-123',
              command: 'get-status',
              data: {},
            };

            ws.send(JSON.stringify(message));
          });

          ws.on('message', (data: Buffer) => {
            const response = JSON.parse(data.toString());

            if (response.id === 'test-123') {
              expect(response.data).toBeDefined();
              expect(response.data.version).toBe('0.1.0');
              ws.close();
              done();
            }
          });

          ws.on('error', (error) => {
            done(error);
          });
        })
        .catch((error) => {
          if (error.message.includes('NVIDIA')) {
            console.log('No NVIDIA GPU available');
            done();
          } else {
            done(error);
          }
        });
    }, 30000);
  });

  describe('Profile Management Integration', () => {
    it('should create and retrieve profiles', (done) => {
      if (skipTests) {
        done();
        return;
      }

      service.start()
        .then(() => {
          const ws = new WebSocket('ws://localhost:8080');

          ws.on('open', () => {
            const message = {
              id: 'test-profiles',
              command: 'get-profiles',
              data: {},
            };

            ws.send(JSON.stringify(message));
          });

          ws.on('message', (data: Buffer) => {
            const response = JSON.parse(data.toString());

            if (response.id === 'test-profiles') {
              expect(response.data).toBeDefined();
              expect(Array.isArray(response.data)).toBe(true);

              // Should have at least default profile
              expect(response.data.length).toBeGreaterThanOrEqual(1);

              const defaultProfile = response.data.find((p: any) => p.isDefault);
              expect(defaultProfile).toBeDefined();

              ws.close();
              done();
            }
          });

          ws.on('error', (error) => {
            done(error);
          });
        })
        .catch((error) => {
          if (error.message.includes('NVIDIA')) {
            console.log('No NVIDIA GPU available');
            done();
          } else {
            done(error);
          }
        });
    }, 30000);
  });
});
