import { describe, expect, it } from 'vitest';
import { computeDynamics } from '../src/physics.js';
import { buildExperimentCsv } from '../src/export.js';

describe('exportação CSV', () => {
  it('inclui parâmetros SI, grandezas de Steiner (d, Icm, Md², I) e amostras', () => {
    const params = { geometry: 'disco', mass: 2, size: 0.5, axisOffset: 0.5, force: 1, direction: 1 };
    const csv = buildExperimentCsv({
      params,
      dynamics: computeDynamics(params),
      samples: [{ t: 2, omega: 2.666667, theta: 2.666667 }],
    });

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('massa_kg;2');
    expect(csv).toContain('distancia_eixo_cm_m;0.5');
    expect(csv).toContain('momento_inercia_cm_kg_m2;0.25');
    expect(csv).toContain('termo_steiner_md2_kg_m2;0.5');
    expect(csv).toContain('momento_inercia_kg_m2;0.75');
    expect(csv).toContain('braco_m;1');
    expect(csv).toContain('torque_N_m;1');
    expect(csv).toContain('aceleracao_angular_rad_s2;1.333333');
    expect(csv).toContain('2;2.666667;2.666667');
  });

  it('escapa texto que precisa de aspas e normaliza ruído de ponto flutuante', () => {
    const params = { geometry: 'anel', mass: 2, size: 0.5, axisOffset: 0, force: 1, direction: -1 };
    const csv = buildExperimentCsv({
      params,
      dynamics: computeDynamics(params),
      samples: [{ t: 0.02 + 0.04, omega: -0.06, theta: -0.0018 }],
    });
    expect(csv).toContain('Anel fino');
    expect(csv).toContain('horario');
    expect(csv).toContain('0.06;-0.06;-0.0018');
  });
});
