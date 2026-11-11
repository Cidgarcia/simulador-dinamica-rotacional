import './style.css';
import {
  DISCRETE_SAMPLE_RATES,
  Experiment,
  GEOMETRIES,
  LIMITS,
  MAX_FRAME_DT,
  MAX_SIM_TIME,
  NOISE_LEVELS,
  PLAYBACK_RATES,
  TIME_INSTRUMENT_UNCERTAINTY,
  canvasRotationAngle,
  computeEnergetics,
  createSeededRng,
  kinematics,
  mixSeed,
  sampleExperimentalState,
  validateParams,
} from './physics.js';
import { formatFixed, formatNumber, formatWithSigma, parseDecimal } from './format.js';
import { createChart, createComparisonChart, createSteinerInertiaChart } from './charts.js';
import {
  buildComparisonCsv,
  buildExperimentCsv,
  buildSteinerComparisonCsv,
  downloadCsv,
  generateDiscreteSamples,
  localTimestamp,
} from './export.js';

/* ---------------- Estado ---------------- */

const DEFAULTS = {
  geometry: 'disco',
  mass: 2,
  radius: 0.5,
  length: 1,
  axisOffset: 0,
  force: 1,
  direction: 1,
};
const DECIMALS = { mass: 1, radius: 2, length: 2, axisOffset: 2, force: 2 };
const SAMPLE_INTERVAL = 0.02; // s simulados entre amostras contínuas dos gráficos
const STOP_TIMES = [2, 5, 10, 20];

const ui = {
  geometry: DEFAULTS.geometry,
  direction: DEFAULTS.direction,
  rate: 1,
  stopTime: 20,
  noiseEnabled: false,
  noiseSigmaRel: 0.02,
  noiseSeed: null, // inteiro ≥ 0 → ruído reproduzível; null → aleatório (Math.random)
  sampleDt: 0.2,
  blindMode: false,
  text: {
    mass: formatFixed(DEFAULTS.mass, DECIMALS.mass),
    radius: formatFixed(DEFAULTS.radius, DECIMALS.radius),
    length: formatFixed(DEFAULTS.length, DECIMALS.length),
    axisOffset: formatFixed(DEFAULTS.axisOffset, DECIMALS.axisOffset),
    force: formatFixed(DEFAULTS.force, DECIMALS.force),
  },
};

const dimKey = () => GEOMETRIES[ui.geometry].dimensao; // 'radius' | 'length'

function currentParams() {
  return {
    geometry: ui.geometry,
    mass: parseDecimal(ui.text.mass),
    size: parseDecimal(ui.text[dimKey()]),
    axisOffset: parseDecimal(ui.text.axisOffset),
    force: parseDecimal(ui.text.force),
    direction: ui.direction,
  };
}

const experiment = new Experiment(currentParams());
let hasStartedRun = false;
let samples = []; // histórico denso para os gráficos 2D
let discreteSamples = []; // buffer discreto de coleta experimental para tabela e CSV
let discreteNoiseDraws = []; // sorteios normais fixos por índice de amostra discreta
let chartNoiseDraws = []; // sorteios normais fixos por índice de amostra do gráfico
let latestMeasuredState = null;
let samplesDirty = true;
let discreteDirty = true;

/** RNG das leituras instantâneas (fora da grade Δt): determinístico se houver semente; senão undefined → Math.random. */
function liveRng(t) {
  return ui.noiseSeed === null ? undefined : createSeededRng(mixSeed(ui.noiseSeed, Math.round(t * 1e6), 2));
}

/* ---------------- DOM ---------------- */

const $ = (sel) => document.querySelector(sel);
const el = {
  viewport: $('#viewport'),
  fallback: $('#webgl-fallback'),
  fallbackText: $('#webgl-fallback-text'),
  statusChip: $('#status-chip'),
  statusText: $('#status-text'),
  clock: $('#clock-value'),
  clockMax: $('#clock-max'),
  btnRun: $('#btn-run'),
  runLabel: $('#run-label'),
  runIcon: $('#run-icon'),
  btnReset: $('#btn-reset'),
  btnExportCsv: $('#btn-export-csv'),
  btnExportCsvStd: $('#btn-export-csv-std'),
  btnView: $('#btn-view'),
  notice: $('#notice'),
  alias: $('#alias-hint'),
  legendAxis: $('#legend-axis'),
  sizeLabel: $('#size-label'),
  equations: $('#equations'),
  noiseToggle: $('#noise-toggle'),
  noiseOptions: $('#noise-options'),
  blindModeToggle: $('#blind-mode-toggle'),
  sampleCountBadge: $('#sample-count-badge'),
  sampleTable: $('#sample-table'),
  sampleTableBody: $('#sample-table-body'),
  outputs: Object.fromEntries([...document.querySelectorAll('[data-out]')].map((n) => [n.dataset.out, n])),
  fields: {
    mass: { input: $('#mass-input'), range: $('#mass-range'), hint: $('#mass-hint'), error: $('#mass-error') },
    size: { input: $('#size-input'), range: $('#size-range'), hint: $('#size-hint'), error: $('#size-error') },
    axisOffset: { input: $('#offset-input'), range: $('#offset-range'), hint: $('#offset-hint'), error: $('#offset-error') },
    force: { input: $('#force-input'), range: $('#force-range'), hint: $('#force-hint'), error: $('#force-error') },
  },
  comparison: {
    run: $('#btn-comparison-run'),
    reset: $('#btn-comparison-reset'),
    exportBr: $('#btn-comparison-export'),
    exportStd: $('#btn-comparison-export-std'),
    clock: $('#comparison-clock'),
    mass: $('#comparison-mass'),
    radius: $('#comparison-radius'),
    force: $('#comparison-force'),
    direction: $('#comparison-direction'),
    notice: $('#comparison-notice'),
    diskCanvas: $('#comparison-disk'),
    ringCanvas: $('#comparison-ring'),
    outputs: Object.fromEntries([...document.querySelectorAll('[data-compare]')].map((node) => [node.dataset.compare, node])),
  },
  steiner: {
    run: $('#btn-steiner-run'),
    reset: $('#btn-steiner-reset'),
    exportBr: $('#btn-steiner-export'),
    exportStd: $('#btn-steiner-export-std'),
    clock: $('#steiner-clock'),
    geometry: $('#steiner-geometry'),
    mass: $('#steiner-mass'),
    sizeLabel: $('#steiner-size-label'),
    size: $('#steiner-size'),
    offset: $('#steiner-offset'),
    torque: $('#steiner-torque'),
    direction: $('#steiner-direction'),
    notice: $('#steiner-notice'),
    centralCanvas: $('#steiner-central-canvas'),
    displacedCanvas: $('#steiner-displaced-canvas'),
    outputs: Object.fromEntries([...document.querySelectorAll('[data-steiner]')].map((node) => [node.dataset.steiner, node])),
  },
};

const ICONS = {
  play: '<path d="M8 5v14l11-7z" fill="currentColor"/>',
  pause: '<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/>',
  done: '<path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill="currentColor"/>',
};

/* ---------------- Cena 3D (opcional) ---------------- */

let lab = null;
let contextLost = false;

function showFallback(message) {
  if (message) el.fallbackText.textContent = message;
  el.fallback.hidden = false;
  el.viewport.classList.add('is-fallback');
  el.btnView.disabled = true;
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

async function initScene() {
  if (!hasWebGL()) {
    showFallback(); // evita baixar o pacote 3D quando não há suporte
    return;
  }
  try {
    const { createLabScene } = await import('./scene.js');
    lab = createLabScene(el.viewport);
    lab.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      contextLost = true;
      showFallback('O contexto gráfico (WebGL) foi perdido, possivelmente por falta de memória de vídeo. Os valores e gráficos continuam funcionando; recarregue a página para restaurar a visualização.');
    });
    lab.canvas.addEventListener('webglcontextrestored', () => {
      contextLost = false;
      el.fallback.hidden = true;
      el.viewport.classList.remove('is-fallback');
      el.btnView.disabled = false;
    });
    syncScene();
  } catch (err) {
    console.warn('Visualização 3D indisponível:', err);
    lab = null;
    showFallback();
  }
}

function syncScene() {
  if (!lab) return;
  if (!experiment.dynamics) {
    lab.setAngle(0);
    return;
  }
  const p = experiment.params;
  lab.setParams({ ...p, arm: experiment.dynamics.b, axisOffset: experiment.dynamics.axisOffset });
  lab.setAngle(experiment.state?.theta ?? 0);
}

/* ---------------- Formulário ---------------- */

function configureRange(range, lim) {
  range.min = lim.min;
  range.max = lim.max;
  range.step = lim.step;
}

function fmtLimit(v) {
  return formatNumber(v, 3);
}

