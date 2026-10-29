import './style.css';
import {
  Experiment,
  GEOMETRIES,
  LIMITS,
  MAX_SIM_TIME,
  PLAYBACK_RATES,
  validateParams,
} from './physics.js';
import { formatFixed, formatNumber, parseDecimal } from './format.js';
import { createChart, createComparisonChart } from './charts.js';
import { buildExperimentCsv, downloadCsv } from './export.js';

/* ---------------- Estado ---------------- */

const DEFAULTS = { geometry: 'disco', mass: 2, radius: 0.3, length: 1, force: 0.3, direction: 1 };
const DECIMALS = { mass: 1, radius: 2, length: 2, force: 2 };
const SAMPLE_INTERVAL = 0.02; // s simulados entre amostras dos gráficos

const ui = {
  geometry: DEFAULTS.geometry,
  direction: DEFAULTS.direction,
  rate: 1,
  text: {
    mass: formatFixed(DEFAULTS.mass, DECIMALS.mass),
    radius: formatFixed(DEFAULTS.radius, DECIMALS.radius),
    length: formatFixed(DEFAULTS.length, DECIMALS.length),
    force: formatFixed(DEFAULTS.force, DECIMALS.force),
  },
};

const dimKey = () => GEOMETRIES[ui.geometry].dimensao; // 'radius' | 'length'

function currentParams() {
  return {
    geometry: ui.geometry,
    mass: parseDecimal(ui.text.mass),
    size: parseDecimal(ui.text[dimKey()]),
    force: parseDecimal(ui.text.force),
    direction: ui.direction,
  };
}

const experiment = new Experiment(currentParams());
let samples = [];
let samplesDirty = true;

/* ---------------- DOM ---------------- */

