import { Temporal } from '@js-temporal/polyfill'
import Papa from 'papaparse'
import { z } from 'zod'

import { computeCycle } from '@/core/cycle/compute'
import { AppError } from '@/server/http/errors'
import { hashTelefone, normalizarTelefoneBR } from '@/server/services/telefone'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Linhas suficientes para provar o critério de aceite (500 em <10s) com folga; acima disso é abuso, não planilha de salão. */
const MAX_LINHAS = 5000

/**
 * Era 200. Corrigido para 100 depois de confirmado no CI (S13, 2026-08-24, com diagnóstico
 * temporário que já saiu): o `.in('phone_hash', ...)` da checagem de duplicata é `GET`, então
 * cada hash vira ~65 caracteres na própria URL — 200 hashes de 64 caracteres batiam no teto de
 * tamanho de URL do gateway local (`supabase start`), com a mensagem exata `URI too long`. Em
 * produção nunca apareceu porque o gateway hospedado tem um teto mais folgado — o comentário
 * antigo aqui só sabia que **500 sem lote nenhum** falhava; nunca foi medido contra um gateway
 * mais restrito até o CI rodar pela primeira vez. 100 é seguro com folga nos dois ambientes.
 */
const TAMANHO_DO_LOTE = 100

/**
 * Espelham `EsquemaCliente` (`clientes.ts`), e não é coincidência: o achado S7 da auditoria de
 * 2026-08-23 é que a importação de CSV escreve em `clients` **sem passar por aquele schema** —
 * duas portas de entrada para a mesma tabela aceitando coisas diferentes. Um arquivo de 5 MB numa
 * linha só entrava como um nome de 5 MB.
 *
 * O achado original é sobre injeção de fórmula (`=CMD(...)` num nome que depois abre no Excel).
 * Isso continua **não sendo explorável hoje** — não existe nenhuma exportação em CSV neste
 * projeto, então a fórmula não tem por onde sair. Quando a primeira nascer (`data-export` é o
 * lugar óbvio para alguém pedir "e em Excel?"), o escape tem que ser na ESCRITA da exportação,
 * não aqui: sanitizar na entrada estragaria o dado de quem legitimamente se chama "O=Ó".
 */
const LIMITE_NOME = 120
const LIMITE_EMAIL = 254 // RFC 5321
const LIMITE_TAG = 40
const MAX_TAGS = 20

export const EsquemaMapeamento = z.object({
  name: z.string().min(1, 'Escolha a coluna do nome.'),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  tags: z.string().nullish(),
  /**
   * F2/ticket 13 (`docs/25-ESTRATEGIA-E-EXECUCAO.md`): opcional. Sem data de última visita não
   * há "última visita" para o Motor de Ciclo prever a partir dela (mesma regra de
   * `computeCycle`: history vazio nunca é "atrasado", é "nunca veio").
   */
  lastVisit: z.string().nullish(),
})

export type Mapeamento = z.infer<typeof EsquemaMapeamento>

export type LinhaComErro = { linha: number; motivo: string }

/**
 * F2/ticket 13: "a pessoa importa 200 contatos e a tela responde 'N já passaram do tempo de
 * voltar'". Calculado com `computeCycle` (o MESMO algoritmo do Motor de Ciclo, não um número
 * inventado) — mas nunca gravado em `client_cycles`, porque essa tabela exige `service_id`
 * (PK composta, `0001_initial.sql`) e um cliente importado não tem nenhum atendimento ainda, logo
 * nenhum serviço associado. É uma prévia de leitura única no momento da importação, não o
 * sistema de registro — o ciclo de verdade nasce (e persiste) quando o primeiro atendimento
 * daquele cliente for concluído, do jeito que já funciona para todo o resto do produto.
 */
export type PrevisaoImportacao = {
  /** Quantos dos importados vieram com a coluna de última visita preenchida e válida. */
  comDataInformada: number
  /** Entre esses, quantos já passaram do ciclo esperado (`computeCycle` não devolveu on_track). */
  jaDevendoVoltar: number
}

