/**
 * E3 da esteira (`docs/97` §5): achar a tabela dentro da grade.
 *
 * O cabeçalho quase nunca está na linha 1 de um export de verdade: vem título, "Período: …", linha
 * em branco, e só então os nomes das colunas. No fim, "Total" e rodapé. Relatório de outro sistema
 * vem agrupado ("Profissional: Ana" numa linha solta, e as linhas dela embaixo) e repete o cabeçalho
 * a cada página. Tudo isso é resolvido aqui, e NADA some calado: toda linha da grade sai numa tabela
 * ou em `ignoradas`, com o motivo — a invariante da esteira começa nesta estação.
 *
 * A heurística vai errar em planilha estranha (o estado da arte também erra, `docs/97` rev. 98): por
 * isso a prévia deixa ajustar o retângulo, e o resultado diz `confianca`.
 */

export type MotivoIgnorada = 'vazia' | 'titulo' | 'filtro' | 'cabecalho' | 'cabecalho_repetido' | 'grupo' | 'total' | 'rodape' | 'outra_tabela'

export type LinhaDeDados = { origem: number; celulas: string[] }

export type Tabela = {
  cabecalho: string[]
  /** `false`: a grade não tinha cabeçalho reconhecível, e os nomes são "Coluna 1", "Coluna 2"… */
  temCabecalho: boolean
  linhas: LinhaDeDados[]
  /** Índice da coluna acrescentada com o valor do grupo ("Profissional: Ana"), se houver. */
  colunaDeGrupo: number | null
  /** 0 a 1: quão certa a esteira está de ter achado o retângulo certo. */
  confianca: number
}

export type TabelasAchadas = {
  tabelas: Tabela[]
  ignoradas: { origem: number; motivo: MotivoIgnorada }[]
  totalDeLinhas: number
}

type TipoDeCelula = 'vazio' | 'numero' | 'dinheiro' | 'telefone' | 'data' | 'email' | 'texto'

export function tipoDaCelula(bruto: string): TipoDeCelula {
  const v = bruto.trim()
  if (v === '') return 'vazio'
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'email'
  // Com hora, segundos, fração e fuso (o ISO completo que a exportação aberta escreve: "…T12:00:00.000Z").
  if (/^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})([ T]\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(v)) return 'data'
  if (/^(r\$|\$)\s*-?[\d.,]+$/i.test(v) || /^-?\d{1,3}(\.\d{3})*,\d{2}$/.test(v)) return 'dinheiro'
  const digitos = v.replace(/\D/g, '')
  if (/^[+()\d\s.-]+$/.test(v) && digitos.length >= 8 && digitos.length <= 13 && /[\s()-]/.test(v.replace(/^\+/, '')) ) return 'telefone'
  if (/^\+?\d{10,13}$/.test(v)) return 'telefone'
  if (/^-?[\d.,]+%?$/.test(v)) return 'numero'
  return 'texto'
}

const PALAVRAS_DE_CABECALHO =
  /^(nome|cliente|clientes|telefone|celular|cel|fone|whats|whatsapp|contato|e-?mail|email|data|dia|hora|servi[cç]o|profissional|valor|pre[cç]o|total|observa[cç][aã]o|obs|anivers[aá]rio|nascimento|cpf|documento|endere[cç]o|cidade|bairro|g[eê]nero|sexo|origem|etiqueta|tags?|status|situa[cç][aã]o|[uú]ltima visita|[uú]ltimo atendimento|c[oó]digo|id|qtd|quantidade)\b/i

/** Filtro é "rótulo: valor" ("Período: 01/01 a 30/09", "Unidade: Centro") ou "Gerado em …". Título é o resto. */
const FILTRO = /^([^:]{1,40}:\s*\S|(gerado|emitido|impresso) em\b)/i
/** O que rodapé de relatório costuma dizer. */
const RODAPE = /\b(gerado|emitido|impresso|sistema|p[aá]gina|relat[oó]rio|software|vers[aã]o)\b|www\.|https?:|©/i
const TOTAL = /^(total|totais|soma|subtotal|total geral|quantidade de|qtd\.? total|registros|n[uú]mero de registros)\b/i
const GRUPO = /^(profissional|colaborador|funcion[aá]rio|atendente|unidade|filial|barbeiro|cabeleireir[oa]|m[eê]s|dia|data)\s*:\s*(.+)$/i

const preenchidas = (l: string[]) => l.filter((c) => c.trim() !== '')

function pareceCabecalho(linha: string[]): number {
  const cheias = preenchidas(linha)
  if (cheias.length < 2) return 0
  const tipos = cheias.map(tipoDaCelula)
  const texto = tipos.filter((t) => t === 'texto').length / cheias.length
  if (tipos.some((t) => t === 'telefone' || t === 'email' || t === 'data' || t === 'dinheiro')) return 0
  const distintos = new Set(cheias.map((c) => c.trim().toLowerCase())).size === cheias.length ? 1 : 0.5
  const conhecidas = cheias.filter((c) => PALAVRAS_DE_CABECALHO.test(c.trim())).length / cheias.length
  const curtas = cheias.filter((c) => c.trim().length <= 40).length / cheias.length
  return texto * 0.4 + conhecidas * 0.4 + distintos * 0.1 + curtas * 0.1
}

