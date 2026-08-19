/** Monograma do CICLO — mesmo gradiente de acento usado nos botões primários, sem depender de imagem externa (CSP `img-src` fica intocado). */
export default function Selo() {
  return (
    <div
      aria-hidden
      className="flex size-14 items-center justify-center rounded-[var(--radius-pill)] bg-[linear-gradient(135deg,var(--acc),var(--acc-2))] text-titulo font-extrabold text-[#0a0a0f]"
    >
      C
    </div>
  )
}
