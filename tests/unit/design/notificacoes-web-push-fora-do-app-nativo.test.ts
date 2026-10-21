import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/98-aprimoramento/11 LOJA-24. As notificações do painel são Web Push. Dentro do app nativo isso não
 * existe: a tela embutida do iOS e a do Android não têm `PushManager`. O que a pessoa via:
 *  - no iPhone, "Adicione o CICLO à tela de início", com passo a passo do Safari, DENTRO do app da loja
 *    (a Apple lê isso como app que manda usar o site, regras 4.2 e 2.1);
 *  - no Android, "Seu navegador não aceita notificações push", num app sem navegador à vista.
 *
 * O conserto tem três camadas, e esta guarda confere as três pelo que muda quando o defeito volta:
 * o item do menu, a página aberta direto por link e o componente que decide no cliente.
 */
const MENU = semComentarios(readFileSync('src/app/admin/config/page.tsx', 'utf8'))
const PAGINA = semComentarios(readFileSync('src/app/admin/config/notificacoes/page.tsx', 'utf8'))
const ATIVAR = semComentarios(readFileSync('src/app/admin/config/notificacoes/ativar.tsx', 'utf8'))

describe('Web Push não aparece dentro do app nativo', () => {
  it('o item "Notificações" do menu é marcado como só do navegador', () => {
    const item = /\{[^{}]*href: '\/admin\/config\/notificacoes'[^{}]*\}/.exec(MENU)?.[0]
    expect(item, 'não achei o item do menu: a guarda perdeu o alvo').toBeDefined()
    expect(item).toMatch(/soNoNavegador: true/)
  })

  it('o menu esconde o que é só do navegador quando a requisição vem do app', () => {
    expect(MENU).toMatch(/const nativo = ehRequisicaoDoAppNativo\(/)
    expect(MENU).toMatch(/!\(nativo && 'soNoNavegador' in i\)/)
  })

  it('a página aberta direto no app não renderiza o Web Push', () => {
    expect(PAGINA).toMatch(/const nativo = ehRequisicaoDoAppNativo\(/)
    expect(PAGINA).toMatch(/\{nativo \? \(/)
    expect(PAGINA, 'o cabeçalho ainda fala de Web Push para todo mundo').not.toMatch(/descricao="Web Push/)
  })

  it('o componente reconhece o app antes de mandar ao Safari', () => {
    const nativo = ATIVAR.indexOf("if (Capacitor.isNativePlatform()) return setEstado('app_nativo')")
    const ios = ATIVAR.indexOf("if (detectarIosNaoInstalado()) return setEstado('ios_nao_instalado')")
    expect(nativo, 'sumiu a checagem de app nativo').toBeGreaterThan(-1)
    expect(ios).toBeGreaterThan(-1)
    expect(nativo, 'o app é checado depois do iOS: o iPhone cai no passo a passo do Safari').toBeLessThan(ios)
  })
})
