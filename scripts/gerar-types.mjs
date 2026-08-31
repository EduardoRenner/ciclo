#!/usr/bin/env node
/**
 * Gera `src/server/db/types.gen.ts` SEM poder destruí-lo.
 *
 * O script era um redirecionamento direto:
 *
 *   supabase gen types typescript --project-id $SUPABASE_PROJECT_REF > src/server/db/types.gen.ts
 *
 * O `>` do shell TRUNCA o arquivo antes de o comando rodar. E `SUPABASE_PROJECT_REF` só existe na
 * Vercel — na máquina de quem desenvolve ela é vazia (conferido em 31/08). Ou seja: `pnpm db:types`
 * na máquina errada apagava 3.590 linhas de tipos de que o app inteiro depende, e devolvia no lugar
 * a mensagem de erro do próprio comando. Já aconteceu nesta base e foi recuperado do git.
 *
 * Aqui o arquivo só é tocado DEPOIS de a saída existir e passar por checagem. Falha ruidosa antes
 * de qualquer escrita é a diferença entre "não deu certo" e "perdi o arquivo".
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const DESTINO = 'src/server/db/types.gen.ts'
const LOCAL = process.argv.includes('--local')

function morrer(msg) {
  console.error(`\n[db:types] ${msg}\n`)
  process.exit(1)
}

const ref = process.env.SUPABASE_PROJECT_REF
if (!LOCAL && !ref) {
  morrer(
    'SUPABASE_PROJECT_REF não está definida.\n' +
      'Ela só existe na Vercel — para gerar contra o banco LOCAL, use `pnpm db:types:local`\n' +
      '(precisa de `supabase start` antes). Nenhum arquivo foi tocado.',
  )
}

const args = LOCAL
  ? ['gen', 'types', 'typescript', '--local']
  : ['gen', 'types', 'typescript', '--project-id', ref]

let saida
try {
  saida = execFileSync('supabase', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
} catch (erro) {
  morrer(`o comando \`supabase ${args.join(' ')}\` falhou:\n${erro.stderr || erro.message}\nNenhum arquivo foi tocado.`)
}

/*
 * As três checagens existem porque o modo de falha do `supabase gen types` NÃO é sair com código
 * de erro — ele às vezes imprime um JSON de erro no stdout e sai com 0. Sem isto, o "conserto"
 * escreveria o erro no arquivo com a mesma naturalidade com que escreveria os tipos.
 */
if (saida.trim().length < 1000) morrer(`a saída veio com ${saida.trim().length} caracteres — curta demais para ser o arquivo de tipos. Nada foi tocado.`)
if (!saida.includes('export type Json')) morrer('a saída não parece o arquivo de tipos (falta `export type Json`). Nada foi tocado.')
if (!saida.includes('tenants:')) morrer('a saída não menciona a tabela `tenants` — banco vazio ou resposta de erro. Nada foi tocado.')

const antes = readFileSync(DESTINO, 'utf8')
writeFileSync(DESTINO, saida)
console.log(`[db:types] ${DESTINO} atualizado (${antes.split('\n').length} → ${saida.split('\n').length} linhas).`)
