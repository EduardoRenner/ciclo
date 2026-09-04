import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * O job `vigia` do `cron.yml` existe porque **HTTP 200 não é prova de que o trabalho aconteceu**.
 *
 * Em 25 e 26/08 o Motor de Ciclo devolveu `200` com `tenantsProcessados: 0` por dois dias e meio,
 * e o Action ficou verde o tempo todo (`docs/24` §6.5). O `case "$codigo" in 2*)` do job `seguros`
 * só sabe que a rota respondeu. Quem sabe se ela GRAVOU alguma coisa é o heartbeat em
 * `cron_heartbeats`, lido por `/api/health`.
 *
 * Esta guarda protege três propriedades, e cada uma tem um jeito próprio de se perder:
 *
 *   1. **o job existe** — apagar é o modo óbvio;
 *   2. **`needs: seguros`** — sem isso a vigia opina mesmo quando a rota nem respondeu, e vira o
 *      alarme permanentemente vermelho que `src/core/cron/agendadas.ts` proíbe com todas as
 *      letras. Vermelho constante é o mesmo que apagado: no dia do defeito real, nada muda de cor;
 *   3. **ele assere as DUAS chaves e reprova** — um passo que só faz `curl` e ignora o corpo passa
 *      verde para sempre, que é o defeito original com outro disfarce.
 *
 * Casa com o CONTEÚDO do passo, nunca com o nome do job nem com o comentário que o descreve.
 */
const CRON = join('.github', 'workflows', 'cron.yml')

/**
 * Comentário FORA antes de casar — e esta função existe porque a primeira versão desta guarda
 * nasceu cega duas vezes seguidas pelo mesmo motivo.
 *
 * O comentário do job diz, em prosa, "`needs: seguros` de propósito" e "`//false` para chave
 * ausente". Duas das quatro asserções casavam com ESSAS FRASES: apagar o `needs:` de verdade e
 * apagar os dois `// false` de verdade deixava a suíte VERDE nas duas vezes. É a armadilha nº 1
 * da tabela do CLAUDE.md — casar com nome, rótulo ou comentário vizinho em vez do que muda quando
 * o defeito volta —, e ela morde com força extra aqui: quanto melhor o comentário explica o
 * código, mais fielmente ele reproduz o texto que a guarda procura.
 *
 * Só linha INTEIRA de comentário sai. `#` no meio de uma linha não aparece neste bloco (nem no
 * YAML nem no shell dele), e recortar por qualquer `#` arriscaria comer conteúdo de verdade.
 */
function semComentariosDeYaml(texto: string): string {
  return texto
    .split('\n')
    .filter((linha) => !/^\s*#/.test(linha))
    .join('\n')
}

function blocoDoVigia(): string {
  const yml = readFileSync(CRON, 'utf8')
  const inicio = yml.indexOf('\n  vigia:')
  if (inicio === -1) {
    throw new Error('job `vigia` sumiu do cron.yml — HTTP 200 volta a ser aceito como prova de execução')
  }
  // Delimita pelo PRÓXIMO job (dois espaços + nome + dois-pontos), não por contagem de caracteres:
  // janela fixa deixaria o job vizinho cair dentro e a guarda casaria com o texto errado.
  const resto = yml.slice(inicio + 1)
  const proximo = resto.slice(1).search(/\n {2}[a-z_]+:\n/)
  const bloco = proximo === -1 ? resto : resto.slice(0, proximo + 1)
  return semComentariosDeYaml(bloco)
}

describe('a vigia do cron confere se o trabalho aconteceu', () => {
  it('depende de `seguros`, para não virar alarme permanente', () => {
    expect(blocoDoVigia()).toMatch(/needs:\s*seguros/)
  })

  it('lê /api/health e assere as duas chaves de heartbeat', () => {
    const bloco = blocoDoVigia()
    expect(bloco).toMatch(/\/api\/health/)
    expect(bloco).toMatch(/recomputeCycles\.ok/)
    expect(bloco).toMatch(/recomputeSegments\.ok/)
  })

  it('reprova o job quando o heartbeat não confirma (não só imprime)', () => {
    const bloco = blocoDoVigia()
    // `exit 1` é o que transforma "descobri o problema" em "alguém fica sabendo". Sem ele o passo
    // imprime o erro e o Action segue verde — que é literalmente o defeito que a vigia existe
    // para pegar, reproduzido dentro dela.
    expect(bloco).toMatch(/exit 1/)
    expect(bloco).toMatch(/::error::/)
  })

  it('trata chave ausente como falha nas DUAS leituras, não como aprovação', () => {
    // `jq -r '.x.ok'` devolve a string "null" quando a chave não existe, e `"null" != "true"`
    // já reprovaria — mas isso é acidente de shell, não decisão. O `// false` torna explícito
    // que formato inesperado do endpoint reprova, e sobrevive a alguém trocar o parser.
    //
    // CONTA as ocorrências em vez de perguntar se existe: são duas leituras (ciclos e segmentos),
    // e "existe pelo menos uma" aprovava com metade do padrão apagada — medido na mutação.
    const quantas = blocoDoVigia().match(/\/\/\s*false/g) ?? []
    expect(quantas).toHaveLength(2)
  })
})
