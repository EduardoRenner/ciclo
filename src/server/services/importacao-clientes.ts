import Papa from 'papaparse'
import { z } from 'zod'

import { AppError } from '@/server/http/errors'
import { hashTelefone, normalizarTelefoneBR } from '@/server/services/telefone'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Linhas suficientes para provar o critério de aceite (500 em <10s) com folga; acima disso é abuso, não planilha de salão. */
const MAX_LINHAS = 5000
const TAMANHO_DO_LOTE = 200

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
})

export type Mapeamento = z.infer<typeof EsquemaMapeamento>

export type LinhaComErro = { linha: number; motivo: string }

export type ResultadoImportacao = {
  imported: number
  skipped: LinhaComErro[]
  errors: LinhaComErro[]
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

type LinhaValida = { linha: number; name: string; phoneE164: string | null; email: string | null; tags: string[] }

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

    validas.push({ linha: numero, name, phoneE164, email: emailBruto || null, tags })
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
  // Em lotes: um `.in()` com 500 hashes de 64 caracteres vira uma URL de
  // dezenas de KB, e o PostgREST recusa (medido: a checagem inteira falhava
  // com 500 linhas, mesmo que cada hash sozinho seja válido).
  for (let i = 0; i < hashesDoLote.length; i += TAMANHO_DO_LOTE) {
    const grupo = hashesDoLote.slice(i, i + TAMANHO_DO_LOTE)
    const { data, error } = await db
      .from('clients')
      .select('phone_hash')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .in('phone_hash', grupo.map((h) => h.hash))
    if (error) {
      // Diagnóstico temporário (S13, 2026-08-24): esta consulta falhou 3x seguidas só no CI
      // (nunca ao rodar isolada nem em lote contra produção) e a causa nunca apareceu em log
      // nenhum — `AppError` não serializa `cause`, e como `importarClientes` é chamada direto
      // pelo teste, sem passar pelo `rota()` que loga, não sobrava rastro nenhum a seguir. Isto
      // aqui só existe para a PRÓXIMA execução revelar o `code`/`message`/`details`/`hint` reais
      // do Postgres/PostgREST — remover assim que a causa for confirmada e corrigida de verdade.
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'importacao_clientes_lote_falhou_diagnostico',
          loteTamanho: grupo.length,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        }),
      )
      throw new AppError('INTERNAL', { cause: error })
    }
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
      }
    }
  }

  return { imported, skipped, errors }
}
