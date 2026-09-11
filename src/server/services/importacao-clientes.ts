import { Temporal } from '@js-temporal/polyfill'
import Papa from 'papaparse'
import { z } from 'zod'

import { preverEPersistirCiclos, type ClienteComUltimaVisita, type PrevisaoDaBase } from '@/server/services/ciclo-de-quem-ja-atende'
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
  /**
   * 2026-09-10. Não é uma coluna do arquivo: é a resposta de "que serviço essas pessoas fazem com
   * você?". Ele existe porque sem ele a importação **não entra no Motor de Ciclo** — e essa era a
   * promessa central do produto falhando calada.
   *
   * `client_cycles` tem PK `(tenant_id, client_id, service_id)` desde a `0001`, e cliente importado
   * não tem atendimento nenhum, logo não tem serviço. O efeito medido: a data de última visita era
   * lida, usada para mostrar "47 já devendo voltar" na tela da importação, e **descartada** — nem
   * `clients.last_visit_at` era gravado. `recompute-cycles` lê só `appointments`, e
   * `v_clientes_a_recuperar` lê `client_cycles`, então `/admin/hoje` continuava em R$ 0,00 depois de
   * importar 200 pessoas com data. A FAQ da home promete o contrário com todas as letras ("é ela que
   * faz a lista de quem sumiu nascer cheia no primeiro dia").
   *
   * Opcional de propósito: sem ele a importação continua funcionando exatamente como antes (cadastro
   * entra, prévia aparece, nada de ciclo). Quem não souber responder não fica travado na porta.
   */
  serviceId: z.string().uuid().nullish(),
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
/**
 * O tipo continua chamado `PrevisaoImportacao` porque e o nome que a tela le, mas a FORMULA mora
 * em `ciclo-de-quem-ja-atende.ts` desde 2026-09-11: a importacao por planilha e o cadastro de
 * memoria (`quem-ja-atendo.ts`) poem a MESMA base no Motor, e duas copias do mesmo calculo
 * divergem com as duas suites verdes.
 */
export type PrevisaoImportacao = PrevisaoDaBase


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
      skipped.push({ linha: linha.linha, motivo: 'Já existe uma ficha com esse telefone.' })
      continue
    }
    paraInserir.push(linha)
  }

  let imported = 0
  const comData: ClienteComUltimaVisita[] = []
  for (let i = 0; i < paraInserir.length; i += TAMANHO_DO_LOTE) {
    const lote = paraInserir.slice(i, i + TAMANHO_DO_LOTE)
    /*
      `last_visit_at` passou a ser GRAVADO em 2026-09-10. A coluna existe desde a `0001` e a
      importação nunca escreveu nela: a data que a pessoa mapeou virava um contador na tela e sumia.
      Ver o comentário de `serviceId` em `EsquemaMapeamento` para a cadeia inteira.

      `.select('id')` é o que permite ligar cada cadastro recém-criado ao ciclo dele. O Postgres
      devolve as linhas de um `insert` de múltiplos valores na ordem do `VALUES`, então o índice
      casa com o `lote` — mas isso é conferido antes de usar, e não é o tipo de coisa que se
      pressupõe calada (ver a guarda de tamanho logo abaixo).
    */
    const { data, error } = await db
      .from('clients')
      .insert(
        lote.map((l) => ({
          tenant_id: tenantId,
          name: l.name,
          phone_e164: l.phoneE164,
          phone_hash: l.phoneE164 ? hashTelefone(l.phoneE164) : null,
          email: l.email,
          tags: l.tags,
          source: 'csv_import',
          last_visit_at: l.lastVisitDate ? l.lastVisitDate.toString() : null,
        })),
      )
      .select('id')

    if (!error) {
      imported += lote.length
      // Sem o mesmo tamanho não dá para casar cadastro com data, e casar errado escreveria o ciclo
      // de uma pessoa no nome de outra. O cadastro fica (já entrou); só a previsão é abandonada.
      if (data && data.length === lote.length) {
        for (const [indice, l] of lote.entries()) {
          const id = data[indice]?.id
          if (id && l.lastVisitDate) comData.push({ clientId: id, ultimaVisita: l.lastVisitDate })
        }
      }
      continue
    }

    // O lote inteiro falhou (corrida rara: outra importação inseriu o mesmo
    // telefone entre a checagem e esta escrita). Refaz linha a linha só deste
    // lote, para isolar qual e não perder as outras 199 do grupo.
    for (const linha of lote) {
      const { data: criado, error: erroLinha } = await db
        .from('clients')
        .insert({
          tenant_id: tenantId,
          name: linha.name,
          phone_e164: linha.phoneE164,
          phone_hash: linha.phoneE164 ? hashTelefone(linha.phoneE164) : null,
          email: linha.email,
          tags: linha.tags,
          source: 'csv_import',
          last_visit_at: linha.lastVisitDate ? linha.lastVisitDate.toString() : null,
        })
        .select('id')
        .maybeSingle()
      if (erroLinha) {
        if (erroLinha.code === '23505') {
          skipped.push({ linha: linha.linha, motivo: 'Já existe uma ficha com esse telefone.' })
        } else {
          errors.push({ linha: linha.linha, motivo: 'Não consegui salvar esta linha.' })
        }
      } else {
        imported++
        if (criado?.id && linha.lastVisitDate) comData.push({ clientId: criado.id, ultimaVisita: linha.lastVisitDate })
      }
    }
  }

  const previsao = await preverEPersistirCiclos(db, tenantId, comData, mapa.serviceId ?? null)

  return { imported, skipped, errors, previsao }
}
