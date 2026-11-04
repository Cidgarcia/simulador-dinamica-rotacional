import { describe, expect, it } from 'vitest';
import {
  Experiment,
  MAX_FRAME_DT,
  MAX_SIM_TIME,
  canvasRotationAngle,
  centerOfMassInertia,
  computeDynamics,
  kinematics,
  leverArm,
  momentOfInertia,
  steinerTerm,
  validateParams,
  wrapAngle,
} from '../src/physics.js';
import { formatFixed, formatNumber, parseDecimal } from '../src/format.js';

const base = { geometry: 'disco', mass: 2, size: 0.3, axisOffset: 0, force: 0.3, direction: 1 };

describe('momento de inércia, Teorema de Steiner e braço', () => {
  it('d = 0 reproduz exatamente as fórmulas no centro de massa (I = Icm e b = b_cm)', () => {
    expect(momentOfInertia('disco', 2, 0.3, 0)).toBeCloseTo(0.09, 12);
    expect(momentOfInertia('anel', 2, 0.3, 0)).toBeCloseTo(0.18, 12);
    expect(momentOfInertia('esfera', 2, 0.3, 0)).toBeCloseTo(0.072, 12);
    expect(momentOfInertia('barra', 3, 1.2, 0)).toBeCloseTo(0.36, 12);
    expect(leverArm('disco', 0.3, 0)).toBeCloseTo(0.3, 12);
    expect(leverArm('anel', 0.3, 0)).toBeCloseTo(0.3, 12);
    expect(leverArm('esfera', 0.3, 0)).toBeCloseTo(0.3, 12);
    expect(leverArm('barra', 1.2, 0)).toBeCloseTo(0.6, 12);
  });

  it('calcula I = Icm + Md² para disco, anel, esfera e barra', () => {
    // Disco: M=2, R=0.5, d=0.5 -> Icm = 0.25, Md² = 0.50, I = 0.75
    expect(centerOfMassInertia('disco', 2, 0.5)).toBeCloseTo(0.25, 12);
    expect(steinerTerm(2, 0.5)).toBeCloseTo(0.5, 12);
    expect(momentOfInertia('disco', 2, 0.5, 0.5)).toBeCloseTo(0.75, 12);

    // Anel: M=2, R=0.5, d=0.5 -> Icm = 0.50, Md² = 0.50, I = 1.00
    expect(momentOfInertia('anel', 2, 0.5, 0.5)).toBeCloseTo(1.0, 12);

    // Esfera: M=2, R=0.5, d=0.5 -> Icm = 0.20, Md² = 0.50, I = 0.70
    expect(momentOfInertia('esfera', 2, 0.5, 0.5)).toBeCloseTo(0.7, 12);

    // Barra: M=3, L=1.2, d=0.6 (eixo na extremidade) -> Icm = 0.36, Md² = 1.08, I = 1.44 = (1/3)ML²
    expect(momentOfInertia('barra', 3, 1.2, 0.6)).toBeCloseTo(1.44, 12);
  });

  it('dobrar d quadruplica o termo adicional Md², mas não necessariamente o I total', () => {
    const M = 2;
    const R = 0.5;
    const d1 = 0.25;
    const d2 = 0.5;
    const term1 = steinerTerm(M, d1); // 2 * 0.0625 = 0.125
    const term2 = steinerTerm(M, d2); // 2 * 0.25 = 0.5
    expect(term2).toBeCloseTo(4 * term1, 12);

    const I1 = momentOfInertia('disco', M, R, d1); // 0.25 + 0.125 = 0.375
    const I2 = momentOfInertia('disco', M, R, d2); // 0.25 + 0.5 = 0.75
    expect(I2).not.toBeCloseTo(4 * I1, 6);
    expect(I2).toBeCloseTo(0.75, 12);
  });

  it('atualiza o braço b = b_cm + d e o torque τ = (r × F)_eixo ao deslocar o eixo', () => {
    const central = computeDynamics({ geometry: 'disco', mass: 2, size: 0.5, axisOffset: 0, force: 1, direction: 1 });
    const displaced = computeDynamics({ geometry: 'disco', mass: 2, size: 0.5, axisOffset: 0.5, force: 1, direction: 1 });
    expect(central.b).toBeCloseTo(0.5, 12);
    expect(central.tau).toBeCloseTo(0.5, 12);
    // Com d = 0,5 m, o ponto de aplicação na borda oposta fica a b = R + d = 1,0 m do eixo
    expect(displaced.b).toBeCloseTo(1.0, 12);
    expect(displaced.tau).toBeCloseTo(1.0, 12);
    expect(displaced.Icm).toBeCloseTo(0.25, 12);
    expect(displaced.Id).toBeCloseTo(0.5, 12);
    expect(displaced.I).toBeCloseTo(0.75, 12);
    expect(displaced.alpha).toBeCloseTo(1.0 / 0.75, 12);
  });
});

