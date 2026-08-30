import { withTenant } from '@/server/db/with-tenant'

import type { Papel } from '@/server/auth/rbac'

export type EntradaAuditoria = {
  tenantId: string
  actorId: string | null
  actorRole: Papel | null
  /** Verbo estável, no formato `recurso.acao` — `client.export`, `commission.update`. */
  action: string
  entity?: string
  entityId?: string
  before?: unknown
  after?: unknown
  requestId: string
}

/**
 * Campos que não podem entrar na trilha nem por engano. A regra 9 do CLAUDE.md
 * proíbe dado de saúde em log, e `before`/`after` de uma ficha do cofre traria
 * exatamente isso; o resto são segredos que ninguém precisa reler depois.
 */
const REDIGIR = new Set([
  'ciphertext',
  'iv',
  'auth_tag',
  'answers',
  'dek_wrapped',
  'password',
  'senha',
  'token',
  'access_token',
  'refresh_token',
  'signature_base64',
  /*
   * Auditoria de 2026-08-28. `POST /api/v1/clients` grava a linha inteira da cliente em
   * `after` — e `clients.preferences` tem um campo `alergia` em SEIS das sete verticais de
   * `src/lib/preferencias.ts` ("acetona, resina", "amônia, PPD", "cola, cianoacrilato"). Alergia
   * é dado de saúde, e a regra 9 do CLAUDE.md não abre exceção para trilha: *"dado de saúde nunca
   * em log, Sentry ou analytics. Redija antes."* O cofre era protegido pelo `answers` acima; o
   * caminho de fora do cofre não era.
   */
  'preferences',
  'alert_label',
])

/**
 * Troca o valor dos campos sensíveis por um marcador, em qualquer profundidade.
 *
 * Exportada só para o teste: a regra 9 é absoluta e uma guarda que confere a LISTA em vez do
 * COMPORTAMENTO passaria com o `redigir` quebrado por dentro.
 */
export function redigirParaTrilha(valor: unknown, profundidade = 0): unknown {
  if (profundidade > 6 || valor === null || typeof valor !== 'object') return valor
  if (Array.isArray(valor)) return valor.map((v) => redigirParaTrilha(v, profundidade + 1))

  const saida: Record<string, unknown> = {}
  for (const [chave, v] of Object.entries(valor)) {
    saida[chave] = REDIGIR.has(chave.toLowerCase()) ? '[redigido]' : redigirParaTrilha(v, profundidade + 1)
  }
  return saida
}

/** Primeiro IP do `X-Forwarded-For` — o da pessoa; os seguintes são proxies. */
export function ipDe(req: Request): string | null {
  const encaminhado = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return encaminhado || req.headers.get('x-real-ip') || null
}

/**
 * Grava a linha da trilha.
 *
 * Vai pela `service_role` dentro do `withTenant()`, e não pelo cliente do
 * usuário, porque `audit_log` não tem política de insert de propósito: trilha
 * que o próprio auditado consegue escrever não é trilha. Há teste de RLS
 * cobrindo isso.
 */
export async function writeAudit(entrada: EntradaAuditoria, req: Request): Promise<void> {
  try {
    /*
     * `.insert()` do supabase-js NÃO lança em erro de banco — devolve `{ error }`. Sem olhar esse
     * retorno, o `catch` abaixo só pegava exceção de rede, e qualquer recusa do Postgres (tipo
     * errado numa coluna, violação de RLS, constraint) sumia sem deixar nem o alarme no log que o
     * comentário acima promete. Trilha de acesso que falha em silêncio é pior que trilha ausente:
     * ninguém sabe que não tem.
     */
    const { error } = await withTenant(entrada.tenantId, async (db, tenantId) =>
      db.from('audit_log').insert({
        tenant_id: tenantId,
        actor_id: entrada.actorId,
        actor_role: entrada.actorRole,
        action: entrada.action,
        entity: entrada.entity ?? null,
        entity_id: entrada.entityId ?? null,
        before: (redigirParaTrilha(entrada.before) ?? null) as never,
        after: (redigirParaTrilha(entrada.after) ?? null) as never,
        ip: ipDe(req),
        user_agent: req.headers.get('user-agent')?.slice(0, 400) ?? null,
        request_id: entrada.requestId,
      }),
    )
    if (error) throw error
  } catch (erro) {
    // Falhar a auditoria não pode desfazer a operação que a pessoa já concluiu:
    // ela veria um erro depois de o agendamento existir. O buraco na trilha vira
    // alarme no log, que é onde alguém consegue reagir.
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'audit_falhou',
        action: entrada.action,
        request_id: entrada.requestId,
        tenant_id: entrada.tenantId,
      }),
      erro,
    )
  }
}
