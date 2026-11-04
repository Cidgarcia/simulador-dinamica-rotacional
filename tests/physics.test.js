import { describe, expect, it } from "vitest";
import {
  Experiment,
  MAX_FRAME_DT,
  MAX_SIM_TIME,
  boxMullerRandom,
  canvasRotationAngle,
  computeDynamics,
  computeEnergetics,
  kinematics,
  leverArm,
  momentOfInertia,
  sampleExperimentalState,
  validateParams,
  wrapAngle,
} from "../src/physics.js";
import { formatFixed, formatNumber, parseDecimal } from "../src/format.js";

const base = {
  geometry: "disco",
  mass: 2,
  size: 0.3,
  force: 0.3,
  direction: 1,
};

describe("momento de inércia e braço", () => {
  it("usa as fórmulas corretas", () => {
    expect(momentOfInertia("disco", 2, 0.3)).toBeCloseTo(0.09, 12);
    expect(momentOfInertia("anel", 2, 0.3)).toBeCloseTo(0.18, 12);
    expect(momentOfInertia("esfera", 2, 0.3)).toBeCloseTo(0.072, 12);
    expect(momentOfInertia("barra", 3, 1.2)).toBeCloseTo(0.36, 12);
  });
  it("b = R para corpos circulares e L/2 para a barra", () => {
    expect(leverArm("disco", 0.3)).toBe(0.3);
    expect(leverArm("anel", 0.3)).toBe(0.3);
    expect(leverArm("esfera", 0.3)).toBe(0.3);
    expect(leverArm("barra", 1.2)).toBeCloseTo(0.6, 12);
  });
});

describe("dinâmica", () => {
  it("reproduz o caso de referência: M=2 kg, R=0,5 m, F=1 N", () => {
    const disco = computeDynamics({
      geometry: "disco",
      mass: 2,
      size: 0.5,
      force: 1,
      direction: 1,
    });
    const anel = computeDynamics({
      geometry: "anel",
      mass: 2,
      size: 0.5,
      force: 1,
      direction: 1,
    });
    expect(disco).toMatchObject({ I: 0.25, b: 0.5, tau: 0.5, alpha: 2 });
    expect(anel).toMatchObject({ I: 0.5, b: 0.5, tau: 0.5, alpha: 1 });
    expect(kinematics(disco.alpha, 2)).toEqual({ omega: 4, theta: 4 });
    expect(kinematics(anel.alpha, 2)).toEqual({ omega: 2, theta: 2 });
  });

  it("τ assinado e α = τ/I", () => {
    const d = computeDynamics(base);
    expect(d.tau).toBeCloseTo(0.09, 12);
    expect(d.alpha).toBeCloseTo(1, 12);
    const h = computeDynamics({ ...base, direction: -1 });
    expect(h.tau).toBeCloseTo(-0.09, 12);
    expect(h.alpha).toBeCloseTo(-1, 12);
  });
  it("força zero produz α = 0 (sem -0)", () => {
    const d = computeDynamics({ ...base, force: 0, direction: -1 });
    expect(Object.is(d.alpha, 0)).toBe(true);
  });
  it("ω = αt e θ = αt²/2", () => {
    expect(kinematics(2, 3)).toEqual({ omega: 6, theta: 9 });
    expect(kinematics(-2, 3)).toEqual({ omega: -6, theta: -9 });
  });
  it("wrapAngle reduz a [0, 2π)", () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(2 * Math.PI + 1)).toBeCloseTo(1, 12);
    expect(wrapAngle(-1)).toBeCloseTo(2 * Math.PI - 1, 12);
  });
  it("dobrar a força dobra α; dobrar a massa reduz α à metade; dobrar R quadruplica I, dobra τ e reduz α à metade", () => {
    const r1 = computeDynamics({
      geometry: "disco",
      mass: 2,
      size: 0.25,
      force: 1,
      direction: 1,
    });
    const f2 = computeDynamics({
      geometry: "disco",
      mass: 2,
      size: 0.25,
      force: 2,
      direction: 1,
    });
    const m2 = computeDynamics({
      geometry: "disco",
      mass: 4,
      size: 0.25,
      force: 1,
      direction: 1,
    });
    const r2 = computeDynamics({
      geometry: "disco",
      mass: 2,
      size: 0.5,
      force: 1,
      direction: 1,
    });
    expect(f2.alpha).toBeCloseTo(2 * r1.alpha, 12);
    expect(m2.alpha).toBeCloseTo(0.5 * r1.alpha, 12);
    expect(r2.I).toBeCloseTo(4 * r1.I, 12);
    expect(r2.tau).toBeCloseTo(2 * r1.tau, 12);
    expect(r2.alpha).toBeCloseTo(0.5 * r1.alpha, 12);
  });
  it("canvasRotationAngle mapeia θ > 0 para rotação anti-horária no Canvas 2D (+Y para baixo)", () => {
    expect(Object.is(canvasRotationAngle(0), 0)).toBe(true);
    expect(Object.is(canvasRotationAngle(NaN), 0)).toBe(true);
    // Ponto de referência no topo do círculo no Canvas 2D: (0, -R)
    // Após ctx.rotate(phi), x' = -y * sin(phi) = R * sin(phi).
    // Para giro anti-horário (para a esquerda no topo), x' deve ser negativo (x' < 0) quando θ ∈ (0, π).
    const thetaPos = Math.PI / 4; // +45° (anti-horário)
    const phiPos = canvasRotationAngle(thetaPos);
    const xAfterPos = 1 * Math.sin(phiPos);
    expect(xAfterPos).toBeLessThan(0);

    // Para giro horário (θ = -45°), o topo (0, -R) deve mover-se para a direita (x' > 0).
    const thetaNeg = -Math.PI / 4;
    const phiNeg = canvasRotationAngle(thetaNeg);
    const xAfterNeg = 1 * Math.sin(phiNeg);
    expect(xAfterNeg).toBeGreaterThan(0);
  });
});

