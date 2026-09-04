import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { comMaiuscula, PADRAO, plural, resolverVocabulario, temPluralConhecido } from '@/core/text/vocabulario'

import { semComentarios } from '../../helpers/fonte'

/**
 * `professions.vocab` e `tenants.vocab_override` existem desde a migration 0022 e tinham **zero
 * consumidores**: o produto perguntava a profissão no cadastro, guardava o vocabulário dela e
 * nunca aplicava. Um psicólogo lia "Serviço" onde o certo é "Sessão". Mesma classe de
 * `tenants.cobranca`, que originou o `docs/40`.
 *
 * Precedência decidida em `docs/DECISOES.md` (2026-09-04), igual à área de *Terminology* do Jane
 * App: **override do dono → pacote da profissão → padrão da casa**, chave a chave.
 */

describe('a resolução das palavras', () => {
  it('o override do dono vence o pacote da profissão', () => {
    const v = resolverVocabulario({ cliente: 'paciente' }, { cliente: 'pessoa atendida' })
    expect(v.cliente).toBe('pessoa atendida')
  })

  it('sem override, vale o pacote da profissão', () => {
    expect(resolverVocabulario({ cliente: 'paciente' }, null).cliente).toBe('paciente')
  })

  it('sem pacote nem override, vale o padrão da casa', () => {
    const v = resolverVocabulario(null, null)
    expect(v).toEqual(PADRAO)
  })

  it('a precedência é por CHAVE, não por objeto inteiro', () => {
    /*
     * O caso que separa "resolver" de "escolher um dos dois": o dono que renomeou só `cliente` não
     * pode perder o `servico` da profissão dele. Um `override ?? pacote` no objeto inteiro faria
     * exatamente isso, e passaria nos dois testes acima.
     */
    const v = resolverVocabulario({ cliente: 'paciente', servico: 'sessão' }, { cliente: 'pessoa atendida' })
    expect(v.cliente).toBe('pessoa atendida')
    expect(v.servico).toBe('sessão')
  })

  it('valor vazio ou só espaço cai para o degrau seguinte, nunca para a tela', () => {
    // Meia customização não pode deixar um rótulo em branco no meio da página do salão.
    expect(resolverVocabulario({ servico: 'sessão' }, { servico: '' }).servico).toBe('sessão')
    expect(resolverVocabulario({ servico: 'sessão' }, { servico: '   ' }).servico).toBe('sessão')
    expect(resolverVocabulario({ servico: '' }, null).servico).toBe(PADRAO.servico)
  })

  it('`jsonb` com lixo dentro não derruba a página', () => {
    // As duas colunas são `jsonb` livre. Número, nulo e objeto aninhado têm que virar padrão.
    const v = resolverVocabulario({ cliente: 42, servico: null }, { profissional: { nome: 'x' } })
    expect(v.cliente).toBe(PADRAO.cliente)
    expect(v.servico).toBe(PADRAO.servico)
    expect(v.profissional).toBe(PADRAO.profissional)
  })
})

describe('o plural, que é onde português quebra', () => {
  it('trata a irregular', () => {
    // "sessão" é a única irregular do conjunto, e é justamente a do psicólogo.
    expect(plural('sessão')).toBe('sessões')
  })

  it('trata as regulares', () => {
    for (const [palavra, esperado] of [
      ['serviço', 'serviços'],
      ['treino', 'treinos'],
      ['aula', 'aulas'],
      ['faxina', 'faxinas'],
      ['ensaio', 'ensaios'],
      ['trabalho', 'trabalhos'],
      ['atendimento', 'atendimentos'],
    ] as const) {
      expect(plural(palavra)).toBe(esperado)
    }
  })

  it('toda palavra guardada no seed tem plural conhecido', () => {
    /*
     * A guarda que impede o pluralizador de virar um pluralizador de português. Ele cobre um
     * conjunto FECHADO — as palavras que as profissões guardam. Palavra nova terminada em -l, -r,
     * -m ou -z (papel, lar, exame, aprendiz) tem regra própria e sairia errada em silêncio; aqui
     * ela reprova o build, que é onde alguém olha.
     */
    const valores: string[] = []
    for (const arquivo of readdirSync('supabase/migrations')) {
      if (!arquivo.endsWith('.sql')) continue
      const sql = readFileSync(join('supabase', 'migrations', arquivo), 'utf8')
      for (const bruto of sql.match(/\{"cliente":[^}]*\}/g) ?? []) {
        const obj = JSON.parse(bruto) as Record<string, string>
        // Só as chaves que viram título no plural. `cliente` e `profissional` aparecem no singular.
        for (const chave of ['servico', 'atendimento']) if (obj[chave]) valores.push(obj[chave])
      }
    }
    expect(valores.length, 'nenhuma palavra lida do seed — a varredura olhou o lugar errado').toBeGreaterThanOrEqual(20)
    expect([...new Set(valores.filter((v) => !temPluralConhecido(v)))], 'palavra sem regra de plural conhecida').toEqual([])
  })
})

