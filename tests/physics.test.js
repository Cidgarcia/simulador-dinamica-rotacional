import { describe, expect, it } from "vitest";
import {
  Experiment,
  MAX_FRAME_DT,
  MAX_SIM_TIME,
  boxMullerRandom,
  canvasRotationAngle,
  computeDynamics,
  computeEnergetics,
  createSeededRng,
  kinematics,
  leverArm,
  mixSeed,
  momentOfInertia,
  sampleExperimentalState,
  validateParams,
  wrapAngle,
} from "../src/physics.js";
import { formatFixed, formatNumber, formatWithSigma, parseDecimal } from "../src/format.js";

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
  it("reproduz o caso obrigatório completo em t = 2 s: Disco M=2 kg, R=0,5 m, F=1 N, d=0", () => {
    const exp = new Experiment({
      geometry: "disco",
      mass: 2,
      size: 0.5,
      axisOffset: 0,
      force: 1,
      direction: 1,
    });
    exp.start();
    exp.advance(2, 1); // avanço não limitado? Nota: advance limita por MAX_FRAME_DT (0,1 s)
    exp.reset();
    exp.start();
    for (let i = 0; i < 40; i++) exp.advance(0.05, 1); // 40 * 0,05 s = 2,00 s exatos

    const s = exp.state;
    expect(s.t).toBeCloseTo(2, 12);
    expect(s.I).toBeCloseTo(0.25, 12);
    expect(s.b).toBeCloseTo(0.5, 12);
    expect(s.tau).toBeCloseTo(0.5, 12);
    expect(s.alpha).toBeCloseTo(2, 12);
    expect(s.omega).toBeCloseTo(4, 12);
    expect(s.theta).toBeCloseTo(4, 12);
    expect(s.kineticEnergy).toBeCloseTo(2, 12);
    expect(s.work).toBeCloseTo(2, 12);
  });

  it("testa anel fino, duplicação da massa, duplicação da força e conservação de energia em t = 2 s", () => {
    // 1. Anel fino (M=2, R=0,5, F=1, d=0, t=2 s) -> I=0,5, tau=0,5, alpha=1, omega=2, theta=2, K=1 J, W=1 J
    const anel = computeDynamics({ geometry: "anel", mass: 2, size: 0.5, axisOffset: 0, force: 1, direction: 1 });
    const kinAnel = kinematics(anel.alpha, 2);
    const enAnel = computeEnergetics(anel.I, anel.tau, kinAnel.omega, kinAnel.theta);
    expect(anel).toMatchObject({ I: 0.5, tau: 0.5, alpha: 1 });
    expect(kinAnel).toEqual({ omega: 2, theta: 2 });
    expect(enAnel.kineticEnergy).toBeCloseTo(1, 12);
    expect(enAnel.work).toBeCloseTo(1, 12);

    // 2. Dobrar a massa no disco (M=4, R=0,5, F=1, d=0, t=2 s)
    // I dobra (0,50), tau permanece 0,5 N.m, alpha cai pela metade (1 rad/s²),
    // omega(2)=2 rad/s, theta(2)=2 rad, e K_rot = W = 1 J (cai pela metade no mesmo tempo t=2 s, NÃO dobra!)
    const massaDobrada = computeDynamics({ geometry: "disco", mass: 4, size: 0.5, axisOffset: 0, force: 1, direction: 1 });
    const kinM2 = kinematics(massaDobrada.alpha, 2);
    const enM2 = computeEnergetics(massaDobrada.I, massaDobrada.tau, kinM2.omega, kinM2.theta);
    expect(massaDobrada).toMatchObject({ I: 0.5, tau: 0.5, alpha: 1 });
    expect(kinM2).toEqual({ omega: 2, theta: 2 });
    expect(enM2.kineticEnergy).toBeCloseTo(1, 12);
    expect(enM2.work).toBeCloseTo(1, 12);

    // 3. Dobrar a força no disco (M=2, R=0,5, F=2, d=0, t=2 s)
    // I permanece 0,25, tau dobra (1,0 N.m), alpha dobra (4 rad/s²),
    // omega(2)=8 rad/s, theta(2)=8 rad, e K_rot = W = 8 J (quadruplica!)
    const forcaDobrada = computeDynamics({ geometry: "disco", mass: 2, size: 0.5, axisOffset: 0, force: 2, direction: 1 });
    const kinF2 = kinematics(forcaDobrada.alpha, 2);
    const enF2 = computeEnergetics(forcaDobrada.I, forcaDobrada.tau, kinF2.omega, kinF2.theta);
    expect(forcaDobrada).toMatchObject({ I: 0.25, tau: 1, alpha: 4 });
    expect(kinF2).toEqual({ omega: 8, theta: 8 });
    expect(enF2.kineticEnergy).toBeCloseTo(8, 12);
    expect(enF2.work).toBeCloseTo(8, 12);
  });

  it("verifica o Teorema de Steiner (I = I_cm + M*d²) sob mesmo torque e na bancada 3D (mesma força)", () => {
    // Steiner na bancada 3D (mesma força F=1 N na borda oposta: b = R + d = 1,0 m)
    const steiner3D = computeDynamics({
      geometry: "disco",
      mass: 2,
      size: 0.5,
      axisOffset: 0.5,
      force: 1,
      direction: 1,
    });
    expect(steiner3D.Icm).toBeCloseTo(0.25, 12);
    expect(steiner3D.Id).toBeCloseTo(0.5, 12);
    expect(steiner3D.I).toBeCloseTo(0.75, 12);
    expect(steiner3D.b).toBeCloseTo(1.0, 12);
    expect(steiner3D.tau).toBeCloseTo(1.0, 12);
    expect(steiner3D.alpha).toBeCloseTo(4 / 3, 12);
    const kin3D = kinematics(steiner3D.alpha, 2);
    const en3D = computeEnergetics(steiner3D.I, steiner3D.tau, kin3D.omega, kin3D.theta);
    expect(kin3D.omega).toBeCloseTo(8 / 3, 12);
    expect(kin3D.theta).toBeCloseTo(8 / 3, 12);
    expect(en3D.kineticEnergy).toBeCloseTo(8 / 3, 12);
    expect(en3D.work).toBeCloseTo(8 / 3, 12);

    // Steiner sob o mesmo torque do caso central (tau = 0,5 N.m -> F_eq = tau / b = 0,5 N)
    const steinerMesmoTorque = computeDynamics({
      geometry: "disco",
      mass: 2,
      size: 0.5,
      axisOffset: 0.5,
      force: 0.5,
      direction: 1,
    });
    expect(steinerMesmoTorque.I).toBeCloseTo(0.75, 12);
    expect(steinerMesmoTorque.tau).toBeCloseTo(0.5, 12);
    expect(steinerMesmoTorque.alpha).toBeCloseTo(2 / 3, 12);
    const kinEq = kinematics(steinerMesmoTorque.alpha, 2);
    const enEq = computeEnergetics(steinerMesmoTorque.I, steinerMesmoTorque.tau, kinEq.omega, kinEq.theta);
    expect(kinEq.omega).toBeCloseTo(4 / 3, 12);
    expect(kinEq.theta).toBeCloseTo(4 / 3, 12);
    expect(enEq.kineticEnergy).toBeCloseTo(2 / 3, 12);
    expect(enEq.work).toBeCloseTo(2 / 3, 12);
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
    expect(noisy.kineticEnergyMeasured).toBeCloseTo(
      0.5 * real.I * noisy.omegaMeasured * noisy.omegaMeasured,
      12
    );
    expect(noisy.sigmaKineticEnergy).toBeCloseTo(real.I * Math.abs(real.omega) * expectedSigmaOmega, 12);
  });
});

