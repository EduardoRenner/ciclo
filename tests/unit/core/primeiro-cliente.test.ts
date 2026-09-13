import { describe, expect, it } from 'vitest'

import { mensagemDeClienteCadastrado } from '@/core/ciclo/primeiro-cliente'

describe('mensagemDeClienteCadastrado', () => {
  it('cadastro comum fica com o título neutro de sempre, sem descrição extra', () => {
    expect(mensagemDeClienteCadastrado(false)).toEqual({ titulo: 'Cliente cadastrado' })
  })

  it('primeiro cliente da casa ganha a descrição do próximo passo', () => {
    const msg = mensagemDeClienteCadastrado(true)
    expect(msg.titulo).toBe('Cliente cadastrado')
    expect(msg.descricao).toContain('primeiro')
  })

  it('nunca usa a palavra banida "aprende" (home-nao-promete-demais)', () => {
    const comum = mensagemDeClienteCadastrado(false)
    const primeiro = mensagemDeClienteCadastrado(true)
    const texto = `${comum.titulo} ${comum.descricao ?? ''} ${primeiro.titulo} ${primeiro.descricao ?? ''}`
    expect(texto).not.toMatch(/aprende/i)
  })

  it('nunca flexiona gênero na frase (sem helper de concordância nesta casa)', () => {
    const primeiro = mensagemDeClienteCadastrado(true)
    expect(primeiro.titulo + (primeiro.descricao ?? '')).not.toMatch(/primeir[ao]\s+cliente/i)
  })
})
