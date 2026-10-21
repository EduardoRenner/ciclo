import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * docs/98-aprimoramento/11 LOJA-26. O projeto iOS saiu do modelo do Capacitor rodando em iPad (`"1,2"`) e em
 * paisagem, enquanto o produto é desenhado para celular em pé (`public/manifest.json` diz `portrait`). Com iPad
 * ligado, a Apple exige imagens de iPad e testa nele, e o painel nunca foi medido em tela de 1024 px deitada.
 *
 * Escolhido o caminho reversível: só iPhone e só retrato. Acrescentar iPad depois é permitido; retirar iPad de um
 * app já publicado não é. Quem for ligar o iPad muda esta guarda de propósito.
 */
const PBX = readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8')
const PLIST = readFileSync('ios/App/App/Info.plist', 'utf8')

function orientacoes(chave: string): string[] | null {
  const bloco = new RegExp(`<key>${chave}</key>\\s*<array>([\\s\\S]*?)</array>`).exec(PLIST)?.[1]
  return bloco === undefined ? null : [...bloco.matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1]!)
}

describe('app iOS só no iPhone e só em pé', () => {
  it('as duas configurações (Debug e Release) miram só iPhone', () => {
    const familias = [...PBX.matchAll(/TARGETED_DEVICE_FAMILY = "?([0-9,]+)"?;/g)].map((m) => m[1])
    expect(familias.length, 'não achei TARGETED_DEVICE_FAMILY: a guarda perdeu o alvo').toBe(2)
    expect(familias).toEqual(['1', '1'])
  })

  it('o iPhone aceita só retrato', () => {
    expect(orientacoes('UISupportedInterfaceOrientations')).toEqual(['UIInterfaceOrientationPortrait'])
  })

  it('não sobra configuração de iPad para confundir quem ler', () => {
    expect(orientacoes('UISupportedInterfaceOrientations~ipad')).toBeNull()
  })

  it('o manifesto da web concorda', () => {
    expect(JSON.parse(readFileSync('public/manifest.json', 'utf8')).orientation).toBe('portrait')
  })
})
