type Props = React.SVGAttributes<SVGSVGElement>

/**
 * A marca do CICLO usada como ícone — só onde o próprio conceito do Motor de
 * Ciclo precisa de símbolo (`docs/08-REDESIGN-E-IDENTIDADE.md` Parte II §F1).
 * O ícone de brilho que estava aqui antes é banido do produto: é o emblema
 * universal de conteúdo gerado, e simbolizava exatamente a coisa que
 * justifica o produto existir.
 *
 * Redesenho de 2026-08-26 (uróboros): o anel aberto ganhou cabeça de seta —
 * lê "C" e "recomeça sozinho" no mesmo traço, em vez de só "C" cortado.
 * Continua `currentColor` aqui de propósito, mesmo a marca estática (`Selo`,
 * favicon, ícones do PWA) tendo ganho cor própria fixa (turquesa/menta) nesse
 * redesenho: este componente é usado como ÍCONE DE NAVEGAÇÃO com estado
 * (`tab-bar.tsx`, aba "Recuperar" ativa/inativa; `topbar.tsx`, badge sobre
 * `bg-acc`) — travar cor própria aqui apagaria o realce de "aba ativa" que
 * as outras três abas têm, uma regressão de uso disfarçada de atualização de
 * marca. Cor fixa mora só onde o símbolo é logo estático, nunca aqui.
 *
 * **Conserto de 2026-09-18: o traçado de 26/08 nasceu girado ~14° a mais que
 * o design de referência** (`Redesign de logo uróboros c.pdf`, achado do
 * Eduardo — "tá meio torta pra baixo"). Medido comparando os 5 pontos que
 * definem a forma (início/fim do arco, as três pontas da seta) contra o PDF:
 * as cinco diferenças de ângulo bateram entre 13,95° e 14,99° (média 14,22°),
 * com a MESMA proporção de raio em cada ponta da seta (1,403/1,150/0,608 nos
 * dois) — ou seja, não é a forma que está errada, é só a rotação. Os números
 * abaixo são o traçado original girado −14,22° em torno do centro (100,100),
 * extraído por ajuste de círculo sobre as coordenadas vetoriais do PDF
 * (`pymupdf`, não estimado a olho) — não adivinhar de novo se precisar
 * reajustar.
 */
export default function IconeAnel(props: Props) {
  return (
    <svg viewBox="28 28 144 144" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M148.5 135.3 A60 60 0 1 1 134.4 50.9" stroke="currentColor" strokeWidth="24" strokeLinecap="butt" />
      <polygon points="144.5,28.5 162.8,71.4 116.2,67.3" fill="currentColor" />
    </svg>
  )
}
