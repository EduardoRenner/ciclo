/** Monograma do CICLO — mesmo gradiente de acento usado nos botões primários, sem depender de imagem externa (CSP `img-src` fica intocado). */
export default function Selo() {
  return (
    <div
      aria-hidden
      className="flex size-14 items-center justify-center rounded-[var(--radius-pill)] bg-[image:var(--grad-acc)] text-titulo font-extrabold text-on-acc shadow-fab"
    >
      C
    </div>
  )
}