function refreshFieldLabels() {
  const isBar = dimKey() === 'length';
  const lim = LIMITS[dimKey()];
  const dVal = parseDecimal(ui.text.axisOffset);
  el.sizeLabel.innerHTML = isBar ? 'Comprimento <var>L</var>' : 'Raio <var>R</var>';
  el.fields.size.range.setAttribute('aria-label', isBar ? 'Comprimento L em metros (controle deslizante)' : 'Raio R em metros (controle deslizante)');
  el.fields.size.hint.textContent = `Entre ${fmtLimit(lim.min)} e ${fmtLimit(lim.max)} m · ${isBar ? 'No centro: braço b_cm = L/2 (com eixo deslocado: b = L/2 + d)' : 'No centro: braço b_cm = R (com eixo deslocado: b = R + d)'}`;
  configureRange(el.fields.size.range, lim);
  el.fields.size.input.value = ui.text[dimKey()];
  const axisDesc = GEOMETRIES[ui.geometry].eixo;
  el.legendAxis.textContent =
    Number.isFinite(dVal) && dVal > 0
      ? `${axisDesc} (afastado d = ${formatNumber(dVal, 3)} m do centro de massa).`
      : `${axisDesc} (passando pelo centro de massa, d = 0 m).`;
}

function syncRangeFromText(field) {
  const key = field === 'size' ? dimKey() : field;
  const v = parseDecimal(ui.text[key]);
  if (Number.isFinite(v)) el.fields[field].range.value = String(v);
}

function showErrors(errors) {
  for (const [field, f] of Object.entries(el.fields)) {
    const msg = errors[field] ?? '';
    if (f.error.textContent !== msg) f.error.textContent = msg;
    f.input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    f.input.closest('.field').classList.toggle('has-error', !!msg);
  }
}

let noticeTimer = 0;
function showNotice(message, tone = 'info', persist = false) {
  clearTimeout(noticeTimer);
  el.notice.textContent = message;
  el.notice.dataset.tone = tone;
  el.notice.classList.add('is-visible');
  if (!persist) noticeTimer = setTimeout(() => el.notice.classList.remove('is-visible'), 6000);
}

/**
 * Reconstrói as amostras dos gráficos (a cada 0,02 s) e da tabela/CSV (a cada Δt = 0,20 s ou 0,50 s)
 * exatamente nos instantes analíticos múltiplos do intervalo, sem erro acumulado de FPS.
 */
function syncSamplesToTime() {
  if (!hasStartedRun || !experiment.dynamics) {
    samples = [];
    discreteSamples = [];
    latestMeasuredState = sampleExperimentalState(experiment.state, {
      enabled: ui.noiseEnabled,
      sigmaRel: ui.noiseSigmaRel,
    });
    samplesDirty = true;
    discreteDirty = true;
    return;
  }

  const curT = experiment.time;
  const dyn = experiment.dynamics;

  // 1. Amostras discretas exatas para tabela e CSV (t = 0, Δt, 2Δt, ...)
  discreteSamples = generateDiscreteSamples({
    dynamics: dyn,
    upToTime: curT,
    sampleDt: ui.sampleDt,
    noiseEnabled: ui.noiseEnabled,
    noiseSigmaRel: ui.noiseSigmaRel,
    noiseDraws: discreteNoiseDraws,
    seed: ui.noiseSeed,
  });
  discreteDirty = true;

  // 2. Amostras densas para os gráficos 2D (t = 0, 0.02, 0.04, ...)
  const chartSteps = Math.floor((curT + 1e-9) / SAMPLE_INTERVAL);
  const nextSamples = [];
  for (let k = 0; k <= chartSteps; k++) {
    const t = Number((k * SAMPLE_INTERVAL).toFixed(6));
    const { omega, theta } = kinematics(dyn.alpha, t);
    const energetics = computeEnergetics(dyn.I, dyn.tau, omega, theta);
    const realState = { t, ...dyn, omega, theta, ...energetics };

    let draw = chartNoiseDraws[k];
    if (!draw) {
      const drawValues = [];
      const chartRng = ui.noiseSeed === null ? Math.random : createSeededRng(mixSeed(ui.noiseSeed, k, 1));
      sampleExperimentalState(realState, {
        enabled: true,
        sigmaRel: 0.02,
        rng: () => {
          const v = chartRng();
          drawValues.push(v);
          return v;
        },
      });
      draw = drawValues;
      chartNoiseDraws[k] = draw;
    }
    let idx = 0;
    const measured = sampleExperimentalState(realState, {
      enabled: ui.noiseEnabled,
      sigmaRel: ui.noiseSigmaRel,
      rng: () => draw[idx++ % draw.length] ?? 0.5,
    });

    nextSamples.push({
      t,
      omega,
      theta,
      alpha: dyn.alpha,
      omegaMeasured: ui.noiseEnabled ? measured.omegaMeasured : omega,
      thetaMeasured: ui.noiseEnabled ? measured.thetaMeasured : theta,
      alphaMeasured: ui.noiseEnabled ? measured.alphaMeasured : dyn.alpha,
      kineticEnergy: energetics.kineticEnergy,
      work: energetics.work,
    });
  }

  // Se o tempo atual estiver entre dois passos de 0,02 s, acrescenta o ponto exato final
  const lastChartT = nextSamples.length ? nextSamples[nextSamples.length - 1].t : -1;
  if (curT - lastChartT > 1e-6) {
    const s = experiment.state;
    const measured = sampleExperimentalState(s, {
      enabled: ui.noiseEnabled,
      sigmaRel: ui.noiseSigmaRel,
      rng: liveRng(s.t),
    });
    nextSamples.push({
      t: s.t,
      omega: s.omega,
      theta: s.theta,
      alpha: s.alpha,
      omegaMeasured: ui.noiseEnabled ? measured.omegaMeasured : s.omega,
      thetaMeasured: ui.noiseEnabled ? measured.thetaMeasured : s.theta,
      alphaMeasured: ui.noiseEnabled ? measured.alphaMeasured : s.alpha,
      kineticEnergy: s.kineticEnergy,
      work: s.work,
    });
  }

  samples = nextSamples;
  samplesDirty = true;

  // Sincroniza o mostrador atual com a última amostra discreta quando estiver sobre um múltiplo exato de Δt
  const lastDisc = discreteSamples[discreteSamples.length - 1];
  const s = experiment.state;
  if (lastDisc && s && Math.abs(lastDisc.t_s - s.t) < 1e-6) {
    const atT0 = s.t === 0; // condições iniciais impostas: sem ruído em θ e ω
    const sigmaOmega = ui.noiseEnabled && !atT0 ? ui.noiseSigmaRel * Math.max(Math.abs(s.omega), 0.05) : 0;
    const sigmaTheta = ui.noiseEnabled && !atT0 ? ui.noiseSigmaRel * Math.max(Math.abs(s.theta), 0.05) : 0;
    const sigmaAlpha = ui.noiseEnabled ? Math.abs(s.alpha) * ui.noiseSigmaRel : 0;
    const sigmaKineticEnergy = ui.noiseEnabled ? s.I * Math.abs(s.omega) * sigmaOmega : 0;
    const sigmaWork = ui.noiseEnabled ? Math.abs(s.tau) * sigmaTheta : 0;
    latestMeasuredState = {
      ...s,
      omegaMeasured: lastDisc.omega_medido_rads,
      thetaMeasured: lastDisc.theta_medido_rad,
      alphaMeasured: lastDisc.alfa_medido_rads2,
      kineticEnergyMeasured: lastDisc.energia_cinetica_medida_J,
      workMeasured: lastDisc.trabalho_medido_J,
      sigmaOmega,
      sigmaTheta,
      sigmaAlpha,
      sigmaKineticEnergy,
      sigmaWork,
      sigmaTime: ui.noiseEnabled ? TIME_INSTRUMENT_UNCERTAINTY : 0,
    };
  } else {
    latestMeasuredState = sampleExperimentalState(s, {
      enabled: ui.noiseEnabled,
      sigmaRel: ui.noiseSigmaRel,
      rng: liveRng(s.t),
    });
  }
}

function resetRun() {
  experiment.reset();
  hasStartedRun = false;
  samples = [];
  discreteSamples = [];
  discreteNoiseDraws = [];
  chartNoiseDraws = [];
  latestMeasuredState = sampleExperimentalState(experiment.state, {
    enabled: ui.noiseEnabled,
    sigmaRel: ui.noiseSigmaRel,
  });
  samplesDirty = true;
  discreteDirty = true;
  aliasVisible = false;
  el.alias.hidden = true;
}

/** Qualquer alteração de parâmetro físico pausa e reinicia o experimento. */
function applyParams() {
  const progressed = experiment.time > 0 || experiment.status === 'running';
  experiment.setParams(currentParams());
  resetRun();
  refreshFieldLabels();
  showErrors(experiment.validation.errors);
  if (!experiment.validation.valid) {
    showNotice('Corrija os valores destacados para habilitar o experimento.', 'error', true);
  } else if (progressed) {
    showNotice('Parâmetros alterados: o experimento foi pausado e reiniciado em t = 0 s.', 'warn');
  } else {
    showNotice('Parâmetros atualizados. Pressione Iniciar para começar.', 'info');
  }
  syncScene();
  renderEquations();
  updateControls();
  updateReadouts();
  updateCharts();
  updateSampleTable();
}

function bindField(field) {
  const f = el.fields[field];
  const key = () => (field === 'size' ? dimKey() : field);
  f.input.addEventListener('input', () => {
    ui.text[key()] = f.input.value;
    syncRangeFromText(field);
    applyParams();
  });
  f.input.addEventListener('blur', () => {
    const v = parseDecimal(f.input.value);
    const errs = validateParams(currentParams()).errors;
    if (Number.isFinite(v) && !errs[field]) {
      const txt = formatFixed(v, DECIMALS[key()]);
      if (parseDecimal(txt) === v) f.input.value = ui.text[key()] = txt;
    }
  });
  f.range.addEventListener('input', () => {
    const v = Number(f.range.value);
    ui.text[key()] = f.input.value = formatFixed(v, DECIMALS[key()]);
    applyParams();
  });
}

