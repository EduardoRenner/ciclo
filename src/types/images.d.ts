/**
 * Achado no CI (Qualidade, PR #19): `next-env.d.ts` é gerado automaticamente pelo Next.js e está
 * no `.gitignore` — só existe depois que algum comando `next` (dev/build) roda uma vez. No
 * checkout limpo do CI, `pnpm typecheck` (raw `tsc --noEmit`) é o primeiro passo do job
 * "Qualidade" e roda ANTES de `pnpm build`, então o arquivo ainda não existe: `import wordmark
 * from '.../marca/....png'` (primeiro import de imagem local como módulo neste projeto) falhava
 * com "Cannot find module" só no CI, nunca localmente (onde `next-env.d.ts` já tinha sido gerado
 * por um build anterior).
 *
 * Esta linha é o mesmo conteúdo que `next-env.d.ts` referencia — mas comprometida no repo, então
 * não depende da ordem dos passos do CI nem de alguém já ter rodado `next build` na máquina.
 */
/// <reference types="next/image-types/global" />