const $ = (sel) => document.querySelector(sel);
const el = {
  viewport: $('#viewport'),
  fallback: $('#webgl-fallback'),
  fallbackText: $('#webgl-fallback-text'),
  statusChip: $('#status-chip'),
  statusText: $('#status-text'),
  clock: $('#clock-value'),
  btnRun: $('#btn-run'),
  runLabel: $('#run-label'),
  runIcon: $('#run-icon'),
  btnReset: $('#btn-reset'),
  btnExportCsv: $('#btn-export-csv'),
  btnView: $('#btn-view'),
  notice: $('#notice'),
  alias: $('#alias-hint'),
  legendAxis: $('#legend-axis'),
  sizeLabel: $('#size-label'),
  equations: $('#equations'),
  outputs: Object.fromEntries([...document.querySelectorAll('[data-out]')].map((n) => [n.dataset.out, n])),
  fields: {
    mass: { input: $('#mass-input'), range: $('#mass-range'), hint: $('#mass-hint'), error: $('#mass-error') },
    size: { input: $('#size-input'), range: $('#size-range'), hint: $('#size-hint'), error: $('#size-error') },
    force: { input: $('#force-input'), range: $('#force-range'), hint: $('#force-hint'), error: $('#force-error') },
  },
  comparison: {
    run: $('#btn-comparison-run'),
    reset: $('#btn-comparison-reset'),
    mass: $('#comparison-mass'),
    radius: $('#comparison-radius'),
    force: $('#comparison-force'),
    notice: $('#comparison-notice'),
    diskCanvas: $('#comparison-disk'),
    ringCanvas: $('#comparison-ring'),
    outputs: Object.fromEntries([...document.querySelectorAll('[data-compare]')].map((node) => [node.dataset.compare, node])),
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
  if (!lab || !experiment.dynamics) return;
  const p = experiment.params;
  lab.setParams({ ...p, arm: experiment.dynamics.b });
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
  el.sizeLabel.innerHTML = isBar ? 'Comprimento <var>L</var>' : 'Raio <var>R</var>';
  el.fields.size.range.setAttribute('aria-label', isBar ? 'Comprimento L em metros (controle deslizante)' : 'Raio R em metros (controle deslizante)');
  el.fields.size.hint.textContent = `Entre ${fmtLimit(lim.min)} e ${fmtLimit(lim.max)} m · ${isBar ? 'força na extremidade (b = L/2)' : 'força na borda (b = R)'}`;
  configureRange(el.fields.size.range, lim);
  el.fields.size.input.value = ui.text[dimKey()];
  el.legendAxis.textContent = GEOMETRIES[ui.geometry].eixo + '.';
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

function resetRun() {
  experiment.reset();
  samples = [];
  samplesDirty = true;
  aliasVisible = false;
  el.alias.hidden = true;
}

/** Qualquer alteração de parâmetro físico pausa e reinicia o experimento. */
function applyParams() {
  const progressed = experiment.time > 0 || experiment.status === 'running';
  experiment.setParams(currentParams());
  resetRun();
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
  configureRange(el.fields.force.range, LIMITS.force);
  el.fields.mass.hint.textContent = `Entre ${fmtLimit(LIMITS.mass.min)} e ${fmtLimit(LIMITS.mass.max)} kg (deve ser maior que zero)`;
  el.fields.force.hint.textContent = `Entre 0 e ${fmtLimit(LIMITS.force.max)} N (F = 0 é permitido)`;
  el.fields.mass.input.value = ui.text.mass;
  el.fields.force.input.value = ui.text.force;
  refreshFieldLabels();
  ['mass', 'size', 'force'].forEach((k) => {
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
  $('#params-form').addEventListener('submit', (e) => e.preventDefault());
}

/* ---------------- Execução ---------------- */

function pushSample(force = false) {
  const s = experiment.state;
  if (!s) return;
  const last = samples[samples.length - 1];
  if (force || !last || s.t - last.t >= SAMPLE_INTERVAL) {
    samples.push({ t: s.t, omega: s.omega, theta: s.theta, alpha: s.alpha });
    samplesDirty = true;
  }
}

el.btnRun.addEventListener('click', () => {
  if (experiment.status === 'running') {
    experiment.pause();
  } else if (experiment.start()) {
    if (samples.length === 0) pushSample(true);
    el.notice.classList.remove('is-visible');
  }
  updateControls();
});

el.btnReset.addEventListener('click', () => {
  resetRun();
  if (lab) lab.setAngle(0);
  showNotice('Experimento reiniciado em t = 0 s.', 'info');
  updateControls();
});

el.btnExportCsv.addEventListener('click', () => {
  if (!samples.length || !experiment.dynamics) return;
  const geometry = GEOMETRIES[ui.geometry].id;
  const stamp = new Date().toISOString().slice(0, 10);
  const csv = buildExperimentCsv({ params: experiment.params, dynamics: experiment.dynamics, samples });
  downloadCsv(`dinamica-rotacional-${geometry}-${stamp}.csv`, csv);
  showNotice('Dados exportados em CSV com parâmetros e unidades SI.', 'info');
});

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
    el.statusText.textContent = 'Pausado';
  } else if (s === 'finished') {
    setRunButton('done', 'Concluído', true);
    el.statusText.textContent = `Concluído · ${MAX_SIM_TIME} s`;
  } else {
    setRunButton('play', 'Iniciar', false);
    el.statusText.textContent = `Pronto · ${rateTxt}`;
  }
  el.statusChip.dataset.status = status;
  el.btnReset.disabled = experiment.time === 0 && s === 'idle';
  el.btnExportCsv.disabled = samples.length === 0 || !valid;
}

/* ---------------- Saídas ---------------- */

function setText(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}

function updateReadouts() {
  const s = experiment.state;
  setText(el.clock, formatFixed(experiment.time, 2));
  setText(el.outputs.t, formatFixed(experiment.time, 2));
  if (!s) {
    ['I', 'tau', 'alpha', 'omega', 'theta'].forEach((k) => setText(el.outputs[k], '—'));
    setText(el.outputs.turns, '—');
    return;
  }
  setText(el.outputs.I, formatNumber(s.I, 4));
  setText(el.outputs.tau, formatNumber(s.tau, 4));
  setText(el.outputs.alpha, formatNumber(s.alpha, 4));
  setText(el.outputs.omega, formatNumber(s.omega, 4));
  setText(el.outputs.theta, formatNumber(s.theta, 4));
  const turns = s.theta / (2 * Math.PI);
  const abs = Math.abs(turns);
  setText(el.outputs.turns, `≈ ${formatNumber(turns, 3)} ${abs > 0 && abs < 2 ? 'volta' : 'voltas'}`);
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
  const g = GEOMETRIES[ui.geometry];
  if (!d) {
    el.equations.append(eq('<span class="eq-muted">Equações indisponíveis: verifique os parâmetros.</span>'));
    return;
  }
  el.equations.append(
    eq(`<span class="eq-k">${g.formulaI}</span> = <b>${formatNumber(d.I, 4)}</b> kg·m²`),
    eq(`<span class="eq-k">τ = ${ui.direction > 0 ? '+' : '−'}b·F</span>, ${g.formulaB} = ${formatNumber(d.b, 4)} m ⇒ τ = <b>${formatNumber(d.tau, 4)}</b> N·m`),
    eq(`<span class="eq-k">α = τ / I</span> = <b>${formatNumber(d.alpha, 4)}</b> rad/s²`),
    eq(`<span class="eq-k">ω = α t</span> · <span class="eq-k">θ = ½ α t²</span>`)
  );
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
          ? 'Giro rápido: a animação pode parecer lenta, parada ou invertida por amostragem visual (efeito estroboscópico). Reduza a reprodução para 0,25× ou 0,5×. Os valores numéricos permanecem corretos.'
          : 'Giro rápido: a animação pode parecer lenta ou invertida por amostragem visual. Os valores numéricos e os gráficos permanecem corretos.';
    }
  }
}

