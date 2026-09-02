/**
 * O login foi recusado. A recusa é sobre a CREDENCIAL de quem tentou, ou sobre outra coisa?
 *
 * Nem toda recusa do Auth é senha errada, e dizer que é tranca a pessoa num laço: ela retipa,
 * troca a senha, retipa de novo, e o motivo real nunca aparece.
 *
 * Aconteceu neste projeto em 02/09/2026. O Auth respondia `captcha_failed` — proteção ligada no
 * painel do Supabase sem o app mandar token, porque configuração de projeto não vem em migration
 * — e a tela dizia "E-mail ou senha não conferem" para TODO MUNDO. Uma falha de configuração que
 * tranca a base inteira, vestida de erro individual de quem está tentando entrar.
 *
 * ## A lista é dos códigos que ganham a MENSAGEM NOVA, e o default é a antiga
 *
 * Esta é a direção segura, e a razão não é estilo: a mensagem antiga ("e-mail ou senha não
 * conferem") é a que **não vaza nada**, porque é idêntica para conta que existe e conta que não
 * existe. Se o default fosse a mensagem nova, bastaria o GoTrue inventar um código específico de
 * conta — um `user_not_found` da vida — para o login começar a entregar a lista de quem tem
 * cadastro, sozinho, sem ninguém decidir isso.
 *
 * Então só entra aqui código que alguém olhou e concluiu: **acontece igual para quem existe e
 * para quem não existe**. É a mesma regra da lista de permitidos que já valeu para o schema de
 * ferramenta: o desconhecido cai no comportamento conservador, nunca no novo.
 *
 * ## O que ficou de fora, e o preço
 *
 * `email_not_confirmed` não é senha errada — e mesmo assim NÃO entra. Revelá-lo diria que a conta
 * existe, e o `/api/v1/auth/signup` desta base responde igual para e-mail novo e e-mail já
 * cadastrado justamente para não dizer isso. Contar aqui desfaria aquela decisão por uma porta
 * lateral.
 *
 * O preço é real e está sendo pago de propósito: quem não confirmou o e-mail vê "senha não
 * confere". Se um dia a base aceitar revelar existência de conta, este é o lugar de mudar — e a
 * mudança tem que ser uma decisão, não um efeito colateral.
 */
const CODIGOS_QUE_NAO_SAO_DA_PESSOA: ReadonlySet<string> = new Set([
  // Proteção de captcha ligada no projeto sem o app mandar token. Tranca todo mundo igual.
  'captcha_failed',
  // Provedor de e-mail/SMS do projeto recusou ou está sem cota. Não tem a ver com quem tenta.
  'over_email_send_rate_limit',
  'over_sms_send_rate_limit',
  // O projeto está com login por senha desligado no painel.
  'email_provider_disabled',
  'signup_disabled',
])

export type MotivoDaRecusa = 'credencial' | 'outro'

/**
 * `codigo` é o `error.code` do supabase-js. Ausente, vazio ou desconhecido cai em `credencial` —
 * o comportamento antigo, que nunca vaza nada.
 */
export function motivoDaRecusa(codigo: string | null | undefined): MotivoDaRecusa {
  if (!codigo) return 'credencial'
  return CODIGOS_QUE_NAO_SAO_DA_PESSOA.has(codigo) ? 'outro' : 'credencial'
}
