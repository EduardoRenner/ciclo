import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * O seed de demonstração gravou 132 clientes com `phone_e164` preenchido e `phone_hash` NULO.
 *
 * Nada quebrava na tela: o painel listava, a ficha abria, o gráfico somava. Mas toda busca por
 * telefone no produto passa pelo hash, e com ele nulo:
 *
 *   · `reconhecimento.ts` nunca reconhecia ninguém — a funcionalidade parecia não existir;
 *   · `agendamentos.ts` procurava pelo hash, não achava, tentava INSERT e batia na
 *     `clients_unique_phone` pelo `phone_e164` → 500 na cara de quem estava agendando.
 *
 * A demonstração quebrava exatamente na hora de demonstrar, e é o caso de manual de
 * "verde não é prova": nenhum teste reprovava, nenhuma tela reclamava.
 *
 * Esta guarda é de varredura porque o defeito não é de comportamento do app — é de um script que
 * roda fora dele. Casar com o SQL é o único jeito de a regra ter dente. Comentário sai antes de
 * casar: este arquivo e o guardado falam de `phone_hash` o tempo todo, e casar com a explicação
 * em vez do código é a armadilha nº 1 da tabela do CLAUDE.md.
 */

const SEED = join('scripts', 'seed-demo-carteira.sql')

function sql(): string {
  return semComentarios(readFileSync(SEED, 'utf8'))
}

