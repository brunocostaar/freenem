import type { ExamRef, Source } from '../index.js';
import { fetchPdf, parseQuestions, pdfToText } from './pdf.js';

/**
 * FUVEST — 1ª fase (prova objetiva). Baixa o PDF oficial e extrai o texto com `pdftotext`.
 * A URL abaixo segue o padrão histórico do site; se mudar, passe `--pdf <url|arquivo>`.
 * Direitos das provas pertencem à FUVEST: tudo entra como rascunho com a fonte citada.
 */
export function fuvestSource(opts: { year?: number; pdf?: string } = {}): Source {
  const year = opts.year ?? new Date().getFullYear() - 1;
  const pdfUrl =
    opts.pdf ?? `https://www.fuvest.br/wp-content/uploads/fuvest${year}_primeira_fase_prova_V1.pdf`;
  const ref: ExamRef = {
    institution: 'fuvest',
    year,
    label: `FUVEST ${year} · 1ª fase`,
    phase: '1ª fase',
    sourceUrl: pdfUrl,
  };
  return {
    async listExams() {
      return [ref];
    },
    async extract(exam) {
      const file = await fetchPdf(exam.sourceUrl ?? pdfUrl, `fuvest-${exam.year}.pdf`);
      return parseQuestions(pdfToText(file));
    },
  };
}
