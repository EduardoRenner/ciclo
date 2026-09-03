import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { CATALOGO, type ModuloKey } from '@/core/billing/planos'

import { semComentarios } from '../../helpers/fonte'

/**
 * O irmão de `recurso-pago-avisa-antes.test.ts`, e a razão de ele não ter bastado.
 *
 * Aquela guarda diz a coisa certa: tela cujo botão depende de módulo de plano tem que avisar ANTES
 * do toque, porque descobrir que o recurso é pago depois de preencher o formulário é trabalho
 * jogado fora. Só que a lista dela é **escrita à mão e tinha uma linha** (`estoque`), enquanto o
 * projeto tinha NOVE módulos com rota de escrita travada. Oito ficaram sem vigia, e cinco delas
 * estavam com o defeito no ar em 2026-09-03:
 *
 *   - `/admin/campanhas` → montava a campanha inteira e a rota recusava o envio;
 *   - `/admin/orcamentos` → o mesmo, com o orçamento montado;
 *   - `/admin/agenda/novo` → "Repetir este horário" desviava o envio para a rota de série, e o
 *     agendamento simples (que é grátis) não era criado junto;
 *   - `/admin/comanda/[id]` → "Adicionar" item recusado com o cliente na frente;
 *   - `/admin/config/planos` → a config de fidelidade inteira, recusada no Salvar;
 *   - `/admin/config/profissionais/[id]` → cada toque no expediente voltava atrás.
 *
 * A lição é a mesma de `consertar a pergunta, não o caso`: uma guarda que enumera casos protege os
 * casos que alguém lembrou de escrever. Esta enumera a **fonte da verdade** — toda chamada de
 * `exigirModulo` nas rotas — e exige que cada módulo encontrado tenha uma decisão declarada aqui.
 * Rota nova com módulo novo quebra este teste até alguém dizer qual tela avisa.
 */

const ROTAS = join('src', 'app', 'api')
const RAIZ_TELAS = 'src'

/**
 * Onde cada módulo com rota de escrita é oferecido na interface, e onde o aviso tem que estar.
 *
 * `telas` são PASTAS: basta que algum `.tsx` dentro dela consulte `podeUsarModulo`. É a pasta, e
 * não o arquivo, porque o padrão da casa é o Server Component decidir e passar a resposta como
 * prop para o componente cliente (`podeLancar`, `podeRepetir`, `podeOrcamento`, `podeLancarItem`).
 * Casar com o nome da prop seria casar com a redação; casar com a chamada casa com a decisão.
 */
const ONDE_AVISA: Record<ModuloKey, { telas: string[]; isento?: string }> = {
  stock: { telas: ['src/app/admin/estoque'] },
  campaigns: { telas: ['src/app/admin/campanhas'] },
  quotes: { telas: ['src/app/admin/orcamentos', 'src/app/admin/clientes/[id]'] },
  recurrence: { telas: ['src/app/admin/agenda/novo'] },
  register: { telas: ['src/app/admin/comanda/[id]'] },
  loyalty: { telas: ['src/app/admin/config/planos', 'src/app/admin/clientes/[id]'] },
  team: { telas: ['src/app/admin/config/profissionais/[id]'] },

  health_records: {
    telas: [],
    // A rota travada é de LEITURA (`GET /clients/[id]/vault`), e `saude.tsx` mostra a mensagem que
    // ela devolve dentro do próprio Sheet. Ninguém preenche nada antes, então não há trabalho a
    // perder — o aviso depois do toque é honesto aqui.
    isento: 'rota de leitura; a tela exibe a mensagem da rota e nenhum trabalho é descartado',
  },
  assistant: {
    telas: [],
    // `assistant` nasce no Grátis (`PROPRIOS.gratis`), então `podeUsarModulo` nunca devolve
    // `bloqueado_pelo_plano` para ele. O `exigirModulo` da rota é defesa em profundidade, e o
    // filtro por plano das FERRAMENTAS já acontece antes do pedido ao modelo (`assistente.ts`).
    isento: 'liberado em todo degrau; a rota trava por defesa, não por comércio',
  },

  // Sem rota de escrita travada hoje. Ficam declarados para que a checagem de cobertura abaixo
  // possa exigir que o mapa cubra o catálogo inteiro — módulo novo entra aqui na hora de nascer.
  agenda: { telas: [], isento: 'sempre ligado, em todo degrau' },
  cycle_engine: { telas: [], isento: 'sempre ligado, em todo degrau' },
  public_page: { telas: [], isento: 'liberado desde o Grátis' },
  clients: { telas: [], isento: 'liberado desde o Grátis' },
  reminders: { telas: [], isento: 'liberado desde o Grátis' },
  routing: { telas: [], isento: 'condicionado por eixo, sem rota de escrita travada' },
  club: { telas: [], isento: 'sem rota de escrita travada por módulo' },
  documents: { telas: [], isento: 'sem rota de escrita travada por módulo' },
}