/** Fração das células que são palavras de cabeçalho conhecidas ("Nome", "Telefone", "Data"…). */
const fracaoConhecida = (linha: string[]) => {
  const cheias = preenchidas(linha)
  return cheias.length ? cheias.filter((c) => PALAVRAS_DE_CABECALHO.test(c.trim())).length / cheias.length : 0
}

const mesmaLinha = (a: string[], b: string[]) => {
  const x = preenchidas(a).map((c) => c.trim().toLowerCase())
  const y = preenchidas(b).map((c) => c.trim().toLowerCase())
  return x.length > 0 && x.length === y.length && x.every((v, i) => v === y[i])
}

/**
 * Blocos = trechos de linhas não vazias. Linha em branco separa bloco; duas tabelas na mesma aba
 * viram dois blocos com cabeçalho cada.
 */
function blocos(grade: string[][]): { inicio: number; fim: number }[] {
  const out: { inicio: number; fim: number }[] = []
  let inicio = -1
  grade.forEach((l, i) => {
    const vazia = preenchidas(l).length === 0
    if (!vazia && inicio < 0) inicio = i
    if (vazia && inicio >= 0) {
      out.push({ inicio, fim: i - 1 })
      inicio = -1
    }
  })
  if (inicio >= 0) out.push({ inicio, fim: grade.length - 1 })
  return out
}

