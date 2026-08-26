type Props = React.SVGAttributes<SVGSVGElement>

/** Cor fixa "aqua" do redesenho de 2026-08-26 — a mesma em todo fundo. */
const AQUA = '#14B8A6'

/**
 * O uróboros como MARCA ESTÁTICA — cor própria fixa, nunca `currentColor`.
 * Irmã de `IconeAnel` (mesma geometria, `docs/24` redesenho de 2026-08-26),
 * mas para o caso oposto: aqui o símbolo não tem estado (ativo/inativo) para
 * herdar, é a identidade sozinha — cabeçalho da landing, topbar, `Selo`.
 *
 * `IconeAnel` continua sendo o certo em `tab-bar.tsx`: lá o símbolo PRECISA
 * herdar `text-acc-2`/`text-txt-3` do link ao redor para a aba "Recuperar"
 * acender igual às outras três quando ativa.
 *
 * Cor única (aqua `#14B8A6`) em todo fundo — o redesenho não distingue mais
 * "sobre claro"/"sobre escuro" no anel, só o TEXTO do wordmark completo
 * (`Selo`, hero) varia entre branco e preto conforme o fundo.
 */
export default function MarcaCiclo(props: Props) {
  return (
    <svg viewBox="28 28 144 144" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      <path d="M138.6 146 A60 60 0 1 1 146 61.4" stroke={AQUA} strokeWidth="24" strokeLinecap="butt" />
      <polygon points="160.5,41.4 167.9,87.4 123.7,72.2" fill={AQUA} />
    </svg>
  )
}
