/** Classes literais (o Tailwind só detecta nomes completos) por slug de matéria. */
export interface SubjectColor {
  /** preenchimento da barra / acento sólido */
  bar: string;
  /** fundo suave */
  soft: string;
  /** borda de destaque */
  border: string;
}

const FALLBACK: SubjectColor = {
  bar: 'bg-primary',
  soft: 'bg-primary/15',
  border: 'border-primary',
};

const COLORS: Record<string, SubjectColor> = {
  matematica: {
    bar: 'bg-subj-matematica',
    soft: 'bg-subj-matematica/15',
    border: 'border-subj-matematica',
  },
  fisica: { bar: 'bg-subj-fisica', soft: 'bg-subj-fisica/15', border: 'border-subj-fisica' },
  quimica: { bar: 'bg-subj-quimica', soft: 'bg-subj-quimica/15', border: 'border-subj-quimica' },
  biologia: {
    bar: 'bg-subj-biologia',
    soft: 'bg-subj-biologia/15',
    border: 'border-subj-biologia',
  },
  historia: {
    bar: 'bg-subj-historia',
    soft: 'bg-subj-historia/15',
    border: 'border-subj-historia',
  },
  geografia: {
    bar: 'bg-subj-geografia',
    soft: 'bg-subj-geografia/15',
    border: 'border-subj-geografia',
  },
  filosofia: {
    bar: 'bg-subj-filosofia',
    soft: 'bg-subj-filosofia/15',
    border: 'border-subj-filosofia',
  },
  sociologia: {
    bar: 'bg-subj-sociologia',
    soft: 'bg-subj-sociologia/15',
    border: 'border-subj-sociologia',
  },
  portugues: {
    bar: 'bg-subj-portugues',
    soft: 'bg-subj-portugues/15',
    border: 'border-subj-portugues',
  },
  literatura: {
    bar: 'bg-subj-literatura',
    soft: 'bg-subj-literatura/15',
    border: 'border-subj-literatura',
  },
  ingles: { bar: 'bg-subj-ingles', soft: 'bg-subj-ingles/15', border: 'border-subj-ingles' },
  espanhol: {
    bar: 'bg-subj-espanhol',
    soft: 'bg-subj-espanhol/15',
    border: 'border-subj-espanhol',
  },
  artes: { bar: 'bg-subj-artes', soft: 'bg-subj-artes/15', border: 'border-subj-artes' },
  'educacao-fisica': {
    bar: 'bg-subj-educacao-fisica',
    soft: 'bg-subj-educacao-fisica/15',
    border: 'border-subj-educacao-fisica',
  },
};

export const subjectColor = (slug: string): SubjectColor => COLORS[slug] ?? FALLBACK;
