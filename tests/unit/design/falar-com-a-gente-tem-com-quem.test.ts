import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

import { vazioDeRecuperar } from '@/core/ciclo/vazio-de-recuperar'
import { canalDeContato, textoDeMudarDePlano } from '@/lib/contato'

/**
 * Três telas mandavam o assinante "falar com a gente" e o produto não oferecia com quem: nem
 * telefone, nem e-mail, nem link. Num produto sem cobrança automática, essa frase é o ÚNICO
 * caminho de receita que existe — e ela terminava em parede.
 *
 * É a mesma classe de `fee_cents`, `media.consent_id`, `tenants.plan` e `clients.referred_by`
 * (lido por todo mundo, escrito por ninguém), aplicada a uma frase em vez de a uma coluna. E é
 * silenciosa pelo mesmo motivo: nenhuma tela quebra, nenhum teste fica vermelho, o assinante só
 * desiste.
 *
 * A guarda ataca os dois lados, no padrão de `promessa-de-canal`:
 *   1. exercita a função que tem o direito de escrever a frase, nos DOIS estados do mundo;
 *   2. varre a fonte para que a frase não renasça escrita à mão numa tela que não consulta nada
 *      — que foi exatamente como `textoDoEnvioAutomatico` foi burlada em 2026-08-30.
 */

const RAIZ = 'src'
const CANONICO = join('src', 'lib', 'contato.ts')

/**
 * O SEGUNDO desenho correto, e a guarda não o enxergava.
 *
 * `core/ciclo/vazio-de-recuperar.ts` escolhe a frase do vazio da tela do Motor de Ciclo, e uma
 * das três dizia "fale com o suporte" — suporte que não é lugar nenhum, o mesmo defeito que este
 * arquivo inteiro existe para impedir, na tela que é o botão CENTRAL da barra.
 *
 * O conserto não podia ser chamar `canalDeContato` lá dentro: `core/` é função pura, sem I/O, e o
 * canal sai de `process.env`. Então ela recebe a decisão por parâmetro — que é **exatamente** o
 * desenho de `textoDeMudarDePlano`, o canônico que este teste exercita nos quatro estados.
 *
 * A regra passa a ser: quem escreve a frase ou consulta o canal, ou é um decisor puro declarado
 * aqui — e aí quem CHAMA ele é que precisa consultar. Sem a segunda metade isto seria só um
 * buraco com nome bonito, então cada decisor traz o chamador junto, afirmado logo abaixo.
 */
