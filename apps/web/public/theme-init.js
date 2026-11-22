// Aplica o tema salvo antes da primeira pintura (evita flash). Arquivo externo por causa da CSP.
try {
  const t = localStorage.getItem('freenem-theme');
  if (t === 'light' || t === 'dark') globalThis.document.documentElement.dataset.theme = t;
} catch {
  // localStorage indisponível: segue o tema do sistema
}
