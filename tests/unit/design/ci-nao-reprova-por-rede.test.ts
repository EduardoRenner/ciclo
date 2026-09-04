import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * `pnpm audit` consulta o registro do npm, e em 03 e 04/09 ele reprovou TRÊS PRs com
 * `ERR_SOCKET_TIMEOUT` — depois de a chamada anterior já ter impresso "No known vulnerabilities
 * found". Timeout de rede não é vulnerabilidade, e vermelho por rede instável ensina a ignorar a
 * CI: é o mesmo estrago do alarme permanentemente aceso que `src/core/cron/agendadas.ts` descreve.
 *
 * O passo passou a classificar a saída em vez de olhar só o código de retorno. E a **ORDEM** das
 * duas perguntas é o que esta guarda existe para proteger, porque a primeira versão errou nela:
 * perguntando "é erro de rede?" antes, uma vulnerabilidade num pacote cujo NOME contém "network"
 * era engolida como problema de transporte. Medido — o caso reprovou o próprio conserto antes de
 * ele subir.
 *
 * Perguntar "achou vulnerabilidade?" primeiro faz o achado sempre vencer, e nenhum texto de erro
 * de rede consegue se disfarçar de relatório.
 */
const CI = join('.github', 'workflows', 'ci.yml')

/**
 * Linha inteira de comentário sai antes de casar — e esta função existe porque a guarda nasceu
 * cega. O comentário do passo cita `ERR_SOCKET_TIMEOUT` em prosa ANTES de o código citar, então a
 * asserção de ordem comparava a explicação com o código e reprovava um passo que estava certo.
 *
 * É a terceira vez no mesmo dia que uma guarda desta base casa com o próprio comentário. O padrão
 * é estável: quanto melhor o comentário explica o código, mais fielmente ele reproduz o texto que
 * a guarda procura.
 */
function semComentariosDeYaml(texto: string): string {
  return texto
    .split('\n')
    .filter((linha) => !/^\s*#/.test(linha))
    .join('\n')
}

function passoDoAudit(): string {
  const yml = semComentariosDeYaml(readFileSync(CI, 'utf8'))
  const inicio = yml.indexOf('- name: Dependência com vulnerabilidade conhecida')
  if (inicio === -1) throw new Error('passo do `pnpm audit` sumiu do ci.yml — a guarda perdeu o alvo')
  // Delimita pelo PRÓXIMO passo, não por janela de caracteres: o vizinho cairia dentro de uma
  // janela fixa e a guarda casaria pelo motivo errado.
  const resto = yml.slice(inicio + 1)
  const proximo = resto.search(/\n {6}- name:/)
  return proximo === -1 ? resto : resto.slice(0, proximo)
}

describe('a CI não reprova por rede instável', () => {
  it('classifica a saída do audit em vez de confiar só no código de retorno', () => {
    expect(passoDoAudit()).toMatch(/ERR_SOCKET_TIMEOUT/)
  })

  it('pergunta "achou vulnerabilidade?" ANTES de "foi erro de rede?"', () => {
    const passo = passoDoAudit()
    const vuln = passo.search(/vulnerabilit/i)
    const rede = passo.search(/ERR_SOCKET_TIMEOUT/)
    expect(vuln).toBeGreaterThan(-1)
    expect(rede).toBeGreaterThan(-1)
    expect(
      vuln,
      'a checagem de vulnerabilidade tem que vir primeiro — invertida, um pacote chamado "network-qualquer-coisa" com falha alta é engolido como problema de rede',
    ).toBeLessThan(rede)
  })

  it('falha que não sabe classificar continua reprovando', () => {
    // O padrão seguro é reprovar. Sem este ramo, qualquer erro novo do audit viraria verde.
    expect(passoDoAudit()).toMatch(/não sabe classificar/)
  })

  it('o aviso diz que pular NÃO significa dependência limpa', () => {
    // Um "::warning::" que soasse como aprovação seria o falso verde com outro nome.
    expect(passoDoAudit()).toMatch(/NÃO é sinal de dependência limpa/)
  })
})
