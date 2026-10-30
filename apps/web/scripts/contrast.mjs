#!/usr/bin/env node
/**
 * Confere o contraste WCAG AA (4.5:1 texto, 3:1 componentes/bordas) dos pares de tokens de
 * src/index.css nos dois temas. Uso: `pnpm --filter @freenem/web contrast` (sai com 1 se falhar).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(new URL('../src/index.css', import.meta.url)), 'utf8');

function block(selector) {
  const start = css.indexOf(selector);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return Object.fromEntries(
    [...css.slice(open + 1, close).matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(
      (m) => [m[1], m[2]],
    ),
  );
}

const themes = {
  light: block(':root {'),
  dark: block(":root[data-theme='dark'] {"),
};

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lin = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** cor `fg` com opacidade `alpha` sobre `bg` */
const mix = (fg, bg, alpha) => {
  const f = rgb(fg);
  const b = rgb(bg);
  const hex = f.map((c, i) =>
    Math.round(c * alpha + b[i] * (1 - alpha))
      .toString(16)
      .padStart(2, '0'),
  );
  return `#${hex.join('')}`;
};

// [rótulo, fg, bg, mínimo]
const pairs = (t, markerAlpha) => {
  const grounds = { bg: t.bg, surface: t.surface, 'surface-2': t['surface-2'] };
  const out = [];
  for (const [gn, g] of Object.entries(grounds)) {
    for (const k of ['ink', 'muted', 'primary', 'accent-strong', 'success', 'danger', 'warning']) {
      out.push([`text-${k} sobre ${gn}`, t[k], g, 4.5]);
    }
  }
  out.push(['primary-ink sobre primary', t['primary-ink'], t.primary, 4.5]);
  out.push(['accent-ink sobre accent', t['accent-ink'], t.accent, 4.5]);
  out.push(['text-bg sobre success (selo correto)', t.bg, t.success, 4.5]);
  out.push(['danger-ink sobre danger (selo errado)', t['danger-ink'], t.danger, 4.5]);
  out.push(['#14213d sobre highlight', '#14213d', t.highlight, 4.5]);
  for (const [gn, g] of Object.entries(grounds)) {
    out.push([
      `ink sobre marca-texto (marker) em ${gn}`,
      t.ink,
      mix(t.highlight, g, markerAlpha),
      4.5,
    ]);
  }
  out.push([
    'success sobre success/15 em surface',
    t.success,
    mix(t.success, t.surface, 0.15),
    4.5,
  ]);
  out.push(['danger sobre danger/10 em surface', t.danger, mix(t.danger, t.surface, 0.1), 4.5]);
  out.push(['ink sobre success/15 em surface', t.ink, mix(t.success, t.surface, 0.15), 4.5]);
  out.push(['ink sobre danger/10 em surface', t.ink, mix(t.danger, t.surface, 0.1), 4.5]);
  out.push(['primary sobre primary/10 em surface', t.primary, mix(t.primary, t.surface, 0.1), 4.5]);
  out.push(['ink sobre primary/10 em surface', t.ink, mix(t.primary, t.surface, 0.1), 4.5]);
  for (const [gn, g] of Object.entries(grounds)) {
    out.push([`borda (border) sobre ${gn}`, t.border, g, 3]);
    out.push([`foco (ring) sobre ${gn}`, t.ring, g, 3]);
  }
  return out;
};

// opacidade do marca-texto (--marker-alpha em index.css, por tema)
const markerAlpha = (theme) => {
  const sel = theme === 'dark' ? ":root[data-theme='dark'] {" : ':root {';
  const start = css.indexOf(sel);
  const close = css.indexOf('}', start);
  const m = css.slice(start, close).match(/--marker-alpha:\s*([0-9.]+)/);
  return m ? Number(m[1]) : 1;
};

let failures = 0;
for (const [name, tokens] of Object.entries(themes)) {
  console.log(`\n# tema ${name}`);
  for (const [label, fg, bg, min] of pairs(tokens, markerAlpha(name))) {
    const r = ratio(fg, bg);
    const ok = r >= min;
    if (!ok) failures++;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${r.toFixed(2).padStart(5)} (min ${min})  ${label}  ${fg} / ${bg}`,
    );
  }
}
console.log(failures ? `\n${failures} par(es) abaixo do AA` : '\ntodos os pares passam AA');
process.exit(failures ? 1 : 0);
