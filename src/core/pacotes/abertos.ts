import { ADVOCACIA_ABERTA } from './advocacia-aberta'
import type { SlugDoPacote } from './tipos'

/**
 * Quais pacotes aceitam conta nova (docs/101 T0.6). `base` sempre: é o produto de hoje.
 *
 * Duas leitoras, e as duas precisam concordar: a tela de cadastro (só lista profissão de pacote
 * aberto, para ninguém escolher a profissão e descobrir no envio que não podia, que é beco sem saída
 * no pior lugar do funil, `0078`) e o serviço de onboarding (recusa no servidor, para quem chama a
 * API direto). `aberta` é parâmetro só para o teste; em produção vale a chave.
 */
export function pacoteAberto(pacote: SlugDoPacote, aberta: boolean = ADVOCACIA_ABERTA): boolean {
  return pacote === 'base' || (pacote === 'advocacia' && aberta)
}

export function pacotesAbertos(aberta: boolean = ADVOCACIA_ABERTA): SlugDoPacote[] {
  return (['base', 'advocacia'] as const).filter((p) => pacoteAberto(p, aberta))
}
