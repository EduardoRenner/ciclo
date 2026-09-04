import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { EsquemaPedidoDeOrcamento } from '@/server/services/pedido-de-orcamento'

import { semComentarios } from '../../helpers/fonte'

/**
 * Fase 2 do `docs/40`. A fase 1 fez o serviço dizer "Sob orçamento" na vitrine, e aí a pessoa tocava
 * no card e não acontecia nada de útil: `/orcamento/[token]` só exibe orçamento que já existe, e
 * quem criava era sempre o profissional. O produto anunciava "sob orçamento" e não tinha por onde
 * pedir um — para o eletricista e a faxineira, que é quem a fase 1 existe para atender, isso é o
 * caminho inteiro.
 */

const SERVICO = 'src/server/services/pedido-de-orcamento.ts'
const ROTA = 'src/app/api/v1/public/[slug]/quote-request/route.ts'
const TELA = 'src/app/(public)/[slug]/orcamento/pedido.tsx'
const PAGINA = 'src/app/(public)/[slug]/orcamento/page.tsx'
const VITRINE = 'src/app/(public)/[slug]/secoes.tsx'

const fonte = (caminho: string) => semComentarios(readFileSync(caminho, 'utf8'))

describe('o que a pessoa preenche', () => {
  it('exige descrição, nome e telefone', () => {
    const r = EsquemaPedidoDeOrcamento.safeParse({ message: '', name: '', phone: '' })
    expect(r.success).toBe(false)
  })

  it('a descrição precisa dizer alguma coisa', () => {
    // Um "oi" não é pedido de orçamento, e o profissional teria que perguntar tudo de novo.
    expect(EsquemaPedidoDeOrcamento.safeParse({ message: 'oi', name: 'Ana', phone: '51999999999' }).success).toBe(false)
  })

  it('serviço e endereço são opcionais', () => {
    /*
     * Quem pede orçamento muitas vezes não sabe em qual serviço aquilo se encaixa. Um campo
     * obrigatório faria a pessoa escolher errado só para o formulário aceitar — a mesma classe de
     * "a tela deixa trabalhar para recusar no envio" já corrigida em outras telas desta base.
     */
    const r = EsquemaPedidoDeOrcamento.safeParse({
      message: 'Preciso trocar a fiação da sala inteira',
      name: 'Ana',
      phone: '51999999999',
    })
    expect(r.success).toBe(true)
  })
})

