import Image from 'next/image'

import wordmark from '../../../public/marca/ciclo-wordmark-aqua.png'

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
 */
export default function Selo() {
  return <Image src={wordmark} alt="CICLO" priority className="h-16 w-auto" />
}