const DECISORES_PUROS: { arquivo: string; chamadores: string[] }[] = [
  {
    arquivo: join('src', 'core', 'ciclo', 'vazio-de-recuperar.ts'),
    chamadores: [join('src', 'app', 'admin', 'recuperar', 'recuperar.tsx')],
  },
]

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    else if (/\.(ts|tsx)$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

/**
 * Comentário é prosa, não é o que a pessoa lê na tela — e casar com ele já custou três falsos
 * positivos nesta base no mesmo dia. Some com bloco e linha antes de procurar, JSX incluído.
 */
// A limpeza mora em `helpers/fonte` — esta era a última das doze cópias locais da mesma regra.


const TODOS = arquivos(RAIZ)

const COM_CANAL = { whatsapp: '5551999999999', email: null }
const SEM_CANAL = { whatsapp: null, email: null }

describe('canalDeContato', () => {
  it('com WhatsApp configurado, devolve um wa.me com a mensagem já escrita', () => {
    const canal = canalDeContato('Quero subir de plano', COM_CANAL)
    expect(canal).not.toBeNull()
    expect(canal!.href).toMatch(/^https:\/\/wa\.me\/5551999999999\?text=/)
    expect(decodeURIComponent(canal!.href)).toContain('Quero subir de plano')
    expect(canal!.rotulo.length).toBeGreaterThan(0)
  })

  it('sem WhatsApp e com e-mail, cai no mailto com assunto', () => {
    const canal = canalDeContato('Dúvida de cobrança', { whatsapp: null, email: 'ola@exemplo.com.br' })
    expect(canal!.href).toBe(`mailto:ola@exemplo.com.br?subject=${encodeURIComponent('Dúvida de cobrança')}`)
  })

  it('sem nada configurado, devolve null em vez de um link quebrado', () => {
    // O ponto todo: o estado "não configurado" precisa ser DIZÍVEL. Um href vazio ou um `wa.me/`
    // sem número passaria pelo `if (canal)` das telas e desenharia um botão que não vai a lugar
    // nenhum — que é pior que a ausência dele, e é o defeito original com outra roupa.
    expect(canalDeContato('Oi', SEM_CANAL)).toBeNull()
  })

  it('número curto demais não vira canal', () => {
    expect(canalDeContato('Oi', { whatsapp: '123', email: null })).toBeNull()
  })
})

describe('textoDeMudarDePlano', () => {
  it('SEM canal, não convida para uma conversa que não tem onde acontecer', () => {
    for (const noGratis of [true, false]) {
      const texto = textoDeMudarDePlano(noGratis, false)

      /*
       * O conceito, não a redação. `[^\s]*` e não `\w*` pela lição já registrada em
       * `promessa-de-canal`: sem a flag `u`, `\w` é `[A-Za-z0-9_]` e não casa `ç`/`ã` — "conversa"
       * escaparia de qualquer padrão que dependesse de `\w` para pegar "conversação".
       */
      expect(/fal(e|ar|a)\s+com\s+a\s+gente/i.test(texto), `convidou sem canal: "${texto}"`).toBe(false)
      expect(/[ée]\s+s[óo]\s+(chamar|falar|pedir)/i.test(texto), `convidou sem canal: "${texto}"`).toBe(false)
      expect(/(nos|me)\s+chama/i.test(texto), `convidou sem canal: "${texto}"`).toBe(false)

      // E não pode virar silêncio: quem abre "Meu plano" quer saber se aquilo vira cobrança.
      expect(texto.trim().length, 'ficou sem explicação nenhuma').toBeGreaterThan(40)
      expect(/cobran[çc]a autom[áa]tica/i.test(texto), 'sumiu a resposta que a pessoa veio buscar').toBe(true)
    }
  })

  it('COM canal, a frase convida — a guarda não trava copy honesta', () => {
    expect(textoDeMudarDePlano(true, true)).toMatch(/convers/i)
    expect(textoDeMudarDePlano(false, true)).toMatch(/chamar|convers/i)
  })

  it('os quatro casos dizem coisas diferentes', () => {
    // Guarda contra o próprio detector: se alguém colapsar os ramos, as asserções acima podem
    // continuar passando com a função virada decoração.
    const textos = new Set([
      textoDeMudarDePlano(true, true),
      textoDeMudarDePlano(true, false),
      textoDeMudarDePlano(false, true),
      textoDeMudarDePlano(false, false),
    ])
    expect(textos.size).toBe(4)
  })
})

describe('nenhuma tela escreve o convite à mão', () => {
  it('o leitor enxerga a árvore de src/ — não passa por não ter olhado nada', () => {
    expect(TODOS.length).toBeGreaterThan(80)
    expect(TODOS).toContain(CANONICO)
  })

  it('quem escreve "falar com a gente" na tela consulta `canalDeContato`', () => {
    const infratores: string[] = []
    const puros = DECISORES_PUROS.map((d) => d.arquivo)
    for (const arquivo of TODOS) {
      if (arquivo === CANONICO || puros.includes(arquivo)) continue
      const src = semComentarios(readFileSync(arquivo, 'utf8'))
      if (!/fal(e|ar|a)\s+com\s+a\s+gente/i.test(src)) continue
      // Casa com a CHAMADA, não com o import: `canalDeContato` solto casaria com a linha de
      // `import` de um arquivo que importou e nunca usou.
      if (!/canalDeContato\s*\(/.test(src)) infratores.push(arquivo)
    }
    expect(
      infratores,
      'a tela promete conversa sem perguntar se existe canal. Use `canalDeContato` de `@/lib/contato`.',
    ).toEqual([])
  })

  it('as quatro telas que faziam a promessa vazia agora consultam o canal', () => {
    // A de `privacidade` entrou aqui porque a varredura acima a encontrou — eu tinha achado três
    // lendo o código, e ela é justamente a mais cara: é o parágrafo dos direitos da LGPD.
    for (const tela of [
      'src/app/(public)/precos/page.tsx',
      'src/app/(public)/termos/page.tsx',
      'src/app/(public)/privacidade/page.tsx',
      'src/app/admin/config/meu-plano/page.tsx',
    ]) {
      expect(/canalDeContato\s*\(/.test(readFileSync(tela, 'utf8')), `${tela} não consulta o canal`).toBe(true)
    }
  })
})

/**
 * A outra metade da isenção acima. Sem isto, `DECISORES_PUROS` seria o lugar mais barato de calar
 * a guarda: bastaria pôr um arquivo na lista para a frase voltar a nascer sem canal nenhum.
 */
describe('o decisor puro isenta o arquivo, não a regra', () => {
  it.each(DECISORES_PUROS)('$arquivo recebe a decisão em vez de inventá-la', ({ arquivo }) => {
    const src = semComentarios(readFileSync(arquivo, 'utf8'))

    // Piso: se o arquivo parar de escrever a frase, a isenção virou letra morta e tem que sair
    // da lista — decisor que não decide nada não precisa de exceção.
    expect(
      /fal(e|ar|a)\s+com\s+a\s+gente/i.test(src),
      `${arquivo} não escreve mais o convite — tire-o de DECISORES_PUROS`,
    ).toBe(true)

    /*
     * O que faz dele um decisor: a frase é CONDICIONADA ao parâmetro, não escrita sempre.
     *
     * **A primeira versão disto casava só com `temCanalDeContato`, e era cega.** Tirei o
     * condicional do arquivo — deixando o convite incondicional, que é o defeito exato — e a
     * guarda passou verde, porque o identificador continua existindo na ASSINATURA da função. Foi
     * a armadilha nº 1 da tabela do CLAUDE.md outra vez: casar com um nome que o arquivo contém
     * por outro motivo.
     */
    expect(
      /temCanalDeContato\s*(?:\?|&&)/.test(src),
      `${arquivo} escreve o convite sem depender de haver canal. Receber o parâmetro não basta — ` +
        'a frase precisa depender dele.',
    ).toBe(true)
  })

  it.each(DECISORES_PUROS.flatMap((d) => d.chamadores.map((c) => ({ arquivo: d.arquivo, chamador: c }))))(
    '$chamador (que usa $arquivo) é quem consulta o canal',
    ({ chamador }) => {
      const src = readFileSync(chamador, 'utf8')
      expect(
        /canalDeContato\s*\(/.test(src),
        `${chamador} usa um decisor puro e não pergunta se existe canal — a decisão chega errada ` +
          'e a frase convida para uma conversa que não tem onde acontecer.',
      ).toBe(true)
    },
  )

  it('a lista de decisores puros é uma só, e nomeada', () => {
    // Afirmar a lista inteira obriga quem acrescentar um nome a mexer aqui e escrever o porquê.
    expect(DECISORES_PUROS.map((d) => d.arquivo)).toEqual([join('src', 'core', 'ciclo', 'vazio-de-recuperar.ts')])
  })
})

/**
 * E a prova de comportamento, no mesmo desenho do bloco de `textoDeMudarDePlano` lá em cima:
 * varredura de fonte prova a FORMA, chamar a função prova o RESULTADO. As duas juntas porque a
 * varredura sozinha já foi burlada uma vez nesta guarda — o identificador sobrevive na assinatura
 * mesmo com o condicional apagado.
 */
describe('o vazio do Motor de Ciclo não convida sem ter para onde', () => {
  const SEM_CICLOS = { temClientes: true, temCiclos: false, temAtendimentos: true }

  it('SEM canal, não manda falar com ninguém', () => {
    const v = vazioDeRecuperar(SEM_CICLOS.temClientes, SEM_CICLOS.temCiclos, SEM_CICLOS.temAtendimentos, false)
    expect(/fal(e|ar|a)\s+com\s+a\s+gente/i.test(v.descricao), `convidou sem canal: "${v.descricao}"`).toBe(false)
    expect(/suporte/i.test(v.descricao), 'mandou falar com o suporte, que não é lugar nenhum').toBe(false)

    // E não pode virar silêncio: quem abre a tela precisa entender por que ela está vazia.
    expect(v.descricao.trim().length, 'ficou sem explicação nenhuma').toBeGreaterThan(60)
    expect(v.acaoHref, 'tela vazia sem saída é beco sem saída').toBe('/admin/clientes')
  })

  it('COM canal, convida — a guarda não trava copy honesta', () => {
    const v = vazioDeRecuperar(SEM_CICLOS.temClientes, SEM_CICLOS.temCiclos, SEM_CICLOS.temAtendimentos, true)
    expect(/fal(e|ar|a)\s+com\s+a\s+gente/i.test(v.descricao)).toBe(true)
  })

  it('os dois estados dizem coisas diferentes', () => {
    // Guarda contra o próprio detector: se alguém colapsar os ramos, as duas asserções acima
    // continuariam passando com a função virada decoração.
    const sem = vazioDeRecuperar(true, false, true, false).descricao
    const com = vazioDeRecuperar(true, false, true, true).descricao
    expect(sem).not.toBe(com)
    // O ramo sem canal é PREFIXO do outro: a explicação é a mesma, só o convite entra ou não.
    expect(com.startsWith(sem)).toBe(true)
  })
})
