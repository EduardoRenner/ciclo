import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * `estado-vazio-tem-saida` cobre o estado VAZIO. Este cobre o de ERRO, nas quatro telas em que
 * quem cai nele não é o dono do salão: é a **cliente dele**, que abriu um link do WhatsApp.
 *
 * As quatro tinham o mesmo desenho e o mesmo defeito, medido no navegador em 2026-09-03: ícone,
 * título, a mensagem da rota, e nada mais. Duas consequências, e as duas caem no salão:
 *
 *   - **link recusado** (4xx): ela lê "esse link não é mais válido", não sabe o que fazer, some.
 *     O horário fica sem confirmação, a avaliação não é deixada, o encaixe vai para outra pessoa,
 *     o orçamento não é respondido — e o salão conclui que ela ignorou a mensagem.
 *   - **rede caída**: uma piscada de 4G levava ao MESMO beco, sem botão nenhum, num caso em que
 *     tentar de novo resolveria. A única saída era ela saber recarregar a página. Em três das
 *     quatro telas a chamada dispara ao ABRIR, então bastava a piscada acontecer no toque do link.
 *
 * **A guarda ITERA a lista, e é esse o ponto.** Eu consertei `/confirmar` primeiro e escrevi um
 * teste só para ela; as outras três continuavam com o defeito. É a armadilha registrada em
 * `recurso-pago-avisa-antes` e no aviso de demonstração — consertar o caso em vez da pergunta.
 * Tela pública nova com estado de erro nasce reprovando aqui até ter saída.
 */

const RAIZ = join('src', 'app', '(public)')

/** Toda tela pública com estado de erro precisa oferecer saída. A lista é DERIVADA, não escrita. */
function telasComEstadoDeErro(): string[] {
  const achadas: string[] = []
  const andar = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, e.name)
      if (e.isDirectory()) andar(caminho)
      else if (/[.]tsx$/.test(e.name)) {
        const fonte = semComentarios(readFileSync(caminho, 'utf8'))
        // Casa com a ESCRITA do estado (`setEstado('erro')`), não com a palavra "erro" solta —
        // que aparece em `mensagemErro`, em `setErro` de formulário e em comentário.
        if (/setEstado\(\s*'erro'\s*\)/.test(fonte)) achadas.push(caminho.split(String.fromCharCode(92)).join('/'))
      }
    }
  }
  andar(RAIZ)
  return achadas
}

const TELAS = telasComEstadoDeErro()

/**
 * "Existe um caminho em que a falha é marcada como transitória" — o CONCEITO, em duas grafias.
 *
 * A primeira versão casava só `setPodeTentarDeNovo(true)` e reprovou `/confirmar`, que expressa a
 * mesma coisa por um auxiliar (`falhou(msg, true)`). Guarda que exige uma grafia obriga quatro
 * telas a escreverem igual para sempre, e a próxima que refatorar fica vermelha sem ter defeito —
 * o custo simétrico da guarda cega, e o mesmo erro que criou `alvo-de-toque-tem-48`.
 *
 * As duas grafias têm autoteste logo abaixo: se uma delas parar de casar, o teste grita em vez de
 * absolver a tela.
 */
const MARCA_TRANSITORIA = /setPodeTentarDeNovo\(\s*true\s*\)|falhou\([^)]*,\s*true\s*\)/

