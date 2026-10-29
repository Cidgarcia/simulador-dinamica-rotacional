/** Formatação numérica pt-BR com proteção contra valores inválidos. */

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const INVALID = '—';

const nf = (opts) => new Intl.NumberFormat('pt-BR', opts);
const cache = new Map();
function getFormatter(key, opts) {
  if (!cache.has(key)) cache.set(key, nf(opts));
  return cache.get(key);
}

/** Número com `sig` algarismos significativos; notação científica fora de [1e-3, 1e5). */
export function formatNumber(value, sig = 4) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return INVALID;
  if (value === 0 || Object.is(value, -0)) return '0';
  const abs = Math.abs(value);
  if (abs < 1e-3 || abs >= 1e5) {
    const exp = Math.floor(Math.log10(abs));
    let mant = value / 10 ** exp;
    // corrige arredondamentos como 9,9999 → 10
    if (Math.abs(Number(mant.toPrecision(sig))) >= 10) {
      mant /= 10;
      return `${formatNumber(mant, sig)} × 10${toSup(exp + 1)}`;
    }
    const m = getFormatter(`m${sig}`, { maximumSignificantDigits: sig }).format(mant);
    return `${m} × 10${toSup(exp)}`;
  }
  return getFormatter(`s${sig}`, { maximumSignificantDigits: sig }).format(value);
}

/** Número com casas decimais fixas. */
export function formatFixed(value, digits = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return INVALID;
  const v = Object.is(value, -0) ? 0 : value;
  return getFormatter(`f${digits}`, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
}

function toSup(n) {
  return String(n)
    .split('')
    .map((c) => SUP[c] ?? c)
    .join('');
}

/** Converte texto digitado (aceita vírgula decimal) em número; NaN se inválido. */
export function parseDecimal(text) {
  if (typeof text !== 'string') return NaN;
  const s = text.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '' || !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return NaN;
  return Number(s);
}

export function formatRate(rate) {
  return `${formatNumber(rate, 2)}×`;
}

