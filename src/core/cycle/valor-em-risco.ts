import type { EstadoCiclo } from '@/core/cycle/compute'

/**
 * A segunda metade do `§5.3`: dado o estado que `compute.ts` calculou, quanto dinheiro está em
 * risco naquela combinação (cliente, serviço).
 *
 * **Por que mora aqui e não em `server/services/ciclo.ts`, de onde veio.** É `preço × fator`,
 * sem I/O — regra de negócio pura, que a regra 5 do `CLAUDE.md` manda pôr em `core/`. Estando no
 * serviço, a única forma de exercitá-la era o teste de integração (`tests/integration/ciclo.test.ts`),
 * que precisa subir um Supabase. Ou seja: a tabela que ORDENA a tela "Recuperar receita" — o
 * diferencial que sustenta o preço do produto — só era conferida com banco no ar, enquanto a
 * primeira metade do mesmo parágrafo da especificação (o estado, em `compute.ts`) tem teste de
 * unidade desde sempre. As duas metades agora ficam no mesmo lugar, testáveis do mesmo jeito.
 *
 * A promessa que isto sustenta está escrita na landing. Até a `0067` era "o preço do serviço
 * vezes a chance de ela voltar", e `quemRecuperar` ordenava por este número. O `docs/48` C3
 * trocou o CRITÉRIO da ordem para o lucro (`lucroEmRiscoCents`, abaixo) e a frase da landing foi
 * junto — mudar a ordem sem mudar a promessa seria a mesma coisa que não mudar nada.
 *
 * Este número continua existindo e continua sendo anunciado: "quanto de receita está parado" é
 * outra pergunta, e ela também é feita.
 */
export const PROBABILIDADE_POR_ESTADO: Record<EstadoCiclo, number> = {
  /*
   * `on_track` é 0 e não é omissão: quem está em dia não tem receita em risco. A view
   * `v_recover_revenue` já filtra esse estado fora da tela, mas o job recalcula TODA combinação,
   * então o valor precisa existir e precisa ser zero — não `undefined`.
   */
  on_track: 0,
  due: 0.85,
  late: 0.65,
  at_risk: 0.35,
  lost: 0.12,
}

export function valorEmRiscoCents(priceCents: number, state: string): number {
  const probabilidade = PROBABILIDADE_POR_ESTADO[state as EstadoCiclo] ?? 0
  // "sempre arredondado para baixo" — nunca prometer mais do que entrega.
  return Math.floor(priceCents * probabilidade)
}

export type EntradaLucroEsperado = {
  priceCents: number
  /** Comissão do profissional que costuma atender aquela pessoa naquele serviço, em bps. */
  commissionBps: number
  /** Material da ficha de consumo, em centavos, por atendimento. */
  materialCents: number
}

/**
 * O que SOBRA de um atendimento daquele serviço — a mesma subtração de `calcularSobraDaComanda`,
 * projetada para uma visita que ainda não aconteceu.
 *
 * **Sem a taxa da maquininha**, e isso é uma escolha declarada: ela depende da forma de pagamento,
 * que numa visita futura ninguém sabe. Escolher uma média seria inventar um número — o que o
 * `docs/48` §Fase 3 proíbe. O efeito é um lucro esperado um pouco otimista, do tamanho de uma taxa
 * de cartão, igual em todas as linhas; a ORDEM da fila, que é para o que este número serve, não
 * muda por causa disso.
 *
 * A comissão sai do percentual configurado hoje, não de uma comanda congelada: aqui não se está
 * medindo o passado, e sim estimando o valor de uma visita que talvez aconteça amanhã.
 */
export function lucroEsperadoCents(entrada: EntradaLucroEsperado): number {
  const comissao = Math.round((entrada.priceCents * entrada.commissionBps) / 10_000)
  return Math.max(0, entrada.priceCents - comissao - entrada.materialCents)
}

/**
 * `docs/48` C3: a fila de recuperação ordenada por quanto vale trazer de volta — e "valer" é o
 * lucro, não o preço. Um corte de R$ 200 com 60% de comissão e R$ 30 de produto deixa menos que um
 * de R$ 80 sem comissão nenhuma; ordenar por receita põe o primeiro no topo, e o dono gasta o
 * WhatsApp do dia com quem vale menos.
 */
export function lucroEmRiscoCents(lucroEsperadoCents: number, state: string): number {
  const probabilidade = PROBABILIDADE_POR_ESTADO[state as EstadoCiclo] ?? 0
  // Mesmo piso do `valorEmRiscoCents`: arredondar para baixo, nunca prometer mais do que entrega.
  return Math.floor(lucroEsperadoCents * probabilidade)
}
