import { linkWhatsApp } from '@/lib/mensagens'

/**
 * A porta de saída do upgrade, e a razão de ela ser função em vez de prosa espalhada.
 *
 * Enquanto a cobrança automática não existe, **toda** mudança de plano deste produto é uma
 * conversa. Três telas dizem isso ao assinante, com estas palavras:
 *
 *   - `/precos`, na pergunta "Como eu pago hoje?": *"Falando com a gente."*
 *   - `/admin/config/meu-plano`, no Grátis: *"é só falar com a gente"*
 *   - `/admin/config/meu-plano`, no pago: *"é só falar com a gente"*
 *
 * E o produto não oferecia canal nenhum. Nem telefone, nem e-mail, nem link: a palavra "gente"
 * não tinha endereço em lugar algum do repositório. `termos` §10 fecha o círculo dizendo *"fale
 * com a gente pelo mesmo canal em que você contratou"* — só que todo mundo entra sozinho pelo
 * cadastro do Grátis, então esse canal também não existe.
 *
 * O efeito é o pior possível para um produto pré-cobrança: quem decidiu pagar é levado até a
 * porta e a porta não tem maçaneta. Não é uma promessa exagerada como as que `promessa-de-canal`
 * pega — é uma promessa **sem destinatário**, que é a mesma classe de defeito ("coluna lida por
 * todo mundo e escrita por ninguém") aplicada a uma frase em vez de a uma coluna.
 *
 * O desenho segue `core/messaging/promessa.ts`: a copy vira retorno de função e conhece os DOIS
 * estados do mundo. Com canal configurado, a frase convida e a tela desenha um botão. Sem canal,
 * a frase **não convida** — porque convidar para uma conversa que não tem onde acontecer é a
 * mentira que este arquivo existe para impedir. O teste exercita os dois lados.
 *
 * `NEXT_PUBLIC_` porque a decisão precisa ser tomada durante a renderização de páginas estáticas
 * (`/precos` é a mais visitada e não pode virar dinâmica só por causa disto).
 */

export type CanalDeContato = {
  href: string
  /** O que vai escrito no botão. Verbo + objeto, como manda o design system. */
  rotulo: string
}

export type ConfiguracaoDeContato = {
  /** E.164 só com dígitos: `5551999999999`. Vazio ou ausente = canal não configurado. */
  whatsapp?: string | null
  email?: string | null
}

/** O que está configurado nesta instalação. Vazio é o estado normal até alguém preencher. */
export const CONTATO: ConfiguracaoDeContato = {
  whatsapp: process.env.NEXT_PUBLIC_CONTATO_WHATSAPP || null,
  email: process.env.NEXT_PUBLIC_CONTATO_EMAIL || null,
}

/**
 * WhatsApp na frente do e-mail de propósito: o público deste produto responde no WhatsApp e
 * ignora e-mail, e a mensagem já sai escrita — quem toca no botão não precisa saber o que dizer.
 *
 * @param assunto vira o texto pronto da mensagem (ou o `subject` do e-mail).
 */
export function canalDeContato(assunto: string, cfg: ConfiguracaoDeContato = CONTATO): CanalDeContato | null {
  const zap = linkWhatsApp(cfg.whatsapp ?? null, assunto)
  if (zap) return { href: zap, rotulo: 'Falar no WhatsApp' }

  const email = cfg.email?.trim()
  if (email) return { href: `mailto:${email}?subject=${encodeURIComponent(assunto)}`, rotulo: 'Mandar um e-mail' }

  return null
}

/** O texto pronto que sai no WhatsApp de quem quer subir de plano. */
export function assuntoDeMudarDePlano(planoAtual: string): string {
  return `Oi! Uso o CICLO no plano ${planoAtual} e quero falar sobre mudar de plano.`
}

/**
 * A frase de "como se muda de plano" na tela Meu plano, nos dois estados do mundo.
 *
 * Sem canal, a frase evita a construção "fale com a gente" MESMO negando, pela mesma razão
 * registrada em `textoDoEnvioAutomatico`: a guarda proíbe o conceito e não lê negação. E não pode
 * virar silêncio — quem abre "Meu plano" num produto que não cobra tem uma pergunta específica
 * ("isso vira cobrança sozinho?") e ela precisa de resposta nos dois casos.
 */
export function textoDeMudarDePlano(noGratis: boolean, temCanal: boolean): string {
  if (noGratis) {
    return temCanal
      ? 'O Grátis não expira e não vira cobrança sem você pedir. A cobrança automática ainda não está no ar, então subir de plano é uma conversa rápida: a gente ajusta na hora e você já usa.'
      : 'O Grátis não expira e não vira cobrança sem você pedir. A cobrança automática ainda não está no ar, então nenhum plano muda sozinho.'
  }
  return temCanal
    ? 'A cobrança automática ainda não está no ar, então nada é debitado sozinho. Para mudar ou encerrar o plano, é só chamar: a gente resolve na conversa.'
    : 'A cobrança automática ainda não está no ar, então nada é debitado sozinho e nenhum plano muda sozinho.'
}
