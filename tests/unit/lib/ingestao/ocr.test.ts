import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { ehModoEscuro, escalaParaOcr, paraCinza, prepararParaOcr } from '@/core/ingestao/imagem'
import { palavrasDaImagem } from '@/lib/ingestao/ocr'
import { processarArquivo } from '@/lib/ingestao/processar-arquivo'

/**
 * CNV-018: print e foto pelo tesseract.js com o português LOCAL (sem rede). As imagens são geradas
 * aqui (texto renderizado pelo sharp), imitando a lista de clientes de um app.
 */
const LINHAS = ['Clientes', 'Maria Souza   (11) 99999-0001', 'João Lima   (11) 98888-0002', 'Conceição Ávila   (41) 97777-0003']

async function print(escuro: boolean): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="200"><rect width="100%" height="100%" fill="${escuro ? '#111' : '#fff'}"/>${LINHAS.map((l, i) => `<text x="16" y="${36 + i * 40}" font-family="Arial" font-size="18" fill="${escuro ? '#eee' : '#111'}">${l}</text>`).join('')}</svg>`
  return sharp(Buffer.from(svg)).resize({ width: 1260 }).png().toBuffer()
}

describe('preparar a imagem (CNV-018)', () => {
  it('modo escuro pela mediana; escala para ~300 DPI', () => {
    expect(ehModoEscuro(Uint8Array.from([10, 12, 15, 240, 11]))).toBe(true)
    expect(ehModoEscuro(Uint8Array.from([250, 245, 10, 252, 249]))).toBe(false)
    expect(escalaParaOcr(400)).toBe(3)
    expect(escalaParaOcr(1080)).toBeCloseTo(1.48, 2)
    expect(escalaParaOcr(4000)).toBe(1)
    expect(Array.from(paraCinza(Uint8Array.from([255, 255, 255, 255, 0, 0, 0, 255])))).toEqual([255, 0])
  })
})

describe('ler print de verdade (CNV-018)', () => {
  it('print claro: as pessoas entram, todas marcadas para conferir, telefone dígito a dígito', async () => {
    const r = await processarArquivo({ bytes: new Uint8Array(await print(false)), nome: 'print.png', contexto: { hoje: '2026-10-13' } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.formato).toBe('imagem')
    expect(r.resultado.registros.map((x) => [x.nome, x.telefone])).toEqual([
      ['Maria Souza', '+5511999990001'],
      ['João Lima', '+5511988880002'],
      ['Conceição Ávila', '+5541977770003'],
    ])
    for (const x of r.resultado.registros) expect(x.avisos).toEqual(expect.arrayContaining(['conferir_imagem', 'telefone_conferir_digitos']))
    expect(r.resultado.contagem.ouro, 'nada lido de imagem vira ouro automático').toBe(0)
    expect(r.avisos.join(' ')).toMatch(/confira cada linha/)
  }, 60_000)

  it('print escuro: sem inverter não lê; o preparo do core inverte e passa a ler', async () => {
    const escuro = await print(true)
    const { data, info } = await sharp(escuro).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const { pixels, invertida } = prepararParaOcr(new Uint8ClampedArray(data))
    expect(invertida).toBe(true)
    const preparado = await sharp(Buffer.from(pixels), { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
    const lido = await palavrasDaImagem(new Uint8Array(preparado))
    expect(lido.palavras.map((p) => p.texto).join(' ')).toContain('Conceição')
    expect(lido.confiancaMedia).toBeGreaterThan(0.75)
  }, 60_000)

  it('foto do iPhone (HEIC) pede outro formato em vez de falhar calada', async () => {
    const heic = Uint8Array.from([0, 0, 0, 0x18, ...Array.from('ftypheic', (c) => c.charCodeAt(0)), 0, 0, 0, 0])
    const r = await processarArquivo({ bytes: heic, nome: 'IMG_0001.HEIC', contexto: { hoje: '2026-10-13' } })
    expect(r).toEqual({ ok: false, mensagem: expect.stringMatching(/HEIC/) })
  })
})
