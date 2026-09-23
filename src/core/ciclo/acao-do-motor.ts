/**
 * O que a Central de Ações do "Hoje" diz sobre o Motor quando NINGUÉM está sumindo.
 *
 * Medido no navegador (docs/82 §16, rodada 19): uma conta nova pôs 2 pessoas no Motor, ninguém
 * atrasado, e o "Hoje" virou três pendências de custo (maquininha, aluguel, produto) — nenhuma
 * palavra do Motor, que é o produto. E uma conta com fichas sem última visita (criadas pela
 * reserva online ou pela ficha avulsa) nunca era mandada para o "Já atendo", o único caminho que
 * faz o Motor começar no mesmo dia em vez de esperar cada cliente voltar.
 *
 * Quando há gente sumindo, quem fala é o alarme "N clientes estão sumindo" (`crm.ts`), e esta
 * função cala: dizer "ninguém sumiu" ao lado dele seria o produto se contradizendo.
 *
 * Função pura porque o que precisa de guarda é a ESCOLHA do estado; o tipo de retorno é o mesmo
 * formato de `AcaoSugerida` sem importar de `server/` (regra 5 do CLAUDE.md).
 */
export type AcaoDoMotor = {
  chave: 'motor-sem-ultima-visita' | 'motor-de-olho'
  titulo: string
  descricao: string
  href: string
  tom: 'info' | 'ok'
}

export function acaoDoMotor(estado: {
  clientes: number
  sumindo: number
  ciclos: number
  /** "daqui a 6 dias (29/09)" — `quandoVolta`; `null` quando ninguém em dia tem volta futura. */
  quandoOProximoVolta: string | null
}): AcaoDoMotor | null {
  if (estado.sumindo > 0 || estado.clientes === 0) return null

  if (estado.ciclos === 0) {
    return {
      chave: 'motor-sem-ultima-visita',
      titulo: 'Diga quando cada pessoa veio pela última vez',
      descricao:
        'Suas fichas ainda não têm a última visita, então o Motor não sabe quem está sumindo. De memória, sem precisar ser exato — ele começa hoje.',
      href: '/admin/clientes/ja-atendo',
      tom: 'info',
    }
  }

  if (!estado.quandoOProximoVolta) return null
  return {
    chave: 'motor-de-olho',
    titulo: 'Ninguém sumiu por enquanto',
    descricao: `O Motor está de olho em quem você cadastrou. O próximo deve voltar ${estado.quandoOProximoVolta}; se atrasar, aparece aqui.`,
    href: '/admin/recuperar',
    tom: 'ok',
  }
}
