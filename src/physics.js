/**
 * Modelo físico do laboratório — independente de renderização.
 *
 * Hipóteses: corpos rígidos e homogêneos, eixo fixo sem atrito (no centro de
 * massa ou deslocado paralelamente de d pelo Teorema de Steiner: I = Icm + Md²),
 * força tangencial de módulo constante aplicada na borda/extremidade oposta ao
 * deslocamento do eixo (vetor posição r de módulo b = b_cm + d a partir do eixo
 * de rotação, perpendicular a F: τ = (r × F)_eixo = ±(b_cm + d)F).
 * Condições iniciais θ0 = 0, ω0 = 0.
 *
 * Convenção de sinal: positivo = anti-horário visto de cima (+eixo).
 */

export const MAX_SIM_TIME = 20; // s simulados por execução
export const MAX_FRAME_DT = 0.1; // s reais: limita saltos (aba em segundo plano etc.)
export const PLAYBACK_RATES = [0.25, 0.5, 1];
export const NOISE_LEVELS = [0.01, 0.02, 0.05];
export const TIME_INSTRUMENT_UNCERTAINTY = 0.01; // ±0,01 s
export const DISCRETE_SAMPLE_RATES = [0.2, 0.5]; // s simulados entre coletas experimentais

export const DIRECTIONS = Object.freeze({ ANTI_HORARIO: 1, HORARIO: -1 });

/** Limites dos controles (unidades SI). */
export const LIMITS = Object.freeze({
  mass: { min: 0.1, max: 10, step: 0.1 },
  radius: { min: 0.05, max: 0.5, step: 0.01 },
  length: { min: 0.1, max: 1.5, step: 0.01 },
  axisOffset: { min: 0, max: 1, step: 0.01 },
  force: { min: 0, max: 5, step: 0.05 },
  torque: { min: 0, max: 10, step: 0.05 },
});

export const GEOMETRIES = Object.freeze({
  disco: {
    id: 'disco',
    nome: 'Disco / cilindro maciço',
    dimensao: 'radius',
    eixo: 'Eixo perpendicular ao plano do disco (paralelo ao eixo central)',
    formulaI: 'I = ½ M R² + M d²',
    formulaIcm: 'Icm = ½ M R²',
    formulaB: 'b = R + d',
    formulaBCm: 'b_cm = R',
    inertia: (M, R) => (M * R * R) / 2,
    arm: (R) => R,
  },
  anel: {
    id: 'anel',
    nome: 'Anel fino',
    dimensao: 'radius',
    eixo: 'Eixo perpendicular ao plano do anel (paralelo ao eixo central)',
    formulaI: 'I = M R² + M d²',
    formulaIcm: 'Icm = M R²',
    formulaB: 'b = R + d',
    formulaBCm: 'b_cm = R',
    inertia: (M, R) => M * R * R,
    arm: (R) => R,
  },
  esfera: {
    id: 'esfera',
    nome: 'Esfera maciça',
    dimensao: 'radius',
    eixo: 'Eixo paralelo a um diâmetro',
    formulaI: 'I = ⅖ M R² + M d²',
    formulaIcm: 'Icm = ⅖ M R²',
    formulaB: 'b = R + d',
    formulaBCm: 'b_cm = R',
    inertia: (M, R) => (2 * M * R * R) / 5,
    arm: (R) => R,
  },
  barra: {
    id: 'barra',
    nome: 'Barra fina',
    dimensao: 'length',
    eixo: 'Eixo perpendicular à barra (paralelo ao eixo central)',
    formulaI: 'I = (1/12) M L² + M d²',
    formulaIcm: 'Icm = (1/12) M L²',
    formulaB: 'b = L/2 + d',
    formulaBCm: 'b_cm = L/2',
    inertia: (M, L) => (M * L * L) / 12,
    arm: (L) => L / 2,
  },
});

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/** Momento de inércia no centro de massa Icm (kg·m²). */
export function centerOfMassInertia(geometry, mass, size) {
  const g = GEOMETRIES[geometry];
  if (!g) throw new Error(`Geometria desconhecida: ${geometry}`);
  return g.inertia(mass, size);
}

