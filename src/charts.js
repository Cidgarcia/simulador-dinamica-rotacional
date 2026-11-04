/**
 * Gráficos leves em Canvas 2D. Recebem amostras { t, omega, theta } no tempo
 * SIMULADO (o mesmo usado pela animação e pelos mostradores).
 */
import { MAX_SIM_TIME } from './physics.js';
import { formatNumber } from './format.js';

function niceStep(range, target = 5) {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  const step = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return step * mag;
}

export function createChart(canvas, { key, measuredKey, color, label, unit }) {
  const ctx = canvas.getContext('2d');
  let samples = [];
  let noiseEnabled = false;
  let cssW = 0;
  let cssH = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = Math.max(rect.width, 1);
    cssH = Math.max(rect.height, 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw() {
    const W = cssW;
    const H = cssH;
    ctx.clearRect(0, 0, W, H);
    const pad = { l: 58, r: 14, t: 14, b: 30 };
    const pw = W - pad.l - pad.r;
    const ph = H - pad.t - pad.b;
    if (pw <= 10 || ph <= 10) return;

    let min = 0;
    let max = 0;
    for (const s of samples) {
      const vTeo = s[key];
      const vMed = noiseEnabled && measuredKey ? s[measuredKey] : vTeo;
      if (Number.isFinite(vTeo)) {
        if (vTeo < min) min = vTeo;
        if (vTeo > max) max = vTeo;
      }
      if (Number.isFinite(vMed)) {
        if (vMed < min) min = vMed;
        if (vMed > max) max = vMed;
      }
    }
    if (max - min < 1e-12) {
      max = min + 1;
    }
    const step = niceStep(max - min);
    min = Math.floor(min / step) * step;
    max = Math.ceil(max / step) * step;
    if (max === min) max = min + step;

    const x = (t) => pad.l + (t / MAX_SIM_TIME) * pw;
    const y = (v) => pad.t + ph - ((v - min) / (max - min)) * ph;

    ctx.font = '11px system-ui, "Segoe UI", Roboto, sans-serif';
    ctx.lineWidth = 1;

    // grade horizontal + rótulos
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let v = min; v <= max + step * 1e-6; v += step) {
      const yy = Math.round(y(v)) + 0.5;
      ctx.strokeStyle = Math.abs(v) < step * 1e-6 ? 'rgba(159,197,255,0.55)' : 'rgba(120,160,220,0.14)';
      ctx.beginPath();
      ctx.moveTo(pad.l, yy);
      ctx.lineTo(pad.l + pw, yy);
      ctx.stroke();
      ctx.fillStyle = '#8fa9cc';
      ctx.fillText(formatNumber(Math.abs(v) < step * 1e-6 ? 0 : v, 3), pad.l - 6, yy);
    }
    // grade vertical (tempo)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let t = 0; t <= MAX_SIM_TIME; t += 5) {
      const xx = Math.round(x(t)) + 0.5;
      ctx.strokeStyle = 'rgba(120,160,220,0.14)';
      ctx.beginPath();
      ctx.moveTo(xx, pad.t);
      ctx.lineTo(xx, pad.t + ph);
      ctx.stroke();
      ctx.fillStyle = '#8fa9cc';
      ctx.fillText(String(t), xx, pad.t + ph + 6);
    }
    ctx.fillText('t (s)', pad.l - 26, pad.t + ph + 6);

    // eixo Y: rótulo
    ctx.save();
    ctx.translate(12, pad.t + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#b9cdea';
    ctx.fillText(`${label} (${unit})`, 0, 0);
    ctx.restore();

    if (samples.length < 2) return;

    if (noiseEnabled && measuredKey) {
      // Curva teórica tracejada de referência
      ctx.save();
      ctx.strokeStyle = 'rgba(207, 232, 255, 0.42)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      let startedTeo = false;
      for (const s of samples) {
        const vTeo = s[key];
        if (!Number.isFinite(vTeo)) continue;
        if (!startedTeo) {
          ctx.moveTo(x(s.t), y(vTeo));
          startedTeo = true;
        } else ctx.lineTo(x(s.t), y(vTeo));
      }
      ctx.stroke();
      ctx.restore();

      // Trilha experimental medida com dispersão
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let startedMed = false;
      for (const s of samples) {
        const vMed = s[measuredKey] ?? s[key];
        if (!Number.isFinite(vMed)) continue;
        if (!startedMed) {
          ctx.moveTo(x(s.t), y(vMed));
          startedMed = true;
        } else ctx.lineTo(x(s.t), y(vMed));
      }
      ctx.stroke();

      // Pontos experimentais discretizados para destacar a dispersão
      ctx.fillStyle = color;
      const stride = Math.max(1, Math.floor(samples.length / 45));
      for (let i = 0; i < samples.length; i += stride) {
        const s = samples[i];
        const vMed = s[measuredKey] ?? s[key];
        if (!Number.isFinite(vMed)) continue;
        ctx.beginPath();
        ctx.arc(x(s.t), y(vMed), 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Curva determinística limpa
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let started = false;
      for (const s of samples) {
        const v = s[key];
        if (!Number.isFinite(v)) continue;
        if (!started) {
          ctx.moveTo(x(s.t), y(v));
          started = true;
        } else ctx.lineTo(x(s.t), y(v));
      }
      ctx.stroke();
    }

    const last = samples[samples.length - 1];
    const lastVal = noiseEnabled && measuredKey ? (last[measuredKey] ?? last[key]) : last[key];
    if (Number.isFinite(lastVal)) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x(last.t), y(lastVal), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  return {
    setSamples(s, opts = {}) {
      samples = s;
      if (typeof opts.noiseEnabled === 'boolean') noiseEnabled = opts.noiseEnabled;
      draw();
    },
    redraw: draw,
    dispose: () => ro.disconnect(),
  };
}

/** Gráfico com duas curvas no mesmo relógio, usado na comparação disco × anel. */
export function createComparisonChart(canvas, { key, label, unit, series }) {
  const ctx = canvas.getContext('2d');
  let samples = [];
  let cssW = 0;
  let cssH = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = Math.max(rect.width, 1);
    cssH = Math.max(rect.height, 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw() {
    const W = cssW;
    const H = cssH;
    ctx.clearRect(0, 0, W, H);
    const pad = { l: 58, r: 14, t: 14, b: 30 };
    const pw = W - pad.l - pad.r;
    const ph = H - pad.t - pad.b;
    if (pw <= 10 || ph <= 10) return;

    const values = samples.flatMap((sample) => series.map((item) => sample[item.key])).filter(Number.isFinite);
    let min = Math.min(0, ...values);
    let max = Math.max(0, ...values);
    if (max - min < 1e-12) max = min + 1;
    const step = niceStep(max - min);
    min = Math.floor(min / step) * step;
    max = Math.ceil(max / step) * step;
    if (max === min) max = min + step;
    const x = (t) => pad.l + (t / MAX_SIM_TIME) * pw;
    const y = (value) => pad.t + ph - ((value - min) / (max - min)) * ph;

    ctx.font = '11px system-ui, "Segoe UI", Roboto, sans-serif';
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let value = min; value <= max + step * 1e-6; value += step) {
      const yy = Math.round(y(value)) + 0.5;
      ctx.strokeStyle = Math.abs(value) < step * 1e-6 ? 'rgba(159,197,255,0.55)' : 'rgba(120,160,220,0.14)';
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(pad.l + pw, yy); ctx.stroke();
      ctx.fillStyle = '#8fa9cc';
      ctx.fillText(formatNumber(Math.abs(value) < step * 1e-6 ? 0 : value, 3), pad.l - 6, yy);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let time = 0; time <= MAX_SIM_TIME; time += 5) {
      const xx = Math.round(x(time)) + 0.5;
      ctx.strokeStyle = 'rgba(120,160,220,0.14)';
      ctx.beginPath(); ctx.moveTo(xx, pad.t); ctx.lineTo(xx, pad.t + ph); ctx.stroke();
      ctx.fillStyle = '#8fa9cc'; ctx.fillText(String(time), xx, pad.t + ph + 6);
    }
    ctx.fillText('t (s)', pad.l - 26, pad.t + ph + 6);
    ctx.save(); ctx.translate(12, pad.t + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#b9cdea';
    ctx.fillText(`${label} (${unit})`, 0, 0); ctx.restore();

    if (samples.length < 2) return;
    const last = samples[samples.length - 1];
    for (const item of series) {
      ctx.strokeStyle = item.color; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.beginPath();
      let started = false;
      for (const sample of samples) {
        const val = sample[item.key];
        if (!Number.isFinite(val)) continue;
        if (!started) {
          ctx.moveTo(x(sample.t), y(val));
          started = true;
        } else {
          ctx.lineTo(x(sample.t), y(val));
        }
      }
      ctx.stroke();
      if (last && Number.isFinite(last[item.key])) {
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(x(last.t), y(last[item.key]), 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  return { setSamples(next) { samples = next; draw(); }, dispose: () => observer.disconnect() };
}

/**
 * Gráfico estático/interativo da curva quadrática do Teorema de Steiner:
 * I(d) = Icm + M d² em função de d ∈ [0, maxD].
 */
export function createSteinerInertiaChart(canvas, { maxD = 1 } = {}) {
  const ctx = canvas.getContext('2d');
  let config = null; // { Icm, mass, d }
  let cssW = 0;
  let cssH = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = Math.max(rect.width, 1);
    cssH = Math.max(rect.height, 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw() {
    const W = cssW;
    const H = cssH;
    ctx.clearRect(0, 0, W, H);
    const pad = { l: 58, r: 16, t: 14, b: 30 };
    const pw = W - pad.l - pad.r;
    const ph = H - pad.t - pad.b;
    if (pw <= 10 || ph <= 10) return;

    const Icm = config?.Icm ?? 0.25;
    const mass = config?.mass ?? 2;
    const curD = config?.d ?? 0.5;
    const dLimit = Math.max(maxD, curD, 0.5);
    const maxVal = Math.max(Icm + mass * dLimit * dLimit, 1e-6);
    const step = niceStep(maxVal);
    const min = 0;
    const max = Math.max(Math.ceil(maxVal / step) * step, step);

    const x = (dVal) => pad.l + (dVal / dLimit) * pw;
    const y = (iVal) => pad.t + ph - ((iVal - min) / (max - min)) * ph;

    ctx.font = '11px system-ui, "Segoe UI", Roboto, sans-serif';
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let value = min; value <= max + step * 1e-6; value += step) {
      const yy = Math.round(y(value)) + 0.5;
      ctx.strokeStyle = Math.abs(value) < step * 1e-6 ? 'rgba(159,197,255,0.55)' : 'rgba(120,160,220,0.14)';
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(pad.l + pw, yy); ctx.stroke();
      ctx.fillStyle = '#8fa9cc';
      ctx.fillText(formatNumber(Math.abs(value) < step * 1e-6 ? 0 : value, 3), pad.l - 6, yy);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const dStep = dLimit <= 0.5 ? 0.1 : 0.25;
    for (let dVal = 0; dVal <= dLimit + 1e-6; dVal += dStep) {
      const xx = Math.round(x(dVal)) + 0.5;
      ctx.strokeStyle = 'rgba(120,160,220,0.14)';
      ctx.beginPath(); ctx.moveTo(xx, pad.t); ctx.lineTo(xx, pad.t + ph); ctx.stroke();
      ctx.fillStyle = '#8fa9cc';
      ctx.fillText(formatNumber(dVal, 2), xx, pad.t + ph + 6);
    }
    ctx.fillText('d (m)', pad.l - 26, pad.t + ph + 6);

    ctx.save();
    ctx.translate(12, pad.t + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#b9cdea';
    ctx.fillText('I (kg·m²)', 0, 0);
    ctx.restore();

    if (!config) return;

    // Linha horizontal tracejada Icm
    const yIcm = y(Icm);
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 214, 245, 0.65)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.l, yIcm);
    ctx.lineTo(pad.l + pw, yIcm);
    ctx.stroke();
    ctx.restore();

    // Curva parabólica I(d) = Icm + M d²
    ctx.strokeStyle = '#ffb547';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const dVal = (i / steps) * dLimit;
      const iVal = Icm + mass * dVal * dVal;
      if (i === 0) ctx.moveTo(x(dVal), y(iVal));
      else ctx.lineTo(x(dVal), y(iVal));
    }
    ctx.stroke();

    // Ponto central (0, Icm)
    ctx.fillStyle = '#38d6f5';
    ctx.beginPath();
    ctx.arc(x(0), yIcm, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Ponto deslocado (d, Icm + M d²)
    const curI = Icm + mass * curD * curD;
    const xxD = x(curD);
    const yyI = y(curI);
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 181, 71, 0.5)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(xxD, y(0));
    ctx.lineTo(xxD, yyI);
    ctx.lineTo(pad.l, yyI);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#ffb547';
    ctx.beginPath();
    ctx.arc(xxD, yyI, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  return {
    setConfig(next) {
      config = next;
      draw();
    },
    dispose: () => observer.disconnect(),
  };
}
