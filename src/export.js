import {
  GEOMETRIES,
  computeDynamics,
  computeEnergetics,
  kinematics,
  sampleExperimentalState,
} from './physics.js';

/**
 * Formata uma célula de CSV respeitando o separador decimal ('.' ou ',')
 * e o separador de colunas (';' ou ',').
 */
export function formatCsvCell(value, { decimalSeparator = '.', columnSeparator = ';' } = {}) {
  let text;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const normalized = Object.is(value, -0) ? 0 : Number(value.toFixed(6));
    text = String(normalized);
    if (decimalSeparator === ',') {
      text = text.replace('.', ',');
    }
  } else {
    text = String(value ?? '');
  }
  const needsQuotes =
    text.includes(columnSeparator) ||
    text.includes('"') ||
    text.includes('\r') ||
    text.includes('\n');
  return needsQuotes ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Gera amostras discretas exatamente nos instantes múltiplos de `sampleDt` (0, Δt, 2Δt, ..., <= upToTime),
 * eliminando desvios acumulados pela taxa de quadros (FPS) do navegador.
 */
export function generateDiscreteSamples({
  dynamics,
  upToTime,
  maxTime = 0,
  sampleDt = 0.2,
  noiseEnabled = false,
  noiseSigmaRel = 0.02,
  noiseDraws = [],
  rng = Math.random,
}) {
  const targetTime = upToTime ?? maxTime;
  if (!dynamics || !Number.isFinite(targetTime) || targetTime < 0) return [];
  const dt = Number.isFinite(sampleDt) && sampleDt > 0 ? sampleDt : 0.2;
  const steps = Math.floor((targetTime + 1e-9) / dt);
  const result = [];

  for (let k = 0; k <= steps; k++) {
    const t = Number((k * dt).toFixed(6));
    const { omega, theta } = kinematics(dynamics.alpha, t);
    const energetics = computeEnergetics(dynamics.I, dynamics.tau, omega, theta);
    const realState = { t, ...dynamics, omega, theta, ...energetics };

    let draw = noiseDraws[k];
    if (!draw) {
      let call = 0;
      const drawValues = [];
      const capturingRng = () => {
        const v = rng();
        drawValues.push(v);
        return v;
      };
      sampleExperimentalState(realState, {
        enabled: true,
        sigmaRel: 0.02,
        rng: capturingRng,
      });
      draw = drawValues;
      noiseDraws[k] = draw;
    }

    let idx = 0;
    const replayRng = () => draw[idx++ % draw.length] ?? 0.5;
    const measured = sampleExperimentalState(realState, {
      enabled: noiseEnabled,
      sigmaRel: noiseSigmaRel,
      rng: replayRng,
    });

    result.push({
      t_s: t,
      theta_teorico_rad: theta,
      theta_medido_rad: noiseEnabled ? measured.thetaMeasured : theta,
      omega_teorico_rads: omega,
      omega_medido_rads: noiseEnabled ? measured.omegaMeasured : omega,
      alfa_teorico_rads2: dynamics.alpha,
      alfa_medido_rads2: noiseEnabled ? measured.alphaMeasured : dynamics.alpha,
      energia_cinetica_J: energetics.kineticEnergy,
      energia_cinetica_medida_J: noiseEnabled ? measured.kineticEnergyMeasured : energetics.kineticEnergy,
      trabalho_J: energetics.work,
      trabalho_medido_J: noiseEnabled ? measured.workMeasured : energetics.work,
      potencia_W: energetics.power,
    });
  }

  return result;
}

/**
 * Ordena cronologicamente e remove linhas duplicadas no mesmo instante de tempo.
 */
function normalizeSamplesList(samples) {
  if (!Array.isArray(samples)) return [];
  const valid = samples
    .map((s) => {
      const rawT = s?.t_s ?? s?.t;
      if (typeof rawT !== 'number' || !Number.isFinite(rawT) || rawT < -1e-9) return null;
      const t = Math.max(0, Number(rawT.toFixed(6)));
      return { ...s, _normT: t };
    })
    .filter(Boolean)
    .sort((a, b) => a._normT - b._normT);

  const deduped = [];
  for (const item of valid) {
    const prev = deduped[deduped.length - 1];
    if (prev && Math.abs(item._normT - prev._normT) < 1e-6) {
      deduped[deduped.length - 1] = item;
    } else {
      deduped.push(item);
    }
  }
  return deduped;
}

