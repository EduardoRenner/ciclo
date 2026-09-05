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
 *   3. **ele assere o corpo e reprova** — um passo que só faz `curl` e ignora o corpo passa verde
 *      para sempre, que é o defeito original com outro disfarce;
 *   4. **ele lê o VEREDITO, não uma lista de chaves** — acrescentado em 05/09/2026, quando se
 *      mediu que o passo lia duas das dez checagens de `verificarSaude`. As outras oito não tinham
 *      leitor nenhum: podiam ficar vermelhas seis vezes por dia com o job verde.
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

  it('trata chave ausente como falha em TODA leitura, não como aprovação', () => {
    // `jq -r '.x.ok'` devolve a string "null" quando a chave não existe, e `"null" != "true"`
    // já reprovaria — mas isso é acidente de shell, não decisão. O `// false` torna explícito
    // que formato inesperado do endpoint reprova, e sobrevive a alguém trocar o parser.
    //
    // Esta asserção contava `2` até 05/09/2026, e a terceira leitura (o `ok` geral) a fez reprovar
    // — corretamente, porque a guarda não sabia se a leitura nova tinha o padrão. Trocar o número
    // por `3` deixaria a quarta na mesma situação. Então o enunciado passou a ser a PERGUNTA:
    // *toda* variável que sai de um `jq -r` cai para `false` quando a chave falta.
    const leituras = [...blocoDoVigia().matchAll(/(\w+)=\$\([^)]*jq -r '([^']+)'/g)]
    expect(leituras.length, 'nenhuma leitura de jq encontrada — o passo mudou de forma?').toBeGreaterThanOrEqual(3)
    const semRede = leituras.filter(([, , programa]) => !/\/\/\s*false/.test(programa!)).map(([, nome]) => nome)
    expect(semRede, 'estas leituras aprovam quando a chave não existe').toEqual([])
  })

  it('lê o veredito geral, não só as duas chaves que alguém lembrou de listar', () => {
    // A metade que faltava, e a mais cara: `verificarSaude` calcula um `ok` sobre DEZ checagens, e
    // até 05/09 este passo lia duas. As outras oito podiam ficar falsas seis vezes por dia com o
    // job verde — inclusive a de schema, criada no mesmo dia para gritar quando o banco está atrás
    // do código. Ler o veredito em vez de listar chaves é o que impede a próxima de nascer muda.
    expect(blocoDoVigia()).toMatch(/jq -r '\.ok \/\/ false'/)
  })
})
