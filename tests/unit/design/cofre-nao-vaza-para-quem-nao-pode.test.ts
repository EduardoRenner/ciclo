import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { avaliarPermissao } from '@/server/auth/rbac'

import { semComentarios } from '../../helpers/fonte'

/**
 * Unidade 10 da auditoria de 2026-09-08 — o dado mais sensível do produto saindo pela porta errada.
 *
 * `health_records` guarda a anamnese CIFRADA e, em claro por desenho, o par `has_alert` +
 * `alert_label` — o rótulo curto ("Alergia a látex", "Gestante"), que existe para o cartão do
 * próximo atendimento não precisar decifrar nada.
 *
 * A porta oficial do rótulo é `GET /api/v1/clients/[id]/vault`, e ela exige TRÊS coisas:
 * `exigirPermissao('vault:own')`, `exigirAal2()` e registro em `vault_access_log`.
 *
 * Achei o mesmo rótulo servido em dois lugares SEM nenhuma das três:
 *
 *   1. **A ficha do cliente.** `fichaDoCliente` preenchia `saude.alerta` com o rótulo para
 *      qualquer papel com `client:read` — recepção inclusive. O contrato do próprio campo dizia,
 *      na linha de cima, *"só o SINAL de que existe alerta de saúde, nunca o conteúdo"*.
 *   2. **A tela /admin/hoje.** `resumo-hoje` selecionava `alert_label` e ninguém o usava: o
 *      `appointment-row` recebe `alertaSaude?: boolean` e declara "nunca o rótulo clínico, só o
 *      sinal". O rótulo viajava no payload do server component até o navegador — invisível na
 *      tela, legível no devtools.
 *
 * E um terceiro, pior que os dois: **`GET .../data-export` decifrava o cofre inteiro exigindo
 * `client:read`**, que a recepção tem. A permissão certa já existia no `rbac.ts` (`client:export`,
 * reservada ao dono em `EXCLUSIVAS_DO_DONO` por causa da C35 da FAQ); a rota é que não a aplicava.
 *
 * ## O que esta guarda cobre, e o que ela não cobre
 *
 * A segunda camada é a `0077`: `ciphertext`, `iv`, `auth_tag` e `alert_label` saíram do
 * `grant select` de `anon`/`authenticated`. Isso o BANCO garante, e nenhum teste daqui precisa
 * (nem consegue) reafirmar — quem confere é `tests/rls/`.
 *
 * O que se guarda aqui é a PRIMEIRA camada, que é código: quem pode pedir, e quem decide.
 */

const CRM = 'src/server/services/crm.ts'
const FICHA = 'src/app/admin/clientes/[id]/page.tsx'
const EXPORT = 'src/app/api/v1/clients/[id]/data-export/route.ts'
const VAULT = 'src/app/api/v1/clients/[id]/vault/route.ts'
const HOJE = 'src/server/services/resumo-hoje.ts'
const MIGRATION = 'supabase/migrations/0077_cofre_por_coluna.sql'

/** As colunas que a `0077` tirou do alcance do JWT de usuário. */
const SO_PELO_SERVICE_ROLE = ['ciphertext', 'iv', 'auth_tag', 'alert_label']

/*
  Palavra inteira, e não substring. A primeira versão desta guarda casava `iv` solto e acusou
  TRÊS arquivos corretos — `.select('id, active')` contém "iv" dentro de "act-iv-e". É o custo
  simétrico da guarda cega: detector que reprova o certo manda alguém "consertar" código bom, e
  os três estavam certos.
*/
function leColunaSensivel(select: string): string[] {
  /*
    Dois contrabarras, e a diferenca custou uma rodada: dentro de template literal, `\b` e o
    escape de BACKSPACE (U+0008), nao a fronteira de palavra. A primeira versao procurava um
    caractere de controle, nao casava nada, e a guarda reprovou os DOIS arquivos que ela existe
    para proteger. Mesma armadilha do `regex-corrompido-por-heredoc`, aqui sem heredoc nenhum:
    basta a crase.
  */
  return SO_PELO_SERVICE_ROLE.filter((col) => new RegExp(`\\b${col}\\b`).test(select))
}

