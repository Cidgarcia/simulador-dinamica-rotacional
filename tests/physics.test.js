import { describe, expect, it } from 'vitest';
import {
  Experiment,
  MAX_FRAME_DT,
  MAX_SIM_TIME,
  computeDynamics,
  kinematics,
  leverArm,
  momentOfInertia,
  validateParams,
  wrapAngle,
} from '../src/physics.js';
import { formatFixed, formatNumber, parseDecimal } from '../src/format.js';

const base = { geometry: 'disco', mass: 2, size: 0.3, force: 0.3, direction: 1 };

describe('momento de inércia e braço', () => {
  it('usa as fórmulas corretas', () => {
    expect(momentOfInertia('disco', 2, 0.3)).toBeCloseTo(0.09, 12);
    expect(momentOfInertia('anel', 2, 0.3)).toBeCloseTo(0.18, 12);
    expect(momentOfInertia('esfera', 2, 0.3)).toBeCloseTo(0.072, 12);
    expect(momentOfInertia('barra', 3, 1.2)).toBeCloseTo(0.36, 12);
  });
  it('b = R para corpos circulares e L/2 para a barra', () => {
    expect(leverArm('disco', 0.3)).toBe(0.3);
    expect(leverArm('anel', 0.3)).toBe(0.3);
    expect(leverArm('esfera', 0.3)).toBe(0.3);
    expect(leverArm('barra', 1.2)).toBeCloseTo(0.6, 12);
  });
});

describe('dinâmica', () => {
  it('reproduz o caso de referência: M=2 kg, R=0,5 m, F=1 N', () => {
    const disco = computeDynamics({ geometry: 'disco', mass: 2, size: 0.5, force: 1, direction: 1 });
    const anel = computeDynamics({ geometry: 'anel', mass: 2, size: 0.5, force: 1, direction: 1 });
    expect(disco).toMatchObject({ I: 0.25, b: 0.5, tau: 0.5, alpha: 2 });
    expect(anel).toMatchObject({ I: 0.5, b: 0.5, tau: 0.5, alpha: 1 });
    expect(kinematics(disco.alpha, 2)).toEqual({ omega: 4, theta: 4 });
    expect(kinematics(anel.alpha, 2)).toEqual({ omega: 2, theta: 2 });
  });

  it('τ assinado e α = τ/I', () => {
    const d = computeDynamics(base);
    expect(d.tau).toBeCloseTo(0.09, 12);
    expect(d.alpha).toBeCloseTo(1, 12);
    const h = computeDynamics({ ...base, direction: -1 });
    expect(h.tau).toBeCloseTo(-0.09, 12);
    expect(h.alpha).toBeCloseTo(-1, 12);
  });
  it('força zero produz α = 0 (sem -0)', () => {
    const d = computeDynamics({ ...base, force: 0, direction: -1 });
    expect(Object.is(d.alpha, 0)).toBe(true);
  });
  it('ω = αt e θ = αt²/2', () => {
    expect(kinematics(2, 3)).toEqual({ omega: 6, theta: 9 });
    expect(kinematics(-2, 3)).toEqual({ omega: -6, theta: -9 });
  });
  it('wrapAngle reduz a [0, 2π)', () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(2 * Math.PI + 1)).toBeCloseTo(1, 12);
    expect(wrapAngle(-1)).toBeCloseTo(2 * Math.PI - 1, 12);
  });
});

describe('validação', () => {
  it('aceita parâmetros válidos, inclusive força zero', () => {
    expect(validateParams(base).valid).toBe(true);
    expect(validateParams({ ...base, force: 0 }).valid).toBe(true);
  });
  it('rejeita massa e dimensão não positivas ou inválidas', () => {
    expect(validateParams({ ...base, mass: 0 }).errors.mass).toBeTruthy();
    expect(validateParams({ ...base, mass: -1 }).errors.mass).toBeTruthy();
    expect(validateParams({ ...base, size: 0 }).errors.size).toBeTruthy();
    expect(validateParams({ ...base, size: NaN }).errors.size).toBeTruthy();
    expect(validateParams({ ...base, force: -0.1 }).errors.force).toBeTruthy();
    expect(validateParams({ ...base, geometry: 'cubo' }).errors.geometry).toBeTruthy();
  });
});

describe('Experiment', () => {
  it('tempo independente da taxa de quadros', () => {
    const a = new Experiment(base);
    const b = new Experiment(base);
    a.start();
    b.start();
    for (let i = 0; i < 60; i++) a.advance(1 / 60, 1);
    for (let i = 0; i < 144; i++) b.advance(1 / 144, 1);
    expect(a.time).toBeCloseTo(1, 9);
    expect(b.time).toBeCloseTo(1, 9);
    expect(a.state.theta).toBeCloseTo(b.state.theta, 9);
  });
  it('velocidade de reprodução escala o tempo simulado', () => {
    const e = new Experiment(base);
    e.start();
    for (let i = 0; i < 60; i++) e.advance(1 / 60, 0.25);
    expect(e.time).toBeCloseTo(0.25, 9);
  });
  it('limita saltos de quadro e encerra em 20 s', () => {
    const e = new Experiment(base);
    e.start();
    e.advance(5, 1);
    expect(e.time).toBeCloseTo(MAX_FRAME_DT, 12);
    for (let i = 0; i < 1000; i++) e.advance(0.05, 1);
    expect(e.time).toBe(MAX_SIM_TIME);
    expect(e.status).toBe('finished');
    expect(e.start()).toBe(false);
    expect(e.state.theta).toBeCloseTo(0.5 * 1 * 400, 6); // θ acumulado, sem módulo
  });
  it('pausa, continua e reinicia', () => {
    const e = new Experiment(base);
    expect(e.advance(0.05)).toBe(0);
    e.start();
    e.advance(0.05);
    e.pause();
    const t = e.time;
    e.advance(0.05);
    expect(e.time).toBe(t);
    e.start();
    e.advance(0.05);
    expect(e.time).toBeGreaterThan(t);
    e.reset();
    expect(e.time).toBe(0);
    expect(e.status).toBe('idle');
  });
  it('alterar parâmetros reinicia; inválidos bloqueiam o início', () => {
    const e = new Experiment(base);
    e.start();
    e.advance(0.05);
    e.setParams({ ...base, mass: 4 });
    expect(e.time).toBe(0);
    expect(e.status).toBe('idle');
    e.setParams({ ...base, mass: 0 });
    expect(e.dynamics).toBeNull();
    expect(e.state).toBeNull();
    expect(e.start()).toBe(false);
  });
});

describe('formatação', () => {
  it('pt-BR e proteção contra inválidos', () => {
    expect(formatFixed(1.5, 2)).toBe('1,50');
    expect(formatNumber(0.09)).toBe('0,09');
    expect(formatNumber(NaN)).toBe('—');
    expect(formatNumber(Infinity)).toBe('—');
    expect(formatNumber(-0)).toBe('0');
    expect(formatNumber(8.333e-5)).toBe('8,333 × 10⁻⁵');
  });
  it('aceita vírgula decimal', () => {
    expect(parseDecimal('0,25')).toBe(0.25);
    expect(parseDecimal(' 2.5 ')).toBe(2.5);
    expect(Number.isNaN(parseDecimal('abc'))).toBe(true);
    expect(Number.isNaN(parseDecimal(''))).toBe(true);
  });
});
