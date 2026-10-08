/**
 * docs/101 T5.3 (anexo 04, tabela de estados): o que a pessoa lê quando uma escrita jurídica não grava.
 *
 * Três estados têm frase própria porque pedem ações diferentes, e nas três o que foi digitado FICA na tela:
 *  - sem conexão: nada vai para a fila offline (prazo gravado depois, com a data velha, é o risco que a
 *    §3.6 do plano descarta). A pessoa tenta de novo quando a conexão voltar;
 *  - sessão expirada: entrar de novo em OUTRA aba e voltar. Não guardamos rascunho no navegador: texto
 *    de caso sigiloso não pode sobrar no `sessionStorage` de um computador compartilhado do escritório;
 *  - conflito de `row_version`: a tela se atualiza por baixo (`router.refresh` preserva o estado) e a
 *    pessoa confere antes de salvar de novo. "Recarregue", como o servidor diz, apagaria o digitado.
 */

export type TipoDeFalha = 'sem_conexao' | 'sessao' | 'conflito' | 'recusada'
export type FalhaDeEscrita = { tipo: TipoDeFalha; texto: string }

export const TEXTO_SEM_CONEXAO = 'Sem conexão: nada foi gravado. O que você digitou continua aqui; tente de novo quando a conexão voltar.'
export const TEXTO_SESSAO = 'Sua sessão terminou. Abra o CICLO em outra aba, entre de novo e volte aqui para salvar: o que você digitou continua nesta tela.'
export const TEXTO_SEGUNDO_FATOR =
  'Falta confirmar o código de verificação. Abra o CICLO em outra aba, confirme e volte aqui para salvar: o que você digitou continua nesta tela.'
export const TEXTO_CONFLITO = 'Alguém alterou isto enquanto você editava. A tela já mostra a versão atual e o que você digitou continua aqui: confira e salve de novo.'

/** O corpo de erro da API (`docs/02-API.md §1`), já lido. `null` quando a resposta nem chegou. */
export type RespostaDeErro = { status: number; code?: string; message?: string; campos?: Record<string, string> } | null

export function explicarFalha(r: RespostaDeErro, padrao: string): FalhaDeEscrita {
  if (r === null) return { tipo: 'sem_conexao', texto: TEXTO_SEM_CONEXAO }
  if (r.status === 401) return { tipo: 'sessao', texto: r.code === 'MFA_REQUIRED' ? TEXTO_SEGUNDO_FATOR : TEXTO_SESSAO }
  // Só o CONFLICT é o de versão; outro 409 (horário tomado, por exemplo) tem a frase do servidor.
  if (r.status === 409 && r.code === 'CONFLICT') return { tipo: 'conflito', texto: TEXTO_CONFLITO }
  const campo = r.campos ? Object.values(r.campos)[0] : undefined
  return { tipo: 'recusada', texto: campo ?? r.message ?? padrao }
}

/** As rotas cuja escrita nunca entra na fila offline. Fonte única para o `apiFetch` e para a guarda. */
export function ehEscritaJuridica(url: string): boolean {
  const caminho = url.replace(/^https?:\/\/[^/]+/, '').split(/[?#]/)[0]!
  return caminho.startsWith('/api/v1/legal/') || caminho === '/api/v1/tenant/advocacia'
}
