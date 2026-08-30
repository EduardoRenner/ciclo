import { deBytea } from '@/server/crypto/bytea'
import { decryptVault } from '@/server/crypto/vault'
import { withTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { registrarAcessoAoCofre } from '@/server/services/cofre-trilha'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

export type ExportacaoDados = {
  client: Record<string, unknown>
  healthRecord: { formKey: string; answers: Record<string, unknown> } | null
  consents: Record<string, unknown>[]
  appointments: Record<string, unknown>[]
  packages: Record<string, unknown>[]
  media: { id: string; phase: string | null; createdAt: string }[]
}

/**
 * TICKET-054, §2.7 `GET .../data-export`: "direito de acesso/portabilidade".
 * Junta tudo num objeto só — inclusive a resposta decifrada do cofre, porque
 * é DA titular; ela tem direito ao próprio dado de saúde, diferente de
 * `abrirFicha()` (uso interno da profissional). Mesmo assim grava
 * `vault_access_log`, porque decifrar é decifrar, não importa quem pediu.
 */
export async function exportarDadosDoCliente(
  db: Cliente,
  tenantId: string,
  clientId: string,
  quem: { actorId: string | null; ip: string | null; userAgent: string | null },
): Promise<ExportacaoDados> {
  const { data: cliente, error: erroCliente } = await db.from('clients').select('*').eq('tenant_id', tenantId).eq('id', clientId).maybeSingle()
  if (erroCliente) throw new AppError('INTERNAL', { cause: erroCliente })
  if (!cliente) throw new AppError('NOT_FOUND', { message: 'Essa cliente não está mais na sua lista.' })

  const [saude, consentimentos, agendamentos, pacotes, media] = await Promise.all([
    db.from('health_records').select('ciphertext, iv, auth_tag').eq('tenant_id', tenantId).eq('client_id', clientId).maybeSingle(),
    db.from('consents').select('kind, version, granted, granted_at, revoked_at').eq('tenant_id', tenantId).eq('client_id', clientId).order('granted_at', { ascending: false }),
    db.from('appointments').select('starts_at, status, service_id, price_cents').eq('tenant_id', tenantId).eq('client_id', clientId).order('starts_at', { ascending: false }),
    db.from('packages').select('service_id, total_sessions, used_sessions, paid_cents, expires_on').eq('tenant_id', tenantId).eq('client_id', clientId),
    db.from('media').select('id, phase, created_at').eq('tenant_id', tenantId).eq('client_id', clientId).is('deleted_at', null),
  ])
  if (saude.error) throw new AppError('INTERNAL', { cause: saude.error })
  if (consentimentos.error) throw new AppError('INTERNAL', { cause: consentimentos.error })
  if (agendamentos.error) throw new AppError('INTERNAL', { cause: agendamentos.error })
  if (pacotes.error) throw new AppError('INTERNAL', { cause: pacotes.error })
  if (media.error) throw new AppError('INTERNAL', { cause: media.error })

  let healthRecord: ExportacaoDados['healthRecord'] = null
  if (saude.data) {
    const conteudo = (await decryptVault(db, tenantId, {
      ciphertext: deBytea(saude.data.ciphertext),
      iv: deBytea(saude.data.iv),
      tag: deBytea(saude.data.auth_tag),
    })) as { formKey: string; answers: Record<string, unknown> }
    healthRecord = conteudo

    await registrarAcessoAoCofre(db, tenantId, clientId, 'export', quem)
  }

  return {
    client: cliente,
    healthRecord,
    consents: consentimentos.data ?? [],
    appointments: agendamentos.data ?? [],
    packages: pacotes.data ?? [],
    media: (media.data ?? []).map((m) => ({ id: m.id, phase: m.phase, createdAt: m.created_at })),
  }
}

export type ResultadoEliminacao = {
  anonymized: true
  healthRecordsRemoved: number
  mediaRemoved: number
  /** Linhas apagadas por tabela — anotação, fila e afins, que não têm valor fiscal nenhum. */
  rowsRemoved: Record<string, number>
  /** Tabelas em que a LINHA sobreviveu e o conteúdo pessoal virou null. */
  rowsRedacted: Record<string, number>
}

/**
 * O que a eliminação faz com **cada** coluna capaz de carregar dado pessoal, tabela por tabela.
 *
 * Isto não é comentário: `tests/integration/lgpd.test.ts` lê este objeto contra o
 * `information_schema` do banco de verdade e **reprova** quando aparece coluna nova que ninguém
 * declarou aqui. É a única parte desta correção que impede o problema de voltar.
 *
 * Por que existe: a auditoria de 2026-08-23 (achado S15) encontrou CPF, endereço, contato de
 * emergência de um terceiro e alergia sobrevivendo à eliminação. Nenhum deles foi esquecido por
 * descuido — a função nasceu no TICKET-054 e as colunas chegaram depois, nas migrations 0017 e
 * 0019, sem nada no caminho de quem as escreveu que apontasse para cá. Lista sem guarda envelhece.
 *
 * O filtro do teste é por TIPO: text, citext, jsonb, inet e array de texto. Coluna numérica, uuid
 * ou timestamp não cabe um nome nem um endereço, então não precisa de declaração.
 *
 * **Duas tabelas ficam FORA desta lista, e não por esquecimento:** `audit_log` e
 * `idempotency_keys` guardam a linha da cliente dentro de um `jsonb` e não referenciam `clients`,
 * então o detector do teste não as enxerga (achado de 2026-08-28). Elas são tratadas pela RPC
 * `redigir_trilha_do_cliente` (migration 0046), chamada no fim de `eliminarCliente` — e há guarda
 * própria em `tests/unit/server/trilha-nao-guarda-dado-eliminado.test.ts`.
 *
 * Significado de cada valor:
 * - `anonimiza`  — a coluna é o próprio dado pessoal e vira null (ou marcador) na linha da cliente;
 * - `redige`     — a LINHA sobrevive (obrigação fiscal/contábil) e só o conteúdo pessoal vira null;
 * - `apaga_linha`— a linha inteira some: não há registro fiscal ali, é o dado que a lei manda eliminar;
 * - `preserva`   — fica como está, e o motivo vem escrito ao lado. Só isto exige justificativa.
 */
export const TRATAMENTO_NA_ELIMINACAO: Record<string, Record<string, string>> = {
  clients: {
    name: 'anonimiza',
    // Coluna GERADA (`generated always as`, migration 0047): não aceita escrita, e não precisa.
    // Deriva de `name`, que vira 'Cliente eliminada' logo abaixo — no mesmo `update`, o Postgres
    // recalcula esta sozinha. Declarada aqui porque carrega o nome e a guarda de cobertura tem
    // que enxergá-la; NÃO adicionar ao `update` de eliminação, que o banco recusaria a escrita.
    name_busca: 'anonimiza',
    phone_e164: 'anonimiza',
    phone_hash: 'anonimiza',
    email: 'anonimiza',
    notes: 'anonimiza',
    tags: 'anonimiza',
    source: 'anonimiza',
    preferences: 'anonimiza', // carrega "alergia" nas 6 verticais de `lib/preferencias.ts` (S16)
    document: 'anonimiza', // CPF
    gender: 'anonimiza',
    address: 'anonimiza',
    emergency_contact: 'anonimiza', // nome e telefone de um TERCEIRO, que nunca foi cliente
  },
  appointments: {
    client_note: 'redige',
    internal_note: 'redige',
    address: 'redige', // endereço de atendimento em domicílio — é a casa da cliente
    cancel_reason: 'redige', // texto livre; "estava no hospital" é dado de saúde
    risk_features: 'redige',
    canceled_by: 'preserva', // 'client' | 'salon' — quem, não quem em nome próprio
  },
  appointment_series: {
    note: 'redige',
    address: 'redige',
    tipo: 'preserva', // weekly | biweekly | monthly
    status: 'preserva', // active | paused | canceled — estado da série, não da pessoa
  },
  client_notes: {
    body: 'apaga_linha', // anotação datada é exatamente o dado que a lei manda eliminar
  },
  client_reviews: {
    comment: 'redige', // a nota some do texto e o `client_id` vira null; o `rating` sobrevive anônimo
  },
  waitlist: {
    period_of_day: 'apaga_linha', // fila viva: eliminada não pode continuar esperando vaga
  },
  messages: {
    body: 'redige', // o corpo carrega o nome da cliente
    error: 'redige',
    template: 'preserva', // nome do modelo, não conteúdo
    provider_id: 'preserva', // id do provedor, necessário para conciliar entrega
  },
  quotes: {
    message: 'redige', // texto escrito para a cliente
    rejected_reason: 'redige', // texto escrito PELA cliente
    status: 'preserva', // sent | approved | rejected — registro financeiro, sem dado pessoal
  },
  consents: {
    ip: 'redige',
    user_agent: 'redige',
    signature_key: 'redige', // caminho da assinatura de próprio punho no storage
    version: 'preserva', // a prova de que houve consentimento é obrigação de defesa (art. 16, III)
    text_hash: 'preserva', // hash do texto exibido — não reconstrói dado pessoal nenhum
  },
  health_records: {
    form_key: 'apaga_linha',
    alert_label: 'apaga_linha',
    filled_by: 'apaga_linha',
  },
  media: {
    storage_key: 'apaga_linha', // o arquivo sai do bucket junto
    kind: 'apaga_linha',
    phase: 'apaga_linha',
  },
  payments: {
    psp: 'preserva', // registro financeiro: nome do provedor, sem dado pessoal
    psp_charge_id: 'preserva', // id da cobrança no PSP, necessário para conciliação contábil
    psp_payload: 'preserva', // hoje sempre vazio (nenhum PSP integrado); revisar ao ligar o TICKET-031
    pix_qr: 'preserva', // dado do cobrador, não do pagador
    pix_copy_paste: 'preserva', // idem: identifica a cobrança do salão, não quem pagou
  },
  wallet_entries: {
    reason: 'preserva', // "sinal virado crédito", "cortesia" — motivo contábil, não pessoal
  },
  loyalty_entries: {
    reason: 'preserva', // "atendimento concluído", "indicação" — idem
  },
  client_subscriptions: {
    status: 'preserva', // active | canceled — vínculo contratual, obrigação de guarda
  },
}

/** Tabelas cuja linha inteira some: nenhuma delas guarda registro fiscal. */
const TABELAS_APAGADAS = ['client_notes', 'waitlist'] as const

/**
 * `POST .../erase 🔐`, §critério: "apaga cofre e mídia de verdade e preserva o registro fiscal
 * sem vínculo pessoal".
 *
 * Estágio único aqui (o "3 estágios" do backlog — pedido, carência de 30 dias, purga final —
 * vira o job `lgpd_retention` diário, que ainda não existe nesta base; registrado em
 * `docs/DECISOES.md`): o cofre e a mídia somem **de verdade** e **agora**.
 *
 * A regra que decide o que fica: o vínculo **técnico** sobrevive onde há obrigação fiscal
 * (`tickets`, `appointments`, `payments` continuam apontando para o mesmo `client_id`), o
 * vínculo **pessoal** não sobrevive em lugar nenhum. `TRATAMENTO_NA_ELIMINACAO` acima diz,
 * coluna por coluna, de que lado cada uma está — e o teste reprova se alguém acrescentar coluna
 * sem escolher um lado.
 */
export async function eliminarCliente(db: Cliente, tenantId: string, clientId: string): Promise<ResultadoEliminacao> {
  const { data: cliente, error: erroCliente } = await db.from('clients').select('id, anonymized_at').eq('tenant_id', tenantId).eq('id', clientId).maybeSingle()
  if (erroCliente) throw new AppError('INTERNAL', { cause: erroCliente })
  if (!cliente) throw new AppError('NOT_FOUND', { message: 'Essa cliente não está mais na sua lista.' })
  if (cliente.anonymized_at) throw AppError.validacao({ clientId: 'Essa cliente já foi eliminada.' })

  // ── arquivos do storage: mídia da cliente e, se houver, a assinatura de consentimento
  const { data: mediaParaApagar, error: erroListarMedia } = await db
    .from('media')
    .select('id, storage_key')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
  if (erroListarMedia) throw new AppError('INTERNAL', { cause: erroListarMedia })

  const { data: assinaturas, error: erroAssinaturas } = await db
    .from('consents')
    .select('signature_key')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .not('signature_key', 'is', null)
  if (erroAssinaturas) throw new AppError('INTERNAL', { cause: erroAssinaturas })

  const caminhos = [
    ...(mediaParaApagar ?? []).map((m) => m.storage_key),
    ...(assinaturas ?? []).map((c) => c.signature_key).filter((k): k is string => !!k),
  ]

  if (caminhos.length > 0) {
    const { error: erroStorage } = await db.storage.from('media').remove(caminhos)
    // Arquivo já não estar lá não pode travar a eliminação — o objetivo é o dado sumir; se já
    // sumiu, ótimo, segue o fluxo.
    if (erroStorage) console.error(JSON.stringify({ level: 'error', event: 'erase_storage_falhou', tenantId, clientId }), erroStorage)
  }

  // ── linhas que somem inteiras
  const rowsRemoved: Record<string, number> = {}

  const { data: mediaApagada, error: erroMedia } = await db.from('media').delete().eq('tenant_id', tenantId).eq('client_id', clientId).select('id')
  if (erroMedia) throw new AppError('INTERNAL', { cause: erroMedia })
  rowsRemoved.media = mediaApagada?.length ?? 0

  const { data: saudeApagada, error: erroSaude } = await db.from('health_records').delete().eq('tenant_id', tenantId).eq('client_id', clientId).select('id')
  if (erroSaude) throw new AppError('INTERNAL', { cause: erroSaude })
  rowsRemoved.health_records = saudeApagada?.length ?? 0

  for (const tabela of TABELAS_APAGADAS) {
    const { data, error } = await db.from(tabela).delete().eq('tenant_id', tenantId).eq('client_id', clientId).select('id')
    if (error) throw new AppError('INTERNAL', { cause: error })
    rowsRemoved[tabela] = data?.length ?? 0
  }

  // ── linhas que sobrevivem com o conteúdo pessoal redigido
  //
  // Escritas uma a uma, e não num laço sobre `TRATAMENTO_NA_ELIMINACAO`: o cliente tipado do
  // Supabase confere coluna contra o schema gerado, e um laço com nome de coluna dinâmico
  // devolveria esse tipo em troca de menos linhas. O teste-guarda cobre o risco que o laço
  // cobriria (coluna nova sem tratamento) sem abrir mão da checagem de tipo.
  const rowsRedacted: Record<string, number> = {}

  const agendamentos = await db
    .from('appointments')
    .update({ client_note: null, internal_note: null, address: null, cancel_reason: null, risk_features: null })
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .select('id')
  if (agendamentos.error) throw new AppError('INTERNAL', { cause: agendamentos.error })
  rowsRedacted.appointments = agendamentos.data?.length ?? 0

  const series = await db
    .from('appointment_series')
    .update({ note: null, address: null })
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .select('id')
  if (series.error) throw new AppError('INTERNAL', { cause: series.error })
  rowsRedacted.appointment_series = series.data?.length ?? 0

  // A avaliação perde o texto E o vínculo: sem `client_id`, a nota vira estatística anônima do
  // salão, que é o que a média pública sempre foi. Apagar a linha mudaria a média já divulgada.
  const avaliacoes = await db
    .from('client_reviews')
    .update({ comment: null, client_id: null })
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .select('id')
  if (avaliacoes.error) throw new AppError('INTERNAL', { cause: avaliacoes.error })
  rowsRedacted.client_reviews = avaliacoes.data?.length ?? 0

  const mensagens = await db
    .from('messages')
    .update({ body: null, error: null })
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .select('id')
  if (mensagens.error) throw new AppError('INTERNAL', { cause: mensagens.error })
  rowsRedacted.messages = mensagens.data?.length ?? 0

  const orcamentos = await db
    .from('quotes')
    .update({ message: null, rejected_reason: null })
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .select('id')
  if (orcamentos.error) throw new AppError('INTERNAL', { cause: orcamentos.error })
  rowsRedacted.quotes = orcamentos.data?.length ?? 0

  const consentimentos = await db
    .from('consents')
    .update({ ip: null, user_agent: null, signature_key: null })
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .select('id')
  if (consentimentos.error) throw new AppError('INTERNAL', { cause: consentimentos.error })
  rowsRedacted.consents = consentimentos.data?.length ?? 0

  // ── o cadastro em si
  const agora = new Date().toISOString()
  const { error: erroAnon } = await db
    .from('clients')
    .update({
      name: 'Cliente eliminada',
      phone_e164: null,
      phone_hash: null,
      email: null,
      birth_date: null,
      notes: null,
      tags: [],
      source: null,
      preferences: {},
      document: null,
      gender: null,
      address: null,
      emergency_contact: null,
      preferred_professional_id: null,
      anonymized_at: agora,
      deleted_at: agora,
    })
    .eq('tenant_id', tenantId)
    .eq('id', clientId)
  if (erroAnon) throw new AppError('INTERNAL', { cause: erroAnon })

  /*
   * Por último, e só depois de `anonymized_at` estar gravado: a RPC exige que a cliente já esteja
   * eliminada, justamente para não existir caminho que redija a trilha de alguém ativo.
   *
   * `audit_log` e `idempotency_keys` guardam a linha inteira da cliente em `jsonb` — a trilha
   * porque `writeAudit` recebe `after: cliente`, a chave porque o corpo da resposta É a cliente.
   * Nenhuma das duas referencia `clients`, então nem o detector do teste de cobertura nem esta
   * função as alcançavam: o sistema respondia `anonymized: true` com CPF e endereço intactos a uma
   * consulta de distância.
   *
   * Vai pelo `withTenant` e não pelo `db` de quem chamou: as duas tabelas não têm política de
   * UPDATE (trilha que o auditado escreve não é trilha), e conceder uma `security definer` que
   * redige trilha a `authenticated` seria dar a ferramenta a quem quer sumir com o próprio rastro.
   * A RPC só aceita `service_role`. Quem pode eliminar já foi conferido na rota (`client:delete`
   * + AAL2).
   */
  const redigidas = await withTenant(tenantId, async (servico, tenant) => {
    const trilha = await servico.rpc('redigir_trilha_do_cliente', { p_tenant: tenant, p_client: clientId })
    if (trilha.error) throw new AppError('INTERNAL', { cause: trilha.error })
    return (trilha.data ?? {}) as Record<string, number>
  })

  return {
    anonymized: true,
    healthRecordsRemoved: rowsRemoved.health_records ?? 0,
    mediaRemoved: rowsRemoved.media ?? 0,
    rowsRemoved,
    rowsRedacted: { ...rowsRedacted, audit_log: redigidas.audit_log ?? 0, idempotency_keys: redigidas.idempotency_keys ?? 0 },
  }
}
