import { describe, expect, it } from 'vitest';
import { computeDynamics } from '../src/physics.js';
import { buildExperimentCsv } from '../src/export.js';

describe('exportação CSV', () => {
  it('inclui cabeçalho comentado (# Corpo, # M, # R/L, # d, # I, # F, # Ruido (%)) e as 8 colunas experimentais', () => {
    const params = { geometry: 'disco', mass: 2, size: 0.5, axisOffset: 0.5, force: 1, direction: 1 };
    const dynamics = computeDynamics(params);
    const csv = buildExperimentCsv({
      params,
      dynamics,
      noiseEnabled: true,
      noiseSigmaRel: 0.02,
      samples: [
        {
          t_s: 2,
          theta_teorico_rad: 2.666667,
          theta_medido_rad: 2.71,
          omega_teorico_rads: 2.666667,
          omega_medido_rads: 2.62,
          alfa_medido_rads2: 1.35,
          energia_cinetica_J: 2.666667,
          trabalho_J: 2.666667,
        },
      ],
    });

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('# Corpo: Disco / cilindro maciço (disco)');
    expect(csv).toContain('# M (kg): 2');
    expect(csv).toContain('# R (m): 0.5');
    expect(csv).toContain('# d (m): 0.5');
    expect(csv).toContain('# I (kg.m2): 0.75');
    expect(csv).toContain('# F (N): 1');
    expect(csv).toContain('# Ruido (%): 2');
    expect(csv).toContain(
      't_s;theta_teorico_rad;theta_medido_rad;omega_teorico_rads;omega_medido_rads;alfa_medido_rads2;energia_cinetica_J;trabalho_J'
    );
    expect(csv).toContain('2;2.666667;2.71;2.666667;2.62;1.35;2.666667;2.666667');
  });

  it('normaliza ruído de ponto flutuante e preenche valores medidos/energéticos quando omitidos', () => {
    const params = { geometry: 'anel', mass: 2, size: 0.5, axisOffset: 0, force: 1, direction: -1 };
    const csv = buildExperimentCsv({
      params,
      dynamics: computeDynamics(params),
      noiseEnabled: false,
      samples: [{ t: 0.02 + 0.04, omega: -0.06, theta: -0.0018 }],
    });
    expect(csv).toContain('# Corpo: Anel fino (anel)');
    expect(csv).toContain('# Ruido (%): 0');
    expect(csv).toContain('0.06;-0.0018;-0.0018;-0.06;-0.06;-1;0.0009;0.0009');
  });
});
