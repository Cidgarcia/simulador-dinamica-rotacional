import { describe, expect, it } from 'vitest';
import { computeDynamics } from '../src/physics.js';
import { buildExperimentCsv } from '../src/export.js';

describe('exportação CSV', () => {
  it('inclui parâmetros SI, grandezas e amostras', () => {
    const params = { geometry: 'disco', mass: 2, size: 0.5, force: 1, direction: 1 };
    const csv = buildExperimentCsv({
      params,
      dynamics: computeDynamics(params),
      samples: [{ t: 2, omega: 4, theta: 4 }],
    });

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('massa_kg;2');
    expect(csv).toContain('aceleracao_angular_rad_s2;2');
    expect(csv).toContain('2;4;4');
  });

  it('escapa texto que precisa de aspas', () => {
    const params = { geometry: 'anel', mass: 2, size: 0.5, force: 1, direction: -1 };
    const csv = buildExperimentCsv({ params, dynamics: computeDynamics(params), samples: [] });
    expect(csv).toContain('Anel fino');
    expect(csv).toContain('horario');
  });
});
