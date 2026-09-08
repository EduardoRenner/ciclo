import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * **No React 19, `<form action={fn}>` RESETA o formulário quando a ação termina — inclusive quando
 * ela falhou.** Medido no navegador em 2026-09-03, na tela de entrar: errar a senha limpava e-mail
 * E senha, e a pessoa tinha que redigitar o e-mail a cada tentativa.
 *
 * É um dos problemas de maior impacto em UX de login, e é a explicação do relato que originou o
 * conserto: *"a etapa de login está muito ruim"*. Cada erro custava o formulário inteiro — e num
 * fluxo em que errar a senha é o caso comum, não a exceção.
 *
 * **A regra não é "nunca use `action`".** Em formulário de CRIAR, limpar depois do sucesso é
 * desejável: adicionou uma folga, o formulário fica pronto para a próxima. A regra é sobre a
 * FALHA — e como o `action` reseta sem perguntar se deu certo, ele não sabe fazer essa distinção.
 *
 * Nas quatro telas de autenticação a decisão é simples e por isso a guarda começa por elas: o
 * sucesso sempre navega para fora, então não existe caso em que limpar seja desejado. Ali o reset
 * era puro efeito colateral.
 */

const RAIZ = join('src', 'app', '(auth)')

function formularios(dir: string): string[] {
  const achados: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, e.name)
    if (e.isDirectory()) achados.push(...formularios(caminho))
    else if (/[.]tsx$/.test(e.name) && /<form[\s>]/.test(readFileSync(caminho, 'utf8'))) {
      achados.push(caminho.split(String.fromCharCode(92)).join('/'))
    }
  }
  return achados
}

const TELAS = formularios(RAIZ)

describe('o leitor deste teste', () => {
  it('acha os formulários de autenticação — não passa por não ter olhado nada', () => {
    expect(TELAS.length, 'nenhum formulário encontrado em (auth)').toBeGreaterThanOrEqual(4)
    for (const obrigatoria of ['entrar', 'cadastro', 'nova-senha', 'recuperar-senha']) {
      expect(
        TELAS.some((t) => t.includes(`/${obrigatoria}/`)),
        `${obrigatoria} saiu do alcance da guarda`,
      ).toBe(true)
    }
  })
})

describe('errar não pode custar o que a pessoa digitou', () => {
  it.each(TELAS)('%s não usa `action`, que reseta o formulário mesmo na falha', (tela) => {
    /*
     * Comentário some antes de casar: estes arquivos EXPLICAM em prosa por que não usam `action`,
     * e casar com a explicação reprovaria a documentação que impede o defeito de voltar. É a
     * armadilha nº 1 da tabela de guarda cega do `CLAUDE.md`.
     */
    const fonte = semComentarios(readFileSync(tela, 'utf8'))
    expect(
      /<form\s[^>]*\baction=/.test(fonte),
      `${tela} voltou a usar <form action={...}>. No React 19 isso limpa os campos quando a ação ` +
        'termina, inclusive quando ela falhou — e aqui o sucesso navega para fora, então limpar ' +
        'nunca é o que se quer.',
    ).toBe(false)
  })

  it.each(TELAS)('%s envia por `onSubmit` com `preventDefault`', (tela) => {
    // O outro lado: tirar o `action` e não pôr nada no lugar faria o formulário recarregar a
    // página no submit, que é pior que o reset.
    const fonte = semComentarios(readFileSync(tela, 'utf8'))
    expect(/onSubmit=/.test(fonte), `${tela} não tem manipulador de envio`).toBe(true)
    expect(/preventDefault\(\)/.test(fonte), `${tela} não impede o envio nativo — a página vai recarregar`).toBe(true)
  })
})

