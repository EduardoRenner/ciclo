import { z } from 'zod'

import { avaliarAlertas, type FormularioAnamnese, type PerguntaAnamnese } from '@/core/vault/anamnese'
import { deBytea, paraBytea } from '@/server/crypto/bytea'
import { decryptVault, encryptVault } from '@/server/crypto/vault'
import { AppError } from '@/server/http/errors'
import { withTenant } from '@/server/db/with-tenant'
import { registrarAcessoAoCofre } from '@/server/services/cofre-trilha'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

export const EsquemaSalvarVault = z.object({
  formKey: z.string().trim().min(1),
  answers: z.record(z.string(), z.unknown()),
})
type EntradaSalvarVault = z.infer<typeof EsquemaSalvarVault>

/** TICKET-050. Formulário do pack da vertical do tenant — nasce em `apply_vertical_pack` (0002), lido aqui só. */
export async function formularioDoTenant(db: Cliente, tenantId: string): Promise<FormularioAnamnese> {
  const { data: tenant, error: erroTenant } = await db.from('tenants').select('vertical').eq('id', tenantId).maybeSingle()
  if (erroTenant) throw new AppError('INTERNAL', { cause: erroTenant })
  if (!tenant) throw new AppError('NOT_FOUND')

  const { data: pack, error: erroPack } = await db.from('vertical_packs').select('anamnesis').eq('vertical', tenant.vertical).maybeSingle()
  if (erroPack) throw new AppError('INTERNAL', { cause: erroPack })
  // H8/decisão registrada: `hair`/`tattoo` nascem sem pack — sem formulário, não há anamnese pra essa conta ainda.
  if (!pack) return { key: 'none', version: '0', questions: [] }

  return pack.anamnesis as unknown as FormularioAnamnese
}

/**
 * PUT `.../vault`. Cifra a resposta inteira (não só os campos sensíveis — o
 * texto livre de uma pergunta `type: 'text'` também é dado de saúde) e
 * calcula o alerta em claro a partir do formulário vigente do tenant, não do
 * que a cliente mandou marcar como pergunta — nunca confia em rótulo vindo
 * do corpo da requisição.
 */
export async function salvarRespostas(
  db: Cliente,
  tenantId: string,
  clientId: string,
  entrada: EntradaSalvarVault,
  filledBy: 'professional' | 'client' = 'professional',
): Promise<{ hasAlert: boolean; alertLabel: string | null }> {
  const formulario = await formularioDoTenant(db, tenantId)
  if (formulario.key !== 'none' && entrada.formKey !== formulario.key) {
    throw AppError.validacao({ formKey: 'Este formulário não é mais o vigente para este estabelecimento.' })
  }

  const { hasAlert, alertLabel } = avaliarAlertas(formulario.questions, entrada.answers)

  const registro = await encryptVault(db, tenantId, {
    formKey: entrada.formKey,
    version: formulario.version,
    answers: entrada.answers,
  })

  const { error } = await db.from('health_records').upsert(
    {
      tenant_id: tenantId,
      client_id: clientId,
      form_key: entrada.formKey,
      ciphertext: paraBytea(registro.ciphertext),
      iv: paraBytea(registro.iv),
      auth_tag: paraBytea(registro.tag),
      key_version: registro.keyVersion,
      has_alert: hasAlert,
      alert_label: alertLabel,
      filled_by: filledBy,
    },
    { onConflict: 'tenant_id,client_id,form_key' },
  )
  if (error) throw new AppError('INTERNAL', { cause: error })

  return { hasAlert, alertLabel }
}

export type FichaCofre = {
  formKey: string
  version: string
  answers: Record<string, unknown>
  hasAlert: boolean
  alertLabel: string | null
  filledBy: string
  updatedAt: string
}

/**
 * §2.7 `GET .../vault`: só chamar depois de `exigirAal2()` na rota — este
 * módulo não checa AAL2 sozinho (isso é sessão HTTP, não cofre) — mas toda
 * chamada aqui é, por definição, uma abertura de verdade e sempre grava em
 * `vault_access_log`, sucesso ou não encontrado.
 */
