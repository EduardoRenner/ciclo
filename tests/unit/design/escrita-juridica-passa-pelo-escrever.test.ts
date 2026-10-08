import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

vi.mock('@/lib/offline/db', () => ({ listarMutacoes: async () => [], salvarMutacao: async () => undefined, removerMutacao: async () => undefined }))
const { textoDaConexao } = await import('@/components/shell/indicador-de-conexao')

/**
 * docs/101 T5.3: escrita jurídica sem conexão avisa e NÃO entra na fila (risco de prazo gravado depois
 * com a data velha, §3.6). Quem garante isso é `escreverJuridico`; esta guarda garante que toda tela
 * que fala com uma rota jurídica passa por ele, e não por `fetch` cru (que lançaria para o boundary e
 * daria a frase genérica) nem por `apiFetch` (que enfileiraria, se não recusasse).
 *
 * Casa com a URL LITERAL da rota no código da tela (sem comentários): é o que muda quando alguém escreve
 * uma tela nova que grava no jurídico.
 */
const ROTA = /['"`]\/api\/v1\/(?:legal\/|tenant\/advocacia['"`])/
const CHAMADA_CRUA = /(?<![\w.])(?:fetch|apiFetch)\(/
// com ou sem argumento de tipo: `escreverJuridico<{ id: string }>(`
const CHAMADA_CERTA = /\bescreverJuridico(?:<[^()]*>)?\(/

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, e.name)
    if (e.isDirectory()) achados.push(...arquivos(caminho))
    else if (/\.tsx?$/.test(e.name)) achados.push(caminho.split(String.fromCharCode(92)).join('/'))
  }
  return achados
}

const TELAS = [...arquivos(join('src', 'app')), ...arquivos(join('src', 'components'))]
  .filter((f) => !f.startsWith('src/app/api/'))
  .map((f) => ({ f, fonte: semComentarios(readFileSync(f, 'utf8')) }))
  .filter(({ fonte }) => ROTA.test(fonte))

describe('escrita jurídica passa por escreverJuridico', () => {
  it('a varredura acha as telas que gravam no jurídico (piso pelo positivo conhecido)', () => {
    const nomes = TELAS.map((t) => t.f)
    for (const conhecida of [
      'src/components/advocacia/prazos.tsx',
      'src/components/advocacia/documentos.tsx',
      'src/app/admin/pendencias/fila.tsx',
      'src/app/admin/config/advocacia/formularios.tsx',
    ]) {
      expect(nomes, `${conhecida} saiu do alcance da guarda`).toContain(conhecida)
    }
  })

  it.each(TELAS.map((t) => [t.f, t.fonte]))('%s não chama fetch nem apiFetch direto', (_f, fonte) => {
    expect(fonte).not.toMatch(CHAMADA_CRUA)
    expect(fonte).toMatch(CHAMADA_CERTA)
  })

  it('o detector acusa as duas formas cruas e absolve a certa', () => {
    expect(CHAMADA_CRUA.test("await fetch('/api/v1/legal/cases', {")).toBe(true)
    expect(CHAMADA_CRUA.test("void apiFetch('/api/v1/legal/cases', {")).toBe(true)
    expect(CHAMADA_CRUA.test("await escreverJuridico('/api/v1/legal/cases', {")).toBe(false)
    expect(CHAMADA_CERTA.test('await escreverJuridico<{ mensagem: { link: string } | null }>(`/api/v1/legal/cases/${id}`')).toBe(true)
    expect(CHAMADA_CERTA.test("import { escreverJuridico } from '@/lib/advocacia/escrever'")).toBe(false)
    expect(ROTA.test("escreverJuridico('/api/v1/tenant/advocacia', {")).toBe(true)
    expect(ROTA.test("fetch('/api/v1/tenant/advocacias')")).toBe(false)
  })
})

describe('a faixa de conexão não promete guardar escrita jurídica', () => {
  it('no pacote Advocacia, sem conexão, diz que só grava com conexão', () => {
    for (const pendentes of [0, 2]) {
      const t = textoDaConexao(false, pendentes, 'advocacia')
      expect(t).not.toMatch(/guardad/)
      expect(t).toMatch(/só gravam com conexão/)
    }
  })

  it('controle positivo: nos outros pacotes a promessa continua (lá a fila existe)', () => {
    expect(textoDaConexao(false, 0, 'base')).toBe('Sem conexão · mudanças serão guardadas')
    expect(textoDaConexao(false, 1, 'base')).toBe('Sem conexão · 1 alteração guardada')
  })

  it('o layout passa o pacote para a faixa', () => {
    const layout = semComentarios(readFileSync('src/app/admin/layout.tsx', 'utf8'))
    expect(layout).toMatch(/<IndicadorDeConexao\s+pacote=\{ctx\?\.tenant\.pacote/)
  })
})
