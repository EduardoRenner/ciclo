/**
 * O login por número só pode ser a porta de entrada quando o código consegue sair (docs/112 EXP-J08).
 *
 * Em produção, sem a credencial do WhatsApp oficial e sem o segredo do hook do Supabase, o pedido
 * de código sempre falha, e a tela que abre no número deixava a pessoa num "tente de novo" que
 * nunca ia funcionar. Fora de produção o hook escreve o código no log, então fica sempre ligado.
 *
 * Confere variável, não envio real: com tudo preenchido e o hook desligado no painel do Supabase,
 * o pedido ainda falha, e a tela mostra o erro com a saída para o e-mail.
 */
/**
 * docs/114 L-03 (decisão do Vitor, 21/10): entrar e cadastrar é com número + senha. O código pelo
 * WhatsApp sai da tela até a Meta estar ligada; aí volta como segundo caminho (e para o "esqueci a
 * senha"). O código continua no lugar, atrás desta chave.
 */
export const ENTRAR_COM_CODIGO = false

export function loginPorNumeroDisponivel(env: Record<string, string | undefined> = process.env): boolean {
  if (env.NODE_ENV !== 'production') return true
  return Boolean(
    env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_APP_SECRET && env.SEND_SMS_HOOK_SECRET,
  )
}
