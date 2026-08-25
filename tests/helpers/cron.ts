import { readFileSync } from 'node:fs'

/**
 * Se uma rota de cron roda sozinha em produção.
 *
 * Mora aqui, e não dentro de um dos testes, porque DOIS testes de copy dependem da mesma resposta
 * — a da home e a do agendamento público — e a resposta precisa ser a mesma nos dois. Quando ela
 * estava duplicada, a primeira cópia foi escrita lendo o arquivo errado (`vercel.json`, que tem
 * `crons: []` de propósito e para sempre, porque o agendador é o GitHub Actions — `docs/18` §L.5).
 *
 * `core/` seria o lugar natural se não houvesse I/O; como há leitura de arquivo, fica em `tests/`.
 */
export function rotaDeCronAgendada(rota: string): boolean {
  const yml = readFileSync('.github/workflows/cron.yml', 'utf8')
  const bloco = yml.split(/^jobs:/m)[0]!
  // Sem horário no `on:`, nada roda sozinho, por mais que a matriz liste a rota.
  if (!/^\s*-\s*cron:/m.test(bloco)) return false

  const matriz = yml.match(/rota:\s*\[([^\]]+)\]/)
  if (!matriz) return false
  return matriz[1]!.split(',').map((r) => r.trim()).includes(rota)
}