function initForm() {
  configureRange(el.fields.mass.range, LIMITS.mass);
  configureRange(el.fields.axisOffset.range, LIMITS.axisOffset);
  configureRange(el.fields.force.range, LIMITS.force);
  el.fields.mass.hint.textContent = `Entre ${fmtLimit(LIMITS.mass.min)} e ${fmtLimit(LIMITS.mass.max)} kg · Quanto maior a massa, maior a inércia I`;
  el.fields.axisOffset.hint.textContent = `Entre 0 e ${fmtLimit(LIMITS.axisOffset.max)} m · d = 0 m mantém o eixo no centro (Steiner: I = Icm + Md²)`;
  el.fields.force.hint.textContent = `Entre 0 e ${fmtLimit(LIMITS.force.max)} N · Força tangencial aplicada na borda`;
  el.fields.mass.input.value = ui.text.mass;
  el.fields.axisOffset.input.value = ui.text.axisOffset;
  el.fields.force.input.value = ui.text.force;
  refreshFieldLabels();
  ['mass', 'size', 'axisOffset', 'force'].forEach((k) => {
    syncRangeFromText(k);
    bindField(k);
  });

  document.querySelectorAll('input[name="geometry"]').forEach((r) =>
    r.addEventListener('change', () => {
      if (!r.checked) return;
      ui.geometry = r.value;
      refreshFieldLabels();
      syncRangeFromText('size');
      applyParams();
    })
  );
  document.querySelectorAll('input[name="direction"]').forEach((r) =>
    r.addEventListener('change', () => {
      if (!r.checked) return;
      ui.direction = Number(r.value);
      applyParams();
    })
  );
  document.querySelectorAll('input[name="rate"]').forEach((r) =>
    r.addEventListener('change', () => {
      if (!r.checked) return;
      const v = Number(r.value);
      ui.rate = PLAYBACK_RATES.includes(v) ? v : 1;
      updateControls();
    })
  );
  document.querySelectorAll('input[name="stopTime"]').forEach((r) =>
    r.addEventListener('change', () => {
      if (!r.checked) return;
      const v = Number(r.value);
      ui.stopTime = STOP_TIMES.includes(v) ? v : 20;
      if (el.clockMax) el.clockMax.textContent = `/ ${ui.stopTime} s`;
      showNotice(`Pausa automática programada para t = ${formatFixed(ui.stopTime, 2)} s.`, 'info');
    })
  );
  if (el.noiseToggle) {
    el.noiseToggle.addEventListener('change', () => {
      ui.noiseEnabled = el.noiseToggle.checked;
      if (el.noiseOptions) el.noiseOptions.hidden = !ui.noiseEnabled;
      syncSamplesToTime();
      updateReadouts();
      updateCharts();
      updateSampleTable();
      showNotice(
        ui.noiseEnabled
          ? `Incerteza experimental ativada: simulando ruído gaussiano com σ = ${(ui.noiseSigmaRel * 100).toFixed(0)}% (1 desvio-padrão, proporcional ao valor) nas leituras do sensor.`
          : 'Modo ideal ativado: exibindo e exportando valores teóricos exatos (sem ruído).',
        'info'
      );
    });
  }
  document.querySelectorAll('input[name="noiseLevel"]').forEach((r) =>
    r.addEventListener('change', () => {
      if (!r.checked) return;
      const v = Number(r.value);
      ui.noiseSigmaRel = NOISE_LEVELS.includes(v) ? v : 0.02;
      syncSamplesToTime();
      updateReadouts();
      updateCharts();
      updateSampleTable();
      if (ui.noiseEnabled) {
        showNotice(`Desvio-padrão relativo do sensor ajustado para σ = ${(ui.noiseSigmaRel * 100).toFixed(0)}%.`, 'info');
      }
    })
  );
  const seedInput = document.querySelector('#noise-seed');
  if (seedInput) {
    seedInput.addEventListener('input', () => {
      const raw = seedInput.value.trim();
      const v = Number(raw);
      ui.noiseSeed = raw !== '' && Number.isInteger(v) && v >= 0 && v <= 4294967295 ? v : null;
      // Novos sorteios: regenera tabela, gráficos e CSV com a nova semente.
      discreteNoiseDraws = [];
      chartNoiseDraws = [];
      syncSamplesToTime();
      updateReadouts();
      updateCharts();
      updateSampleTable();
      if (ui.noiseEnabled) {
        showNotice(
          ui.noiseSeed === null
            ? 'Semente vazia/inválida: ruído aleatório (não reproduzível).'
            : `Semente ${ui.noiseSeed}: o mesmo ensaio gerará sempre as mesmas leituras e o mesmo CSV.`,
          'info'
        );
      }
    });
  }
  document.querySelectorAll('input[name="sampleDt"]').forEach((r) =>
    r.addEventListener('change', () => {
      if (!r.checked) return;
      const v = Number(r.value);
      ui.sampleDt = DISCRETE_SAMPLE_RATES.includes(v) ? v : 0.2;
      syncSamplesToTime();
      updateSampleTable();
    })
  );
  if (el.blindModeToggle) {
    el.blindModeToggle.addEventListener('change', () => {
      ui.blindMode = el.blindModeToggle.checked;
      if (el.sampleTable) el.sampleTable.classList.toggle('is-blind', ui.blindMode);
      discreteDirty = true;
      updateSampleTable();
      showNotice(
        ui.blindMode
          ? 'Modo Cego ativo: valores teóricos ocultados na tabela e no CSV para prática de relatório.'
          : 'Modo Completo ativo: valores teóricos e medidos visíveis na tabela e no CSV.',
        'info'
      );
    });
  }
  $('#params-form').addEventListener('submit', (e) => e.preventDefault());
}

/* ---------------- Execução ---------------- */

el.btnRun.addEventListener('click', () => {
  if (experiment.status === 'running') {
    experiment.pause();
  } else if (experiment.start()) {
    hasStartedRun = true;
    syncSamplesToTime();
    el.notice.classList.remove('is-visible');
  }
  updateControls();
  updateReadouts();
  updateCharts();
  updateSampleTable();
});

el.btnReset.addEventListener('click', () => {
  resetRun();
  if (lab) lab.setAngle(0);
  showNotice('Experimento reiniciado em t = 0 s.', 'info');
  updateControls();
  updateReadouts();
  updateCharts();
  renderEquations();
  updateSampleTable();
});

function handleExportMainCsv(decimalSeparator = ',') {
  if (!discreteSamples.length || !experiment.dynamics) return;
  syncSamplesToTime();
  const geometry = GEOMETRIES[ui.geometry].id;
  const stamp = localTimestamp();
  const csv = buildExperimentCsv({
    params: experiment.params,
    dynamics: experiment.dynamics,
    samples: discreteSamples,
    noiseEnabled: ui.noiseEnabled,
    noiseSigmaRel: ui.noiseSigmaRel,
    blindMode: ui.blindMode,
    decimalSeparator,
    columnSeparator: ';',
    noiseSeed: ui.noiseSeed,
  });
  const modeSuffix = ui.blindMode ? '_modo_cego' : '';
  const fmtSuffix = decimalSeparator === ',' ? '_excel_br' : '_padrao';
  downloadCsv(`dados_rotacao_${geometry}${modeSuffix}${fmtSuffix}_${stamp}.csv`, csv);
  showNotice(
    decimalSeparator === ','
      ? 'CSV exportado para Excel / LibreOffice Calc Brasil (separador ; e vírgula decimal).'
      : 'CSV exportado em formato científico padrão (separador ; e ponto decimal).',
    'info'
  );
}

if (el.btnExportCsv) {
  el.btnExportCsv.addEventListener('click', () => handleExportMainCsv(','));
}
if (el.btnExportCsvStd) {
  el.btnExportCsvStd.addEventListener('click', () => handleExportMainCsv('.'));
}

el.btnView.addEventListener('click', () => lab?.resetView());

function setRunButton(icon, label, disabled) {
  if (el.runIcon.dataset.icon !== icon) {
    el.runIcon.innerHTML = ICONS[icon];
    el.runIcon.dataset.icon = icon;
  }
  el.runLabel.textContent = label;
  el.btnRun.disabled = disabled;
}

function updateControls() {
  const s = experiment.status;
  const valid = !!experiment.dynamics;
  const rateTxt = `${formatNumber(ui.rate, 2)}×`;
  let status = s;
  if (!valid) {
    setRunButton('play', 'Iniciar', true);
    el.statusText.textContent = 'Parâmetros inválidos';
    status = 'invalid';
  } else if (s === 'running') {
    setRunButton('pause', 'Pausar', false);
    el.statusText.textContent = `Em execução · ${rateTxt}`;
  } else if (s === 'paused') {
    setRunButton('play', 'Continuar', false);
    el.statusText.textContent = `Pausado em ${formatFixed(experiment.time, 2)} s`;
  } else if (s === 'finished') {
    setRunButton('done', 'Concluído', true);
    el.statusText.textContent = `Concluído · ${MAX_SIM_TIME} s`;
  } else {
    setRunButton('play', 'Iniciar', false);
    el.statusText.textContent = `Pronto · ${rateTxt}`;
  }
  el.statusChip.dataset.status = status;
  el.btnReset.disabled = experiment.time === 0 && s === 'idle' && !hasStartedRun;
  const noSamples = discreteSamples.length === 0 || !valid;
  if (el.btnExportCsv) el.btnExportCsv.disabled = noSamples;
  if (el.btnExportCsvStd) el.btnExportCsvStd.disabled = noSamples;
}

