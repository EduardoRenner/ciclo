import { describe, expect, it } from 'vitest'

import { motivoDaRecusa } from '@/core/auth/motivo-da-recusa'

/**
 * A regra que decide se a tela de login diz "sua senha está errada" ou "o problema não é seu".
 *
 * Ela existe porque a versão anterior dizia a primeira coisa SEMPRE. Em 02/09/2026 o Auth deste
 * projeto respondia `captcha_failed` (proteção ligada no painel do Supabase sem o app mandar
 * token) e todo mundo via "E-mail ou senha não conferem" — falha de configuração que tranca a
 * base inteira, vestida de erro individual.
 *
 * As duas direções são testadas de propósito. Só a metade "não é credencial" deixaria passar uma
 * implementação que respondesse "o problema não é seu" para senha errada de verdade — que é o
 * defeito oposto, e pior: convida a insistir numa senha que nunca vai funcionar.
 */
describe('o motivo da recusa de login', () => {
  it('senha errada é credencial', () => {
    expect(motivoDaRecusa('invalid_credentials')).toBe('credencial')
  })

  it('captcha mal configurado NÃO é credencial', () => {
    // O caso real. A pessoa não tem como resolver retipando a senha.
    expect(motivoDaRecusa('captcha_failed')).toBe('outro')
  })

  it('e-mail não confirmado fica em credencial — de propósito, e o preço é conhecido', () => {
    /*
     * Não porque seja senha errada. É porque revelá-lo diria que a CONTA EXISTE, e o
     * `/api/v1/auth/signup` desta base responde igual para e-mail novo e e-mail já cadastrado
     * justamente para não dizer isso. Contar aqui desfaria aquela decisão por uma porta lateral.
     *
     * Este teste existe para que mudar isso seja uma DECISÃO, e não um efeito colateral de
     * alguém achando a mensagem ruim para o usuário — ela é ruim mesmo, e é o preço.
     */
    expect(motivoDaRecusa('email_not_confirmed')).toBe('credencial')
  })

  it('conta banida também não vaza', () => {
    expect(motivoDaRecusa('user_banned')).toBe('credencial')
  })

  it('código DESCONHECIDO cai no comportamento antigo, nunca no novo', () => {
    /*
     * Esta é a asserção que impede um vazamento futuro, e ela quase não existiu: a primeira versão
     * desta regra tratava desconhecido como "não é credencial". Bastaria o GoTrue inventar um
     * `user_not_found` para o login começar a entregar a lista de quem tem cadastro — sozinho, sem
     * ninguém decidir isso.
     *
     * A mensagem antiga é a que não vaza, porque é idêntica para conta que existe e conta que não
     * existe. Logo, é ela que tem que ser o default.
     */
    expect(
      motivoDaRecusa('user_not_found'),
      'um código específico de conta não pode ganhar tratamento especial sozinho',
    ).toBe('credencial')
    expect(motivoDaRecusa('algum_codigo_que_o_gotrue_ainda_nao_inventou')).toBe('credencial')
    expect(motivoDaRecusa(null), 'sem código, comportamento antigo').toBe('credencial')
    expect(motivoDaRecusa(undefined), 'sem código, comportamento antigo').toBe('credencial')
    expect(motivoDaRecusa(''), 'string vazia é ausência de código').toBe('credencial')
  })

  it('outras falhas de CONFIGURAÇÃO do projeto também não são da pessoa', () => {
    // Todas trancam a base inteira igual, e nenhuma depende de a conta existir.
    for (const codigo of ['over_email_send_rate_limit', 'email_provider_disabled', 'signup_disabled']) {
      expect(motivoDaRecusa(codigo), `${codigo} deveria ser 'outro'`).toBe('outro')
    }
  })
})
