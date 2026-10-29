import type { EnemArea } from '@freenem/shared';

export interface SubjectSeed {
  name: string;
  area: EnemArea;
  /** assunto (nível 1) -> sub-assuntos (nível 2), conforme a matriz de referência do ENEM */
  topics: Record<string, string[]>;
}

export const subjectsSeed: SubjectSeed[] = [
  {
    name: 'Matemática',
    area: 'matematica',
    topics: {
      'Aritmética e Números': [
        'Operações e propriedades',
        'Números primos, MMC e MDC',
        'Frações e números decimais',
        'Potenciação e radiciação',
        'Notação científica',
      ],
      'Razão, Proporção e Porcentagem': [
        'Razão e proporção',
        'Regra de três simples e composta',
        'Porcentagem',
        'Escalas',
        'Grandezas proporcionais',
      ],
      'Matemática Financeira': ['Juros simples', 'Juros compostos', 'Descontos e acréscimos'],
      Álgebra: [
        'Equações e sistemas do 1º grau',
        'Equações do 2º grau',
        'Inequações',
        'Polinômios',
        'Logaritmos',
        'Sequências, PA e PG',
      ],
      Funções: [
        'Função afim',
        'Função quadrática',
        'Função exponencial',
        'Função logarítmica',
        'Análise de gráficos',
      ],
      'Geometria Plana': [
        'Ângulos e triângulos',
        'Semelhança e Teorema de Tales',
        'Teorema de Pitágoras e relações métricas',
        'Áreas de figuras planas',
        'Círculo e circunferência',
        'Polígonos',
      ],
      'Geometria Espacial': [
        'Prismas e cilindros',
        'Pirâmides e cones',
        'Esfera',
        'Poliedros',
        'Volume e capacidade',
      ],
      'Geometria Analítica': ['Ponto e reta', 'Circunferência', 'Cônicas'],
      Trigonometria: ['Triângulo retângulo', 'Ciclo trigonométrico', 'Funções trigonométricas'],
      'Estatística e Probabilidade': [
        'Média, moda e mediana',
        'Desvio padrão e variância',
        'Leitura de tabelas e gráficos',
        'Probabilidade',
        'Probabilidade condicional',
      ],
      'Análise Combinatória': [
        'Princípio fundamental da contagem',
        'Permutações',
        'Arranjos e combinações',
      ],
    },
  },
  {
    name: 'Física',
    area: 'natureza',
    topics: {
      Mecânica: [
        'Cinemática: MU e MUV',
        'Movimento circular',
        'Leis de Newton',
        'Trabalho, energia e potência',
        'Quantidade de movimento e impulso',
        'Gravitação universal',
        'Estática e equilíbrio',
      ],
      Hidrostática: ['Pressão e densidade', 'Princípio de Pascal', 'Empuxo e Arquimedes'],
      Termologia: [
        'Temperatura e calor',
        'Dilatação térmica',
        'Calorimetria e mudanças de estado',
        'Termodinâmica',
      ],
      Óptica: ['Reflexão e espelhos', 'Refração e lentes', 'Óptica da visão'],
      Ondulatória: ['Ondas e propriedades', 'Som e acústica', 'Efeito Doppler'],
      Eletricidade: [
        'Eletrostática',
        'Corrente, tensão e resistência',
        'Circuitos elétricos',
        'Potência e consumo de energia',
      ],
      Eletromagnetismo: ['Campo magnético', 'Indução eletromagnética', 'Ondas eletromagnéticas'],
      'Física Moderna': ['Efeito fotoelétrico', 'Radioatividade', 'Relatividade'],
    },
  },
  {
    name: 'Química',
    area: 'natureza',
    topics: {
      'Química Geral': [
        'Matéria e suas propriedades',
        'Separação de misturas',
        'Atomística e modelos atômicos',
        'Tabela periódica',
        'Ligações químicas',
        'Geometria e polaridade molecular',
      ],
      'Química Inorgânica': [
        'Ácidos, bases, sais e óxidos',
        'Reações inorgânicas',
        'Funções inorgânicas',
      ],
      Estequiometria: ['Mol e massa molar', 'Cálculo estequiométrico', 'Gases'],
      Soluções: ['Concentração de soluções', 'Diluição e mistura', 'Propriedades coligativas'],
      Termoquímica: ['Entalpia', 'Lei de Hess', 'Energia de ligação'],
      Cinética: ['Velocidade das reações', 'Catalisadores'],
      'Equilíbrio Químico': ['Constante de equilíbrio', 'pH e pOH', 'Deslocamento de equilíbrio'],
      Eletroquímica: ['Pilhas', 'Eletrólise', 'Corrosão'],
      'Química Orgânica': [
        'Cadeias carbônicas e hidrocarbonetos',
        'Funções orgânicas',
        'Isomeria',
        'Reações orgânicas',
        'Polímeros',
        'Bioquímica: lipídios, carboidratos e proteínas',
      ],
      'Química Ambiental': [
        'Poluição do ar e da água',
        'Chuva ácida e efeito estufa',
        'Combustíveis e energia',
      ],
    },
  },
  {
    name: 'Biologia',
    area: 'natureza',
    topics: {
      Citologia: [
        'Membrana plasmática e transporte',
        'Organelas',
        'Núcleo e divisão celular',
        'Metabolismo energético',
      ],
      'Bioquímica Celular': ['Água e sais minerais', 'Proteínas e enzimas', 'Ácidos nucleicos'],
      Genética: [
        'Leis de Mendel',
        'Heredograma',
        'Grupos sanguíneos',
        'Genética molecular',
        'Biotecnologia e engenharia genética',
      ],
      Evolução: ['Teorias evolutivas', 'Seleção natural e especiação', 'Origem da vida'],
      Ecologia: [
        'Cadeias e teias alimentares',
        'Ciclos biogeoquímicos',
        'Relações ecológicas',
        'Biomas brasileiros',
        'Impactos ambientais e sustentabilidade',
        'Dinâmica de populações',
      ],
      'Fisiologia Humana': [
        'Sistema digestório',
        'Sistema circulatório',
        'Sistema respiratório',
        'Sistema excretor',
        'Sistema nervoso e endócrino',
        'Sistema imunológico e vacinas',
      ],
      'Reprodução e Embriologia': [
        'Reprodução humana',
        'Desenvolvimento embrionário',
        'Métodos contraceptivos',
      ],
      'Seres Vivos': ['Vírus e bactérias', 'Protozoários e fungos', 'Botânica', 'Zoologia'],
      Saúde: ['Doenças infecciosas e parasitárias', 'Saneamento básico', 'Saúde pública'],
    },
  },
  {
    name: 'História',
    area: 'humanas',
    topics: {
      'História Antiga': ['Grécia e Roma', 'Civilizações do Oriente'],
      'Idade Média': ['Feudalismo', 'Igreja e cruzadas', 'Transição para a Idade Moderna'],
      'Idade Moderna': [
        'Renascimento e Reformas',
        'Absolutismo e mercantilismo',
        'Expansão marítima',
        'Iluminismo',
      ],
      'Brasil Colônia': [
        'Colonização portuguesa',
        'Economia açucareira e mineração',
        'Escravidão e resistência',
        'Povos indígenas',
      ],
      'Brasil Império': ['Independência', 'Primeiro e Segundo Reinados', 'Abolição'],
      'Brasil República': [
        'República Velha',
        'Era Vargas',
        'República Populista',
        'Ditadura militar',
        'Redemocratização e Nova República',
      ],
      'Revoluções e Contemporaneidade': [
        'Revolução Francesa',
        'Revolução Industrial',
        'Imperialismo e neocolonialismo',
        'Revolução Russa',
      ],
      'Século XX': [
        'Primeira Guerra Mundial',
        'Segunda Guerra Mundial',
        'Guerra Fria',
        'Totalitarismos',
      ],
      'História da África e América': [
        'África pré-colonial e colonização',
        'América pré-colombiana',
        'Independências latino-americanas',
      ],
    },
  },
  {
    name: 'Geografia',
    area: 'humanas',
    topics: {
      Cartografia: [
        'Escalas e coordenadas',
        'Projeções cartográficas',
        'Fusos horários',
        'Sensoriamento remoto e geoprocessamento',
      ],
      'Geografia Física': [
        'Geologia e relevo',
        'Climatologia',
        'Hidrografia',
        'Biomas e vegetação',
        'Solos',
      ],
      'Questões Ambientais': [
        'Aquecimento global',
        'Desmatamento e desertificação',
        'Recursos hídricos',
        'Desenvolvimento sustentável',
      ],
      'Geografia da População': [
        'Demografia e transição demográfica',
        'Migrações',
        'Urbanização',
        'Indicadores sociais (IDH)',
      ],
      'Geografia Econômica': [
        'Industrialização',
        'Agropecuária e agronegócio',
        'Matriz energética',
        'Transportes e comunicação',
      ],
      Geopolítica: [
        'Globalização',
        'Blocos econômicos',
        'Conflitos contemporâneos',
        'Nova ordem mundial',
      ],
      'Geografia do Brasil': [
        'Regionalização do Brasil',
        'Questão agrária',
        'Rede urbana e metropolização',
        'Domínios morfoclimáticos',
      ],
    },
  },
  {
    name: 'Filosofia',
    area: 'humanas',
    topics: {
      'Filosofia Antiga': ['Pré-socráticos', 'Sócrates, Platão e Aristóteles', 'Helenismo'],
      'Filosofia Medieval e Moderna': [
        'Patrística e Escolástica',
        'Racionalismo e empirismo',
        'Contratualismo',
        'Kant e o Iluminismo',
      ],
      'Filosofia Contemporânea': [
        'Nietzsche',
        'Marx e o materialismo',
        'Existencialismo',
        'Escola de Frankfurt',
        'Foucault',
      ],
      'Ética e Política': ['Ética e moral', 'Teorias do Estado', 'Cidadania e direitos humanos'],
      'Teoria do Conhecimento': ['Mito e razão', 'Ciência e método', 'Lógica'],
    },
  },
  {
    name: 'Sociologia',
    area: 'humanas',
    topics: {
      'Clássicos da Sociologia': ['Durkheim', 'Weber', 'Marx'],
      'Cultura e Sociedade': [
        'Cultura e diversidade',
        'Indústria cultural',
        'Identidade e etnocentrismo',
      ],
      'Estratificação e Desigualdade': ['Classes sociais', 'Raça e etnia', 'Gênero e sexualidade'],
      'Trabalho e Economia': [
        'Trabalho e capitalismo',
        'Fordismo, toyotismo e precarização',
        'Globalização',
      ],
      'Política e Poder': [
        'Estado, poder e dominação',
        'Movimentos sociais',
        'Democracia e cidadania',
      ],
    },
  },
  {
    name: 'Português',
    area: 'linguagens',
    topics: {
      'Interpretação de Texto': [
        'Compreensão e inferência',
        'Tipologia e gêneros textuais',
        'Intertextualidade',
        'Texto verbal e não verbal',
      ],
      'Funções da Linguagem': [
        'Funções da linguagem',
        'Figuras de linguagem',
        'Denotação e conotação',
      ],
      'Variação Linguística': [
        'Variação regional e social',
        'Norma culta e registros',
        'Língua e preconceito linguístico',
      ],
      Gramática: ['Morfologia', 'Sintaxe', 'Concordância e regência', 'Pontuação', 'Semântica'],
      'Coesão e Coerência': ['Conectivos e coesão', 'Progressão textual'],
      'Linguagens e Tecnologia': [
        'Linguagem digital e mídias',
        'Gêneros jornalísticos e publicitários',
      ],
    },
  },
  {
    name: 'Literatura',
    area: 'linguagens',
    topics: {
      'Literatura Portuguesa': [
        'Trovadorismo e Classicismo',
        'Barroco e Arcadismo',
        'Romantismo português',
        'Realismo português',
        'Modernismo português',
      ],
      'Escolas Literárias Brasileiras': [
        'Quinhentismo, Barroco e Arcadismo',
        'Romantismo',
        'Realismo e Naturalismo',
        'Parnasianismo e Simbolismo',
        'Pré-Modernismo',
      ],
      Modernismo: [
        'Primeira geração (1922)',
        'Segunda geração: poesia e prosa',
        'Terceira geração',
        'Literatura contemporânea',
      ],
      'Gêneros e Análise': [
        'Poesia: versificação e figuras',
        'Narrativa: foco e elementos',
        'Teatro e crônica',
      ],
      'Literatura Afro-brasileira e Indígena': [
        'Literatura marginal e periférica',
        'Literatura afro-brasileira',
      ],
    },
  },
  {
    name: 'Inglês',
    area: 'linguagens',
    topics: {
      'Compreensão de Texto': [
        'Estratégias de leitura',
        'Inferência e vocabulário em contexto',
        'Gêneros textuais em inglês',
      ],
      Gramática: [
        'Tempos verbais',
        'Verbos modais',
        'Pronomes e determinantes',
        'Conectivos',
        'Voz passiva',
      ],
      Vocabulário: ['Cognatos e falsos cognatos', 'Phrasal verbs', 'Expressões idiomáticas'],
      'Cultura e Sociedade': ['Língua inglesa e globalização', 'Música, cinema e mídia'],
    },
  },
  {
    name: 'Espanhol',
    area: 'linguagens',
    topics: {
      'Compreensión Lectora': [
        'Estrategias de lectura',
        'Géneros textuales',
        'Vocabulario en contexto',
      ],
      Gramática: [
        'Tiempos verbales',
        'Pronombres y artículos',
        'Heterosemánticos y heterogenéricos',
        'Conectores',
      ],
      'Cultura Hispánica': [
        'Variación lingüística',
        'Literatura y arte hispánicos',
        'Identidad latinoamericana',
      ],
    },
  },
  {
    name: 'Artes',
    area: 'linguagens',
    topics: {
      'História da Arte': [
        'Arte pré-histórica e antiga',
        'Renascimento e Barroco',
        'Vanguardas europeias',
        'Arte moderna brasileira',
      ],
      'Artes Visuais': [
        'Elementos da linguagem visual',
        'Fotografia e cinema',
        'Arte contemporânea',
      ],
      'Música e Dança': ['Elementos da música', 'Música popular brasileira', 'Dança e movimento'],
      'Teatro e Cultura Popular': [
        'Teatro e performance',
        'Manifestações populares e patrimônio cultural',
        'Arte indígena e afro-brasileira',
      ],
    },
  },
  {
    name: 'Educação Física',
    area: 'linguagens',
    topics: {
      'Cultura Corporal': ['Esportes', 'Jogos e brincadeiras', 'Lutas', 'Ginástica', 'Danças'],
      'Corpo e Saúde': [
        'Atividade física e qualidade de vida',
        'Doping e uso de substâncias',
        'Padrões de beleza e mídia',
      ],
      'Esporte e Sociedade': [
        'Esporte e inclusão',
        'Mídia, mercado e espetáculo esportivo',
        'Jogos Olímpicos',
      ],
    },
  },
];

