import { GEOMETRIES, computeEnergetics } from './physics.js';

function csvCell(value) {
  const normalized = typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(6)) : value;
  const text = String(normalized ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Produz um CSV com cabeçalho de metadados comentados (# Corpo, # M, # R/L, # d, # I, # F, # Ruido (%))
 * e as amostras discretas de coleta experimental.
 * - Modo completo (blindMode = false): t_s, theta_teorico_rad, theta_medido_rad,
 *   omega_teorico_rads, omega_medido_rads, alfa_medido_rads2, energia_cinetica_J, trabalho_J.
 * - Modo Cego para Relatório (blindMode = true): exporta APENAS os dados brutos que um sensor
 *   real leria (t_s, theta_medido_rad, omega_medido_rads, alfa_medido_rads2, energia_cinetica_medida_J),
 *   ocultando as previsões analíticas no cabeçalho e nas colunas.
 * O separador ; evita conflito com a vírgula decimal do Excel pt-BR.
 */
export function buildExperimentCsv({
  params,
  dynamics,
  samples,
  noiseEnabled = false,
  noiseSigmaRel = 0.02,
  blindMode = false,
}) {
  const geometry = GEOMETRIES[params.geometry];
  if (!geometry || !dynamics) throw new Error('Dados insuficientes para exportar o experimento.');

  const dimLabel = geometry.dimensao === 'radius' ? 'R (m)' : 'L (m)';
  const d = params.axisOffset ?? dynamics.axisOffset ?? 0;
  const Icm = dynamics.Icm ?? dynamics.I;
  const Id = dynamics.Id ?? 0;
  const noisePct = noiseEnabled ? Number((noiseSigmaRel * 100).toFixed(2)) : 0;

  const commentHeader = [
    `# Laboratório Virtual de Dinâmica de Rotação e Momento de Inércia — UNIVASF`,
    `#Modo de Exportacao: ${blindMode ? 'Modo Cego para Relatorio (apenas leituras de sensor)' : 'Completo (teorico + experimental)'}`,
    `# Corpo: ${geometry.nome} (${geometry.id})`,
    `# M (kg): ${csvCell(params.mass)}`,
    `# ${dimLabel}: ${csvCell(params.size)}`,
    `# d (m): ${csvCell(d)}`,
    `# Icm (kg.m2): ${csvCell(Icm)}`,
    `# Md2 (kg.m2): ${csvCell(Id)}`,
    `# I (kg.m2): ${csvCell(dynamics.I)}`,
    `# b (m): ${csvCell(dynamics.b)}`,
    `# F (N): ${csvCell(params.force)}`,
    `# Sentido: ${params.direction > 0 ? 'anti-horario (+)' : 'horario (-)'}`,
    `# Torque (N.m): ${csvCell(dynamics.tau)}`,
    ...(blindMode ? [] : [`# Alfa teorico (rad/s2): ${csvCell(dynamics.alpha)}`]),
    `# Ruido (%): ${csvCell(noisePct)}`,
    `# Incerteza instrumental de tempo (s): +-0.01`,
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

  const rows = samples.map((s) => {
    const t = s.t_s ?? s.t ?? 0;
    const thetaTeo = s.theta_teorico_rad ?? s.theta ?? 0;
    const thetaMed = s.theta_medido_rad ?? s.thetaMeasured ?? thetaTeo;
    const omegaTeo = s.omega_teorico_rads ?? s.omega ?? 0;
    const omegaMed = s.omega_medido_rads ?? s.omegaMeasured ?? omegaTeo;
    const alfaMed = s.alfa_medido_rads2 ?? s.alphaMeasured ?? s.alpha ?? dynamics.alpha;
    const energeticsMed = computeEnergetics(dynamics.I, dynamics.tau, omegaMed, thetaMed);
    const kRot = s.energia_cinetica_J ?? s.kineticEnergyMeasured ?? s.kineticEnergy ?? energeticsMed.kineticEnergy;
    const work = s.trabalho_J ?? s.workMeasured ?? s.work ?? energeticsMed.work;
    const rowData = blindMode
      ? [t, thetaMed, omegaMed, alfaMed, kRot]
      : [t, thetaTeo, thetaMed, omegaTeo, omegaMed, alfaMed, kRot, work];
    return rowData.map(csvCell).join(';');
  });

  const allLines = [...commentHeader, columns.join(';'), ...rows];
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