/** Termo adicional do Teorema de Steiner Md² (kg·m²). */
export function steinerTerm(mass, axisOffset = 0) {
  const val = mass * axisOffset * axisOffset;
  return val === 0 ? 0 : val;
}

/**
 * Momento de inércia total pelo Teorema dos Eixos Paralelos de Steiner:
 * I = Icm + M d² (kg·m²). `size` é R para corpos circulares e L para a barra.
 */
export function momentOfInertia(geometry, mass, size, axisOffset = 0) {
  const Icm = centerOfMassInertia(geometry, mass, size);
  return Icm + steinerTerm(mass, axisOffset);
}

/**
 * Braço da força b = |r| em relação ao eixo de rotação (m).
 * O eixo está à distância d do CM e o ponto de aplicação está na borda/extremidade
 * oposta (a b_cm do CM), logo |r| = b_cm + d.
 */
export function leverArm(geometry, size, axisOffset = 0) {
  const g = GEOMETRIES[geometry];
  if (!g) throw new Error(`Geometria desconhecida: ${geometry}`);
  return g.arm(size) + axisOffset;
}

/**
 * Valida parâmetros. Retorna { valid, errors } com errors indexado pelo campo.
 * params: { geometry, mass, size, force, direction, axisOffset?, torqueOverride? }
 */
