import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * Achado da auditoria de 2026-09-08, Unidade 5c.
 *
 * `POST /api/v1/auth/password/reset` só chamava `exigirSessao()`. Qualquer sessão servia — e a
 * rota termina com `signOut({ scope: 'others' })`. Um cookie roubado de uma sessão comum trocava
 * a senha e **expulsava o dono de vez**: takeover permanente, sem o invasor nunca ter provado
 * quem é. A trava é `veioDoLinkDeRecuperacao(sessao.metodos)`, em `server/auth/session.ts`.
 *
 * ## A medição que decidiu o desenho
 *
 * A distinção sai do `amr` do JWT, não de parâmetro do cliente. Medido no projeto de dev em
 * 08/09/2026, gerando um link de recuperação de verdade (`admin.generateLink` + `verifyOtp`):
 *
 *   - sessão do link: `amr: [{ method: 'otp' }]`, `aal1`;
 *   - **sobrevive à renovação**: duas renovações seguidas devolveram o mesmo `amr`. Isso importa
 *     porque o middleware renova o token de 15 em 15 minutos — se o `amr` sumisse ali, quem veio
 *     do link seria trancado do lado de fora na primeira renovação;
 *   - vem pela API que o app **já** chamava (`mfa.getAuthenticatorAssuranceLevel()`), no campo
 *     `currentAuthenticationMethods` — não precisou decodificar JWT na mão.
 *
 * O lado do login por senha não deu para medir nesta máquina: o projeto de dev está com proteção
 * de captcha ligada e `signInWithPassword` responde `captcha_failed` (é o mesmo achado que
 * `core/auth/motivo-da-recusa.ts` documenta). Por isso a função **falha fechado**: ela exige a
 * presença positiva de `otp`/`recovery`/`magiclink` e a ausência de `oauth`/`password`. Lista
 * vazia recusa — mesma regra de permitidos do `motivo-da-recusa.ts`, o desconhecido cai no
 * comportamento conservador.
 *
 * ## Por que duas metades
 *
 * A trava pode morrer de dois jeitos independentes, e o segundo é invisível:
 *
 *   1. alguém tira a chamada da rota — o teste de unidade da função continuaria verde, porque ele
 *      prova a função, não o uso;
 *   2. alguém adiciona **login por link de e-mail** (`signInWithOtp`). Aí `otp` deixa de
 *      significar "veio da recuperação", um login comum passa a carregar `otp`, e a trava abre
 *      sozinha — sem ninguém tocar em `session.ts` nem na rota. É o alicerce da regra, e é o que
 *      a segunda metade vigia.
 */

const ROTA = join('src', 'app', 'api', 'v1', 'auth', 'password', 'reset', 'route.ts')

