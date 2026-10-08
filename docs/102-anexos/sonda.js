// docs/102 · sonda de toque e de rolagem lateral, para colar no console (ou no javascript do navegador de
// verificação) numa tela já carregada. Uso: `sonda(true)` mede toque e overflow; `sonda(false)` só overflow.
//
// Lições embutidas (medidas em 2026-10-08):
//  - o selo do `next dev` (`nextjs-portal`) cobre botões no canto: escondido antes de medir;
//  - espere ~3 s depois de navegar: tela com streaming medida cedo tem menos alvos (7 em vez de 19);
//  - o segundo <h1> de toda tela é a cópia escondida do streaming: só conta o que é visível e fora de [hidden];
//  - o `label` é o alvo do campo que está dentro dele;
//  - sem `requestAnimationFrame` (não roda com o painel do navegador escondido);
//  - `scrollWidth` da página é a régua de overflow; a lista de elementos é só pista.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- é colada no console, não importada
function sonda(sondar) {
  document.querySelectorAll('nextjs-portal').forEach((p) => (p.style.display = 'none'))
  const W = innerWidth
  const dentroDeRolagem = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX
      if (o === 'auto' || o === 'scroll') return true
    }
    return false
  }
  const main = document.querySelector('main') || document.body
  const passando = [...main.querySelectorAll('*')]
    .filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.right > W + 1 && !dentroDeRolagem(el)
    })
    .slice(0, 4)
    .map((el) => `${el.tagName}.${String(el.className).slice(0, 40)} → ${Math.round(el.getBoundingClientRect().right)}`)
  const out = {
    url: location.pathname + location.search,
    largura: W,
    scroll: document.documentElement.scrollWidth,
    passando,
    titulo: document.title,
    h1: [...document.querySelectorAll('h1')].filter((h) => h.getClientRects().length && !h.closest('[hidden]')).length,
  }
  if (sondar) {
    const sel = 'a[href], button, summary, input:not([type=hidden]), select, textarea, [role=button]'
    const todos = [...document.querySelectorAll(sel)].filter((el) => el.getClientRects().length && !el.closest('[hidden]') && getComputedStyle(el).visibility !== 'hidden')
    out.travados = todos.filter((el) => el.disabled).length
    const alvos = todos.filter((el) => !el.disabled).slice(0, 160)
    const pequenos = []
    for (const el of alvos) {
      el.scrollIntoView({ block: 'center', inline: 'center' })
      const alvo = (el.tagName === 'INPUT' && el.closest('label')) || el
      const acerta = (x, y) => {
        const h = document.elementFromPoint(x, y)
        return h && (h === alvo || alvo.contains(h))
      }
      // Link que quebra linha tem um retângulo por linha; o centro da caixa que une os dois pode cair
      // ENTRE eles e medir 0 × 0 (falso positivo de 2026-10-08 em /ja-atendo). Mede cada linha e fica com a melhor.
      let alt = 0
      let larg = 0
      let r = el.getBoundingClientRect()
      for (const f of el.getClientRects()) {
        const fx = f.left + f.width / 2
        const fy = f.top + f.height / 2
        let a = 0
        for (let y = Math.floor(f.top - 30); y <= f.bottom + 30; y++) if (y >= 0 && y < innerHeight && acerta(fx, y)) a++
        let l = 0
        for (let x = Math.floor(f.left - 30); x <= f.right + 30; x++) if (x >= 0 && x < W && acerta(x, fy)) l++
        if (a * l > alt * larg) [alt, larg, r] = [a, l, f]
      }
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      if (alt < 48 || larg < 44) {
        const cobre = document.elementFromPoint(cx, cy)
        pequenos.push({
          t: (el.getAttribute('aria-label') || el.textContent || el.name || el.tagName).trim().slice(0, 30),
          alt,
          larg,
          h: Math.round(r.height),
          w: Math.round(r.width),
          cobre: cobre && !(cobre === alvo || alvo.contains(cobre)) ? `${cobre.tagName}.${String(cobre.className).slice(0, 25)}` : null,
        })
      }
    }
    out.alvos = alvos.length
    out.pequenos = pequenos
  }
  window.scrollTo(0, 0)
  return out
}