export function validateParams(params) {
  const errors = {};
  const { geometry, mass, size, force, direction, torqueOverride } = params ?? {};
  const axisOffset = params?.axisOffset === undefined ? 0 : params.axisOffset;

  if (!GEOMETRIES[geometry]) errors.geometry = 'Selecione uma geometria válida.';

  if (!isFiniteNumber(mass) || mass <= 0) {
    errors.mass = 'A massa deve ser um número maior que zero.';
  } else if (mass < LIMITS.mass.min || mass > LIMITS.mass.max) {
    errors.mass = `Use uma massa entre ${LIMITS.mass.min} e ${LIMITS.mass.max} kg.`;
  }

  const dimKey = GEOMETRIES[geometry]?.dimensao ?? 'radius';
  const lim = LIMITS[dimKey];
  const dimName = dimKey === 'length' ? 'O comprimento' : 'O raio';
  if (!isFiniteNumber(size) || size <= 0) {
    errors.size = `${dimName} deve ser um número maior que zero.`;
  } else if (size < lim.min || size > lim.max) {
    errors.size = `${dimName} deve estar entre ${lim.min} e ${lim.max} m.`;
  }

  if (!isFiniteNumber(axisOffset) || axisOffset < 0) {
    errors.axisOffset = 'A distância d deve ser um número maior ou igual a zero.';
  } else if (axisOffset > LIMITS.axisOffset.max) {
    errors.axisOffset = `Use uma distância d entre 0 e ${LIMITS.axisOffset.max} m.`;
  }

  if (torqueOverride !== undefined && torqueOverride !== null) {
    if (!isFiniteNumber(torqueOverride) || torqueOverride < 0) {
      errors.torque = 'O módulo do torque deve ser um número maior ou igual a zero.';
    } else if (torqueOverride > LIMITS.torque.max) {
      errors.torque = `Use um torque entre 0 e ${LIMITS.torque.max} N·m.`;
    }
  } else if (!isFiniteNumber(force) || force < 0) {
    errors.force = 'A força deve ser um número maior ou igual a zero.';
  } else if (force > LIMITS.force.max) {
    errors.force = `Use uma força entre 0 e ${LIMITS.force.max} N.`;
  }

  if (direction !== 1 && direction !== -1) errors.direction = 'Sentido inválido.';

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Grandezas constantes da execução:
 * Icm, Id (Md²), I = Icm + Md², bCm, b = bCm + d, τ (assinado no eixo de rotação), α = τ/I.
 */
export function computeDynamics({
  geometry,
  mass,
  size,
  force = 0,
  direction,
  axisOffset = 0,
  torqueOverride = null,
}) {
  const g = GEOMETRIES[geometry];
  if (!g) throw new Error(`Geometria desconhecida: ${geometry}`);
  const d = axisOffset === 0 ? 0 : axisOffset;
  const Icm = centerOfMassInertia(geometry, mass, size);
  const Id = steinerTerm(mass, d);
  const I = Icm + Id;
  const bCm = g.arm(size);
  const b = leverArm(geometry, size, d);
  const rawTau =
    torqueOverride !== null && torqueOverride !== undefined
      ? torqueOverride * direction
      : b * force * direction;
  const tau = rawTau === 0 ? 0 : rawTau;
  const alpha = tau / I;
  return {
    I,
    Icm,
    Id,
    axisOffset: d,
    bCm,
    b,
    tau,
    alpha: alpha === 0 ? 0 : alpha,
  };
}

/** Cinemática com aceleração constante a partir do repouso (θ acumulado, sem módulo). */
export function kinematics(alpha, t) {
  const omega = alpha * t;
  const theta = 0.5 * alpha * t * t;
  return { omega: omega === 0 ? 0 : omega, theta: theta === 0 ? 0 : theta };
}

/**
 * Grandezas energéticas rotacionais instantâneas:
 * - Energia cinética rotacional: K_rot = ½ I ω² (J)
 * - Trabalho do torque: W = τ Δθ (J)
 * - Potência instantânea: P = τ ω (W)
 */
export function computeEnergetics(I, tau, omega, theta) {
  const kRotRaw = 0.5 * I * omega * omega;
  const workRaw = tau * theta;
  const powerRaw = tau * omega;
  return {
    kineticEnergy: kRotRaw === 0 ? 0 : kRotRaw,
    work: workRaw === 0 ? 0 : workRaw,
    power: powerRaw === 0 ? 0 : powerRaw,
  };
}

/**
 * Gerador de variável aleatória normal padrão Z ~ N(0, 1) pela Transformada de Box-Muller:
 * Z = sqrt(-2 ln(u1)) * cos(2π u2)
 */
export function boxMullerRandom(rng = Math.random) {
  let u1 = 0;
  let u2 = 0;
  while (u1 <= Number.EPSILON) u1 = rng();
  u2 = rng();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z === 0 ? 0 : z;
}

/**
 * Aplica ruído gaussiano experimental às grandezas cinemáticas reais sem afetar o estado físico 3D:
 * - ω_medido(t) = ω_real(t) + Z_ω · (σ_rel · max(|ω_real(t)|, 0.05))
 * - θ_medido(t) = θ_real(t) + Z_θ · (σ_rel · max(|θ_real(t)|, 0.05))
 * - α_medido(t) = α_real · (1 + Z_α · σ_rel)
 */
export function sampleExperimentalState(realState, { enabled = false, sigmaRel = 0.02, rng = Math.random } = {}) {
  if (!realState) return null;
  const { I, tau, alpha, omega, theta } = realState;
  const sigma = enabled && isFiniteNumber(sigmaRel) && sigmaRel > 0 ? sigmaRel : 0;

  const sigmaOmega = sigma * Math.max(Math.abs(omega), 0.05);
  const sigmaTheta = sigma * Math.max(Math.abs(theta), 0.05);
  const sigmaAlpha = Math.abs(alpha) * sigma;
  const energetics = computeEnergetics(I, tau, omega, theta);

  if (!enabled || sigma === 0) {
    return {
      ...realState,
      omegaMeasured: omega,
      thetaMeasured: theta,
      alphaMeasured: alpha,
      kineticEnergyMeasured: energetics.kineticEnergy,
      workMeasured: energetics.work,
      sigmaOmega: 0,
      sigmaTheta: 0,
      sigmaAlpha: 0,
      sigmaKineticEnergy: 0,
      sigmaWork: 0,
      sigmaTime: 0,
      ...energetics,
    };
  }

  const zOmega = boxMullerRandom(rng);
  const zTheta = boxMullerRandom(rng);
  const zAlpha = boxMullerRandom(rng);

  const omegaMeasured = omega + zOmega * sigmaOmega;
  const thetaMeasured = theta + zTheta * sigmaTheta;
  const alphaMeasured = alpha * (1 + zAlpha * sigma);

  const kRotMedRaw = 0.5 * I * omegaMeasured * omegaMeasured;
  const workMedRaw = tau * thetaMeasured;
  const sigmaKineticEnergy = I * Math.abs(omega) * sigmaOmega;
  const sigmaWork = Math.abs(tau) * sigmaTheta;

  return {
    ...realState,
    omegaMeasured: omegaMeasured === 0 ? 0 : omegaMeasured,
    thetaMeasured: thetaMeasured === 0 ? 0 : thetaMeasured,
    alphaMeasured: alphaMeasured === 0 ? 0 : alphaMeasured,
    kineticEnergyMeasured: kRotMedRaw === 0 ? 0 : kRotMedRaw,
    workMeasured: workMedRaw === 0 ? 0 : workMedRaw,
    sigmaOmega,
    sigmaTheta,
    sigmaAlpha,
    sigmaKineticEnergy: sigmaKineticEnergy === 0 ? 0 : sigmaKineticEnergy,
    sigmaWork: sigmaWork === 0 ? 0 : sigmaWork,
    sigmaTime: TIME_INSTRUMENT_UNCERTAINTY,
    ...energetics,
  };
}

/** Reduz θ a [0, 2π) — apenas para renderização. */
export function wrapAngle(theta) {
  const TAU = Math.PI * 2;
  const r = theta % TAU;
  return r < 0 ? r + TAU : r;
}

/**
 * Converte o ângulo físico θ (positivo = anti-horário visto do lado + do eixo)
 * para o ângulo de rotação do Canvas 2D (onde o eixo +Y aponta para baixo e
 * ctx.rotate positivo gira no sentido horário).
 */
export function canvasRotationAngle(theta) {
  if (!isFiniteNumber(theta)) return 0;
  const wrapped = wrapAngle(theta);
  return wrapped === 0 ? 0 : -wrapped;
}

/**
 * Estado de uma execução do experimento. O tempo simulado avança apenas por
 * `advance(realDt, rate)`, independentemente da taxa de quadros.
 * status: 'idle' | 'running' | 'paused' | 'finished'
 */
export class Experiment {
  constructor(params) {
    this.setParams(params);
  }

  setParams(params) {
    this.params = { axisOffset: 0, ...params };
    this.validation = validateParams(this.params);
    this.dynamics = this.validation.valid ? computeDynamics(this.params) : null;
    this.reset();
  }

  reset() {
    this.time = 0;
    this.status = 'idle';
  }

  get canStart() {
    return this.dynamics !== null && (this.status === 'idle' || this.status === 'paused');
  }

  start() {
    if (!this.canStart) return false;
    this.status = 'running';
    return true;
  }

  pause() {
    if (this.status !== 'running') return false;
    this.status = 'paused';
    return true;
  }

  /** Avança o tempo simulado. Retorna o incremento aplicado (s simulados). */
  advance(realDt, rate = 1) {
    if (this.status !== 'running') return 0;
    if (!isFiniteNumber(realDt) || realDt <= 0) return 0;
    if (!PLAYBACK_RATES.includes(rate)) rate = 1;
    const dt = Math.min(realDt, MAX_FRAME_DT) * rate;
    const before = this.time;
    this.time = Math.min(this.time + dt, MAX_SIM_TIME);
    if (this.time >= MAX_SIM_TIME) this.status = 'finished';
    return this.time - before;
  }

  get state() {
    if (!this.dynamics) return null;
    const { omega, theta } = kinematics(this.dynamics.alpha, this.time);
    const energetics = computeEnergetics(this.dynamics.I, this.dynamics.tau, omega, theta);
    return { t: this.time, ...this.dynamics, omega, theta, ...energetics };
  }
}