/** Todo `.ts`/`.tsx` sob a raiz, para a regra valer para arquivo que ainda não existe. */
function varrer(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name).split(String.fromCharCode(92)).join('/')
    if (entrada.isDirectory()) achados.push(...varrer(caminho))
    else if (/[.]tsx?$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

function fonte(caminho: string): string {
  return semComentarios(readFileSync(caminho, 'utf8'))
}

describe('a tabela de permissões diz quem pode chegar perto do cofre', () => {
  /*
   * Behavioral, não varredura: é a régua de que todo o resto depende. Se `reception` ganhar
   * `vault:*` um dia, os testes de fonte abaixo continuariam verdes e o vazamento voltaria pela
   * porta da frente — legitimado pela tabela.
   */
  it('recepção, gerente e financeiro não alcançam o cofre', () => {
    for (const papel of ['reception', 'manager', 'finance'] as const) {
      expect(avaliarPermissao(papel, 'vault:own'), `${papel} passou a alcançar o cofre`).toBeNull()
      expect(avaliarPermissao(papel, 'vault:read'), `${papel} passou a alcançar o cofre`).toBeNull()
    }
  })

  it('dono e profissional alcançam — a guarda não tranca quem precisa', () => {
    // Sem isto, "ninguém alcança" passaria o teste acima e quebraria o produto.
    expect(avaliarPermissao('owner', 'vault:own')).toBe('all')
    /*
     * `'all'` e não `'own'`, e a diferença é do detector, não da regra: `avaliarPermissao` casa a
     * permissão LITERAL antes de olhar o alcance, e `professional` tem `vault:own` escrito na
     * tabela. Quem devolve `'own'` é a pergunta por outro verbo do mesmo recurso. Afirmo as duas
     * para que a semântica fique registrada — descobri isto escrevendo a asserção errada.
     */
    expect(avaliarPermissao('professional', 'vault:own')).toBe('all')
    expect(avaliarPermissao('professional', 'vault:read')).toBe('own')
  })

  it('exportar a base continua só do dono', () => {
    expect(avaliarPermissao('owner', 'client:export')).toBe('all')
    for (const papel of ['manager', 'reception', 'professional', 'finance'] as const) {
      expect(avaliarPermissao(papel, 'client:export'), `${papel} pode exportar`).toBeNull()
    }
  })
})

describe('o rótulo do alerta só é buscado para quem pode lê-lo', () => {
  it('a ficha condiciona a busca do rótulo, em vez de buscar e descartar', () => {
    const src = fonte(CRM)

    // Piso: se a função sumir daqui, tudo abaixo passaria vazio.
    expect(src, `${CRM} não busca mais o rótulo — esta guarda ficou sem objeto`).toContain('rotuloDoAlerta(')

    /*
     * A chamada tem que estar num ternário guardado por `podeLerCofre`. Buscar e descartar não
     * bastaria: o rótulo trafegaria no payload do server component até o navegador de quem não
     * pode vê-lo, invisível na tela e visível no devtools — que é o pior dos dois mundos e foi
     * exatamente o defeito de `resumo-hoje`.
     */
    expect(
      /podeLerCofre\s*\?[^\n]*rotuloDoAlerta\(/.test(src),
      'a busca do rótulo não está condicionada a `podeLerCofre`',
    ).toBe(true)
  })

  it('a página da ficha decide pela permissão, não por um literal', () => {
    const src = fonte(FICHA)
    expect(src, 'a página parou de passar `podeLerCofre`').toContain('podeLerCofre')
    expect(
      /podeLerCofre:\s*avaliarPermissao\(ctx\.papel,\s*'vault:/.test(src),
      'a página passa `podeLerCofre` sem consultar `avaliarPermissao` com uma permissão `vault:` — ' +
        'um `true` fixo aqui devolve o vazamento inteiro sem tocar em mais nada',
    ).toBe(true)
  })

  it('a tela de hoje não pede o rótulo que não mostra', () => {
    expect(fonte(HOJE), 'o `alert_label` voltou para o payload de /admin/hoje').not.toContain('alert_label')
  })
})

describe('as colunas sensíveis só são lidas pelo service_role', () => {
  /*
   * A regra geral, e a que sobrevive a arquivo novo. A `0077` tirou estas colunas do
   * `grant select` de `authenticated`, então lê-las com o cliente do usuário não vaza — ERRA. Mas
   * errar em produção, numa tela de saúde, é um defeito por si só: o conserto certo é a leitura
   * nascer no lugar certo, e é isso que se guarda aqui.
   *
   * Casa com o NOME da coluna dentro de um `.select(`, e não em qualquer lugar do arquivo, para
   * não acusar quem só escreve (`upsert`) ou quem cita a coluna numa lista de anonimização —
   * `lgpd.ts` faz as duas coisas legitimamente.
   */
  const ARQUIVOS_QUE_LEEM = [
    { arquivo: 'src/server/services/anamnese.ts', porque: 'abrirFicha e rotuloDoAlerta' },
    { arquivo: 'src/server/services/lgpd.ts', porque: 'exportação do titular' },
  ]

  it.each(ARQUIVOS_QUE_LEEM)('$arquivo lê pelo service_role ($porque)', ({ arquivo }) => {
    const src = fonte(arquivo)
    const selects = src.match(/\.select\(\s*'[^']*'/g) ?? []
    expect(selects.length, `${arquivo} não tem nenhum \`.select\` — o padrão parou de casar`).toBeGreaterThan(0)

    const sensiveis = selects.filter((s) => leColunaSensivel(s).length > 0)
    expect(sensiveis.length, `${arquivo} não lê mais coluna sensível — tire-o desta lista`).toBeGreaterThan(0)

    expect(
      /withTenant\(/.test(src),
      `${arquivo} lê ${sensiveis.join(', ')} e não passa por \`withTenant\`. Com o cliente do ` +
        'usuário a consulta ERRA desde a 0077 — a leitura privilegiada tem que nascer no ' +
        'service_role, DEPOIS da checagem de permissão da rota.',
    ).toBe(true)
  })

  it('nenhum ARQUIVO NOVO lê coluna sensível sem service_role', () => {
    const conhecidos = ARQUIVOS_QUE_LEEM.map((a) => a.arquivo)
    const infratores: string[] = []
    for (const arquivo of varrer('src')) {
      if (conhecidos.includes(arquivo)) continue
      const src = fonte(arquivo)
      const selects = src.match(/\.select\(\s*'[^']*'/g) ?? []
      const lê = selects.some((s) => leColunaSensivel(s).length > 0)
      if (lê && !/withTenant\(/.test(src)) infratores.push(arquivo)
    }
    expect(infratores, 'leitura de coluna do cofre fora do service_role').toEqual([])
  })
})

describe('as duas rotas que abrem o cofre continuam trancadas', () => {
  it('exportar exige a permissão do dono, não `client:read`', () => {
    const src = fonte(EXPORT)
    expect(
      /exigirPermissao\(ctx\.papel,\s*'client:export'\)/.test(src),
      'a rota de exportação voltou a aceitar uma permissão que a recepção tem. Ela DECIFRA o ' +
        'cofre: era a porta mais larga do dado de saúde no produto, mais larga que /vault.',
    ).toBe(true)
    expect(src, 'sumiu o AAL2 da exportação (C35: "MFA na hora")').toContain('exigirAal2()')
  })

  it('abrir a ficha do cofre exige permissão, AAL2 e trilha', () => {
    const src = fonte(VAULT)
    expect(/exigirPermissao\(ctx\.papel,\s*'vault:own'\)/.test(src), 'sumiu a permissão do cofre').toBe(true)
    expect(src, 'sumiu o AAL2 do cofre').toContain('exigirAal2()')
    // A trilha mora dentro de `abrirFicha`; aqui basta que a rota continue chamando quem registra.
    expect(src, 'a rota parou de usar `abrirFicha`, que é quem grava em vault_access_log').toContain('abrirFicha(')
  })
})

describe('a migration 0077 corta na coluna certa', () => {
  /*
    Sem comentário. O cabeçalho da 0077 CITA `grant select (has_alert)` ao explicar de onde veio a
    ideia, e a primeira versão desta guarda achou esse `grant` da prosa em vez do de verdade — a
    asserção de ordem reprovou com o arquivo correto. Quarta vez que esta armadilha aparece nesta
    base, e a primeira em SQL.
  */
  const sql = readFileSync(MIGRATION, 'utf8').replace(/^\s*--.*$/gm, '')

  it('revoga o select amplo antes de conceder o estreito', () => {
    const revoke = sql.indexOf('revoke select on public.health_records')
    const grant = sql.indexOf('grant select (')
    expect(revoke, 'a 0077 não revoga mais nada').toBeGreaterThan(-1)
    expect(grant, 'a 0077 não concede mais nada').toBeGreaterThan(-1)
    expect(grant, 'o grant vem ANTES do revoke — o revoke apagaria o grant').toBeGreaterThan(revoke)
  })

  it('o sinal continua concedido e o conteúdo não', () => {
    /*
     * Recortado do `grant`, não do arquivo: as colunas sensíveis aparecem no cabeçalho em prosa,
     * explicando o defeito, e casar com o arquivo inteiro acusaria a própria explicação. É a
     * armadilha "guarda casa com o próprio comentário", já registrada três vezes nesta base.
     */
    const inicio = sql.indexOf('grant select (')
    const fim = sql.indexOf(')', inicio)
    expect(fim, 'o `grant select (` não fecha — o recorte iria até o fim do arquivo').toBeGreaterThan(inicio)
    const concedidas = sql.slice(inicio, fim)

    expect(concedidas, 'o SINAL saiu do grant: a recepção perde o alerta que a faz avisar quem atende').toContain('has_alert')
    for (const col of SO_PELO_SERVICE_ROLE) {
      expect(concedidas, `\`${col}\` voltou para o alcance do JWT de usuário`).not.toContain(col)
    }
  })
})

describe('a tela não oferece o que a rota vai recusar', () => {
  /*
   * O defeito que o PRÓPRIO conserto de segurança criava. Apertar a rota de exportação para
   * `client:export` sem mexer na tela deixaria o botão "Baixar os dados" visível para recepção e
   * gerente, falhando só no clique — a armadilha "deixa trabalhar para recusar no envio", que o
   * `docs/20` combate e que esta base já corrigiu em seis telas.
   *
   * A mesma permissão nos dois lados, e é isso que a guarda prende: a tela some para quem a rota
   * recusaria, em vez de oferecer e falhar.
   */
  it('o botão de exportar depende da MESMA permissão que a rota exige', () => {
    const pagina = fonte('src/app/admin/clientes/[id]/page.tsx')
    expect(
      /podeExportarCliente=\{avaliarPermissao\(ctx\.papel, 'client:export'\)/.test(pagina),
      'a página decide o botão de exportar por outra régua que não `client:export` — as duas ' +
        'fontes divergem e a pessoa leva um erro no clique',
    ).toBe(true)

    const painel = fonte('src/app/admin/clientes/[id]/direitos.tsx')
    expect(painel, 'o painel de direitos ignora a permissão de exportar').toContain('podeExportar')
    expect(
      /\{podeExportar \?/.test(painel),
      'o botão de exportar não está condicionado — receber a prop e não usá-la é o mesmo que não tê-la',
    ).toBe(true)
  })
})
