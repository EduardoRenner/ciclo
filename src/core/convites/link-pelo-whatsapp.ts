/**
 * O link `wa.me` que a dona toca para mandar o convite da equipe do próprio WhatsApp
 * (docs/112 EXP-K01). O CICLO não manda nada sozinho: abre a conversa com o texto pronto.
 *
 * O texto diz para entrar com ESTE número, porque o aceite confere o número que a pessoa provou
 * com o código no login; entrar por e-mail não vale para convite feito pelo WhatsApp.
 */
export function linkDoConvitePeloWhatsApp(telefoneE164: string, linkDoConvite: string): string {
  const numero = telefoneE164.replace(/\D/g, '')
  const texto = `Oi! Te chamei para a equipe no CICLO. Abre este link e entra com este número de WhatsApp: ${linkDoConvite}`
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}