export type ResultadoImportacao = {
  imported: number
  skipped: LinhaComErro[]
  errors: LinhaComErro[]
  /** `null` quando ninguém mapeou a coluna de última visita — não há o que prever. */
  previsao: PrevisaoImportacao | null
}

function parsearCsv(texto: string): { colunas: string[]; linhas: Record<string, string>[] } {
  const resultado = Papa.parse<Record<string, string>>(texto, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  // Papa não lança para CSV malformado — acumula em `errors`. Um delimitador
  // trocado (`;` em vez de `,`) produz "erros" de campo a mais, não exceção;
  // por isso a checagem de linhas > MAX_LINHAS logo abaixo é o que evita um
  // arquivo gigante virar 5000 linhas de erro em vez de recusa direta.
  if (resultado.errors.some((e) => e.type === 'Delimiter')) {
    throw AppError.validacao({ file: 'Não consegui identificar as colunas. Confira se é um CSV separado por vírgula.' })
  }

  return { colunas: resultado.meta.fields ?? [], linhas: resultado.data }
}

/** Preview: cabeçalhos + amostra, para a UI montar a tela de mapeamento antes de importar de verdade. */
export function preVisualizarCsv(texto: string, amostra = 10): { colunas: string[]; sample: Record<string, string>[] } {
  const { colunas, linhas } = parsearCsv(texto)
  if (colunas.length === 0) throw AppError.validacao({ file: 'O arquivo está vazio ou sem cabeçalho.' })
  return { colunas, sample: linhas.slice(0, amostra) }
}

type LinhaValida = {
  linha: number
  name: string
  phoneE164: string | null
  email: string | null
  tags: string[]
  lastVisitDate: Temporal.PlainDate | null
}

/**
 * Só o formato ISO (`Temporal.PlainDate.from` não aceita outro) — mesmo padrão do resto do
 * projeto (nenhum lugar em `core/`/`server/` faz parsing de data em formato BR). Data inválida ou
 * num formato diferente não derruba a linha: a última visita é só um bônus para a prévia, o
 * cliente importa igual sem ela.
 */
function tentarParsearData(bruto: string | undefined): Temporal.PlainDate | null {
  if (!bruto) return null
  try {
    return Temporal.PlainDate.from(bruto.trim())
  } catch {
    return null
  }
}

/** Aplica o mapeamento de coluna e valida cada linha — sem tocar no banco ainda. */
function validarLinhas(linhas: Record<string, string>[], mapa: Mapeamento): { validas: LinhaValida[]; errors: LinhaComErro[] } {
  const validas: LinhaValida[] = []
  const errors: LinhaComErro[] = []

  linhas.forEach((linha, indice) => {
    // Linha 1 do arquivo é o cabeçalho; a primeira linha de dado é a 2 — é o
    // número que a pessoa vê se abrir a planilha para corrigir.
    const numero = indice + 2
    const name = linha[mapa.name]?.trim()

    if (!name) {
      errors.push({ linha: numero, motivo: 'Nome em branco.' })
      return
    }

    // Achado S7 da auditoria de 2026-08-23: este caminho não passava pelo `EsquemaCliente`, que
    // é quem impõe os limites no caminho de API. Um arquivo de 5 MB numa linha só entrava como
    // um nome de 5 MB, e nada barrava. Os números são os mesmos do schema, de propósito — duas
    // portas de entrada para a mesma tabela não podem aceitar coisas diferentes.
    if (name.length > LIMITE_NOME) {
      errors.push({ linha: numero, motivo: `Nome muito longo (máximo ${LIMITE_NOME} caracteres).` })
      return
    }

    let phoneE164: string | null = null
    const phoneBruto = mapa.phone ? linha[mapa.phone]?.trim() : undefined
    if (phoneBruto) {
      const normalizado = normalizarTelefoneBR(phoneBruto)
      if (!normalizado) {
        errors.push({ linha: numero, motivo: `Telefone inválido: "${phoneBruto}".` })
        return
      }
      phoneE164 = normalizado
    }

    const emailBruto = mapa.email ? linha[mapa.email]?.trim() : undefined
    if (emailBruto && emailBruto.length > LIMITE_EMAIL) {
      errors.push({ linha: numero, motivo: 'E-mail muito longo.' })
      return
    }

    const tagsBruto = mapa.tags ? linha[mapa.tags]?.trim() : undefined
    const tags = tagsBruto
      ? tagsBruto
          .split(/[,;]/)
          .map((t) => t.trim())
          .filter(Boolean)
          // Mesmos tetos do `EsquemaCliente`: etiqueta de até 40, no máximo 20 por cliente.
          .filter((t) => t.length <= LIMITE_TAG)
          .slice(0, MAX_TAGS)
      : []

    const lastVisitBruto = mapa.lastVisit ? linha[mapa.lastVisit]?.trim() : undefined
    const lastVisitDate = tentarParsearData(lastVisitBruto)

    validas.push({ linha: numero, name, phoneE164, email: emailBruto || null, tags, lastVisitDate })
  })

  return { validas, errors }
}

/**
 * ✅ do TICKET-019: 500 linhas em <10s, linha inválida não derruba o lote,
 * duplicata sinalizada. As três coisas vêm de decisões separadas:
 *
 * 1. Validação é toda em memória antes de qualquer ida ao banco — rápido, e
 *    uma linha ruim só entra em `errors`, nunca aborta as outras.
 * 2. Duplicata (mesmo telefone) é checada em duas rodadas — dentro do
 *    próprio arquivo e contra quem já existe no tenant — ambas em consultas
 *    únicas (`in`), não uma por linha.
 * 3. A escrita é em lotes de `TAMANHO_DO_LOTE`, não uma linha por vez: é o
 *    que faz 500 linhas caber em segundos, não em 500 idas de rede.
 */
export async function importarClientes(
  db: SupabaseClient<Database>,
  tenantId: string,
  csvText: string,
  mapa: Mapeamento,
): Promise<ResultadoImportacao> {
  const { linhas } = parsearCsv(csvText)
  if (linhas.length > MAX_LINHAS) {
    throw AppError.validacao({ file: `Envie no máximo ${MAX_LINHAS} linhas por vez.` })
  }

  const { validas, errors } = validarLinhas(linhas, mapa)
  const skipped: LinhaComErro[] = []

  // Duplicata dentro do próprio arquivo: mantém a primeira ocorrência,
  // sinaliza as seguintes.
  const vistosNoArquivo = new Set<string>()
  const semDuplicataNoArquivo: LinhaValida[] = []
  for (const linha of validas) {
    if (linha.phoneE164 && vistosNoArquivo.has(linha.phoneE164)) {
      skipped.push({ linha: linha.linha, motivo: 'Telefone repetido no próprio arquivo.' })
      continue
    }
    if (linha.phoneE164) vistosNoArquivo.add(linha.phoneE164)
    semDuplicataNoArquivo.push(linha)
  }

  // Duplicata contra quem já existe no tenant: uma consulta só, com todos os
  // hashes de telefone do lote — não uma consulta por linha.
  const hashesDoLote = semDuplicataNoArquivo
    .filter((l) => l.phoneE164)
    .map((l) => ({ linha: l.linha, hash: hashTelefone(l.phoneE164!) }))

  const hashesExistentes = new Set<string>()
  // Em lotes: um `.in()` com centenas de hashes de 64 caracteres vira uma URL longa, e o
  // gateway pode recusar antes mesmo de a consulta chegar ao Postgres — medido de verdade no CI
  // (S13, 2026-08-24): `URI too long` num gateway local mais restrito que o de produção, com
  // `TAMANHO_DO_LOTE` em 200. Reduzido para 100, folgado nos dois ambientes.
  for (let i = 0; i < hashesDoLote.length; i += TAMANHO_DO_LOTE) {
    const grupo = hashesDoLote.slice(i, i + TAMANHO_DO_LOTE)
    const { data, error } = await db
      .from('clients')
      .select('phone_hash')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .in('phone_hash', grupo.map((h) => h.hash))
    if (error) throw new AppError('INTERNAL', { cause: error })
    for (const row of data ?? []) if (row.phone_hash) hashesExistentes.add(row.phone_hash)
  }

  const paraInserir: LinhaValida[] = []
  for (const linha of semDuplicataNoArquivo) {
    const hash = linha.phoneE164 ? hashTelefone(linha.phoneE164) : null
    if (hash && hashesExistentes.has(hash)) {
      skipped.push({ linha: linha.linha, motivo: 'Já existe uma cliente com esse telefone.' })
      continue
    }
    paraInserir.push(linha)
  }

  let imported = 0
  const datasDeUltimaVisitaInseridas: Temporal.PlainDate[] = []
  for (let i = 0; i < paraInserir.length; i += TAMANHO_DO_LOTE) {
    const lote = paraInserir.slice(i, i + TAMANHO_DO_LOTE)
    const { error } = await db.from('clients').insert(
      lote.map((l) => ({
        tenant_id: tenantId,
        name: l.name,
        phone_e164: l.phoneE164,
        phone_hash: l.phoneE164 ? hashTelefone(l.phoneE164) : null,
        email: l.email,
        tags: l.tags,
        source: 'csv_import',
      })),
    )

    if (!error) {
      imported += lote.length
      for (const l of lote) if (l.lastVisitDate) datasDeUltimaVisitaInseridas.push(l.lastVisitDate)
      continue
    }

    // O lote inteiro falhou (corrida rara: outra importação inseriu o mesmo
    // telefone entre a checagem e esta escrita). Refaz linha a linha só deste
    // lote, para isolar qual e não perder as outras 199 do grupo.
    for (const linha of lote) {
      const { error: erroLinha } = await db.from('clients').insert({
        tenant_id: tenantId,
        name: linha.name,
        phone_e164: linha.phoneE164,
        phone_hash: linha.phoneE164 ? hashTelefone(linha.phoneE164) : null,
        email: linha.email,
        tags: linha.tags,
        source: 'csv_import',
      })
      if (erroLinha) {
        if (erroLinha.code === '23505') {
          skipped.push({ linha: linha.linha, motivo: 'Já existe uma cliente com esse telefone.' })
        } else {
          errors.push({ linha: linha.linha, motivo: 'Não consegui salvar esta linha.' })
        }
      } else {
        imported++
        if (linha.lastVisitDate) datasDeUltimaVisitaInseridas.push(linha.lastVisitDate)
      }
    }
  }

  const previsao = await calcularPrevisao(db, tenantId, datasDeUltimaVisitaInseridas)

  return { imported, skipped, errors, previsao }
}

/**
 * Ver `PrevisaoImportacao`. `defaultCycleDays` vem da média dos `cycle_days` já cadastrados no
 * tenant (todo tenant sai do onboarding com um pacote de serviços — TICKET-072) porque o cliente
 * importado não tem `service_id` nenhum ainda; 30 dias é só o último recurso, para um tenant sem
 * nenhum serviço configurado (não deveria acontecer, mas não é motivo para a prévia quebrar).
 */
async function calcularPrevisao(
  db: SupabaseClient<Database>,
  tenantId: string,
  datas: readonly Temporal.PlainDate[],
): Promise<PrevisaoImportacao | null> {
  if (datas.length === 0) return null

  const { data: servicos, error } = await db.from('services').select('cycle_days').eq('tenant_id', tenantId).gt('cycle_days', 0)
  if (error) throw new AppError('INTERNAL', { cause: error })

  const ciclos = (servicos ?? []).map((s) => s.cycle_days).filter((c): c is number => c !== null)
  const defaultCycleDays = ciclos.length > 0 ? Math.round(ciclos.reduce((soma, c) => soma + c, 0) / ciclos.length) : 30

  const hoje = Temporal.Now.plainDateISO()
  const jaDevendoVoltar = datas.filter(
    (data) => computeCycle({ history: [{ date: data }], defaultCycleDays, today: hoje }).state !== 'on_track',
  ).length

  return { comDataInformada: datas.length, jaDevendoVoltar }
}
