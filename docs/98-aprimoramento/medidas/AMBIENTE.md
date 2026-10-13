# Ambiente de medição (lido por todos os agentes) — PRONTO

- Worktree: `C:\Users\Usuario\.claude\code\ciclo-aprimoramento` (branch `aprimoramento/plano-2026-10-13`, base `origin/main` 33058dd0).
- Supabase: **local** (`127.0.0.1:54321`), refeito com `supabase db reset` (migrations 0001–0117 do main) + `scripts/seed-demo-6-negocios.mjs` (6 negócios demo). Produção NÃO pode ser tocada.
- **App: PRONTO em `http://localhost:3200`** — build de produção (`pnpm build` 10 min 12 s neste Windows, `pnpm start`). Não reinicie o servidor; não rode outro build nesta pasta.
- Login de demonstração (só local): `dono-demo-dom-estilo@ciclo.app` / `DemoCiclo#2026` (padrão `dono-<slug>@ciclo.app`). Logar pela tela real `/entrar` com Playwright e salvar o `storageState` FORA do repositório (`C:\temp\ciclo-medicao\estado-*.json`). Nunca gravar cookie/token em `docs/`.
- Páginas públicas de exemplo: `/demo-espaco-vitoria` e os outros slugs `demo-*` do seed.
- Playwright + `@axe-core/playwright`: instalados em `C:\temp\ciclo-medicao` (scripts podem ficar em `docs/98-aprimoramento/medidas/` e importar com caminho absoluto `file:///C:/temp/ciclo-medicao/node_modules/playwright/index.mjs`).
- Build log com tamanho por rota: `docs/98-aprimoramento/medidas/build.log`.
- Escrita permitida aos agentes: somente `docs/98-aprimoramento/`.
- Medidas de tempo: o servidor é local (sem latência de rede real até o banco); trate tempos como relativos e use a CONTAGEM de idas ao banco e as consultas em série como medida principal de servidor.