export function acharTabelas(grade: string[][]): TabelasAchadas {
  const ignoradas: TabelasAchadas['ignoradas'] = []
  const tabelas: Tabela[] = []
  grade.forEach((l, i) => {
    if (preenchidas(l).length === 0) ignoradas.push({ origem: i, motivo: 'vazia' })
  })

  // Largura típica dos dados: a moda das contagens de células preenchidas com 2 ou mais.
  const larguras = new Map<number, number>()
  for (const l of grade) {
    const n = preenchidas(l).length
    if (n >= 2) larguras.set(n, (larguras.get(n) ?? 0) + 1)
  }
  const larguraTipica = [...larguras].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 1

  let tabelaAberta: Tabela | null = null
  let cabecalhoAtual: string[] | null = null
  let grupo: string | null = null

  for (const bloco of blocos(grade)) {
    // Linha em branco no meio da lista NÃO abre tabela nova: só fecha a anterior se este bloco começa
    // com cabeçalho (na 1ª linha, ou na 2ª depois de um título). Antes, toda linha em branco fechava a
    // tabela, e quem vinha depois dela virava "outra tabela" e sumia da importação (Onda E, achado ao
    // provar o D4 com ";;" no meio da lista).
    const abreTabelaNova = [bloco.inicio, bloco.inicio + 1].some((k) => k <= bloco.fim && pareceCabecalho(grade[k]!) >= 0.5 && fracaoConhecida(grade[k]!) >= 0.5)
    if (abreTabelaNova || (tabelaAberta && preenchidas(grade[bloco.inicio]!).length > tabelaAberta.cabecalho.length)) {
      tabelaAberta = null
      cabecalhoAtual = null
      grupo = null
    }
    // Lista ESPARSA (nome sem telefone, telefone sem nome): linhas de uma célula só são dado, não nome
    // de grupo. O que denuncia: célula solitária fora da primeira coluna, ou duas solitárias seguidas.
    // Relatório agrupado põe o rótulo sempre na primeira coluna, seguido de linhas cheias.
    let esparsa = false
    for (let i = bloco.inicio; i <= bloco.fim; i++) {
      const linha = grade[i]!
      if (preenchidas(linha).length !== 1) continue
      const coluna = linha.findIndex((c) => c.trim() !== '')
      if (coluna > 0 || (i < bloco.fim && preenchidas(grade[i + 1]!).length === 1)) esparsa = true
    }
    // Grupo sem rótulo ("Ana" sozinha) só no padrão de relatório de verdade: pelo menos dois rótulos no
    // bloco, cada um seguido de pelo menos duas linhas cheias. Numa lista com uma pessoa sem contato
    // ("Ana Paula" sozinha), o nome dela não pode virar grupo.
    const cheiaEm = (k: number) => k <= bloco.fim && preenchidas(grade[k]!).length >= 2
    const rotulos: number[] = []
    for (let i = bloco.inicio; i <= bloco.fim; i++) if (preenchidas(grade[i]!).length === 1 && cheiaEm(i + 1) && cheiaEm(i + 2)) rotulos.push(i)
    const relatorioAgrupado = !esparsa && rotulos.length >= 2
    for (let i = bloco.inicio; i <= bloco.fim; i++) {
      const linha = grade[i]!
      const cheias = preenchidas(linha)
      const primeira = cheias[0]?.trim() ?? ''

      if (cabecalhoAtual && mesmaLinha(linha, cabecalhoAtual)) {
        ignoradas.push({ origem: i, motivo: 'cabecalho_repetido' })
        continue
      }
      // "Total" no começo de um CABEÇALHO ("Total de atendimentos" primeiro, colunas em outra ordem)
      // não é linha de total: total tem número ou vazio do lado, cabeçalho tem texto.
      if (cheias.length >= 1 && TOTAL.test(primeira) && (cheias.length <= 2 || pareceCabecalho(linha) < 0.5)) {
        ignoradas.push({ origem: i, motivo: 'total' })
        continue
      }
      const g = cheias.length <= 2 ? GRUPO.exec(cheias.join(' ').trim()) : null
      if (g && tabelaAberta) {
        grupo = g[2]!.trim()
        ignoradas.push({ origem: i, motivo: 'grupo' })
        continue
      }
      // Linha solta (uma célula) no meio de uma tabela aberta: nome de grupo sem rótulo ("Ana").
      if (relatorioAgrupado && rotulos.includes(i) && cheias.length === 1 && tabelaAberta && tipoDaCelula(primeira) === 'texto' && larguraTipica >= 2 && i < bloco.fim) {
        const proxima = grade[i + 1]!
        if (preenchidas(proxima).length >= 2) {
          grupo = primeira
          ignoradas.push({ origem: i, motivo: 'grupo' })
          continue
        }
      }

      const pontosCabecalho = pareceCabecalho(linha)
      const largaOBastante = cheias.length >= Math.max(2, Math.ceil(larguraTipica * 0.6))
      const proximaEDado = i < bloco.fim && preenchidas(grade[i + 1]!).length >= 2 && pareceCabecalho(grade[i + 1]!) < pontosCabecalho

      // Com a tabela já aberta, um SEGUNDO cabeçalho precisa de palavras de cabeçalho conhecidas: linha de
      // dados com texto ("João Lima", "11 98888 0002 / 11 3333-0002") não abre tabela nova.
      const novoCabecalhoValido = !tabelaAberta || fracaoConhecida(linha) >= 0.5
      if (largaOBastante && pontosCabecalho >= 0.5 && novoCabecalhoValido && (proximaEDado || !tabelaAberta)) {
        cabecalhoAtual = linha
        grupo = null
        tabelaAberta = { cabecalho: linha.map((c) => c.trim()), temCabecalho: true, linhas: [], colunaDeGrupo: null, confianca: Math.min(1, 0.5 + pontosCabecalho / 2) }
        tabelas.push(tabelaAberta)
        ignoradas.push({ origem: i, motivo: 'cabecalho' })
        continue
      }

      if (!tabelaAberta) {
        if (largaOBastante) {
          // Dados sem cabeçalho reconhecível: abre uma tabela com nomes genéricos.
          const largura = Math.max(...grade.slice(i, bloco.fim + 1).map((l) => l.length))
          tabelaAberta = {
            cabecalho: Array.from({ length: largura }, (_, k) => `Coluna ${k + 1}`),
            temCabecalho: false,
            linhas: [],
            colunaDeGrupo: null,
            confianca: 0.5,
          }
          tabelas.push(tabelaAberta)
        } else {
          ignoradas.push({ origem: i, motivo: FILTRO.test(primeira) ? 'filtro' : 'titulo' })
          continue
        }
      }

      if (!largaOBastante && cheias.length <= 1) {
        // Linha de uma célula com a tabela aberta: rodapé só se tiver cara de rodapé ("Gerado pelo
        // Sistema X") ou de filtro. Senão é DADO de uma lista esparsa (nome sem telefone) — antes ela
        // sumia como "rodapé", e uma lista de nomes inteira virava zero pessoas.
        if (RODAPE.test(primeira) || FILTRO.test(primeira) || tabelaAberta.linhas.length === 0 && !esparsa) {
          ignoradas.push({ origem: i, motivo: tabelaAberta.linhas.length > 0 ? 'rodape' : FILTRO.test(primeira) ? 'filtro' : 'titulo' })
          continue
        }
      }

      const celulas = linha.map((c) => c.trim())
      if (grupo !== null) {
        if (tabelaAberta.colunaDeGrupo === null) {
          tabelaAberta.colunaDeGrupo = tabelaAberta.cabecalho.length
          tabelaAberta.cabecalho.push('Grupo')
        }
        while (celulas.length < tabelaAberta.colunaDeGrupo) celulas.push('')
        celulas[tabelaAberta.colunaDeGrupo] = grupo
      }
      tabelaAberta.linhas.push({ origem: i, celulas })
    }
  }

  ignoradas.sort((a, b) => a.origem - b.origem)
  return { tabelas: tabelas.filter((t) => t.linhas.length > 0 || t.temCabecalho), ignoradas, totalDeLinhas: grade.length }
}
