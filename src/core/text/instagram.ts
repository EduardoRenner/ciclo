/**
 * Reduz o que o dono digitou no campo "Instagram" ao apelido canônico (`barbeariadomrocha`), e
 * monta o endereço a partir dele.
 *
 * Existe porque o campo é texto livre e o formulário só tirava o `@` inicial. Medido em
 * 2026-08-31, três dos cinco jeitos naturais de preencher produziam link quebrado na página
 * pública, que monta `https://instagram.com/${instagram}` direto:
 *
 *   digitou `https://instagram.com/nome`  → `https://instagram.com/https://instagram.com/nome`
 *   digitou `instagram.com/nome`          → `https://instagram.com/instagram.com/nome`
 *   digitou `www.instagram.com/nome/`     → `https://instagram.com/www.instagram.com/nome/`
 *
 * E colar o endereço do próprio perfil é o gesto mais provável: quem tem o Instagram aberto copia
 * da barra do navegador, não digita o apelido de cabeça.
 *
 * O mesmo valor alimenta o `sameAs` do JSON-LD, que pelo schema.org é uma URL — o apelido cru
 * (`"barbeariadomrocha"`) é marcação inválida ali. É a mesma armadilha que o `aggregateRating`
 * daquele arquivo já evita de propósito: marcação inválida pode desqualificar o resultado rico da
 * página inteira, ou seja, custa mais do que o campo ausente.
 *
 * Em `core/` (puro, sem I/O — regra 5 do `CLAUDE.md`) porque tem DOIS leitores que precisam
 * concordar: o link da página pública e o `sameAs`. Se divergirem, volta a existir um caminho que
 * mostra o que o outro esconde — mesmo motivo de `semAcento` e de `SLUGS_DE_DEMONSTRACAO`.
 */

/** Apelido válido no Instagram: letra, número, ponto e sublinhado, até 30 caracteres. */
const APELIDO_VALIDO = /^[a-zA-Z0-9._]{1,30}$/

/**
 * `null` quando não sobra apelido reconhecível. Devolver `null` em vez do texto original é
 * deliberado: guardar lixo faria a página pública oferecer um link que leva a lugar nenhum, e um
 * contato que não existe é pior que contato ausente — a mesma régua do endereço no JSON-LD.
 */
export function apelidoDoInstagram(bruto: string | null | undefined): string | null {
  if (!bruto) return null

  let s = bruto.trim()
  if (!s) return null

  s = s.replace(/^https?:\/\//i, '')
  s = s.replace(/^www\./i, '')
  s = s.replace(/^instagram\.com\//i, '')
  // Query e âncora entram junto quando a pessoa copia da barra do navegador
  // (`.../nome?igsh=...` é o formato que o app do celular produz ao compartilhar).
  s = s.replace(/[?#].*$/, '')
  s = s.replace(/\/+$/, '')
  s = s.replace(/^@/, '')

  return APELIDO_VALIDO.test(s) ? s : null
}

/** O endereço do perfil, montado num lugar só — nunca concatenado na tela. */
export function urlDoInstagram(bruto: string | null | undefined): string | null {
  const apelido = apelidoDoInstagram(bruto)
  return apelido ? `https://instagram.com/${apelido}` : null
}
