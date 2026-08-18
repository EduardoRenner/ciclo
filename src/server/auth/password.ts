import { createHash } from 'node:crypto'

import { AppError } from '@/server/http/errors'

/** `docs/05-FAQ-DEV.md` C38: mínimo 10, sem exigência de símbolo — símbolo obrigatório piora senha. */
export const SENHA_MINIMA = 10

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

export type ProblemaSenha = 'curta' | 'comum' | 'vazada'

const MENSAGENS: Record<ProblemaSenha, string> = {
  curta: `Use pelo menos ${SENHA_MINIMA} caracteres. Uma frase curta funciona bem.`,
  comum: 'Essa senha é fácil de adivinhar. Escolha algo que só você usaria.',
  vazada: 'Essa senha já apareceu em vazamentos públicos. Escolha outra.',
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

type Buscador = (url: string, init?: RequestInit) => Promise<Response>

/**
 * HIBP por k-anonymity: mandamos os 5 primeiros caracteres do SHA-1 e comparamos
 * o resto aqui. A senha nunca sai da máquina, nem em hash inteiro.
 *
 * Devolve `null` quando o HIBP não respondeu — quem chama decide, e a decisão
 * registrada em `docs/DECISOES.md` é deixar passar: derrubar o cadastro porque um
 * terceiro caiu é pior que aceitar uma senha que ainda passou no teste local.
 */
export async function senhaVazada(senha: string, buscar: Buscador = fetch): Promise<boolean | null> {
  const hash = createHash('sha1').update(senha, 'utf8').digest('hex').toUpperCase()
  const prefixo = hash.slice(0, 5)
  const sufixo = hash.slice(5)

  try {
    const r = await buscar(`https://api.pwnedpasswords.com/range/${prefixo}`, {
      // Padding faz a resposta ter tamanho variável de propósito: sem ele, o
      // tamanho do corpo já entrega quantos hashes casam com o prefixo.
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(2500),
    })
    if (!r.ok) return null

    for (const linha of (await r.text()).split('\n')) {
      const [candidato, contagem] = linha.trim().split(':')
      // O padding vem com contagem 0 e precisa ser ignorado.
      if (candidato === sufixo && contagem !== undefined && Number(contagem) > 0) return true
    }
    return false
  } catch {
    return null
  }
}

/** Aplica a política inteira. Lança `VALIDATION_ERROR` no campo `password`. */
export async function exigirSenhaForte(senha: string, buscar: Buscador = fetch): Promise<void> {
  const local = avaliarSenhaLocal(senha)
  if (local) throw AppError.validacao({ password: MENSAGENS[local] })

  const vazada = await senhaVazada(senha, buscar)
  if (vazada === null) {
    console.warn(JSON.stringify({ level: 'warn', event: 'hibp_indisponivel' }))
    return
  }
  if (vazada) throw AppError.validacao({ password: MENSAGENS.vazada })
}
