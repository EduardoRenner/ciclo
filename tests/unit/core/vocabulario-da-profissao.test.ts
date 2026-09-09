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
    const correcoes: { para: string; de: string[] }[] = []
    for (const arquivo of readdirSync('supabase/migrations').sort()) {
      if (!arquivo.endsWith('.sql')) continue
      const sql = readFileSync(join('supabase', 'migrations', arquivo), 'utf8')
      for (const bruto of sql.match(/\{"cliente":[^}]*\}/g) ?? []) vocabs.push(JSON.parse(bruto) as Record<string, string>)
      /*
       * O `where` importa, e a primeira versão o ignorava: ela marcava como substituído o valor
       * ATUAL de toda chave que tivesse alguma correção. Como a 0060 corrige `cliente`, "paciente"
       * (que ela não toca) sumia da varredura — a guarda ficava cega justamente na chave que o
       * painel passou a pluralizar. O SQL é achatado porque o `update` ocupa várias linhas.
       */
      const plano = sql.split(new RegExp(String.raw`\s+`, 'g')).join(' ')
      const re = new RegExp(String.raw`jsonb_set\(vocab, '\{\w+\}', '"([^"]+)"'\) where vocab->>'\w+' (?:=|in) \(?([^;]+?)\)?;`, 'g')
      for (const m of plano.matchAll(re)) {
        correcoes.push({ para: m[1] ?? '', de: [...(m[2] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1] ?? '') })
      }
    }
    const substituidas = new Set(correcoes.flatMap((c) => c.de))
    const valores = [
      ...Object.values(PADRAO),
      ...correcoes.map((c) => c.para),
      ...vocabs.flatMap((v) => Object.values(v)).filter((v) => !substituidas.has(v)),
    ]

    expect(vocabs.length, 'nenhum vocabulário lido do seed — a varredura olhou o lugar errado').toBeGreaterThanOrEqual(15)
    expect(valores, 'a varredura não alcançou as correções da 0060').toContain('responsável')
    expect(valores, 'a varredura ainda vê o valor que a 0060 substituiu').not.toContain('tutor')
    /*
     * A LARGURA afirmada, e não só a profundidade. Medindo por mutação, estreitar a varredura de
     * volta para `servico` e `atendimento` **passava verde**: as palavras perigosas de hoje
     * (`responsável`, `profissional`) chegam por `PADRAO` e pelas correções, então o estreitamento
     * não tinha contraexemplo nos dados. Sem estas duas linhas a guarda voltaria a ser estreita sem
     * ninguém ver — e o próximo valor sem plural cairia justamente numa chave descoberta, que foi
     * exatamente como "responsávels" nasceu.
     */
    expect(valores, 'a varredura deixou de olhar a chave `cliente`').toContain('paciente')
    expect(valores, 'a varredura deixou de olhar a chave `local`').toContain('salão')
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
      // Ligados em 2026-09-04. Os três são rótulo solto, sem artigo colado — a única forma segura
      // enquanto a palavra trocada muda de gênero entre profissões (sessão, aula, treino).
      ['src/app/admin/campanhas/page.tsx', /plural\(ctx\.tenant\.vocabulario\.atendimento\)/],
      ['src/app/admin/config/meu-plano/page.tsx', /plural\(ctx\.tenant\.vocabulario\.cliente\)/],
      ['src/app/admin/clientes/[id]/pacotes-carteira.tsx', /comMaiuscula\(vocabulario\.servico\)/],
      /*
        Item 19 da auditoria de 2026-09-08, ligado em 2026-09-09. A LISTA de clientes é a tela de
        maior volume do painel e falava fixo em três pontos: o rótulo da busca, o anúncio do leitor
        de tela e o título do vazio. Um psicólogo lia "Buscar cliente" onde o certo é "paciente";
        um personal, onde o certo é "aluno". O arquivo já importava `useVocabulario` — usava a
        palavra em UM lugar (o botão do vazio) e nos outros três não.

        As três frases foram escritas sem artigo concordando com a palavra injetada, que é a regra
        do bloco logo abaixo: "Buscar X", "Sem Xs ainda", "N Xs na lista" (aqui o `na` concorda com
        "lista", não com a palavra).
      */
      ['src/app/admin/clientes/lista.tsx', /Buscar \{vocabulario\.cliente\}/],
      ['src/app/admin/clientes/lista.tsx', /plural\(vocabulario\.cliente\)/],
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
    /*
     * As CONTRAÇÕES entram na lista, e faltavam: medindo o painel em 2026-09-04, a ajuda
     * "Muda só como o preço aparece **pro** cliente" foi classificada como segura, porque `pro` é
     * "para o" contraído e não estava aqui. Um rótulo assim, ligado ao vocabulário, viraria "pro
     * sessão". `no`, `na`, `num` e `pela` têm o mesmo problema.
     */
    /**
     * Artigo colado no fim do trecho: o que vem logo ANTES da palavra injetada. `$` no fim é o que
     * torna isto "colado" — sem ele, qualquer artigo em qualquer ponto da linha acusaria.
     */
    const COLADO = new RegExp(
      /*
       * A âncora da esquerda NÃO pode ser `\b`, e isto custou uma rodada. Em JavaScript sem a
       * flag `u`, `à` é caractere de NÃO-palavra: entre o espaço e o `à` de "às" não existe
       * fronteira nenhuma, então `\bàs` nunca casa. É a mesma armadilha que já cegou a guarda de
       * gênero por `\b(quem|voc[êe])\b` — o `\b` colado numa alternativa acentuada não casa —,
       * agora pela ponta esquerda.
       *
       * `(?:^|[^A-Za-zÀ-ÿ])` diz o que `\b` queria dizer: começo do trecho, ou algo que não é
       * letra (com acento incluído). Consome um caractere, e isso é irrelevante porque só se usa
       * `.test()`.
       */
      String.raw`(?:^|[^A-Za-zÀ-ÿ])(daquele|daquela|naquele|naquela|àquele|àquela|desta|deste|dessa|desse|nesta|neste|nessa|nesse|pelos|pelas|pelo|pela|nosso|nossa|aquele|aquela|numa|num|dos|das|nos|nas|aos|pros|pras|esse|essa|este|esta|cada|seu|sua|pro|pra|ao|do|da|no|na|os|as|às|à|o|a)\s+(\$\{[\w.(]*)?$`,
      'i',
    )
    /*
     * A vizinhança da INJEÇÃO, não a linha inteira — e a diferença apareceu medindo. A primeira
     * versão olhava a linha, e reprovou
     * `<PageHeader titulo={...vocabulario.servico} descricao="...a ordem que a cliente vê" />`:
     * o `titulo` recebe vocabulário, a `descricao` é texto fixo com artigo, e as duas coisas não
     * têm relação nenhuma. Uma linha pode legitimamente ter as duas.
     *
     * O que realmente quebra é o artigo colado NA palavra trocada — `Foto do ${vocabulario.servico}`
     * vira "Foto do sessão". Por isso a janela é curta e olha só para trás da ocorrência.
     */
    const achados: string[] = []
    for (const arquivo of arquivosTsx('src/app/admin')) {
      const fonte = semComentarios(readFileSync(arquivo, 'utf8'))
      for (const linha of fonte.split(String.fromCharCode(10))) {
        for (const m of linha.matchAll(/vocabulario\.\w+/g)) {
          // 24 caracteres cobrem `do ${`, `da ${comMaiuscula(` e afins, sem alcançar outro atributo.
          const antes = linha.slice(Math.max(0, m.index - 24), m.index)
          if (COLADO.test(antes)) achados.push(`${arquivo}: ${linha.trim().slice(0, 80)}`)
        }
      }
    }
    // Guarda contra o próprio detector, e ela é obrigatória aqui porque a asserção acima ficou mais
    // ESTREITA nesta rodada: detector que parou de casar deixa `achados` vazio e passa por engano.
    expect(COLADO.test('rotulo={`Foto do ${'), 'o detector cegou para o caso que ele existe para pegar').toBe(true)
    expect(COLADO.test('rotulo={`Direitos da ${comMaiuscula('), 'o detector não alcança a chamada aninhada').toBe(true)
    expect(COLADO.test('descricao="a ordem que a cliente vê" titulo={'), 'o detector acusa atributo vizinho').toBe(false)
    /*
     * As CONTRAÇÕES afirmadas por nome, e não só presentes na lista. Medido por mutação: apagá-las
     * do padrão passava VERDE, porque nenhum rótulo de hoje injeta vocabulário depois de "pro". A
     * largura do detector precisa ser asserção, senão ela encolhe sem ninguém ver — e foi
     * exatamente assim que "aparece pro cliente" quase entrou como seguro.
     */
    for (const contracao of ['pro', 'pra', 'no', 'na', 'num', 'pela']) {
      expect(COLADO.test(`ajuda={\`aparece ${contracao} \${`), `o detector deixou de conhecer "${contracao}"`).toBe(true)
    }
    /*
     * As contrações com DEMONSTRATIVO faltavam, e uma delas já está viva: `clientes/[id]/fotos.tsx`
     * diz "Necessário antes da primeira foto **desta** cliente". O padrão anterior conhecia `esta`
     * mas `\b` não casa dentro de "desta", então aquele rótulo era classificado como SEGURO — e
     * ligá-lo ao vocabulário produziria "desta atendimento".
     *
     * Medido em 2026-09-04 varrendo o próprio detector, não o painel: onze formas passavam batido
     * (`desta`, `deste`, `nesta`, `neste`, `dessa`, `desse`, `naquele`, `naquela`, `àquele`, `às`,
     * `à`). É o mesmo modo de falha que já tinha deixado "aparece pro cliente" entrar como seguro:
     * a lista do detector encolhe em silêncio quando ninguém afirma a largura dela por nome.
     */
    for (const forma of ['desta', 'deste', 'nesta', 'neste', 'dessa', 'desse', 'naquele', 'naquela', 'àquele', 'às', 'à']) {
      expect(COLADO.test(`descricao={\`foto ${forma} \${`), `o detector deixou de conhecer "${forma}"`).toBe(true)
    }

    expect(
      achados,
      'rótulo do painel com artigo concordando com a palavra que o vocabulário troca. "Direitos da ' +
        'cliente" vira "Direitos da paciente" e depois "Direitos da estudante" — o artigo não ' +
        'acompanha. Reescreva a frase para não depender de gênero, como foi feito em "Onde vai ser".',
    ).toEqual([])
  })

  it('o layout provê o vocabulário do tenant, não o padrão fixo', () => {
    /*
     * Medido por mutação: trocar `ctx?.tenant.vocabulario ?? PADRAO` por `PADRAO` passava VERDE. O
     * painel inteiro voltaria a dizer "Cliente" e "Serviço" para todo mundo, em silêncio, e as
     * asserções de tela continuariam passando porque elas conferem que a TELA consome o hook — não
     * que alguém entrega o valor certo a ele. É a costura entre as duas pontas, que é onde este
     * projeto já perdeu recurso inteiro (`tenants.cobranca`, `vocab_override`) sem ninguém ver.
     */
    const fonte = semComentarios(readFileSync('src/app/admin/layout.tsx', 'utf8'))
    expect(/<VocabularioProvider/.test(fonte), 'o layout parou de prover o vocabulário').toBe(true)
    expect(
      /valor=\{ctx\?\.tenant\.vocabulario \?\? PADRAO\}/.test(fonte),
      'o layout provê um valor fixo: toda tela do painel cai no padrão da casa em silêncio',
    ).toBe(true)
    // O `catch` é o que impede o layout de derrubar o painel de quem ainda não tem estabelecimento.
    expect(/contextoAtual\([\s\S]{0,120}catch\(\(\) => null\)/.test(fonte), 'o layout estoura para conta sem tenant').toBe(true)
  })

  it('o leitor do painel achou os arquivos — não passa por ter varrido lista vazia', () => {
    // O piso: a asserção acima é `toEqual([])`, então uma varredura que não olha nada passa.
    expect(arquivosTsx('src/app/admin').length, 'a varredura do painel não achou tela nenhuma').toBeGreaterThanOrEqual(80)
  })
})