/* ---------------- Saídas ---------------- */

function setText(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}

function formatWithUncertainty(val, sigma, digits = 2) {
  if (!ui.noiseEnabled) return formatFixed(val, digits);
  // Critério metrológico: σ com 2 algarismos significativos; valor com as mesmas casas decimais.
  return formatWithSigma(val, sigma, { sigDigits: 2, fallbackDigits: digits });
}

function updateReadouts() {
  const s = experiment.state;
  const tStr = formatFixed(experiment.time, 2);
  setText(el.clock, tStr);
  setText(
    el.outputs.t,
    ui.noiseEnabled ? `${tStr} ± ${formatFixed(TIME_INSTRUMENT_UNCERTAINTY, 2)}` : tStr
  );
  setText(
    el.outputs['t-sub'],
    ui.noiseEnabled ? 'Cronômetro c/ incerteza declarada ±0,01 s (t nominal)' : 'Tempo exato da simulação'
  );
  if (!s) {
    ['I', 'tau', 'alpha', 'omega', 'theta', 'krot', 'work'].forEach((k) => setText(el.outputs[k], '—'));
    setText(el.outputs['inertia-sub'], 'Icm = — · Md² = —');
    setText(el.outputs['torque-sub'], 'Braço b = — m');
    setText(el.outputs['alpha-sub'], '—');
    setText(el.outputs['omega-sub'], '—');
    setText(el.outputs.turns, '—');
    setText(el.outputs['krot-sub'], 'K_rot = ½ I ω²');
    setText(el.outputs['power-sub'], 'Potência P = — W');
    return;
  }

  const m =
    latestMeasuredState && Math.abs((latestMeasuredState.t ?? 0) - s.t) < 1e-6
      ? latestMeasuredState
      : sampleExperimentalState(s, { enabled: ui.noiseEnabled, sigmaRel: ui.noiseSigmaRel, rng: liveRng(s.t) });
  latestMeasuredState = m;

  setText(el.outputs.I, formatFixed(s.I, 3));
  setText(el.outputs['inertia-sub'], `Icm = ${formatFixed(s.Icm, 3)} · Md² = ${formatFixed(s.Id, 3)}`);
  setText(el.outputs.tau, formatFixed(s.tau, 3));
  setText(
    el.outputs['torque-sub'],
    s.axisOffset > 0
      ? `Braço b = ${formatFixed(s.b, 2)} m (${formatFixed(s.bCm, 2)} + d)`
      : `Braço b = ${formatFixed(s.b, 2)} m (d = 0,00)`
  );

  const alphaDisplay = ui.noiseEnabled ? m.alphaMeasured : s.alpha;
  const omegaDisplay = ui.noiseEnabled ? m.omegaMeasured : s.omega;
  const thetaDisplay = ui.noiseEnabled ? m.thetaMeasured : s.theta;
  const kRotDisplay = ui.noiseEnabled ? m.kineticEnergyMeasured : s.kineticEnergy;

  setText(el.outputs.alpha, formatWithUncertainty(alphaDisplay, m.sigmaAlpha, 2));
  setText(
    el.outputs['alpha-sub'],
    ui.noiseEnabled ? `Valor teórico: ${formatFixed(s.alpha, 2)} rad/s²` : 'α = τ / I (constante)'
  );
  setText(el.outputs.omega, formatWithUncertainty(omegaDisplay, m.sigmaOmega, 2));
  setText(
    el.outputs['omega-sub'],
    ui.noiseEnabled ? `Valor teórico: ${formatFixed(s.omega, 2)} rad/s` : 'ω(t) = α·t'
  );
  setText(el.outputs.theta, formatWithUncertainty(thetaDisplay, m.sigmaTheta, 2));
  const turns = s.theta / (2 * Math.PI);
  setText(el.outputs.turns, `≈ ${formatFixed(turns, 2)} voltas`);

  setText(el.outputs.krot, formatWithUncertainty(kRotDisplay, m.sigmaKineticEnergy, 2));
  setText(
    el.outputs['krot-sub'],
    ui.noiseEnabled
      ? `Valor teórico: ${formatFixed(s.kineticEnergy, 2)} J`
      : `K_rot = ½·I·ω²`
  );
  setText(el.outputs.work, formatFixed(s.work, 2));
  setText(el.outputs['power-sub'], `Potência P = ${formatFixed(s.power, 2)} W (τ·ω)`);
}

function eq(html) {
  const div = document.createElement('div');
  div.className = 'eq';
  div.innerHTML = html; // conteúdo gerado apenas a partir de números formatados
  return div;
}

function renderEquations() {
  el.equations.replaceChildren();
  const d = experiment.dynamics;
  const s = experiment.state;
  const g = GEOMETRIES[ui.geometry];
  if (!d || !s) {
    el.equations.append(eq('<span class="eq-muted">Equações indisponíveis: verifique os parâmetros.</span>'));
    return;
  }
  el.equations.append(
    eq(
      `<span class="eq-k">Inércia (${g.formulaI})</span> = ${formatFixed(d.Icm, 3)} + ${formatFixed(d.Id, 3)} = <b>${formatFixed(d.I, 3)}</b> kg·m²`
    ),
    eq(
      `<span class="eq-k">Torque (τ = ${ui.direction > 0 ? '+' : '−'}b·F)</span>, com ${g.formulaB} = ${formatFixed(d.b, 2)} m ⇒ τ = <b>${formatFixed(d.tau, 3)}</b> N·m`
    ),
    eq(`<span class="eq-k">Aceleração (α = τ / I)</span> = ${formatFixed(d.tau, 3)} / ${formatFixed(d.I, 3)} = <b>${formatFixed(d.alpha, 2)}</b> rad/s²`),
    eq(
      `<span class="eq-k">Energia (K<sub>rot</sub> = ½·I·ω² = W = τ·θ)</span> ⇒ ½·(${formatFixed(d.I, 3)})·(${formatFixed(s.omega, 2)})² = (${formatFixed(d.tau, 3)})·(${formatFixed(s.theta, 2)}) = <b data-eq-energy>${formatFixed(s.kineticEnergy, 2)}</b> J`
    )
  );
}

function updateDynamicEquationEnergy() {
  const s = experiment.state;
  const d = experiment.dynamics;
  if (!s || !d || !el.equations) return;
  const lastEq = el.equations.lastElementChild;
  if (!lastEq) return;
  lastEq.innerHTML = `<span class="eq-k">Energia (K<sub>rot</sub> = ½·I·ω² = W = τ·θ)</span> ⇒ ½·(${formatFixed(d.I, 3)})·(${formatFixed(s.omega, 2)})² = (${formatFixed(d.tau, 3)})·(${formatFixed(s.theta, 2)}) = <b>${formatFixed(s.kineticEnergy, 2)}</b> J`;
}

function updateSampleTable() {
  if (!discreteDirty) return;
  discreteDirty = false;
  if (el.sampleCountBadge) {
    el.sampleCountBadge.textContent = `${discreteSamples.length} ${discreteSamples.length === 1 ? 'amostra coletada' : 'amostras coletadas'} (Δt = ${formatFixed(ui.sampleDt, 2)} s)`;
  }
  if (!el.sampleTableBody) return;
  if (el.sampleTable) el.sampleTable.classList.toggle('is-blind', ui.blindMode);
  el.sampleTableBody.replaceChildren();
  if (discreteSamples.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'table-empty-row';
    const colSpan = ui.blindMode ? 5 : 8;
    tr.innerHTML = `<td colspan="${colSpan}">Nenhuma amostra registrada. Pressione <em>Iniciar</em> para coletar os dados em função do tempo.</td>`;
    el.sampleTableBody.appendChild(tr);
    return;
  }
  const frag = document.createDocumentFragment();
  for (const row of discreteSamples) {
    const tr = document.createElement('tr');
    const kVal = ui.blindMode ? row.energia_cinetica_medida_J : row.energia_cinetica_J;
    const cells = [
      { txt: formatFixed(row.t_s, 2), theoretical: false },
      { txt: formatFixed(row.theta_teorico_rad, 3), theoretical: true },
      { txt: formatFixed(row.theta_medido_rad, 3), theoretical: false },
      { txt: formatFixed(row.omega_teorico_rads, 3), theoretical: true },
      { txt: formatFixed(row.omega_medido_rads, 3), theoretical: false },
      { txt: formatFixed(row.alfa_medido_rads2, 3), theoretical: false },
      { txt: formatFixed(kVal, 3), theoretical: false },
      { txt: formatFixed(row.trabalho_J, 3), theoretical: true },
    ];
    for (const c of cells) {
      const td = document.createElement('td');
      if (c.theoretical) td.dataset.col = 'theoretical';
      td.textContent = c.txt;
      tr.appendChild(td);
    }
    frag.appendChild(tr);
  }
  el.sampleTableBody.appendChild(frag);
}

