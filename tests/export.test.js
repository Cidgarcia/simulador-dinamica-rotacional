import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeDynamics } from '../src/physics.js';
import {
  buildComparisonCsv,
  buildExperimentCsv,
  buildSteinerComparisonCsv,
  downloadCsv,
  formatCsvCell,
  generateDiscreteSamples,
  localTimestamp,
} from '../src/export.js';

describe('exportação CSV e geração de amostras exatas', () => {
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
      't_s;theta_teor_rad;theta_med_rad;omega_teor_rads;omega_med_rads;alfa_med_rads2;K_rot_J;W_J'
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

  it('exporta apenas dados de sensor no Modo Cego para Relatório (blindMode = true)', () => {
    const params = { geometry: 'disco', mass: 2, size: 0.5, axisOffset: 0, force: 1, direction: 1 };
    const dynamics = computeDynamics(params);
    const csv = buildExperimentCsv({
      params,
      dynamics,
      noiseEnabled: true,
      noiseSigmaRel: 0.02,
      blindMode: true,
      samples: [
        {
          t_s: 1,
          theta_teorico_rad: 1,
          theta_medido_rad: 1.03,
          omega_teorico_rads: 2,
          omega_medido_rads: 2.04,
          alfa_medido_rads2: 2.02,
          energia_cinetica_J: 0.5,
          energia_cinetica_medida_J: 0.5202,
          trabalho_J: 0.5,
        },
      ],
    });

    expect(csv).toContain('# Modo de Exportacao: Modo Cego para Relatorio');
    expect(csv).not.toContain('# Alfa teorico');
    expect(csv).not.toContain('theta_teor_rad');
    expect(csv).not.toContain('omega_teor_rads');
    expect(csv).toContain(
      't_s;theta_med_rad;omega_med_rads;alfa_med_rads2;K_rot_med_J'
    );
    expect(csv).toContain('1;1.03;2.04;2.02;0.5202');
  });

  it('gera amostras analíticas exatas (sem deriva de quadros) e reproduz o teste obrigatório em t = 2 s', () => {
    const params = { geometry: 'disco', mass: 2, size: 0.5, axisOffset: 0, force: 1, direction: 1 };
    const dynamics = computeDynamics(params);
    const samples = generateDiscreteSamples({
      dynamics,
      maxTime: 2.0,
      sampleDt: 0.2,
      noiseEnabled: false,
    });

    // 0,0 s até 2,0 s com passo 0,2 s -> 11 linhas exatas
    expect(samples).toHaveLength(11);
    expect(samples.map((s) => s.t_s)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2]);

    const at2s = samples[samples.length - 1];
    expect(at2s).toMatchObject({
      t_s: 2,
      theta_teorico_rad: 4,
      theta_medido_rad: 4,
      omega_teorico_rads: 4,
      omega_medido_rads: 4,
      alfa_medido_rads2: 2,
      energia_cinetica_J: 2,
      energia_cinetica_medida_J: 2,
      trabalho_J: 2,
    });

    // Exportação compatível com Excel / LibreOffice Calc BR (vírgula decimal e ponto e vírgula entre colunas)
    const csvBr = buildExperimentCsv({
      params,
      dynamics,
      noiseEnabled: false,
      decimalSeparator: ',',
      samples,
    });
    expect(csvBr).toContain('# R (m): 0,5');
    expect(csvBr).toContain('# I (kg.m2): 0,25');
    expect(csvBr).toContain('# Torque (N.m): 0,5');
    expect(csvBr).toContain('0,2;0,04;0,04;0,4;0,4;2;0,02;0,02');
    expect(csvBr).toContain('2;4;4;4;4;2;2;2');
  });

  it('ordena linhas cronologicamente, remove duplicatas de tempo e preserva sinais no sentido horário', () => {
    const params = { geometry: 'disco', mass: 2, size: 0.5, axisOffset: 0, force: 1, direction: -1 };
    const dynamics = computeDynamics(params);
    const samples = generateDiscreteSamples({
      dynamics,
      maxTime: 1.0,
      sampleDt: 0.5,
      noiseEnabled: false,
    });
    // Passa amostras fora de ordem e com duplicata de t_s = 0.5
    const csv = buildExperimentCsv({
      params,
      dynamics,
      noiseEnabled: false,
      samples: [samples[2], samples[1], samples[0], samples[1]],
    });
    const dataLines = csv
      .replace('\uFEFF', '')
      .trim()
      .split('\r\n')
      .filter((line) => !line.startsWith('#'));

    // Cabeçalho + 3 linhas únicas (0, 0.5, 1.0)
    expect(dataLines).toHaveLength(4);
    expect(dataLines[1]).toBe('0;0;0;0;0;-2;0;0');
    expect(dataLines[2]).toBe('0.5;-0.25;-0.25;-1;-1;-2;0.125;0.125');
    expect(dataLines[3]).toBe('1;-1;-1;-2;-2;-2;0.5;0.5');
  });

  it('exporta corretamente os dados comparativos (Disco x Anel e Steiner Central x Deslocado)', () => {
    const compCsvBr = buildComparisonCsv({
      mass: 2,
      radius: 0.5,
      force: 1,
      direction: 1,
      maxTime: 2,
      sampleDt: 0.5,
      decimalSeparator: ',',
    });
    expect(compCsvBr).toContain('# Experimento Comparativo 1: Disco macico vs. Anel fino');
    expect(compCsvBr).toContain('# I_disco (kg.m2): 0,25 | Alfa_disco (rad/s2): 2');
    expect(compCsvBr).toContain('# I_anel (kg.m2): 0,5 | Alfa_anel (rad/s2): 1');
    // Colunas: t_s;alfa_disco;omega_disco;theta_disco;energia_disco;trabalho_disco;alfa_anel;omega_anel;theta_anel;energia_anel;trabalho_anel
    expect(compCsvBr).toContain('2;2;4;4;2;2;1;2;2;1;1');

    const steinerCsvBr = buildSteinerComparisonCsv({
      geometry: 'disco',
      mass: 2,
      size: 0.5,
      force: 1,
      direction: 1,
      dRatio: 1,
      maxTime: 2,
      sampleDt: 1,
      decimalSeparator: ',',
    });
    expect(steinerCsvBr).toContain('# Experimento Comparativo 2: Teorema de Steiner');
    expect(steinerCsvBr).toContain('# I_central = Icm (kg.m2): 0,25 | Alfa_central (rad/s2): 2');
    expect(steinerCsvBr).toContain('# Md2 (kg.m2): 0,5 | I_deslocado (kg.m2): 0,75 | Alfa_deslocado (rad/s2): 0,6666666667');
    // Colunas: t_s;alfa_central;omega_central;theta_central;energia_central;trabalho_central;alfa_deslocado;omega_deslocado;theta_deslocado;energia_deslocado;trabalho_deslocado
    expect(steinerCsvBr).toContain('2;2;4;4;2;2;0,6666666667;1,333333333;1,333333333;0,6666666667;0,6666666667');
  });
});