export const institutionsSeed = [
  {
    slug: 'enem',
    name: 'ENEM',
    fullName: 'Exame Nacional do Ensino Médio (INEP)',
    websiteUrl: 'https://www.gov.br/inep',
  },
  {
    slug: 'fuvest',
    name: 'FUVEST',
    fullName: 'Fundação Universitária para o Vestibular (USP)',
    websiteUrl: 'https://www.fuvest.br',
  },
  {
    slug: 'ufrgs',
    name: 'UFRGS',
    fullName: 'Universidade Federal do Rio Grande do Sul',
    websiteUrl: 'https://www.ufrgs.br/coperse',
  },
  {
    slug: 'unicamp',
    name: 'UNICAMP',
    fullName: 'Universidade Estadual de Campinas (COMVEST)',
    websiteUrl: 'https://www.comvest.unicamp.br',
  },
  {
    slug: 'unesp',
    name: 'UNESP',
    fullName: 'Universidade Estadual Paulista (VUNESP)',
    websiteUrl: 'https://vestibular.unesp.br',
  },
  {
    slug: 'uerj',
    name: 'UERJ',
    fullName: 'Universidade do Estado do Rio de Janeiro',
    websiteUrl: 'https://www.vestibular.uerj.br',
  },
  {
    slug: 'ufpr',
    name: 'UFPR',
    fullName: 'Universidade Federal do Paraná (NC-UFPR)',
    websiteUrl: 'https://nc.ufpr.br',
  },
  {
    slug: 'ufmg',
    name: 'UFMG',
    fullName: 'Universidade Federal de Minas Gerais (COPEVE)',
    websiteUrl: 'https://www.ufmg.br/copeve',
  },
  {
    slug: 'unb',
    name: 'UnB',
    fullName: 'Universidade de Brasília (CEBRASPE)',
    websiteUrl: 'https://www.cebraspe.org.br',
  },
  {
    slug: 'ufsc',
    name: 'UFSC',
    fullName: 'Universidade Federal de Santa Catarina',
    websiteUrl: 'https://www.ufsc.br',
  },
  {
    slug: 'ita',
    name: 'ITA',
    fullName: 'Instituto Tecnológico de Aeronáutica',
    websiteUrl: 'https://www.vestibular.ita.br',
  },
  {
    slug: 'ime',
    name: 'IME',
    fullName: 'Instituto Militar de Engenharia',
    websiteUrl: 'https://www.ime.eb.mil.br',
  },
];