describe("Box-Muller estatístico e ruído (auditoria)", () => {
  it("1 000 000 de amostras com semente: média≈0, σ≈1, assimetria≈0, curtose≈0, regra 68-95-99,7", () => {
    const rng = createSeededRng(12345);
    const n = 1_000_000;
    const zs = new Float64Array(n);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      zs[i] = boxMullerRandom(rng);
      sum += zs[i];
    }
    const mean = sum / n;
    let s2 = 0, s3 = 0, s4 = 0, c1 = 0, c2 = 0, c3 = 0;
    for (let i = 0; i < n; i++) {
      const d = zs[i] - mean;
      s2 += d ** 2;
      s3 += d ** 3;
      s4 += d ** 4;
      const a = Math.abs(zs[i]);
      if (a < 1) c1++;
      if (a < 2) c2++;
      if (a < 3) c3++;
    }
    const sd = Math.sqrt(s2 / n);
    expect(Math.abs(mean)).toBeLessThan(0.005);
    expect(sd).toBeCloseTo(1, 2);
    expect(Math.abs(s3 / n / sd ** 3)).toBeLessThan(0.02);
    expect(Math.abs(s4 / n / sd ** 4 - 3)).toBeLessThan(0.03);
    expect(c1 / n).toBeCloseTo(0.6827, 2);
    expect(c2 / n).toBeCloseTo(0.9545, 2);
    expect(c3 / n).toBeCloseTo(0.9973, 2);
  });

  it("createSeededRng é determinístico e mixSeed separa fluxos e índices", () => {
    const a = createSeededRng(5);
    const b = createSeededRng(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(mixSeed(5, 3, 0)).not.toBe(mixSeed(5, 4, 0));
    expect(mixSeed(5, 3, 0)).not.toBe(mixSeed(5, 3, 1));
    expect(mixSeed(5, 3, 0)).toBe(mixSeed(5, 3, 0));
  });

  it("σ medido em α e θ (t = 2 s, σrel = 2 %) reproduz 2 % e não altera o estado real", () => {
    const dyn = computeDynamics({ geometry: "disco", mass: 2, size: 0.5, axisOffset: 0, force: 1, direction: 1 });
    const k = kinematics(dyn.alpha, 2);
    const real = { t: 2, ...dyn, ...k, ...computeEnergetics(dyn.I, dyn.tau, k.omega, k.theta) };
    const snapshot = JSON.stringify(real);
    const rng = createSeededRng(7);
    const m = 100_000;
    let sa = 0, sa2 = 0, st = 0, st2 = 0;
    for (let i = 0; i < m; i++) {
      const s = sampleExperimentalState(real, { enabled: true, sigmaRel: 0.02, rng });
      sa += s.alphaMeasured; sa2 += s.alphaMeasured ** 2;
      st += s.thetaMeasured; st2 += s.thetaMeasured ** 2;
    }
    const ma = sa / m, mt = st / m;
    expect((Math.sqrt(sa2 / m - ma * ma) / real.alpha) * 100).toBeCloseTo(2, 1);
    expect((Math.sqrt(st2 / m - mt * mt) / real.theta) * 100).toBeCloseTo(2, 1);
    expect(JSON.stringify(real)).toBe(snapshot);
  });

  it("em t = 0 não há ruído em θ e ω (sem piso de 0,05), mas os sorteios continuam sendo consumidos", () => {
    const dyn = computeDynamics({ geometry: "disco", mass: 2, size: 0.5, axisOffset: 0, force: 1, direction: 1 });
    const real = { t: 0, ...dyn, omega: 0, theta: 0, kineticEnergy: 0, work: 0, power: 0 };
    let calls = 0;
    const rng = () => { calls++; return 0.37; };
    const s = sampleExperimentalState(real, { enabled: true, sigmaRel: 0.05, rng });
    expect(s.thetaMeasured).toBe(0);
    expect(s.omegaMeasured).toBe(0);
    expect(s.sigmaTheta).toBe(0);
    expect(s.sigmaOmega).toBe(0);
    expect(calls).toBe(6); // 3 grandezas × 2 uniformes
  });
});

describe("formatWithSigma (algarismos significativos metrológicos)", () => {
  it("σ com 2 algarismos significativos e valor com as mesmas casas", () => {
    expect(formatWithSigma(2.0001, 0.0207)).toBe("2,000 ± 0,021");
    expect(formatWithSigma(4.0123, 0.08)).toBe("4,012 ± 0,080");
    expect(formatWithSigma(12.3456, 1.234)).toBe("12,3 ± 1,2");
  });
  it("σ muito pequena não vira ± 0,00; σ inválida cai no valor com casas fixas", () => {
    expect(formatWithSigma(1, 0.00031)).toBe("1,00000 ± 0,00031");
    expect(formatWithSigma(1.5, 0)).toBe("1,50");
    expect(formatWithSigma(1.5, NaN)).toBe("1,50");
    expect(formatWithSigma(NaN, 0.1)).toBe("—");
  });
});