/**
 * Fora de `(auth)` a regra é a mesma, mas a decisão do sucesso muda: em formulário de CRIAR, limpar
 * depois que deu certo é desejável. O que continua proibido é limpar quando FALHOU.
 *
 * Os três formulários com `action` fora de `(auth)` foram medidos em 2026-09-03 pela única coisa
 * que decide: **campo controlado não é apagado pelo reset.** `negocio` (9 controlados) e `servicos`
 * (8) estavam a salvo; `editor-expediente` tinha três campos NÃO controlados — duas datas com
 * `defaultValue` e o motivo — e perdia os três quando a folga falhava ao salvar.
 */
/**
 * **A guarda varria só `(auth)` e por isso não viu o painel.** Achado da auditoria de 2026-09-08:
 * `RAIZ` estava fixa em `src/app/(auth)`, então os três casos acima eram conferidos e o resto do
 * produto ficava fora do alcance — o `editor-expediente` só entrou porque alguém o citou À MÃO,
 * um caminho literal que não cresce com o projeto. É guarda cega de RAIZ: a varredura não olhava
 * onde o defeito podia nascer.
 *
 * **O critério aqui é diferente do de `(auth)`, e a diferença é a medição de 03/09 que este mesmo
 * arquivo registra:** campo CONTROLADO não é apagado pelo reset, porque o React o redesenha a
 * partir do state. Proibir `action` no painel inteiro reprovaria `negocio` e `servicos`, que têm
 * todos os campos controlados e estão a salvo — e uma guarda que reprova o que está certo é
 * desligada por quem mantém, não obedecida.
 *
 * Então o que reprova é o PAR: `<form action=>` **e** pelo menos um campo não-controlado dentro.
 * Foi assim que a auditoria de 2026-09-08 separou o defeito real (`profissionais/lista.tsx`, três
 * campos soltos e zero `onChange`) dos dois falsos positivos.
 */
describe('no painel, `action` só é seguro se todo campo for controlado', () => {
  const PAINEL = join('src', 'app', 'admin')
  const DO_PAINEL = formularios(PAINEL)

  it('a varredura enxerga formulários no painel — não passa vazia', () => {
    // O piso é o positivo conhecido, não uma contagem: `profissionais/lista.tsx` tem `<form>` e
    // existe desde antes desta guarda. Se ele sumir da lista, a varredura parou de funcionar.
    expect(DO_PAINEL.length, `nenhum formulário encontrado em ${PAINEL}`).toBeGreaterThan(0)
    expect(
      DO_PAINEL.some((t) => t.includes('/profissionais/lista.tsx')),
      'a varredura do painel não achou profissionais/lista.tsx — o alcance quebrou',
    ).toBe(true)
  })

  it.each(DO_PAINEL)('%s não junta `action` com campo não-controlado', (tela) => {
    const fonte = semComentarios(readFileSync(tela, 'utf8'))
    if (!/<form\s[^>]*\baction=/.test(fonte)) return

    /*
     * Campo não-controlado: tem `name=` e não tem `value=`. Casa com o par dentro da MESMA tag
     * (`[^>]*`), senão o `value=` de um campo vizinho absolveria este — a armadilha da "janela de
     * N caracteres" da tabela do CLAUDE.md.
     */
    const soltos = [...fonte.matchAll(/<(?:input|select|textarea)\s[^>]*\bname=[^>]*>/g)]
      .map((m) => m[0])
      .filter((tag) => !/\bvalue=/.test(tag))

    expect(
      soltos,
      `${tela} usa <form action={...}> com campo não-controlado. No React 19 o reset acontece ` +
        'quando a ação TERMINA, inclusive na falha, e campo sem `value` perde o que a pessoa ' +
        'digitou. Troque por `onSubmit` com `preventDefault`, como em (auth).',
    ).toEqual([])
  })

  it('o detector separa campo controlado de campo solto', () => {
    // Guarda contra o próprio detector: se ele parar de distinguir, tudo acima passa vazio.
    const solto = '<input name="email" type="email" required className="h-12" >'
    const controlado = '<input name="nome" value={nome} onChange={(e) => setNome(e.target.value)} >'
    const casa = (t: string) =>
      [...t.matchAll(/<(?:input|select|textarea)\s[^>]*\bname=[^>]*>/g)].map((m) => m[0]).filter((x) => !/\bvalue=/.test(x))
    expect(casa(solto)).toHaveLength(1)
    expect(casa(controlado)).toHaveLength(0)
  })
})

