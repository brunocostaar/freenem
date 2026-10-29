/**
 * Listas de palavras-chave usadas pelo classificador determinístico (`classify.ts`).
 *
 * Convenções (texto já normalizado: minúsculas, sem acentos):
 * - cada item casa no INÍCIO de uma palavra (prefixo): "fotossint" casa "fotossíntese";
 * - terminar com `$` exige fim de palavra: "mol$" casa "mol" mas não "molécula";
 * - prefixo `!` = termo forte (peso 3); sem prefixo = peso 1;
 * - itens separados por vírgula.
 *
 * Os assuntos (nível 1 da taxonomia) são indexados por "Matéria/Assunto". Os sub-assuntos
 * (nível 2) usam as palavras do próprio nome, mais as extras abaixo quando existirem.
 */

export const SUBJECT_KEYWORDS: Record<string, string> = {
  Física:
    '!velocidade, !aceleracao, !newton, !joule$, !watt, !quilowatt, !ampere, !volt$, !ohm$, !hertz, !decibel, !forca$, ' +
    'energia cinetica, energia potencial, energia eletrica, energia mecanica, energia solar, energia eolica, usina, hidreletrica, ' +
    'trabalho de uma forca, potencia, pressao, empuxo, densidade, temperatura, calor$, calorific, dilatacao, termic, termometro, ' +
    '!onda$, ondas, frequencia, comprimento de onda, som$, sonor, acustic, !lente, !espelho, refracao, reflexao, luz$, raio de luz, ' +
    'corrente eletrica, tensao eletrica, resistor, resistencia eletrica, circuito, campo eletrico, campo magnetico, carga eletrica, ' +
    'gravidade, gravitacional, orbita, satelite, !fotoeletric, atrito, momento linear, quantidade de movimento, impulso, lancamento, ' +
    'queda livre, movimento uniforme, movimento retilineo, movimento circular, inercia, massa$, peso$, torque, alavanca, polia, ' +
    'bateria, lampada, chuveiro, transformador, gerador, motor eletrico, radiacao, ondas eletromagneticas, microondas, forno de micro, ' +
    'espectro, vacuo, relatividade, paraquedas, ima$, magnet, fusivel, disjuntor, kwh, ' +
    'rendimento, maquina termica, gas ideal, fotovoltaic, placa solar, painel solar, ',
  Química:
    '!substancia, !molecula, !reacao quimica, !elemento quimico, !tabela periodica, !ligacao quimica, !ionic, !covalente, !mol$, ' +
    '!acido, !base$, !solucao, !solvente, !soluto, !concentracao, !ph$, !oxid, !reduc, !combustao, !eletrolise, !pilha, ' +
    'hidrocarboneto, alcool, etanol, carboxilic, ester, amina, amida, aldeido, cetona, fenol, eter$, isomer, polimero, plastico, ' +
    'equilibrio quimico, cinetica quimica, catalisador, entalpia, endotermic, exotermic, destilacao, filtracao, decantacao, ' +
    'titulacao, polaridade, polar$, apolar, atomo, atomic, eletron, proton, neutron, isotopo, ion$, ions, cation, anion, ' +
    'massa molar, gas nobre, metal, metais, liga metalica, ferro, aluminio, cobre, zinco, calcio, sodio, cloreto, sulfato, ' +
    'carbonato, nitrato, oxido, hidroxido, agua oxigenada, sal de cozinha, sabao, detergente, tensoativo, petroleo, gasolina, ' +
    'biodiesel, biocombustivel, composto organico, funcao organica, grupo funcional, carbono, hidrogenio, oxigenio, nitrogenio, ' +
    'efeito estufa, chuva acida, ozonio, camada de ozonio, cfc, agrotoxico, fertilizante, corrosao, ferrugem, reagente, produto da reacao, ' +
    'estequiometr, rendimento da reacao, radioativ, meia-vida, vidro, ceramica, cimento, ',
  Biologia:
    '!celula, !celular, !dna$, !rna$, !gene$, !genes, !genetic, !cromossomo, !mitose, !meiose, !mendel, !heredit, !alelo, !mutacao, ' +
    '!evolu, !selecao natural, !darwin, !especie, !ecossistema, !cadeia alimentar, !bioma, !fotossintese, !enzima, !hormonio, ' +
    'membrana plasmatica, citoplasma, nucleo, organela, mitocondria, cloroplasto, ribossomo, populacao de, comunidade biologica, ' +
    'respiracao celular, proteina, aminoacido, lipidio, carboidrato, glicose, atp$, sistema nervoso, neuronio, sinapse, sangue, ' +
    'coracao, circulatori, digest, intestino, estomago, figado, rim$, renal, pulmao, respiratori, imunologic, imunit, sistema imune, ' +
    'anticorpo, vacina, virus, bacteria, fungo, protozoario, doenca, parasit, verme, helminto, verminose, malaria, dengue, ' +
    'planta, vegetal, flor$, fruto, semente, raiz$, folha, estoma, seiva, animal, animais, vertebrado, invertebrado, mamifero, ' +
    'embriao, fecundacao, gestacao, gametas, espermatozoide, ovulo, placenta, biotecnologia, transgenico, clonagem, cnra, ' +
    'biodiversidade, nicho, simbiose, predacao, competicao, taxonomia, filogen, fossil, ancestral, adaptacao, nutriente, ' +
    'poluicao, eutrofizacao, decompositor, produtor, consumidor, nivel troficos, fitoplancton, alga, mata atlantica, vacinacao, ' +
    'metabolismo, fermentacao, microrganismo, antibiotico, tecido, orgao, sistema endocrino, insulina, diabetes, cancer, ',
  História:
    '!imperio, !colonia, !colonizacao, !escravid, !escravo, !revolucao francesa, !revolucao industrial, !guerra mundial, !ditadura, ' +
    '!republica velha, !era vargas, !getulio, !governo militar, !regime militar, !feudal, !feudalismo, !medieval, !idade media, ' +
    '!renascimento, !absolutismo, !napoleao, !independencia, !imperio romano, !roma antiga, !grecia antiga, !egito, !mesopotamia, ' +
    '!guerra fria, !nazismo, !fascismo, !holocausto, !abolicao, !bandeirante, !jesuita, !inconfidencia, !dom pedro, !coroa portuguesa, ' +
    'cruzada, reforma protestante, contrarreforma, colonialismo, imperialismo, descolonizacao, apartheid, maia, inca$, asteca, ' +
    'seculo xix, seculo xx, seculo xviii, seculo xvii, seculo xvi, seculo xv, periodo colonial, brasil colonia, brasil imperio, ' +
    'monarquia, republica, golpe de, estado novo, constituicao de, diretas ja, redemocratizacao, ' +
    'capitania, engenho, mineracao, ouro, quilombo, palmares, canudos, cangaco, coronelismo, voto de cabresto, ' +
    'revolucao russa, bolchevique, stalin, lenin, hitler, mussolini, new deal, crise de 1929, belle epoque, ' +
    'antiguidade, helenismo, polis, democracia ateniense, cidadao romano, senado romano, patricios, plebeus, ' +
    'mercantilismo, iluminismo, liberalismo, socialismo, anarquismo, sindicato operario, movimento operario, ' +
    'povos originarios, conquista da america, conquistadores, tordesilhas, grandes navegacoes, ',
  Geografia:
    '!relevo, !clima, !vegetacao, !bacia hidrografica, !hidrografia, !cartografia, !latitude, !longitude, !fuso horario, !urbanizacao, ' +
    '!demograf, !migracao, !densidade demografica, !piramide etaria, !industrializacao, !agropecuaria, !agronegocio, !reforma agraria, ' +
    '!geopolitic, !blocos economicos, !mercosul, !matriz energetica, !desmatamento, !tectonic, !vulcanismo, !terremoto, !atmosfera, ' +
    'massa de ar, el nino, desertificacao, mapa, escala$, coordenadas geograficas, projecao cartografica, rosa dos ventos, ' +
    'amazonia, cerrado, caatinga, pantanal, mata atlantica, bioma, regiao, regioes, nordeste, sudeste, centro-oeste, sul do brasil, ' +
    'metropole, metropolitan, favela, periferia, area rural, area urbana, campo$, exodo rural, ibge, idh, ' +
    'globalizacao, comercio internacional, onu$, otan, uniao europeia, oriente medio, china, estados unidos, ' +
    'recursos hidricos, aquifero, ilha de calor, poluicao do ar, lixo, saneamento, mineracao, ' +
    'solo$, erosao, intemperismo, rocha, mineral, placas tectonicas, litosfera, hidrosfera, ' +
    'territorio, fronteira, espaco geografico, paisagem, ',
  Filosofia:
    '!filosof, !platao, !aristoteles, !socrates, !kant, !descartes, !nietzsche, !hobbes, !locke, !rousseau, !maquiavel, !etica, ' +
    '!metafisica, !epistemologia, !existencialismo, !sartre, !foucault, !contrato social, !utilitarismo, !dialetica, !caverna, ' +
    'sofista, estoic, epicur, cetic, tomas de aquino, agostinho, hannah arendt, frankfurt, adorno, habermas, pos-modern, bioetica, ' +
    'moral$, razao, conhecimento, verdade, virtude, felicidade, liberdade, livre-arbitrio, ceticismo, empirismo, racionalismo, ' +
    'iluminismo, ontolog, logica, retorica, pensador, pensamento filosofico, schopenhauer, hegel, spinoza, leibniz, hume, bacon, ',
  Sociologia:
    '!sociolog, !durkheim, !weber, !comte, !fato social, !etnocentrismo, !relativismo cultural, !desigualdade social, !classe social, ' +
    '!estratificacao, !mobilidade social, !movimentos sociais, !cidadania, !direitos humanos, !industria cultural, !anomia, ' +
    '!socializacao, !bourdieu, !gramsci, !ideologia, !alienacao, !mais-valia, !marx, ' +
    'identidade, cultura de massa, cultura popular, genero$, racismo, preconceito, discriminacao, desemprego, precarizacao, ' +
    'mercado de trabalho, trabalhador, consumo, consumismo, sociedade civil, estado$, poder$, dominacao, violencia, ' +
    'democracia, partidos politicos, juventude, religiao, secularizacao, minorias, indigena, quilombola, ' +
    'participacao politica, sindicato, politicas publicas, exclusao social, ',
  Português:
    '!texto, !linguagem, !interlocutor, !genero textual, !coesao, !coerencia, !figura de linguagem, !metafora, !ironia, !funcao da linguagem, ' +
    '!variacao linguistica, !norma padrao, !norma culta, !registro, !gramatica, !concordancia, !verbo, !pronome, !conjuncao, !oracao, ' +
    '!sintaxe, !pontuacao, !virgula, !crase, sentido, argumento, tese, inferir, emissor, receptor, charge, tirinha, anuncio, ' +
    'publicidade, propaganda, campanha, cartaz, noticia, reportagem, editorial, carta, blog, internet, rede social, memes, ' +
    'historia em quadrinhos, cronica, giria, dialeto, regionalismo, neologismo, estrangeirismo, conotativ, denotativ, ' +
    'intertextual, parodia, fala$, falante, oralidade, escrita, adjetivo, substantivo, adverbio, preposicao, ',
  Literatura:
    '!poema, !poesia, !romance, !soneto, !verso, !estrofe, !eu lirico, !poeta, !escritor, !romantismo, !realismo, !naturalismo, ' +
    '!parnasianismo, !simbolismo, !modernismo, !barroco, !arcadismo, !classicismo, !trovadorismo, !machado de assis, !drummond, ' +
    '!manuel bandeira, !cecilia meireles, !guimaraes rosa, !clarice lispector, !graciliano ramos, !jose de alencar, !castro alves, ' +
    '!camoes, !fernando pessoa, !oswald de andrade, !mario de andrade, !cabral de melo neto, !vinicius de moraes, !lima barreto, ' +
    'aluisio azevedo, eca de queiroz, cruz e sousa, augusto dos anjos, gregorio de matos, vieira, conto$, narrador, personagem, ' +
    'enredo, prosa, antologia, cordel, rima, metrica, lirico, epico, drama, obra literaria, literatura, livro, autor, ' +
    'carlos drummond, joao cabral, adelia prado, ferreira gullar, cora coralina, conceicao evaristo, carolina maria de jesus, ',
  Artes:
    '!pintura, !escultura, !obra de arte, !quadro, !tela$, !museu, !cubismo, !impressionismo, !surrealismo, !picasso, !portinari, ' +
    '!tarsila, !grafite, !instalacao, !fotografia, !cinema, !teatro, !danca, !musica, !ritmo, !melodia, !samba, !bossa nova, ' +
    '!tropicalismo, !instrumento musical, !opera, !arquitetura, !aleijadinho, !performance, !artes visuais, !expressionismo, ' +
    '!dadaismo, !vanguarda, !artesanato, !patrimonio cultural, !artista, !arte$, folclore, escultor, pintor, composicao musical, ' +
    'cancao, banda, show, coreografia, bailarino, ator, atriz, palco, cena$, figurino, instrumento, orquestra, ',
  'Educação Física':
    '!esporte, !atividade fisica, !olimpic, !olimpiada, !paralimp, !futebol, !voleibol, !basquete, !atleta, !ginastica, !luta$, !lutas, ' +
    '!judo, !capoeira, !sedentarismo, !exercicio fisico, !doping, !academia, !anabolizante, !esportivo, !competicao esportiva, ' +
    '!copa do mundo, treinamento, alongamento, handebol, natacao, skate, surfe, parkour, corpo$, corporal, jogo$, jogos, brincadeira, ' +
    'saude, padrao de beleza, malhacao, pratica esportiva, ',
};

