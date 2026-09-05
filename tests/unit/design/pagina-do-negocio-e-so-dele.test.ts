import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * A guarda do veto registrado em `docs/DECISOES.md` (2026-09-05) e medido em
 * `docs/43-POSICIONAMENTO-10X.md` §2 e §5.2.
 *
 * **Por que isto é teste e não só documento.** A pesquisa de mercado mediu que a queixa nº 1 dos
 * donos sobre o líder do nicho é o app do cliente mostrar a lista de concorrentes para a clientela
 * deles — e que os líderes não podem consertar, porque o app do cliente só tem valor de rede
 * porque agrega várias barbearias. O CICLO está do lado certo por ARQUITETURA: não existe rota que
 * liste tenants para o público. Isso é um ativo que ninguém defende, porque não parece uma coisa —
 * é a ausência de uma coisa. E toda análise futura de "faltam efeitos de rede no CICLO" vai propor
 * um diretório de estabelecimentos, que parece grátis e custa o único diferencial estrutural.
 *
 * Um documento não reprova ninguém. Este arquivo reprova.
 *
 * A home diz, em prosa, que quem marca não esbarra em concorrente (`src/app/page.tsx`, cartão
 * "Sua página, sua clientela"). Enquanto essa frase estiver lá, ela precisa de lastro conferível —
 * é a mesma regra do `home-nao-promete-demais`, aplicada à afirmação nova.
 */

const PUBLICO = 'src/app/(public)'

/**
 * As rotas públicas que existem hoje, conferidas uma a uma. Cada uma serve UM negócio (`[slug]`)
 * ou UM token, ou é página institucional do próprio CICLO.
 *
 * A lista é fechada de propósito, e é o coração da guarda: qualquer segmento novo aqui reprova até
 * alguém escrever o nome dele nesta lista. O trabalho que isso força não é burocracia — é ler o
 * veto antes de publicar uma rota pública nova. Um diretório de estabelecimentos entraria
 * exatamente por aqui, e entraria parecendo inofensivo (`/explorar`, `/perto-de-mim`,
 * `/barbearias`).
 */
const SEGMENTOS_PUBLICOS_CONHECIDOS = new Set([
  '[slug]', // a página de UM negócio — o diferencial em si
  'avaliar', // token de avaliação de um atendimento
  'confirmar', // token de confirmação de um agendamento
  'lista-espera', // token da fila de espera
  'orcamento', // token de um orçamento
  'precos', // institucional do CICLO
  'privacidade', // institucional do CICLO
  'termos', // institucional do CICLO
])

/** Consulta a `tenants` que devolve UM negócio. Qualquer uma destas é escopo, não listagem. */
const ESCOPADA = [/\.eq\(\s*['"`](id|slug)['"`]/, /\.single\(\)/, /\.maybeSingle\(\)/]

/**
 * A cadeia que sai de UM `.from('tenants')`, e não o arquivo inteiro.
 *
 * **Esta função existe por um ponto cego medido, não por capricho.** A primeira versão da guarda
 * procurava as marcas de escopo no arquivo todo; mutei-a com uma página que listava todos os
 * tenants E consultava um só logo abaixo, e ela passou verde com o defeito na tela — o
 * `.single()` da segunda consulta absolvia a primeira. Guarda de varredura que casa no arquivo
 * inteiro sempre tem essa forma de cegueira.
 *
 * A janela vai do `.from` até o fim da linha, seguindo para as próximas só enquanto elas
 * continuarem a cadeia (começam com `.` ou `)`). É o recorte que separa duas consultas vizinhas.
 */
function cadeiaApos(fonte: string, indice: number): string {
  const linhas = fonte.slice(indice).split('\n')
  const cadeia = [linhas[0]]
  for (const linha of linhas.slice(1)) {
    if (!/^\s*[.)]/.test(linha)) break
    cadeia.push(linha)
  }
  return cadeia.join('\n')
}

function consultasATenants(fonte: string): string[] {
  const alvo = /\.from\(\s*['"`]tenants['"`]\s*\)/g
  const saida: string[] = []
  for (const achado of fonte.matchAll(alvo)) saida.push(cadeiaApos(fonte, achado.index))
  return saida
}

function arquivosDe(dir: string): string[] {
  const saida: string[] = []
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) saida.push(...arquivosDe(caminho))
    else if (/\.tsx?$/.test(nome)) saida.push(caminho)
  }
  return saida
}

describe('nenhuma rota pública lista estabelecimentos', () => {
  it('não existe segmento público fora da lista conferida', () => {
    const segmentos = readdirSync(PUBLICO).filter((n) => statSync(join(PUBLICO, n)).isDirectory())
    const novos = segmentos.filter((s) => !SEGMENTOS_PUBLICOS_CONHECIDOS.has(s))

    expect(
      novos,
      `rota pública nova em ${PUBLICO}: ${novos.join(', ')}. Se ela serve UM negócio ou é ` +
        `institucional, some o nome à lista deste teste. Se ela LISTA estabelecimentos para o ` +
        `cliente final, ela é o veto de docs/DECISOES.md (2026-09-05) — leia docs/43 §5.2 antes.`,
    ).toEqual([])
  })

  it('nenhuma página pública consulta `tenants` sem escopar em um só', () => {
    /*
     * A varredura olha onde o defeito moraria de verdade: uma página pública que busca vários
     * tenants para renderizar. Rotas de cron e o `sitemap.ts` também leem a tabela inteira e são
     * legítimas — nenhuma das duas está sob `(public)`, então ficam naturalmente fora, sem
     * precisar de exceção escrita à mão (exceção escrita à mão é onde guarda começa a mentir).
     */
    const ofensores = arquivosDe(PUBLICO)
      .map((caminho) => ({ caminho, consultas: consultasATenants(readFileSync(caminho, 'utf8')) }))
      .filter(({ consultas }) => consultas.some((c) => !ESCOPADA.some((p) => p.test(c))))
      .map(({ caminho }) => caminho)

    expect(
      ofensores,
      `página pública lendo vários tenants: ${ofensores.join(', ')}. Página pública serve UM ` +
        `negócio — ver docs/43 §3.`,
    ).toEqual([])
  })

  it('o sitemap entrega a página do negócio, não uma vitrine central', () => {
    /*
     * O outro jeito de o tráfego migrar do negócio para a plataforma, e mais silencioso que uma
     * rota nova: o sitemap apontando o buscador para uma listagem em vez de para `/{slug}`. Hoje
     * ele mapeia cada tenant para a página dele — este teste trava esse formato.
     */
    const fonte = readFileSync('src/app/sitemap.ts', 'utf8')
    expect(
      /url:\s*`\$\{base\}\/\$\{t\.slug\}`/.test(fonte),
      'sitemap.ts deixou de mapear cada tenant para a própria página (`${base}/${t.slug}`) — ver docs/43 §3',
    ).toBe(true)
  })
})