let aliasVisible = false;
let avgFrameDt = 1 / 60;

function updateAliasHint() {
  const s = experiment.state;
  let show = false;
  if (s && experiment.status === 'running') {
    const perFrame = Math.abs(s.omega) * ui.rate * avgFrameDt; // rad por quadro exibido
    show = aliasVisible ? perFrame > Math.PI / 10 : perFrame > Math.PI / 8;
  }
  if (show !== aliasVisible) {
    aliasVisible = show;
    el.alias.hidden = !show;
    if (show) {
      el.alias.textContent =
        ui.rate > 0.25
          ? 'Giro muito rápido: a roda pode parecer girar devagar ou ao contrário na tela (como rodas de carro em vídeos). Use 0,25× ou 0,5× para ver em câmera lenta. Os cálculos e gráficos continuam exatos.'
          : 'Giro muito rápido: a animação pode sofrer efeito visual de câmera, mas todos os números e gráficos continuam exatos.';
    }
  }
}

/* ---------------- Gráficos ---------------- */

const charts = [
  { chart: createChart($('#chart-omega'), { key: 'omega', measuredKey: 'omegaMeasured', color: '#38d6f5', label: 'ω', unit: 'rad/s' }), node: $('#chart-omega') },
  { chart: createChart($('#chart-theta'), { key: 'theta', measuredKey: 'thetaMeasured', color: '#ffb547', label: 'θ', unit: 'rad' }), node: $('#chart-theta') },
  { chart: createChart($('#chart-alpha'), { key: 'alpha', measuredKey: 'alphaMeasured', color: '#a78bfa', label: 'α', unit: 'rad/s²' }), node: $('#chart-alpha') },
];

function updateCharts() {
  if (!samplesDirty) return;
  samplesDirty = false;
  const empty = samples.length < 2;
  for (const { chart, node } of charts) {
    chart.setSamples(samples, { noiseEnabled: ui.noiseEnabled });
    node.parentElement.querySelector('[data-empty]').hidden = !empty;
  }
}

/* ---------------- Desenho 2D compartilhado (Comparativos) ---------------- */

function parseComparisonInput(input) {
  if (!input || input.validity?.badInput) return NaN;
  return parseDecimal(input.value);
}