/* ---------------- Gráficos ---------------- */

const charts = [
  { chart: createChart($('#chart-omega'), { key: 'omega', color: '#38d6f5', label: 'ω', unit: 'rad/s' }), node: $('#chart-omega') },
  { chart: createChart($('#chart-theta'), { key: 'theta', color: '#ffb547', label: 'θ', unit: 'rad' }), node: $('#chart-theta') },
  { chart: createChart($('#chart-alpha'), { key: 'alpha', color: '#a78bfa', label: 'α', unit: 'rad/s²' }), node: $('#chart-alpha') },
];

function updateCharts() {
  if (!samplesDirty) return;
  samplesDirty = false;
  const empty = samples.length < 2;
  for (const { chart, node } of charts) {
    chart.setSamples(samples);
    node.parentElement.querySelector('[data-empty]').hidden = !empty;
  }
}

/* ---------------- Comparação: disco × anel ---------------- */

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
const comparison = { disk: null, ring: null, samples: [], dirty: true };

function comparisonParams(geometry) {
  return {
    geometry,
    mass: Number(el.comparison.mass.value),
    size: Number(el.comparison.radius.value),
    force: Number(el.comparison.force.value),
    direction: 1,
  };
}

function comparisonStatus() {
  return comparison.disk?.status ?? 'idle';
}

function setCompareText(key, value) {
  const node = el.comparison.outputs[key];
  if (node) node.textContent = value;
}

