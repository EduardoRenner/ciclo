import IconeAnel from '@/components/ui/icone-anel'

/**
 * Marca do CICLO — um anel aberto: lê `C` num relance, lê "ciclo" (a cliente que
 * volta) no segundo olhar. `docs/08-REDESIGN-E-IDENTIDADE.md` Parte II §5
 * substitui o monograma antigo (letra `C` num círculo com gradiente — o
 * placeholder que toda ferramenta de geração produz quando não existe marca).
 *
 * Monocromática sempre, sem gradiente. `size-14` (56px) fica ABAIXO do corte de
 * 64px da Parte II §5.3 — rasterizado antes de virar regra: a variante com
 * ponto (a cliente voltando ao início do anel) só lê limpo a partir de 64px; a
 * 32px o ponto já lê como pontuação (`C.`). Por isso esta é sempre a versão
 * sem ponto.
 */
export default function Selo() {
  return (
    <div
      aria-hidden
      className="flex size-14 items-center justify-center rounded-[var(--radius-pill)] bg-acc text-on-acc shadow-fab"
    >
      <IconeAnel className="size-[30px]" />
    </div>
  )
}