function drawComparisonBody(
  canvas,
  geometry,
  theta,
  { force = 1, direction = 1, axisOffset = 0, bCm = 0.5, subtitle = null } = {}
) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const targetWidth = Math.round(width * pixelRatio);
  const targetHeight = Math.round(height * pixelRatio);
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const cx = width / 2;
  const cy = height / 2 - 4;
  const d = Number.isFinite(axisOffset) && axisOffset > 0 ? axisOffset : 0;
  const safeBCm = Number.isFinite(bCm) && bCm > 0 ? bCm : 0.5;
  const dRatio = d / safeBCm;
  const maxVisualSpan = Math.min(width, height) * 0.36;
  const radius = maxVisualSpan / Math.max(1 + dRatio, 1.28);
  const offsetPx = dRatio * radius;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#071a36';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(120,160,220,0.22)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y <= height; y += 20) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // Trajetória tracejada do Centro de Massa quando d > 0
  if (offsetPx > 1) {
    ctx.save();
    ctx.strokeStyle = 'rgba(74, 222, 154, 0.35)';
    ctx.lineWidth = 1.3;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, offsetPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(cx, cy);
  // Canvas 2D tem +Y para baixo; canvasRotationAngle(-wrapAngle(theta)) faz θ > 0 girar no sentido anti-horário.
  ctx.rotate(canvasRotationAngle(theta));

  // Centro de massa do corpo em (0, -offsetPx) em relação ao eixo de rotação (0, 0)
  const cmY = -offsetPx;

  if (geometry === 'disco') {
    ctx.fillStyle = '#2f6fd6';
    ctx.beginPath();
    ctx.arc(0, cmY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#cfe8ff';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (geometry === 'anel') {
    ctx.strokeStyle = '#ffb547';
    ctx.lineWidth = radius * 0.23;
    ctx.beginPath();
    ctx.arc(0, cmY, radius * 0.82, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#cfe8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, cmY, radius, 0, Math.PI * 2);
    ctx.stroke();
  } else if (geometry === 'esfera') {
    ctx.fillStyle = '#2b63c0';
    ctx.beginPath();
    ctx.arc(0, cmY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9fc5ff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, cmY, radius, radius * 0.36, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#cfe8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, cmY, radius, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Barra fina de comprimento 2*radius centrada em (0, cmY)
    const barW = Math.max(radius * 0.22, 8);
    ctx.fillStyle = '#2f6fd6';
    ctx.strokeStyle = '#cfe8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-barW / 2, cmY - radius, barW, radius * 2, 4);
    ctx.fill();
    ctx.stroke();
  }

  // Marca radial de referência do CM até a borda/extremidade superior (0, cmY - radius)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(0, cmY);
  ctx.lineTo(0, cmY - radius * 0.92);
  ctx.stroke();

  // Haste rígida de acoplamento entre o eixo fixo (0,0), o CM (0, cmY) e o ponto de aplicação (0, cmY - radius)
  if (offsetPx > 1) {
    ctx.strokeStyle = '#4ade9a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, cmY);
    ctx.stroke();
    // Marcador do CM
    ctx.fillStyle = '#4ade9a';
    ctx.beginPath();
    ctx.arc(0, cmY, 4.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eixo fixo de rotação em (0, 0)
  ctx.fillStyle = '#06112a';
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c9d4e3';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Ponto de aplicação na borda externa (0, cmY - radius) e seta tangencial coerente com o sentido:
  const appY = cmY - radius;
  ctx.fillStyle = '#ff6a3d';
  ctx.beginPath();
  ctx.arc(0, appY, 4.5, 0, Math.PI * 2);
  ctx.fill();
  if (force > 0) {
    const dirX = direction >= 0 ? -1 : 1;
    const len = Math.max(radius * (0.42 + 0.08 * Math.min(force, 5)), 18);
    const endX = dirX * len;
    const head = 7;
    ctx.strokeStyle = '#ff6a3d';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(0, appY);
    ctx.lineTo(endX - dirX * (head * 0.6), appY);
    ctx.stroke();
    ctx.fillStyle = '#ff6a3d';
    ctx.beginPath();
    ctx.moveTo(endX, appY);
    ctx.lineTo(endX - dirX * head, appY - head * 0.65);
    ctx.lineTo(endX - dirX * head, appY + head * 0.65);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = '#b9cdea';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const senseLabel = force === 0 ? 'repouso (τ = 0)' : direction >= 0 ? '↺ anti-horário (+)' : '↻ horário (−)';
  const caption = subtitle ?? `eixo fixo (d = ${formatNumber(d, 2)} m) • ${senseLabel}`;
  ctx.fillText(caption, cx, height - 10);
}

/* ---------------- Comparação 1: disco × anel ---------------- */

const comparisonCharts = [
  createComparisonChart($('#comparison-chart-alpha'), {
    label: 'α', unit: 'rad/s²',
    series: [{ key: 'diskAlpha', color: '#38d6f5' }, { key: 'ringAlpha', color: '#ffb547' }],
  }),
  createComparisonChart($('#comparison-chart-omega'), {
    label: 'ω', unit: 'rad/s',
    series: [{ key: 'diskOmega', color: '#38d6f5' }, { key: 'ringOmega', color: '#ffb547' }],
  }),
  createComparisonChart($('#comparison-chart-theta'), {
    label: 'θ', unit: 'rad',
    series: [{ key: 'diskTheta', color: '#38d6f5' }, { key: 'ringTheta', color: '#ffb547' }],
  }),
];
const comparison = { disk: null, ring: null, samples: [], dirty: true, hasStarted: false };

function comparisonParams(geometry) {
  return {
    geometry,
    mass: parseComparisonInput(el.comparison.mass),
    size: parseComparisonInput(el.comparison.radius),
    axisOffset: 0,
    force: parseComparisonInput(el.comparison.force),
    direction: Number(el.comparison.direction?.value ?? 1),
  };
}

function comparisonStatus() {
  return comparison.disk?.status ?? 'idle';
}

function setCompareText(key, value) {
  const node = el.comparison.outputs[key];
  if (node && node.textContent !== value) node.textContent = value;
}

function syncComparisonSamples() {
  const disk = comparison.disk;
  const ring = comparison.ring;
  if (!disk?.dynamics || !ring?.dynamics || !comparison.hasStarted) {
    comparison.samples = [];
    comparison.dirty = true;
    return;
  }
  const curT = disk.time;
  const steps = Math.floor((curT + 1e-9) / SAMPLE_INTERVAL);
  const next = [];
  for (let k = 0; k <= steps; k++) {
    const t = Number((k * SAMPLE_INTERVAL).toFixed(6));
    const dKin = kinematics(disk.dynamics.alpha, t);
    const rKin = kinematics(ring.dynamics.alpha, t);
    next.push({
      t,
      diskAlpha: disk.dynamics.alpha,
      ringAlpha: ring.dynamics.alpha,
      diskOmega: dKin.omega,
      ringOmega: rKin.omega,
      diskTheta: dKin.theta,
      ringTheta: rKin.theta,
    });
  }
  const lastT = next.length ? next[next.length - 1].t : -1;
  if (curT - lastT > 1e-6) {
    const ds = disk.state;
    const rs = ring.state;
    next.push({
      t: ds.t,
      diskAlpha: ds.alpha,
      ringAlpha: rs.alpha,
      diskOmega: ds.omega,
      ringOmega: rs.omega,
      diskTheta: ds.theta,
      ringTheta: rs.theta,
    });
  }
  comparison.samples = next;
  comparison.dirty = true;
}

function updateComparison() {
  const diskState = comparison.disk?.state;
  const ringState = comparison.ring?.state;
  setText(el.comparison.clock, formatFixed(comparison.disk?.time ?? 0, 2));
  if (!diskState || !ringState) {
    ['disk-I', 'disk-tau', 'disk-alpha', 'disk-omega', 'disk-theta', 'disk-energy', 'ring-I', 'ring-tau', 'ring-alpha', 'ring-omega', 'ring-theta', 'ring-energy'].forEach((k) =>
      setCompareText(k, '—')
    );
    drawComparisonBody(el.comparison.diskCanvas, 'disco', 0, { force: 0, direction: 1 });
    drawComparisonBody(el.comparison.ringCanvas, 'anel', 0, { force: 0, direction: 1 });
    el.comparison.run.textContent = 'Iniciar comparação';
    el.comparison.run.disabled = true;
    if (el.comparison.exportBr) el.comparison.exportBr.disabled = true;
    if (el.comparison.exportStd) el.comparison.exportStd.disabled = true;
    if (comparison.dirty) {
      comparison.dirty = false;
      comparisonCharts.forEach((chart) => chart.setSamples([]));
    }
    return;
  }
  const { force, direction, size } = comparison.disk.params;
  setCompareText('disk-I', `${formatFixed(diskState.I, 3)} kg·m²`);
  setCompareText('disk-tau', `${formatFixed(diskState.tau, 3)} N·m`);
  setCompareText('disk-alpha', `${formatFixed(diskState.alpha, 2)} rad/s²`);
  setCompareText('disk-omega', `${formatFixed(diskState.omega, 2)} rad/s`);
  setCompareText('disk-theta', `${formatFixed(diskState.theta, 2)} rad`);
  setCompareText('disk-energy', `${formatFixed(diskState.kineticEnergy, 2)} J`);
  setCompareText('ring-I', `${formatFixed(ringState.I, 3)} kg·m²`);
  setCompareText('ring-tau', `${formatFixed(ringState.tau, 3)} N·m`);
  setCompareText('ring-alpha', `${formatFixed(ringState.alpha, 2)} rad/s²`);
  setCompareText('ring-omega', `${formatFixed(ringState.omega, 2)} rad/s`);
  setCompareText('ring-theta', `${formatFixed(ringState.theta, 2)} rad`);
  setCompareText('ring-energy', `${formatFixed(ringState.kineticEnergy, 2)} J`);
  drawComparisonBody(el.comparison.diskCanvas, 'disco', diskState.theta, { force, direction, axisOffset: 0, bCm: size });
  drawComparisonBody(el.comparison.ringCanvas, 'anel', ringState.theta, { force, direction, axisOffset: 0, bCm: size });
  const status = comparisonStatus();
  el.comparison.run.textContent = status === 'running' ? 'Pausar comparação' : status === 'paused' ? 'Continuar comparação' : status === 'finished' ? 'Concluída' : 'Iniciar comparação';
  el.comparison.run.disabled = status === 'finished';
  const canExport = comparison.hasStarted && comparison.disk.dynamics !== null;
  if (el.comparison.exportBr) el.comparison.exportBr.disabled = !canExport;
  if (el.comparison.exportStd) el.comparison.exportStd.disabled = !canExport;
  if (comparison.dirty) {
    comparison.dirty = false;
    comparisonCharts.forEach((chart) => chart.setSamples(comparison.samples));
  }
}

function resetComparison(message = '') {
  const diskParams = comparisonParams('disco');
  const ringParams = comparisonParams('anel');
  const diskVal = validateParams(diskParams);
  const ringVal = validateParams(ringParams);
  const valid = diskVal.valid && ringVal.valid;
  el.comparison.mass.setAttribute('aria-invalid', diskVal.errors.mass ? 'true' : 'false');
  el.comparison.radius.setAttribute('aria-invalid', diskVal.errors.size ? 'true' : 'false');
  el.comparison.force.setAttribute('aria-invalid', diskVal.errors.force ? 'true' : 'false');
  if (!valid) {
    comparison.disk = null;
    comparison.ring = null;
    comparison.samples = [];
    comparison.hasStarted = false;
    comparison.dirty = true;
    const errMsg = diskVal.errors.mass || diskVal.errors.size || diskVal.errors.force || 'Use massa e raio positivos dentro dos limites, e força entre 0 e 5 N.';
    el.comparison.notice.textContent = `Parâmetros inválidos na comparação: ${errMsg}`;
    updateComparison();
    return false;
  }
  comparison.disk = new Experiment(diskParams);
  comparison.ring = new Experiment(ringParams);
  comparison.samples = [];
  comparison.hasStarted = false;
  comparison.dirty = true;
  el.comparison.notice.textContent = message;
  updateComparison();
  return true;
}

function toggleComparison() {
  if (!comparison.disk && !resetComparison()) return;
  if (comparisonStatus() === 'running') {
    comparison.disk.pause(); comparison.ring.pause();
    el.comparison.notice.textContent = 'Comparação pausada.';
  } else if (comparison.disk.start() && comparison.ring.start()) {
    comparison.hasStarted = true;
    syncComparisonSamples();
    el.comparison.notice.textContent = 'Relógio comum em execução: compare as curvas e os valores de cada corpo.';
  }
  updateComparison();
}

function handleExportComparisonCsv(decimalSeparator = ',') {
  if (!comparison.disk?.dynamics || !comparison.ring?.dynamics || !comparison.hasStarted) return;
  const p = comparison.disk.params;
  const stamp = localTimestamp();
  const csv = buildComparisonCsv({
    mass: p.mass,
    radius: p.size,
    force: p.force,
    direction: p.direction,
    diskDynamics: comparison.disk.dynamics,
    ringDynamics: comparison.ring.dynamics,
    upToTime: comparison.disk.time,
    sampleDt: ui.sampleDt,
    decimalSeparator,
    columnSeparator: ';',
  });
  const fmtSuffix = decimalSeparator === ',' ? '_excel_br' : '_padrao';
  downloadCsv(`comparacao_disco_vs_anel${fmtSuffix}_${stamp}.csv`, csv);
  el.comparison.notice.textContent =
    decimalSeparator === ','
      ? 'CSV da comparação Disco × Anel exportado para Excel / Calc Brasil (; e vírgula decimal).'
      : 'CSV da comparação Disco × Anel exportado em formato padrão (ponto decimal).';
}

el.comparison.run.addEventListener('click', toggleComparison);
el.comparison.reset.addEventListener('click', () => resetComparison('Comparação reiniciada em t = 0 s.'));
if (el.comparison.exportBr) {
  el.comparison.exportBr.addEventListener('click', () => handleExportComparisonCsv(','));
}
if (el.comparison.exportStd) {
  el.comparison.exportStd.addEventListener('click', () => handleExportComparisonCsv('.'));
}
[el.comparison.mass, el.comparison.radius, el.comparison.force, el.comparison.direction].forEach((input) => {
  if (!input) return;
  const handler = () => resetComparison('Parâmetros da comparação atualizados (reiniciado em t = 0 s).');
  input.addEventListener('input', handler);
  input.addEventListener('change', handler);
});

/* ---------------- Comparação 2: Teorema de Steiner (eixo central × deslocado sob mesmo torque) ---------------- */

const steinerInertiaChart = createSteinerInertiaChart($('#steiner-chart-id'));
const steinerTimeCharts = [
  createComparisonChart($('#steiner-chart-omega'), {
    label: 'ω', unit: 'rad/s',
    series: [{ key: 'centralOmega', color: '#38d6f5' }, { key: 'displacedOmega', color: '#ffb547' }],
  }),
  createComparisonChart($('#steiner-chart-theta'), {
    label: 'θ', unit: 'rad',
    series: [{ key: 'centralTheta', color: '#38d6f5' }, { key: 'displacedTheta', color: '#ffb547' }],
  }),
];
const steiner = { central: null, displaced: null, samples: [], dirty: true, hasStarted: false };

function steinerParams(axisOffset) {
  const geometry = el.steiner.geometry?.value ?? 'disco';
  return {
    geometry,
    mass: parseComparisonInput(el.steiner.mass),
    size: parseComparisonInput(el.steiner.size),
    axisOffset,
    force: 0,
    torqueOverride: parseComparisonInput(el.steiner.torque),
    direction: Number(el.steiner.direction?.value ?? 1),
  };
}

function steinerStatus() {
  return steiner.central?.status ?? 'idle';
}

function setSteinerText(key, value) {
  const node = el.steiner.outputs[key];
  if (node && node.textContent !== value) node.textContent = value;
}

function refreshSteinerSizeLimits() {
  const geo = el.steiner.geometry?.value ?? 'disco';
  const isBar = GEOMETRIES[geo]?.dimensao === 'length';
  const lim = LIMITS[isBar ? 'length' : 'radius'];
  if (el.steiner.sizeLabel) el.steiner.sizeLabel.textContent = isBar ? 'Comprimento' : 'Raio';
  if (el.steiner.size) {
    el.steiner.size.min = String(lim.min);
    el.steiner.size.max = String(lim.max);
    el.steiner.size.step = String(lim.step);
  }
}

function syncSteinerSamples() {
  const c = steiner.central;
  const d = steiner.displaced;
  if (!c?.dynamics || !d?.dynamics || !steiner.hasStarted) {
    steiner.samples = [];
    steiner.dirty = true;
    return;
  }
  const curT = c.time;
  const steps = Math.floor((curT + 1e-9) / SAMPLE_INTERVAL);
  const next = [];
  for (let k = 0; k <= steps; k++) {
    const t = Number((k * SAMPLE_INTERVAL).toFixed(6));
    const cKin = kinematics(c.dynamics.alpha, t);
    const dKin = kinematics(d.dynamics.alpha, t);
    next.push({
      t,
      centralOmega: cKin.omega,
      displacedOmega: dKin.omega,
      centralTheta: cKin.theta,
      displacedTheta: dKin.theta,
    });
  }
  const lastT = next.length ? next[next.length - 1].t : -1;
  if (curT - lastT > 1e-6) {
    const cs = c.state;
    const ds = d.state;
    next.push({
      t: cs.t,
      centralOmega: cs.omega,
      displacedOmega: ds.omega,
      centralTheta: cs.theta,
      displacedTheta: ds.theta,
    });
  }
  steiner.samples = next;
  steiner.dirty = true;
}

function updateSteinerComparison() {
  const cState = steiner.central?.state;
  const dState = steiner.displaced?.state;
  setText(el.steiner.clock, formatFixed(steiner.central?.time ?? 0, 2));
  if (!cState || !dState) {
    [
      'central-Icm', 'central-Id', 'central-I', 'central-tau', 'central-alpha', 'central-kin', 'central-energy',
      'displaced-Icm', 'displaced-Id', 'displaced-I', 'displaced-tau', 'displaced-alpha', 'displaced-kin', 'displaced-energy',
    ].forEach((k) => setSteinerText(k, '—'));
    const geo = el.steiner.geometry?.value ?? 'disco';
    drawComparisonBody(el.steiner.centralCanvas, geo, 0, { force: 0, direction: 1, axisOffset: 0 });
    drawComparisonBody(el.steiner.displacedCanvas, geo, 0, { force: 0, direction: 1, axisOffset: 0 });
    el.steiner.run.textContent = 'Iniciar comparação de Steiner';
    el.steiner.run.disabled = true;
    if (el.steiner.exportBr) el.steiner.exportBr.disabled = true;
    if (el.steiner.exportStd) el.steiner.exportStd.disabled = true;
    if (steiner.dirty) {
      steiner.dirty = false;
      steinerInertiaChart.setConfig(null);
      steinerTimeCharts.forEach((chart) => chart.setSamples([]));
    }
    return;
  }

  const { geometry, mass, torqueOverride, direction } = steiner.displaced.params;
  const dVal = dState.axisOffset;

  setSteinerText('central-Icm', `${formatFixed(cState.Icm, 3)} kg·m²`);
  setSteinerText('central-Id', `0,000 kg·m²`);
  setSteinerText('central-I', `${formatFixed(cState.I, 3)} kg·m²`);
  setSteinerText('central-tau', `${formatFixed(cState.tau, 3)} N·m`);
  setSteinerText('central-alpha', `${formatFixed(cState.alpha, 2)} rad/s²`);
  setSteinerText('central-kin', `${formatFixed(cState.omega, 2)} rad/s · ${formatFixed(cState.theta, 2)} rad`);
  setSteinerText('central-energy', `${formatFixed(cState.kineticEnergy, 2)} J`);

  setSteinerText('displaced-Icm', `${formatFixed(dState.Icm, 3)} kg·m²`);
  setSteinerText('displaced-Id', `${formatFixed(dState.Id, 3)} kg·m²`);
  setSteinerText('displaced-I', `${formatFixed(dState.I, 3)} kg·m²`);
  setSteinerText('displaced-tau', `${formatFixed(dState.tau, 3)} N·m`);
  setSteinerText('displaced-alpha', `${formatFixed(dState.alpha, 2)} rad/s²`);
  setSteinerText('displaced-kin', `${formatFixed(dState.omega, 2)} rad/s · ${formatFixed(dState.theta, 2)} rad`);
  setSteinerText('displaced-energy', `${formatFixed(dState.kineticEnergy, 2)} J`);

  const visForceCentral = torqueOverride > 0 && cState.b > 0 ? Math.min(torqueOverride / cState.b, 5) : 0;
  const visForceDisplaced = torqueOverride > 0 && dState.b > 0 ? Math.min(torqueOverride / dState.b, 5) : 0;
  drawComparisonBody(el.steiner.centralCanvas, geometry, cState.theta, {
    force: visForceCentral,
    direction,
    axisOffset: 0,
    bCm: cState.bCm,
    subtitle: `d = 0 m • τ = ${formatNumber(cState.tau, 3)} N·m • α = ${formatNumber(cState.alpha, 3)} rad/s²`,
  });
  drawComparisonBody(el.steiner.displacedCanvas, geometry, dState.theta, {
    force: visForceDisplaced,
    direction,
    axisOffset: dVal,
    bCm: dState.bCm,
    subtitle: `d = ${formatNumber(dVal, 2)} m • τ = ${formatNumber(dState.tau, 3)} N·m • α = ${formatNumber(dState.alpha, 3)} rad/s²`,
  });

  const status = steinerStatus();
  el.steiner.run.textContent =
    status === 'running'
      ? 'Pausar comparação'
      : status === 'paused'
        ? 'Continuar comparação'
        : status === 'finished'
          ? 'Concluída'
          : 'Iniciar comparação de Steiner';
  el.steiner.run.disabled = status === 'finished';
  const canExport = steiner.hasStarted && steiner.central.dynamics !== null;
  if (el.steiner.exportBr) el.steiner.exportBr.disabled = !canExport;
  if (el.steiner.exportStd) el.steiner.exportStd.disabled = !canExport;

  if (steiner.dirty) {
    steiner.dirty = false;
    steinerInertiaChart.setConfig({ Icm: dState.Icm, mass, d: dVal });
    steinerTimeCharts.forEach((chart) => chart.setSamples(steiner.samples));
  }
}

function resetSteinerComparison(message = '') {
  const dVal = parseComparisonInput(el.steiner.offset);
  const centralParams = steinerParams(0);
  const displacedParams = steinerParams(dVal);
  const cVal = validateParams(centralParams);
  const dValidation = validateParams(displacedParams);
  const valid = cVal.valid && dValidation.valid;

  el.steiner.mass.setAttribute('aria-invalid', dValidation.errors.mass ? 'true' : 'false');
  el.steiner.size.setAttribute('aria-invalid', dValidation.errors.size ? 'true' : 'false');
  el.steiner.offset.setAttribute('aria-invalid', dValidation.errors.axisOffset ? 'true' : 'false');
  el.steiner.torque.setAttribute('aria-invalid', dValidation.errors.torque ? 'true' : 'false');

  if (!valid) {
    steiner.central = null;
    steiner.displaced = null;
    steiner.samples = [];
    steiner.hasStarted = false;
    steiner.dirty = true;
    const errMsg =
      dValidation.errors.mass ||
      dValidation.errors.size ||
      dValidation.errors.axisOffset ||
      dValidation.errors.torque ||
      'Verifique os parâmetros da comparação de Steiner.';
    el.steiner.notice.textContent = `Parâmetros inválidos na comparação de Steiner: ${errMsg}`;
    updateSteinerComparison();
    return false;
  }

  steiner.central = new Experiment(centralParams);
  steiner.displaced = new Experiment(displacedParams);
  steiner.samples = [];
  steiner.hasStarted = false;
  steiner.dirty = true;
  el.steiner.notice.textContent = message;
  updateSteinerComparison();
  return true;
}

function toggleSteinerComparison() {
  if (!steiner.central && !resetSteinerComparison()) return;
  if (steinerStatus() === 'running') {
    steiner.central.pause();
    steiner.displaced.pause();
    el.steiner.notice.textContent = 'Comparação de Steiner pausada.';
  } else if (steiner.central.start() && steiner.displaced.start()) {
    steiner.hasStarted = true;
    syncSteinerSamples();
    el.steiner.notice.textContent = 'Relógio comum em execução: observe como o termo Md² reduz a aceleração angular sob o mesmo torque.';
  }
  updateSteinerComparison();
}

function handleExportSteinerCsv(decimalSeparator = ',') {
  if (!steiner.central?.dynamics || !steiner.displaced?.dynamics || !steiner.hasStarted) return;
  const p = steiner.displaced.params;
  const stamp = localTimestamp();
  const csv = buildSteinerComparisonCsv({
    geometry: p.geometry,
    mass: p.mass,
    size: p.size,
    axisOffset: p.axisOffset,
    direction: p.direction,
    centralDynamics: steiner.central.dynamics,
    displacedDynamics: steiner.displaced.dynamics,
    upToTime: steiner.central.time,
    sampleDt: ui.sampleDt,
    decimalSeparator,
    columnSeparator: ';',
  });
  const fmtSuffix = decimalSeparator === ',' ? '_excel_br' : '_padrao';
  downloadCsv(`comparacao_steiner_${p.geometry}${fmtSuffix}_${stamp}.csv`, csv);
  el.steiner.notice.textContent =
    decimalSeparator === ','
      ? 'CSV da comparação de Steiner exportado para Excel / Calc Brasil (; e vírgula decimal).'
      : 'CSV da comparação de Steiner exportado em formato padrão (ponto decimal).';
}

el.steiner.run.addEventListener('click', toggleSteinerComparison);
el.steiner.reset.addEventListener('click', () => resetSteinerComparison('Comparação de Steiner reiniciada em t = 0 s.'));
if (el.steiner.exportBr) {
  el.steiner.exportBr.addEventListener('click', () => handleExportSteinerCsv(','));
}
if (el.steiner.exportStd) {
  el.steiner.exportStd.addEventListener('click', () => handleExportSteinerCsv('.'));
}
el.steiner.geometry.addEventListener('change', () => {
  refreshSteinerSizeLimits();
  const isBar = GEOMETRIES[el.steiner.geometry.value]?.dimensao === 'length';
  const curSize = parseComparisonInput(el.steiner.size);
  const lim = LIMITS[isBar ? 'length' : 'radius'];
  if (!Number.isFinite(curSize) || curSize < lim.min || curSize > lim.max) {
    el.steiner.size.value = isBar ? '1' : '0.5';
  }
  resetSteinerComparison('Geometria da comparação de Steiner atualizada.');
});
[el.steiner.mass, el.steiner.size, el.steiner.offset, el.steiner.torque, el.steiner.direction].forEach((input) => {
  if (!input) return;
  const handler = () => resetSteinerComparison('Parâmetros de Steiner atualizados (reiniciado em t = 0 s).');
  input.addEventListener('input', handler);
  input.addEventListener('change', handler);
});

/* ---------------- Roteiros guiados ---------------- */

function applyGuidedExperiment(kind) {
  if (kind === 'comparison') {
    el.comparison.mass.value = '2'; el.comparison.radius.value = '0.5'; el.comparison.force.value = '1';
    if (el.comparison.direction) el.comparison.direction.value = '1';
    resetComparison('Roteiro 01 carregado: M = 2 kg, R = 0,5 m e F = 1 N. Disco: α = 2 rad/s²; Anel: α = 1 rad/s².');
    $('#comparacao').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (kind === 'steiner-compare') {
    el.steiner.geometry.value = 'disco';
    refreshSteinerSizeLimits();
    el.steiner.mass.value = '2';
    el.steiner.size.value = '0.5';
    el.steiner.offset.value = '0.5';
    el.steiner.torque.value = '0.5';
    el.steiner.direction.value = '1';
    resetSteinerComparison(
      'Roteiro 04 carregado: M = 2 kg, R = 0,5 m, d = 0,5 m e τ = 0,5 N·m. I sobe de 0,25 para 0,75 kg·m² e α cai de 2 para ≈ 0,67 rad/s².'
    );
    $('#comparacao-steiner').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  ui.geometry = 'disco';
  ui.direction = 1;
  ui.text.radius = '0,50';
  ui.text.mass = kind === 'mass' ? '4,0' : '2,0';
  ui.text.axisOffset = kind === 'steiner-main' ? '0,50' : '0,00';
  ui.text.force = kind === 'force' ? '2,00' : '1,00';
  document.querySelector('input[name="geometry"][value="disco"]').checked = true;
  document.querySelector('input[name="direction"][value="1"]').checked = true;
  refreshFieldLabels();
  el.fields.mass.input.value = ui.text.mass;
  el.fields.axisOffset.input.value = ui.text.axisOffset;
  el.fields.force.input.value = ui.text.force;
  ['mass', 'size', 'axisOffset', 'force'].forEach((k) => syncRangeFromText(k));
  applyParams();
  if (kind === 'steiner-main') {
    showNotice(
      'Roteiro 05 carregado: d = 0,50 m. Inércia I = 0,75 kg·m², braço b = 1,0 m, torque τ = 1,0 N·m e α ≈ 1,33 rad/s².',
      'info'
    );
  } else if (kind === 'mass') {
    showNotice(
      'Roteiro 02 carregado: M = 4,0 kg (dobro da massa). O torque permanece 0,5 N·m, I dobra para 0,50 kg·m² e α cai pela metade (1,00 rad/s²).',
      'info'
    );
  } else if (kind === 'force') {
    showNotice(
      'Roteiro 03 carregado: F = 2,00 N (dobro da força). A inércia permanece 0,25 kg·m², o torque dobra para 1,0 N·m e α dobra (4,00 rad/s²).',
      'info'
    );
  } else {
    showNotice(
      'Caso base carregado: Disco com M = 2,0 kg, R = 0,50 m, d = 0,00 m e F = 1,00 N (I = 0,25 kg·m², τ = 0,5 N·m, α = 2,00 rad/s²).',
      'info'
    );
  }
  $('#conteudo').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.querySelectorAll('[data-guide]').forEach((button) =>
  button.addEventListener('click', () => applyGuidedExperiment(button.dataset.guide))
);

/* ---------------- Laço único de animação ---------------- */

let rafId = 0;
let lastTime = null;

function advanceWithStopTarget(exp, dt, rate, stopTarget) {
  const before = exp.time;
  const stepDt = Math.min(dt, MAX_FRAME_DT);
  const target = stopTarget < MAX_SIM_TIME && before < stopTarget - 1e-6 ? stopTarget : MAX_SIM_TIME;
  if (before + stepDt * rate >= target - 1e-9 && target < MAX_SIM_TIME) {
    const exactRealDt = (target - before) / rate;
    exp.advance(exactRealDt, rate);
    exp.time = target;
    exp.pause();
    return true; // atingiu parada automática intermediária
  }
  exp.advance(stepDt, rate);
  return false;
}

function frame(now) {
  rafId = requestAnimationFrame(frame);
  const dt = lastTime === null ? 0 : (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0 && dt < 0.5) avgFrameDt = avgFrameDt * 0.9 + dt * 0.1;

  if (experiment.status === 'running') {
    const hitStop = advanceWithStopTarget(experiment, dt, ui.rate, ui.stopTime);
    syncSamplesToTime();
    updateDynamicEquationEnergy();
    updateControls();
    if (hitStop) {
      showNotice(
        `Pausado automaticamente em t = ${formatFixed(experiment.time, 2)} s. Confira os valores/planilha ou clique em Continuar.`,
        'info',
        true
      );
    } else if (experiment.status === 'finished') {
      showNotice(`Limite de ${MAX_SIM_TIME} s simulados atingido. Use Reiniciar para uma nova execução.`, 'info', true);
    }
  }

  if (comparisonStatus() === 'running') {
    const hitStopDisk = advanceWithStopTarget(comparison.disk, dt, ui.rate, ui.stopTime);
    advanceWithStopTarget(comparison.ring, dt, ui.rate, ui.stopTime);
    syncComparisonSamples();
    if (hitStopDisk) {
      el.comparison.notice.textContent = `Comparação pausada automaticamente em t = ${formatFixed(comparison.disk.time, 2)} s. Clique em Continuar se desejar prosseguir.`;
    } else if (comparisonStatus() === 'finished') {
      el.comparison.notice.textContent = `Comparação finalizada em ${MAX_SIM_TIME} s simulados.`;
    }
  }

  if (steinerStatus() === 'running') {
    const hitStopSteiner = advanceWithStopTarget(steiner.central, dt, ui.rate, ui.stopTime);
    advanceWithStopTarget(steiner.displaced, dt, ui.rate, ui.stopTime);
    syncSteinerSamples();
    if (hitStopSteiner) {
      el.steiner.notice.textContent = `Comparação de Steiner pausada automaticamente em t = ${formatFixed(steiner.central.time, 2)} s. Clique em Continuar se desejar prosseguir.`;
    } else if (steinerStatus() === 'finished') {
      el.steiner.notice.textContent = `Comparação de Steiner finalizada em ${MAX_SIM_TIME} s simulados.`;
    }
  }

  updateReadouts();
  updateAliasHint();
  updateCharts();
  updateSampleTable();
  updateComparison();
  updateSteinerComparison();
  if (lab && !contextLost) {
    lab.setAngle(experiment.state?.theta ?? 0);
    lab.render();
  }
}

function startLoop() {
  if (rafId) return; // garante um único laço
  lastTime = null;
  rafId = requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => {
  // evita um salto de tempo ao voltar para a aba
  if (!document.hidden) lastTime = null;
});

/* ---------------- Inicialização ---------------- */

initForm();
refreshSteinerSizeLimits();
resetComparison('Ajuste as condições e clique em Iniciar comparação.');
resetSteinerComparison('Compare o eixo central (d = 0) com o eixo deslocado (d = 0,5 m) sob o mesmo torque.');
renderEquations();
updateControls();
updateReadouts();
updateSampleTable();
startLoop();
initScene();
