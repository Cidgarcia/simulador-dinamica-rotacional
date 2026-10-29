/**
 * Modelo físico do laboratório — independente de renderização.
 *
 * Hipóteses: corpos rígidos e homogêneos, eixo fixo sem atrito, força
 * tangencial de módulo constante que acompanha o ponto de aplicação, com
 * braço (raio de aplicação) constante. Condições iniciais θ0 = 0, ω0 = 0.
 *
 * Convenção de sinal: positivo = anti-horário visto de cima (+eixo).
 */

export const MAX_SIM_TIME = 20; // s simulados por execução
export const MAX_FRAME_DT = 0.1; // s reais: limita saltos (aba em segundo plano etc.)
export const PLAYBACK_RATES = [0.25, 0.5, 1];

export const DIRECTIONS = Object.freeze({ ANTI_HORARIO: 1, HORARIO: -1 });

/** Limites dos controles (unidades SI). */
export const LIMITS = Object.freeze({
  mass: { min: 0.1, max: 10, step: 0.1 },
  radius: { min: 0.05, max: 0.5, step: 0.01 },
  length: { min: 0.1, max: 1.5, step: 0.01 },
  force: { min: 0, max: 5, step: 0.05 },
});

export const GEOMETRIES = Object.freeze({
  disco: {
    id: 'disco',
    nome: 'Disco / cilindro maciço',
    dimensao: 'radius',
    eixo: 'Eixo central, perpendicular ao plano do disco',
    formulaI: 'I = ½ M R²',
    formulaB: 'b = R',
    inertia: (M, R) => (M * R * R) / 2,
    arm: (R) => R,
  },
  anel: {
    id: 'anel',
    nome: 'Anel fino',
    dimensao: 'radius',
    eixo: 'Eixo central, perpendicular ao plano do anel',
    formulaI: 'I = M R²',
    formulaB: 'b = R',
    inertia: (M, R) => M * R * R,
    arm: (R) => R,
  },
  esfera: {
    id: 'esfera',
    nome: 'Esfera maciça',
    dimensao: 'radius',
    eixo: 'Eixo ao longo de um diâmetro',
    formulaI: 'I = ⅖ M R²',
    formulaB: 'b = R',
    inertia: (M, R) => (2 * M * R * R) / 5,
    arm: (R) => R,
  },
  barra: {
    id: 'barra',
    nome: 'Barra fina',
    dimensao: 'length',
    eixo: 'Eixo perpendicular à barra, passando pelo centro',
    formulaI: 'I = (1/12) M L²',
    formulaB: 'b = L/2',
    inertia: (M, L) => (M * L * L) / 12,
    arm: (L) => L / 2,
  },
});

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/** Momento de inércia (kg·m²). `size` é R para corpos circulares e L para a barra. */
export function momentOfInertia(geometry, mass, size) {
  const g = GEOMETRIES[geometry];
  if (!g) throw new Error(`Geometria desconhecida: ${geometry}`);
  return g.inertia(mass, size);
}

/** Braço da força (m). */
export function leverArm(geometry, size) {
  const g = GEOMETRIES[geometry];
  if (!g) throw new Error(`Geometria desconhecida: ${geometry}`);
  return g.arm(size);
}

/**
 * Valida parâmetros. Retorna { valid, errors } com errors indexado pelo campo.
 * params: { geometry, mass, size, force, direction }
 */
export function validateParams(params) {
  const errors = {};
  const { geometry, mass, size, force, direction } = params ?? {};

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

  if (!isFiniteNumber(force) || force < 0) {
    errors.force = 'A força deve ser um número maior ou igual a zero.';
  } else if (force > LIMITS.force.max) {
    errors.force = `Use uma força entre 0 e ${LIMITS.force.max} N.`;
  }

  if (direction !== 1 && direction !== -1) errors.direction = 'Sentido inválido.';

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Grandezas constantes da execução: I, b, τ (assinado), α. */
export function computeDynamics({ geometry, mass, size, force, direction }) {
  const I = momentOfInertia(geometry, mass, size);
  const b = leverArm(geometry, size);
  const tau = b * force * direction;
  const alpha = tau / I;
  return { I, b, tau, alpha: alpha === 0 ? 0 : alpha };
}

/** Cinemática com aceleração constante a partir do repouso (θ acumulado, sem módulo). */
export function kinematics(alpha, t) {
  const omega = alpha * t;
  const theta = 0.5 * alpha * t * t;
  return { omega: omega === 0 ? 0 : omega, theta: theta === 0 ? 0 : theta };
}

/** Reduz θ a [0, 2π) — apenas para renderização. */
export function wrapAngle(theta) {
  const TAU = Math.PI * 2;
  const r = theta % TAU;
  return r < 0 ? r + TAU : r;
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
    this.params = { ...params };
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
    return { t: this.time, ...this.dynamics, omega, theta };
  }
}
