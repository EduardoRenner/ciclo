/**
 * O convite que um profissional manda para outro — o laço B2B do `docs/30-INDICACAO-PLANO.md` §3.
 *
 * `docs/30` separa dois laços que o pedido "sistema de indicação" mistura:
 *
 *   - **B2C**, a cliente do salão indica outra cliente. Existe de ponta a ponta (I-1 a I-9): link
 *     assinado, escritor de `referred_by`, convite no pico da avaliação, barra de upgrade.
 *   - **B2B**, o dono do salão indica outro dono. **Não existia nada.**
 *
 * O B2B está travado atrás de "≥ 20 pagantes" no `docs/18` Fase H, e a trava está certa para a
 * parte que ela protege: `billing_credits`, proração e antifraude por CPF/instrumento de pagamento
 * são trabalho de verdade defendendo receita que ainda não existe. Programa de indicação com zero
 * pagantes é máquina sem combustível.
 *
 * **Mas a trava é da RECOMPENSA, não do CONVITE.** O que ela nunca justificou é o produto não ter
 * onde o profissional compartilhe o CICLO com um colega de ofício. Numa categoria de autônomo, a
 * recomendação de quem faz o mesmo trabalho vale ordens de grandeza mais que qualquer anúncio, e
 * isso não custa uma linha de cobrança: é um texto pronto e um `wa.me`, o mesmo mecanismo que já
 * move todas as mensagens do produto.
 *
 * ## A recompensa é um interruptor, e ele está DESLIGADO
 *
 * O `docs/18` §13.1 já decidiu o prêmio: **um mês para quem indica e um para quem entra**. O que
 * não existe é como conceder — não há `billing_credits`, não há cobrança automática, não há nada
 * que transforme a promessa em desconto. Então a copy não a menciona.
 *
 * `temRecompensa` existe pelo mesmo motivo do parâmetro de `textoDoCanalDeConfirmacao`: a frase
 * verdadeira já está escrita e volta inteira no dia em que houver como pagar, sem ninguém caçar
 * string. Enquanto for `false`, o convite é um convite e não promete nada — que é a regra da casa
 * ("só afirma o que o código faz HOJE") aplicada à promessa mais cara que existe, a de dinheiro.
 */

export type EntradaDeConvite = {
  /** Como o negócio se chama, para o convite sair na voz dele e não na da marca (§H.4). */
  nomeDoNegocio: string
  /** A URL do produto. Vem de `APP_URL`, nunca escrita à mão. */
  url: string
  /**
   * Existe forma de conceder o prêmio ao indicador e ao indicado. Falso hoje, e vai continuar
   * falso enquanto `billing_credits` (docs/18 §H.2) não existir.
   */
  temRecompensa?: boolean
}

/**
 * O texto que sai no WhatsApp. Primeira pessoa, com o nome do negócio dele: quem recebe precisa
 * ler um colega falando, não uma peça de marketing repassada.
 *
 * Sem "programa", sem "código", sem "ganhe" — as três palavras que o `docs/30` §4.3 proíbe no
 * convite B2C valem igual aqui, e pelo mesmo motivo: transformar a indicação numa troca comercial
 * é o que faz a pessoa não indicar.
 */
export function textoDoConviteDoCiclo({ nomeDoNegocio, url, temRecompensa = false }: EntradaDeConvite): string {
  const abertura = nomeDoNegocio.trim()
    ? `Oi! Eu uso o CICLO pra tocar a agenda e os clientes aqui do ${nomeDoNegocio.trim()}.`
    : 'Oi! Eu uso o CICLO pra tocar a agenda e os clientes aqui.'

  const produto =
    'Ele me avisa quem parou de voltar, que era o que eu mais deixava passar, e o cliente marca sozinho por um link.'

  const fecho = temRecompensa
    ? `Se você entrar por mim, nós dois ganhamos um mês: ${url}`
    : `Dá pra usar de graça pra começar: ${url}`

  return `${abertura} ${produto} ${fecho}`
}

/**
 * A frase que a tela usa para explicar o cartão. Também nos dois estados: hoje ela diz o que o
 * convite é (uma indicação de colega), e não inventa vantagem que ninguém tem como entregar.
 */
export function textoDeParaQueIndicar(temRecompensa = false): string {
  return temRecompensa
    ? 'Quando um colega entra pelo seu convite, vocês dois ganham um mês. É assim que o CICLO cresce sem anúncio.'
    : 'Quem trabalha por conta escuta colega de ofício, não anúncio. Se o CICLO está te servindo, esse é o jeito mais direto de outra pessoa descobrir.'
}