/**
 * Produz um CSV com cabeçalho de metadados comentados (# Corpo, # M, # R/L, # d, # I, # F, # Ruido (%))
 * e as amostras discretas de coleta experimental.
 * - Modo completo (blindMode = false): t_s, theta_teorico_rad, theta_medido_rad,
 *   omega_teorico_rads, omega_medido_rads, alfa_medido_rads2, energia_cinetica_J, trabalho_J.
 * - Modo Cego para Relatório (blindMode = true): exporta APENAS os dados brutos que um sensor
 *   real leria (t_s, theta_medido_rad, omega_medido_rads, alfa_medido_rads2, energia_cinetica_medida_J),
 *   ocultando as previsões analíticas no cabeçalho e nas colunas.
 *
 * Opções de formatação regional:
 * - decimalSeparator: '.' (padrão científico) ou ',' (Excel / LibreOffice Calc em pt-BR)
 * - columnSeparator: ';' (padrão pt-BR) ou ',' (padrão internacional)
 */
export function buildExperimentCsv({
  params,
  dynamics,
  samples,
  noiseEnabled = false,
  noiseSigmaRel = 0.02,
  blindMode = false,
  decimalSeparator = '.',
  columnSeparator = ';',
}) {
  const geometry = GEOMETRIES[params?.geometry];
  if (!geometry || !dynamics) throw new Error('Dados insuficientes para exportar o experimento.');

  const cell = (v) => formatCsvCell(v, { decimalSeparator, columnSeparator });
  const dimLabel = geometry.dimensao === 'radius' ? 'R (m)' : 'L (m)';
  const d = params.axisOffset ?? dynamics.axisOffset ?? 0;
  const Icm = dynamics.Icm ?? dynamics.I;
  const Id = dynamics.Id ?? 0;
  const noisePct = noiseEnabled ? Number((noiseSigmaRel * 100).toFixed(2)) : 0;
  const incTempo = decimalSeparator === ',' ? '+-0,01' : '+-0.01';

  const commentHeader = [
    `# Laboratório Virtual de Dinâmica de Rotação e Momento de Inércia — UNIVASF`,
    `#Modo de Exportacao: ${blindMode ? 'Modo Cego para Relatorio (apenas leituras de sensor)' : 'Completo (teorico + experimental)'}`,
    `# Corpo: ${geometry.nome} (${geometry.id})`,
    `# M (kg): ${cell(params.mass)}`,
    `# ${dimLabel}: ${cell(params.size)}`,
    `# d (m): ${cell(d)}`,
    `# Icm (kg.m2): ${cell(Icm)}`,
    `# Md2 (kg.m2): ${cell(Id)}`,
    `# I (kg.m2): ${cell(dynamics.I)}`,
    `# b (m): ${cell(dynamics.b)}`,
    `# F (N): ${cell(params.force)}`,
    `# Sentido: ${params.direction > 0 ? 'anti-horario (+)' : 'horario (-)'}`,
    `# Torque (N.m): ${cell(dynamics.tau)}`,
    ...(blindMode ? [] : [`# Alfa teorico (rad/s2): ${cell(dynamics.alpha)}`]),
    `# Ruido (%): ${cell(noisePct)}`,
    `# Incerteza instrumental de tempo (s): ${incTempo}`,
  ];

  const columns = blindMode
    ? [
        't_s',
        'theta_medido_rad',
        'omega_medido_rads',
        'alfa_medido_rads2',
        'energia_cinetica_medida_J',
      ]
    : [
        't_s',
        'theta_teorico_rad',
        'theta_medido_rad',
        'omega_teorico_rads',
        'omega_medido_rads',
        'alfa_medido_rads2',
        'energia_cinetica_J',
        'trabalho_J',
      ];

  const cleanSamples = normalizeSamplesList(samples);

  const rows = cleanSamples.map((s) => {
    const t = s._normT;
    const kinTeo = kinematics(dynamics.alpha, t);
    const thetaTeo = s.theta_teorico_rad ?? s.theta ?? kinTeo.theta;
    const omegaTeo = s.omega_teorico_rads ?? s.omega ?? kinTeo.omega;
    const thetaMed = noiseEnabled
      ? (s.theta_medido_rad ?? s.thetaMeasured ?? thetaTeo)
      : (s.theta_medido_rad ?? thetaTeo);
    const omegaMed = noiseEnabled
      ? (s.omega_medido_rads ?? s.omegaMeasured ?? omegaTeo)
      : (s.omega_medido_rads ?? omegaTeo);
    const alfaMed = noiseEnabled
      ? (s.alfa_medido_rads2 ?? s.alphaMeasured ?? s.alpha ?? dynamics.alpha)
      : (s.alfa_medido_rads2 ?? s.alpha ?? dynamics.alpha);

    const energeticsTeo = computeEnergetics(dynamics.I, dynamics.tau, omegaTeo, thetaTeo);
    const energeticsMed = computeEnergetics(dynamics.I, dynamics.tau, omegaMed, thetaMed);

    const kRotTeo = s.energia_cinetica_J ?? s.kineticEnergy ?? energeticsTeo.kineticEnergy;
    const kRotMed =
      s.energia_cinetica_medida_J ??
      s.kineticEnergyMeasured ??
      s.energia_cinetica_J ??
      energeticsMed.kineticEnergy;
    const workTeo = s.trabalho_J ?? s.work ?? energeticsTeo.work;

    const rowData = blindMode
      ? [t, thetaMed, omegaMed, alfaMed, kRotMed]
      : [t, thetaTeo, thetaMed, omegaTeo, omegaMed, alfaMed, kRotTeo, workTeo];
    return rowData.map(cell).join(columnSeparator);
  });

  const allLines = [...commentHeader, columns.join(columnSeparator), ...rows];
  return `\uFEFF${allLines.join('\r\n')}\r\n`;
}

