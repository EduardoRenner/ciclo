import Image from 'next/image'

import wordmark from '../../../public/marca/ciclo-wordmark-aqua.png'
import wordmarkClaro from '../../../public/marca/ciclo-wordmark-aqua-claro.png'

/**
 * Marca do CICLO — o uróboros: anel aberto com cabeça de seta, lê `C` num
 * relance e "recomeça sozinho" no segundo olhar (o Motor de Ciclo trazendo a
 * cliente de volta). Redesenho de 2026-08-26 substitui o anel sem seta da
 * Parte II §5 (`docs/08-REDESIGN-E-IDENTIDADE.md`), que por sua vez já tinha
 * substituído o monograma com gradiente original.
 *
 * A versão em `TelaPublica` (login, cadastro, onboarding, erro) é o LOCKUP
 * completo (símbolo + "Ciclo" escrito), não só o símbolo — é o único
 * momento de marca sozinho na tela, sem navegação nem rótulo ao redor, então
 * ganha destaque cheio. Nos "pontos especiais" (topbar, header da landing,
 * tab bar) o símbolo sozinho (`IconeAnel`) continua pequeno,
 * ao lado do rótulo "CICLO" tipografado no próprio estilo do app.
 *
 * PNG com alpha, não SVG: o traço variável do "C" e o peso do "iclo" vieram
 * prontos do redesenho e a fonte do wordmark (Helvetica Neue Bold) não é a
 * do resto do app — não faz sentido recriar em tipo do sistema. `next/image`
 * porque é asset estático local; sem domínio remoto para configurar.
 *
 * `sizes="160px"`: sem isso, o `next/image` não sabe que o CSS (`h-16 w-auto`)
 * encolhe a imagem pra ~157px de largura (64px de altura × proporção 2,46:1
 * do arquivo fonte, 1102×448) e pedia o balde mais largo do `deviceSizes`
 * (3840px) — medido na aba de rede: `/cadastro`/`/entrar`/`/onboarding`
 * (as três telas que usam este componente) carregavam uma imagem de 3840px
 * de largura pra mostrar 157px. `page.tsx` (landing) já tinha o mesmo
 * conserto (`sizes="70px"` pro símbolo pequeno, h-7) — faltava aqui.
 *
 * Dois arquivos, mesmo mecanismo do `topbar.tsx`: o "iclo" do wordmark padrão é quase branco e
 * some contra fundo claro — medido ao vivo forçando `/entrar` para `[data-theme="light"]`, achado
 * ao preparar `/onboarding` para ficar sempre clara (`onboarding/layout.tsx`). Até então nenhuma
 * tela que usa `Selo` tinha tema claro, então o segundo arquivo (`ciclo-wordmark-aqua-claro.png`,
 * já existia no repo) nunca tinha sido ligado aqui. O CSS (`globals.css`,
 * `.marca-no-escuro`/`.marca-no-claro`) mostra um por vez conforme o `data-theme` do ancestral.
 */
export default function Selo() {
  return (
    <>
      <Image src={wordmark} alt="CICLO" priority sizes="160px" className="marca-no-escuro h-16 w-auto" />
      <Image src={wordmarkClaro} alt="" aria-hidden priority sizes="160px" className="marca-no-claro h-16 w-auto" />
    </>
  )
}
