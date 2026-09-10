import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { causaDaFalhaDaTela, detalheTecnicoDaFalha, FRASE_DA_CAUSA } from '@/core/schema/causa-da-falha'

import { semComentarios } from '../../helpers/fonte'

/**
 * O boundary de `/admin` dizia SEMPRE *"Pode ter sido a conexão."* Em 2026-09-10 o Eduardo caiu
 * nele com a conexão perfeita: o banco do `.env.local` estava com o schema parcialmente aplicado
 * (faltava a view `v_clientes_a_recuperar` da `0058`), `centralDeAcoes` morria com `PGRST205`, e a
 * tela mandou procurar o defeito no lugar errado.
 *
 * O mesmo texto apareceria para a CLIENTE FINAL no incidente de 2026-09-04 (`docs/62`), quando o
 * código foi ao ar dependendo de coluna que a produção não tinha. Mensagem de erro que aponta para
 * a causa errada é pior que mensagem genérica: ela gasta o tempo de quem tenta consertar.
 */

const BOUNDARY = 'src/app/admin/error.tsx'

const saudavel = { ok: true, checks: { database: { ok: true }, schema: { ok: true } } }
const atrasado = {
  ok: false,
  checks: { database: { ok: true }, schema: { ok: false, detail: 'banco ATRÁS do código: falta a 0083 e mais 2' } },
}
const bancoFora = { ok: false, checks: { database: { ok: false, detail: 'sem resposta do banco' }, schema: { ok: true } } }

describe('a tela quebrada diz a causa que consegue provar', () => {
  it('banco atrás do código vira `schema_defasado`', () => {
    expect(causaDaFalhaDaTela(atrasado)).toBe('schema_defasado')
  })

  it('banco fora vira `banco_fora`', () => {
    expect(causaDaFalhaDaTela(bancoFora)).toBe('banco_fora')
  })

  it('tudo verde NÃO inventa causa: o erro foi outra coisa', () => {
    // O caso que impede a guarda de virar alarme: health ok e a tela mesmo assim quebrou (bug de
    // render, permissão, o que for). Aí a frase genérica é a honesta.
    expect(causaDaFalhaDaTela(saudavel)).toBe('desconhecida')
  })

  it('schema vence banco quando os dois estão vermelhos', () => {
    // Banco atrás costuma derrubar outras checagens junto. A causa acionável é a que dá para
    // consertar; dizer "banco fora" mandaria reiniciar servidor à toa.
    const ambos = { checks: { database: { ok: false }, schema: { ok: false } } }
    expect(causaDaFalhaDaTela(ambos)).toBe('schema_defasado')
  })

  it.each([null, undefined, 42, 'texto', {}, { checks: null }, { checks: { schema: 'nao-e-objeto' } }, { checks: { schema: {} } }])(
    'corpo inesperado (%s) vira `desconhecida`, nunca lança',
    (corpo) => {
      expect(() => causaDaFalhaDaTela(corpo)).not.toThrow()
      expect(causaDaFalhaDaTela(corpo)).toBe('desconhecida')
    },
  )

  it('o detalhe técnico sai do próprio health, e some quando não há causa', () => {
    expect(detalheTecnicoDaFalha(atrasado, 'schema_defasado')).toMatch(/ATRÁS do código/)
    expect(detalheTecnicoDaFalha(bancoFora, 'banco_fora')).toBe('sem resposta do banco')
    expect(detalheTecnicoDaFalha(saudavel, 'desconhecida')).toBeNull()
    // Sem `detail` no corpo não pode virar string vazia na tela.
    expect(detalheTecnicoDaFalha({ checks: { schema: { ok: false } } }, 'schema_defasado')).toBeNull()
  })

  it('as três frases são distintas e nenhuma culpa a internet sem saber', () => {
    const frases = Object.values(FRASE_DA_CAUSA)
    expect(new Set(frases).size, 'duas causas com a mesma frase: o conserto não chegou na tela').toBe(3)
    // A frase do schema é a que não pode voltar a falar de conexão — foi esse o defeito.
    expect(FRASE_DA_CAUSA.schema_defasado).not.toMatch(/conex[ãa]o/i)
    expect(FRASE_DA_CAUSA.schema_defasado).toMatch(/banco de dados/i)
  })

  it('nenhuma frase usa travessão (a guarda de copy varre o renderizado)', () => {
    for (const f of Object.values(FRASE_DA_CAUSA)) expect(f).not.toContain(String.fromCharCode(8212))
  })
})

/**
 * A outra metade, e é a que costuma faltar: a função pode estar perfeita e não ser CHAMADA.
 * Guarda de função e guarda de uso são duas coisas (a armadilha da Unidade 5c, e a mesma que
 * `contexto-do-modelo-nao-leva-saude` documenta).
 */
describe('e o boundary REALMENTE pergunta a causa', () => {
  const fonte = semComentarios(readFileSync(BOUNDARY, 'utf8'))

  it('a leitura não voltou vazia', () => {
    expect(fonte.length, `${BOUNDARY} veio vazio`).toBeGreaterThan(800)
  })

  it('consulta /api/health', () => {
    // Casa com a CHAMADA e com a rota, não com o nome solto do import.
    expect(fonte, 'o boundary parou de perguntar a causa a quem sabe').toMatch(/fetch\(\s*['"`]\/api\/health['"`]/)
  })

  it('usa a função de decisão em vez de decidir no JSX', () => {
    expect(fonte).toMatch(/causaDaFalhaDaTela\(/)
    expect(fonte).toMatch(/FRASE_DA_CAUSA\[/)
  })

  it('não voltou a cravar a frase de conexão no JSX', () => {
    // O defeito exato que este arquivo existe para impedir: o texto fixo de volta na tela.
    expect(
      /Pode ter sido a conex[ãa]o/.test(fonte),
      'a frase de conexão voltou a ser literal no boundary: ela precisa vir de `FRASE_DA_CAUSA`, ' +
        'senão a tela volta a culpar a internet quando o banco é que está atrás do código.',
    ).toBe(false)
  })

  it('a espera tem teto: a tela de erro não pode ficar pendurada', () => {
    expect(fonte).toMatch(/AbortController|signal/)
    expect(fonte, 'sumiu o timeout do diagnóstico').toMatch(/setTimeout\([\s\S]{0,80}abort/)
  })
})