function drawComparisonBody(canvas, geometry, theta) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.29;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#071a36';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(120,160,220,0.26)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = 0; y <= height; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(theta);
  if (geometry === 'disco') {
    ctx.fillStyle = '#2f6fd6'; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = '#ffb547'; ctx.lineWidth = radius * 0.23; ctx.beginPath(); ctx.arc(0, 0, radius * 0.82, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = '#cfe8ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -radius * 0.84); ctx.stroke();
  ctx.strokeStyle = '#ff6a3d'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(radius * 0.25, -radius * 0.76); ctx.lineTo(radius * 0.74, -radius * 0.76); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#b9cdea'; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('eixo fixo • força tangencial', cx, height - 12);
}

function updateComparison() {
  const diskState = comparison.disk?.state;
  const ringState = comparison.ring?.state;
  if (!diskState || !ringState) return;
  setCompareText('disk-I', `${formatNumber(diskState.I, 3)} kg·m²`);
  setCompareText('disk-alpha', `${formatNumber(diskState.alpha, 3)} rad/s²`);
  setCompareText('disk-omega', `${formatNumber(diskState.omega, 3)} rad/s`);
  setCompareText('disk-theta', `${formatNumber(diskState.theta, 3)} rad`);
  setCompareText('ring-I', `${formatNumber(ringState.I, 3)} kg·m²`);
  setCompareText('ring-alpha', `${formatNumber(ringState.alpha, 3)} rad/s²`);
  setCompareText('ring-omega', `${formatNumber(ringState.omega, 3)} rad/s`);
  setCompareText('ring-theta', `${formatNumber(ringState.theta, 3)} rad`);
  drawComparisonBody(el.comparison.diskCanvas, 'disco', diskState.theta);
  drawComparisonBody(el.comparison.ringCanvas, 'anel', ringState.theta);
  const status = comparisonStatus();
  el.comparison.run.textContent = status === 'running' ? 'Pausar comparação' : status === 'paused' ? 'Continuar comparação' : status === 'finished' ? 'Concluída' : 'Iniciar comparação';
  el.comparison.run.disabled = status === 'finished';
  if (comparison.dirty) {
    comparison.dirty = false;
    comparisonCharts.forEach((chart) => chart.setSamples(comparison.samples));
  }
}

function resetComparison(message = '') {
  const diskParams = comparisonParams('disco');
  const ringParams = comparisonParams('anel');
  const valid = validateParams(diskParams).valid && validateParams(ringParams).valid;
  if (!valid) {
    el.comparison.notice.textContent = 'Use massa e raio positivos dentro dos limites, e força entre 0 e 5 N.';
    return false;
  }
  comparison.disk = new Experiment(diskParams);
  comparison.ring = new Experiment(ringParams);
  comparison.samples = [];
  comparison.dirty = true;
  el.comparison.notice.textContent = message;
  updateComparison();
  return true;
}

function pushComparisonSample(force = false) {
  const disk = comparison.disk?.state;
  const ring = comparison.ring?.state;
  if (!disk || !ring) return;
  const last = comparison.samples.at(-1);
  if (force || !last || disk.t - last.t >= SAMPLE_INTERVAL) {
    comparison.samples.push({
      t: disk.t,
      diskAlpha: disk.alpha,
      ringAlpha: ring.alpha,
      diskOmega: disk.omega,
      ringOmega: ring.omega,
      diskTheta: disk.theta,
      ringTheta: ring.theta,
    });
    comparison.dirty = true;
  }
}

function toggleComparison() {
  if (!comparison.disk && !resetComparison()) return;
  if (comparisonStatus() === 'running') {
    comparison.disk.pause(); comparison.ring.pause();
  } else if (comparison.disk.start() && comparison.ring.start()) {
    if (!comparison.samples.length) pushComparisonSample(true);
    el.comparison.notice.textContent = 'Relógio comum em execução: compare as curvas e os valores coloridos.';
  }
  updateComparison();
}

el.comparison.run.addEventListener('click', toggleComparison);
el.comparison.reset.addEventListener('click', () => resetComparison('Comparação reiniciada em t = 0 s.'));
[el.comparison.mass, el.comparison.radius, el.comparison.force].forEach((input) => input.addEventListener('change', () => resetComparison('Parâmetros da comparação atualizados.')));

function applyGuidedExperiment(kind) {
  if (kind === 'comparison') {
    el.comparison.mass.value = '2'; el.comparison.radius.value = '0.5'; el.comparison.force.value = '1';
    resetComparison('Roteiro carregado: M = 2 kg, R = 0,5 m e F = 1 N. Disco: α = 2; anel: α = 1 rad/s².');
    $('#comparacao').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  ui.geometry = 'disco';
  ui.text.radius = '0,50';
  ui.text.mass = kind === 'mass' ? '4,0' : '2,0';
  ui.text.force = kind === 'force' ? '2,00' : '1,00';
  document.querySelector('input[name="geometry"][value="disco"]').checked = true;
  refreshFieldLabels();
  el.fields.mass.input.value = ui.text.mass;
  el.fields.force.input.value = ui.text.force;
  syncRangeFromText('mass'); syncRangeFromText('size'); syncRangeFromText('force');
  applyParams();
  showNotice(kind === 'mass' ? 'Roteiro carregado: M = 4 kg. Compare com M = 2 kg; α deve cair pela metade.' : 'Roteiro carregado: F = 2 N. Compare com F = 1 N; α deve dobrar.', 'info');
}

document.querySelectorAll('[data-guide]').forEach((button) => button.addEventListener('click', () => applyGuidedExperiment(button.dataset.guide)));

/* ---------------- Laço único de animação ---------------- */

let rafId = 0;
let lastTime = null;

function frame(now) {
  rafId = requestAnimationFrame(frame);
  const dt = lastTime === null ? 0 : (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0 && dt < 0.5) avgFrameDt = avgFrameDt * 0.9 + dt * 0.1;

  if (experiment.status === 'running') {
    experiment.advance(dt, ui.rate);
    pushSample(experiment.status === 'finished');
    if (experiment.status === 'finished') {
      updateControls();
      showNotice(`Limite de ${MAX_SIM_TIME} s simulados atingido. Use Reiniciar para uma nova execução.`, 'info', true);
    }
  }

  if (comparisonStatus() === 'running') {
    comparison.disk.advance(dt, ui.rate);
    comparison.ring.advance(dt, ui.rate);
    pushComparisonSample(comparisonStatus() === 'finished');
    if (comparisonStatus() === 'finished') el.comparison.notice.textContent = `Comparação finalizada em ${MAX_SIM_TIME} s simulados.`;
  }

  updateReadouts();
  updateAliasHint();
  updateCharts();
  updateComparison();
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
resetComparison('Ajuste as condições e inicie a comparação.');
renderEquations();
updateControls();
updateReadouts();
startLoop();
initScene();
