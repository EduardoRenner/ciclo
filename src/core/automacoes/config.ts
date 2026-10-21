import { AUTOMACOES, nivelEfetivo, type ChaveAutomacao, type NivelAutonomia } from '@/core/automacoes/catalogo'

/**
 * Como o nível de cada automação fica guardado em `tenants.settings.automacoes`, e como se lê.
 *
 * Mesmo desenho de `lerConfigFidelidade`: **nunca lança**. Tenant antigo não tem a chave, tenant
 * com JSON estranho não pode derrubar a tela de configuração — o que não dá para entender vira o
 * padrão de fábrica (nível 1), que é o valor seguro por definição.
 */
export type ConfigAutomacoes = Record<ChaveAutomacao, NivelAutonomia>

export function lerConfigAutomacoes(settings: unknown): ConfigAutomacoes {
  const bruto =
    settings && typeof settings === 'object'
      ? ((settings as Record<string, unknown>).automacoes as Record<string, unknown> | undefined)
      : undefined

  const saida = {} as ConfigAutomacoes
  for (const a of AUTOMACOES) {
    // `nivelEfetivo` aplica o teto: valor guardado acima do máximo é cortado, não obedecido.
    saida[a.chave] = nivelEfetivo(a, bruto?.[a.chave])
  }
  return saida
}

/**
 * Se a automação pode AGIR sozinha (nível 3, "Faz e me conta") neste negócio (docs/112 EXP-A01).
 *
 * Até 21/10/2026 o dial da tela Automações gravava e nada lia: lembrete e campanha mandariam no
 * nível 1 ("Só me avisa") assim que a rota fosse agendada. Quem manda mensagem sozinho pergunta
 * aqui antes. O padrão de fábrica é 1, então nada sai sozinho sem a dona subir o dial.
 */
export function fazSozinha(settings: unknown, chave: ChaveAutomacao): boolean {
  return lerConfigAutomacoes(settings)[chave] === 3
}