/**
 * Produz CSV para o Experimento Comparativo 1 (Disco maciço vs. Anel fino sob as mesmas condições).
 */
export function buildComparisonCsv({
  mass,
  radius,
  force,
  direction = 1,
  diskDynamics: providedDisk,
  ringDynamics: providedRing,
  upToTime,
  maxTime = 0,
  sampleDt = 0.2,
  decimalSeparator = '.',
  columnSeparator = ';',
}) {
  const diskDynamics =
    providedDisk ??
    (Number.isFinite(mass) && Number.isFinite(radius) && Number.isFinite(force)
      ? computeDynamics({ geometry: 'disco', mass, size: radius, force, direction, axisOffset: 0 })
      : null);
  const ringDynamics =
    providedRing ??
    (Number.isFinite(mass) && Number.isFinite(radius) && Number.isFinite(force)
      ? computeDynamics({ geometry: 'anel', mass, size: radius, force, direction, axisOffset: 0 })
      : null);
  if (!diskDynamics || !ringDynamics) {
    throw new Error('Dados insuficientes para exportar a comparação Disco x Anel.');
  }
  const cell = (v) => formatCsvCell(v, { decimalSeparator, columnSeparator });
  const dt = Number.isFinite(sampleDt) && sampleDt > 0 ? sampleDt : 0.2;
  const targetTime = upToTime ?? maxTime;
  const steps = Math.floor((Math.max(0, targetTime) + 1e-9) / dt);

  const commentHeader = [
    `# Laboratório Virtual de Dinâmica de Rotação e Momento de Inércia — UNIVASF`,
    `# Experimento Comparativo 1: Disco macico vs. Anel fino (eixo central, d = 0 m)`,
    `# M (kg): ${cell(mass)}`,
    `# R (m): ${cell(radius)}`,
    `# F (N): ${cell(force)}`,
    `# Sentido: ${direction > 0 ? 'anti-horario (+)' : 'horario (-)'}`,
    `# Torque comum (N.m): ${cell(diskDynamics.tau)}`,
    `# I_disco (kg.m2): ${cell(diskDynamics.I)} | Alfa_disco (rad/s2): ${cell(diskDynamics.alpha)}`,
    `# I_anel (kg.m2): ${cell(ringDynamics.I)} | Alfa_anel (rad/s2): ${cell(ringDynamics.alpha)}`,
  ];

  const columns = [
    't_s',
    'alfa_disco_rads2',
    'omega_disco_rads',
    'theta_disco_rad',
    'energia_disco_J',
    'trabalho_disco_J',
    'alfa_anel_rads2',
    'omega_anel_rads',
    'theta_anel_rad',
    'energia_anel_J',
    'trabalho_anel_J',
  ];

  const rows = [];
  for (let k = 0; k <= steps; k++) {
    const t = Number((k * dt).toFixed(6));
    const diskKin = kinematics(diskDynamics.alpha, t);
    const diskEn = computeEnergetics(diskDynamics.I, diskDynamics.tau, diskKin.omega, diskKin.theta);
    const ringKin = kinematics(ringDynamics.alpha, t);
    const ringEn = computeEnergetics(ringDynamics.I, ringDynamics.tau, ringKin.omega, ringKin.theta);

    rows.push(
      [
        t,
        diskDynamics.alpha,
        diskKin.omega,
        diskKin.theta,
        diskEn.kineticEnergy,
        diskEn.work,
        ringDynamics.alpha,
        ringKin.omega,
        ringKin.theta,
        ringEn.kineticEnergy,
        ringEn.work,
      ]
        .map(cell)
        .join(columnSeparator)
    );
  }

  const allLines = [...commentHeader, columns.join(columnSeparator), ...rows];
  return `\uFEFF${allLines.join('\r\n')}\r\n`;
}

