/**
 * Gera os ícones PWA, apple-touch-icon e a imagem Open Graph em apps/web/public
 * a partir da marca (mesmo desenho de public/favicon.svg).
 *
 * Uso: pnpm --filter @freenem/e2e exec node scripts/brand-assets.mjs
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const OUT = fileURLToPath(new URL('../../web/public/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const NAVY = '#14213d';
const CREAM = '#fbf6ea';
const YELLOW = '#ffd23f';
const ORANGE = '#ff5b2e';

/** Marca em viewBox 64x64; `bg` desenha o fundo (rx 0 = sangrado, para ícones mascaráveis). */
function logoSvg({ size, rx, scale = 1 }) {
  const inner = `
    <g transform="translate(${32 - 32 * scale} ${32 - 32 * scale}) scale(${scale})">
      <path d="M18 46V18h26v8H27v4h13v8H27v8z" fill="${YELLOW}"/>
      <circle cx="46" cy="44" r="5" fill="${ORANGE}"/>
    </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="${rx}" fill="${NAVY}"/>${inner}</svg>`;
}

const icons = [
  { file: 'pwa-192x192.png', size: 192, rx: 14 },
  { file: 'pwa-512x512.png', size: 512, rx: 14 },
  // maskable: fundo sangrado e conteúdo dentro da zona segura (~60%)
  { file: 'pwa-maskable-512x512.png', size: 512, rx: 0, scale: 0.62 },
  // iOS arredonda sozinho: sem cantos transparentes
  { file: 'apple-touch-icon.png', size: 180, rx: 0, scale: 0.86 },
];

const ogHtml = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700..800&family=Hanken+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;background:${CREAM};color:${NAVY};font-family:'Hanken Grotesk',system-ui,sans-serif;
    background-image:radial-gradient(${NAVY}22 2px,transparent 2px);background-size:28px 28px;position:relative;overflow:hidden}
  .card{position:absolute;inset:48px;border:5px solid ${NAVY};border-radius:36px;background:#fff;box-shadow:14px 14px 0 ${NAVY};
    padding:56px 64px;display:flex;flex-direction:column;justify-content:space-between}
  .brand{display:flex;align-items:center;gap:22px;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:76px;letter-spacing:-2px}
  .brand .mark{width:96px;height:96px;border-radius:24px;border:5px solid ${NAVY};background:${YELLOW};display:grid;place-items:center;
    font-size:64px;box-shadow:6px 6px 0 ${NAVY}}
  .brand em{font-style:normal;color:${ORANGE}}
  h1{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:70px;line-height:1.02;letter-spacing:-2px;white-space:nowrap}
  h1 span{background:linear-gradient(transparent 58%,${YELLOW} 58% 92%,transparent 92%);padding:0 6px}
  .chips{display:flex;gap:14px;flex-wrap:wrap}
  .chips b{font-size:26px;font-weight:700;border:4px solid ${NAVY};border-radius:999px;padding:8px 20px;background:${CREAM}}
  .chips b:nth-child(2){background:${YELLOW}} .chips b:nth-child(3){background:${ORANGE};color:#fff}
</style></head><body><div class="card">
  <div class="brand"><div class="mark">f</div><div>free<em>nem</em></div></div>
  <h1>Estude para o ENEM <span>de graça</span></h1>
  <div class="chips"><b>Questões</b><b>Simulados com TRI</b><b>Redação com IA</b><b>Plano de estudos</b></div>
</div></body></html>`;

const browser = await chromium.launch();
try {
  for (const { file, size, rx, scale } of icons) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<body style="margin:0;background:transparent">${logoSvg({ size, rx, scale })}</body>`,
    );
    await page.screenshot({ path: OUT + file, omitBackground: true });
    await page.close();
    console.log('gerado', file);
  }
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await og.setContent(ogHtml, { waitUntil: 'networkidle' }).catch(() => undefined);
  await og.evaluate('document.fonts.ready');
  await og.screenshot({ path: OUT + 'og.png' });
  console.log('gerado og.png');
} finally {
  await browser.close();
}