export const essayThemesSeed = [
  {
    year: 2023,
    title:
      'Desafios para o enfrentamento da invisibilidade do trabalho de cuidado realizado pela mulher no Brasil',
    description: 'Tema da redação do ENEM 2023.',
  },
  {
    year: 2022,
    title: 'Desafios para a valorização de comunidades e povos tradicionais no Brasil',
    description: 'Tema da redação do ENEM 2022.',
  },
  {
    year: 2021,
    title: 'Invisibilidade e registro civil: garantia de acesso à cidadania no Brasil',
    description: 'Tema da redação do ENEM 2021.',
  },
  {
    year: 2020,
    title: 'O estigma associado às doenças mentais na sociedade brasileira',
    description: 'Tema da redação do ENEM 2020.',
  },
  {
    year: 2019,
    title: 'Democratização do acesso ao cinema no Brasil',
    description: 'Tema da redação do ENEM 2019.',
  },
  {
    year: 2018,
    title: 'Manipulação do comportamento do usuário pelo controle de dados na internet',
    description: 'Tema da redação do ENEM 2018.',
  },
  {
    year: 2017,
    title: 'Desafios para a formação educacional de surdos no Brasil',
    description: 'Tema da redação do ENEM 2017.',
  },
  {
    year: 2016,
    title: 'Caminhos para combater a intolerância religiosa no Brasil',
    description: 'Tema da redação do ENEM 2016.',
  },
];