describe('formulário público sem autenticação', () => {
  it('a rota barra o honeypot antes de gravar', () => {
    const src = fonte(ROTA)
    const iHoneypot = src.indexOf('if (entrada.website)')
    const iCriar = src.indexOf('criarPedidoDeOrcamento(')
    expect(iHoneypot, 'sumiu o honeypot da rota de pedido').toBeGreaterThan(-1)
    // A ORDEM é a asserção: um honeypot conferido depois de gravar não barra nada.
    expect(iCriar, 'o pedido é criado antes de o honeypot ser conferido').toBeGreaterThan(iHoneypot)
  })

  it('a resposta do honeypot tem a mesma forma da de sucesso', () => {
    // Dizer "bloqueado" ensinaria o próprio script a se adaptar. Mesmo contrato do `book`.
    expect(/RESPOSTA_HONEYPOT = \{ ok: true/.test(fonte(ROTA)), 'a resposta do honeypot denuncia que ele existe').toBe(true)
  })

  it('a tela tem o campo do honeypot, fora da vista', () => {
    const src = fonte(TELA)
    expect(/website/.test(src), 'a tela não tem honeypot — a rota confere um campo que ninguém envia').toBe(true)
    expect(/-left-\[9999px\]/.test(src), 'o honeypot ficou visível para gente').toBe(true)
  })

  it('a rota limita por IP e por telefone, como o agendamento', () => {
    /*
     * Honeypot sozinho não segura formulário aberto. Os números são deliberadamente os do `book`:
     * um pedido falso custa ao salão o mesmo tanto de atenção que um agendamento falso.
     */
    const src = fonte(ROTA)
    expect(/quote:ip:.*:min/.test(src), 'sumiu o limite por minuto').toBe(true)
    expect(/quote:ip:.*:dia/.test(src), 'sumiu o limite diário por IP').toBe(true)
    expect(/quote:tel:/.test(src), 'sumiu o limite por telefone').toBe(true)
    // O telefone entra na chave como HASH, nunca em claro (regras 9 e 10 do CLAUDE.md).
    expect(/createHash\('sha256'\)/.test(src), 'o telefone entrou em claro na chave do limitador').toBe(true)
  })
})

describe('o pedido nasce distinguível do rascunho do profissional', () => {
  it('grava `requested` e sem profissional', () => {
    const src = fonte(SERVICO)
    expect(/status: 'requested'/.test(src), 'o pedido virou rascunho e some da fila de quem espera').toBe(true)
    expect(/professional_id: null/.test(src), 'o pedido nasceu com dono falso').toBe(true)
    expect(/created_by: null/.test(src), '`created_by` preenchido faz parecer que alguém do salão criou').toBe(true)
  })

  it('o banco aceita o estado novo e mantém os antigos', () => {
    const sql = readFileSync('supabase/migrations/0061_pedido_de_orcamento.sql', 'utf8')
    expect(/check \(status in \([^)]*'requested'/.test(sql), 'a migration não libera o estado novo').toBe(true)
    for (const antigo of ['draft', 'sent', 'approved', 'rejected', 'expired', 'converted']) {
      expect(sql, `a constraint nova derrubou o estado '${antigo}'`).toContain(`'${antigo}'`)
    }
    expect(/alter column professional_id drop not null/.test(sql), 'o pedido continua exigindo profissional').toBe(true)
  })

  it('o painel mostra selo próprio, não "Rascunho"', () => {
    // Empilhar os dois no mesmo rótulo apagaria a distinção que faz o painel saber o que exige
    // resposta de alguém.
    const src = fonte('src/app/admin/orcamentos/lista.tsx')
    expect(/requested: \{ estado: '\w+', texto: 'Pedido novo' \}/.test(src), 'o pedido novo se confunde com rascunho').toBe(
      true,
    )
  })

  it('o serviço escolhido não se perde', () => {
    /*
     * O `eslint` pegou este defeito na primeira versão: o id era validado contra o catálogo e o
     * resultado não ia para lugar nenhum. A pessoa escolhia e a informação sumia — validação sem
     * destino. Casa com o USO, não com a busca.
     */
    const src = fonte(SERVICO)
    expect(/Serviço indicado: \$\{nomeDoServico\}/.test(src), 'o serviço escolhido não chega em quem vai orçar').toBe(true)
  })

  it('só serviço `quote` do próprio tenant é aceito', () => {
    const src = fonte(SERVICO)
    const i = src.indexOf("from('services')")
    const trecho = src.slice(i, src.indexOf('maybeSingle()', i))
    expect(trecho, 'o pedido aceita serviço de outro salão').toContain("eq('tenant_id', tenant.id)")
    expect(trecho, 'preço fechado vira segunda porta de agendamento sem horário').toContain("eq('pricing_model', 'quote')")
  })
})

describe('a porta só existe onde alguém atende do outro lado', () => {
  it('a rota some quando o salão não tem serviço sob orçamento', () => {
    /*
     * Oferecer um formulário que o dono nunca vai atender é a mesma classe de promessa vazia que a
     * regra do canal de mensagem proíbe. `notFound()`, não formulário vazio.
     */
    /*
     * A asserção casa com a LINHA inteira, e não com `notFound()` solto: o arquivo já tem um
     * `notFound()` para perfil inexistente, e casar com ele deixava a guarda cega — medido por
     * mutação, apagar a checagem do catálogo passava VERDE. Armadilha nº 1 da tabela do
     * `CLAUDE.md`: casar com algo que o arquivo contém por outro motivo.
     */
    const src = fonte(PAGINA)
    expect(/pricingModel === 'quote'/.test(src), 'a página não confere se existe serviço sob orçamento').toBe(true)
    expect(
      /sobOrcamento\.length === 0\) notFound\(\)/.test(src),
      'a página abre formulário mesmo sem ninguém para responder do outro lado',
    ).toBe(true)
  })

  it('o botão da vitrine obedece à mesma condição', () => {
    // Botão e destino têm que concordar: um levando a 404 é pior que nenhum botão.
    const src = fonte(VITRINE)
    expect(/pricingModel === 'quote'/.test(src), 'o botão de orçamento aparece sempre').toBe(true)
    expect(/\/orcamento`/.test(src), 'sumiu o caminho para pedir orçamento').toBe(true)
  })
})

describe('a tela não promete canal que ninguém agenda', () => {
  it('a confirmação não diz que a pessoa vai receber mensagem', () => {
    /*
     * A armadilha mais cara do `CLAUDE.md`: não existe rota agendada que avise o salão de pedido
     * novo, e prometer WhatsApp ou e-mail aqui faz quem passa vergonha ser o salão, não o CICLO.
     * O que a tela diz é o que é verdade — o pedido está na lista — e oferece o atalho para a
     * pessoa cutucar por conta própria.
     */
    const src = fonte(TELA)
    const promessas = /(vai receber|você recebe|te avisamos|enviaremos|em breve entraremos|responderemos em)/i
    expect(promessas.test(src), 'a tela promete um aviso que nenhuma rota agendada manda').toBe(false)
    expect(/Falar no WhatsApp/.test(src), 'sumiu o atalho que substitui a promessa').toBe(true)
  })

  it('o detector reconhece a promessa que ele existe para barrar', () => {
    // Guarda contra o próprio detector: se o padrão parar de casar, a asserção acima passa vazia.
    const promessas = /(vai receber|você recebe|te avisamos|enviaremos|em breve entraremos|responderemos em)/i
    expect(promessas.test('Pronto! Você vai receber uma confirmação no WhatsApp.')).toBe(true)
    expect(promessas.test('Ele está na lista de Elétrica Dom Rocha. Se quiser adiantar, fale direto.')).toBe(false)
  })

  it('nenhuma migration nova prometeu cron para isto', () => {
    // O par: alguém "resolver" o aviso agendando job sem credencial reintroduz a promessa por
    // outro caminho. O `cron.yml` continua sendo a fonte de quem realmente roda.
    const migrations = readdirSync('supabase/migrations').filter((a) => a.endsWith('.sql'))
    expect(migrations.length, 'a varredura de migrations não achou arquivo nenhum').toBeGreaterThanOrEqual(50)
    const nova = readFileSync(join('supabase', 'migrations', '0061_pedido_de_orcamento.sql'), 'utf8')
    expect(/insert into jobs|pg_cron|schedule\(/.test(nova), 'a migration agendou um aviso que não existe').toBe(false)
  })
})