describe('fora de (auth), limpar no sucesso é permitido; na falha, não', () => {
  const EXPEDIENTE = 'src/components/config/editor-expediente.tsx'
  const fonte = semComentarios(readFileSync(EXPEDIENTE, 'utf8'))

  it('a folga não é enviada por `action`, que limparia também na falha', () => {
    expect(/<form\s[^>]*\baction=/.test(fonte), `${EXPEDIENTE} voltou a limpar os campos mesmo quando falha`).toBe(false)
  })

  it('o reset virou explícito, e depois de a folga entrar na lista', () => {
    /*
     * Casa com a ORDEM, não só com a presença: `reset()` antes do `setFolgas` limparia o
     * formulário mesmo num caminho que ainda pode falhar. É a diferença entre limpar porque deu
     * certo e limpar porque terminou.
     */
    const iSet = fonte.indexOf('setFolgas((atual) => [...atual, json.data!])')
    const iReset = fonte.indexOf('formulario.reset()')
    expect(iSet, 'sumiu a inserção da folga na lista').toBeGreaterThan(-1)
    expect(iReset, 'sumiu o reset explícito — o formulário nunca mais limpa').toBeGreaterThan(-1)
    expect(iReset, 'o reset acontece antes de a folga entrar na lista').toBeGreaterThan(iSet)
  })

  it('o caminho de falha sai antes de chegar no reset', () => {
    // O `return` depois do toast é o que garante que falhar não limpa nada.
    const iErro = fonte.indexOf("mostrarToast({ tom: 'erro', titulo: 'Não consegui salvar a folga'")
    const iReset = fonte.indexOf('formulario.reset()')
    expect(iErro).toBeGreaterThan(-1)
    expect(fonte.slice(iErro, iReset), 'o ramo de erro não retorna antes do reset').toContain('return')
  })
})

describe('o detector reconhece as duas formas', () => {
  it('acusa `action` e absolve `onSubmit`', () => {
    // Guarda contra o próprio detector: se o padrão parar de casar, tudo acima passa vazio.
    expect(/<form\s[^>]*\baction=/.test('<form action={enviar} className="x">')).toBe(true)
    expect(/<form\s[^>]*\baction=/.test('<form\n  onSubmit={(e) => {}}\n  className="x"\n>')).toBe(false)
  })

  it('não confunde o `action` de outra tag', () => {
    // `action` também é atributo válido em outros contextos; a guarda é sobre `<form>`.
    expect(/<form\s[^>]*\baction=/.test('<Button action="salvar">')).toBe(false)
  })

  it('nenhum byte de controle sobrou nos padrões deste arquivo', () => {
    /*
     * Guarda contra a armadilha que JÁ cegou a asserção do expediente neste mesmo arquivo: um `\b`
     * escrito através de um heredoc de Python vira **backspace (0x08)**, porque em Python `'\b'` é
     * um escape válido. O padrão para de casar com qualquer coisa e o byte é invisível em qualquer
     * listagem, `git diff` ou revisão — a mutação passou verde e só a instrumentação revelou.
     *
     * `\b`, `\a`, `\f`, `\v` e `\0` mudam de significado ao atravessar Python. Aqui o byte é
     * procurado diretamente, que é a única leitura que não se deixa enganar.
     */
    const bruto = readFileSync('tests/unit/design/formulario-nao-apaga-o-que-foi-digitado.test.ts', 'utf8')
    const deControle = [...bruto]
      .map((c, i) => ({ codigo: c.charCodeAt(0), posicao: i }))
      .filter(({ codigo }) => codigo < 32 && codigo !== 9 && codigo !== 10 && codigo !== 13)
    expect(deControle, 'byte de controle no fonte do teste: um regex foi corrompido ao ser escrito').toEqual([])
  })
})
