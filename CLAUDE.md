# CLAUDE.md · CICLO
Leia `docs/00-BRIEFING.md` antes de qualquer coisa. Este arquivo é o resumo operacional que vale para **toda** sessão.

---

#### Contexto em uma frase

CICLO é um SaaS multi-tenant de gestão para **qualquer profissional que tem agenda e clientes que voltam** — não só beleza (barbearia, unhas, estética), mas também faxineira, eletricista, personal trainer e afins (`docs/09-PLATAFORMA.md`). Mobile-first, pt-BR, Next.js + Supabase. O diferencial é o **Motor de Ciclo**, que prevê quando cada cliente volta e traz de volta automaticamente.

---

#### Comandos

```bash
pnpm dev            # sobe o app (precisa de `supabase start` antes)
pnpm verify         # typecheck + lint + test:unit + test:rls + build  ← rode antes de todo commit
pnpm test:unit      # Vitest em src/core
pnpm test:rls       # isolamento multi-tenant (NUNCA pule)
# pnpm test:e2e     # NÃO EXISTE AINDA — sem Playwright instalado e sem config (ver DECISOES 31/08)
pnpm db:types       # regenera src/server/db/types.gen.ts
pnpm db:reset       # reset local + seed (bloqueado em produção)
pnpm db:new <nome>  # cria nova migration
```

---

#### Regras invioláveis

1. **RLS sempre.** Tabela nova sem `enable row level security` + `force row level security` + política + teste quebra o build. Nunca desabilite RLS para depurar; use `select set_tenant_context('<uuid>')` no psql.
2. **`service_role` só dentro de `src/server/db/with-tenant.ts`** e das Edge Functions. Há regra de lint. Não contorne.
3. **Dinheiro em centavos** (`bigint`, sufixo `_cents`). Percentual em basis points (`_bps`). Nunca float.
4. **Tempo em `timestamptz` UTC.** Conversão para o fuso do tenant só na apresentação. Nunca aritmética em horário local.
5. **Regra de negócio em `src/core/`**, funções puras, sem I/O. `core/` não importa de `server/` nem de `app/`.
6. **Escrita sempre por `/api/v1`** com `Idempotency-Key`. Server Action só em formulário simples que não precisa de offline.
7. **Zod na borda.** Toda entrada validada antes de tocar no banco.
8. **Nada de `any`.** Use `unknown` e refine.
9. **Dado de saúde nunca em log, Sentry ou analytics.** Redija antes.
10. **Segredo nunca no repositório** — nem em teste, nem em comentário, nem em seed.
11. **Nunca delete** agendamento, movimento de estoque ou registro de auditoria. Use estado/compensação.
12. **Um ticket, um commit**, mensagem em português: `feat(agenda): impedir agendamento sobreposto (TICKET-021)`.

---

#### Antes de considerar um ticket pronto

- [ ] Critério de aceite do ticket satisfeito
- [ ] `pnpm verify` passa
- [ ] Teste novo para o caminho feliz e um caminho de erro
- [ ] Tabela nova tem RLS + política + aparece no teste de isolamento
- [ ] Estados de carregamento, vazio e erro implementados
- [ ] Funciona a 390 px de largura, alvos ≥ 48 px
- [ ] Texto em pt-BR, sem jargão, erro explica o que fazer
- [ ] `audit_log` gravado nas mutações relevantes
- [ ] **Se o ticket criou um teste-guarda, ele foi visto REPROVANDO** — ver abaixo

---

#### Teste-guarda: escrever é metade, ver reprovar é a outra

Vários testes deste projeto varrem o código-fonte em vez de exercitar comportamento
(`preco-em-um-lugar-so`, `titulos-de-tela`, `home-nao-promete-demais`, `cron-cobre-os-fusos`). São
baratos e pegam regressão real — e falham de um jeito específico e silencioso.

Na auditoria de 2026-08-25, de **cinco** guardas escritas, **três** estavam cegas. Todas passavam.
Todas teriam sido entregues como verificadas. Cada uma casava com algo que o arquivo contém **por
outro motivo**:

| Casava com | Devia casar com |
|---|---|
| o nome da função | a **chamada** (`await fn(`) — o nome solto casa com a linha de `import` |
| uma palavra da frase | a **frase** — `/telefone/` casava com o rótulo "Seu telefone (WhatsApp)" |
| `vercel.json` | o `cron.yml` — o outro fica vazio **de propósito**, e a guarda bloquearia copy honesta para sempre |
| uma janela de N caracteres | o **fim real do elemento** — o vizinho cai dentro da janela |

**A regra:** case com o que **muda** quando o defeito volta. Nunca com um nome que aparece em
`import`, rótulo, comentário ou string vizinha. E delimite pelo fim do elemento, nunca por contagem
de caracteres.

**O procedimento, e ele não é opcional:**

1. **Commite antes de mutar.** `git checkout --` sobre mudança não commitada apaga a mudança, e o
   `git status` não denuncia se o arquivo novo era untracked. Já custou um conserto que foi
   commitado sem o código que ele guardava — a CI reprovou apontando o próprio defeito.
