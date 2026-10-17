/**
 * CSV de exportação, em dois dialetos (`docs/103-conversor/00-pesquisa.md` P13/P14):
 *
 *   · **aberto** — para qualquer ferramenta ler (o padrão Data Package): `,`, UTF-8 SEM BOM, dado cru
 *     (telefone E.164, data ISO, dinheiro em centavos). Não é para abrir com dois cliques no Excel;
 *   · **excel** — para a pessoa abrir no Excel em português: `;`, BOM (sem ele o Excel estraga o
 *     acento), telefone `(11) 99999-0001` (com `+` o Excel lê como fórmula e vira notação científica —
 *     defeito D16), data dd/mm/aaaa, dinheiro em reais com vírgula, e fórmula NEUTRALIZADA.
 *
 * Neutralizar fórmula (OWASP CSV Injection): célula de texto que começa com `= + - @`, TAB, CR, LF ou as
 * versões de largura cheia (`＝ ＋ － ＠`) ganha um TAB na frente, dentro das aspas. O `'` da regra
 * antiga "not reliable" depois que o Excel salva e reabre, e ficava no nome na reimportação (D17);
 * `desfazerNeutralizacao` tira o TAB (e o `'` antigo) na volta, então "-Ana" sai e volta "-Ana".
 */

export type Dialeto = 'aberto' | 'excel'
export type TipoDeCampo = 'string' | 'integer' | 'number' | 'date' | 'datetime' | 'boolean' | 'telefone' | 'centavos'

export type Coluna = {
  /** Nome técnico (snake_case, do banco) — o cabeçalho do dialeto aberto. */
  nome: string
  /** Rótulo em português — o cabeçalho do dialeto Excel. */
  titulo: string
  tipo: TipoDeCampo
  descricao?: string
}

const GATILHOS = new Set(['=', '+', '-', '@', '\t', '\r', '\n', '＝', '＋', '－', '＠'])

export function neutralizarFormula(valor: string): string {
  return GATILHOS.has(valor.charAt(0)) ? `\t${valor}` : valor
}

/** O inverso, para a reimportação: só tira o prefixo quando ele protegia um gatilho de verdade. */
export function desfazerNeutralizacao(valor: string): string {
  if ((valor.startsWith('\t') || valor.startsWith("'")) && valor.length > 1 && GATILHOS.has(valor.charAt(1)) && valor.charAt(1) !== '\t') return valor.slice(1)
  return valor
}

const doisDigitos = (n: number) => String(n).padStart(2, '0')

function telefoneNacional(e164: string): string {
  const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164
}

function reais(centavos: number): string {
  const negativo = centavos < 0
  const abs = Math.abs(Math.trunc(centavos))
  const inteiro = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${negativo ? '-' : ''}${inteiro},${doisDigitos(abs % 100)}`
}

/** Valor → texto da célula, no dialeto. `null`/`undefined` viram vazio, nunca "null". */
export function textoDaCelula(valor: unknown, tipo: TipoDeCampo, dialeto: Dialeto): string {
  if (valor === null || valor === undefined || valor === '') return ''
  if (Array.isArray(valor)) return textoDaCelula(valor.join(dialeto === 'excel' ? ', ' : '|'), 'string', dialeto)
  if (dialeto === 'aberto') {
    if (tipo === 'boolean') return valor ? 'true' : 'false'
    return typeof valor === 'object' ? JSON.stringify(valor) : String(valor)
  }
  switch (tipo) {
    case 'telefone':
      return telefoneNacional(String(valor))
    case 'centavos':
      return reais(Number(valor))
    case 'date': {
      const s = String(valor)
      return /^\d{4}-\d{2}-\d{2}/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : s
    }
    case 'datetime': {
      const d = new Date(String(valor))
      if (Number.isNaN(d.getTime())) return String(valor)
      // Data e hora em UTC: a exportação não sabe o fuso de cada linha; o LEIA-ME diz.
      return `${doisDigitos(d.getUTCDate())}/${doisDigitos(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${doisDigitos(d.getUTCHours())}:${doisDigitos(d.getUTCMinutes())}`
    }
    case 'boolean':
      return valor ? 'sim' : 'não'
    case 'number':
      return String(valor).replace('.', ',')
    case 'integer':
      return String(valor)
    case 'string':
      return neutralizarFormula(typeof valor === 'object' ? JSON.stringify(valor) : String(valor))
  }
}

function aspas(campo: string, separador: string): string {
  return /["\r\n\t]/.test(campo) || campo.includes(separador) || /^\s|\s$/.test(campo) ? `"${campo.replace(/"/g, '""')}"` : campo
}

/** Linhas → CSV inteiro do dialeto. O BOM do Excel vai no começo do texto (`﻿`). */
export function paraCsv(colunas: readonly Coluna[], linhas: readonly Record<string, unknown>[], dialeto: Dialeto): string {
  const sep = dialeto === 'excel' ? ';' : ','
  const cabecalho = colunas.map((c) => aspas(dialeto === 'excel' ? c.titulo : c.nome, sep)).join(sep)
  const corpo = linhas.map((l) => colunas.map((c) => aspas(textoDaCelula(l[c.nome], c.tipo, dialeto), sep)).join(sep))
  return `${dialeto === 'excel' ? '﻿' : ''}${[cabecalho, ...corpo].join('\r\n')}\r\n`
}
