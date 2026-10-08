# 102 · Relatório da execução do plano de melhoria do CICLO base

> Branch `melhoria/base-2026-10-08` (worktree `ciclo-melhoria`, base `origin/feat/cortesia-2026-10-03`).
> Plano: `docs/102-MELHORIA-CICLO-BASE.md`. Evidência da fase 0: `docs/evidencias/M0-fase-0.md`.
> Tudo medido no banco local e no dev server da branch (porta 3019), salão `demo-salao-encanto` e conta vazia
> `barbearia-teste-p5`. Nada foi aplicado em produção, nada foi mergeado.

## Veredito

Todos os tickets do plano estão feitos, exceto o que depende do Eduardo (seção "Com o Eduardo"). Cada
mudança que a pessoa vê foi medida no navegador antes e depois; cada guarda nova foi vista reprovando.

## O que mudou para quem usa

| Ticket | Antes (medido) | Depois (medido) |
|---|---|---|
| M0.1 service worker | URL assinada de mídia (outro host) ia para o cache do aparelho | outro host não passa pelo SW |
| M0.2 dependências | `pnpm audit --prod`: 2 altos, 4 moderados | nenhum |
| M0.3 banco | `anon` com privilégio em 59 tabelas; TRUNCATE em 58; 36 sem política de DELETE com DELETE concedido | 0, 0, 0 (migration 0117) |
| M0.3 LGPD | `eliminarCliente` pela sessão apagava 0 linhas de saúde e respondia "eliminado" | roda inteira com `service_role`; o teste prova que o dado some |
| M1.1 importar CSV | link de 16 px em duas linhas (o "0 × 0" do plano era falso positivo da sonda) | uma linha, 48 px |
| M1.2 Time | rolagem lateral de 77 px a 375; nome com 29 px | sem rolagem; 48 px |
| M1.3 faixa de conexão | cobria o logotipo ao rolar | gruda abaixo do cabeçalho |
| M1.4 botão travado | motivo invisível (só leitor de tela) | o toque mostra o motivo numa bolha; nada é enviado |
| M1.5 e M1.6 toque | 12 tipos de alvo entre 15 e 45 px em 11 telas | 48 px em todos, sondado |
| M1.7 Hoje vazio | "nada para hoje" três vezes | uma |
| M1.8 contraste | `--ok` 4,40:1 sobre o fundo claro | 4,57:1 |
| M1.9 404 do orçamento | aba "Pedir orçamento" sobre o corpo de 404 | título de 404 |
| M1.10 Novo agendamento | remarcar quem já é cliente exigia redigitar nome e telefone | duas letras sugerem da base; o toque preenche |
| M2.1 demonstração | o script de agenda aceitava qualquer salão e cobria 7 das 13 contas | só demonstração, as 13; runbook para agendar |
| M4.1 peso | `/entrar` 208 kB, `/cadastro` 209 kB | 141 e 142 kB |
| M5.1 copy | travessão por entidade em `/precos`; "sem prazo" no topo e "dias grátis acabando" nas perguntas; gênero suposto em dois rótulos e na lista da home | corrigidos |

## Guardas novas, vistas reprovando

| Guarda | Mutações que reprovaram |
|---|---|
| `tests/rls/privilegio-minimo.test.ts` (lê `privilegios_report()`) | DELETE de volta, `anon` de volta, TRUNCATE de volta, tabela nova sem regra |
| `lgpd.test.ts` (sessão) | eliminação voltando a usar o cliente de quem chamou |
| `service-worker.test.ts` | checagem de origem desligada |
| `botao-travado-mostra-o-motivo.test.ts` | sem `preventDefault`; `disabled` nativo de volta; `aria-disabled` sem eventos; regra com motivo virando nativo |
| `contraste.test.ts` (fundo da página) | reprovou com 4,40 antes do conserto |
| `agenda-futura-so-demonstracao.test.ts` | sem recusa; lista com 7; slug a mais |
| `login-social-carrega-no-clique.test.ts` | importação estática de volta |
| `copy-sem-travessao.test.ts` (entidade e escape) | `&mdash;` (antes do conserto), `&#8212;`, escape literal montado por `chr(92)` |

## O que a medição corrigiu no próprio plano

- O link de CSV "intocável" era falso positivo da sonda (link em duas linhas, centro da caixa entre elas). A
  sonda passou a medir cada linha do link.
- A primeira tentativa no trilho de pílulas (`-mt-1`) fez as pílulas cobrirem 2 px do link de cima em
  `/recuperar`. Desfeita: o trilho ganhou 4 px acima.
- A bolha do botão travado caía 15 px em cima do botão: `fixed` dentro de ancestral com `transform`. Vai por
  portal.
- A barra de confirmação do agendamento público, montada e invisível, era medida como alvo de 0 × 0. A sonda
  passou a ignorar `inert` e `aria-hidden`. Com a barra visível, o motivo aparece acima dela.

## Bateria final

Rodada final, no HEAD da branch, banco local compartilhado:

| Etapa | Resultado |
|---|---|
| typecheck e lint | ok |
| unitários | 355 arquivos, 3355 testes, todos passando |
| `pnpm build` | ok; base compartilhada 104 kB |
| RLS | 265 de 286; as **21** falhas são todas em tabelas `legal_*` da branch advocacia (inclusive a de estrutura, que acusa `legal_access_log`) |
| integração (sem paralelismo) | 479 de 481. Catálogo de profissões: 19 em vez de 18 (a "advocacia" da outra branch). `media.test.ts`: um `insert` de `clients` com `service_role` (que a 0117 não toca, arquivo sem mudança desde o TICKET-114) voltou sem linha no meio da rodada longa; o arquivo sozinho passa 10/10 em três execuções seguidas. Intermitente, o mesmo padrão da memória `suite-de-banco-intermitente-por-rate-limit`. |

## Com o Eduardo

- Aplicar a **0117** em produção (restritiva; nenhum código do base usa o que ela tira; conferido por busca).
- Agendar `scripts/seed-demo-agenda-futura.mjs` (runbook `docs/runbooks/demonstracao-sem-envelhecer.md`).
- Decidir a base se o PR #143 mudar.
- Fluxo OAuth de ponta a ponta depois do M4.1: precisa de provedor ligado no Supabase.

## Falhas que não são desta branch

No banco local compartilhado, tabelas `legal_*` da branch advocacia fazem a suíte de RLS desta branch
reprovar casos que ela não sabe semear, e a profissão "advocacia" faz o catálogo contar 19 em vez de 18. Nas
tabelas e no catálogo do base: zero falha.
