import './style.css';
import {
  Experiment,
  GEOMETRIES,
  LIMITS,
  MAX_SIM_TIME,
  PLAYBACK_RATES,
  canvasRotationAngle,
  validateParams,
} from './physics.js';
import { formatFixed, formatNumber, parseDecimal } from './format.js';
import { createChart, createComparisonChart, createSteinerInertiaChart } from './charts.js';
import { buildExperimentCsv, downloadCsv } from './export.js';

/* ---------------- Estado ---------------- */

const DEFAULTS = {
  geometry: 'disco',
  mass: 2,
  radius: 0.3,
  length: 1,
  axisOffset: 0,
  force: 0.3,
  direction: 1,
};
const DECIMALS = { mass: 1, radius: 2, length: 2, axisOffset: 2, force: 2 };
const SAMPLE_INTERVAL = 0.02; // s simulados entre amostras dos gráficos

const ui = {
  geometry: DEFAULTS.geometry,
  direction: DEFAULTS.direction,
  rate: 1,
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
    axisOffset: { input: $('#offset-input'), range: $('#offset-range'), hint: $('#offset-hint'), error: $('#offset-error') },
    force: { input: $('#force-input'), range: $('#force-range'), hint: $('#force-hint'), error: $('#force-error') },
  },
  comparison: {
    run: $('#btn-comparison-run'),
    reset: $('#btn-comparison-reset'),
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
  el.fields.size.hint.textContent = `Entre ${fmtLimit(lim.min)} e ${fmtLimit(lim.max)} m · ${isBar ? 'b_cm = L/2 (braço total b = L/2 + d)' : 'b_cm = R (braço total b = R + d)'}`;
  configureRange(el.fields.size.range, lim);
  el.fields.size.input.value = ui.text[dimKey()];
  const axisDesc = GEOMETRIES[ui.geometry].eixo;
  el.legendAxis.textContent =
    Number.isFinite(dVal) && dVal > 0
      ? `${axisDesc} (deslocado de d = ${formatNumber(dVal, 3)} m do CM).`
      : `${axisDesc} (passando pelo CM, d = 0 m).`;
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
  el.fields.mass.hint.textContent = `Entre ${fmtLimit(LIMITS.mass.min)} e ${fmtLimit(LIMITS.mass.max)} kg (deve ser maior que zero)`;
  el.fields.axisOffset.hint.textContent = `Entre 0 e ${fmtLimit(LIMITS.axisOffset.max)} m · d = 0 m mantém o eixo no CM (Steiner: I = Icm + Md²)`;
  el.fields.force.hint.textContent = `Entre 0 e ${fmtLimit(LIMITS.force.max)} N (F = 0 é permitido)`;
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
  $('#params-form').addEventListener('submit', (e) => e.preventDefault());
}

/* ---------------- Execução ---------------- */

function pushSample(force = false) {
  const s = experiment.state;
  if (!s) return;
  const last = samples[samples.length - 1];
  if (last && Math.abs(s.t - last.t) < 1e-9) return;
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
  updateReadouts();
  updateCharts();
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
    setText(el.outputs['inertia-sub'], 'Icm = — · Md² = —');
    setText(el.outputs['torque-sub'], 'b = — m');
    setText(el.outputs.turns, '—');
    return;
  }
  setText(el.outputs.I, formatNumber(s.I, 4));
  setText(el.outputs['inertia-sub'], `Icm = ${formatNumber(s.Icm, 3)} · Md² = ${formatNumber(s.Id, 3)}`);
  setText(el.outputs.tau, formatNumber(s.tau, 4));
  setText(
    el.outputs['torque-sub'],
    s.axisOffset > 0
      ? `b = ${formatNumber(s.b, 3)} m (${formatNumber(s.bCm, 3)} + d)`
      : `b = ${formatNumber(s.b, 3)} m (d = 0)`
  );
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
    eq(
      `<span class="eq-k">${g.formulaI}</span> = ${formatNumber(d.Icm, 4)} + ${formatNumber(d.Id, 4)} = <b>${formatNumber(d.I, 4)}</b> kg·m²`
    ),
    eq(
      `<span class="eq-k">τ = (r × F)<sub>eixo</sub> = ${ui.direction > 0 ? '+' : '−'}b·F</span>, ${g.formulaB} = ${formatNumber(d.b, 4)} m ⇒ τ = <b>${formatNumber(d.tau, 4)}</b> N·m`
    ),
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

  // Haste de deslocamento d entre o eixo fixo (0,0) e o CM (0, cmY)
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
const comparison = { disk: null, ring: null, samples: [], dirty: true };

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