describe('o leitor deste teste', () => {
  it('acha as telas públicas com estado de erro — não passa por não ter olhado nada', () => {
    // Se o padrão parar de casar, a lista fica vazia e TODAS as asserções abaixo passam sozinhas.
    expect(TELAS.length, 'nenhuma tela pública com estado de erro encontrada').toBeGreaterThanOrEqual(4)
    for (const esperada of ['confirmar', 'avaliar', 'lista-espera', 'orcamento']) {
      expect(TELAS.some((t) => t.includes(`/${esperada}/`)), `${esperada} sumiu da varredura`).toBe(true)
    }
  })

  it('não confunde `mensagemErro` com o estado de erro', () => {
    expect(/setEstado\(\s*'erro'\s*\)/.test("const [mensagemErro, setMensagemErro] = useState('')")).toBe(false)
    expect(/setEstado\(\s*'erro'\s*\)/.test("setEstado('erro')")).toBe(true)
  })

  it('reconhece as DUAS grafias de "esta falha é transitória", e nenhuma outra', () => {
    // Autoteste do padrão. Sem isto, uma das duas alternativas podia apodrecer em silêncio e
    // absolver a tela que a usa.
    expect(MARCA_TRANSITORIA.test('setPodeTentarDeNovo(true)'), 'grafia direta').toBe(true)
    expect(MARCA_TRANSITORIA.test("falhou('Não consegui falar com o servidor.', true)"), 'grafia por auxiliar').toBe(true)
    // E o que NÃO pode passar: marcar tudo como definitivo é o defeito original.
    expect(MARCA_TRANSITORIA.test('setPodeTentarDeNovo(false)')).toBe(false)
    expect(MARCA_TRANSITORIA.test("falhou('erro', false)")).toBe(false)
  })
})

describe('toda tela pública com erro oferece saída para a cliente do salão', () => {
  it.each(TELAS)('%s usa o ErroPublico em vez de terminar na mensagem', (tela) => {
    const fonte = semComentarios(readFileSync(tela, 'utf8'))
    /*
     * Casa com o USO (`<ErroPublico`), nunca com o import: importar e não renderizar é exatamente
     * o estado em que a tela fica se alguém "simplificar" o JSX, e a guarda passaria verde.
     */
    expect(
      /<ErroPublico[\s/>]/.test(fonte),
      `${tela} termina o erro na mensagem. Use \`ErroPublico\`, que dá retentativa ou diz o que fazer.`,
    ).toBe(true)
  })

  it.each(TELAS)('%s distingue falha transitória de recusa pelo STATUS', (tela) => {
    const fonte = semComentarios(readFileSync(tela, 'utf8'))
    /*
     * O critério tem que ser o status, não "deu erro". Se tudo virar transitório, a tela oferece
     * "tentar de novo" para um link que o servidor já recusou — botão que só repete o não. Se nada
     * virar, volta o beco da rede, que é o defeito original.
     */
    expect(/r\.status\s*>=\s*500/.test(fonte), `${tela} não olha o status para decidir se dá para repetir`).toBe(true)
    expect(
      MARCA_TRANSITORIA.test(fonte),
      `${tela} nunca marca nenhuma falha como transitória — a queda de rede volta a ser um beco`,
    ).toBe(true)
  })
})

describe('o ErroPublico faz as duas metades', () => {
  const COMPONENTE = 'src/components/ui/erro-publico.tsx'
  const fonte = semComentarios(readFileSync(COMPONENTE, 'utf8'))

  it('com retentativa, mostra o botão', () => {
    expect(/aoTentarDeNovo\s*\?/.test(fonte), 'o componente não ramifica pela retentativa').toBe(true)
    expect(/Tentar de novo/.test(fonte)).toBe(true)
  })

  it('sem retentativa, diz o que fazer em vez de só o que houve', () => {
    /*
     * O conceito, não a redação: a saída aponta para uma PESSOA porque o produto não sabe o slug
     * do salão neste estado (o token foi recusado, não há de onde tirar). Link para lugar nenhum
     * seria pior que uma frase útil.
     */
    const ramoSemBotao = fonte.slice(fonte.indexOf(') : ('))
    expect(/whatsapp|chame|fale/i.test(ramoSemBotao), 'o ramo sem retentativa não diz o que fazer').toBe(true)
  })

  it('os dois ramos são diferentes de verdade', () => {
    // Guarda contra o próprio detector: com os ramos colapsados, as duas asserções acima podem
    // continuar passando e o componente vira decoração.
    expect(fonte.includes(') : (')).toBe(true)
  })
})