describe("validação", () => {
  it("aceita parâmetros válidos, inclusive força zero", () => {
    expect(validateParams(base).valid).toBe(true);
    expect(validateParams({ ...base, force: 0 }).valid).toBe(true);
  });
  it("rejeita massa e dimensão não positivas ou inválidas", () => {
    expect(validateParams({ ...base, mass: 0 }).errors.mass).toBeTruthy();
    expect(validateParams({ ...base, mass: -1 }).errors.mass).toBeTruthy();
    expect(validateParams({ ...base, size: 0 }).errors.size).toBeTruthy();
    expect(validateParams({ ...base, size: NaN }).errors.size).toBeTruthy();
    expect(validateParams({ ...base, force: -0.1 }).errors.force).toBeTruthy();
    expect(
      validateParams({ ...base, geometry: "cubo" }).errors.geometry,
    ).toBeTruthy();
  });
});

describe("Experiment", () => {
  it("tempo independente da taxa de quadros", () => {
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
  it("velocidade de reprodução escala o tempo simulado sem adulterar resultados no mesmo tempo t", () => {
    const slow = new Experiment(base);
    const fast = new Experiment(base);
    slow.start();
    fast.start();
    // 240 quadros de 1/60 s a 0,25x = 1,0 s simulado
    for (let i = 0; i < 240; i++) slow.advance(1 / 60, 0.25);
    // 60 quadros de 1/60 s a 1,0x = 1,0 s simulado
    for (let i = 0; i < 60; i++) fast.advance(1 / 60, 1);
    expect(slow.time).toBeCloseTo(1, 9);
    expect(fast.time).toBeCloseTo(1, 9);
    expect(slow.state.omega).toBeCloseTo(fast.state.omega, 9);
    expect(slow.state.theta).toBeCloseTo(fast.state.theta, 9);
  });
  it("comparativo disco × anel mantém mesmo relógio, mesmo torque e razão 2:1 em α, ω e θ", () => {
    const disk = new Experiment({
      geometry: "disco",
      mass: 2,
      size: 0.5,
      force: 1,
      direction: 1,
    });
    const ring = new Experiment({
      geometry: "anel",
      mass: 2,
      size: 0.5,
      force: 1,
      direction: 1,
    });
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
  it("limita saltos de quadro e encerra em 20 s", () => {
    const e = new Experiment(base);
    e.start();
    e.advance(5, 1);
    expect(e.time).toBeCloseTo(MAX_FRAME_DT, 12);
    for (let i = 0; i < 1000; i++) e.advance(0.05, 1);
    expect(e.time).toBe(MAX_SIM_TIME);
    expect(e.status).toBe("finished");
    expect(e.start()).toBe(false);
    expect(e.state.theta).toBeCloseTo(0.5 * 1 * 400, 6); // θ acumulado, sem módulo
  });
  it("pausa, continua e reinicia", () => {
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
    expect(e.status).toBe("idle");
  });
  it("alterar parâmetros reinicia; inválidos bloqueiam o início", () => {
    const e = new Experiment(base);
    e.start();
    e.advance(0.05);
    e.setParams({ ...base, mass: 4 });
    expect(e.time).toBe(0);
    expect(e.status).toBe("idle");
    e.setParams({ ...base, mass: 0 });
    expect(e.dynamics).toBeNull();
    expect(e.state).toBeNull();
    expect(e.start()).toBe(false);
  });
});

describe("formatação", () => {
  it("pt-BR e proteção contra inválidos", () => {
    expect(formatFixed(1.5, 2)).toBe("1,50");
    expect(formatNumber(0.09)).toBe("0,09");
    expect(formatNumber(NaN)).toBe("—");
    expect(formatNumber(Infinity)).toBe("—");
    expect(formatNumber(-0)).toBe("0");
    expect(formatNumber(8.333e-5)).toBe("8,333 × 10⁻⁵");
  });
  it("aceita vírgula decimal", () => {
    expect(parseDecimal("0,25")).toBe(0.25);
    expect(parseDecimal(" 2.5 ")).toBe(2.5);
    expect(Number.isNaN(parseDecimal("abc"))).toBe(true);
    expect(Number.isNaN(parseDecimal(""))).toBe(true);
  });
});

describe("conservação de energia e incerteza experimental (Box-Muller)", () => {
  it("verifica o Teorema do Trabalho-Energia (K_rot = 1/2 I ω² = W = τ θ) e potência P = τ ω", () => {
    const e = new Experiment({
      geometry: "disco",
      mass: 2,
      size: 0.5,
      axisOffset: 0.5,
      force: 1,
      direction: 1,
    });
    e.start();
    for (let i = 0; i < 60; i++) e.advance(0.05, 1); // 3,0 s
    const s = e.state;
    expect(s.kineticEnergy).toBeCloseTo(0.5 * s.I * s.omega * s.omega, 12);
    expect(s.work).toBeCloseTo(s.tau * s.theta, 12);
    expect(s.kineticEnergy).toBeCloseTo(s.work, 10);
    expect(s.power).toBeCloseTo(s.tau * s.omega, 12);

    e.reset();
    expect(e.state.kineticEnergy).toBe(0);
    expect(e.state.work).toBe(0);
    expect(e.state.power).toBe(0);
  });

  it("gera distribuição normal padrão por Box-Muller e aplica ruído experimental apenas nas leituras medidas", () => {
    // u1 = e^(-1/2), u2 = 1 -> Z = sqrt(-2 * (-1/2)) * cos(2π) = 1
    const zDet = boxMullerRandom(() => Math.exp(-0.5));
    expect(Number.isFinite(zDet)).toBe(true);

    const e = new Experiment(base);
    e.start();
    e.advance(0.1, 1);
    const real = e.state;

    // Sem ruído: leituras medidas coincidem exatamente com o estado teórico
    const clean = sampleExperimentalState(real, { enabled: false, sigmaRel: 0.02 });
    expect(clean.omegaMeasured).toBe(real.omega);
    expect(clean.thetaMeasured).toBe(real.theta);
    expect(clean.alphaMeasured).toBe(real.alpha);
    expect(clean.sigmaOmega).toBe(0);

    // Com ruído determinístico (Z = +1 usando u1 = exp(-0.5), u2 = 0):
    let call = 0;
    const fakeRng = () => (call++ % 2 === 0 ? Math.exp(-0.5) : 0);
    const noisy = sampleExperimentalState(real, {
      enabled: true,
      sigmaRel: 0.02,
      rng: fakeRng,
    });
    expect(noisy.omega).toBe(real.omega); // estado físico real intacto
    expect(noisy.theta).toBe(real.theta);
    const expectedSigmaOmega = 0.02 * Math.max(Math.abs(real.omega), 0.05);
    const expectedSigmaTheta = 0.02 * Math.max(Math.abs(real.theta), 0.05);
    expect(noisy.omegaMeasured).toBeCloseTo(real.omega + expectedSigmaOmega, 12);
    expect(noisy.thetaMeasured).toBeCloseTo(real.theta + expectedSigmaTheta, 12);
    expect(noisy.alphaMeasured).toBeCloseTo(real.alpha * (1 + 0.02), 12);
  });
});
