import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * docs/98-aprimoramento/11 LOJA-25. Fotos de cliente, de logo e de profissional usam `<input type="file"
 * accept="image/...">`. Dentro do app iOS esse seletor oferece "Tirar foto" e "Fototeca"; sem o texto de uso no
 * `Info.plist`, o iOS encerra o app no toque (é regra do sistema, não da Apple revisora), e a revisão recusa
 * pela 5.1.1 quando o texto não diz para que serve.
 */
const PLIST = readFileSync('ios/App/App/Info.plist', 'utf8')

function textoDe(chave: string): string | undefined {
  return new RegExp(`<key>${chave}</key>\\s*<string>([^<]*)</string>`).exec(PLIST)?.[1]
}

describe('o app iOS explica por que pede câmera e fotos', () => {
  it('o seletor de foto ainda existe (senão esta guarda perdeu o motivo)', () => {
    expect(readFileSync('src/components/config/upload-de-foto.tsx', 'utf8')).toMatch(/accept="image\//)
  })

  it.each(['NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription'])('%s tem texto em português dizendo o uso', (chave) => {
    const texto = textoDe(chave)
    expect(texto, `falta ${chave} no Info.plist`).toBeDefined()
    expect(texto!.length).toBeGreaterThan(30)
    expect(texto).toMatch(/foto/i)
  })
})