export async function abrirFicha(
  db: Cliente,
  tenantId: string,
  clientId: string,
  quem: { actorId: string | null; ip: string | null; userAgent: string | null },
): Promise<FichaCofre | null> {
  const { data, error } = await db
    .from('health_records')
    .select('ciphertext, iv, auth_tag, has_alert, alert_label, filled_by, updated_at')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })

  await registrarAcessoAoCofre(db, tenantId, clientId, 'read', quem)

  if (!data) return null

  const conteudo = (await decryptVault(db, tenantId, {
    ciphertext: deBytea(data.ciphertext),
    iv: deBytea(data.iv),
    tag: deBytea(data.auth_tag),
  })) as { formKey: string; version: string; answers: Record<string, unknown> }

  return {
    formKey: conteudo.formKey,
    version: conteudo.version,
    answers: conteudo.answers,
    hasAlert: data.has_alert,
    alertLabel: data.alert_label,
    filledBy: data.filled_by,
    updatedAt: data.updated_at,
  }
}

/**
 * Leitura leve para card/ficha ("aparece no topo sem abrir", §9): só o
 * booleano e o rótulo genérico, sem decifrar nada e sem tocar em
 * `vault_access_log` — não é abertura do cofre, é o sinal que existe
 * justamente para não precisar abrir toda vez. É o que a recepção precisa
 * para avisar quem atende.
 *
 * **Devolvia o rótulo junto, e isso era o vazamento da Unidade 10.** O rótulo
 * ("Alergia a látex", "Gestante") é dado de saúde, e a rota `/vault` o protege
 * com TRÊS travas: `exigirPermissao('vault:own')`, `exigirAal2()` e registro
 * em `vault_access_log`. A ficha do cliente servia o MESMO rótulo sem nenhuma
 * das três, para qualquer papel com `client:read` — recepção inclusive. O
 * contrato de `fichaDoCliente` dizia, na linha de cima do campo, "só o SINAL
 * de que existe alerta de saúde, nunca o conteúdo".
 *
 * Quem pode ler o rótulo usa `rotuloDoAlerta`, logo abaixo.
 */
export async function alertaDoCliente(
  db: Cliente,
  tenantId: string,
  clientId: string,
): Promise<{ hasAlert: boolean; temFicha: boolean }> {
  const { data, error } = await db
    .from('health_records')
    .select('has_alert')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  // `temFicha` vem da EXISTÊNCIA da linha. Antes a ficha era deduzida de "tem alerta ou tem
  // rótulo", e o rótulo saiu daqui — sem esta troca, quem tem anamnese preenchida e nenhum
  // alerta desapareceria da tela.
  return { hasAlert: data?.has_alert ?? false, temFicha: data !== null }
}

/**
 * O rótulo do alerta, para quem tem direito ao cofre. **Só chame depois de
 * conferir a permissão** — esta função não a confere, do mesmo jeito que
 * `abrirFicha` não confere e depende da rota.
 *
 * Passa por `withTenant` (service_role) porque a `0077` tirou `alert_label` do
 * `grant select` de `authenticated`: com o cliente do usuário esta consulta
 * agora ERRA em vez de devolver o dado — que é justamente o ponto da segunda
 * camada. O `tenant_id` continua filtrado na mão, como o wrapper exige.
 *
 * Não registra em `vault_access_log` pela mesma razão que `alertaDoCliente`
 * não registra: o rótulo fica em claro no banco por desenho (`0001`, "rótulo
 * curto, sem detalhe clínico") e ler não é decifrar. Abrir o cofre continua
 * sendo o ato deliberado que a trilha existe para guardar.
 */
export async function rotuloDoAlerta(tenantId: string, clientId: string): Promise<string | null> {
  return withTenant(tenantId, async (db, t) => {
    const { data, error } = await db
      .from('health_records')
      .select('alert_label')
      .eq('tenant_id', t)
      .eq('client_id', clientId)
      .maybeSingle()
    if (error) throw new AppError('INTERNAL', { cause: error })
    return data?.alert_label ?? null
  })
}

export type { PerguntaAnamnese }