/** A fonte sem os `import`: casar com o nome importado é a armadilha nº 1 da tabela do CLAUDE.md. */
function corpoDaRota(): string {
  return semComentarios(readFileSync(ROTA, 'utf8'))
    .split(/\r?\n/)
    .filter((linha) => !/^\s*import\b/.test(linha) && !/\bfrom\s+'/.test(linha))
    .join('\n')
}

function arquivosDe(dir: string, achados: string[] = []): string[] {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) arquivosDe(caminho, achados)
    else if (/\.(ts|tsx)$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

describe('só quem veio do link de e-mail troca a senha', () => {
  it('a rota trava ANTES de trocar a senha', () => {
    const corpo = corpoDaRota()

    // Piso: se a rota parar de trocar a senha, a asserção de ordem passaria vazia sem denunciar.
    const iTroca = corpo.indexOf('updateUser(')
    expect(iTroca, `${ROTA} não troca mais a senha — esta guarda ficou sem objeto`).toBeGreaterThan(-1)

    const iTrava = corpo.indexOf('veioDoLinkDeRecuperacao(')
    expect(
      iTrava,
      `${ROTA} não chama veioDoLinkDeRecuperacao. Sem ela qualquer sessão troca a senha, e o ` +
        'signOut({scope:"others"}) da mesma rota expulsa o dono: cookie roubado vira takeover.',
    ).toBeGreaterThan(-1)

    expect(
      iTrava,
      `${ROTA} chama veioDoLinkDeRecuperacao DEPOIS de updateUser — a senha já teria sido trocada.`,
    ).toBeLessThan(iTroca)
  })

  /*
    Até 20/10/2026 esta guarda proibia `signInWithOtp` no projeto inteiro, porque só o link de
    recuperação gravava `otp` no `amr`. O login por número (docs/110 L1) precisa dele, e medido no
    Auth local o código do WhatsApp grava o MESMO `{"method":"otp"}`. A regra foi trocada como a
    mensagem antiga pedia, e não apagada: a prova de "veio do e-mail" passou a ser uma marca que só
    `auth/confirmar` emite com `type=recovery` (`server/auth/marca-de-recuperacao.ts`).
  */
  it('a troca de senha exige a marca do link de recuperação, antes de trocar', () => {
    const corpo = corpoDaRota()
    const iMarca = corpo.indexOf('marcaDeRecuperacaoConfere(')
    const iTroca = corpo.indexOf('updateUser(')
    expect(
      iMarca,
      `${ROTA} não confere a marca do link. Sem ela, quem entra pelo código do WhatsApp (também \`otp\`) ` +
        'troca a senha de uma conta de e-mail sem nunca abrir o e-mail.',
    ).toBeGreaterThan(-1)
    expect(iMarca, 'a marca é conferida DEPOIS de trocar a senha').toBeLessThan(iTroca)
  })

  it('a marca só nasce no link de recuperação', () => {
    const arquivos = arquivosDe('src')
    // Piso: o positivo conhecido é a própria rota de confirmação. Varredura vazia aprovaria tudo.
    const confirmar = join('src', 'app', 'auth', 'confirmar', 'route.ts')
    expect(arquivos, 'a varredura não achou auth/confirmar — raiz ou filtro errado').toContain(confirmar)

    const emissores = arquivos.filter((a) => /\bmarcaDeRecuperacao\(/.test(semComentarios(readFileSync(a, 'utf8'))))
    const fora = emissores.filter((a) => a !== confirmar && !a.endsWith(join('server', 'auth', 'marca-de-recuperacao.ts')))
    expect(fora, 'a marca de "veio do e-mail de recuperação" está sendo emitida fora do link').toEqual([])

    const fonte = semComentarios(readFileSync(confirmar, 'utf8'))
    expect(fonte, 'auth/confirmar parou de emitir a marca: ninguém mais troca a senha').toMatch(/\bmarcaDeRecuperacao\(/)
    /*
      A emissão tem que estar DENTRO do `if` que confere o tipo. A primeira versão desta guarda
      comparava posições e passava com o `if` trocado por `if (data.user)`: o arquivo tem outro
      `tipo === 'recovery'` antes, no destino padrão, e a guarda casava com ele. Visto na mutação.
    */
    expect(fonte, 'a marca nasce sem conferir que o link é de recuperação').toMatch(
      /if \(tipo === 'recovery'[^)]*\)\s*\{[^}]*\bmarcaDeRecuperacao\(/,
    )
  })

  it('o detector distingue presente de ausente, e enxerga a ordem', () => {
    // Guarda contra o próprio detector: se ele parar de casar, os dois casos acima passam vazios.
    const ordem = (t: string) => {
      const i = t.indexOf('veioDoLinkDeRecuperacao(')
      const j = t.indexOf('updateUser(')
      return { trava: i > -1, antes: i > -1 && j > -1 && i < j }
    }

    expect(ordem('if (!veioDoLinkDeRecuperacao(s.metodos)) throw x\ndb.auth.updateUser({ password })')).toEqual({
      trava: true,
      antes: true,
    })
    expect(ordem('db.auth.updateUser({ password })'), 'não pegou a rota sem trava').toEqual({ trava: false, antes: false })
    expect(
      ordem('db.auth.updateUser({ password })\nif (!veioDoLinkDeRecuperacao(s.metodos)) throw x'),
      'não pegou a trava tarde demais',
    ).toEqual({ trava: true, antes: false })

    // E que o import sozinho não conta como uso.
    const soImport = "import { veioDoLinkDeRecuperacao } from '@/server/auth/session'\ndb.auth.updateUser({ password })"
    const semImports = soImport
      .split(/\r?\n/)
      .filter((l) => !/^\s*import\b/.test(l) && !/\bfrom\s+'/.test(l))
      .join('\n')
    expect(ordem(semImports).trava, 'o import sozinho passou por uso').toBe(false)
  })
})
