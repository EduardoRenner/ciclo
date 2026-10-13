/*
  Controles comuns dos protótipos: aparelho, tema, estado e régua da dobra.
  Cada página define window.PROTO = { titulo, estados: [[valor, rótulo], ...], padrao, comAcao: [estados com barra de ação] }.
  Elementos com data-estado="a b" só aparecem nesses estados. data-so="celular|computador" filtra por aparelho.
  Sem dependência externa.
*/
(function () {
  const cfg = window.PROTO || { titulo: 'Protótipo', estados: [['normal', 'Normal']], padrao: 'normal' }
  const aparelho = document.querySelector('.aparelho')
  const lerHash = () => Object.fromEntries(new URLSearchParams(location.hash.slice(1)))
  const estado = Object.assign({ aparelho: 'celular', largura: '390', tema: 'claro', estado: cfg.padrao, regua: '0' }, lerHash())

  const barra = document.createElement('div')
  barra.className = 'controles'
  barra.innerHTML = `
    <h1>${cfg.titulo}</h1>
    <fieldset><legend>Aparelho</legend>
      <button type="button" data-ap="celular" data-larg="390">Celular 390</button>
      <button type="button" data-ap="celular" data-larg="360">Celular 360</button>
      <button type="button" data-ap="computador" data-larg="1280">Computador 1280</button>
    </fieldset>
    <fieldset><legend>Tema</legend>
      <button type="button" data-tema="claro">Claro</button>
      <button type="button" data-tema="escuro">Escuro</button>
    </fieldset>
    <label>Estado <select id="sel-estado">${cfg.estados.map(([v, r]) => `<option value="${v}">${r}</option>`).join('')}</select></label>
    <button type="button" id="btn-regua" title="Linha em y=420: o que precisa estar acima dela no celular">Régua da dobra</button>
    <a href="index.html">Todos os protótipos</a>`
  document.body.prepend(barra)

  function aplicar() {
    aparelho.dataset.aparelho = estado.aparelho
    aparelho.dataset.largura = estado.largura
    aparelho.dataset.tema = estado.tema
    aparelho.dataset.estadoAtual = estado.estado
    aparelho.classList.toggle('mostrar-regua', estado.regua === '1' && estado.aparelho === 'celular')
    aparelho.classList.toggle('tem-acao', (cfg.comAcao || []).includes(estado.estado) || (cfg.comAcao || []).includes('*'))
    document.querySelectorAll('[data-estado]').forEach((el) => {
      el.hidden = !el.dataset.estado.split(/\s+/).includes(estado.estado)
    })
    barra.querySelectorAll('[data-ap]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ap === estado.aparelho && b.dataset.larg === estado.largura)))
    barra.querySelectorAll('[data-tema]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tema === estado.tema)))
    barra.querySelector('#btn-regua').setAttribute('aria-pressed', String(estado.regua === '1'))
    barra.querySelector('#sel-estado').value = estado.estado
    history.replaceState(null, '', '#' + new URLSearchParams(estado).toString())
    document.dispatchEvent(new CustomEvent('proto:mudou', { detail: { ...estado } }))
  }

  barra.addEventListener('click', (e) => {
    const b = e.target.closest('button')
    if (!b) return
    if (b.dataset.ap) { estado.aparelho = b.dataset.ap; estado.largura = b.dataset.larg }
    if (b.dataset.tema) estado.tema = b.dataset.tema
    if (b.id === 'btn-regua') estado.regua = estado.regua === '1' ? '0' : '1'
    aplicar()
  })
  barra.querySelector('#sel-estado').addEventListener('change', (e) => { estado.estado = e.target.value; aplicar() })
  window.protoIrPara = (novo) => { estado.estado = novo; aplicar() }

  // Botões de chip simples: aria-pressed exclusivo dentro do mesmo grupo [data-grupo]
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip[data-grupo]')
    if (!chip) return
    document.querySelectorAll(`.chip[data-grupo="${chip.dataset.grupo}"]`).forEach((c) => c.setAttribute('aria-pressed', String(c === chip)))
  })

  const regua = document.createElement('div')
  regua.className = 'regua'
  regua.innerHTML = '<span>y = 420 (metade de cima do celular)</span>'
  aparelho.appendChild(regua)
  aplicar()
})()
