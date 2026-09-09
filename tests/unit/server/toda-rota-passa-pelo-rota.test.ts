import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * `rota()` não é açúcar de organização — é onde moram quatro defesas que ninguém lembra de
 * escrever à mão:
 *
 * 1. teto global de 120/min por IP;
 * 2. conferência de `Origin` em todo método mutante (a segunda camada de CSRF);
 * 3. o envelope de erro, que **prende** `INTERNAL` na mensagem canônica — é o que impede o texto
 *    de uma exceção do Postgres (nome de tabela, de constraint, e o valor que colidiu num erro de
 *    unicidade) de sair na resposta;
 * 4. `request_id` e log estruturado sem PII.
 *
 * Quem escreve a própria `Response` fica fora das quatro de uma vez, e **em silêncio** — nada
 * quebra, os testes passam, e a rota simplesmente não tem as defesas que todas as outras têm.
 *
 * Isto não é hipótese. Na auditoria de 01/09/2026, `/api/health` era a única rota fora do `rota()`
 * — e era a única com vazamento: cinco checagens devolviam `error.message` cru do Postgres num
 * endpoint que responde sem autenticação, e sem teto de taxa nenhum. O defeito não foi descuido
 * pontual; foi a consequência previsível de estar fora da maquinaria compartilhada.
 *
 * A guarda existe para que a PRÓXIMA rota fora do `rota()` seja uma decisão escrita, não um
 * esquecimento. Entrar na lista custa escrever o motivo — e o motivo é lido por quem revisa.
 */

/** Rotas que legitimamente montam a própria resposta. Entrar aqui exige motivo escrito. */
const FORA_DO_ROTA: { arquivo: string; porque: string }[] = [
  {
    arquivo: 'src/app/api/health/route.ts',
    porque:
      'Monitor de uptime externo espera 200/503 no corpo cru, sem o envelope `{data,meta}` do ' +
      '`rota()`. Tem teto próprio (30/min por IP) e não devolve erro do banco — ver S8 no docs/36.',
  },
]

/**
 * `git ls-files` em vez de varrer o disco: pega só o que está versionado, sem `node_modules`.
 *
 * O `existsSync` no fim não é zelo — o `git ls-files` lista arquivo que já **saiu do disco** mas
 * segue no índice, o que acontece no meio de merge, rebase e `git rm --cached`. Sem o filtro, o
 * `readFileSync` abaixo estoura `ENOENT` e a guarda reprova com uma mensagem sobre arquivo faltando
 * em vez da que ela existe para dar. Achado mutando a própria guarda.
 */
function rotasVersionadas(): string[] {
  return execSync('git ls-files "src/app/api/**/route.ts"', { encoding: 'utf8' })
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((caminho) => existsSync(caminho))
}

/**
 * Casa com a **atribuição** (`= rota(`), não com o nome `rota` solto: o nome aparece na linha de
 * `import` de todo arquivo, e casar com ele aprovaria uma rota que importa e não usa — a
 * armadilha nº1 da tabela do CLAUDE.md.
 */
function passaPeloRota(caminho: string): boolean {
  return /=\s*rota\(/.test(readFileSync(caminho, 'utf8'))
}

describe('toda rota da API passa pelo `rota()`', () => {
  it('a lista de isentas é uma só, e cada uma ainda precisa da isenção', () => {
    /*
     * A lista é onde a guarda morre barato: um nome a mais, e aquela rota perde as quatro defesas
     * do `rota()` sem nada ficar vermelho. Afirmar a lista inteira obriga quem acrescentar a
     * escrever o motivo — que é o que o cabeçalho promete.
     */
    expect(FORA_DO_ROTA.map((f) => f.arquivo)).toEqual(['src/app/api/health/route.ts'])
    for (const { arquivo, porque } of FORA_DO_ROTA) {
      expect(porque.length, `${arquivo} está isenta sem motivo escrito`).toBeGreaterThan(40)
      expect(
        passaPeloRota(arquivo),
        `${arquivo} passou a usar o \`rota()\` — tire-a da lista, senão a isenção protege o que já está certo`,
      ).toBe(false)
    }
  })

  it('o leitor enxerga as rotas — senão a guarda passa vazia', () => {
    const rotas = rotasVersionadas()
    // Se o glob parar de casar, isto grita em vez de aprovar tudo.
    expect(rotas.length).toBeGreaterThan(80)
    expect(rotas).toContain('src/app/api/health/route.ts')
  })

  it('nenhuma rota monta a própria resposta fora da lista justificada', () => {
    const justificadas = new Set(FORA_DO_ROTA.map((j) => j.arquivo))
    const fora = rotasVersionadas().filter((r) => !passaPeloRota(r) && !justificadas.has(r))

    expect(
      fora,
      'Rota fora do `rota()` perde de uma vez: teto por IP, conferência de Origin, o envelope que ' +
        'prende `INTERNAL` na mensagem canônica, e o log com request_id. Nada disso quebra visivelmente ' +
        'quando falta — foi assim que o /health passou meses ecoando erro cru do Postgres. Use `rota()`, ' +
        'ou entre em FORA_DO_ROTA com o motivo escrito.',
    ).toEqual([])
  })

  it('a lista não guarda entrada obsoleta — rota que voltou ao `rota()` sai daqui', () => {
    for (const { arquivo } of FORA_DO_ROTA) {
      const rotas = rotasVersionadas()
      expect(rotas, `${arquivo} está na lista e não existe mais`).toContain(arquivo)
      expect(passaPeloRota(arquivo), `${arquivo} já usa \`rota()\` — tire da lista`).toBe(false)
    }
  })

  it('toda justificativa tem motivo escrito, não só o caminho', () => {
    for (const { arquivo, porque } of FORA_DO_ROTA) {
      expect(porque.length, `${arquivo} entrou na lista sem motivo`).toBeGreaterThan(40)
    }
  })
})
