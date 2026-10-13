import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * APR-007: `Idempotency-Key` que nasce a cada toque não protege de nada. O duplo toque vira dois
 * pedidos com duas chaves e o servidor grava os dois; o reenvio depois da rede cair também.
 * O caminho certo é `fetchComTentativa` (`src/lib/tentativa.ts`), que guarda a chave enquanto a
 * tentativa não termina.
 *
 * Os formulários que ainda geram a chave na chamada ficam nesta linha de base. Ela só encolhe:
 * arquivo novo, ou contagem maior num arquivo listado, reprova. Ao migrar um arquivo, baixe o número
 * (ou tire a linha) — o teste também reprova se a lista ficar maior que a realidade, para a linha de
 * base não virar crédito para regressão futura.
 */
const LINHA_DE_BASE: Record<string, number> = {
  'src/app/(auth)/verificar/formulario.tsx': 1,
  'src/app/(public)/[slug]/orcamento/pedido.tsx': 1,
  'src/app/admin/campanhas/nova/nova.tsx': 1,
  'src/app/admin/clientes/[id]/direitos.tsx': 1,
  'src/app/admin/clientes/[id]/ficha.tsx': 3,
  'src/app/admin/clientes/[id]/fotos.tsx': 6,
  'src/app/admin/clientes/[id]/notas.tsx': 1,
  'src/app/admin/clientes/ja-atendo/formulario.tsx': 1,
  'src/app/admin/config/automacoes/automacoes.tsx': 1,
  'src/app/admin/config/custo-fixo/editor.tsx': 1,
  'src/app/admin/config/excluir-conta/formulario.tsx': 1,
  'src/app/admin/config/mensagens/editor.tsx': 2,
  'src/app/admin/config/mensagens/pausar-envios.tsx': 1,
  'src/app/admin/config/meu-plano/assinar-plano.tsx': 1,
  'src/app/admin/config/meu-plano/cancelar-assinatura.tsx': 1,
  'src/app/admin/config/modulos/modulos.tsx': 1,
  'src/app/admin/config/negocio/formulario.tsx': 1,
  'src/app/admin/config/notificacoes/ativar.tsx': 2,
  'src/app/admin/config/planos/editor.tsx': 1,
  'src/app/admin/config/planos/fidelidade-config.tsx': 1,
  'src/app/admin/config/profissionais/formulario.tsx': 1,
  'src/app/admin/config/profissionais/lista.tsx': 2,
  'src/app/admin/config/seguranca/formulario.tsx': 3,
  'src/app/admin/config/servicos/[id]/ficha/editor.tsx': 1,
  'src/app/admin/config/servicos/[id]/ficha/sugestao.tsx': 1,
  'src/app/admin/config/servicos/formulario.tsx': 1,
  'src/app/admin/config/servicos/lista.tsx': 1,
  'src/app/admin/config/taxas/editor.tsx': 1,
  'src/app/admin/estoque/lista.tsx': 2,
  'src/app/admin/experimentos/experimentos.tsx': 2,
  'src/app/admin/orcamentos/novo/formulario.tsx': 1,
  'src/app/admin/recuperar/recuperar.tsx': 2,
  'src/app/admin/series/lista.tsx': 1,
  'src/app/onboarding/formulario.tsx': 1,
  'src/app/onboarding/perfil/formulario.tsx': 1,
  'src/components/config/editor-expediente.tsx': 3,
  'src/components/shell/assistente-flutuante.tsx': 1,
  'src/lib/advocacia/escrever.ts': 1,
}

/** A chave criada no próprio header — não casa com `chave: crypto.randomUUID()` guardada num ref. */
const CHAVE_NA_CHAMADA = /['"]idempotency-key['"]\s*:\s*crypto\.randomUUID\(\)/gi

function contar(fonte: string): number {
  return fonte.match(CHAVE_NA_CHAMADA)?.length ?? 0
}

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.tsx?$/.test(nome) ? [caminho] : []
  })
}

const RAIZ = process.cwd()
const ocorrencias = new Map<string, number>()
for (const arquivo of arquivos(join(RAIZ, 'src'))) {
  const n = contar(readFileSync(arquivo, 'utf8'))
  if (n > 0) ocorrencias.set(relative(RAIZ, arquivo).replaceAll('\\', '/'), n)
}

describe('chave de idempotência por tentativa (APR-007)', () => {
  it('controle positivo: o detector casa com as duas formas de escrever a chave na chamada', () => {
    expect(contar(`headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() }`)).toBe(1)
    expect(contar(`headers: { "Idempotency-Key": crypto.randomUUID() }`)).toBe(1)
    expect(contar(`tentativa.current = { corpo, chave: crypto.randomUUID() }`)).toBe(0)
  })

  it('a varredura enxerga a linha de base (não passa vazia)', () => {
    const total = [...ocorrencias.values()].reduce((a, b) => a + b, 0)
    expect(total).toBeGreaterThan(0)
  })

  it('nenhum arquivo novo nem contagem maior que a linha de base', () => {
    const excessos = [...ocorrencias]
      .filter(([arquivo, n]) => n > (LINHA_DE_BASE[arquivo] ?? 0))
      .map(([arquivo, n]) => `${arquivo}: ${n} (linha de base ${LINHA_DE_BASE[arquivo] ?? 0}) — use fetchComTentativa`)
    expect(excessos).toEqual([])
  })

  it('a linha de base acompanha a realidade (migrou? baixe o número)', () => {
    const sobras = Object.entries(LINHA_DE_BASE)
      .filter(([arquivo, n]) => (ocorrencias.get(arquivo) ?? 0) < n)
      .map(([arquivo, n]) => `${arquivo}: linha de base ${n}, encontrado ${ocorrencias.get(arquivo) ?? 0}`)
    expect(sobras).toEqual([])
  })

  it('os formulários do APR-007 já não geram chave por toque', () => {
    for (const arquivo of [
      'src/app/admin/comanda/[id]/comanda.tsx',
      'src/app/admin/agenda/novo/formulario.tsx',
      'src/app/admin/agenda/detalhe.tsx',
      'src/app/admin/clientes/nova/formulario.tsx',
      'src/app/admin/clientes/[id]/pacotes-carteira.tsx',
      'src/app/admin/clientes/[id]/fidelidade.tsx',
    ]) {
      const fonte = readFileSync(join(RAIZ, arquivo), 'utf8')
      expect(contar(fonte), arquivo).toBe(0)
      expect(fonte, arquivo).toMatch(/await fetchComTentativa\(/)
    }
  })
})