describe('precisão numérica do CSV (auditoria)', () => {
  it('grava 10 algarismos significativos: erro relativo < 1e-6 % mesmo em t pequeno', () => {
    const exatos = [0.2 ** 2 / 3 / 2, 2 / 3, 0.0266666666666667, 1.0666666666666667e-1, 8.333333e-5];
    for (const v of exatos) {
      const texto = formatCsvCell(v);
      const lido = Number(texto);
      expect(Math.abs(lido - v) / Math.abs(v)).toBeLessThan(1e-9); // 1e-9 = 1e-7 %
    }
    expect(formatCsvCell(0.0266666666666667)).toBe('0.02666666667');
    expect(formatCsvCell(2 / 3, { decimalSeparator: ',' })).toBe('0,6666666667');
  });

  it('CSV do ensaio 5 (Steiner, d = R) em t = 0,2 s e 0,4 s não perde casas', () => {
    const params = { geometry: 'disco', mass: 2, size: 0.5, axisOffset: 0.5, force: 1, direction: 1 };
    const dynamics = computeDynamics(params);
    const samples = generateDiscreteSamples({ dynamics, maxTime: 0.4, sampleDt: 0.2 });
    const csv = buildExperimentCsv({ params, dynamics, samples, noiseEnabled: false });
    const rows = csv
      .replace('\uFEFF', '')
      .trim()
      .split('\r\n')
      .filter((l) => !l.startsWith('#'))
      .slice(1)
      .map((l) => l.split(';').map(Number));
    for (const [row, s] of rows.map((r, i) => [r, samples[i]])) {
      if (s.t_s === 0) continue;
      for (const [col, exato] of [
        [1, s.theta_teorico_rad],
        [3, s.omega_teorico_rads],
        [6, s.energia_cinetica_J],
        [7, s.trabalho_J],
      ]) {
        expect((Math.abs(row[col] - exato) / Math.abs(exato)) * 100).toBeLessThan(1e-4);
      }
    }
  });

  it('cabeçalho: ruído desligado declara incerteza de tempo 0; ligado, declarada e t nominal', () => {
    const params = { geometry: 'disco', mass: 2, size: 0.5, axisOffset: 0, force: 1, direction: 1 };
    const dynamics = computeDynamics(params);
    const samples = generateDiscreteSamples({ dynamics, maxTime: 0.2, sampleDt: 0.2 });
    const off = buildExperimentCsv({ params, dynamics, samples, noiseEnabled: false });
    expect(off).toContain('# Incerteza instrumental de tempo (s): 0 (ruido desligado)');
    expect(off).toContain('# Semente do ruido: nao se aplica (ruido desligado)');
    const on = buildExperimentCsv({ params, dynamics, samples, noiseEnabled: true, noiseSeed: 42 });
    expect(on).toContain('+-0.01 (declarada; t_s nominal, nao perturbado)');
    expect(on).toContain('# Semente do ruido: 42');
    const rand = buildExperimentCsv({ params, dynamics, samples, noiseEnabled: true });
    expect(rand).toContain('# Semente do ruido: aleatoria (nao reproduzivel)');
  });
});

