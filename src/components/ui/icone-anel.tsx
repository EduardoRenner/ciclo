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
 */
export default function IconeAnel(props: Props) {
  return (
    <svg viewBox="28 28 144 144" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M138.6 146 A60 60 0 1 1 146 61.4" stroke="currentColor" strokeWidth="24" strokeLinecap="butt" />
      <polygon points="160.5,41.4 167.9,87.4 123.7,72.2" fill="currentColor" />
    </svg>
  )
}
