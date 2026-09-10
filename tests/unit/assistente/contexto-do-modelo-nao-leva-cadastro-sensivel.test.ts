import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { soCadastroQueOModeloPrecisa } from '@/server/assistente/ferramentas'

import { semComentarios } from '../../helpers/fonte'

/**
 * `contexto-do-modelo-nao-leva-saude` fechou o `has_alert` de `health_records`. Sobrava a porta ao
 * lado: `buscar_cliente` e `historico_do_cliente` devolviam a LINHA INTEIRA de `clients` para o
 * Gemini — e `COLUNAS` em `server/services/clientes.ts` traz `notes`, `preferences`, `document`
 * (CPF), `address` e `emergency_contact`.
 *
 * `notes` e `preferences` são texto livre e o schema do cliente diz, com todas as letras, o que vai
 * neles: *"número da máquina, como faz a barba, alergia"*. Não são `health_records`, mas guardam
 * dado de saúde digitado pelo dono — e a regra do `docs/26` §2 fala de ORIGEM e de FRONTEIRA, não
 * de gravidade. CPF e contato de emergência nunca são a resposta de "quando ela veio" — é
 * minimização de LGPD mandar só o que a pergunta usa.
 *
 * `soCadastroQueOModeloPrecisa` é lista de PERMITIDOS: coluna nova em `clients` não vaza por
 * esquecimento (a armadilha de [[guarda-que-varre-passa-vazia]] pelo avesso).
 */

const FONTE = 'src/server/assistente/ferramentas.ts'

const PROIBIDOS = ['notes', 'preferences', 'document', 'address', 'emergency_contact']

/** Uma linha de `clients` como o serviço devolve — com tudo o que a guarda existe para tirar. */
function clienteCru() {
  return {
    id: 'c1',
    name: 'Fulana de Tal',
    phone_e164: '+5511999998888',
    email: 'fulana@exemplo.com',
    birth_date: '1990-05-01',
    notes: 'alérgica a amônia — usar linha vegana',
    preferences: { cafe: 'com leite', alergia: 'níquel' },
    document: '123.456.789-00',
    gender: 'feminino',
    address: 'Rua das Flores, 42',
    emergency_contact: 'Mãe — 11 98888-7777',
    tags: ['vip'],
    visits_count: 12,
    ltv_cents: 240000,
    last_visit_at: '2026-08-20',
  }
}

describe('cadastro sensível não entra no contexto do modelo', () => {
  it('o cenário REALMENTE tem os campos proibidos — senão a guarda não prova nada', () => {
    const cru = clienteCru() as Record<string, unknown>
    for (const campo of PROIBIDOS) expect(cru, `o cenário não tem \`${campo}\``).toHaveProperty(campo)
  })

  it('o filtro tira notes, preferences, CPF, endereço e contato de emergência', () => {
    const limpo = soCadastroQueOModeloPrecisa(clienteCru()) as Record<string, unknown>
    for (const campo of PROIBIDOS) {
      expect(campo in limpo, `\`${campo}\` sobreviveu ao filtro e iria para o Gemini`).toBe(false)
    }
  })

  it('o que a resposta precisa continua lá — o filtro não lobotomiza', () => {
    const limpo = soCadastroQueOModeloPrecisa(clienteCru())
    expect(limpo.name).toBe('Fulana de Tal')
    expect(limpo.phone_e164).toBe('+5511999998888')
    expect(limpo.visits_count).toBe(12)
    expect(limpo.last_visit_at).toBe('2026-08-20')
    expect(limpo.ltv_cents).toBe(240000)
  })

  it('é lista de permitidos: campo desconhecido não passa', () => {
    const comColunaNova = { ...clienteCru(), coluna_nova_qualquer: 'segredo' }
    expect('coluna_nova_qualquer' in soCadastroQueOModeloPrecisa(comColunaNova)).toBe(false)
  })
})

describe('e as DUAS ferramentas realmente usam o filtro', () => {
  const fonte = semComentarios(readFileSync(FONTE, 'utf8'))

  function declaracao(nome: string): string {
    const i = fonte.indexOf(`nome: '${nome}'`)
    expect(i, `a ferramenta ${nome} sumiu — guarda a revisar`).toBeGreaterThan(-1)
    const fim = fonte.indexOf('apagarTipo({', i)
    return fonte.slice(i, fim > i ? fim : undefined)
  }

  it('buscar_cliente passa a lista pelo filtro', () => {
    expect(
      declaracao('buscar_cliente').includes('soCadastroQueOModeloPrecisa'),
      'buscar_cliente devolve a linha de `clients` crua: CPF, notes e contato de emergência vão ao Gemini.',
    ).toBe(true)
  })

  it('historico_do_cliente passa o cadastro pelo filtro', () => {
    expect(
      declaracao('historico_do_cliente').includes('soCadastroQueOModeloPrecisa'),
      'historico_do_cliente devolve `cliente` cru: CPF, notes e contato de emergência vão ao Gemini.',
    ).toBe(true)
  })
})
