# Runbook · publicar a branch de trabalho em fatias (P0 item 1 do `docs/87`)

**Escrito em 2026-09-30, medido contra o repositório de hoje, não deduzido.** Serve para uma coisa:
levar `melhoria/onboarding-inteligencia-2026-09-28` (mais a `melhoria/orcamento-e-motor-2026-09-27`)
para a `main` **sem derrubar produção com cliente real dentro**, em PRs pequenos, com as migrations
na ordem certa.

**O que eu não consigo ver daqui e marco `[verificar]`:** o estado do banco de produção (só o
painel da Supabase responde), o plano da Supabase e da Vercel, e o que o Vercel considera
"deploy anterior". Nada aqui afirma o estado de produção; o §4 dá as consultas que respondem.

**Este documento substitui `aplicar-migrations-pendentes.md` para o lote 0092 a 0098.** Aquele
runbook é de 2026-09-04 (`0058` a `0061`) e continua certo como exemplo, mas está velho.

---

## 0 · O que foi medido (resumo)

| Fato | Valor | Como conferir |
|---|---|---|
| Base comum | `main` = `d22bae27` (merge do PR #132, 2026-09-27) | `git rev-parse --short main` |
| Commits na branch de trabalho | **110** em `8d562193`; **113** hoje em `5787b4a8` (os 3 novos são só docs, da outra sessão que continua commitando) | `git rev-list --count main..HEAD` |
| O `docs/87` diz 107; o pedido dizia 109 | Todos desatualizados: cada commit de docs novo aumenta a conta. **Conte de novo no dia** | mesmo comando |
| A `main` está atrás | 110 commits (`HEAD..main` = 0: a branch não perdeu nada da `main`) | `git rev-list --count HEAD..main` |
| Arquivos / linhas | 309 arquivos, +18.769 / -1.302 (em `8d562193`) | `git diff --stat main..8d562193 \| tail -1` |
| Migrations no disco | `main` = 91 (`0001` a `0091`); branch de trabalho = 97 (sem `0092`); a `0092` está só na outra branch | `git ls-tree --name-only <ref> supabase/migrations/ \| wc -l` |
| Branches no `origin` | **Nenhuma das duas está no `origin`.** Só existem no disco desta máquina | `git ls-remote --heads origin` |
| Dependências / env / CI / `next.config` | **Nada mudou.** Zero linha em `package.json`, `.env.example`, `.github/`, `next.config.ts`, `vercel.json` | `git diff --name-only main..HEAD -- package.json pnpm-lock.yaml .env.example .github next.config.ts vercel.json` |
| Rotas e páginas novas | 4 páginas (`/admin/experimentos`, `/admin/clientes/exportar`, `/admin/clientes/vindo-de-outro-sistema`, `/onboarding/perfil`) e 4 rotas de API (`/api/v1/experiments`, `/api/v1/experiments/[id]/cancel`, `/api/v1/clients/export`, `/api/v1/onboarding/perfil`) | `git diff --name-status main..HEAD \| grep '^A.*\(page\|route\)'` |

### Os 6 achados que mudam o plano

1. **Existem DUAS migrations `0092` diferentes em branches locais**, e as duas criam a mesma coluna
   `client_cycles.sample_size` e recriam a mesma view `v_recover_revenue`. Uma é a do plano
   (`0092_ritmo_na_lista_de_recuperar`, em `melhoria/orcamento-e-motor-2026-09-27`). A outra é
   `0092_amostra_de_historico_do_ciclo`, em `loop/integracao-final` e em mais 4 branches `loop/rodada-*`
   (nascidas em 2026-09-22). Detalhe no §2.3.
2. **A `0093` desta branch desfaz a `0092`.** A `0093` recria `v_recover_revenue` com 12 colunas; a `0092` a
   deixa com 15. `create or replace view` não remove coluna, então aplicar `0092` e depois a `0093`
   **como estão** dá erro `42P16`; e aplicar a `0093` sem a `0092` e a `0092` depois **reverte em
   silêncio** o conserto BL-48 (serviço arquivado volta às telas de dinheiro). A `0093` precisa ser
   emendada antes de subir (§2.2).
3. **`supabase db push` não funciona em produção.** O livro de migrations de produção tem ~86 entradas
   com nomes de timestamp antigos e o `db push` recusa rodar (`DECISOES` 2026-09-16). O caminho que
   funcionou foi: SQL no painel, uma migration por vez, depois `supabase migration repair --status
   applied`. O `docs/87` diz "Eduardo roda `db push`"; leia como "aplica na mão, como em 16/09".
4. **Hoje é 30/09: o CI do banco reprova qualquer PR até 01/10.** O teste C-07 (`crm.test.ts`)
   quebra nos dias 29, 30 e 31 de todo mês (o `billing_day` só vai até 28). O conserto é o commit
   `ce4743c5`, de uma linha. Ele tem que estar no primeiro PR de código, senão o primeiro PR nasce
   vermelho por motivo que não é dele. Vale de novo em 29 a 31 de outubro.
5. **`public/marca/**` são 45 MB de material de divulgação** que o Next serve publicamente em
   `seuciclo.com.br/marca/...`, incluindo 15 scripts `.py`, 5 `.docx` e 6 `.pdf`. Não leve na mesma PR
   (§1.3).
6. **Existem 83 commits de outra pilha, também só locais**, em `loop/integracao-final`, com o conserto do
   defeito do `PATCH` (`.partial()` do Zod 4 reaplicando defaults, memória `zod4-partial-reaplica-default`).
   Esse defeito **continua vivo em produção** e o conserto não está em nenhum dos 110 commits daqui
   (`git grep parcialSemPadroes` acha só na `loop/integracao-final`). Fora do escopo deste runbook, mas o
   §2.3 e o §7 dizem o que fazer com a numeração.

---

## 1 · Inventário

Medido em `8d562193` (110 commits). `git log main..8d562193`. "Produção" = o commit toca `src/`,
`supabase/migrations/`, `package.json`, `next.config.ts` ou `vercel.json`.

### 1.1 Por tema

| Tema | Commits | Produção | Só teste/lint | Só docs | Hashes que importam |
|---|---:|---:|---:|---:|---|
| A. Motor não esquece + performance (BL-46/47/48; migrations `0093`, `0094`) | 7 | 3 | 2 | 2 | `46af6d57` (serviço arquivado, `0093`), `77278430` (RPC em lote, `0094`, 208x), `7b5e9664` (eliminar cliente apaga previsões) |
| B1. Auditoria BL-42: `writeAudit` fora da repetição idempotente em 50 rotas, mais regra de lint | 20 | 9 | 1 | 10 | `34a022c5` (1ª leva), `e3063bd2` (50 de 50, regra em "error"), `d76d93f5` (regra ESLint) |
| B2. Auditoria de armadilhas, regras de lint (dinheiro em centavos, append-only), 1 conserto de cron | 15 | 1 | 3 | 11 | `ca1cbb09` (cron `campaigns`), `a454450d`, `c7e4ee92` (regras de lint) |
| C. Onboarding e migração de outro sistema (`docs/83` P1, P2, P5, P6) | 10 | 4 | 0 | 6 | `5815bc5c`, `41f506a0`, `937d1cc0`, `e62d6023` |
| D. Importação, exportação e datas (`docs/83` P3, P4; BL-51, BL-52; migration `0096`) | 12 | 6 | 3 | 3 | `007bb25d` (CSV do Excel pt-BR), `b00193cb` (baixar a base), `2f78a103` (dia da última visita, `0096`), `b9a051b0` (BL-52) |
| E. Motor de Inteligência e assistente sem Gemini (`docs/85` MI-1 a MI-7) | 25 | 17 | 2 | 6 | `c3082b7d` (Motor de Conversa), `344a000a` (assistente roda no Motor), `933f7042` (MI-4), `98f843e8` (MI-5), `d4239a29` (MI-6), `49bc97f8` ("resolve") |
| F. Dados e produto (`docs/84`): demanda não atendida, mapa de vazamento, costume do cliente, serviço canônico, experimentos | 10 | 5 | 0 | 5 | `94bf264e`, `ba4abe1d`, `b6676bb7`, `4fefe4ad` (`0097`), `5ccbbe39` (`0098`) |
| G. Termos e privacidade com aceite versionado (BL-50; migration `0095`) | 1 | 1 | 0 | 0 | `e6efbdc9` |
| H. Interface e correções soltas | 4 | 3 | 1 | 0 | `b9c1c3b8` (senha na URL, segurança), `7769a171` (botão do assistente), `f09af0f4` ("14 clientes passaram da hora"), `ce4743c5` (teste C-07) |
| I. Docs de estratégia e lançamento (`docs/83` a `88`) | 5 | 0 | 0 | 5 | `63fdc275`, `31c39090`, `a4f4ceab`, `0560ab87`, `8d562193` |
| J. Materiais de marca (misturado com código) | 1 | 1 | 0 | 0 | `8e05904c` |
| **Total** | **110** | **50** | **12** | **48** | |

### 1.2 O que pode ir sem risco e o que não pode

| Classe | Commits | Risco de runtime |
|---|---:|---|
| Só docs (`docs/`, `.claude/ciclo/`) | **48** (51 hoje, contando os 3 novos) | Nenhum. Não entra no bundle |
| Só teste, regra de lint ou script | **12** | Não muda o app, **mas** regra de lint reprova o CI se o código que ela vigia não estiver junto (a regra BL-42 exige as 50 rotas consertadas; ver §3) |
| Tocam código de produção | **50** | Real. Destes, **6 carregam migration**: `46af6d57` (`0093`), `77278430` (`0094`), `e6efbdc9` (`0095`), `2f78a103` (`0096`), `4fefe4ad` (`0097`), `5ccbbe39` (`0098`) |

Os 50 de produção ainda se dividem: 9 são `writeAudit` mecânico em rotas (B1), 17 são o
assistente (E), 11 mexem em cadastro, importação e termos (C, D, G) e o resto é pontual.

**Quem é a mistura ruim:** `8e05904c` ("chore: commita import de CSV em pt-BR e materiais de marca
pendentes") junta 1 arquivo de código (`importador.tsx`, tema D) com 71 arquivos de `public/marca`.
Não se faz `cherry-pick` dele inteiro: leve só o `importador.tsx` (o §3 mostra como).

**Quem está fora de ordem:** `b6676bb7` ("a ficha e o assistente dizem o costume de cada cliente",
tema F) mexe em 8 arquivos do Motor de Inteligência e em `crm.ts` do onboarding. Vai junto do tema E
e depois do C, não com os dados. `f09af0f4` (tema H) mexe em `mapa-de-vazamento.ts`, que nasce no
`ba4abe1d` (tema F): vai com o mapa. `7769a171` (H) mexe em `admin/layout.tsx` depois do `344a000a`
(E): vai com o assistente. Uma checagem por arquivo (`git diff-tree` de cada commit) provou que o
agrupamento do §3 **não tem nenhum arquivo tocado por commit que ficou numa fatia posterior**. Uma
segunda checagem, por `import` (símbolo exportado por commit de outra fatia), achou **uma** dependência
que a de arquivo não vê: `ea2e9d36` (assistente, PR-7) importa `procurasEmDiaFechado` de
`server/services/demanda-nao-atendida.ts`, arquivo criado pelo `ba4abe1d` (mapa de vazamento, PR-10). Por
isso a PR-7 só entra **depois** da PR-10. Essa checagem só cobre `import { ... } from '@/...'`;
**o `pnpm typecheck` de cada fatia é o juiz final** (§3.4).

### 1.3 Binários grandes e `public/marca`

| Item | Medido |
|---|---|
| `public/marca/**` na `main` | 3 arquivos, 90 KB (`ciclo-icone-aqua.png`, `ciclo-wordmark-aqua.png`, `ciclo-wordmark-aqua-claro.png`), usados pelas páginas públicas |
| `public/marca/**` adicionado pela branch | **98 arquivos, ~45,2 MB**: 71 PNG (o maior, 1,18 MB), 15 `.py`, 6 PDF, 5 DOCX, 1 `.md` |
| `public/` inteiro | 1,15 MB na `main`, 46,3 MB na branch |
| Outro binário | `docs/modelo-financeiro-ciclo.xlsx`, 54 KB (não é problema) |
| Tamanho do repositório | pack já em 61,8 MiB. Mais 45 MB entram para sempre no histórico |

**Recomendação: NÃO leve `public/marca/**` nas PRs do app.**

1. Tudo em `public/` é servido por qualquer um em `seuciclo.com.br/marca/...`, inclusive `build_*.py`,
   `BRIEF-carrossel-diferencial.md` e os `.docx`. Não achei segredo nem caminho de máquina
   (varredura por `senha|token|secret|api_key|C:\Users|@gmail` nos 98 arquivos: só 2 falsos
   positivos em texto), mas é rascunho de marketing exposto sem motivo.
2. 45 MB de PNG de Instagram não têm nenhum uso pelo app (nenhum `import` deles em `src/`).
3. Vale o mesmo do memo de Vercel Hobby: quanto mais o deploy pesa, mais lenta a fila de 13 PRs.

Onde colocar em vez disso (decisão do Eduardo, `[decidir]`): (a) uma pasta fora do repositório
(Drive), a opção mais simples; (b) uma branch/repositório só de materiais, sem PR para a `main`;
(c) `docs/marketing/` (não é servido pelo Next) com PNG comprimidos. Se for (a) ou (b), **não** use
`git filter-repo` na branch de trabalho: basta que nenhuma fatia inclua o caminho.

Enquanto a decisão não sai, **os arquivos ficam no commit `8e05904c` da branch local** (que nunca vai
inteira para a `main`) e o §3 exclui `public/marca` com `:(exclude)public/marca`.

---

## 2 · Migrations, uma por uma

Regra da casa (memória `migration-que-tira-privilegio-inverte-a-ordem`): **aditiva sobe ANTES do
código; a que TIRA privilégio de algo que o código no ar usa sobe DEPOIS.** A pergunta que decide
não é "migration ou deploy primeiro", é: *o código que está no ar agora funciona com o banco depois
desta migration?*

**Resposta para as sete: sim.** Nenhuma tira coluna, tabela, política ou privilégio de que o código
da `main` dependa. Então **todas as sete sobem antes de qualquer PR de código.**

### 2.1 A tabela

| # | Arquivo | O que faz | Tipo | Mexe em linha existente? | Revoga privilégio? | Código velho contra banco migrado | Se NÃO subir antes do código novo |
|---|---|---|---|---|---|---|---|
| `0092` | `0092_ritmo_na_lista_de_recuperar` (**só na outra branch**) | `client_cycles.sample_size int not null default 0` e recria `v_recover_revenue` com 3 colunas novas no fim (`personal_cycle_days`, `last_visit_on`, `sample_size`) | Aditiva | Só o default `0` nas linhas existentes (não reescreve a tabela) | Não | Sem efeito: coluna a mais na view é ignorada pelo código velho. O recálculo velho não escreve `sample_size`, fica em `0` até o código novo rodar | Só a PR-12 quebra, e quebra feio: os dois `upsert` de `client_cycles` (`ciclo.ts`, `ciclo-de-quem-ja-atende.ts`) passam a escrever a coluna, e **todo recálculo do Motor falha** |
| `0093` | `0093_servico_arquivado_sai_das_telas_de_dinheiro` | Recria `v_recover_revenue` e `v_clientes_a_recuperar` com `and s.active` (serviço arquivado sai das duas telas de dinheiro) | Restritiva **só de linhas** (some linha da tela), não de privilégio | Não escreve nada. Muda o que a view devolve | Não | Funciona: as telas mostram menos linhas, e é o que se quer. **Precisa ser emendada** (§2.2) | Nada quebra. O BL-48 volta: "fulana atrasada, Platinado" para serviço que o salão tirou do catálogo, e o "N clientes sumindo" do Hoje infla. O teste `servico-arquivado-sai-das-telas` reprova |
| `0094` | `0094_resolver_previsoes_em_lote` | Cria a função `resolver_previsoes_em_lote(uuid, jsonb)`, `security invoker`, com `revoke ... from public, anon, authenticated` e `grant ... to service_role` | Aditiva (função nova) | Não | **Só na função que ela mesma cria.** Não mexe em privilégio de nada existente | Ninguém chama a função. Nada muda | `resolverPrevisoes` lança `INTERNAL` (função não existe). Em `recomputarCiclosDoTenant` não há `catch`: **o recálculo daquele salão aborta**, só quando há previsão pronta para fechar (cliente que voltou). É o cron noturno que falha, sem tela vermelha |
| `0095` | `0095_aceite_versionado_dos_termos` | Cria a tabela `terms_acceptances` (append-only, RLS `force`, só `select` por membro; `user_id` com `on delete set null`) | Aditiva | Não. **Não preenche o passado** (de propósito) | Não | Ninguém escreve nem lê. Nada muda | **O cadastro NOVO inteiro falha.** `executarOnboarding` insere em `terms_acceptances` dentro do `try`; erro = rollback do tenant e `INTERNAL` para quem estava se cadastrando. É a maior dependência única do lote |
| `0096` | `0096_ultima_visita_informada_ao_meio_dia` | `UPDATE clients set last_visit_at = last_visit_at + 12h` nas linhas em meia-noite UTC exata que **não** casam com um `appointments.starts_at` do mesmo cliente | **Só dado**, sem schema. Idempotente | **Sim, é a única que corrige linha existente de cliente** | Não | O código velho volta a gravar meia-noite UTC nas importações **feitas depois** da migration (janela entre migration e deploy da PR-5). Por isso: **rode o `UPDATE` de novo depois da PR-5** (é idempotente, §5) | Nada quebra. A exportação e o "Quem você já atende" mostram a visita **um dia antes** para as linhas antigas (21h do dia anterior em Brasília) |
| `0097` | `0097_servico_canonico` | `services.canonical_key text` nula + índice parcial; `create or replace` de `apply_vertical_pack` e `apply_profession_pack` (corpo idêntico ao anterior, mais `canonical_key`); `revoke all ... from public, anon, authenticated` + `grant execute ... to service_role` nas duas; **backfill** `UPDATE services` ligando o serviço ao item do catálogo pelo nome ainda intacto | Aditiva no schema, **com `UPDATE` de dados e substituição de função** | **Sim**: liga `canonical_key` em serviços existentes que ainda têm o nome do catálogo. Nome já renomeado fica `NULL` | **Repete, não tira.** O `revoke` reafirma o que as `0004`, `0031` e `0063` já fizeram, e o `grant` reafirma a `0039`. Ver a prova abaixo | Ver o "smoke crítico" logo abaixo. As funções são as que o **cadastro** chama | Nada quebra: **nenhum código em `src/` lê ou escreve `canonical_key`** (`git grep canonical_key HEAD -- src` só acha `types.gen.ts`). Só o agregado futuro (`docs/84`, parado até o advogado) precisa dela |
| `0098` | `0098_experimentos_do_dono` | Cria a tabela `experiments` (RLS `force`; políticas de `select`, `insert`, `update` por membro; **sem** política de `delete`) | Aditiva | Não | Não | Ninguém usa | `/admin/experimentos` e as 2 rotas `/api/v1/experiments*` dão 500 (`PGRST205`, tabela não existe). Só essa tela |

### 2.2 As duas atenções do `docs/87` §6, respondidas

**"A `0094` e a `0097` revogam execução de função para os papéis de usuário"**

- **`0094`:** o `revoke` é da função que a própria migration acabou de criar. `create function` dá
  `EXECUTE` a `PUBLIC` por padrão; o `revoke` tira, o `grant` devolve só a `service_role`. Não há
  nada existente para o código velho perder.
- **`0097`:** o `revoke all` em `apply_vertical_pack(uuid, vertical_pack)` e `apply_profession_pack(uuid, uuid)`
  **repete** o que já valia (`0004` para a primeira, `0031` para a segunda, `0063` reafirmou a primeira; a
  `0039` deu `execute` a `service_role`). O código chama as duas por `svc.rpc(...)` em
  `onboarding.ts:181-182`, com o cliente `service_role`. `create or replace function` **preserva a ACL**
  já existente. Conclusão: **não é migration que tira privilégio**; pode subir antes, como as outras.
  O que se protege é diferente: as funções são `security definer` e **o corpo delas é reescrito**. Conferi
  linha a linha contra a última definição no repositório (`0063` para o pack legado, `0031` para o de
  profissões; `0069`, `0078` e `0057` não as redefinem): a única diferença é a coluna `canonical_key`
  e o valor `'pack:<vertical>:<nome>'` / `'prof:<id>'`. **`[verificar]`** que o corpo em produção é o do
  repositório: consulta `pg_get_functiondef` no §4.1 (item 6).
- **Prova de que a ACL não mudou** (rode antes e depois; o resultado tem que ser idêntico):
  `select proname, proacl::text from pg_proc where proname in ('apply_vertical_pack','apply_profession_pack');`

**"A `0096` e a `0097` também corrigem linhas existentes"**

- Nenhuma das duas tem gatilho a disparar: `clients` e `services` **não têm `create trigger`** em nenhuma
  migration (`grep` em `supabase/migrations/*.sql`: só `appointments_touch`, `health_records_touch` e
  `on_auth_user_created`). Então os dois `UPDATE` são silenciosos: sem linha em `audit_log`, sem
  `updated_at` mexido, sem recálculo.
- **Ensaio antes de aplicar de verdade** (o Postgres tem DDL transacional): cole `begin; <arquivo>; select ...; rollback;`.
  O §4.1 dá o comando que monta isso na área de transferência.
- **Conte antes** quantas linhas cada uma toca (consultas no §4.1, itens 7 e 8). Se o número for
  absurdo (a `0096` deveria tocar dezenas; a `0097`, uma fração dos serviços), pare.

### 2.3 O conflito de numeração e como resolver

**Situação medida:**

| Ref | `0092` | `0093` | Estado |
|---|---|---|---|
| `main` | não tem (última é `0091`) | não tem | produção `[verificar]` |
| `melhoria/onboarding-inteligencia-2026-09-28` (esta) | **não tem (buraco)** | `0093_servico_arquivado...` | `MIGRATIONS_ESPERADAS = 97`, última `0098` |
| `melhoria/orcamento-e-motor-2026-09-27` | **`0092_ritmo_na_lista_de_recuperar`** | não tem | `MIGRATIONS_ESPERADAS = 92`, 3 commits à frente da `main` |
| `loop/integracao-final` e `loop/rodada-27`, `-28`, `-29`, `-30-resumo-proativo` | **`0092_amostra_de_historico_do_ciclo`** (mesma coluna `sample_size`, mesma view) | não tem | 83 commits que não estão na `main` nem aqui |
| `loop/rodada-30-notifications-schema` | não tem | **`0093_notifications`** | idem |

O buraco na numeração desta branch (`0091` para `0093`) está **contado corretamente** hoje
(`MIGRATIONS_ESPERADAS = 97` = 91 mais as 6 de `0093` a `0098`). Ao entrar a `0092`, vira **98**, e as
duas constantes de `src/core/schema/versao.ts` precisam mudar juntas com a migration (há teste
`schema-esperado-bate-com-o-disco` que reprova se esquecer).

**Resolução recomendada (decisões em aberto: §8):**

1. **A `0092` que vale é a `ritmo_na_lista_de_recuperar`** (a da branch `orcamento-e-motor`), porque é a única
   que tem código nesta pilha dependendo dela. Ela entra **na mesma PR das migrations** (PR-1), com o
   nome e o número que já tem. **Nada é renumerado**, porque a `0092` só existe em uma branch que vai
   junto.
2. **Emendar a `0093`** (nunca foi aplicada em lugar nenhum, então pode ser editada) para a view
   `v_recover_revenue` listar as **15 colunas** da `0092` e manter `and s.active`. Trecho novo do
   `create or replace view public.v_recover_revenue`, no lugar do atual:

   ```sql
   create or replace view public.v_recover_revenue with (security_invoker = true) as
   select
     cc.tenant_id, cc.client_id, c.name as client_name, c.phone_e164,
     cc.service_id, s.name as service_name, cc.state, cc.late_days, cc.predicted_on,
     cc.value_at_risk_cents, cc.last_campaign_at, cc.profit_at_risk_cents,
     cc.personal_cycle_days, cc.last_visit_on, cc.sample_size
   from public.client_cycles cc
   join public.clients  c on c.id = cc.client_id and c.deleted_at is null
   join public.services s on s.id = cc.service_id and s.active
   where cc.state in ('due','late','at_risk','lost')
   order by cc.value_at_risk_cents desc;
   ```

   E trocar o parágrafo "Nota para quem revisar/mesclar" do cabeçalho, que passa a estar resolvido. A
   `v_clientes_a_recuperar` fica como está. A ordem de aplicação é **`0092` antes de `0093`, sempre**:
   a `0093` emendada referencia `cc.sample_size`, que só existe depois da `0092`.
3. **Cinto e suspensório na `0092`** (só se a consulta 3 do §4.1 mostrar que `sample_size` já existe em
   produção, por alguém ter aplicado a `0092_amostra` à mão): trocar `add column` por `add column if not exists`.
4. **As `loop/*` (`0092_amostra`, `0093_notifications`):** enquanto ninguém decidir publicar aquela
   pilha, **não existe conflito real**, mas existe uma bomba: se ela for publicada como está, o
   `0092_amostra` cria a mesma coluna (`column already exists`) e o `0093_notifications` disputa o número
   com a `0093` daqui. Se um dia for publicada, renumerar para **`0099` em diante**, e `add column if not exists`.
   **Decisão do Eduardo**: aquela pilha está morta ou viva? (`[decidir]`). Não toco nela.
5. **Verificação obrigatória em produção** (§4.1, itens 2 e 3): que nem `0092_amostra` nem `0093_notifications`
   estão no livro de migrations. Se estiverem, **pare** e me chame: o plano muda.

**Um aviso sobre o `/api/health`:** ele compara pelo **nome sem prefixo** e conta linhas. Como o
livro de produção tem ~86 linhas com nome antigo, a **contagem** pode passar de 98 mesmo com uma
migration faltando; só o "última migration presente" é prova firme. Por isso a verificação por
**nome** no §4.1 (item 2) vale mais que o verde do health `[verificar]`.

---

## 3 · Plano de fatias

**Princípio:** uma PR por tema coeso, sempre com base na `main` (nunca empilhada: memória
`pr-empilhado-nao-chega-na-main`), cada uma **empurrada uma vez só** (vários commits, um `git push`).
A regra do CI é sobre o número de **pushes**, não de commits: `concurrency: cancel-in-progress`
reinicia o job de banco (~5 min) a cada push na mesma PR. Monte tudo local, rode a verificação, e
empurre.

### 3.1 O desenho de `DECISOES.md` e do log do loop

`docs/DECISOES.md` recebeu **27 entradas em 17 commits desta branch**, todas no fim do arquivo (uma
única mão de +66 linhas em `@@ -13668`). Se cada fatia levasse as suas, as 13 PRs conflitariam. Então:

- **Só a PR-0 (docs) toca `docs/DECISOES.md` e `.claude/ciclo/`.** Nenhuma PR de código toca. O conflito
  some pela raiz.
- O `.gitattributes` da `main` já tem `docs/DECISOES.md merge=union`.
  Isso vale para `git merge`, `rebase` e `cherry-pick` locais. **Não confie no botão Merge do GitHub
  para honrar o driver** `[verificar]`; a garantia real é a de cima.
- Qualquer PR **fora** desta pilha que apende em `DECISOES.md` (a da cortesia, por exemplo): rebasear
  local logo antes de abrir, e não deixar aberta.

### 3.2 As fatias

Numeração final; `PR-N` é a ordem de **abrir**. Todas com base na `main`. Tamanhos medidos (sem docs,
migrations, `versao.ts`).

| PR | Tema | Commits (ordem original) | Migrations que já têm que estar aplicadas | Tamanho | Risco | Depende de |
|---|---|---|---|---|---|---|
| **PR-0** | Docs e log do loop | os 48 só-docs, mais `docs/DECISOES.md` inteiro, `.claude/ciclo/*`, `docs/83` a `89`, `docs/runbooks/*`, `docs/marketing/*`, `docs/modelo-financeiro-ciclo.xlsx`, e as partes de docs de commits mistos | nenhuma | 0 de código | **Nenhum** | nada |
| **PR-1** | **Banco** (as 7 migrations + `versao.ts`) e o teste C-07 | arquivos: `0092` (vinda de `87bccca9`), `0093` **emendada**, `0094`, `0095`, `0096`, `0097`, `0098`, `src/core/schema/versao.ts` = `98` / `'0098_experimentos_do_dono'`; mais `ce4743c5` | **as 7, aplicadas em produção ANTES do merge** (§4) | 7 SQL, 2 TS | Médio (é o portão do banco), mas ele é o **smoke automático do código antigo contra o banco novo** (§4.2) | PR-0 (só para não brigar) |
| **PR-2** | Motor não esquece + performance | `7b5e9664`, `46af6d57`, `77278430`, `7ccf1a8d`, `2c51b6db` (sem os arquivos de migration/`versao.ts`) | `0093`, `0094` | 8 arq. (5 teste), +562/-74 | Médio: mexe no recálculo noturno do Motor | PR-1 |
| **PR-3** | Auditoria BL-42 + regras de lint | `34a022c5`, `5035d9c7`, `cabd94e5`, `d76d93f5`, `a99644de`, `b35047ab`, `d4c0a5d3`, `31c14cec`, `c94edd3d`, `e3063bd2`, `f488991a`, `a454450d`, `c7e4ee92`, `ca1cbb09` | nenhuma | 60 arq. (6 teste), +1.7k/-0.9k, mecânico | Médio: 50 rotas de escrita. **A regra de lint só pode entrar junto** das rotas | PR-1 |
| **PR-4** | Onboarding e migração + senha na URL | `5815bc5c`, `41f506a0`, `937d1cc0`, `e62d6023`, `b9c1c3b8` | nenhuma | 27 arq. (4 teste), +1.2k/-57 | **Alto**: novas telas no funil de cadastro (`/onboarding/perfil`) | PR-1 |
| **PR-5** | Importação, exportação e datas (com `importador.tsx` de `8e05904c`) | `007bb25d`, `8e05904c` (só `src/`), `08d8b778`, `df14efa3`, `b00193cb`, `2f78a103`, `0ede6ba8`, `80e2d453`, `b9a051b0`, `07d0ea92` | `0096` | 22 arq. (7 teste), +995/-82 | Médio: importação grava dinheiro/datas de cliente real | PR-2 (mesmo arquivo de teste `importacao-clientes.test.ts`) |
| **PR-6** | Assistente troca de motor (sem Gemini) | `4e3b9f7c`, `dfd1ef4f`, `c972b001`, `c3082b7d`, `e7ad3d8b`, `3db106b6`, `344a000a`, `4520339d`, `01d8a608` | nenhuma | 19 arq. (6 teste), +2.0k/-267 | **Alto na visibilidade**: **todo dono** vê o assistente responder diferente | PR-1 |
| **PR-7** | Motor de Inteligência: conversa, "por que caiu", "e se", costume, "resolve" | `933f7042`, `ecf055c9`, `56c71009`, `98f843e8`, `d4239a29`, `ea2e9d36`, `62959eb6`, `93093e44`, `49bc97f8`, `f88c4b65`, **`b6676bb7`**, `7769a171` | nenhuma (`ecf055c9` grava em `product_events`, que já existe desde a `0088`) | 36 arq. (15 teste), +2.5k/-148 | Médio | **PR-6, PR-4 e PR-10** (ver abaixo: `ea2e9d36` importa código que nasce na PR-10) |
| **PR-8** | Aceite versionado dos termos | `e6efbdc9` | **`0095`** | 7 arq. (3 teste), +84/-2 | **Alto**: caminho do cadastro. Sem `0095` o cadastro novo falha inteiro | PR-1 (e depois da PR-4, que mexe no onboarding) |
| **PR-9** | "Demanda não atendida" na página pública | `94bf264e` | nenhuma (usa `product_events`) | 5 arq. (2 teste) | Baixo, mas toca a página pública de agendamento | PR-1 |
| **PR-10** | Mapa de vazamento (O mês) + conserto do "Hoje" | `ba4abe1d`, `f09af0f4` | nenhuma | 8 arq. (3 teste), +345/-4 | Baixo | PR-9 (mesmo `booking-publico.test.ts`) |
| **PR-11** | Experimentos do dono | `5ccbbe39` | **`0098`** | 11 arq. (3 teste), +988 | Baixo (tela nova, atrás de rota nova) | PR-10 (mesmo `admin/mes/page.tsx`) |
| **PR-12** | Orçamento e ritmo (a outra branch) | `d08a607e`, `87bccca9` (sem `0092` e `versao.ts`); o `88d88fb3` (docs) vai na PR-0 | **`0092`** | 34 arq. na outra branch (2 são docs), +915/-22 | Médio: **muda a assinatura de `listarParaRecuperar`** (novo 3º parâmetro `hoje`) e cria `/quanto-custa` | **PR-1, PR-7 e PR-10** |
| fora | `public/marca/**` | `8e05904c` (a parte de marca) | nenhuma | 98 arq., 45 MB | Ver §1.3 | **não é PR do app** |

**Duas coisas que a PR-12 exige.** (1) O commit `49bc97f8` (PR-7) criou uma **chamada nova**,
`listarParaRecuperar(ctx.db, ctx.tenantId, { limit: 100_000 })` em `src/server/assistente/ferramentas.ts`
(linha ~749 em `HEAD`), que a outra branch nunca viu. Depois do `cherry-pick`, o typecheck **vai reprovar**
ali: passe `hojeNoFuso(ctx.timezone)` como 3º argumento. (2) `respostas-rapidas.ts` conflita (a PR-6
reescreveu o arquivo; a outra branch só mudou 3 chamadas): reaplique o 3º argumento `diaNoFuso(ctx.timezone)`
nas 3 chamadas que sobraram. **Rode `pnpm typecheck` e o teste `recuperar-receita` antes de empurrar.**
(Simulei o `git merge` completo das duas branches: conflita só em `versao.ts` e `respostas-rapidas.ts`.)

### 3.3 O que vai em paralelo e o que é em série

```
PR-0 (docs) ───────────────────────────────► qualquer hora, primeiro
[Eduardo aplica 0092..0098]  ──► PR-1 (banco) ──┬─► PR-2 ─► PR-5
                                                ├─► PR-3
                                                ├─► PR-4 ─┬─► PR-7 (precisa também de PR-6 e PR-10)
                                                │         └─► PR-8
                                                ├─► PR-6 ─► PR-7
                                                └─► PR-9 ─► PR-10 ─┬─► PR-7
                                                                   └─► PR-11
                                                       PR-7 + PR-10 ─► PR-12
```

**Ordem de merge que respeita tudo: 0, 1, 2, 3, 4, 5, 6, 9, 10, 7, 8, 11, 12.** (A numeração é a da
ordem em que se **abre**, não a de mergear: a PR-7 fica depois da 9 e da 10.)

- **Podem ser abertas juntas** (arquivos disjuntos, verificado): PR-2, PR-3, PR-4, PR-6, PR-9.
- **Em série** (compartilham arquivo ou código): PR-2 antes da PR-5; PR-6, PR-4 e **PR-10** antes da PR-7;
  PR-4 antes da PR-8; PR-9, PR-10, PR-11 nessa ordem; PR-12 por último.
- **Mesmo que abertas juntas, mergear uma por vez**, esperando o deploy da Vercel e `/api/health`
  em `200` entre uma e outra. "MERGEABLE" no GitHub é contra a `main` **de agora**, não contra o
  lote (memória `mergeable-nao-quer-dizer-mergeavel-em-lote`). Simule antes:

  ```bash
  git switch -c simulacao origin/main
  for b in pub/01-banco pub/02-motor pub/03-auditoria pub/04-onboarding pub/05-importacao \
           pub/06-assistente-motor pub/09-demanda pub/10-mapa pub/07-inteligencia \
           pub/08-termos pub/11-experimentos pub/12-orcamento-e-motor; do
    git merge --no-edit -q "$b" || { echo "CONFLITO em $b"; git diff --name-only --diff-filter=U; break; }
  done
  git switch - && git branch -D simulacao
  ```

- **Cortesia** (`feat/cortesia-prelancamento-2026-09-30`, P0 item 4, já existe num worktree irmão
  `../ciclo-verificacao`): entra **depois** da PR-4 e da PR-8, porque mexe em `executarOnboarding`.

### 3.4 Como montar cada fatia (para quem prepara; não é para o Eduardo)

Use um **worktree irmão**, nunca a pasta em que outra sessão roda `pnpm dev` (memória
`verificacao-paralela-sem-atrapalhar-outra-sessao`: build na mesma `.next` derruba a outra sessão).

```bash
git worktree add ../ciclo-publicar origin/main
cd ../ciclo-publicar
cp ../ciclo/.env.local .    # só para typecheck/testes locais; NUNCA use a chave de produção
pnpm install --prefer-offline
```

A função que aplica um commit **sem** os caminhos que ficam em outra fatia:

```bash
aplicar() {
  git diff "$1^" "$1" -- . \
    ':(exclude)supabase/migrations' ':(exclude)src/core/schema/versao.ts' \
    ':(exclude)docs' ':(exclude).claude' ':(exclude)public/marca' \
  | git apply --3way --index && git commit -q -C "$1"
}
```

Exemplo, PR-2:

```bash
git switch -c pub/02-motor origin/main
for h in 7b5e9664 46af6d57 77278430 7ccf1a8d 2c51b6db; do aplicar $h || break; done
```

Se o pedaço de `src/server/db/types.gen.ts` conflitar, regenere: `pnpm db:types:local` contra o
Supabase local já migrado.

**PR-1 é diferente** (não é cherry-pick, é caminho):

```bash
git switch -c pub/01-banco origin/main
git checkout melhoria/orcamento-e-motor-2026-09-27 -- supabase/migrations/0092_ritmo_na_lista_de_recuperar.sql
git checkout melhoria/onboarding-inteligencia-2026-09-28 -- \
  supabase/migrations/0093_servico_arquivado_sai_das_telas_de_dinheiro.sql \
  supabase/migrations/0094_resolver_previsoes_em_lote.sql \
  supabase/migrations/0095_aceite_versionado_dos_termos.sql \
  supabase/migrations/0096_ultima_visita_informada_ao_meio_dia.sql \
  supabase/migrations/0097_servico_canonico.sql \
  supabase/migrations/0098_experimentos_do_dono.sql \
  src/core/schema/versao.ts
# editar a 0093 (bloco do §2.3) e conferir versao.ts = 98 / '0098_experimentos_do_dono'
git add -A && git commit -m "feat(banco): migrations 0092 a 0098 (aditivas), aplicadas antes do código"
git cherry-pick ce4743c5
```

**Verificação de cada fatia antes de empurrar** (de dentro do worktree irmão; o `pnpm verify` inteiro é o
portão do `CLAUDE.md`): `pnpm typecheck && pnpm lint && pnpm test:unit`, e `pnpm test:integration && pnpm test:rls`
se o Supabase local estiver livre (ver a advertência de portas no §4.2). O build fica por conta do CI
(`qualidade`), pela regra de não rodar `next build` onde a outra sessão trabalha.

**Prova de que nada ficou para trás** (rode no fim, depois da PR-12, contra a `main`):

```bash
git fetch origin
git diff --stat origin/main melhoria/onboarding-inteligencia-2026-09-28 -- . \
  ':(exclude)docs' ':(exclude).claude' ':(exclude)public/marca'
```

Tem que sair **vazio**, exceto o que a PR-12 traz da outra branch (rotas `/quanto-custa`, ritmo na fila)
e `types.gen.ts`. Se aparecer arquivo de `src/` ou `tests/`, é commit que ficou de fora.

### 3.5 Ritmo sugerido

| Dia | O que |
|---|---|
| 1 | Backup dos refs no `origin` (§4.0). PR-0. Estado de produção (§4.1). Ensaio e aplicação das migrations (§4.2 a §4.4) |
| 1 ou 2 | PR-1 (CI verde é o smoke automático). Smoke (a). Merge |
| 2 | Abrir PR-2, PR-3, PR-4, PR-6, PR-9 (empurrar cada uma **uma vez**). Mergear por risco crescente: PR-3, PR-2, PR-9, PR-4 |
| 3 | PR-5 (depois: rodar de novo o `UPDATE` da `0096`), PR-6, PR-10 |
| 4 | PR-7 (só depois da PR-10), PR-8, PR-11 |
| 5 | PR-12. Smoke (b) final |
| Margem | O Portão 0 do `docs/87` é 23/10. Termine tudo até **16/10** para sobrar uma semana |

Nada de merge na sexta à tarde e nada nos 2 dias antes do alpha (26/10).

---

## 4 · Smoke test escrito

Marcação: **[E]** só o Eduardo faz (painel da Supabase/Vercel, CLI com credencial, cadastro com
e-mail real); **[C]** roda em sessão do Claude, sem credencial de produção.

Nas linhas **[E]**, os blocos são para copiar e colar. Shell: **PowerShell** (é o da máquina); SQL
vai no **SQL Editor** do painel da Supabase.

### 4.0 Antes de tudo [E]

**1. Backup das branches locais** (elas só existem nesta máquina; um disco ruim perde 3 meses). Empurrar
uma branch **sem abrir PR** não dispara CI (o `ci.yml` só roda em `push` para a `main` e em
`pull_request`):

```powershell
git push origin melhoria/onboarding-inteligencia-2026-09-28
git push origin melhoria/orcamento-e-motor-2026-09-27
# só se a pilha do loop ainda importa (§2.3, item 4):
git push origin loop/integracao-final
```

**2. Confirme que a Vercel aponta para o banco que você vai mexer.** Memória `ciclo-producao-e-o-cron-morto`:
o `.env.local` desta máquina aponta para o banco de **desenvolvimento** (`sukloaoodpxjukngyojo`); a produção era
`eqzlvthzdjnsbogymcsw` `[verificar]`. Nunca aplique nada sem esta linha batendo:

```powershell
curl.exe -s -D - -o NUL https://seuciclo.com.br/api/health | Select-String "supabase.co"
```

O host que aparecer em `connect-src` tem que ser o mesmo do projeto aberto no painel em que você vai colar SQL.

**3. Backup do banco** `[verificar]`. O `docs/87` item 6 ainda está aberto: a Supabase **não faz backup
no plano Free**. No painel: Project Settings, Database, Backups. Se for Free, **não aplique a `0096` nem a
`0097`** (elas alteram linhas existentes) antes de subir de plano ou de exportar as linhas afetadas (§5,
"o que dá para desfazer"). Se for Pro, anote a hora do último backup diário.

### 4.1 Estado de produção: cole no SQL Editor e me devolva o resultado [E]

Só leitura. Uma consulta por vez, ou todas juntas.

```sql
-- 1. Onde o livro de migrations está
select version, name from supabase_migrations.schema_migrations order by version desc limit 12;

-- 2. Alguma das migrations deste lote (ou das rivais) já está lá, por NOME?
select version, name from supabase_migrations.schema_migrations
where name ~ '(ritmo_na_lista|amostra_de_historico|notifications|servico_arquivado|resolver_previsoes|aceite_versionado|ultima_visita_informada|servico_canonico|experimentos_do_dono)';

-- 3. Os objetos existem?  (esperado hoje: tudo vazio ou null)
select column_name from information_schema.columns
  where table_schema='public' and table_name='client_cycles' and column_name='sample_size';
select column_name from information_schema.columns
  where table_schema='public' and table_name='services' and column_name='canonical_key';
select to_regclass('public.terms_acceptances') as termos, to_regclass('public.experiments') as experimentos,
       to_regclass('public.notifications') as notificacoes;
select proname from pg_proc where pronamespace='public'::regnamespace and proname='resolver_previsoes_em_lote';

-- 4. Quantas linhas o livro tem (o /api/health conta assim: só as com nome)
select count(*) as total_com_nome from supabase_migrations.schema_migrations where name is not null;

-- 5. A view hoje (deve ter 12 colunas, terminando em profit_at_risk_cents) e as opções dela
select string_agg(column_name, ', ' order by ordinal_position) as colunas
  from information_schema.columns where table_schema='public' and table_name='v_recover_revenue';
select relname, reloptions from pg_class where relname in ('v_recover_revenue','v_clientes_a_recuperar');

-- 6. As duas funções que o CADASTRO chama: ACL e corpo de hoje
select proname, proacl::text as acl from pg_proc
  where pronamespace='public'::regnamespace and proname in ('apply_vertical_pack','apply_profession_pack');
select pg_get_functiondef(p.oid) from pg_proc p
  where p.pronamespace='public'::regnamespace and p.proname in ('apply_vertical_pack','apply_profession_pack');

-- 7. Quanto a 0096 vai tocar (dry-run: só conta)
select count(*) as vai_mudar_0096 from clients c
where c.last_visit_at is not null
  and (c.last_visit_at at time zone 'UTC')::time = time '00:00:00'
  and not exists (select 1 from appointments a
                  where a.client_id=c.id and a.tenant_id=c.tenant_id and a.starts_at=c.last_visit_at);

-- 8. Quanto a 0097 vai ligar (dry-run: só conta) e quanto fica de fora
select count(*) as servicos_total, count(*) filter (where deleted_at is null) as servicos_vivos from services;
```

Como ler:

| Item | Esperado | Se for diferente |
|---|---|---|
| 1 | última linha é a `0091` (ou `0091_produto_sugerido...`) | Se já tem `0092` ou mais, o plano muda: me devolva |
| 2 | **vazio** | Linha de `amostra_de_historico` ou `notifications`: **pare** (§2.3, item 5). Linha de qualquer outra do lote: já foi aplicada, pule aquela |
| 3 | tudo vazio/null | `sample_size` existente: use `add column if not exists` na `0092` |
| 4 | um número. **Anote** | Não é prova de nada sozinho (§2.3, aviso do health) |
| 5 | 12 colunas; `reloptions` com `security_invoker=true` nas duas | Sem `security_invoker`: a view já está furando a RLS; me avise |
| 6 | `acl` sem `anon`/`authenticated`, com `service_role` | Se `authenticated` aparecer, a `0097` **passa a tirar privilégio** e o cadastro depende do que o código faz; me avise antes de aplicar |
| 7 | dezenas, não milhares | Se for muito, ver §5 |

### 4.2 Aplicar as migrations [E]

**A ordem é `0092, 0093, 0094, 0095, 0096, 0097, 0098`, numérica, e todas antes do merge da PR-1.**
Antes: a PR-1 tem que estar com o CI verde (o CI aplica as 98 do zero, então prova que os SQL rodam
em banco vazio).

Faça **na branch `pub/01-banco`** (é onde a `0093` emendada e a `0092` estão):

```powershell
git switch pub/01-banco
```

Para **cada** migration, dois passos.

**Passo A: ensaio, com `rollback`.** Monta `begin; <arquivo>; rollback;` e copia:

```powershell
$m = "supabase\migrations\0092_ritmo_na_lista_de_recuperar.sql"
"begin;`n" + (Get-Content $m -Raw -Encoding UTF8) + "`nrollback;" | Set-Clipboard
```

Cole no SQL Editor e execute. Tem que terminar sem erro. Nada fica gravado.

**Passo B: aplicar de verdade**, com `begin; ...; commit;` (um erro no meio não deixa metade aplicada):

```powershell
"begin;`n" + (Get-Content $m -Raw -Encoding UTF8) + "`ncommit;" | Set-Clipboard
```

`-Encoding UTF8` é obrigatório: os comentários e os `comment on` têm acento, e o padrão do PowerShell 5.1
lê como ANSI e estraga o texto.

Repita trocando `$m` para `0093_servico_arquivado_sai_das_telas_de_dinheiro.sql`, `0094_resolver_previsoes_em_lote.sql`,
`0095_aceite_versionado_dos_termos.sql`, `0096_ultima_visita_informada_ao_meio_dia.sql`,
`0097_servico_canonico.sql`, `0098_experimentos_do_dono.sql`. Depois de **cada** uma, confira o erro
(nenhum) e siga.

**Antes da `0096` e da `0097`** (as duas que alteram linhas), exporte as linhas afetadas para CSV
(botão *Download CSV* do resultado do SQL Editor). Guarde o arquivo:

```sql
-- antes da 0096
select c.id, c.tenant_id, c.last_visit_at from clients c
where c.last_visit_at is not null and (c.last_visit_at at time zone 'UTC')::time = time '00:00:00'
  and not exists (select 1 from appointments a where a.client_id=c.id and a.tenant_id=c.tenant_id and a.starts_at=c.last_visit_at);
-- antes da 0097
select id, tenant_id, name, canonical_key from services;
```

**Não crie tabela de backup em `public`.** Toda tabela nova em `public` nasce com `select/insert/update/delete`
para `anon` e `authenticated` (migration `0038`), e sem RLS ela vira uma tabela aberta pela API.

### 4.3 Registrar no livro de migrations [E]

O caminho que funcionou em 16/09 (`DECISOES` 2026-09-16). **Não** rode `supabase db push` e **não**
rode o `migration repair --status reverted` que ele sugerir: isso tentaria recriar 86 objetos que já existem.

```powershell
supabase link --project-ref eqzlvthzdjnsbogymcsw        # o ref que o passo 4.0.2 confirmou; pede a senha do banco
supabase migration repair --status applied 0092 0093 0094 0095 0096 0097 0098
supabase migration list
```

Em `migration list`, as 7 novas têm que aparecer com **Local e Remote** preenchidos. As ~86 antigas
aparecem só em Remote: é o esperado.

Se o CLI não estiver logado, o equivalente por SQL (o formato é o que o CLI grava: `name` sem prefixo;
o `compararSchema` aceita os dois):

```sql
insert into supabase_migrations.schema_migrations (version, name) values
 ('0092','ritmo_na_lista_de_recuperar'), ('0093','servico_arquivado_sai_das_telas_de_dinheiro'),
 ('0094','resolver_previsoes_em_lote'), ('0095','aceite_versionado_dos_termos'),
 ('0096','ultima_visita_informada_ao_meio_dia'), ('0097','servico_canonico'),
 ('0098','experimentos_do_dono');
```

### 4.4 Conferir o que foi aplicado [E]

```sql
select version, name from supabase_migrations.schema_migrations order by version desc limit 9;

-- a view final: 15 colunas terminando em sample_size, filtrando serviço arquivado, com security_invoker
select string_agg(column_name, ', ' order by ordinal_position) as colunas
  from information_schema.columns where table_schema='public' and table_name='v_recover_revenue';
select pg_get_viewdef('public.v_recover_revenue'::regclass) like '%s.active%' as filtra_arquivado;
select relname, reloptions from pg_class where relname in ('v_recover_revenue','v_clientes_a_recuperar');

-- as ACL das funções: têm que ser IGUAIS às do item 6 do §4.1
select proname, proacl::text from pg_proc
  where pronamespace='public'::regnamespace
    and proname in ('apply_vertical_pack','apply_profession_pack','resolver_previsoes_em_lote');

-- as tabelas novas: RLS ligada e forçada
select relname, relrowsecurity, relforcerowsecurity from pg_class
  where relname in ('terms_acceptances','experiments');

-- backfill da 0097
select count(*) filter (where canonical_key is not null) as ligados, count(*) as total
  from services where deleted_at is null;

-- a 0096: agora tem que dar 0
select count(*) from clients c
where c.last_visit_at is not null and (c.last_visit_at at time zone 'UTC')::time = time '00:00:00'
  and not exists (select 1 from appointments a where a.client_id=c.id and a.tenant_id=c.tenant_id and a.starts_at=c.last_visit_at);
```

E o `/api/health`. Com a `main` no ar ainda esperando **91**, o esperado é `200` e `checks.schema.ok = true`
(o banco à frente **não** é falha, por desenho: `compararSchema` só reprova banco ATRÁS):

```powershell
(curl.exe -s https://seuciclo.com.br/api/health | ConvertFrom-Json).checks.schema | ConvertTo-Json
```

### 4.5 Smoke (a): o CÓDIGO ANTIGO contra o BANCO JÁ MIGRADO

É a janela em que a produção fica entre as duas versões (docs/87 §6). O código velho é o que já está
no ar, e o banco já tem as 7. Vem em três camadas, da mais barata para a mais real.

**Camada 1, automática [C]: o CI da PR-1.** A PR-1 é `main` (código velho) mais as migrations. O job
`banco` sobe um Supabase vazio, aplica as 98, e roda `test:integration` e `test:rls` do código velho
contra esse banco. É o smoke (a) inteiro, de graça, e **é o teste do cadastro**: `tests/integration/onboarding.test.ts`
chama `executarOnboarding` (que chama `apply_vertical_pack` e `apply_profession_pack`) e o de serviços
cria serviço. **Limite honesto:** em banco vazio, os `UPDATE` da `0096` e da `0097` rodam em **zero
linha**; não provam o backfill. Quem prova o backfill são as consultas dos itens 7 e 8 do §4.1 e a
camada 3.

**Camada 2, local [C]** (só se a outra sessão do Claude não estiver usando o Supabase local):

```bash
git worktree add ../ciclo-smoke pub/01-banco     # main + migrations
cd ../ciclo-smoke && pnpm install --prefer-offline
# O Supabase local é UM por máquina (project_id "ciclo", porta 54321). Se a outra sessão já o usa,
# NÃO suba um segundo: mude `project_id` e as portas em supabase/config.toml deste worktree (sem commitar).
supabase start && pnpm db:reset
pnpm test:integration && pnpm test:rls
```

**Camada 3, em produção com o código que está no ar [E]** (é a real). Use uma **conta de teste**,
com um e-mail seu (`voce+smoke1@...`), para poder apagar depois.

| # | Passo | Esperado |
|---|---|---|
| 1 | `(curl.exe -s https://seuciclo.com.br/api/health \| ConvertFrom-Json)` | `ok: true`. `checks.schema.ok: true` |
| 2 | Abra `https://seuciclo.com.br/cadastro`, crie a conta de teste (escolha **barbearia**), confirme o e-mail, complete o onboarding | Cai em `/admin/hoje` **sem erro**. Se aparecer "Algo deu errado do nosso lado", **o smoke reprovou**: anote a hora e o e-mail e veja o §5 |
| 3 | SQL: `select id, slug, vertical from tenants order by created_at desc limit 1;` e, com o `id`: `select name, canonical_key from services where tenant_id='<id>' order by name;` | Vários serviços, **com `canonical_key` preenchida** (`pack:barber:Corte`...). Prova que a função **nova** `apply_vertical_pack` rodou sob o código **velho** |
| 4 | SQL: `select count(*) from terms_acceptances where tenant_id='<id>';` | `0`. O código velho não grava aceite (a tabela existe e está vazia para esta conta) |
| 5 | **Criar serviço:** `/admin/config/servicos`, novo serviço "Teste smoke", R$ 10, 30 min | Salva. SQL: `select name, canonical_key from services where tenant_id='<id>' and name='Teste smoke';` dá `canonical_key` **nula** (serviço à mão não tem origem) |
| 6 | **Arquivar** esse serviço | Some das telas de dinheiro (a `0093`) |
| 7 | Abra `/admin/recuperar`, `/admin/hoje`, `/admin/mes` | Abrem, sem erro. A lista de recuperar vazia (conta nova) é normal |
| 8 | Abra `https://seuciclo.com.br/<slug-da-conta>/agendar` (página pública) | Abre. **Este foi o passo que reprovou em silêncio uma semana** quando a `0091` faltava (`DECISOES` 2026-09-16); não pule |
| 9 | Importe (código velho) um CSV pequeno pela tela `/admin/clientes/importar`. Modelo abaixo | Entra. SQL: `select name, last_visit_at from clients where tenant_id='<id>';` mostra **`00:00:00+00`** (o defeito que a `0096` corrige) |
| 10 | Rode **de novo** o `UPDATE` da `0096` (§5.1, bloco "reaplicar") | Passa a **`12:00:00+00`** naquelas linhas. Prova a `0096` em dado real |
| 11 | GitHub, Actions, workflow **cron**, *Run workflow* | Verde, com `tenantsProcessados > 0`. Prova que o recálculo do Motor, com código velho, convive com a coluna `sample_size` e as views novas |
| 12 | Apague a conta de teste: `/admin/config/excluir-conta` (pede 2º fator) | Conta removida. Se não conseguir (2º fator), deixe marcada como teste e me diga o slug |

CSV do passo 9 (Excel em português usa `;` e data `dd/mm/aaaa`; a tela pede para você escolher as colunas):

```
Nome;Telefone;Ultima visita
Cliente Teste Um;49999990001;15/08/2026
Cliente Teste Dois;49999990002;03/09/2026
Cliente Teste Tres;49999990003;
```

**Se qualquer passo de 2 a 8 reprovar:** o banco está à frente do código velho e o código velho quebrou.
Isso é exatamente o que este smoke existe para achar. **Não mergeie nada.** Anote o passo e o erro, e
veja o §5 (a decisão é corrigir para frente ou desfazer a função, e ambas são rápidas).

### 4.6 Smoke (b): depois do deploy do código novo

**Depois de CADA PR** (mínimo, 3 minutos): esperar o deploy da Vercel ficar "Ready", e:

```powershell
(curl.exe -s https://seuciclo.com.br/api/health | ConvertFrom-Json) | Select-Object ok, @{n='schema';e={$_.checks.schema.ok}}
```

Tem que ser `ok True` e `schema True`. Depois, o teste próprio da PR:

| PR | Como testar depois do deploy |
|---|---|
| PR-1 | Só o health. E o job `vigia` do `cron.yml` não pode ficar vermelho nas próximas horas |
| PR-2 | Rodar o cron manual (Actions, cron, *Run workflow*). `recompute_cycles` com `tenantsProcessados > 0` e **sem falha por tenant** (a `0094`). Arquivar um serviço que tenha cliente atrasado e conferir que ele sai de `/admin/recuperar` e do "Hoje" |
| PR-3 | Numa conta de teste: criar serviço, editar, criar cliente, agendar, **clicando em Salvar duas vezes**. SQL: `select action, count(*) from audit_log where created_at > now() - interval '30 minutes' group by 1;` deve dar **1 linha por ação**, nunca 2 |
| PR-4 | Cadastro novo passa pela tela "pra deixar do seu jeito" (`/onboarding/perfil`), com as perguntas 2 e 3 mudando o painel; a saída "vindo de outro sistema" abre `/admin/clientes/vindo-de-outro-sistema`. **Senha na URL:** no DevTools, desligue o JavaScript e envie o formulário do onboarding: a URL **não** pode ganhar `?senha=` nem e-mail |
| PR-5 | **Importação de CSV:** o CSV do §4.5 (com `;` e `dd/mm/aaaa`). Esperado: 3 clientes, 2 com data, e `last_visit_at` gravado a **`12:00:00+00`** (SQL). **Exportação da base:** `/admin/clientes/exportar` baixa o arquivo, e o dia de "Cliente Teste Um" sai **15/08/2026**, não 14. Depois: rodar o `UPDATE` da `0096` de novo (§5.1) e conferir que a contagem é `0` |
| PR-6 | **Assistente:** perguntar "quanto sobrou este mês?", "quem eu chamo primeiro?", "o que tenho amanhã?". Responde sem "não consegui responder". `checks.assistente.detail` do `/api/health` agora diz "assistente no Motor de Inteligência próprio". Nada de chamada a Gemini nos logs da Vercel |
| PR-7 | No assistente: "por que caiu?" (responde com conta), "e se eu abrir domingo?", e clicar num botão de próximo passo. Ficha de um cliente com histórico mostra o costume dele |
| PR-8 | **Cadastro novo** (conta de teste `+smoke2`). SQL: `select documento, versao, via from terms_acceptances where tenant_id='<id>';` dá **2 linhas** (`termos` e `privacidade`, `via = cadastro`). Se o cadastro falhar, é a `0095` ausente: pare e veja o §5 |
| PR-9 | Na página pública de agendamento, procurar um horário sem vaga; conferir o evento `demanda_nao_atendida` em `product_events` (sem dado pessoal) |
| PR-10 | `/admin/mes` mostra o "mapa de vazamento" no topo; `/admin/hoje` não conta como "passaram da hora" quem ainda não passou |
| PR-11 | `/admin/experimentos`: criar um teste de 7 dias, ver o "antes" congelado, cancelar (sem apagar). SQL: `select titulo, canceled_at from experiments;` |
| PR-12 | `/quanto-custa` abre; em `/admin/recuperar`, a lista mostra o ritmo ("vem a cada 18 dias") e distingue "medido em N visitas" de "palpite do catálogo". `select sample_size from client_cycles limit 5` mostra valores > 0 depois do próximo recálculo |

**Depois da PR-12, o smoke completo (b)**, do zero, com uma conta nova `+smoke3`:

1. Cadastro, e-mail, onboarding e `/onboarding/perfil`. Termos gravados (2 linhas).
2. `/admin/hoje`: carrega, com o "resolve" e a central de ações.
3. Importar o CSV do §4.5, ver "quem sumiu" na tela, exportar a base e conferir as datas.
4. `/admin/experimentos`: criar e cancelar um.
5. Assistente: 5 perguntas, incluindo "por que caiu?" e um botão de próximo passo.
6. `/admin/mes`: mapa de vazamento.
7. `/admin/recuperar`: ritmo do cliente.
8. Voltar a `/api/health`: `ok: true`, `schema.ok: true`, `assistente` no Motor próprio.
9. Rodar o cron manual e ver `recompute_cycles` verde.
10. Apagar a conta de teste.

### 4.7 `/api/health`

O corpo tem `ok` na raiz e um `checks.*` por item, cada um com `ok` e `detail`. **Leia o corpo, não só o
código HTTP** (`incidente.md`, §1).

| Situação | Health | O que fazer |
|---|---|---|
| Banco à frente do código (a janela normal) | `200`, `schema.ok true`, `detail` "banco à frente..." | Nada. É a ordem certa |
| **Banco ATRÁS do código** | **`503`**, `schema.detail` "banco ATRÁS do código: falta a 0098 e mais N" | O código novo subiu antes da migration. Aplique o que falta (§4.2) e o alarme apaga. O job `vigia` do `cron.yml` manda e-mail vermelho: é alarme, não queda (memória `migration-que-tira-privilegio-inverte-a-ordem`, item 3) |
| `PGRST202` na função `migracoes_aplicadas` | `503` | Banco antes da `0062`; não é o caso hoje |

Truque da memória para saber a hora exata de aplicar quando tiver que ser depois do deploy:
`until (curl.exe -s https://seuciclo.com.br/api/health | Select-String "banco ATR") { Start-Sleep 5 }`.

O script `scripts/conferir-schema-prod.mjs` faz a mesma pergunta com código de saída
(`node scripts/conferir-schema-prod.mjs`, `0` = alinhado).

---

## 5 · Reversão

### 5.1 O princípio

**O banco à frente do código velho é o estado seguro** (é como esta pilha foi desenhada: as sete
migrations não tiram nada de que o código velho dependa). Então, quando o código novo der problema,
a reversão é do **deploy**, e **não toca o banco**. Migration aditiva não se desfaz sem perder dado; e
quase nunca precisa.

### 5.2 Desfazer o deploy sem tocar no banco [E]

Uma das duas, a mais rápida primeiro:

1. **Vercel, Instant Rollback.** Painel da Vercel, projeto do CICLO, *Deployments*, escolha o deployment de
   produção **anterior ao merge que quebrou**, menu `...`, *Instant Rollback* (promove aquele deploy de
   volta a produção, em segundos, sem rebuild). `[verificar]` o que o plano da conta permite: no Hobby, o
   Instant Rollback só volta ao deployment anterior imediato. E: depois de um rollback, a Vercel
   **para de promover automaticamente** os deploys novos até você promover um manualmente ou
   religar, então um merge seguinte **não entra sozinho** `[verificar]`.
2. **Reverter o merge na `main`** (mais lento, ~5 min de build, mas auditável e não deixa a Vercel em
   modo manual): `git revert -m 1 <hash-do-merge>` numa branch, PR, merge.

Nos dois casos, depois: `/api/health` continua `200` (banco à frente do código velho, `ok`).

### 5.3 O que dá para desfazer no banco, e o que não

| Migration | Desfazer | Perde dado? | Recomendação |
|---|---|---|---|
| `0092` | `drop view v_recover_revenue`; recriar a view **de 12 colunas** (definição da `0067`, com `security_invoker`); `alter table client_cycles drop column sample_size` | Sim, o contador de amostra (regerado no próximo recálculo) | **Não desfaça.** A coluna é inofensiva para o código velho |
| `0093` | Recriar as duas views sem `and s.active` (definições da `0067`/`0058`, **com** `security_invoker`, e na `v_recover_revenue` mantendo as 3 colunas se a `0092` ficar) | Não | Só se descobrir que o filtro esconde gente que devia aparecer |
| `0094` | `drop function public.resolver_previsoes_em_lote(uuid, jsonb);` | Não | **Só depois** de reverter o deploy que a chama (senão o recálculo quebra) |
| `0095` | `drop table terms_acceptances;` | **Sim, é prova de aceite jurídico** | **Nunca desfaça.** Uma tabela vazia não incomoda ninguém |
| `0096` | Precisa do CSV exportado no §4.2 (`id` e valor antigo): `update clients set last_visit_at = <antigo> where id = <id>` a partir dele | Sem o CSV, **não dá** (não se distingue o que foi mexido) | O erro que ela corrige é maior que o que ela poderia causar. Não desfaça |
| `0097` | Recriar as duas funções com o corpo da `0063` (`apply_vertical_pack`) e da `0031` (`apply_profession_pack`); `update services set canonical_key = null`; `drop index services_canonical_key_idx`; `alter table services drop column canonical_key` | Só a chave (recomputável) | Só se o cadastro reprovar por causa das funções. Funções velhas nunca dependeram da coluna |
| `0098` | `drop table experiments;` | **Sim, se algum dono já criou teste** | Não desfaça; a tabela vazia é inofensiva |

**Regra de ouro:** corrigir para frente (uma `0099` que conserta) é quase sempre melhor do que
desfazer, e o histórico de migrations fica honesto. **Restauração de backup do banco inteiro é o último
recurso**, porque descarta **todo dado real entrado desde aquele ponto** (memória de `incidente.md`,
teste de restauração ainda não realizado). `[verificar]` o plano de backup antes de precisar (§4.0).

### 5.4 Reaplicar a `0096` depois da PR-5 (idempotente)

Não vai no livro de migrations. Só corrige as importações feitas pelo código velho na janela entre a
migration e o deploy:

```sql
update clients c
set last_visit_at = c.last_visit_at + interval '12 hours'
where c.last_visit_at is not null
  and (c.last_visit_at at time zone 'UTC')::time = time '00:00:00'
  and not exists (select 1 from appointments a
                  where a.client_id = c.id and a.tenant_id = c.tenant_id and a.starts_at = c.last_visit_at);
```

Rode uma vez, **logo depois do deploy da PR-5** (o código novo grava meio-dia e para de criar linhas assim).

---

## 6 · Checklist final do portão (P0 item 1 do `docs/87`)

Marque na ordem. Cada item tem uma prova que cabe em uma linha.

**Antes de tocar em produção**

- [ ] As duas branches estão no `origin` (`git ls-remote --heads origin | findstr melhoria`)
- [ ] Decidido o destino de `public/marca/**` (§1.3): _______________
- [ ] Decidido o destino da pilha `loop/*` (§2.3, item 4): _______________
- [ ] PR-0 (docs) mergeada
- [ ] O `/api/health` de produção mostra o mesmo host de Supabase do painel em que vou colar SQL (§4.0)
- [ ] Plano do banco e último backup anotados: _______________ (se Free: sem `0096`/`0097` até haver backup)
- [ ] Consultas do §4.1 rodadas e coladas de volta; **nenhuma** `0092_amostra` nem `0093_notifications` no livro

**Banco**

- [ ] PR-1 aberta, CI verde (`banco` aplicou as 98 do zero e o código velho passou)
- [ ] `0092` a `0098` **ensaiadas** com `rollback`, sem erro
- [ ] CSV das linhas da `0096` e da `0097` exportado e guardado
- [ ] `0092` a `0098` aplicadas **em ordem**, cada uma sem erro
- [ ] `migration repair --status applied 0092 ... 0098` feito; `migration list` mostra as 7 com Local e Remote
- [ ] Consultas do §4.4: view com 15 colunas e `s.active`; ACL das funções **igual** à de antes; RLS `force` nas duas tabelas; `0096` dá `0`
- [ ] `/api/health` `200` e `schema.ok true` **com o código velho ainda no ar**

**Smoke (a), código velho contra banco novo**

- [ ] CI da PR-1 (camada 1)
- [ ] Cadastro de teste completo em produção; serviços com `canonical_key`; `terms_acceptances` vazia para a conta (passos 2 a 4)
- [ ] Criar serviço, arquivar, abrir Recuperar, Hoje, O mês e a página pública `/<slug>/agendar` sem erro (passos 5 a 8)
- [ ] `UPDATE` da `0096` corrige a linha do CSV de meia-noite para meio-dia (passos 9 e 10)
- [ ] Cron manual verde (passo 11)
- [ ] Conta de teste apagada

**Publicação**

- [ ] PR-1 mergeada; deploy "Ready"; `/api/health` `200`
- [ ] PR-2 a PR-12 mergeadas **uma por vez**, cada uma com health `200` e o teste próprio da linha dela (§4.6)
- [ ] `UPDATE` da `0096` reaplicado logo depois da PR-5; contagem `0`
- [ ] `git diff --stat origin/main melhoria/onboarding-inteligencia-2026-09-28 -- . ':(exclude)docs' ':(exclude).claude' ':(exclude)public/marca'` **vazio** (prova de que nenhum commit de código ficou para trás)
- [ ] Smoke (b) completo, do zero (§4.6), com conta nova
- [ ] `checks.assistente.detail` diz "Motor de Inteligência próprio"
- [ ] Job `vigia` do `cron.yml` sem vermelho por 24 h
- [ ] `docs/87` §4.1 item 1 marcado como feito (a `main` não está mais atrás)
- [ ] `aplicar-migrations-pendentes.md` ganhou uma nota no topo apontando para este documento

---

## 7 · Fora do escopo, mas você precisa saber

- **Defeito do `PATCH` ainda vivo em produção** (`.partial()` do Zod 4 reaplica os defaults do
  `.default(...)` em `servicos.ts`, `profissionais.ts`, `estoque.ts`, `mensagens-prontas.ts` e
  `clientes.ts`; editar 1 campo de um serviço pode zerar sinal e ciclo, e de cliente, o consentimento de
  marketing). O conserto (`parcialSemPadroes`) só existe em `loop/integracao-final`. Não está em nenhuma
  das 13 PRs deste plano. Proponho uma **PR-13 pequena, feita por cima da `main`**, com só esse arquivo
  e as 5 trocas, para não depender da pilha do loop inteira.
- **`loop/integracao-final` e as outras `loop/rodada-*`:** 83 commits que não estão na `main` nem aqui, todos
  só locais. Ver §2.3, item 4.
- **A outra sessão continua commitando docs na branch** (3 commits novos enquanto este documento era
  escrito). Nenhum toca código. Isso só aumenta a contagem da PR-0; refaça
  `git rev-list --count main..HEAD` no dia e confira que `git diff --stat 8d562193..HEAD -- src supabase tests`
  continua vazio.
- **O `docs/87` diz 107 commits** e mandava o Eduardo "rodar `db push`". Corrija as duas frases quando esta
  publicação terminar.
- **A fila é longa para uma pessoa só.** 13 PRs em ~5 dias de trabalho leve. Se o tempo apertar, a ordem
  de **valor por risco** é: PR-0, PR-1, PR-4 e PR-8 (o funil de cadastro que o alpha usa), PR-5 (a
  importação da base é o gancho do alpha), PR-2 e PR-3, e só depois o assistente (PR-6, PR-7) e o resto.

---

## 8 · Decisões que só o Eduardo toma

| # | Decisão | Minha recomendação | Enquanto não decide |
|---|---|---|---|
| 1 | Qual `0092` vale: `ritmo_na_lista_de_recuperar` (esta pilha) ou `amostra_de_historico_do_ciclo` (pilha `loop/*`)? | **`ritmo`**: é a única com código nesta pilha dependendo dela. A `amostra` fica morta, ou renumerada para `0099+` com `if not exists` se a pilha do loop um dia for publicada | O plano segue com a `ritmo` |
| 2 | Onde moram os 45 MB de `public/marca/**` | Fora do repositório do app (Drive), ou em branch/repositório de materiais. Nunca em `public/` | Nenhuma fatia leva; fica no commit `8e05904c` local |
| 3 | A pilha `loop/*` (83 commits locais, com o conserto do `PATCH`) está viva ou morta? E a PR-13 pequena só com `parcialSemPadroes`? | Viva só no conserto do `PATCH` (PR-13 pequena, por cima da `main`); o resto da pilha, arquivar | O defeito do `PATCH` segue vivo em produção |
| 4 | O plano do banco é Free ou Pro, e há backup? | Pro antes do primeiro cliente real (`docs/87` item 6). Sem backup, não aplique `0096`/`0097` sem o CSV do §4.2 | Aplicar só as 5 que não alteram linha (`0092`, `0093`, `0094`, `0095`, `0098`) e deixar `0096`/`0097` para depois do backup. **Não mergeie a PR-1** enquanto faltar alguma: ela sobe `versao.ts` para 98 e o `/api/health` ficaria `503` |