describe('o seed da carteira de demonstração', () => {
  it('grava phone_hash junto com phone_e164', () => {
    /*
     * Delimitado pelo FIM REAL da lista de colunas, nunca pelo resto do arquivo.
     *
     * A primeira versão desta guarda casava `/phone_hash/` no trecho que ia do `insert into
     * clients` até o fim do arquivo — e passou com a coluna removida da lista, porque
     * `p.phone_hash` continuava logo abaixo, no SELECT. Ou seja: casava com algo que o arquivo
     * contém por outro motivo, que é a armadilha nº 1 da tabela do CLAUDE.md. Só apareceu porque
     * a mutação foi mesmo aplicada e o resultado, lido.
     */
    const src = sql()
    const abre = src.indexOf('insert into clients')
    expect(abre, `${SEED} não tem mais o insert de clients`).toBeGreaterThan(-1)

    const inicioLista = src.indexOf('(', abre)
    const fimLista = src.indexOf(')', inicioLista)
    const colunas = src.slice(inicioLista + 1, fimLista)

    expect(
      colunas,
      'a LISTA DE COLUNAS do insert de clients precisa incluir phone_hash — sem ela o reconhecimento e o agendamento de cliente existente quebram em silêncio',
    ).toMatch(/\bphone_hash\b/)
    expect(colunas, 'phone_e164 sem phone_hash é exatamente o defeito').toMatch(/\bphone_e164\b/)

    // A coluna na lista não basta: tem que receber valor no SELECT.
    expect(src.slice(fimLista), 'phone_hash listado mas sem valor no select').toMatch(/p\.phone_hash/)
  })

  it('calcula o hash com sha256 e um salt vindo de fora do arquivo', () => {
    const src = sql()

    expect(src, 'o hash tem que ser sha256, igual ao hashTelefone() do produto').toMatch(/sha256/)
    // `:'salt'` é a variável do psql. Um salt literal aqui seria segredo no repositório (regra 10).
    expect(src, "o salt tem que entrar por -v salt, nunca literal").toMatch(/:'salt'/)
    expect(
      src,
      'nenhum salt literal pode aparecer no arquivo — regra 10 do CLAUDE.md',
    ).not.toMatch(/PHONE_HASH_SALT\s*=\s*\S/)
  })

  it('confere o próprio resultado antes de terminar', () => {
    // Um seed que não mede o que fez é a mesma classe de problema do cron que respondia 200 com
    // `tenantsProcessados: 0`. A consulta final tem que olhar justamente o que já deu errado.
    const src = sql()
    const conferencia = src.slice(src.lastIndexOf('commit;'))

    expect(conferencia, 'o seed precisa conferir telefone sem hash ao terminar').toMatch(/telefone_sem_hash/)
    expect(conferencia, 'e conferir que nenhum atendimento concluído caiu no futuro').toMatch(/concluido_no_futuro/)
    expect(conferencia, 'e que nada caiu em dia de salão fechado').toMatch(/em_dia_fechado/)
  })

  it('usa a fórmula de lucro do core, não uma reinvenção', () => {
    /*
     * `calcularSobraDaComanda`: max(0, subtotal − desconto) − material − taxa − comissão.
     *
     * O desconto na conta não é detalhe: numa comanda de R$ 100 com R$ 20 de desconto, a versão
     * que o ignorava mostrava "Entrou R$ 80" e "Sobrou R$ 100" — sobrava mais do que entrou. Um
     * seed que reinventa a fórmula ensina a demonstração a mentir de um jeito que o produto já
     * não mente.
     */
    const src = sql()
    const lucro = src.slice(src.indexOf('update tickets t set profit_cents'))

    expect(lucro.length, 'o seed não calcula mais o lucro da comanda').toBeGreaterThan(0)
    expect(lucro, 'o desconto tem que entrar na conta').toMatch(/greatest\(0,\s*t\.subtotal_cents\s*-\s*t\.discount_cents\)/)
    for (const parcela of ['material_cost_cents', 'fee_cents', 'commission_cents']) {
      expect(lucro, `${parcela} não está sendo descontado do lucro`).toMatch(new RegExp(`-\\s*t\\.${parcela}`))
    }
    // A gorjeta é 100% do profissional: se entrar aqui, vira lucro que o salão nunca viu.
    expect(lucro, 'a gorjeta não pode entrar no lucro do salão').not.toMatch(/tip_cents/)
  })

  it('confere o dinheiro, o estoque e a agenda ao terminar', () => {
    const conferencia = sql().slice(sql().lastIndexOf('commit;'))
    expect(conferencia, 'nada guarda "sobrou mais que entrou"').toMatch(/sobrou_mais_que_entrou/)
    expect(conferencia, 'nada guarda estoque negativo').toMatch(/estoque_negativo/)
    // A tela "Hoje" é a inicial do app. Abrir vazia já aconteceu duas vezes.
    expect(conferencia, 'nada guarda a agenda de hoje').toMatch(/agenda_de_hoje/)
    expect(conferencia, 'nada guarda horário fora do expediente').toMatch(/fora_do_horario/)
    // Timeline impossível: cliente com visita antes do próprio cadastro. Aconteceu com ~6% da
    // carteira porque o `created_at` inicial era estimativa e o jitter da cadência o furava.
    expect(conferencia, 'nada guarda visita antes do cadastro').toMatch(/visita_antes_do_cadastro/)
  })

  it('nenhuma mensagem nasce na fila de envio', () => {
    /*
     * `queued` é o único status de `messages` que um disparador pega. Mensagem de demonstração com
     * esse status vira mensagem de VERDADE para um telefone brasileiro plausível — e os 310
     * telefones desta carteira são gerados, não são de ninguém que pediu para receber nada.
     *
     * Os tenants de demonstração já são pulados em `lembretes.ts` e no cron de campanha. Esta é a
     * segunda trava, e existe porque a primeira depende de alguém lembrar de manter uma lista.
     */
    const src = sql()
    const inserts = src.split('insert into messages').slice(1)
    expect(inserts.length, 'o seed não insere mais mensagem').toBeGreaterThan(0)
    for (const bloco of inserts) {
      const corpo = bloco.slice(0, bloco.indexOf(';'))
      expect(corpo, 'mensagem de demonstração não pode nascer em `queued`').not.toMatch(/'queued'/)
    }
    // E a conferência final tem que olhar o banco de verdade, não só o texto do script.
    expect(src.slice(src.lastIndexOf('commit;'))).toMatch(/mensagem_na_fila_de_envio/)
  })

  it('o saldo de estoque sai do extrato, não de número digitado', () => {
    // Saldo digitado e extrato discordando é estoque que "some" sem nenhum lançamento que
    // justifique — o mesmo defeito de fonte dupla do livro-caixa.
    const src = sql()
    const saldo = src.slice(src.lastIndexOf('update products p set stock_qty'))
    expect(saldo.length, 'o seed não deriva mais o saldo dos movimentos').toBeGreaterThan(0)
    expect(saldo).toMatch(/from stock_moves/)
  })


  it('o pacote é comprado para o serviço que a cliente já faz', () => {
    /*
     * A primeira versão sorteava o serviço do pacote e produziu 9 de 13 pacotes comprados e NUNCA
     * usados: ninguém compra 10 sessões de algo que nunca fez, e o extrato do pacote nascia vazio.
     * O `distinct on ... order by quantas desc` é o que escolhe o serviço mais consumido.
     */
    const src = sql()
    const i = src.indexOf('insert into packages')
    expect(i, 'o seed não cria mais pacote').toBeGreaterThan(-1)

    const antes = src.slice(0, i)
    expect(antes, 'o pacote precisa sair do serviço mais consumido, não de sorteio').toMatch(
      /order by client_id, quantas desc/,
    )
    // E a conferência final tem que olhar o banco, não só o texto do script.
    expect(src.slice(src.lastIndexOf('commit;'))).toMatch(/pacote_nunca_usado/)
  })

  it('orçamento fica vazio de propósito, e o script diz por quê', () => {
    // Barbearia e salão não mandam orçamento. Encher a tabela só para ela não ficar vazia é
    // fabricar um caso de uso que o nicho não tem — a demonstração passa a ensinar errado.
    const src = sql()
    expect(src, 'o seed não pode semear orçamento para beleza').not.toMatch(/insert into quotes/)
    expect(src, 'e a ausência precisa estar explicada, não ser esquecimento').toMatch(/quotes/)
  })

  it('a carteira tem quem experimentou e não voltou', () => {
    /*
     * Sem esse arquétipo a demonstração mostrava 91% a 96% de retorno, com 2 a 5 pessoas em toda
     * a base que vieram uma vez e sumiram. Salão nenhum tem isso — metade dos estreantes não
     * volta —, e um livro onde quase todo mundo voltou denuncia dado fabricado para qualquer
     * pessoa do ramo. É o mesmo erro de agregado da campanha que convertia 100%.
     *
     * E o filtro "Primeira visita sem volta" da lista de clientes, que é recurso REAL do
     * produto, nascia praticamente vazio.
     */
    const src = sql()
    /*
     * Delimitado ao INSERT que cria a tag, não ao arquivo. A primeira versão casava
     * `/'veio uma vez'/` solto e passou com o defeito de volta: a mesma string aparece no
     * `where` do insert de agendamentos, que a usa para achar esses clientes. Provar que a tag
     * é LIDA não prova que ela é ESCRITA.
     */
    const criacao = src.slice(src.lastIndexOf('insert into clients'))
    const ateOPontoEVirgula = criacao.slice(0, criacao.indexOf(';'))
    expect(ateOPontoEVirgula, 'o seed não cria mais quem veio uma vez só').toMatch(/'veio uma vez'/)

    // A quantidade tem que ser CALCULADA a partir da taxa de retorno, não um número fixo: com
    // número fixo a proporção muda sozinha quando o resto da carteira muda de tamanho.
    expect(src, 'a quantidade precisa sair da taxa de retorno alvo').toMatch(/voltaram\s*\/\s*0\.72/)

    // E o teto do plano grátis não pode ser estourado por dado de demonstração.
    expect(src, 'o teto de 50 clientes do plano grátis precisa ser respeitado').toMatch(/50\s*-\s*h\.clientes/)
  })

  it('tem clientes cadastrados nos últimos 2 dias, para novos_mes não ser 0 plano', () => {
    /*
     * `v_carteira_resumo.novos_mes` conta quem cadastrou desde o dia 1º. Toda a carteira nascia
     * com `created_at` de meses atrás → 0 em qualquer dia do mês, nas seis contas. Manchete
     * parecendo tela quebrada. Mesmo erro de calendário da campanha "este mês".
     *
     * A defesa durável: parte dos novos cadastrada nos ÚLTIMOS 2 DIAS, o que garante
     * `novos_mes > 0` em qualquer dia em que o seed rode — sem inventar pico de cadastro no
     * começo do mês.
     */
    const src = sql()

    // Chave `'quando'` só existe nesta seção. Recorto do `insert into clients` que a contém
    // até o `;` — não o arquivo inteiro. Casar solto pegaria a mesma string noutro lugar
    // (a lição da 6ª cegueira desta sessão).
    const marca = src.indexOf("'quando'")
    expect(marca, 'o seed não tem mais a seção de clientes novos deste mês').toBeGreaterThan(-1)
    const abre = src.lastIndexOf('insert into clients', marca)
    expect(abre, 'a chave quando não está dentro de um insert de clients').toBeGreaterThan(-1)
    const criacaoNovos = src.slice(abre, src.indexOf(';', marca))

    // >55% cadastrados nos últimos 2 dias, para `novos_mes > 0` em qualquer dia em que o seed
    // rode. Fração e janela explícitas — não um `rnd * 30` que às vezes cai perto do dia 1º.
    expect(criacaoNovos, 'a fração dos recém-cadastrados precisa ser explícita').toMatch(/'quando'\)\s*<\s*0\.55/)
    expect(
      criacaoNovos,
      'a janela curta tem que ser rnd*2 em days — 0 a 2 dias, não 0 a 20',
    ).toMatch(/'r'\)\s*\*\s*2\)\s*\|\|\s*' days'/)
  })
  it('deriva visitas e LTV dos agendamentos, em vez de somar por fora', () => {
    // Número que a tela mostra e número que o histórico prova precisam sair da MESMA fonte,
    // senão a demonstração se contradiz sozinha — é o defeito de `livro-caixa-fonte-unica`.
    /*
     * Delimitado pelo `;` do próprio comando, nunca até o fim do arquivo — mesma cegueira do
     * teste de cima, encontrada pela mesma mutação: com a fatia indo até EOF, trocar a tabela
     * DESTE update passava, porque o insert de `loyalty_entries` lá embaixo também diz
     * `from appointments a`. Duas guardas cegas no mesmo arquivo, as duas pela mesma causa.
     */
    const src = sql()
    const inicio = src.indexOf('update clients c set visits_count')
    expect(inicio, 'o seed não deriva mais visits_count dos agendamentos').toBeGreaterThan(-1)

    const update = src.slice(inicio, src.indexOf(';', inicio))

    expect(update, 'as visitas têm que vir da tabela de agendamentos').toMatch(/from appointments a\b/)
    expect(update, 'e contar só o que foi concluído de verdade').toMatch(/filter \(where a\.status = 'done'\)/)
  })
})
