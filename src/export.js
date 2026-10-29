import { GEOMETRIES } from './physics.js';

function csvCell(value) {
  const text = String(value ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Produz um CSV com metadados em unidades SI e as amostras medidas no tempo
 * simulado. O separador ; evita conflito com a vírgula decimal do Excel pt-BR.
 */
export function buildExperimentCsv({ params, dynamics, samples }) {
  const geometry = GEOMETRIES[params.geometry];
  if (!geometry || !dynamics) throw new Error('Dados insuficientes para exportar o experimento.');

  const dimensionName = geometry.dimensao === 'radius' ? 'raio_m' : 'comprimento_m';
  const metadata = [
    ['Laboratório Virtual de Dinâmica de Rotação'],
    ['geometria', geometry.nome],
    ['massa_kg', params.mass],
    [dimensionName, params.size],
    ['forca_N', params.force],
    ['sentido', params.direction > 0 ? 'anti-horario' : 'horario'],
    ['momento_inercia_kg_m2', dynamics.I],
    ['braco_m', dynamics.b],
    ['torque_N_m', dynamics.tau],
    ['aceleracao_angular_rad_s2', dynamics.alpha],
    [],
    ['tempo_s', 'velocidade_angular_rad_s', 'posicao_angular_rad'],
    ...samples.map(({ t, omega, theta }) => [t, omega, theta]),
  ];

  return `\uFEFF${metadata.map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
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
