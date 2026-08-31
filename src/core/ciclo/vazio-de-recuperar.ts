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

export function vazioDeRecuperar(temClientes: boolean, temCiclos: boolean): VazioDeRecuperar {
  if (!temClientes) {
    return {
      titulo: 'Cadastre suas clientes para o Motor começar',
      descricao: 'Ele aprende de quanto em quanto tempo cada uma volta. Sem ficha, não há o que acompanhar.',
      acaoRotulo: 'Cadastrar cliente',
      acaoHref: '/admin/clientes/nova',
    }
  }

  if (!temCiclos) {
    /*
     * Ter ficha nao basta: o ciclo nasce do primeiro atendimento CONCLUIDO. Dizer "cadastre
     * clientes" aqui mandaria a pessoa refazer o que ela ja fez — e o produto pareceria nao ter
     * percebido o trabalho dela.
     */
    return {
      titulo: 'O Motor começa no primeiro atendimento concluído',
      descricao: 'Assim que você concluir um atendimento, ele passa a prever quando aquela cliente volta.',
      acaoRotulo: 'Ver a agenda',
      acaoHref: '/admin/agenda',
    }
  }

  // Aqui vazio e VITORIA: o Motor esta rodando e ninguem atrasou. A frase precisa soar como
  // "esta tudo certo", nao como "nao encontrei nada".
  return {
    titulo: 'Todo mundo em dia',
    descricao: 'Ninguém passou do tempo de voltar. Quando alguém atrasar, aparece aqui.',
    acaoRotulo: 'Ver clientes',
    acaoHref: '/admin/clientes',
  }
}