/**
 * Produz CSV para o Experimento Comparativo 2 (Teorema de Steiner: Eixo central d = 0 vs. Eixo deslocado d > 0 sob mesmo torque).
 */
export function buildSteinerComparisonCsv({
  geometry: geometryId,
  mass,
  size,
  force = 0,
  axisOffset: providedOffset,
  dRatio = 1,
  direction = 1,
  centralDynamics: providedCentral,
  displacedDynamics: providedDisplaced,
  upToTime,
  maxTime = 0,
  sampleDt = 0.2,
  decimalSeparator = '.',
  columnSeparator = ';',
}) {
  const geometry = GEOMETRIES[geometryId];
  const bCm = geometry ? geometry.arm(size) : 0;
  const axisOffset = providedOffset ?? bCm * dRatio;
  const centralDynamics =
    providedCentral ??
    (geometry && Number.isFinite(mass) && Number.isFinite(size)
      ? computeDynamics({ geometry: geometryId, mass, size, force, direction, axisOffset: 0 })
      : null);
  const displacedDynamics =
    providedDisplaced ??
    (geometry && centralDynamics
      ? computeDynamics({
          geometry: geometryId,
          mass,
          size,
          force,
          direction,
          axisOffset,
          torqueOverride: Math.abs(centralDynamics.tau),
        })
      : null);
  if (!geometry || !centralDynamics || !displacedDynamics) {
    throw new Error('Dados insuficientes para exportar a comparação de Steiner.');
  }
  const cell = (v) => formatCsvCell(v, { decimalSeparator, columnSeparator });
  const dimLabel = geometry.dimensao === 'radius' ? 'R (m)' : 'L (m)';
  const dt = Number.isFinite(sampleDt) && sampleDt > 0 ? sampleDt : 0.2;
  const targetTime = upToTime ?? maxTime;
  const steps = Math.floor((Math.max(0, targetTime) + 1e-9) / dt);

  const commentHeader = [
    `# Laboratório Virtual de Dinâmica de Rotação e Momento de Inércia — UNIVASF`,
    `# Experimento Comparativo 2: Teorema de Steiner — Eixo central (d = 0) vs. Eixo deslocado (d > 0) sob mesmo torque`,
    `# Corpo: ${geometry.nome} (${geometry.id})`,
    `# M (kg): ${cell(mass)}`,
    `# ${dimLabel}: ${cell(size)}`,
    `# d_deslocado (m): ${cell(axisOffset)}`,
    `# Sentido: ${direction > 0 ? 'anti-horario (+)' : 'horario (-)'}`,
    `# Torque comum (N.m): ${cell(centralDynamics.tau)}`,
    `# I_central = Icm (kg.m2): ${cell(centralDynamics.I)} | Alfa_central (rad/s2): ${cell(centralDynamics.alpha)}`,
    `# Md2 (kg.m2): ${cell(displacedDynamics.Id)} | I_deslocado (kg.m2): ${cell(displacedDynamics.I)} | Alfa_deslocado (rad/s2): ${cell(displacedDynamics.alpha)}`,
  ];

  const columns = [
    't_s',
    'alfa_central_rads2',
    'omega_central_rads',
    'theta_central_rad',
    'energia_central_J',
    'trabalho_central_J',
    'alfa_deslocado_rads2',
    'omega_deslocado_rads',
    'theta_deslocado_rad',
    'energia_deslocado_J',
    'trabalho_deslocado_J',
  ];

  const rows = [];
  for (let k = 0; k <= steps; k++) {
    const t = Number((k * dt).toFixed(6));
    const cKin = kinematics(centralDynamics.alpha, t);
    const cEn = computeEnergetics(centralDynamics.I, centralDynamics.tau, cKin.omega, cKin.theta);
    const dKin = kinematics(displacedDynamics.alpha, t);
    const dEn = computeEnergetics(displacedDynamics.I, displacedDynamics.tau, dKin.omega, dKin.theta);

    rows.push(
      [
        t,
        centralDynamics.alpha,
        cKin.omega,
        cKin.theta,
        cEn.kineticEnergy,
        cEn.work,
        displacedDynamics.alpha,
        dKin.omega,
        dKin.theta,
        dEn.kineticEnergy,
        dEn.work,
      ]
        .map(cell)
        .join(columnSeparator)
    );
  }

  const allLines = [...commentHeader, columns.join(columnSeparator), ...rows];
  return `\uFEFF${allLines.join('\r\n')}\r\n`;
}

export function downloadCsv(filename, content) {
  const link = document.createElement('a');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
