import dotenv from 'dotenv'

/**
 * Achado da auditoria de 2026-08-28. `CLAUDE.md` manda rodar `pnpm verify` antes de TODO commit,
 * e manda nunca pular `pnpm test:rls`. Os dois chamam as 44 suítes de `tests/integration` e
 * `tests/rls`, que abrem o Supabase com a `SUPABASE_SERVICE_ROLE_KEY` lida de `.env.local` — e o
 * `.env.local` desta máquina aponta para o projeto de **produção**, não para o `supabase start`
 * local. A CI acerta por outro caminho (injeta `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
 * antes de rodar); quem roda na própria máquina, seguindo a instrução escrita, cria tenant,
 * usuário no `auth.users`, profissional, agendamento e comanda no banco que atende cliente pagante.
 *
 * As suítes limpam atrás de si no `afterAll` — mas só quando terminam. Suíte que estoura no meio,
 * `Ctrl+C`, ou queda de rede deixa o lixo lá, com `service_role` e sem RLS no caminho.
 *
 * Por que aqui e não dentro de cada arquivo: são 44 arquivos, e a proteção que depende de alguém
 * lembrar de repetir em cada arquivo novo é a mesma que já falhou 44 vezes. Este arquivo entra
 * pelos scripts `test:integration` e `test:rls` do `package.json`, e
 * `tests/unit/server/teste-nao-toca-producao.test.ts` reprova se alguém tirar de lá.
 *
 * `dotenv.config` não sobrescreve variável que já existe no ambiente — então a CI, que exporta a
 * URL local antes, continua passando por aqui sem nem tocar no `.env.local`.
 */
dotenv.config({ path: '.env.local' })

const URL_DO_BANCO = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ESCAPE = 'PERMITIR_BANCO_REMOTO'

/** `127.0.0.1`, `localhost` e `[::1]`, com ou sem porta. Qualquer outra coisa é banco de gente. */
const E_LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/i.test(URL_DO_BANCO)

if (URL_DO_BANCO && !E_LOCAL && process.env[ESCAPE] !== '1') {
  throw new Error(
    `Estes testes escrevem no banco com a chave de serviço, e NEXT_PUBLIC_SUPABASE_URL aponta ` +
      `para ${URL_DO_BANCO} — que não é o Supabase local.\n\n` +
      `Suba o banco de teste com \`supabase start\` e rode de novo: o \`supabase status\` mostra a ` +
      `URL (http://127.0.0.1:54321) e a chave de serviço para pôr no .env.local.\n\n` +
      `Se você REALMENTE quer rodar contra este banco — e ele não é o de produção — repita com ` +
      `${ESCAPE}=1.`,
  )
}
