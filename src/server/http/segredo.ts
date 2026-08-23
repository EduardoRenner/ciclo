import { timingSafeEqual } from 'node:crypto'

/**
 * Comparação de segredo que não vaza, pelo tempo de resposta, quantos bytes iniciais bateram.
 *
 * As seis rotas de `/api/cron/*` comparavam com `!==`, que sai no primeiro byte diferente —
 * enquanto `token-assinado.ts`, no mesmo código, já fazia certo com `timingSafeEqual`. Era
 * inconsistência do projeto consigo mesmo, não uma exploração realista: atacar isso por HTTPS,
 * contra comparação de string em JavaScript, com o ruído de rede da Vercel no meio, é muito
 * difícil. Corrigido porque custa uma linha e o padrão certo já existia ao lado.
 *
 * `timingSafeEqual` exige buffers do mesmo tamanho — comparar o tamanho antes já vaza o
 * comprimento, que não é segredo (e não dá para evitar sem hash). O que importa é não vazar o
 * *conteúdo*.
 */
export function compararSegredo(recebido: string | null | undefined, esperado: string | undefined): boolean {
  if (!esperado || !recebido) return false
  const a = Buffer.from(recebido, 'utf8')
  const b = Buffer.from(esperado, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