function updateComparison() {
  const diskState = comparison.disk?.state;
  const ringState = comparison.ring?.state;
  setText(el.comparison.clock, formatFixed(comparison.disk?.time ?? 0, 2));
  if (!diskState || !ringState) {
    ['disk-I', 'disk-tau', 'disk-alpha', 'disk-omega', 'disk-theta', 'ring-I', 'ring-tau', 'ring-alpha', 'ring-omega', 'ring-theta'].forEach((k) =>
      setCompareText(k, '—')
    );
    drawComparisonBody(el.comparison.diskCanvas, 'disco', 0, { force: 0, direction: 1 });
    drawComparisonBody(el.comparison.ringCanvas, 'anel', 0, { force: 0, direction: 1 });
    el.comparison.run.textContent = 'Iniciar comparação';
    el.comparison.run.disabled = true;
    if (comparison.dirty) {
      comparison.dirty = false;
      comparisonCharts.forEach((chart) => chart.setSamples([]));
    }
    return;
  }
  const { force, direction, size } = comparison.disk.params;
  setCompareText('disk-I', `${formatNumber(diskState.I, 3)} kg·m²`);
  setCompareText('disk-tau', `${formatNumber(diskState.tau, 3)} N·m`);
  setCompareText('disk-alpha', `${formatNumber(diskState.alpha, 3)} rad/s²`);
  setCompareText('disk-omega', `${formatNumber(diskState.omega, 3)} rad/s`);
  setCompareText('disk-theta', `${formatNumber(diskState.theta, 3)} rad`);
  setCompareText('ring-I', `${formatNumber(ringState.I, 3)} kg·m²`);
  setCompareText('ring-tau', `${formatNumber(ringState.tau, 3)} N·m`);
  setCompareText('ring-alpha', `${formatNumber(ringState.alpha, 3)} rad/s²`);
  setCompareText('ring-omega', `${formatNumber(ringState.omega, 3)} rad/s`);
  setCompareText('ring-theta', `${formatNumber(ringState.theta, 3)} rad`);
  drawComparisonBody(el.comparison.diskCanvas, 'disco', diskState.theta, { force, direction, axisOffset: 0, bCm: size });
  drawComparisonBody(el.comparison.ringCanvas, 'anel', ringState.theta, { force, direction, axisOffset: 0, bCm: size });
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
    comparison.dirty = true;
    const errMsg = diskVal.errors.mass || diskVal.errors.size || diskVal.errors.force || 'Use massa e raio positivos dentro dos limites, e força entre 0 e 5 N.';
    el.comparison.notice.textContent = `Parâmetros inválidos na comparação: ${errMsg}`;
    updateComparison();
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
  if (last && Math.abs(disk.t - last.t) < 1e-9) return;
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
    el.comparison.notice.textContent = 'Comparação pausada.';
  } else if (comparison.disk.start() && comparison.ring.start()) {
    if (!comparison.samples.length) pushComparisonSample(true);
    el.comparison.notice.textContent = 'Relógio comum em execução: compare as curvas e os valores coloridos.';
  }
  updateComparison();
}

el.comparison.run.addEventListener('click', toggleComparison);
el.comparison.reset.addEventListener('click', () => resetComparison('Comparação reiniciada em t = 0 s.'));
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
const steiner = { central: null, displaced: null, samples: [], dirty: true };

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

