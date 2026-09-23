/**
 * O que a tela de Recuperar receita diz quando a lista esta vazia.
 *
 * Tres situacoes usavam a MESMA frase — "Ninguem para recuperar agora" — e so uma delas e boa
 * noticia. A acao era um `<span>Volte mais tarde</span>`: texto vestido de saida, que satisfazia a
 * prop obrigatoria de `EmptyState` sem cumprir o que ela existe para garantir ("tela vazia sem
 * saida e beco sem saida").
 *
 * Ficou grave em 31/08, quando esta tela virou o botao CENTRAL da barra: deixou de ser um destino
 * de canto e passou a ser a primeira coisa que um salao novo toca.
 *
 * Funcao pura, sem JSX, porque o que precisa de guarda aqui e a ESCOLHA DA FRASE — nao a marcacao.
 */
export type VazioDeRecuperar = {
  titulo: string
  descricao: string
  acaoRotulo: string
  acaoHref: string
}

export function vazioDeRecuperar(
  temClientes: boolean,
  temCiclos: boolean,
  temAtendimentosConcluidos = false,
  /*
    Se existe canal de contato configurado nesta instalação. O padrão é `false` porque o estado
    normal do produto, hoje, é NÃO ter canal — e o padrão de uma copy tem que ser o mundo real,
    não o mundo desejado.

    Entrou porque uma das três frases mandava "fale com o suporte", e suporte não é um lugar:
    `lib/contato.ts` já documenta que a palavra "gente" não tinha endereço em parte alguma do
    repositório. Mandar alguém falar com o suporte que não existe é a mesma classe de defeito que
    aquele arquivo conserta — promessa sem destinatário — cometida na tela do Motor de Ciclo, que
    é o botão central da barra e a primeira coisa que um salão novo toca.

    Mesmo desenho de `core/messaging/promessa.ts`: a copy conhece os DOIS estados do mundo, e sem
    canal ela simplesmente não convida.
  */
  temCanalDeContato = false,
  /*
    "daqui a 6 dias (29/09)" — de `quandoVolta` (`core/ciclo/primeira-volta.ts`), calculado pela
    página com o menor `predicted_on` futuro entre quem está em dia. `null` quando não há: a frase
    de vitória continua de pé sem ele.
  */
  quandoOProximoVolta: string | null = null,
): VazioDeRecuperar {
  if (!temClientes) {
    return {
      titulo: 'Cadastre suas clientes para o Motor começar',
      descricao: 'Ele usa o intervalo entre as visitas de cada pessoa para saber quando ela costuma voltar. Sem ficha, não há o que acompanhar.',
      acaoRotulo: 'Cadastrar cliente',
      acaoHref: '/admin/clientes/nova',
    }
  }

  if (!temCiclos && !temAtendimentosConcluidos) {
    /*
     * Ter ficha nao basta: o ciclo precisa de uma ultima visita. Dizer "cadastre clientes" aqui
     * mandaria a pessoa refazer o que ela ja fez.
     *
     * Ate a rodada 18 do docs/82 esta frase era "O Motor comeca no primeiro atendimento concluido"
     * e levava para a agenda — semanas de espera ate o Motor ter o que mostrar, numa conta que ja
     * tem as fichas. O "Ja atendo" poe essa gente no Motor HOJE, com a ultima vez respondida de
     * memoria (e desde a rodada 17 o recalculo envelhece essas fichas, entao a lista enche sozinha).
     */
    return {
      titulo: 'Diga quando foi o último atendimento de cada um',
      descricao:
        'Suas fichas já estão aqui. Conte de memória quando cada pessoa veio pela última vez (não precisa ser exato) e o Motor começa hoje, sem esperar a agenda.',
      acaoRotulo: 'Dizer quando vieram',
      acaoHref: '/admin/clientes/ja-atendo',
    }
  }

  if (!temCiclos) {
    /*
     * Atendimento concluido EXISTE e ciclo nao: quem nao rodou foi o Motor, nao a pessoa.
     *
     * Sem esta quarta situacao, a frase acima ("assim que voce concluir um atendimento") era
     * mostrada para quem ja concluiu centenas — o produto pedindo de volta um trabalho que a
     * pessoa ja fez, e escondendo que o job e que estava parado. Medido em 02/09 nas seis contas
     * de demonstracao: 1876 atendimentos concluidos, ZERO linhas em `client_cycles`, porque o
     * agendador do cron apontava para uma URL que deixou de existir. Falhou por dias, em silencio,
     * com a tela dizendo a frase errada.
     *
     * A frase nao promete prazo ("ate amanha") de proposito: a periodicidade do recalculo depende
     * de um agendador externo, e prometer relogio que nao controlamos e a mesma classe de promessa
     * vazia que a regra do canal de mensagem proibe. Diz o que e verdade — ja recebemos, ainda nao
     * processamos — e oferece a saida que existe: a lista de clientes, que nao depende do Motor.
     */
    return {
      titulo: 'O Motor ainda não processou seus atendimentos',
      descricao:
        'Seus atendimentos concluídos já estão aqui, mas a previsão de retorno é recalculada de tempos em tempos e ainda não rodou.' +
        (temCanalDeContato ? ' Se continuar assim por vários dias, fale com a gente.' : ''),
      acaoRotulo: 'Ver clientes',
      acaoHref: '/admin/clientes',
    }
  }

  // Aqui vazio e VITORIA: o Motor esta rodando e ninguem atrasou. A frase precisa soar como
  // "esta tudo certo", nao como "nao encontrei nada".
  return {
    titulo: 'Todo mundo em dia',
    descricao: quandoOProximoVolta
      ? `Ninguém passou do tempo de voltar. O próximo deve voltar ${quandoOProximoVolta}; se atrasar, aparece aqui.`
      : 'Ninguém passou do tempo de voltar. Quando alguém atrasar, aparece aqui.',
    acaoRotulo: 'Ver clientes',
    acaoHref: '/admin/clientes',
  }
}
