import { describe, expect, it } from 'vitest'

import { comandoDaTecla, ehCampo, indiceDepois } from '@/core/advocacia/atalhos'

const tecla = (key: string, extra: Partial<Parameters<typeof comandoDaTecla>[0]> = {}) => comandoDaTecla({ key, ctrlKey: false, metaKey: false, altKey: false, emCampo: false, ...extra })

describe('atalhos da fila (docs/101 T5.4)', () => {
  it('j, k e c viram comandos', () => {
    expect(tecla('j')).toBe('proximo')
    expect(tecla('k')).toBe('anterior')
    expect(tecla('c')).toBe('primeira_acao')
  })

  it('não existe atalho de adiar: nada no pacote adia', () => {
    expect(tecla('a')).toBeNull()
  })

  it('maiúscula, outras teclas e Enter passam (Enter é o próprio link)', () => {
    for (const k of ['J', 'C', 'x', 'Enter', ' ', 'ArrowDown']) expect(tecla(k), k).toBeNull()
  })

  it('com Ctrl, Cmd ou Alt é do navegador; dentro de campo é texto', () => {
    expect(tecla('c', { ctrlKey: true })).toBeNull()
    expect(tecla('j', { metaKey: true })).toBeNull()
    expect(tecla('k', { altKey: true })).toBeNull()
    expect(tecla('c', { emCampo: true })).toBeNull()
  })

  it('o foco anda sem dar a volta e começa no primeiro', () => {
    expect(indiceDepois(-1, 3, 'proximo')).toBe(0)
    expect(indiceDepois(-1, 3, 'anterior')).toBe(0)
    expect(indiceDepois(0, 3, 'proximo')).toBe(1)
    expect(indiceDepois(2, 3, 'proximo')).toBe(2)
    expect(indiceDepois(0, 3, 'anterior')).toBe(0)
    expect(indiceDepois(2, 3, 'anterior')).toBe(1)
    expect(indiceDepois(-1, 0, 'proximo')).toBeNull()
  })

  it('campo é onde se digita; botão, caixa de marcar e link não são', () => {
    expect(ehCampo({ tagName: 'TEXTAREA' })).toBe(true)
    expect(ehCampo({ tagName: 'select' })).toBe(true)
    expect(ehCampo({ tagName: 'INPUT' })).toBe(true)
    expect(ehCampo({ tagName: 'INPUT', type: 'date' })).toBe(true)
    expect(ehCampo({ tagName: 'DIV', isContentEditable: true })).toBe(true)
    expect(ehCampo({ tagName: 'INPUT', type: 'checkbox' })).toBe(false)
    expect(ehCampo({ tagName: 'BUTTON' })).toBe(false)
    expect(ehCampo({ tagName: 'A' })).toBe(false)
    expect(ehCampo(null)).toBe(false)
  })
})
