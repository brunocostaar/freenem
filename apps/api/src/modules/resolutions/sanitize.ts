import { RESOLUTION_BODY_MAX } from '@freenem/shared';

/**
 * Sanitiza o Markdown de uma resolução da comunidade: só texto + LaTeX.
 * - remove HTML cru (tags e comentários) e blocos script/style com conteúdo;
 * - remove imagens (`![alt](url)`) e imagens por referência;
 * - links só sobrevivem se forem https; senão fica apenas o texto do link;
 * - normaliza quebras de linha, remove caracteres de controle e limita o tamanho.
 * `<` usado em matemática (`a < b`) é preservado: só tags reais (`<letra...>`) saem.
 */
export function sanitizeResolutionBody(input: string): string {
  let s = input.replace(/\r\n?/g, '\n');
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  s = s.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<\/?[a-zA-Z][^>\n]*>/g, '');
  // imagens inline e por referência
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  s = s.replace(/!\[[^\]]*\]\[[^\]]*\]/g, '');
  // links: mantém apenas https
  s = s.replace(/\[([^\]]*)\]\(\s*<?([^)\s>]*)>?[^)]*\)/g, (_m, text: string, url: string) =>
    /^https:\/\//i.test(url) ? `[${text}](${url})` : text,
  );
  // definições de link por referência e autolinks com esquemas perigosos
  s = s.replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, '');
  s = s.replace(/\b(?:javascript|data|vbscript):/gi, '');
  s = s.replace(/\n{4,}/g, '\n\n\n').trim();
  return s.slice(0, RESOLUTION_BODY_MAX);
}