export const TOPIC_KEYWORDS: Record<string, string> = {
  // ---------- Matemática ----------
  'Matemática/Aritmética e Números':
    '!numero primo, !mmc, !mdc, !divisor, !multiplo, !fracao, !decimal, !potencia, !raiz quadrada, !notacao cientifica, !algarismo, ' +
    'arredond, sistema de numeracao, binario, divisivel, inteiro, racional, irracional, ordem de grandeza, reta numerica, ',
  'Matemática/Razão, Proporção e Porcentagem':
    '!razao, !proporcao, !regra de tres, !porcentagem, !por cento, !porcentual, !percentual, !escala, !diretamente proporcional, ' +
    '!inversamente proporcional, velocidade media, densidade, concentracao, receita da, ingredientes, ',
  'Matemática/Matemática Financeira':
    '!juros, !montante, !capital, !taxa de, !desconto, !prestacao, !financiamento, !parcela, !rendimento, !poupanca, !inflacao, ' +
    '!acrescimo, emprestimo, cartao de credito, investimento, a vista, a prazo, lucro, prejuizo, imposto, salario, reajuste, ',
  'Matemática/Álgebra':
    '!equacao, !sistema de equacoes, !inequacao, !polinomio, !logaritmo, !progressao aritmetica, !progressao geometrica, !pa$, !pg$, ' +
    '!sequencia, raiz da equacao, termo geral, soma dos termos, incognita, variavel, expressao algebrica, fatoracao, ',
  'Matemática/Funções':
    '!funcao, !grafico da funcao, !f(x), !dominio, !parabola, !vertice, !exponencial, !crescente, !decrescente, !afim, !linear, ' +
    'maximo, minimo, zero da funcao, coeficiente angular, lei de formacao, ',
  'Matemática/Geometria Plana':
    '!triangulo, !angulo, !retangulo, !quadrado, !area, !perimetro, !circulo, !circunferencia, !poligono, !hexagono, !losango, ' +
    '!trapezio, !semelhanca, !pitagoras, !tales, !diagonal, !bissetriz, terreno, lado$, lados, paralelo, perpendicular, raio$, ',
  'Matemática/Geometria Espacial':
    '!volume, !cubo, !cilindro, !cone$, !piramide, !esfera, !prisma, !paralelepipedo, !poliedro, !capacidade, litros, caixa, ' +
    'reservatorio, recipiente, tanque, lata, embalagem, solido, aresta, face$, vertices, ',
  'Matemática/Geometria Analítica':
    '!plano cartesiano, !coordenadas, !equacao da reta, !elipse, !hiperbole, !ponto medio, !distancia entre, !circunferencia de centro, ' +
    'reta$, eixo x, eixo y, origem, par ordenado, ',
  'Matemática/Trigonometria':
    '!seno, !cosseno, !tangente, !trigonometri, !radiano, !ciclo trigonometrico, angulo de elevacao, angulo de depressao, ' +
    'sen(, cos(, tg(, ',
  'Matemática/Estatística e Probabilidade':
    '!media, !mediana, !moda$, !desvio padrao, !variancia, !probabilidade, !chance, !amostra, !frequencia, !histograma, ' +
    '!grafico de barras, !grafico de setores, !quartil, evento, pesquisa, dados, tabela, aleatori, sorteio, espaco amostral, ',
  'Matemática/Análise Combinatória':
    '!permutacao, !combinacao, !arranjo, !anagrama, !de quantas maneiras, !de quantas formas, !formas distintas, !fatorial, ' +
    'senha, comissao, principio multiplicativo, ordem importa, sequencias distintas, ',

  // ---------- Física ----------
  'Física/Mecânica':
    '!velocidade, !aceleracao, !forca, !newton, !trabalho, !energia cinetica, !energia potencial, !potencia, !atrito, !momento linear, ' +
    '!quantidade de movimento, !impulso, !lancamento, !queda livre, !movimento uniforme, !movimento circular, !gravitacao, !gravidade, ' +
    'orbita, satelite, torque, alavanca, polia, plano inclinado, mola, colisao, inercia, ',
  'Física/Hidrostática':
    '!pressao, !empuxo, !arquimedes, !pascal, !densidade, !fluido, !vasos comunicantes, flutua, afunda, submerso, hidraulic, ',
  'Física/Termologia':
    '!temperatura, !calor$, !dilatacao, !calorimetria, !termodinamica, !termometro, !calor especifico, !mudanca de estado, ' +
    '!fusao, !ebulicao, !isolante termico, !condutor termico, conducao, conveccao, irradiacao, maquina termica, gas ideal, ',
  'Física/Óptica':
    '!lente, !espelho, !refracao, !reflexao, !luz$, !raio de luz, !miopia, !hipermetropia, !prisma, !lupa, !olho humano, imagem, camara escura, ',
  'Física/Ondulatória':
    '!onda$, !ondas, !frequencia, !comprimento de onda, !som$, !acustic, !doppler, !hertz, !decibel, !ressonancia, !eco, timbre, intensidade sonora, ',
  'Física/Eletricidade':
    '!corrente eletrica, !tensao, !resistor, !resistencia eletrica, !circuito, !carga eletrica, !campo eletrico, !ohm, !ampere, !watt, ' +
    '!quilowatt, !kwh, !potencia eletrica, conta de energia, lampada, chuveiro, bateria, fusivel, eletrostatica, ',
  'Física/Eletromagnetismo':
    '!campo magnetico, !inducao, !ima$, !eletroima, !ondas eletromagneticas, !transformador, !gerador, !motor eletrico, !fluxo magnetico, ' +
    'bobina, espira, micro-ondas, radio$, espectro eletromagnetico, ',
  'Física/Física Moderna':
    '!fotoeletric, !radioativ, !relatividade, !quantic, !fotons, !fóton, !laser, !nuclear, !fissao, !fusao nuclear, !raios x, !efeito compton, ',

  // ---------- Química ----------
  'Química/Química Geral':
    '!tabela periodica, !atomo, !atomic, !modelo atomico, !ligacao ionica, !ligacao covalente, !ligacao metalica, !polaridade, !isotopo, ' +
    '!substancia pura, !mistura, !separacao de misturas, !destilacao, !filtracao, !decantacao, eletronegatividade, estados fisicos, ',
  'Química/Química Inorgânica':
    '!acido, !base$, !sal$, !oxido, !hidroxido, !neutralizacao, !ph$, !chuva acida, cloreto, sulfato, carbonato, nitrato, metais, ',
  'Química/Estequiometria':
    '!estequiometr, !mol$, !massa molar, !rendimento da reacao, !reagente limitante, !balanceamento, !lei de lavoisier, !numero de avogadro, ',
  'Química/Soluções':
    '!solucao, !soluto, !solvente, !concentracao, !diluicao, !solubilidade, !molaridade, !titulacao, !propriedades coligativas, ',
  'Química/Termoquímica':
    '!entalpia, !endotermic, !exotermic, !calor de reacao, !calor de combustao, !energia de ligacao, !lei de hess, ',
  'Química/Cinética':
    '!cinetica quimica, !velocidade da reacao, !catalisador, !energia de ativacao, !colisoes, ',
  'Química/Equilíbrio Químico':
    '!equilibrio quimico, !constante de equilibrio, !le chatelier, !deslocamento do equilibrio, !ph$, !hidrolise, !tampao, ',
  'Química/Eletroquímica':
    '!pilha, !eletrolise, !oxidacao, !reducao, !oxirreducao, !eletrodo, !catodo, !anodo, !bateria, !corrosao, !galvaniz, !potencial padrao, ',
  'Química/Química Orgânica':
    '!hidrocarboneto, !alcool, !etanol, !carboxilic, !ester, !amina, !amida, !aldeido, !cetona, !fenol, !isomer, !polimero, !plastico, ' +
    '!funcao organica, !grupo funcional, !composto organico, !petroleo, !gasolina, !biodiesel, !sabao, !detergente, !acido graxo, !gordura, !oleo, !carbono, ',
  'Química/Química Ambiental':
    '!efeito estufa, !chuva acida, !camada de ozonio, !poluicao, !agrotoxico, !fertilizante, !lixo, !reciclagem, !tratamento de agua, ' +
    '!tratamento de esgoto, !biocombustivel, !aquecimento global, !co2, !dioxido de carbono, !residuos, !metais pesados, !derramamento, ',

  // ---------- Biologia ----------
  'Biologia/Citologia':
    '!celula, !membrana plasmatica, !organela, !mitocondria, !cloroplasto, !ribossomo, !nucleo, !mitose, !meiose, !respiracao celular, ' +
    '!fotossintese, !fermentacao, !osmose, !difusao, !transporte ativo, citoplasma, ciclo celular, ',
  'Biologia/Bioquímica Celular':
    '!enzima, !proteina, !aminoacido, !lipidio, !carboidrato, !glicose, !acido nucleico, !agua e sais, !vitamina, !atp$, ',
  'Biologia/Genética':
    '!gene$, !genes, !dna$, !rna$, !mendel, !alelo, !heredograma, !heredit, !cromossomo, !mutacao, !genotipo, !fenotipo, !dominante, ' +
    '!recessivo, !grupo sanguineo, !fator rh, !transgenico, !clonagem, !biotecnologia, !engenharia genetica, !pcr, !sindrome de down, !cruzamento, ',
  'Biologia/Evolução':
    '!evolu, !selecao natural, !darwin, !lamarck, !especiacao, !adaptacao, !fossil, !ancestral comum, !filogen, !deriva genetica, !origem da vida, ',
  'Biologia/Ecologia':
    '!ecossistema, !cadeia alimentar, !teia alimentar, !bioma, !nicho, !simbiose, !predacao, !populacao, !comunidade, !biodiversidade, ' +
    '!ciclo do carbono, !ciclo do nitrogenio, !ciclo da agua, !poluicao, !eutrofizacao, !desmatamento, !sucessao ecologica, decompositor, produtor, consumidor, ' +
    'nivel trofico, biomassa, amazonia, cerrado, mata atlantica, ',
  'Biologia/Fisiologia Humana':
    '!sistema nervoso, !neuronio, !sinapse, !hormonio, !sistema endocrino, !sangue, !coracao, !circulatori, !digest, !intestino, !estomago, ' +
    '!figado, !rim$, !renal, !pulmao, !respiratori, !sistema imunologico, !anticorpo, !musculo, !osso, !pele, !insulina, !diabetes, ',
  'Biologia/Reprodução e Embriologia':
    '!fecundacao, !gestacao, !embriao, !gametas, !espermatozoide, !ovulo, !placenta, !ciclo menstrual, !contraceptiv, !reproducao, ' +
    '!fecundacao, !desenvolvimento embrionario, gravidez, ',
  'Biologia/Seres Vivos':
    '!planta, !vegetal, !flor$, !fruto, !semente, !fungo, !bacteria, !protozoario, !alga, !animal, !vertebrado, !invertebrado, !mamifero, ' +
    '!taxonomia, !reino, !briofita, !pteridofita, !gimnosperma, !angiosperma, inseto, aves, repteis, anfibios, peixes, ',
  'Biologia/Saúde':
    '!doenca, !vacina, !virus, !parasit, !verme, !verminose, !malaria, !dengue, !aids, !hiv, !antibiotico, !epidemia, !pandemia, !saneamento, ' +
    '!profilaxia, !higiene, !tuberculose, !gripe, !covid, !zika, !chikungunya, !doenca de chagas, !esquistossomose, !hepatite, ',

  // ---------- História ----------
  'História/História Antiga':
    '!egito, !mesopotamia, !grecia, !roma antiga, !imperio romano, !persa, !fenicio, !hebreu, !polis, !democracia ateniense, !antiguidade, ' +
    '!senado romano, !patricios, !plebeus, gladiador, ',
  'História/Idade Média':
    '!feudal, !feudalismo, !medieval, !idade media, !cruzada, !igreja catolica, !servidao, !senhor feudal, !burgo, !islamismo, !arabes, !carlos magno, ',
  'História/Idade Moderna':
    '!renascimento, !reforma protestante, !contrarreforma, !absolutismo, !mercantilismo, !grandes navegacoes, !iluminismo, !humanismo, ' +
    '!revolucao inglesa, !revolucao francesa, !luis xiv, estado moderno, ',
  'História/Brasil Colônia':
    '!colonia, !colonizacao, !capitania, !engenho, !bandeirante, !jesuita, !escravid, !quilombo, !palmares, !inconfidencia, !conjuracao, ' +
    '!mineracao, !pau-brasil, !tordesilhas, !indigena, !periodo colonial, !pacto colonial, !holandes, ',
  'História/Brasil Império':
    '!imperio do brasil, !dom pedro, !independencia do brasil, !regencia, !segundo reinado, !abolicao, !lei aurea, !guerra do paraguai, ' +
    '!cafe, !lei do ventre livre, !lei eusebio, !tarifa alves branco, !balaiada, !cabanagem, !farroupilha, !proclamacao da republica, ',
  'História/Brasil República':
    '!republica velha, !coronelismo, !politica do cafe com leite, !era vargas, !getulio, !estado novo, !ditadura militar, !golpe de 1964, ' +
    '!ai-5, !diretas ja, !redemocratizacao, !constituicao de 1988, !juscelino, !canudos, !contestado, !tenentismo, !plano real, !populismo, ' +
    'governo militar, regime militar, anistia, ',
  'História/Revoluções e Contemporaneidade':
    '!revolucao industrial, !revolucao francesa, !napoleao, !liberalismo, !socialismo, !anarquismo, !imperialismo, !neocolonialismo, ' +
    '!unificacao, !congresso de viena, !independencia das colonias, !movimento operario, !capitalismo, !comuna de paris, ',
  'História/Século XX':
    '!guerra mundial, !revolucao russa, !nazismo, !fascismo, !holocausto, !guerra fria, !crise de 1929, !new deal, !stalin, !hitler, ' +
    '!mussolini, !onu$, !muro de berlim, !guerra do vietna, !revolucao cubana, !macarthismo, !guerra da coreia, !globalizacao, ',
  'História/História da África e América':
    '!africa, !apartheid, !descolonizacao, !maia, !inca$, !asteca, !conquista da america, !independencia da america, !bolivar, ' +
    '!revolucao mexicana, !cuba, !haiti, !tráfico negreiro, !trafico negreiro, !diaspora, !povos originarios, !mandela, ',

  // ---------- Geografia ----------
  'Geografia/Cartografia':
    '!mapa, !cartografia, !escala$, !latitude, !longitude, !coordenadas, !fuso horario, !projecao, !rosa dos ventos, !sensoriamento remoto, ' +
    '!gps, !geoprocessamento, !legenda, curvas de nivel, imagem de satelite, orientacao, ',
  'Geografia/Geografia Física':
    '!relevo, !clima, !vegetacao, !bacia hidrografica, !hidrografia, !tectonic, !vulcanismo, !terremoto, !atmosfera, !massa de ar, ' +
    '!el nino, !solo$, !erosao, !intemperismo, !rocha, !mineral, !litosfera, !bioma, !domínios morfoclimaticos, !frente fria, !chuva, ' +
    'temperatura, desertificacao, geleira, ',
  'Geografia/Questões Ambientais':
    '!desmatamento, !aquecimento global, !efeito estufa, !poluicao, !sustentabilidade, !desenvolvimento sustentavel, !biodiversidade, ' +
    '!unidade de conservacao, !queimada, !assoreamento, !recursos hidricos, !lixo, !residuos, !impacto ambiental, !mudancas climaticas, ' +
    '!conferencia, !protocolo de quioto, !ilha de calor, !chuva acida, !reciclagem, ',
  'Geografia/Geografia da População':
    '!demograf, !populacao, !migracao, !piramide etaria, !densidade demografica, !crescimento vegetativo, !transicao demografica, ' +
    '!taxa de natalidade, !taxa de mortalidade, !urbanizacao, !exodo rural, !refugiado, !envelhecimento, !idh, !expectativa de vida, ' +
    'metropole, favela, periferia, segregacao, ',
  'Geografia/Geografia Econômica':
    '!industrializacao, !agropecuaria, !agronegocio, !reforma agraria, !matriz energetica, !petroleo, !globalizacao, !comercio, ' +
    '!revolucao verde, !agricultura, !latifundio, !minifundio, !divisao internacional do trabalho, !fordismo, !toyotismo, !servicos, ' +
    '!transporte, !hidreletrica, !energia, !commodities, !tecnopolo, ',
  'Geografia/Geopolítica':
    '!geopolitic, !blocos economicos, !mercosul, !uniao europeia, !otan, !onu$, !guerra fria, !oriente medio, !conflito, !fronteira, ' +
    '!nova ordem mundial, !terrorismo, !brics, !nafta, !china, !estados unidos, !russia, !territorio, !nacionalismo, !separatismo, ',
  'Geografia/Geografia do Brasil':
    '!regioes brasileiras, !nordeste, !sudeste, !centro-oeste, !amazonia, !cerrado, !caatinga, !pantanal, !mata atlantica, !pampa, ' +
    '!ibge, !brasil, !amazonia legal, !seca, !sertao, !zona da mata, !sul do brasil, !norte do brasil, ',

  // ---------- Filosofia ----------
  'Filosofia/Filosofia Antiga':
    '!socrates, !platao, !aristoteles, !pre-socratic, !sofista, !estoic, !epicur, !caverna, !mito da caverna, !helenismo, !polis, !arete, ',
  'Filosofia/Filosofia Medieval e Moderna':
    '!descartes, !kant, !hobbes, !locke, !rousseau, !hume, !bacon, !spinoza, !leibniz, !maquiavel, !tomas de aquino, !agostinho, ' +
    '!escolastic, !patristic, !contrato social, !iluminismo, !racionalismo, !empirismo, !cogito, !esclarecimento, ',
  'Filosofia/Filosofia Contemporânea':
    '!nietzsche, !marx, !sartre, !existencialismo, !frankfurt, !adorno, !habermas, !foucault, !hannah arendt, !heidegger, !simone de beauvoir, ' +
    '!pos-modern, !schopenhauer, !kierkegaard, !deleuze, !baumann, !bauman, !fenomenologia, !pragmatismo, ',
  'Filosofia/Ética e Política':
    '!etica, !moral$, !politica, !justica, !virtude, !liberdade, !utilitarismo, !democracia, !bioetica, !direitos, !poder, !estado, !felicidade, !dever, ',
  'Filosofia/Teoria do Conhecimento':
    '!conhecimento, !verdade, !razao, !ceticismo, !empirismo, !racionalismo, !epistemologia, !ciencia, !metodo, !ideologia, !opiniao, ',

  // ---------- Sociologia ----------
  'Sociologia/Clássicos da Sociologia':
    '!durkheim, !weber, !marx, !comte, !fato social, !acao social, !anomia, !solidariedade, !mais-valia, !luta de classes, !positivismo, !burocracia, ',
  'Sociologia/Cultura e Sociedade':
    '!cultura, !identidade, !etnocentrismo, !relativismo cultural, !industria cultural, !cultura de massa, !cultura popular, !diversidade, ' +
    '!preconceito, !racismo, !genero$, !religiao, !midia, !socializacao, !juventude, !tribos, !consumo, !globalizacao cultural, ',
  'Sociologia/Estratificação e Desigualdade':
    '!desigualdade, !classe social, !estratificacao, !mobilidade social, !pobreza, !exclusao, !casta, !raca, !genero$, !renda, ' +
    '!concentracao de renda, !discriminacao, !cotas, !capital cultural, !bourdieu, !periferia, ',
  'Sociologia/Trabalho e Economia':
    '!trabalho, !desemprego, !precarizacao, !terceirizacao, !mercado de trabalho, !fordismo, !toyotismo, !alienacao, !capitalismo, ' +
    '!sindicato, !uberizacao, !flexibilizacao, !informalidade, !automacao, !globalizacao, !emprego, !salario, !trabalhador, ',
  'Sociologia/Política e Poder':
    '!estado$, !poder$, !democracia, !cidadania, !dominacao, !partidos politicos, !movimentos sociais, !direitos humanos, !participacao politica, ' +
    '!ditadura, !legitimidade, !politicas publicas, !sociedade civil, !ideologia, !violencia, !gramsci, !constituicao, ',

  // ---------- Português ----------
  'Português/Interpretação de Texto':
    '!texto, !autor, !inferir, !tese, !argumento, !gênero textual, !genero textual, !intertextual, !charge, !tirinha, !texto nao verbal, !imagem, ' +
    '!ideia central, !objetivo do texto, !reportagem, !artigo de opiniao, !carta, !cronica, !editorial, !anuncio, ',
  'Português/Funções da Linguagem':
    '!funcao da linguagem, !funcao emotiva, !funcao referencial, !funcao conativa, !funcao poetica, !funcao metalinguistica, !funcao fatica, ' +
    '!figura de linguagem, !metafora, !ironia, !hiperbole, !metonimia, !antitese, !paradoxo, !personificacao, !comparacao, !denotativ, !conotativ, !eufemismo, ',
  'Português/Variação Linguística':
    '!variacao linguistica, !dialeto, !regionalismo, !giria, !registro, !norma padrao, !norma culta, !preconceito linguistico, ' +
    '!oralidade, !coloquial, !informal, !formal, !sotaque, !idioma, !lingua, ',
  'Português/Gramática':
    '!verbo, !pronome, !substantivo, !adjetivo, !adverbio, !preposicao, !concordancia, !regencia, !crase, !virgula, !pontuacao, !oracao, ' +
    '!sintaxe, !morfologia, !sujeito, !predicado, !complemento, !semantic, !polissemia, !ambiguidade, !sinonimo, !antonimo, !prefixo, !sufixo, ',
  'Português/Coesão e Coerência':
    '!coesao, !coerencia, !conectivo, !conjuncao, !retomada, !anafora, !referencia, !progressao textual, !paragrafo, !articulador, !elemento coesivo, ',
  'Português/Linguagens e Tecnologia':
    '!internet, !rede social, !meme, !blog, !digital, !tecnologia, !mensagem de texto, !whatsapp, !emoji, !hipertexto, !midia, !publicidade, ' +
    '!propaganda, !campanha, !anuncio, !jornal, !noticia, !reportagem, !televisao, !aplicativo, !virtual, ',

  // ---------- Literatura ----------
  'Literatura/Literatura Portuguesa':
    '!camoes, !fernando pessoa, !eca de queiroz, !saramago, !trovadorismo, !classicismo, !lusiadas, !portugal, !portugues, !cantiga, !gil vicente, !florbela, ',
  'Literatura/Escolas Literárias Brasileiras':
    '!romantismo, !realismo, !naturalismo, !parnasianismo, !simbolismo, !pre-modernismo, !arcadismo, !barroco, !quinhentismo, ' +
    '!machado de assis, !jose de alencar, !castro alves, !aluisio azevedo, !cruz e sousa, !augusto dos anjos, !gregorio de matos, !olavo bilac, !lima barreto, !alvares de azevedo, !goncalves dias, ',
  'Literatura/Modernismo':
    '!modernismo, !oswald de andrade, !mario de andrade, !manuel bandeira, !drummond, !cecilia meireles, !guimaraes rosa, !clarice lispector, ' +
    '!graciliano ramos, !cabral de melo neto, !vinicius de moraes, !semana de arte moderna, !geracao de 30, !geracao de 45, !jorge amado, !rachel de queiroz, !lygia fagundes, !ferreira gullar, !adelia prado, ',
  'Literatura/Gêneros e Análise':
    '!poema, !poesia, !soneto, !verso, !estrofe, !eu lirico, !narrador, !personagem, !enredo, !conto$, !romance, !cordel, !rima, !metrica, ' +
    '!teatro, !drama, !cronica, !foco narrativo, !lirico, !epico, ',
  'Literatura/Literatura Afro-brasileira e Indígena':
    '!afro-brasileir, !literatura marginal, !periferica, !carolina maria de jesus, !conceicao evaristo, !cuti, !solano trindade, !negritude, ' +
    '!indigena, !daniel munduruku, !ailton krenak, !sarau, !slam, !racap, !rap$, !quilombo, ',

  // ---------- Artes ----------
  'Artes/História da Arte':
    '!renascimento, !barroco, !cubismo, !impressionismo, !surrealismo, !expressionismo, !dadaismo, !vanguarda, !picasso, !van gogh, !monet, ' +
    '!leonardo da vinci, !michelangelo, !arte pre-historica, !arte egipcia, !arte grega, !arte moderna, !modernismo, !portinari, !tarsila, !di cavalcanti, ',
  'Artes/Artes Visuais':
    '!pintura, !escultura, !grafite, !instalacao, !fotografia, !cinema, !desenho, !gravura, !colagem, !arte contemporanea, !arte urbana, ' +
    '!obra de arte, !museu, !galeria, !exposicao, !artista, !cor$, !luz e sombra, !composicao, !perspectiva, ',
  'Artes/Música e Dança':
    '!musica, !melodia, !ritmo, !harmonia, !samba, !bossa nova, !tropicalismo, !instrumento, !orquestra, !cancao, !compositor, !danca, ' +
    '!coreografia, !bailarino, !balé, !funk, !rap$, !sertanejo, !rock, !forro, !baiao, !choro, ',
  'Artes/Teatro e Cultura Popular':
    '!teatro, !ator, !atriz, !palco, !cena$, !performance, !folclore, !cultura popular, !patrimonio cultural, !artesanato, !festa popular, ' +
    '!carnaval, !bumba meu boi, !capoeira, !indigena, !afro-brasileir, !tradicao, !ritual, !manifestacao cultural, ',

  // ---------- Educação Física ----------
  'Educação Física/Cultura Corporal':
    '!esporte, !jogo$, !jogos, !brincadeira, !luta$, !lutas, !judo, !capoeira, !ginastica, !danca, !futebol, !voleibol, !basquete, !handebol, !natacao, !skate, !surfe, !parkour, ',
  'Educação Física/Corpo e Saúde':
    '!atividade fisica, !saude, !sedentarismo, !exercicio, !doping, !anabolizante, !academia, !padrao de beleza, !obesidade, !qualidade de vida, ' +
    '!alimentacao, !corpo$, !corporal, !malhacao, !vigorexia, !anorexia, ',
  'Educação Física/Esporte e Sociedade':
    '!olimpic, !olimpiada, !paralimp, !copa do mundo, !espetaculo, !mercado esportivo, !inclusao, !midia esportiva, !atleta, !competicao, ' +
    '!torcida, !violencia no esporte, !profissionalismo, !esporte de alto rendimento, ',
};

/** Palavras que nunca servem de palavra-chave derivada do nome do tópico. */
export const STOPWORDS = new Set([
  'para',
  'como',
  'entre',
  'sobre',
  'suas',
  'seus',
  'dois',
  'duas',
  'mais',
  'menos',
  'geral',
  'brasil',
  'brasileiro',
  'brasileira',
  'cultura',
  'sociedade',
  'texto',
  'analise',
  'textual',
  'media',
  'elementos',
  'principios',
  'propriedades',
  'modelos',
  'tempos',
  'basicos',
]);
