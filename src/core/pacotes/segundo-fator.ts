import { PACOTES } from './index'
import type { SlugDoPacote } from './tipos'

/**
 * A porta de segundo fator do painel (docs/101 §6.3, T0.4).
 *
 * O CICLO de beleza pede segundo fator por AÇÃO (`exigirAal2` no cofre, na exportação), porque o
 * dado sensível ali mora em poucos lugares. No escritório o caso inteiro é sigiloso: a porta é do
 * painel todo. Quem decide é o pacote (`exigeSegundoFator`), e a regra mora aqui, pura, para o
 * teste cobrir a tabela inteira sem servidor.
 *
 * `aal` é o nível que o Supabase devolve (`currentLevel`): `aal2` = sessão com segundo fator.
 * Qualquer outra coisa, inclusive valor que não reconheço, exige: errar para o lado de pedir o
 * fator trava uma pessoa (recuperável); errar para o outro abre o painel do escritório só com senha.
 */
export function exigeSegundoFator(pacote: SlugDoPacote, aal: string): boolean {
  return PACOTES[pacote].exigeSegundoFator && aal !== 'aal2'
}

/**
 * Para onde vai quem precisa ativar. A tela de Segurança NÃO passa por `contextoDoPainel` (usa só
 * `exigirSessao`), e é isso que impede o redirecionamento de virar laço. `motivo=pacote` é o que faz
 * a tela explicar por que a pessoa caiu ali.
 *
 * Limite conhecido: quem já tem fator cadastrado e mesmo assim está numa sessão `aal1` (sessão de
 * antes do cadastro do fator) cai aqui também, e o caminho é sair e entrar de novo: o login leva
 * quem tem fator para `/verificar`. A tela diz isso.
 */
export const ROTA_DO_SEGUNDO_FATOR = '/admin/config/seguranca?motivo=pacote'
