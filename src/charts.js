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

export function createChart(canvas, { key, color, label, unit }) {
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

    let min = 0;
    let max = 0;
    for (const s of samples) {
      const v = s[key];
      if (!Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
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

    // curva
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

    const last = samples[samples.length - 1];
    if (Number.isFinite(last[key])) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x(last.t), y(last[key]), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  return {
    setSamples(s) {
      samples = s;
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
    for (const item of series) {
      ctx.strokeStyle = item.color; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.beginPath();
      samples.forEach((sample, index) => {
        if (index === 0) ctx.moveTo(x(sample.t), y(sample[item.key]));
        else ctx.lineTo(x(sample.t), y(sample[item.key]));
      });
      ctx.stroke();
    }
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  return { setSamples(next) { samples = next; draw(); }, dispose: () => observer.disconnect() };
}
