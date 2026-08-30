import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Achado da auditoria de 2026-08-28.
 *
 * `CLAUDE.md` manda rodar `pnpm verify` antes de todo commit e nunca pular `pnpm test:rls`. Os
 * dois chamam as 44 suítes de `tests/integration` e `tests/rls`, que abrem o Supabase com a
 * `SUPABASE_SERVICE_ROLE_KEY` de `.env.local` — e o `.env.local` desta máquina aponta para o
 * projeto de PRODUÇÃO. Seguir a instrução escrita criava tenant, usuário, agendamento e comanda
 * no banco que atende cliente pagante. A CI escapava por outro motivo: ela exporta
 * `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` antes de rodar.
 *
 * A proteção mora em `tests/setup/so-banco-local.ts` e chega às suítes por
 * `vitest.banco.config.ts`. Este teste guarda o fio: setup que não está pendurado em nada não
 * protege ninguém, e some numa edição de `package.json` sem que nada reprove.
 *
 * Casa com o CAMINHO DO ARQUIVO dentro do comando — não com o nome solto, que aparece neste
 * próprio arquivo e no comentário do config por outro motivo (a armadilha nº 1 do `CLAUDE.md`).
 */

const CONFIG = 'vitest.banco.config.ts'
const SETUP = 'tests/setup/so-banco-local.ts'

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }

describe('as suítes que abrem o banco não podem apontar para produção', () => {
  it('o package.json foi lido de verdade', () => {
    expect(Object.keys(pkg.scripts).length, 'nenhum script lido — o teste passaria por não achar nada').toBeGreaterThan(5)
    expect(pkg.scripts['verify'], 'o script verify sumiu — este teste precisa ser atualizado junto').toBeDefined()
  })

  it.each(['test:integration', 'test:rls'])('%s roda com a config que carrega a trava', (nome) => {
    const comando = pkg.scripts[nome]
    expect(comando, `o script ${nome} sumiu do package.json`).toBeDefined()
    expect(
      comando!.includes(`--config ${CONFIG}`),
      `${nome} não passa mais por ${CONFIG}: sem ela, \`pnpm verify\` na máquina de quem tem ` +
        `.env.local apontando para produção escreve no banco de cliente pagante com a chave de serviço`,
    ).toBe(true)
  })

  it('a config pendura o arquivo de setup pelo caminho, não por um nome parecido', () => {
    const config = readFileSync(CONFIG, 'utf8')
    const declaracao = config.indexOf('setupFiles:')
    expect(declaracao, `${CONFIG} não declara setupFiles`).toBeGreaterThan(-1)
    // Delimita pelo fim da declaração (o `]` que fecha a lista), não por uma janela de N
    // caracteres — a armadilha nº 4 da tabela de guarda cega do CLAUDE.md.
    const lista = config.slice(declaracao, config.indexOf(']', declaracao))
    expect(
      lista.includes(SETUP),
      `${CONFIG} declara setupFiles sem ${SETUP} dentro: ${lista}`,
    ).toBe(true)
  })

  it('a trava recusa uma URL remota e aceita a local — as duas direções', async () => {
    const setup = readFileSync(SETUP, 'utf8')
    const regexNoFonte = /const E_LOCAL = (\/.+\/i)\.test/.exec(setup)
    expect(regexNoFonte?.[1], 'não achei a regra de "é local" no setup — ela foi reescrita e este teste precisa ir junto').toBeDefined()

    // A mesma regra do arquivo de verdade, exercitada aqui: guarda que só confere que o texto
    // existe não sabe se ele funciona.
    const eLocal = (url: string) => new RegExp(regexNoFonte![1]!.slice(1, -2), 'i').test(url)

    for (const local of ['http://127.0.0.1:54321', 'http://localhost:54321', 'http://127.0.0.1:54321/']) {
      expect(eLocal(local), `${local} devia passar como local`).toBe(true)
    }
    for (const remota of ['https://sukloaoodpxjukngyojo.supabase.co', 'https://qualquer-projeto.supabase.co', 'https://127.0.0.1.evil.com']) {
      expect(eLocal(remota), `${remota} NÃO devia passar como local`).toBe(false)
    }
  })
})
