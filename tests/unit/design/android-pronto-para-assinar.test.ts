import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * docs/98-aprimoramento/11 LOJA-31. Três defeitos do projeto Android, conferidos pelo que muda quando voltam:
 *
 *  1. O `.gitignore` vinha do modelo do Android Studio com `*.jks`, `*.keystore` e `google-services.json`
 *     COMENTADOS: o primeiro `git add .` depois de gerar a chave de upload a mandava para o GitHub (repo público
 *     desde 09/09). Chave de upload vazada exige pedir troca ao Google; perdida, o app não atualiza mais.
 *  2. `android:allowBackup="true"`: o backup do Google levava os dados da tela embutida (a fila offline, com
 *     nome e telefone de cliente) para a nuvem da pessoa, fora de qualquer controle do CICLO.
 *  3. Sem `signingConfigs`: não havia como gerar o pacote de release assinado.
 */
const GITIGNORE = readFileSync('android/.gitignore', 'utf8')
const MANIFEST = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8')
const GRADLE = readFileSync('android/app/build.gradle', 'utf8')
const REGRAS = 'android/app/src/main/res/xml/data_extraction_rules.xml'

/** Linhas que valem (sem comentário e sem espaço), para "comentado" não contar como "ignorado". */
const ativas = new Set(GITIGNORE.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')))

describe('Android pronto para assinar sem vazar segredo', () => {
  it.each(['*.jks', '*.keystore', 'google-services.json', 'keystore.properties'])('o .gitignore ignora %s de verdade', (padrao) => {
    expect(ativas.has(padrao), `${padrao} não é uma linha ativa do android/.gitignore`).toBe(true)
  })

  it('backup do Google desligado, inclusive a transferência entre aparelhos (Android 12+)', () => {
    expect(MANIFEST).toMatch(/android:allowBackup="false"/)
    expect(MANIFEST).toMatch(/android:dataExtractionRules="@xml\/data_extraction_rules"/)
    expect(existsSync(REGRAS), 'falta o arquivo de regras citado no manifesto').toBe(true)
    const regras = readFileSync(REGRAS, 'utf8')
    expect(regras).toMatch(/<cloud-backup[^>]*>[\s\S]*<exclude domain="root"/)
    expect(regras).toMatch(/<device-transfer[^>]*>[\s\S]*<exclude domain="root"/)
  })

  it('o release assina com a chave lida de fora do repositório', () => {
    expect(GRADLE).toMatch(/signingConfigs\s*\{[\s\S]*release\s*\{/)
    expect(GRADLE).toMatch(/rootProject\.file\('keystore\.properties'\)/)
    expect(GRADLE).toMatch(/signingConfig = signingConfigs\.release/)
  })

  it('nenhuma senha escrita no build.gradle', () => {
    // `storePassword "..."` ou `= '...'` com texto literal é segredo commitado. Só leitura do arquivo de fora vale.
    // O nome entre colchetes (`['storePassword']`, a leitura do arquivo) não conta: ali não há espaço nem `=` antes da aspa.
    expect(GRADLE).not.toMatch(/(storePassword|keyPassword)(\s+|\s*=\s*)['"]/)
    // Controle positivo: o detector pega a forma proibida.
    expect(`storePassword "segredo"`).toMatch(/(storePassword|keyPassword)(\s+|\s*=\s*)['"]/)
    expect(`keyPassword = 'segredo'`).toMatch(/(storePassword|keyPassword)(\s+|\s*=\s*)['"]/)
  })
})
