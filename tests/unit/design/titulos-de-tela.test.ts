import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * As 29 telas de `/admin` herdavam o mesmo `<title>` ("CICLO") porque nenhuma
 * exportava `metadata` — medido em 2026-08-23 (`docs/15-AUDITORIA-DESIGN-UX.md`
 * A1). Isso não é SEO: `/admin` nem é indexável. No App Router a navegação é no
 * cliente, e o `<title>` é o que o leitor de tela anuncia quando a rota troca —
 * com o mesmo texto em todas, quem não enxerga não recebe confirmação nenhuma
 * de que saiu do lugar (WCAG 2.4.2).
 *
 * O teste lê os arquivos de verdade em vez de uma lista copiada: tela nova nasce
 * reprovando até ganhar título, que é a única forma de o defeito não voltar.
 */
/*
 * `(public)` entrou na rodada 4: as quatro telas por token (avaliar, confirmar, lista-espera,
 * orçamento) tinham ficado de fora da primeira correção e voltaram a herdar "CICLO". São as
 * telas que a cliente abre pelo link do WhatsApp — as únicas que muita gente vai ver do produto.
 */
const RAIZES = ['src/app/admin', 'src/app/(auth)', 'src/app/onboarding', 'src/app/(public)']

function paginas(dir: string): string[] {
  const achadas: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achadas.push(...paginas(caminho))
    else if (entrada.name === 'page.tsx') achadas.push(caminho)
  }
  return achadas
}

const TODAS = RAIZES.flatMap(paginas)