2. Reintroduza **cada** defeito que a guarda existe para pegar, um por vez.
3. **Confirme que a mutação foi aplicada** antes de ler o resultado. Um `sed` com escape que não
   casa dá um "guarda cega" falso — e quase fez reescrever uma guarda que funcionava.
4. Guarde contra o próprio detector: se o padrão parar de casar, o teste tem que **gritar**, não
   passar vazio.

> Guarda que nunca foi vista reprovando é guarda que ninguém sabe se funciona.

---

#### Verde não é prova

Três casos medidos nesta base, todos com check verde:

- um run de integração com **3 de 5 casos pulados** — o verde dizia que parou de falhar, não que
  funciona;
- o cron respondendo **`200` com `tenantsProcessados: 0`** por meses;
- um teste que afirmava "tudo fica vazio" e **passava vazio**, sem montar o cenário.

**Falso verde é pior que flake:** flake incomoda até alguém consertar; falso verde tranquiliza.

Consequências práticas:

- caso que **pula** precisa dizer por quê, e suíte verde com skip não prova o cenário;
- teste que assere lista vazia precisa provar que o cenário foi montado;
- mudança que a pessoa **vê** se verifica no navegador, não se deduz do código — três hipóteses
  desta auditoria caíram ao serem medidas, incluindo uma em que o `catch` do conserto fez a região
  viva anunciar algo falso.

---

#### Quando faltar informação

1. Procure em `docs/05-FAQ-DEV.md` (132 decisões já tomadas).
2. Não achou? Escolha a opção **mais simples** que atenda ao critério de aceite.
3. Registre em `docs/DECISOES.md`: `2026-08-20 · pergunta · decisão · motivo`.
4. Continue. **Não pare a implementação para perguntar.**

---

#### Estilo

- Código, tabelas e colunas em **inglês**. UI, mensagens ao usuário, comentários e commits em **português**.
- Componente: um arquivo, export default, props tipadas, sem `React.FC`.
- Server Component por padrão; `'use client'` só onde precisa de estado/evento.
- Nada de comentário óbvio. Comente **por que**, não **o que**.
- Nunca crie arquivo que o ticket não pediu. Nada de README extra, nada de `utils.ts` genérico.

---

#### Armadilhas conhecidas deste projeto

| Armadilha | O certo |
|---|---|
| Verificar conflito com `SELECT` antes do `INSERT` | A constraint `appointments_no_overlap` já resolve. Trate o erro e devolva 409 com alternativas. |
| Somar minutos em horário local para gerar slot | Converta para instante UTC. Dia de mudança de fuso tem 23 ou 25 horas — há teste. |
| Criar view sem `security_invoker = true` | A view fura a RLS. Sempre com `security_invoker`. |
| Cachear resposta de `/vault` ou mídia assinada no service worker | Proibido. Adicione à deny-list do Workbox. |
| Calcular desconto percentual e guardar o percentual | Guarde o valor em centavos. Preço muda; histórico não pode mudar. |
| Reconhecer receita de pacote na venda | Receita é por sessão consumida. Dinheiro entra em `payments`, receita em `ticket_items`. |
| Bloquear atendimento por estoque negativo | Alerte, não bloqueie. Bloquear faz o salão abandonar o sistema. |
| Marcar no-show automaticamente | O sistema **sugere**; quem marca é o profissional. |
| Deletar o movimento de estoque no estorno | Gere movimento compensatório do tipo `return`. |
| Confiar no `tenant_id` do corpo da requisição | Use sempre o do contexto validado. |
| `await fetch` sem `try` dentro de `useTransition` | No React 19 a Action que rejeita é **re-lançada para o error boundary**: uma piscada de rede derruba a tela inteira e leva o que a pessoa preencheu. Trate ali mesmo, ou use o `apiFetch` de `lib/offline`, que enfileira. Há linha de base em `tests/unit/design/rede-nao-derruba-tela.test.ts` — a lista só encolhe. |
| Trocar conteúdo sem trocar de rota e não avisar | Filtro, busca e seletor de dia mudam a tela inteira; quem usa leitor de tela não é avisado. Região `aria-live` que vive **sempre** no DOM (nascer junto com o conteúdo não é anunciado), com texto saindo do **mesmo estado** que desenha a tela. |
| `catch` que devolve um padrão e segue | A maioria é legítima. O critério: o `catch` **descarta** alguma coisa? Então tem que contar e avisar. Já apagou fila offline no logout e deixou lista antiga na tela como se fosse resultado de busca. |
| Prometer canal ("vai receber por WhatsApp") | Só se houver rota **agendada** e credencial existente. A promessa mais cara é a da página do cliente do tenant: quem fica mal é o salão, não o CICLO. |
| Texto de erro escrito para o profissional numa tela pública | `app/error.tsx` é o boundary da **raiz**. Ele já decide a saída por `usePathname()` — não volte a fixar `/admin/hoje`. |
| Apendar em `docs/DECISOES.md` sem rebasear | Todos apendam no fim: dois PRs abertos ao mesmo tempo conflitam sempre. Rebaseie **antes** de abrir o PR. |
| Empurrar vários commits seguidos num PR | `concurrency: cancel-in-progress` reinicia o job de banco (~5 min) a cada push. Junte os commits antes de empurrar. |
