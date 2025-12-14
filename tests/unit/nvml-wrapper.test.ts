/**
 * NVMLWrapper Unit Tests
 * Verifies nvidia-smi command construction without requiring NVIDIA hardware.
 */

import { NVMLWrapper } from '../../src/backend/hardware/nvml-wrapper';

describe('NVMLWrapper', () => {
  it('resetPowerLimit queries default power limit then sets -pl', async () => {
    const nvml = new NVMLWrapper();

    const execMock = jest.fn(async (args: string) => {
      if (args.includes('power.default_limit')) {
        return '220\n';
      }
      return '';
    });

    (nvml as any).exec = execMock;

    await nvml.resetPowerLimit(0);

    expect(execMock.mock.calls[0][0]).toContain('power.default_limit');
    expect(execMock.mock.calls[1][0]).toBe('-i 0 -pl 220');
  });

  it('getBaselineClocks prefers default application clocks when available', async () => {
    const nvml = new NVMLWrapper();

    const execMock = jest.fn(async () => '1500,5000,0,0,1200,4500\n');
    (nvml as any).exec = execMock;

    const clocks = await nvml.getBaselineClocks(0);

    expect(clocks).toEqual({
      graphics: 1500,
      memory: 5000,
      source: 'default_applications',
    });
  });
});