describe('ruído reproduzível com semente (auditoria)', () => {
  const params = { geometry: 'disco', mass: 2, size: 0.5, axisOffset: 0, force: 1, direction: 1 };
  const dynamics = computeDynamics(params);
  const gen = (seed, extra = {}) =>
    generateDiscreteSamples({ dynamics, maxTime: 2, sampleDt: 0.2, noiseEnabled: true, noiseSigmaRel: 0.02, seed, ...extra });

  it('mesma semente → CSV idêntico; semente diferente → leituras diferentes', () => {
    const csvA = buildExperimentCsv({ params, dynamics, samples: gen(123), noiseEnabled: true, noiseSeed: 123 });
    const csvB = buildExperimentCsv({ params, dynamics, samples: gen(123), noiseEnabled: true, noiseSeed: 123 });
    const csvC = buildExperimentCsv({ params, dynamics, samples: gen(124), noiseEnabled: true, noiseSeed: 124 });
    expect(csvA).toBe(csvB);
    expect(csvC).not.toBe(csvA);
  });

  it('o ruído de cada instante não depende de quantas amostras já foram geradas', () => {
    const curta = generateDiscreteSamples({ dynamics, maxTime: 0.6, sampleDt: 0.2, noiseEnabled: true, seed: 7 });
    const longa = generateDiscreteSamples({ dynamics, maxTime: 2, sampleDt: 0.2, noiseEnabled: true, seed: 7 });
    curta.forEach((s, i) => expect(s.omega_medido_rads).toBe(longa[i].omega_medido_rads));
  });

  it('em t = 0 não há ruído em θ e ω (condições iniciais impostas)', () => {
    const [t0] = gen(99);
    expect(t0.t_s).toBe(0);
    expect(t0.theta_medido_rad).toBe(0);
    expect(t0.omega_medido_rads).toBe(0);
  });
});

describe('downloadCsv e nome de arquivo (auditoria)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('anexa o link ao DOM antes do clique e revoga a URL só depois', () => {
    vi.useFakeTimers();
    const events = [];
    const link = {
      style: {},
      click: () => events.push('click'),
      remove: () => events.push('remove'),
    };
    vi.stubGlobal('document', {
      createElement: () => link,
      body: { appendChild: () => events.push('append') },
    });
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:teste',
      revokeObjectURL: () => events.push('revoke'),
    });
    downloadCsv('arquivo.csv', 'a;b\r\n');
    expect(link.download).toBe('arquivo.csv');
    expect(link.href).toBe('blob:teste');
    expect(events).toEqual(['append', 'click']); // ainda não revogou
    vi.advanceTimersByTime(1000);
    expect(events).toEqual(['append', 'click', 'remove', 'revoke']);
  });

  it('localTimestamp usa a hora LOCAL, no formato AAAA-MM-DDTHH-MM-SS', () => {
    const d = new Date(2026, 10, 10, 9, 5, 3); // construtor local
    expect(localTimestamp(d)).toBe('2026-11-10T09-05-03');
  });
});