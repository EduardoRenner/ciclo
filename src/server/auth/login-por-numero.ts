/**
 * De onde sai o código de acesso pelo WhatsApp (docs/119).
 *
 * - `twilio`: as três chaves do Twilio estão no ambiente. O Supabase Auth gera e confere o código
 *   pelo **Twilio Verify**, canal `whatsapp` (provedor ligado no painel do Supabase com as mesmas
 *   chaves, ver o runbook). O app pede com `channel: 'whatsapp'`.
 * - `teste`: fora de produção e sem as chaves. O pedido vai para o Auth LOCAL, que não tem
 *   credencial de verdade (`[auth.sms.twilio]` de mentira no `config.toml`): nada sai da máquina.
 *   Os números de `[auth.sms.test_otp]` aceitam o código fixo e são os que os testes usam.
 * - `desligado`: produção sem as chaves. A tela não oferece o código, e a rota recusa igual para
 *   qualquer número.
 *
 * Confere variável, não envio real: com as chaves na Vercel e o provedor desligado no painel do
 * Supabase, o envio falha, e a pessoa vê a resposta neutra de sempre (o log do servidor acusa).
 */
export type ModoDoCodigo = 'twilio' | 'teste' | 'desligado'

export const CHAVES_DO_TWILIO = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID'] as const

export function modoDoCodigo(env: Record<string, string | undefined> = process.env): ModoDoCodigo {
  if (CHAVES_DO_TWILIO.every((k) => Boolean(env[k]?.trim()))) return 'twilio'
  return env.NODE_ENV === 'production' ? 'desligado' : 'teste'
}

/** O código pelo WhatsApp só aparece na tela quando consegue sair (docs/112 EXP-J08). */
export function loginPorNumeroDisponivel(env: Record<string, string | undefined> = process.env): boolean {
  return modoDoCodigo(env) !== 'desligado'
}
