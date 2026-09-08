import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

import { caminhoInternoSeguro } from '@/server/auth/destino'

/**
 * Achado da auditoria de 2026-09-08.
 *
 * `?proximo=` chegava cru em `router.push` nas duas telas de autenticação que redirecionam depois
 * de a sessão existir. `router.push` navega para URL externa, então
 * `https://<dominio>/entrar?proximo=https://evil.com/entrar` autenticava a pessoa no domínio de
 * verdade e a jogava num clone no instante seguinte — o momento de maior confiança de toda a
 * sessão, quando ela acabou de digitar a senha e espera ver o painel.
 *
 * O projeto já tinha metade da defesa: `destino.ts` existia, com a lista fechada de
 * `/auth/callback` e um comentário que descreve exatamente a armadilha do `/\evil.com`. Faltava a
 * outra metade — o login precisa aceitar QUALQUER rota do painel (o `proximo` nasce em
 * `middleware.ts:240` como o `pathname` que a pessoa tentou abrir), então a lista fechada não
 * servia e ninguém escreveu a versão que serviria.
 *
 * Esta guarda tem duas metades, porque o defeito pode voltar por dois caminhos independentes:
 * alguém devolver o valor cru ao `push`, ou alguém "simplificar" a função para uma checagem de
 * prefixo que a barra invertida atravessa.
 */

const TELAS = [
  join('src', 'app', '(auth)', 'entrar', 'formulario.tsx'),
  join('src', 'app', '(auth)', 'verificar', 'formulario.tsx'),
]

describe('a tela de login não manda para fora do domínio', () => {
  it.each(TELAS)('%s não entrega `proximo` cru ao router', (tela) => {
    const fonte = semComentarios(readFileSync(tela, 'utf8'))

    /*
     * Casa com o USO, não com a existência do import: importar a função e continuar empurrando o
     * valor cru é exatamente o estado em que o defeito volta sem ninguém notar.
     *
     * **A primeira versão desta asserção dava falso positivo, e só apareceu porque testei as duas
     * direções.** Ela exigia `caminhoInternoSeguro` DENTRO do `router.push`, e reprovava
     * `entrar/formulario.tsx`, que está correto: lá a sanitização acontece uma vez, na atribuição
     * (`const proximo = caminhoInternoSeguro(...)`), e o push só usa a variável já limpa — que é
     * inclusive o desenho melhor, porque o mesmo valor viaja para `/verificar` na query do MFA.
     *
     * Então a pergunta certa não é "onde a função é chamada", é: **o `proximo` que chega ao push
     * está coberto?** Coberto = a variável foi definida pela função, ou o push a chama inline.
     */
    const sanitizadoNaOrigem = /const\s+proximo\s*=\s*caminhoInternoSeguro\(/.test(fonte)

    const pushesCrus = [...fonte.matchAll(/router\.push\(([^)]*)\)/g)]
      .map((m) => m[1] ?? '')
      .filter((arg) => /proximo/.test(arg))
      .filter((arg) => !sanitizadoNaOrigem && !/caminhoInternoSeguro/.test(arg))

    expect(
      pushesCrus,
      `${tela} manda \`proximo\` cru para router.push. Esse valor vem da query string e aceita ` +
        'URL externa — passe por `caminhoInternoSeguro`, na atribuição ou no próprio push.',
    ).toEqual([])
  })

  it('o detector reconhece as três formas, inclusive a sanitização na origem', () => {
    // Guarda contra o próprio detector: se ele parar de distinguir, os casos acima passam vazios.
    const achar = (t: string) => {
      const naOrigem = /const\s+proximo\s*=\s*caminhoInternoSeguro\(/.test(t)
      return [...t.matchAll(/router\.push\(([^)]*)\)/g)]
        .map((m) => m[1] ?? '')
        .filter((a) => /proximo/.test(a))
        .filter((a) => !naOrigem && !/caminhoInternoSeguro/.test(a))
    }

    expect(achar("router.push(proximo ?? '/admin/hoje')"), 'não pegou o push cru').toHaveLength(1)
    expect(achar('router.push(caminhoInternoSeguro(proximo))'), 'reprovou a chamada inline').toHaveLength(0)
    expect(
      achar("const proximo = caminhoInternoSeguro(params.get('proximo'))\nrouter.push(semNegocio ? '/onboarding' : proximo)"),
      'reprovou a sanitização na origem, que é o desenho correto',
    ).toHaveLength(0)
  })
})

describe('caminhoInternoSeguro recusa tudo que sai do domínio', () => {
  it('deixa passar rota do painel, com query', () => {
    expect(caminhoInternoSeguro('/admin/clientes')).toBe('/admin/clientes')
    expect(caminhoInternoSeguro('/admin/agenda?dia=2026-09-08')).toBe('/admin/agenda?dia=2026-09-08')
  })

  it('recusa URL absoluta e protocolo', () => {
    expect(caminhoInternoSeguro('https://evil.com')).toBe('/admin/hoje')
    expect(caminhoInternoSeguro('javascript:alert(1)')).toBe('/admin/hoje')
  })

  it('recusa `//evil.com`, que o navegador lê como outro domínio', () => {
    expect(caminhoInternoSeguro('//evil.com')).toBe('/admin/hoje')
  })

  it('recusa `/\\evil.com` — a armadilha que checagem de prefixo não vê', () => {
    /*
     * O caso que decide o desenho da função, e o motivo de ela resolver com `new URL` em vez de
     * olhar o começo da string: `/\evil.com` começa com `/`, não começa com `//`, e passa por
     * qualquer validação ingênua — mas o navegador resolve a barra invertida como barra e sai em
     * `https://evil.com/`. É a mesma armadilha que o comentário de `DESTINOS` já documentava.
     */
    expect(caminhoInternoSeguro('/\\evil.com')).toBe('/admin/hoje')
    expect(caminhoInternoSeguro('/\\\\evil.com')).toBe('/admin/hoje')
  })

  it('cai no padrão quando não há destino', () => {
    expect(caminhoInternoSeguro(null)).toBe('/admin/hoje')
    expect(caminhoInternoSeguro('')).toBe('/admin/hoje')
    expect(caminhoInternoSeguro(undefined)).toBe('/admin/hoje')
  })
})
