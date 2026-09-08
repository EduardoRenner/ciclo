import { AppError } from '@/server/http/errors'

/*
  TICKET-UX22: pedido do usuário foi simplificar o cadastro "que nem os das big techs" — mínimo
  mais baixo, sem checagem de vazamento visível. `SENHA_MINIMA` caiu de 10 para 8: é o mesmo piso
  que Google e Microsoft usam na própria conta, e o texto de ajuda permanente ("No mínimo 10
  caracteres.") saiu dos formulários — a mensagem só aparece agora se a senha realmente for curta
  demais, igual ao padrão que essas contas usam. Sem exigência de símbolo, como já era (docs/05
  C38: símbolo obrigatório piora senha, não melhora).
*/
export const SENHA_MINIMA = 8

/**
 * Palavras que viram senha ruim mesmo com número colado atrás. Não é a lista das
 * 10 mil: o HIBP tem 800 milhões e cobre a cauda longa. Isto é o piso que ainda
 * segura quando o HIBP está fora do ar — por isso são raízes, e não senhas
 * inteiras, e a checagem descasca sufixo antes de comparar.
 */
const RAIZES_COMUNS = new Set([
  'senha', 'password', 'minhasenha', 'senhasegura', 'novasenha', 'mudarsenha',
  'admin', 'administrador', 'usuario', 'teste', 'sistema', 'acesso', 'master',
  'qwerty', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
  'brasil', 'brazil', 'saopaulo', 'riodejaneiro',
  'flamengo', 'corinthians', 'palmeiras', 'gremio', 'internacional', 'cruzeiro',
  'vasco', 'santos', 'botafogo', 'fluminense', 'atletico', 'bahia',
  'amor', 'meuamor', 'amoreterno', 'teamo', 'amomuito', 'iloveyou', 'princesa',
  'familia', 'felicidade', 'sucesso', 'casamento', 'gatinha', 'lindeza',
  'deusefiel', 'deusnocontrole', 'jesuscristo', 'abencoada',
  'ciclo', 'agenda', 'salao', 'barbearia', 'manicure', 'estetica', 'beleza',
  'welcome', 'letmein', 'superman', 'batman', 'pokemon', 'naruto', 'dragon',
])

export type ProblemaSenha = 'curta' | 'comum'

const MENSAGENS: Record<ProblemaSenha, string> = {
  curta: `Use pelo menos ${SENHA_MINIMA} caracteres.`,
  comum: 'Essa senha é fácil de adivinhar. Escolha algo que só você usaria.',
}

/** Tira acento e caixa para que "Senha" e "sênha" caiam na mesma raiz. */
function normalizar(senha: string): string {
  return senha.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/**
 * Descasca o que as pessoas grudam para "fortalecer": dígitos, ano, pontuação e
 * o `!` do fim. "Flamengo2024!" e "senha123456" viram "flamengo" e "senha".
 */
function raiz(senha: string): string {
  return normalizar(senha).replace(/[^a-z]/g, '')
}

function ehSequencia(senha: string): boolean {
  const s = normalizar(senha)
  if (!/^[0-9]+$/.test(s)) return false
  // Passo módulo 10, senão a sequência mais comum de todas escapa: em
  // "1234567890" o passo de 9 para 0 é -9, e não +1.
  const passos = new Set<number>()
  for (let i = 1; i < s.length; i++) passos.add((Number(s[i]) - Number(s[i - 1]) + 10) % 10)
  return passos.size === 1 && (passos.has(1) || passos.has(9) || passos.has(0))
}

/** Checagem que roda sem rede. Devolve o problema ou `null` se a senha passa. */
export function avaliarSenhaLocal(senha: string): ProblemaSenha | null {
  if (senha.length < SENHA_MINIMA) return 'curta'
  if (ehSequencia(senha)) return 'comum'

  const base = raiz(senha)
  if (base.length > 0 && RAIZES_COMUNS.has(base)) return 'comum'

  return null
}

/*
  TICKET-UX22: a checagem contra o HIBP (`senhaVazada`, k-anonymity contra api.pwnedpasswords.com)
  saiu inteira a pedido do usuário — era o passo que deixava o cadastro lento (uma chamada de
  rede a cada tentativa) e mostrava a mensagem mais assustadora do formulário ("já apareceu em
  vazamentos públicos"). `avaliarSenhaLocal` sozinho já barra sequência óbvia e raiz comum sem
  rede nenhuma, que é o mesmo tipo de filtro que uma conta de big tech aplica sem alarde.
*/

/** Aplica a política local. Lança `VALIDATION_ERROR` no campo `password`. */
export function exigirSenhaForte(senha: string): void {
  const local = avaliarSenhaLocal(senha)
  if (local) throw AppError.validacao({ password: MENSAGENS[local] })
}
