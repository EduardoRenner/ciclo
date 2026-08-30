import { describe, expect, it } from 'vitest'

import { AUTOMACOES, nivelEfetivo, niveisDisponiveis, rodaDeVerdade, acharAutomacao } from '@/core/automacoes/catalogo'
import { lerConfigAutomacoes } from '@/core/automacoes/config'
import { ROTAS_AGENDADAS } from '@/core/cron/agendadas'

/**
 * As regras do dial de autonomia (`docs/33 §3`) que NÃO podem virar decoração de componente.
 * Todas exercitam as funções que a tela e a rota chamam de verdade — não uma cópia da lógica
 * aqui dentro, que foi como duas guardas cegas nasceram nesta base.
 */
describe('dial de autonomia', () => {
  it('padrão de fábrica é sempre o nível 1 — nunca automatizar em silêncio', () => {
    // Tenant novo (sem `settings`), tenant com settings vazio, e lixo: os três caem no 1.
    for (const entrada of [undefined, null, {}, { automacoes: null }, { automacoes: 'sim' }]) {
      const config = lerConfigAutomacoes(entrada)
      for (const a of AUTOMACOES) expect(config[a.chave], `${a.chave} com ${JSON.stringify(entrada)}`).toBe(1)
    }
  })

  it('valor guardado acima do teto é CORTADO, não obedecido', () => {
    // O caso que importa: campanha alcança várias pessoas de uma vez (régua (d) do §2.1) e por
    // isso o teto é 2. Um `settings` editado à mão pedindo 3 não pode virar envio em lote.
    const campanha = acharAutomacao('campanha_de_recuperacao')!
    expect(campanha.nivelMaximo).toBe(2)
    expect(nivelEfetivo(campanha, 3)).toBe(2)
    expect(lerConfigAutomacoes({ automacoes: { campanha_de_recuperacao: 3 } }).campanha_de_recuperacao).toBe(2)
  })

  it('entrada inválida nunca vira nível válido por acidente', () => {
    const lembrete = acharAutomacao('lembrete_de_agendamento')!
    for (const lixo of [0, -1, 1.5, NaN, 'três', null, undefined, {}]) {
      expect(nivelEfetivo(lembrete, lixo), `lixo: ${JSON.stringify(lixo)}`).toBe(1)
    }
  })

  it('o dial só oferece nível que a automação alcança — sem posição vazia', () => {
    for (const a of AUTOMACOES) {
      const opcoes = niveisDisponiveis(a)
      expect(opcoes.length, `${a.chave} sem nenhuma opção`).toBeGreaterThan(0)
      expect(Math.max(...opcoes), `${a.chave} oferece além do teto`).toBe(a.nivelMaximo)
    }
  })

  it('"ativa" reflete ROTAS_AGENDADAS, não o desejo — é o que impede a mentira da tela de mensagens', () => {
    const lembrete = acharAutomacao('lembrete_de_agendamento')!
    const campanha = acharAutomacao('campanha_de_recuperacao')!
    // Enquanto `reminders`/`campaigns` estiverem fora do schedule, a tela TEM que dizer "parada".
    expect(rodaDeVerdade(lembrete)).toBe(ROTAS_AGENDADAS.includes('reminders'))
    expect(rodaDeVerdade(campanha)).toBe(ROTAS_AGENDADAS.includes('campaigns'))
    // E o que não depende de rota agendada roda de verdade — o resumo é calculado ao abrir a tela.
    expect(rodaDeVerdade(acharAutomacao('resumo_proativo')!)).toBe(true)
  })

  it('toda automação com teto abaixo de 3 explica por quê', () => {
    // Guarda contra o próprio detector: sem isso alguém baixa um teto e o dial trava mudo, e o
    // dono vai procurar um upgrade de plano que não existe.
    for (const a of AUTOMACOES) {
      if (a.nivelMaximo < 3) expect(a.motivoDoTeto, `${a.chave} trava sem dizer por quê`).toBeTruthy()
    }
  })
})