function arquivos(dir: string, ext: RegExp): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho, ext))
    else if (ext.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

const barras = (p: string) => p.split(String.fromCharCode(92)).join('/')

/** Os módulos que alguma rota exige de fato. A fonte da verdade, lida do código. */
function modulosExigidosPelasRotas(): Map<ModuloKey, string[]> {
  const mapa = new Map<ModuloKey, string[]>()
  for (const arquivo of arquivos(ROTAS, /route[.]ts$/)) {
    const fonte = semComentarios(readFileSync(arquivo, 'utf8'))
    for (const m of fonte.matchAll(/exigirModulo\([^)]*?['"]([a-z_]+)['"]\s*\)/g)) {
      const chave = m[1] as ModuloKey
      mapa.set(chave, [...(mapa.get(chave) ?? []), barras(arquivo)])
    }
  }
  return mapa
}

const EXIGIDOS = modulosExigidosPelasRotas()

const TELAS_QUE_CONSULTAM = new Set(
  arquivos(RAIZ_TELAS, /[.]tsx$/)
    .filter((a) => /podeUsarModulo\s*\(/.test(semComentarios(readFileSync(a, 'utf8'))))
    .map(barras),
)

describe('o leitor deste teste', () => {
  it('acha as rotas travadas de verdade — não passa por não ter lido nada', () => {
    // Se o regex parar de casar, a varredura fica vazia e TODAS as asserções abaixo passam
    // sozinhas. Este piso é a guarda contra o próprio detector.
    expect(EXIGIDOS.size, 'nenhum `exigirModulo` encontrado — o padrão quebrou').toBeGreaterThanOrEqual(7)
    expect([...EXIGIDOS.keys()]).toContain('stock')
    expect(TELAS_QUE_CONSULTAM.size, 'nenhuma tela consulta `podeUsarModulo`').toBeGreaterThanOrEqual(5)
  })

  it('não confunde comentário com código', () => {
    // `semComentarios` some com bloco e linha. Sem isso, um `// exigirModulo(db, x, 'club')` numa
    // explicação registraria um módulo que rota nenhuma exige.
    const fonte = semComentarios("// exigirModulo(db, t, 'club')\nawait exigirModulo(db, t, 'stock')")
    expect(fonte).not.toContain('club')
    expect(fonte).toContain('stock')
  })
})

describe('toda rota travada por módulo tem tela que avisa antes', () => {
  it('todo módulo exigido por alguma rota tem decisão declarada aqui', () => {
    const semDecisao = [...EXIGIDOS.entries()]
      .filter(([chave]) => !(chave in ONDE_AVISA))
      .map(([chave, rotas]) => `${chave} (exigido por ${rotas.join(', ')})`)
    expect(
      semDecisao,
      'rota nova travada por módulo sem decisão em ONDE_AVISA. Diga qual tela avisa antes do ' +
        'toque, ou declare `isento` com o motivo — silêncio aqui vira formulário recusado no envio.',
    ).toEqual([])
  })

  it('o mapa cobre o catálogo inteiro — módulo novo não entra despercebido', () => {
    const faltando = CATALOGO.map((m) => m.key).filter((k) => !(k in ONDE_AVISA))
    expect(faltando, 'módulo novo no CATALOGO sem entrada em ONDE_AVISA').toEqual([])
  })

  it('cada tela declarada realmente consulta `podeUsarModulo`', () => {
    const mudas: string[] = []
    for (const [chave, { telas }] of Object.entries(ONDE_AVISA) as [ModuloKey, { telas: string[] }][]) {
      for (const pasta of telas) {
        const consulta = [...TELAS_QUE_CONSULTAM].some((a) => a.startsWith(`${pasta}/`))
        if (!consulta) mudas.push(`${chave} → ${pasta}`)
      }
    }
    expect(
      mudas,
      'estas telas foram declaradas como o lugar do aviso e não perguntam nada ao plano. ' +
        'Chame `podeUsarModulo` no Server Component e desça a resposta para a tela.',
    ).toEqual([])
  })

  it('módulo com rota travada e sem tela precisa dizer POR QUE é isento', () => {
    // A isenção é a saída de emergência da regra, e saída sem justificativa vira a regra.
    const frouxos = [...EXIGIDOS.keys()]
      .filter((chave) => ONDE_AVISA[chave]?.telas.length === 0)
      .filter((chave) => (ONDE_AVISA[chave]?.isento ?? '').trim().length < 20)
    expect(frouxos, 'isenção sem motivo escrito. Diga por que descobrir depois do toque é aceitável aqui.').toEqual([])
  })

  it('a rota continua travada no servidor — o aviso na tela nunca substitui a trava', () => {
    /*
     * A mesma asserção que `recurso-pago-avisa-antes` faz para o estoque, generalizada: se alguém
     * "simplificar" tirando um `exigirModulo` porque "a tela já avisa", o recurso pago vira
     * sugestão. Os módulos abaixo são os que hoje se pagam; a lista encolher é o sinal.
     */
    for (const chave of ['stock', 'campaigns', 'quotes', 'recurrence', 'register', 'loyalty', 'team'] as const) {
      expect(EXIGIDOS.has(chave), `nenhuma rota exige mais o módulo '${chave}' — a trava sumiu do servidor`).toBe(true)
    }
  })
})