describe('a maiúscula do rótulo', () => {
  it('sobe a primeira letra e não mexe no resto', () => {
    expect(comMaiuscula('sessão')).toBe('Sessão')
    expect(comMaiuscula('')).toBe('')
  })
})

describe('a superfície pública fala a língua da profissão', () => {
  const VITRINE = 'src/app/(public)/[slug]/secoes.tsx'
  const AGENDAR = 'src/app/(public)/[slug]/agendar/agendar.tsx'

  it('o servidor busca as duas colunas e resolve antes de entregar', () => {
    const fonte = semComentarios(readFileSync('src/server/services/public-booking.ts', 'utf8'))
    expect(/vocab_override/.test(fonte), 'a consulta parou de trazer o override do dono').toBe(true)
    expect(/professions \( vocab \)/.test(fonte), 'a consulta parou de trazer o vocabulário da profissão').toBe(true)
    // Casa com a CHAMADA, não com o import: o nome solto no arquivo passaria com a resolução morta.
    expect(/resolverVocabulario\(/.test(fonte), 'o vocabulário deixou de ser resolvido no servidor').toBe(true)
  })

  it('o título da vitrine vem do vocabulário, não de um literal', () => {
    const fonte = semComentarios(readFileSync(VITRINE, 'utf8'))
    expect(/plural\(perfil\.vocabulario\.servico\)/.test(fonte), 'a vitrine voltou a escrever "Serviços" fixo').toBe(true)
    expect(/>Serviços</.test(fonte), 'sobrou um "Serviços" literal na vitrine').toBe(false)
  })

  it('os passos do agendamento vêm do vocabulário', () => {
    const fonte = semComentarios(readFileSync(AGENDAR, 'utf8'))
    expect(/titulo=\{comMaiuscula\(vocabulario\.servico\)\}/.test(fonte), 'o passo do serviço voltou a ser fixo').toBe(true)
    expect(/titulo=\{comMaiuscula\(vocabulario\.profissional\)\}/.test(fonte), 'o passo do profissional voltou a ser fixo').toBe(
      true,
    )
  })

  it('nenhum rótulo público faz o artigo concordar com a palavra trocada', () => {
    /*
     * O defeito que este trabalho quase criou. "Endereço DO atendimento" vira "DO sessão" no
     * psicólogo, porque o artigo concorda com a palavra e o vocabulário guarda só o substantivo.
     * A saída foi reescrever o rótulo para não depender de gênero ("Onde vai ser"), que é o que o
     * `docs/20` §403 indica ao vetar barra e parênteses.
     *
     * A guarda casa com a CONSTRUÇÃO, não com a frase antiga: qualquer `do`/`da` colado numa das
     * palavras do vocabulário volta a ter o mesmo problema.
     */
    const fonte = semComentarios(readFileSync(AGENDAR, 'utf8'))
    const perigosas = /\b(do|da|ao|à|pelo|pela|nosso|nossa)\s+(atendimento|servi[çc]o|cliente|profissional)\b/i
    const linhas = fonte.split(String.fromCharCode(10)).filter((l) => /rotulo=|titulo=|placeholder=/.test(l) && perigosas.test(l))
    expect(linhas, 'rótulo público com artigo concordando com palavra que o vocabulário troca').toEqual([])
  })
})
