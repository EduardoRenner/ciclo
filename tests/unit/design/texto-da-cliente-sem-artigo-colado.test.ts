import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/112 EXP-S10 e EXP-K05: artigo colado em variável erra o gênero do que vem dentro. "Essa semana
 * o {{servico}}" virou "o Manutenção de cílios" na prévia; "pelo site da ${nome}" vira "da Barbearia
 * Dom Estilo" num lugar e "da Espaço Vitória" no outro; "Como foi seu {serviço}?" vira "seu Escova".
 * O texto sai em nome do salão, no WhatsApp da cliente: quem fica mal é o salão.
 *
 * A regra: nada de artigo, possessivo ou contração (o, a, seu, sua, da, na, do, no) imediatamente
 * antes do nome do serviço ou do salão. "de {nome}", "em {nome}" e "horário de {serviço}" não
 * dependem do gênero.
 */
// Sem "os/as": "as { nome: string }" é tipo TypeScript, não texto (falso positivo medido em `layout.tsx`).
const ANTES = String.raw`\b(?:o|a|seu|sua|da|na|do|no)\s+`
const VARIAVEL_DO_MODELO = new RegExp(ANTES + String.raw`\{\{(?:servico|negocio)\}\}`, 'i')
const VARIAVEL_DE_CODIGO = new RegExp(
  ANTES + String.raw`(?:\$\{|\{)(?:nomeDoSalao|perfil\.name|nome|dados\??\.(?:negocioNome|servicoNome))\b`,
  'i',
)

function arquivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(dir, e.name)
    if (e.isDirectory()) return arquivos(caminho)
    return /\.tsx?$/.test(e.name) ? [caminho] : []
  })
}

const PUBLICO = [...arquivos('src/app/(public)'), 'src/app/admin/hoje/compartilhar.tsx']

describe('texto que chega à cliente sem artigo colado na variável (docs/112 EXP-S10, EXP-K05)', () => {
  it('controle positivo: os padrões acham o defeito num texto de exemplo', () => {
    expect(VARIAVEL_DO_MODELO.test('Essa semana o {{servico}} está saindo')).toBe(true)
    expect(VARIAVEL_DE_CODIGO.test('`Vim pelo site da ${perfil.name}.`')).toBe(true)
    expect(VARIAVEL_DE_CODIGO.test('Como foi seu {dados?.servicoNome}')).toBe(true)
    expect(VARIAVEL_DE_CODIGO.test('`Vim pelo site de ${perfil.name}.`')).toBe(false)
  })

  it('os modelos prontos de mensagem', () => {
    const fonte = readFileSync('src/server/services/mensagens-prontas.ts', 'utf8')
    const corpos = [...fonte.matchAll(/body: '([^']*)'/g)].map((m) => m[1]!)
    expect(corpos.length, 'não achei os modelos: a guarda ficou cega').toBeGreaterThanOrEqual(8)
    expect(corpos.filter((c) => VARIAVEL_DO_MODELO.test(c))).toEqual([])
  })

  it('as telas públicas e o "compartilhar" do Hoje', () => {
    expect(PUBLICO.length, 'a varredura não achou arquivo nenhum').toBeGreaterThan(20)
    const achados = PUBLICO.flatMap((f) =>
      semComentarios(readFileSync(f, 'utf8'))
        .split('\n')
        .filter((l) => VARIAVEL_DE_CODIGO.test(l))
        .map((l) => `${f}: ${l.trim()}`),
    )
    expect(achados).toEqual([])
  })
})