describe('dinâmica e comparativo de Steiner', () => {
  it('reproduz o caso de referência com d = 0: M=2 kg, R=0,5 m, F=1 N', () => {
    const disco = computeDynamics({ geometry: 'disco', mass: 2, size: 0.5, force: 1, direction: 1 });
    const anel = computeDynamics({ geometry: 'anel', mass: 2, size: 0.5, force: 1, direction: 1 });
    expect(disco).toMatchObject({ I: 0.25, b: 0.5, tau: 0.5, alpha: 2 });
    expect(anel).toMatchObject({ I: 0.5, b: 0.5, tau: 0.5, alpha: 1 });
    expect(kinematics(disco.alpha, 2)).toEqual({ omega: 4, theta: 4 });
    expect(kinematics(anel.alpha, 2)).toEqual({ omega: 2, theta: 2 });
  });

  it('sob torque fixo de 0,5 N·m (M=2 kg, R=0,5 m): α central = 2 rad/s² e α deslocado (d=0,5 m) ≈ 0,6667 rad/s²', () => {
    const central = computeDynamics({
      geometry: 'disco',
      mass: 2,
      size: 0.5,
      axisOffset: 0,
      torqueOverride: 0.5,
      direction: 1,
    });
    const displaced = computeDynamics({
      geometry: 'disco',
      mass: 2,
      size: 0.5,
      axisOffset: 0.5,
      torqueOverride: 0.5,
      direction: 1,
    });
    expect(central.I).toBeCloseTo(0.25, 12);
    expect(central.tau).toBeCloseTo(0.5, 12);
    expect(central.alpha).toBeCloseTo(2, 12);

    expect(displaced.Icm).toBeCloseTo(0.25, 12);
    expect(displaced.Id).toBeCloseTo(0.5, 12);
    expect(displaced.I).toBeCloseTo(0.75, 12);
    expect(displaced.tau).toBeCloseTo(0.5, 12);
    expect(displaced.alpha).toBeCloseTo(2 / 3, 12);
    expect(displaced.alpha).toBeCloseTo(0.6667, 4);

    // No sentido horário (direction = -1)
    const displacedCW = computeDynamics({
      geometry: 'disco',
      mass: 2,
      size: 0.5,
      axisOffset: 0.5,
      torqueOverride: 0.5,
      direction: -1,
    });
    expect(displacedCW.tau).toBeCloseTo(-0.5, 12);
    expect(displacedCW.alpha).toBeCloseTo(-2 / 3, 12);
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
  it('dobrar a força dobra α; dobrar a massa reduz α à metade; dobrar R quadruplica I, dobra τ e reduz α à metade', () => {
    const r1 = computeDynamics({ geometry: 'disco', mass: 2, size: 0.25, force: 1, direction: 1 });
    const f2 = computeDynamics({ geometry: 'disco', mass: 2, size: 0.25, force: 2, direction: 1 });
    const m2 = computeDynamics({ geometry: 'disco', mass: 4, size: 0.25, force: 1, direction: 1 });
    const r2 = computeDynamics({ geometry: 'disco', mass: 2, size: 0.5, force: 1, direction: 1 });
    expect(f2.alpha).toBeCloseTo(2 * r1.alpha, 12);
    expect(m2.alpha).toBeCloseTo(0.5 * r1.alpha, 12);
    expect(r2.I).toBeCloseTo(4 * r1.I, 12);
    expect(r2.tau).toBeCloseTo(2 * r1.tau, 12);
    expect(r2.alpha).toBeCloseTo(0.5 * r1.alpha, 12);
  });
  it('canvasRotationAngle mapeia θ > 0 para rotação anti-horária no Canvas 2D (+Y para baixo)', () => {
    expect(Object.is(canvasRotationAngle(0), 0)).toBe(true);
    expect(Object.is(canvasRotationAngle(NaN), 0)).toBe(true);
    const thetaPos = Math.PI / 4;
    const phiPos = canvasRotationAngle(thetaPos);
    expect(1 * Math.sin(phiPos)).toBeLessThan(0);

    const thetaNeg = -Math.PI / 4;
    const phiNeg = canvasRotationAngle(thetaNeg);
    expect(1 * Math.sin(phiNeg)).toBeGreaterThan(0);
  });
});

describe('validação', () => {
  it('aceita parâmetros válidos, inclusive força zero e d = 0 ou d > 0', () => {
    expect(validateParams(base).valid).toBe(true);
    expect(validateParams({ ...base, force: 0 }).valid).toBe(true);
    expect(validateParams({ ...base, axisOffset: 0.5 }).valid).toBe(true);
    expect(validateParams({ ...base, axisOffset: 1 }).valid).toBe(true);
  });
  it('rejeita massa, dimensão, distância d e força/torque inválidos', () => {
    expect(validateParams({ ...base, mass: 0 }).errors.mass).toBeTruthy();
    expect(validateParams({ ...base, mass: -1 }).errors.mass).toBeTruthy();
    expect(validateParams({ ...base, size: 0 }).errors.size).toBeTruthy();
    expect(validateParams({ ...base, size: NaN }).errors.size).toBeTruthy();
    expect(validateParams({ ...base, axisOffset: -0.01 }).errors.axisOffset).toBeTruthy();
    expect(validateParams({ ...base, axisOffset: 1.5 }).errors.axisOffset).toBeTruthy();
    expect(validateParams({ ...base, axisOffset: NaN }).errors.axisOffset).toBeTruthy();
    expect(validateParams({ ...base, force: -0.1 }).errors.force).toBeTruthy();
    expect(validateParams({ ...base, torqueOverride: -1 }).errors.torque).toBeTruthy();
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
  it('velocidade de reprodução escala o tempo simulado sem adulterar resultados no mesmo tempo t', () => {
    const slow = new Experiment(base);
    const fast = new Experiment(base);
    slow.start();
    fast.start();
    for (let i = 0; i < 240; i++) slow.advance(1 / 60, 0.25);
    for (let i = 0; i < 60; i++) fast.advance(1 / 60, 1);
    expect(slow.time).toBeCloseTo(1, 9);
    expect(fast.time).toBeCloseTo(1, 9);
    expect(slow.state.omega).toBeCloseTo(fast.state.omega, 9);
    expect(slow.state.theta).toBeCloseTo(fast.state.theta, 9);
  });
  it('comparativo disco × anel mantém mesmo relógio, mesmo torque e razão 2:1 em α, ω e θ', () => {
    const disk = new Experiment({ geometry: 'disco', mass: 2, size: 0.5, force: 1, direction: 1 });
    const ring = new Experiment({ geometry: 'anel', mass: 2, size: 0.5, force: 1, direction: 1 });
    disk.start();
    ring.start();
    for (let i = 0; i < 40; i++) {
      disk.advance(0.05, 1);
      ring.advance(0.05, 1);
    }
    expect(disk.time).toBeCloseTo(2, 9);
    expect(ring.time).toBeCloseTo(2, 9);
    expect(disk.state.tau).toBeCloseTo(ring.state.tau, 12);
    expect(disk.state.alpha).toBeCloseTo(2 * ring.state.alpha, 12);
    expect(disk.state.omega).toBeCloseTo(4, 9);
    expect(ring.state.omega).toBeCloseTo(2, 9);
    expect(disk.state.theta).toBeCloseTo(4, 9);
    expect(ring.state.theta).toBeCloseTo(2, 9);
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
    expect(e.state.theta).toBeCloseTo(0.5 * 1 * 400, 6);
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
