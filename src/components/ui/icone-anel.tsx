type Props = React.SVGAttributes<SVGSVGElement>

/**
 * A marca do CICLO usada como ícone — só onde o próprio conceito do Motor de
 * Ciclo precisa de símbolo (`docs/08-REDESIGN-E-IDENTIDADE.md` Parte II §F1).
 * O ícone de brilho que estava aqui antes é banido do produto: é o emblema
 * universal de conteúdo gerado, e simbolizava exatamente a coisa que
 * justifica o produto existir. `currentColor` — herda a cor do texto como
 * todo ícone do app (Parte II §8), nunca cor própria fixa. Aceita as mesmas
 * props de um ícone `lucide-react` (`aria-hidden`, `className`) para caber
 * nos mesmos registros que hoje mapeiam estado/aba → componente de ícone.
 */
export default function IconeAnel(props: Props) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M44.93 15.45 A21 21 0 1 0 44.93 48.55" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
    </svg>
  )
}
