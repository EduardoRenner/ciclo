import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { comMaiuscula, PADRAO, plural, resolverVocabulario, temPluralConhecido } from '@/core/text/vocabulario'

import { semComentarios } from '../../helpers/fonte'

/** Todo `.tsx` sob um diretório, recursivo. Usado pelas varreduras do painel. */
function arquivosTsx(raiz: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(raiz, { withFileTypes: true })) {
    const caminho = join(raiz, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivosTsx(caminho))
    else if (entrada.name.endsWith('.tsx')) achados.push(caminho.split(String.fromCharCode(92)).join('/'))
  }
  return achados
}

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

  it('trata as terminadas em -l, que era o buraco', () => {
    /*
     * **Medido, não deduzido.** A primeira versão tinha só `-ão` mais `+s` e devolvia
     * "responsávels" para o pet shop e **"profissionals" para o PADRÃO da casa** — a palavra que
     * serve toda profissão sem vocabulário próprio. Só apareceu ao pluralizar a chave `cliente`,
     * que a guarda original não cobria porque olhava apenas `servico` e `atendimento`.
     */
    expect(plural('responsável')).toBe('responsáveis')
    expect(plural('profissional')).toBe('profissionais')
    expect(plural('personal')).toBe('personais')
  })

  it('toda palavra guardada no seed tem plural conhecido, em TODAS as chaves', () => {
    /*
     * A guarda que impede o pluralizador de virar um pluralizador de português. Ele cobre um
     * conjunto FECHADO — as palavras que as profissões guardam. Palavra nova terminada em -el, -il,
     * -ol, -ul, -m, -r ou -z (papel, funil, farol, exame, lar, aprendiz) tem regra própria e sairia
     * errada em silêncio; aqui reprova o build, que é onde alguém olha.
     *
     * **Todas as chaves, e é o conserto do defeito que esta guarda deixou passar.** A versão
     * anterior olhava só `servico` e `atendimento` sob o argumento de que as outras aparecem no
     * singular. Aí o painel passou a pluralizar `cliente` e a guarda seguiu verde sobre
     * "responsávels". Qual chave é pluralizada é decisão de tela, e pode mudar amanhã — a guarda
     * não pode depender disso.
     */
    /*
     * O vocabulário EFETIVO, e não o literal do `insert`: a `0060` corrigiu o gênero por `update`,
     * porque migration aplicada não se edita. Ler só o literal acusaria "tatuador", "professor" e
     * "tutor" para sempre — palavras que o banco já não tem — e a saída fácil seria afrouxar a
     * asserção, que é onde a proteção morre. Mesma leitura que `copy-nao-supoe-genero` faz.
     */
    const vocabs: Record<string, string>[] = []
    const correcoes: { chave: string; para: string }[] = []
    for (const arquivo of readdirSync('supabase/migrations').sort()) {
      if (!arquivo.endsWith('.sql')) continue
      const sql = readFileSync(join('supabase', 'migrations', arquivo), 'utf8')
      for (const bruto of sql.match(/\{"cliente":[^}]*\}/g) ?? []) vocabs.push(JSON.parse(bruto) as Record<string, string>)
      for (const m of sql.matchAll(/jsonb_set\(vocab, '\{(\w+)\}', '"([^"]+)"'\)/g))
        correcoes.push({ chave: m[1] ?? '', para: m[2] ?? '' })
    }
    const substituidas = new Set(vocabs.flatMap((v) => correcoes.map((c) => v[c.chave]).filter(Boolean)))
    const valores = [
      ...Object.values(PADRAO),
      ...correcoes.map((c) => c.para),
      ...vocabs.flatMap((v) => Object.values(v)).filter((v) => !substituidas.has(v)),
    ]

    expect(vocabs.length, 'nenhum vocabulário lido do seed — a varredura olhou o lugar errado').toBeGreaterThanOrEqual(15)
    expect(valores, 'a varredura não alcançou as correções da 0060').toContain('responsável')
    expect(valores, 'a varredura ainda vê o valor que a 0060 substituiu').not.toContain('tutor')
    expect([...new Set(valores.filter((v) => v && !temPluralConhecido(v)))], 'palavra sem regra de plural conhecida').toEqual([])
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

describe('o painel também fala a língua da profissão', () => {
  it('o contexto entrega o vocabulário já resolvido, não o `jsonb` cru', () => {
    /*
     * Resolver na borda, e não em cada tela: a precedência é regra de negócio, e espalhá-la por
     * todo componente que queira uma palavra é a mesma "duas fontes da mesma verdade" que este
     * projeto persegue. O `contextoAtual` já carregava os campos que quase toda tela pede, de
     * carona no `select` que revalida o membership — o vocabulário entra ali pelo mesmo motivo.
     */
    const fonte = semComentarios(readFileSync('src/server/auth/tenant.ts', 'utf8'))
    expect(/vocab_override.*professions\(vocab\)/.test(fonte), 'o contexto parou de buscar o vocabulário').toBe(true)
    expect(/resolverVocabulario\(/.test(fonte), 'o contexto entrega jsonb cru em vez de palavra resolvida').toBe(true)
  })

  it('as telas de maior volume usam o vocabulário', () => {
    const casos: [string, RegExp][] = [
      ['src/app/admin/clientes/page.tsx', /plural\(ctx\.tenant\.vocabulario\.cliente\)/],
      ['src/app/admin/agenda/novo/formulario.tsx', /comMaiuscula\(vocabulario\.servico\)/],
      ['src/app/admin/agenda/novo/formulario.tsx', /comMaiuscula\(vocabulario\.cliente\)/],
    ]
    for (const [arquivo, padrao] of casos) {
      const fonte = semComentarios(readFileSync(arquivo, 'utf8'))
      expect(padrao.test(fonte), `${arquivo} voltou a escrever o rótulo fixo`).toBe(true)
    }
  })

  /**
   * A guarda mais importante desta frente, e a que vale para todo rótulo que ainda vai receber
   * vocabulário. Injetar a palavra num rótulo cujo artigo concorda com ela produz "DO sessão".
   * Medido no painel em 2026-09-04: de 45 rótulos candidatos, **12 têm artigo ou possessivo
   * concordando** — "Direitos da cliente", "Fica no histórico da cliente", "Nenhum serviço ainda".
   *
   * A regra não é "não use artigo": é "não use artigo E vocabulário na mesma linha". Rótulo fixo
   * com artigo continua livre, porque a palavra dele não muda.
   */
  it('nenhum rótulo do painel injeta vocabulário onde o artigo concorda', () => {
    const PALAVRAS = /(atendimentos?|servi[çc]os?|clientes?|profissiona(?:l|is))/i
    const ARTIGO = new RegExp(String.raw`\b(o|a|os|as|do|da|dos|das|ao|aos|pelo|pela|nosso|nossa|esse|essa|cada)\s+` + PALAVRAS.source, 'i')
    const achados: string[] = []
    for (const arquivo of arquivosTsx('src/app/admin')) {
      const fonte = semComentarios(readFileSync(arquivo, 'utf8'))
      for (const linha of fonte.split(String.fromCharCode(10))) {
        if (!/vocabulario\./.test(linha)) continue
        if (ARTIGO.test(linha)) achados.push(`${arquivo}: ${linha.trim().slice(0, 80)}`)
      }
    }
    expect(
      achados,
      'rótulo do painel com artigo concordando com a palavra que o vocabulário troca. "Direitos da ' +
        'cliente" vira "Direitos da paciente" e depois "Direitos da estudante" — o artigo não ' +
        'acompanha. Reescreva a frase para não depender de gênero, como foi feito em "Onde vai ser".',
    ).toEqual([])
  })

  it('o leitor do painel achou os arquivos — não passa por ter varrido lista vazia', () => {
    // O piso: a asserção acima é `toEqual([])`, então uma varredura que não olha nada passa.
    expect(arquivosTsx('src/app/admin').length, 'a varredura do painel não achou tela nenhuma').toBeGreaterThanOrEqual(80)
  })
})
