import { essayThemesSeed } from './taxonomy.js';

/**
 * Textos motivadores de apoio, escritos como resumos originais (não são os textos oficiais
 * da prova). Chave = título exato do tema em `essayThemesSeed` ou em `extraEssayThemes`.
 */
const supportingTexts: Record<string, string> = {
  'Desafios para o enfrentamento da invisibilidade do trabalho de cuidado realizado pela mulher no Brasil': `- Pesquisas domiciliares brasileiras indicam que as mulheres dedicam, em média, bem mais horas por semana aos afazeres domésticos e ao cuidado de crianças, idosos e doentes do que os homens.
- Esse trabalho não é remunerado e raramente entra nas estatísticas econômicas, o que dificulta a criação de políticas públicas e de proteção social.
- A sobrecarga limita o tempo de estudo, a inserção no mercado formal e a participação política das mulheres.`,
  'Desafios para a valorização de comunidades e povos tradicionais no Brasil': `- Povos indígenas, quilombolas, ribeirinhos e caiçaras mantêm modos de vida ligados ao território e preservam saberes sobre o manejo da natureza.
- Conflitos fundiários, ameaças ao meio ambiente e preconceito dificultam o acesso desses grupos a direitos básicos.
- A Constituição reconhece direitos territoriais e culturais, mas sua efetivação depende de políticas públicas e de reconhecimento social.`,
  'Invisibilidade e registro civil: garantia de acesso à cidadania no Brasil': `- Sem certidão de nascimento, uma pessoa tem dificuldade de matricular-se na escola, acessar serviços de saúde e receber benefícios sociais.
- O sub-registro diminuiu nas últimas décadas, mas persiste em regiões remotas e entre populações vulneráveis.
- Cartórios distantes, custos indiretos e falta de informação aparecem entre as causas.`,
  'O estigma associado às doenças mentais na sociedade brasileira': `- Transtornos como depressão e ansiedade são comuns, mas muitas pessoas evitam buscar ajuda por medo de preconceito.
- A reforma psiquiátrica substituiu o modelo de internações longas por uma rede de atenção comunitária, ainda desigual entre as regiões.
- Informação de qualidade e acolhimento reduzem o sofrimento e melhoram a recuperação.`,
  'Democratização do acesso ao cinema no Brasil': `- A maior parte das salas de cinema do país está concentrada em shopping centers de grandes cidades.
- O custo do ingresso, a distância e a pouca diversidade da programação afastam parte da população.
- Cineclubes, mostras itinerantes e plataformas digitais ampliam o acesso, mas dependem de infraestrutura e de incentivo à produção nacional.`,
  'Manipulação do comportamento do usuário pelo controle de dados na internet': `- Plataformas coletam dados de navegação e usam algoritmos para personalizar conteúdo e anúncios.
- A personalização pode influenciar hábitos de consumo, opiniões e até decisões políticas, muitas vezes sem que o usuário perceba.
- Leis de proteção de dados, como a LGPD, buscam dar transparência e controle ao cidadão.`,
  'Desafios para a formação educacional de surdos no Brasil': `- A Língua Brasileira de Sinais (Libras) é reconhecida em lei como meio legal de comunicação e expressão.
- Faltam professores bilíngues, intérpretes e materiais adaptados em muitas escolas.
- A educação bilíngue (Libras e português escrito) é apontada como caminho para a inclusão plena.`,
  'Caminhos para combater a intolerância religiosa no Brasil': `- O país é laico e a liberdade de crença é garantida pela Constituição, mas há registros frequentes de ataques a templos e a praticantes, sobretudo de religiões de matriz africana.
- A intolerância se manifesta em discursos de ódio, discriminação e violência.
- Educação para a diversidade e aplicação efetiva da lei são caminhos discutidos.`,
};

export interface EssayThemeSeed {
  year: number | null;
  title: string;
  description: string;
  supportingTexts?: string;
}

/** Temas adicionais (propostas originais no estilo do ENEM). */
export const extraEssayThemes: EssayThemeSeed[] = [
  {
    year: null,
    title: 'Desafios para o combate à desinformação e às notícias falsas no Brasil',
    description: 'Tema de treino: circulação de informações falsas nas redes sociais.',
    supportingTexts: `- Aplicativos de mensagem e redes sociais permitem que conteúdos falsos se espalhem em minutos e alcancem milhões de pessoas.
- A desinformação já afetou campanhas de saúde, como a vacinação, e debates eleitorais.
- Checagem de fatos, educação midiática e responsabilização das plataformas são caminhos debatidos.`,
  },
  {
    year: null,
    title: 'Caminhos para ampliar o acesso à saúde mental entre jovens brasileiros',
    description: 'Tema de treino: ansiedade, depressão e rede de apoio na juventude.',
    supportingTexts: `- Aumentam os relatos de ansiedade e depressão entre adolescentes e jovens adultos.
- Há poucos psicólogos na rede pública, e o atendimento privado é caro para a maioria das famílias.
- Escolas, universidades e serviços de saúde podem atuar na prevenção e no acolhimento.`,
  },
  {
    year: null,
    title: 'Impactos do uso excessivo de telas na infância e na adolescência',
    description: 'Tema de treino: tecnologia, desenvolvimento e hábitos de vida.',
    supportingTexts: `- Crianças e adolescentes passam várias horas por dia em celulares, tablets e videogames.
- O uso intenso pode afetar o sono, a atenção, a atividade física e as relações presenciais.
- Mediação familiar, regras escolares e conteúdo de qualidade ajudam a equilibrar o uso.`,
  },
  {
    year: null,
    title: 'Desafios para a mobilidade urbana sustentável nas grandes cidades brasileiras',
    description: 'Tema de treino: transporte público, trânsito e meio ambiente.',
    supportingTexts: `- Congestionamentos, poluição e tempo perdido no trajeto afetam a qualidade de vida nas metrópoles.
- O transporte coletivo enfrenta tarifas altas, lotação e cobertura desigual entre centro e periferia.
- Ciclovias, corredores de ônibus e planejamento do uso do solo são alternativas apontadas.`,
  },
  {
    year: null,
    title: 'Caminhos para a redução do desperdício de alimentos e para o combate à fome no Brasil',
    description: 'Tema de treino: segurança alimentar e desperdício.',
    supportingTexts: `- Uma parcela significativa dos alimentos produzidos é perdida na colheita, no transporte e no consumo, enquanto milhões de pessoas vivem em insegurança alimentar.
- Bancos de alimentos, educação nutricional e políticas de compra pública estão entre as respostas.
- A distribuição e o acesso, mais que a produção, aparecem como o nó do problema.`,
  },
  {
    year: null,
    title: 'Desafios para a preservação da Amazônia e o desenvolvimento sustentável',
    description: 'Tema de treino: floresta, economia e povos da região.',
    supportingTexts: `- A floresta regula o clima, abriga grande biodiversidade e é lar de milhões de pessoas.
- Desmatamento, garimpo ilegal e queimadas ameaçam esse patrimônio.
- Bioeconomia, fiscalização e valorização das comunidades locais buscam conciliar renda e conservação.`,
  },
];

/** Lista final usada pelo seed: temas originais (com textos de apoio) + extras. */
export const allEssayThemes: EssayThemeSeed[] = [
  ...essayThemesSeed.map((t) => ({ ...t, supportingTexts: supportingTexts[t.title] })),
  ...extraEssayThemes,
];