describe('título próprio por tela', () => {
  it('encontra as páginas do app do profissional', () => {
    // Guarda contra o teste passar por não ter achado arquivo nenhum.
    expect(TODAS.length).toBeGreaterThanOrEqual(36)
  })

  it.each(TODAS)('%s declara um título', (arquivo) => {
    const src = readFileSync(arquivo, 'utf8')

    // `/admin/page.tsx` é só um `redirect`, não chega a pintar tela nem título.
    if (/^\s*redirect\(/m.test(src) && !/export default async/.test(src)) return

    // `[^}]*?` preguiçoso, não guloso: com `[^}]*` a busca ia até o ÚLTIMO `title:` antes da
    // primeira `}`, o que numa página com `openGraph` capturava o título social em vez do título
    // do documento — e então reprovava por "repete a marca" um título de tela que estava certo.
    // Achado ao criar `/precos`, a primeira página do projeto com openGraph e título próprio.
    const estatico = /export const metadata\s*=\s*\{[^}]*?title:\s*['"]([^'"]+)['"]/.exec(src)
    const dinamico = /export async function generateMetadata/.test(src)

    expect(
      Boolean(estatico?.[1]?.trim()) || dinamico,
      `${arquivo} não exporta metadata.title nem generateMetadata`,
    ).toBe(true)

    // Título que repete a marca cancela o `template` do layout raiz.
    if (estatico?.[1]) expect(estatico[1].toLowerCase()).not.toContain('ciclo')
  })

  it('o layout raiz junta o título da tela à marca', () => {
    const layout = readFileSync('src/app/layout.tsx', 'utf8')
    expect(layout).toMatch(/template:\s*['"]%s · CICLO['"]/)
  })

  /*
   * As RAIZES acima procuram `page.tsx` dentro de quatro pastas, e por isso deixavam de fora a
   * tela que TODO link quebrado do produto entrega — inclusive os que circulam no WhatsApp de
   * cliente de salão. Medido no navegador em 2026-09-03: o `<title>` do 404 era só "CICLO",
   * herdado do `default` do layout, exatamente o defeito que este arquivo existe para pegar.
   */
  it('o 404 declara título próprio — é a tela de todo link quebrado', () => {
    const src = readFileSync('src/app/not-found.tsx', 'utf8')
    const titulo = /export const metadata\s*=\s*\{[^}]*?title:\s*['"]([^'"]+)['"]/.exec(src)
    expect(titulo?.[1]?.trim(), 'src/app/not-found.tsx não declara metadata.title').toBeTruthy()
    // Mesma regra das outras: repetir a marca cancelaria o `template` do layout raiz.
    expect(titulo![1]!.toLowerCase()).not.toContain('ciclo')
  })

  it('`error.tsx` fica de fora, e o motivo é técnico', () => {
    /*
     * Guarda contra alguém "completar" a regra acrescentando `error.tsx` aqui: ele é `'use
     * client'` por exigência do Next, e Client Component não exporta `metadata`. Exigir título
     * dali seria uma guarda impossível de satisfazer — e a saída seria removê-la, levando junto a
     * asserção do 404 que É satisfazível.
     */
    expect(readFileSync('src/app/error.tsx', 'utf8')).toMatch(/^'use client'/)
  })
})

/**
 * O irmão estrutural do bloco acima, e ele nasce de uma medição diferente.
 *
 * `<title>` responde "que página é esta" quando a rota troca. Um HEADING responde "onde estou
 * dentro dela" — e é o que quem usa leitor de tela procura primeiro ao cair numa página
 * desconhecida, saltando de título em título.
 *
 * Medido no navegador em 2026-09-05, com token inválido nas quatro rotas que a cliente do salão
 * abre pelo link do WhatsApp: `document.querySelectorAll('h1,h2,h3')` voltou **vazio nas quatro**.
 * A copy do erro é boa e tem saída ("Chame quem vai te atender pelo WhatsApp"), mas era
 * inalcançável por navegação de títulos — a página inteira era um bloco plano.
 *
 * O padrão certo já existia na casa: as cinco páginas de `(auth)` usam
 * `<h1 className="text-titulo font-bold">`. As públicas usavam `<p>` com a MESMA classe — mesma
 * aparência na tela, estrutura nenhuma na árvore. Foi por isso que ninguém viu.
 */
const TELAS_DE_TOKEN = [
  'src/components/ui/erro-publico.tsx',
  'src/app/(public)/avaliar/[token]/avaliar.tsx',
  'src/app/(public)/confirmar/[token]/confirmar.tsx',
  'src/app/(public)/lista-espera/[token]/reivindicar.tsx',
  'src/app/(public)/orcamento/[token]/orcamento.tsx',
]

/**
 * Sem comentário, e a razão é uma guarda cega que esta própria asserção produziu horas depois de
 * nascer: o `erro-publico.tsx` passou a renderizar `<TituloDeEstado>` em vez de `<h1>` e o teste
 * continuou verde — porque o comentário que EU escrevi lá dentro cita
 * `<h1 className="text-titulo font-bold">` ao explicar o padrão das páginas de `(auth)`.
 *
 * É a linha nº 1 da tabela do `CLAUDE.md`: casar com algo que o arquivo contém por outro motivo.
 * Varrer comentário é o que faz a documentação de uma decisão satisfazer a guarda dessa decisão.
 *
 * **Delega para `helpers/fonte`, e isso também foi aprendido na marra.** A primeira versão daqui
 * era uma limpeza escrita à mão — a SEXTA cópia da mesma regra nesta suíte, feita horas depois de
 * o helper existir, e exatamente o que o docstring dele descreve como o problema que ele veio
 * resolver ("cinco cópias divergentes de uma regra"). As cópias não são equivalentes: várias não
 * tratam `//` nem comentário JSX, cujas linhas internas não começam com `*`.
 */
function marcacao(arquivo: string): string {
  return semComentarios(readFileSync(arquivo, 'utf8'))
}

describe('a tela que a cliente abre pelo WhatsApp tem heading', () => {
  it.each(TELAS_DE_TOKEN)('%s tem pelo menos um heading', (arquivo) => {
    /*
     * `<TituloDeEstado>` conta: ele É um `h1` (e ainda move o foco para si ao aparecer). Aceitar os
     * dois mantém o invariante — "esta tela tem título" — sem obrigar a desfazer o componente
     * compartilhado, que existe justamente para o conserto não voltar a ser um por tela.
     */
    const src = marcacao(arquivo)
    expect(
      /<h1[\s>]/.test(src) || /<TituloDeEstado[\s>]/.test(src),
      `${arquivo} não tem heading nenhum — a tela fica sem estrutura para quem navega por títulos`,
    ).toBe(true)
  })

  it.each(TELAS_DE_TOKEN)('%s não usa <p> como pseudo-título', (arquivo) => {
    /*
     * A asserção que pega a REGRESSÃO, e não só o estado atual: exigir "tem um h1" passaria verde
     * numa tela que ganhasse um h1 e continuasse com três estados desenhados como `<p>` — que é
     * exatamente a forma do defeito original (o `confirmar.tsx` tinha TRÊS).
     *
     * `text-titulo font-bold` é o token visual de título de tela deste design system. Num `<p>`,
     * ele produz uma coisa que parece título e não é.
     */
    /*
     * `marcacao()` aqui pelo mesmo motivo da asserção acima, virado para o outro lado: casar
     * comentário numa asserção de AUSÊNCIA não cega o teste, faz ele acusar a própria explicação
     * do defeito. Ruído em vez de silêncio, mas ruído que treina a ignorar alarme.
     */
    const src = marcacao(arquivo)
    const falsos = [...src.matchAll(/<p className="[^"]*text-titulo font-bold[^"]*"/g)].map((m) => m[0])
    expect(
      falsos,
      `${arquivo} desenha título de tela com <p>: ${falsos.join(', ')}. Use <h1> ou <TituloDeEstado>, como as outras.`,
    ).toEqual([])
  })
})