function updateSteinerComparison() {
  const cState = steiner.central?.state;
  const dState = steiner.displaced?.state;
  setText(el.steiner.clock, formatFixed(steiner.central?.time ?? 0, 2));
  if (!cState || !dState) {
    [
      'central-Icm', 'central-Id', 'central-I', 'central-tau', 'central-alpha', 'central-kin',
      'displaced-Icm', 'displaced-Id', 'displaced-I', 'displaced-tau', 'displaced-alpha', 'displaced-kin',
    ].forEach((k) => setSteinerText(k, '—'));
    const geo = el.steiner.geometry?.value ?? 'disco';
    drawComparisonBody(el.steiner.centralCanvas, geo, 0, { force: 0, direction: 1, axisOffset: 0 });
    drawComparisonBody(el.steiner.displacedCanvas, geo, 0, { force: 0, direction: 1, axisOffset: 0 });
    el.steiner.run.textContent = 'Iniciar comparação de Steiner';
    el.steiner.run.disabled = true;
    if (steiner.dirty) {
      steiner.dirty = false;
      steinerInertiaChart.setConfig(null);
      steinerTimeCharts.forEach((chart) => chart.setSamples([]));
    }
    return;
  }

  const { geometry, mass, torqueOverride, direction } = steiner.displaced.params;
  const dVal = dState.axisOffset;

  setSteinerText('central-Icm', `${formatNumber(cState.Icm, 4)} kg·m²`);
  setSteinerText('central-Id', `0 kg·m²`);
  setSteinerText('central-I', `${formatNumber(cState.I, 4)} kg·m²`);
  setSteinerText('central-tau', `${formatNumber(cState.tau, 4)} N·m`);
  setSteinerText('central-alpha', `${formatNumber(cState.alpha, 4)} rad/s²`);
  setSteinerText('central-kin', `${formatNumber(cState.omega, 3)} rad/s · ${formatNumber(cState.theta, 3)} rad`);

  setSteinerText('displaced-Icm', `${formatNumber(dState.Icm, 4)} kg·m²`);
  setSteinerText('displaced-Id', `${formatNumber(dState.Id, 4)} kg·m²`);
  setSteinerText('displaced-I', `${formatNumber(dState.I, 4)} kg·m²`);
  setSteinerText('displaced-tau', `${formatNumber(dState.tau, 4)} N·m`);
  setSteinerText('displaced-alpha', `${formatNumber(dState.alpha, 4)} rad/s²`);
  setSteinerText('displaced-kin', `${formatNumber(dState.omega, 3)} rad/s · ${formatNumber(dState.theta, 3)} rad`);

  const visForce = torqueOverride > 0 ? Math.min(torqueOverride * 2, 5) : 0;
  drawComparisonBody(el.steiner.centralCanvas, geometry, cState.theta, {
    force: visForce,
    direction,
    axisOffset: 0,
    bCm: cState.bCm,
    subtitle: `d = 0 m • I = ${formatNumber(cState.I, 3)} kg·m² • α = ${formatNumber(cState.alpha, 3)} rad/s²`,
  });
  drawComparisonBody(el.steiner.displacedCanvas, geometry, dState.theta, {
    force: visForce,
    direction,
    axisOffset: dVal,
    bCm: dState.bCm,
    subtitle: `d = ${formatNumber(dVal, 2)} m • I = ${formatNumber(dState.I, 3)} kg·m² • α = ${formatNumber(dState.alpha, 3)} rad/s²`,
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
  steiner.dirty = true;
  el.steiner.notice.textContent = message;
  updateSteinerComparison();
  return true;
}

function pushSteinerSample(force = false) {
  const c = steiner.central?.state;
  const d = steiner.displaced?.state;
  if (!c || !d) return;
  const last = steiner.samples.at(-1);
  if (last && Math.abs(c.t - last.t) < 1e-9) return;
  if (force || !last || c.t - last.t >= SAMPLE_INTERVAL) {
    steiner.samples.push({
      t: c.t,
      centralOmega: c.omega,
      displacedOmega: d.omega,
      centralTheta: c.theta,
      displacedTheta: d.theta,
    });
    steiner.dirty = true;
  }
}

function toggleSteinerComparison() {
  if (!steiner.central && !resetSteinerComparison()) return;
  if (steinerStatus() === 'running') {
    steiner.central.pause();
    steiner.displaced.pause();
    el.steiner.notice.textContent = 'Comparação de Steiner pausada.';
  } else if (steiner.central.start() && steiner.displaced.start()) {
    if (!steiner.samples.length) pushSteinerSample(true);
    el.steiner.notice.textContent = 'Relógio comum em execução: observe como o termo Md² reduz a aceleração angular.';
  }
  updateSteinerComparison();
}

el.steiner.run.addEventListener('click', toggleSteinerComparison);
el.steiner.reset.addEventListener('click', () => resetSteinerComparison('Comparação de Steiner reiniciada em t = 0 s.'));
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
    resetComparison('Roteiro carregado: M = 2 kg, R = 0,5 m e F = 1 N. Disco: α = 2; anel: α = 1 rad/s².');
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
      'Roteiro Steiner carregado: M = 2 kg, R = 0,5 m, d = 0,5 m e τ = 0,5 N·m. Icm = 0,25 → I = 0,75 kg·m²; α cai de 2 para ≈ 0,667 rad/s².'
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
      'Roteiro Steiner 3D carregado: d = 0,50 m. I = 0,25 + 0,50 = 0,75 kg·m², braço b = R + d = 1,0 m e τ = 1,0 N·m.',
      'info'
    );
  } else {
    showNotice(
      kind === 'mass'
        ? 'Roteiro carregado: M = 4 kg (d = 0 m). Compare com M = 2 kg; α cai pela metade.'
        : 'Roteiro carregado: F = 2 N (d = 0 m). Compare com F = 1 N; α dobra.',
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

  if (steinerStatus() === 'running') {
    steiner.central.advance(dt, ui.rate);
    steiner.displaced.advance(dt, ui.rate);
    pushSteinerSample(steinerStatus() === 'finished');
    if (steinerStatus() === 'finished') el.steiner.notice.textContent = `Comparação de Steiner finalizada em ${MAX_SIM_TIME} s simulados.`;
  }

  updateReadouts();
  updateAliasHint();
  updateCharts();
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
resetComparison('Ajuste as condições e inicie a comparação.');
resetSteinerComparison('Compare o eixo central (d = 0) com o eixo deslocado (d = 0,5 m) sob o mesmo torque.');
renderEquations();
updateControls();
updateReadouts();
startLoop();
initScene();
