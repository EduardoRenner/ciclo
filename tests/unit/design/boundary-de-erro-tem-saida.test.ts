import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * O terceiro da família, e o que faltava.
 *
 *   - `estado-vazio-tem-saida` cobre a tela VAZIA;
 *   - `erro-do-cliente-tem-saida` cobre o estado de erro das quatro telas públicas por token;
 *   - **este cobre os `error.tsx`** — os boundaries que pegam o que ninguém previu, em qualquer
 *     rota do produto.
 *
 * **Por que ele existe.** Em 2026-09-03 o Eduardo caiu no boundary do `/admin` e descreveu como
 * *"ficou tudo travado e nem tem como sair"*. O arquivo tinha UMA ação — "Tentar de novo" — e o
 * comentário dele dizia que a saída era a navegação lateral, que "continua de pé". Continua mesmo:
 * a intenção estava certa e a pessoa ficou presa assim mesmo, porque saída implícita não é saída,
 * e porque `reset()` re-renderiza com o mesmo estado quebrado.
 *
 * O boundary da RAIZ já fazia certo — ação **e** link, com comentário explicando que o destino
 * depende de onde o erro aconteceu. O do `/admin` sombreia aquele em toda rota do painel e não
 * seguia a mesma regra. Boundary novo nasce reprovando aqui até ter as duas coisas.
 *
 * **A lista é DERIVADA**, não escrita à mão: `error.tsx` e `global-error.tsx` em qualquer lugar de
 * `src/app`. É a lição de `consertar-a-pergunta-nao-o-caso` — foi enumerar casos que deixou o
 * boundary do painel de fora por meses.
 */

const RAIZ = 'src/app'

function boundaries(): string[] {
  const achados: string[] = []
  const andar = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, e.name)
      if (e.isDirectory()) andar(caminho)
      else if (/^(error|global-error)[.]tsx$/.test(e.name)) achados.push(caminho.split(String.fromCharCode(92)).join('/'))
    }
  }
  andar(RAIZ)
  return achados
}

const BOUNDARIES = boundaries()

/**
 * "Existe uma saída para outra tela" — navegação, em qualquer das formas que o projeto usa.
 *
 * `<a href=` é a forma preferida nos boundaries, e de propósito: navegação de página inteira é a
 * única que descarta o estado de cliente quebrado. `<Link` conta porque um boundary pode ter razão
 * para preferir navegação de cliente; o que NÃO conta é não ter nada.
 */
const TEM_SAIDA = /<a\s[^>]*href=|<Link\s[^>]*href=|window\.location/

/** A ação de recuperação. Sem ela, a falha transitória vira uma ida desnecessária para outra tela. */
const TEM_RETENTATIVA = /reset\(\)|window\.location\.reload/

describe('o leitor deste teste', () => {
  it('acha os boundaries — não passa por não ter olhado nada', () => {
    // Se o padrão de nome mudar, a lista fica vazia e todas as asserções abaixo passam sozinhas.
    expect(BOUNDARIES.length, 'nenhum error.tsx encontrado em src/app').toBeGreaterThanOrEqual(3)
    for (const obrigatorio of ['src/app/error.tsx', 'src/app/admin/error.tsx']) {
      expect(BOUNDARIES, `${obrigatorio} saiu do alcance da guarda`).toContain(obrigatorio)
    }
  })

  it('os detectores reconhecem as formas em uso, e nenhuma outra', () => {
    expect(TEM_SAIDA.test('<a href="/admin/hoje" className="x">')).toBe(true)
    expect(TEM_SAIDA.test('<Link href={voltarPara} className="x">')).toBe(true)
    expect(TEM_SAIDA.test('<Button onClick={() => reset()}>')).toBe(false)
    expect(TEM_RETENTATIVA.test('onClick={() => reset()}')).toBe(true)
    expect(TEM_RETENTATIVA.test('<a href="/">voltar</a>')).toBe(false)
  })
})

describe('todo boundary de erro dá uma saída, e não só um retry', () => {
  it.each(BOUNDARIES)('%s oferece navegação para outra tela', (arquivo) => {
    /*
     * Comentário some antes de casar: estes arquivos EXPLICAM em prosa por que usam `<a>` em vez de
     * `<Link>`, e casar com a explicação faria a guarda passar com o link removido — a armadilha
     * nº 1 da tabela de guarda cega do CLAUDE.md, que já cegou `alvo-de-toque-tem-48` uma vez.
     */
    const fonte = semComentarios(readFileSync(arquivo, 'utf8'))
    expect(
      TEM_SAIDA.test(fonte),
      `${arquivo} só oferece "tentar de novo". Quando o erro não é transitório, isso é um beco: ` +
        'reset() devolve a mesma tela e a pessoa conclui que o app travou. Toda tela de erro precisa ' +
        'de uma ação E de um caminho para fora.',
    ).toBe(true)
  })

  it.each(BOUNDARIES)('%s oferece a retentativa, para a falha que é só transitória', (arquivo) => {
    // O outro lado da regra: só link seria mandar a pessoa embora de uma tela que ia voltar
    // sozinha no segundo toque. As duas coisas, sempre.
    const fonte = semComentarios(readFileSync(arquivo, 'utf8'))
    expect(TEM_RETENTATIVA.test(fonte), `${arquivo} não oferece como tentar de novo`).toBe(true)
  })

  it('o boundary do painel escapa por navegação de página inteira', () => {
    /*
     * Específico, e o motivo é a causa raiz do relato: `<Link>` é navegação de CLIENTE e
     * reaproveita o runtime que acabou de quebrar. Num erro não-transitório, o botão de saída
     * levaria ao mesmo erro — que é a sensação de "travado" que este conserto existe para tirar.
     */
    const fonte = semComentarios(readFileSync('src/app/admin/error.tsx', 'utf8'))
    expect(
      /<a\s[^>]*href=/.test(fonte),
      'o boundary do /admin voltou a escapar por <Link>, que reaproveita o estado quebrado',
    ).toBe(true)
  })
})
