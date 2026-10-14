import type { LucroDoCliente } from './lucro-do-cliente'

/**
 * APR-115 (docs/98 I-13, A-22): os números do resumo da ficha, e a regra de quando cada um aparece.
 *
 * Eram seis quadros fixos ("Entrou", "Sobrou", "Visitas", "Ticket médio", "Faltas", "Lucro por
 * ano"), com "Faltas 0" e "Sobrou R$ 0,00 · nenhuma comanda fechada ainda" ocupando a primeira
 * tela de quem só quer saber como a pessoa gosta de ser atendida. A regra agora é uma só:
 * **número só aparece com dado por trás.** Zero falta não é informação; é ausência de problema.
 * "Sobrou" sem comanda fechada é zero sem significado. Gasto médio sem visita é divisão por nada.
 */
export type TileDoResumo = {
  chave: 'visitas' | 'gasto' | 'sobrou' | 'faltas' | 'ano'
  rotulo: string
  valor: { tipo: 'contagem'; n: number } | { tipo: 'dinheiro'; cents: number }
  apoio?: string
}

export type EntradaResumoDaFicha = {
  visitas: number
  faltas: number
  ticketMedioCents: number
  lucro: LucroDoCliente | null
}

export function tilesDoResumo(m: EntradaResumoDaFicha): TileDoResumo[] {
  const tiles: TileDoResumo[] = [{ chave: 'visitas', rotulo: 'Visitas', valor: { tipo: 'contagem', n: m.visitas } }]

  if (m.visitas > 0) {
    tiles.push({ chave: 'gasto', rotulo: 'Gasto médio por visita', valor: { tipo: 'dinheiro', cents: m.ticketMedioCents } })
  }

  if (m.lucro && m.lucro.cobertura !== 'nenhuma') {
    tiles.push({
      chave: 'sobrou',
      rotulo: 'Sobrou',
      valor: { tipo: 'dinheiro', cents: m.lucro.lucroCents },
      apoio:
        m.lucro.cobertura === 'parcial'
          ? `de ${m.visitas - m.lucro.visitasSemComanda} de ${m.visitas} visitas`
          : 'de todas as visitas',
    })
  }

  if (m.faltas > 0) {
    tiles.push({ chave: 'faltas', rotulo: 'Faltas', valor: { tipo: 'contagem', n: m.faltas } })
  }

  if (m.lucro?.lucroAnualCents !== null && m.lucro?.lucroAnualCents !== undefined) {
    tiles.push({ chave: 'ano', rotulo: 'Lucro por ano', valor: { tipo: 'dinheiro', cents: m.lucro.lucroAnualCents }, apoio: 'no ritmo de hoje' })
  }

  return tiles
}
