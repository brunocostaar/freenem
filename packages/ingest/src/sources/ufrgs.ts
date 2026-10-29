import type { ExamRef, Source } from '../index.js';
import { fetchPdf, parseQuestions, pdfToText } from './pdf.js';

/**
 * UFRGS (COPERSE) — prova do Concurso Vestibular. As provas ficam no site da COPERSE; como a
 * URL muda a cada edição, informe `--pdf <url|arquivo>` (ou use o padrão abaixo).
 * Tudo entra como rascunho com a fonte citada.
 */
export function ufrgsSource(opts: { year?: number; pdf?: string } = {}): Source {
  const year = opts.year ?? new Date().getFullYear() - 1;
  const pdfUrl =
    opts.pdf ?? `https://www.ufrgs.br/coperse/wp-content/uploads/${year}/prova_${year}.pdf`;
  const ref: ExamRef = {
    institution: 'ufrgs',
    year,
    label: `UFRGS ${year}`,
    sourceUrl: pdfUrl,
  };
  return {
    async listExams() {
      return [ref];
    },
    async extract(exam) {
      const file = await fetchPdf(exam.sourceUrl ?? pdfUrl, `ufrgs-${exam.year}.pdf`);
      // Questões numeradas "01.", "02." no início da linha
      return parseQuestions(pdfToText(file), /^\s*0?(\d{1,2})\.\s+(?=\S)/gm);
    },
  };
}
