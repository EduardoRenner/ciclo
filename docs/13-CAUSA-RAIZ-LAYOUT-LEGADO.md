# 13 · O layout roxo que volta — causa raiz, arquitetura e plano de execução

> **2026-08-22.** Auditoria feita a pedido do Eduardo ("o layout volta pro roxo antigo em
> determinados momentos"). Este documento **diagnostica e planeja**; a execução é de outra
> sessão. Nada de código foi alterado ao escrevê-lo.
>
> Toda linha marcada `▲` foi **medida** (comando rodado, valor lido do banco, resposta HTTP,
> commit datado). O que é inferência está marcado como inferência.

---

## 0 · Veredito em cinco linhas

O roxo não vem do código que está no ar hoje — **o CSS servido em produção não tem um único hex
roxo** (▲ medido). Ele volta porque o **service worker congelou uma cópia do app da era roxa e
nunca mais a invalidou**: o nome do cache (`ciclo-v2`) foi fixado às 05:38 de 19/08 e o roxo só
saiu do produto às 20:55 do mesmo dia (▲ dois commits datados). Quem abriu o app naquela janela
de 15 horas tem, até hoje, o shell roxo guardado — e o service worker serve **cache primeiro**,
rede depois. Existem ainda **três outros focos de roxo** independentes, que não explicam o
sintoma relatado mas precisam morrer junto (§3).

---

## 1 · Método e evidências

| # | O que foi feito | Resultado |
|---|---|---|
| ▲1 | Criados 4 tenants descartáveis (`barber`, `lashes`, `brows`, `hair`), buscado o HTML público de cada um e lido o `--acc` inline | `barber #f59e0b` · `lashes #a855f7` · `brows #8b5cf6` · `hair #f0ebe3` — apagados em seguida |
| ▲2 | Lido o CSS que produção realmente serve (`/_next/static/css/app/layout.css`, 65 KB) e varrido por 9 hexes roxos | **zero ocorrências** |
| ▲3 | `git log -S` no `sw.js` e no `globals.css`, com datas e teste de ancestralidade | cache fixado **antes** do fim do roxo (§2) |
| ▲4 | Inspecionado o registro do service worker no navegador, em produção, depois de `load` completo | `swRegistrado: false`, zero caches — o registro **não acontece** nesta linha do tempo (§4.2) |
| ▲5 | Lidos os cabeçalhos de produção de 4 rotas | HTML dinâmico vem com `private, no-cache, no-store` |
| ▲6 | Rastreados os tenants e usuários reais no banco | a conta nova do Eduardo é `lang-barber`, vertical **`barber`** |
| ▲7 | Buscado todo consumidor de `professionals.color` no `src/` | um só — o próprio formulário que grava |

**Conta usada no relato:** `socciolangvitor@gmail.com` → tenant `lang-barber`, vertical `barber`,
criado 22/08 17:57. Como `barber` resolve para âmbar (`#f59e0b`) e não para roxo, **a paleta por
profissão não explica o que ele viu** — foi o que descartou a primeira hipótese.

---

## 2 · Causa raiz

### 2.1 O mecanismo

`public/sw.js` intercepta **todo GET** que não seja `/api/*` e responde assim:

```js
// public/sw.js:44-56
return cacheado || buscaDeRede   // cache primeiro; a rede só atualiza para a PRÓXIMA vez
```

E guarda no cache **qualquer resposta 200**, incluindo documentos HTML:

```js
// public/sw.js:47-50
if (resposta.ok) { const copia = resposta.clone(); caches.open(CACHE_VERSAO).then((c) => c.put(request, copia)) }
```

A invalidação depende exclusivamente de o **nome** do cache mudar:

```js
// public/sw.js:9
const CACHE_VERSAO = 'ciclo-v2'
// public/sw.js:23-29 — activate apaga só o que tem nome DIFERENTE do atual
```

Como `'ciclo-v2'` é uma string digitada à mão, **um deploy não invalida nada**. O cache de quem
já visitou o app sobrevive a todos os deploys seguintes, para sempre.

### 2.2 A linha do tempo que fecha o caso

| Quando | Commit | O que aconteceu |
|---|---|---|
| ▲ 19/08 **05:38** | `1326ad5` | App migra para `/admin/*` e `CACHE_VERSAO` vira `'ciclo-v2'` — **último bump** |
| ▲ 19/08 **20:55** | `22fc4a2` | Redesign de identidade: `--acc` deixa de ser o purple-500 (`#a855f7`) e vira osso (`#f0ebe3`); ícones do PWA regerados |

▲ `git merge-base --is-ancestor` confirma a ordem: **o bump veio antes do redesign**.

Consequência: todo navegador que carregou o app entre 05:38 e 20:55 de 19/08 gravou em `ciclo-v2`
o HTML roxo, o CSS roxo (nome com hash, então convive com o novo), o `manifest.json` antigo e os
**ícones roxos** do monograma anterior. Nada disso jamais foi apagado.

### 2.3 Por que "às vezes" e por que "volta"

- O `activate` só limpa cache com nome diferente — e o nome não muda há três dias de deploys.
- `cacheado || buscaDeRede` devolve o **cache na hora**: a versão nova só aparece na navegação
  seguinte. É o padrão "sempre uma versão atrasada".
- As quatro rotas mais usadas são **pré-cacheadas** no install (`/admin/hoje`, `/admin/agenda`,
  `/admin/clientes`, `/admin/recuperar` — `sw.js:10`), e `manifest.json:start_url` é
  `/admin/hoje`. O app instalado abre exatamente na rota com maior chance de estar velha.
- ▲4 mostra que o registro do SW é **intermitente por bug próprio** (§4.2): em alguns momentos
  ele existe (e serve o cache roxo), em outros nem registra (e a rede entrega o layout novo).
  É a explicação mais provável do "ora certo, ora roxo" no mesmo aparelho — *inferência*, porque
  não tenho acesso ao navegador do Eduardo.

### 2.4 O que a correção precisa garantir

1. Quem **já está contaminado** se cura sozinho ao abrir o app depois do deploy da correção.
2. Um deploy futuro **nunca mais** pode deixar cache velho de pé.
3. HTML de tela autenticada **não pode** ficar em cache compartilhado por URL (§4.3).

---

## 3 · Os outros focos de roxo (não explicam o sintoma, mas existem)

| # | Onde | Evidência | Alcance | Veredito |
|---|---|---|---|---|
| R1 | `vertical_packs.accent_color` = `#a855f7` (cílios) e `#8b5cf6` (sobrancelhas) | ▲ lido do banco e reproduzido no HTML (§1 ▲1) · `0002_vertical_packs.sql:35,172` | Site público de todo salão dessas duas profissões | **Corrigir.** Contradiz a Parte II do redesign |
| R2 | `CORES[0] = '#a855f7'` pré-selecionado ao cadastrar profissional | `src/app/admin/config/profissionais/formulario.tsx:24,39` | Grava roxo em `professionals.color` por padrão | **Corrigir.** Default legado |
| R3 | `professionals.color` é gravado e **nunca lido** | ▲7 — único consumidor é o próprio formulário; a coluna diz "cor na agenda" (`0001_initial.sql:100`) | Dado morto | **Decidir:** usar na agenda ou remover |
| R4 | `docs/03-DESIGN-SYSTEM.md:25` ainda declara `--acc: #a855f7` e a paleta roxa por nicho | leitura do arquivo | Documentação | **Corrigir.** É a fonte que fez R1 nascer |

Fora da lista de propósito: `Avatar` deriva o matiz do hash do nome (`src/components/ui/avatar.tsx:31-34`),
então alguns nomes caem em matiz roxo. É comportamento desenhado, determinístico e sem relação
com o tema — **não mexer**.

---

## 4 · Bugs adjacentes achados no caminho

### 4.1 ▲ O service worker desobedece `no-store`
Produção manda `Cache-Control: private, no-cache, no-store, max-age=0` no HTML dinâmico (▲5).
O SW ignora o cabeçalho e guarda assim mesmo (`sw.js:47`). O servidor diz "não guarde" e o cliente
guarda — é a origem dos dois problemas seguintes.

### 4.2 ▲ O registro do service worker quase nunca acontece
```tsx
// src/components/shell/registrar-service-worker.tsx:8-14
useEffect(() => { window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js') }) }, [])
```
`useEffect` roda **depois** da hidratação, que normalmente é depois do evento `load` — então o
listener é pendurado num evento que já passou e o registro nunca dispara. ▲ Medido em produção:
`swRegistrado: false` mesmo com `document.readyState === 'complete'`. Efeitos: o PWA não fica
instalável de forma confiável, o offline do TICKET-055 não vale, **e** o comportamento fica
dependente de timing — que é justamente o que produz intermitência.

### 4.3 ⚠️ Vazamento de tela autenticada entre pessoas no mesmo aparelho — **segurança**
O cache do SW é indexado **só pela URL**. `/admin/hoje` é a mesma URL para qualquer usuário.
Num aparelho compartilhado (o tablet do balcão, o celular que o dono empresta), a segunda pessoa
a abrir `/admin/hoje` pode receber **o HTML renderizado da primeira** — com nome de cliente,
faturamento do dia e agenda. O mesmo vale **depois do logout**: a tela continua no cache.
Não é vazamento entre tenants pela rede (a RLS continua de pé), é vazamento **no dispositivo**,
por baixo da sessão. Deve ser tratado como P0 junto com a causa raiz.

### 4.4 Sem trilha de versão no cliente
Não existe nenhum identificador de build exposto ao navegador. Sem isso não dá para (a) nomear o
cache por deploy, (b) saber que versão um usuário está rodando quando ele relata um bug.

---

## 5 · Arquitetura alvo

### 5.1 Quem é dono da aparência

Hoje a cadeia é implícita e a profissão manda:

```
tenant.vertical → vertical_packs.accent_color → --acc inline no /[slug]   (site público)
globals.css --acc (osso, fixo)                                            (app do profissional)
```

Duas fontes diferentes para a mesma pergunta, e a do site público é a antiga. Alvo:

```
Tenant (dono do salão)
  └── settings.site.accent          ← fonte da verdade, escolhida pelo dono
        ├── ausente → osso (#f0ebe3), o mesmo do app
        └── inválido → osso + aviso no log (nunca "cor de fábrica" silenciosa)
```

`vertical_packs` continua semeando **serviços e produtos** — deixa de opinar sobre cor. Regras:

1. **Uma fonte só.** O acento do site público e o do app saem do mesmo lugar; o site pode
   sobrescrever com a cor do salão, o app não.
2. **Default explícito, nunca silencioso.** Cor ausente → osso. Cor inválida → osso **e** um
   `console.warn` no servidor. Nunca cair num valor histórico.
3. **Validação na borda.** `^#[0-9a-f]{6}$` já existe em `(public)/[slug]/layout.tsx:31`; passa a
   valer também na escrita (`PATCH /api/v1/tenant`), com Zod.
4. **O frontend não decide.** Nenhum estado local, `localStorage` ou cache do SW pode determinar
   aparência — só o que o servidor renderizou naquela resposta.

### 5.2 Contrato do service worker

| Tipo de recurso | Estratégia | Por quê |
|---|---|---|
| `/_next/static/*` (nome com hash) | cache-first, imutável | Nome muda a cada build; nunca fica velho |
| HTML público (`/`, `/{slug}`, `/{slug}/agendar`) | **network-first**, cache como último recurso offline | Conteúdo muda; nunca pode atrasar uma versão |
| HTML autenticado (`/admin/*`, `/onboarding`) | **nunca cachear** | Dado pessoal indexado por URL (§4.3) |
| `/api/*`, `/auth/*`, `/vault` | nunca interceptar | Já era a regra; mantida |
| Resposta com `no-store` | nunca cachear, seja qual for a rota | O servidor já disse o que fazer |

Nome do cache = `ciclo-${BUILD_ID}`, com `BUILD_ID` vindo do build (não digitado). Assim todo
deploy cria um cache novo e o `activate` apaga **todos** os anteriores — inclusive o `ciclo-v2`
roxo que está solto por aí.

---

## 6 · Plano de execução

Ordem obrigatória: **T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8**. T1 e T2 são o que apaga o roxo de
quem já está contaminado; o resto impede que volte por outro caminho.

### T1 · Reescrever o service worker — **P0**
**Arquivos:** `public/sw.js`, `next.config.ts`, `src/components/shell/registrar-service-worker.tsx`

1. Expor um identificador de build ao cliente. Em `next.config.ts`:
   `env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev' }`.
2. Registrar com a versão na URL: `register('/sw.js?v=' + process.env.NEXT_PUBLIC_BUILD_ID)`.
   Muda a URL do worker a cada deploy → o navegador instala um worker novo mesmo que o conteúdo
   do arquivo seja idêntico.
3. Dentro do `sw.js`, ler a versão de `new URL(self.location).searchParams.get('v')` e usar
   `const CACHE = 'ciclo-' + versao`. Manter o `activate` que apaga todo cache com nome diferente
   — é ele que cura os contaminados.
4. Trocar a estratégia pela tabela de §5.2. Em especial: `NUNCA_CACHEAR = /^\/(api|auth|admin|onboarding|entrar|cadastro|verificar|nova-senha|recuperar-senha)\//`
   e checar `resposta.headers.get('cache-control')?.includes('no-store')` antes de qualquer `put`.
5. Tirar as rotas autenticadas do `APP_SHELL`. O que faz sentido pré-cachear é a casca estática e
   uma página de fallback offline — não a tela com o faturamento do dia.

**Aceite:** ▲ abrir o app, confirmar `caches.keys()` com um único nome contendo o SHA do deploy;
navegar em `/admin/hoje` com o SW ativo e confirmar, na aba de rede, que o HTML veio da rede;
confirmar que `/admin/*` não aparece em `caches.open(...).keys()`.

**Risco:** perder o "abre offline" das telas autenticadas. É perda consciente e documentada —
a alternativa é manter dado pessoal em cache compartilhado por dispositivo (§4.3). A fila de
mutações offline (`src/lib/offline/api-client.ts`) **não** depende do cache de HTML e continua
funcionando.

### T2 · Consertar o registro do service worker — **P0**
**Arquivo:** `src/components/shell/registrar-service-worker.tsx`

Registrar já se `document.readyState === 'complete'`; senão pendurar no `load`. Sem isso, T1
demora a chegar (ou não chega) nos aparelhos, e o comportamento continua dependendo de timing.

**Aceite:** ▲ `navigator.serviceWorker.getRegistration()` retorna registro em aba nova, em
produção, sem interação.

### T3 · Tirar a cor do pacote de profissão — **P1**
**Arquivos:** nova migration; `src/server/services/public-booking.ts:106,125,137`;
`src/app/(public)/[slug]/layout.tsx`

A cor passa a sair de `tenants.settings.site.accent` (§5.1), com osso como padrão. `vertical_packs`
para de ser lido para cor. Ver §7 para a migração de dados.

**Decisão pendente do Eduardo (uma linha, mas é dele):** o dono do salão **escolhe** a cor do site?
Se sim, entra um seletor em `/admin/config/negocio` (o `PATCH /api/v1/tenant` já faz merge em
`settings`). Se não, todo site público nasce osso e o campo nem existe. O plano abaixo assume
**sim**, porque é o site do salão, não do CICLO — mas T3 pode ser executado sem o seletor,
deixando todos em osso.

**Aceite:** tenant `lashes` novo tem site osso, não roxo; tenant com `settings.site.accent`
definido usa a cor dele; hex inválido cai em osso com aviso no log, não em roxo.

### T4 · Matar o roxo do cadastro de profissional — **P2**
**Arquivos:** `src/app/admin/config/profissionais/formulario.tsx:24,39`

Trocar a paleta `CORES` por uma alinhada ao tema atual e **não pré-selecionar** cor: sem escolha,
grava `null`. Junto, decidir o destino de `professionals.color` (R3): ou a agenda passa a usar
(útil de verdade com 3+ profissionais), ou a coluna sai por migration. **Não deixar como está** —
hoje grava roxo que ninguém vê.

### T5 · Sincronizar a documentação — **P2**
**Arquivo:** `docs/03-DESIGN-SYSTEM.md:25,46,49`

O documento ainda declara `--acc: #a855f7` e a paleta roxa por nicho — foi ele que gerou R1.
Marcar as seções como substituídas pela Parte II de `08-REDESIGN-E-IDENTIDADE.md`, com data.

### T6 · Fechar o buraco de cabeçalho — **P2**
**Arquivo:** `src/middleware.ts`

Cravar `Cache-Control: private, no-store` explicitamente nas respostas de `/admin/*` em vez de
depender do default do Next. Defesa em profundidade: se amanhã alguém puser um CDN na frente, a
regra já está escrita.

### T7 · Testes de regressão — **P1** (§8)

### T8 · Limpeza — **P3**
Só depois de T1–T7 verdes: remover o que sobrou de morto, com prova de que ninguém importa.

---

## 7 · Migração de dados

**Diagnóstico atual** (▲ lido do banco):

| Entidade | Chave | Valor atual | Valor esperado | Problema | Risco |
|---|---|---|---|---|---|
| `vertical_packs` | `lashes` | `#a855f7` | osso ou cor do salão | Roxo legado do design system antigo | Todo site de cílios nasce roxo |
| `vertical_packs` | `brows` | `#8b5cf6` | idem | idem | idem |
| `vertical_packs` | `nails`/`barber`/`waxing`/`aesthetics` | `#ec4899`/`#f59e0b`/`#f97316`/`#10b981` | idem | Paleta por nicho contradiz a identidade única | Site público nunca parece o mesmo produto |
| `tenants` | 3 ativos | `settings.site` só em `dom-rocha` | — | Nenhum tenant tem cor própria | Nenhum — é o estado inicial esperado |
| `professionals` | — | `color` gravado, nunca lido | usar ou remover | Dado morto com default roxo | Baixo |
| enum `vertical_pack` | `hair`, `tattoo` | sem linha em `vertical_packs` | — | Já conhecido e tolerado | Cai no padrão osso — **correto** |

**Migração proposta** (`supabase/migrations/00XX_cor_do_site_do_tenant.sql`):

1. `alter table vertical_packs alter column accent_color drop not null;` e
   `update vertical_packs set accent_color = null;` — a coluna deixa de ditar cor, mas **não é
   removida** nesta migration (remoção só depois de T7 verde, para o rollback ser barato).
2. Nenhum `update` em `tenants`: quem não tem `settings.site.accent` cai no padrão osso por
   código. Não inventar cor para salão nenhum.
3. **Idempotente** (rodar duas vezes dá o mesmo resultado), **reversível** (o `down` recoloca os
   seis valores, que ficam escritos em comentário no topo do arquivo), **limitada** (uma tabela
   de configuração, seis linhas, nenhum dado de cliente encostado).

**Regra:** rodar em produção só com o Eduardo avisado. Os seis valores atuais ficam registrados
no arquivo para o rollback ser copiar e colar.

---

## 8 · Testes de regressão exigidos

Os dez cenários pedidos, mapeados para o que dá para automatizar aqui:

| # | Cenário | Onde | Como |
|---|---|---|---|
| 1 | Conta nova → layout correto | `tests/integration/` | Onboarding real de cada vertical; `perfilPublico(slug).accentColor.acc` = osso, nunca `#a855f7`/`#8b5cf6` |
| 2 | Recarregar mantém o layout | Playwright (`pnpm test:e2e`) | Carrega `/{slug}`, lê `--acc` computado, recarrega, compara |
| 3 | Logout → login mantém | Playwright | Idem, atravessando a sessão |
| 4 | Sessão nova mantém | Playwright, contexto novo | Idem |
| 5 | Dois tenants não se misturam | Integração + Playwright | Tenants A e B com cores diferentes; abrir A depois B na mesma aba e conferir que B não herda A |
| 6 | Configuração ausente | Unitário | Tenant sem `settings.site.accent` → osso; **falha o teste se sair roxo** |
| 7 | API lenta | Playwright com throttling | Sem piscar de cor: o acento é resolvido no servidor, então o HTML já nasce com a cor certa |
| 8 | API falhando | Integração | `perfilPublico` que estoura → página de erro declarada, nunca layout de fábrica |
| 9 | **Cache não serve tela autenticada** | Unitário sobre o `sw.js` | Rodar o handler de `fetch` com uma URL `/admin/hoje` e provar que nada é gravado; e que resposta com `no-store` nunca é gravada |
| 10 | Mobile | Playwright 375×812 | Telas principais sem estouro horizontal |

**Teste que fecha a causa raiz (o mais importante):** um unitário do `sw.js` provando que
(a) o nome do cache muda quando a versão muda e (b) o `activate` apaga o cache anterior. É esse
que impede a regressão de 19/08 de acontecer de novo.

---

## 9 · O que eu **não** consegui provar

1. **Que foi exatamente o cache do SW que o Eduardo viu.** O mecanismo está provado (§2), a
   janela de contaminação está datada, mas o cache é do navegador dele — não tenho acesso. Se ele
   quiser confirmar em 10 segundos: abrir o app, DevTools → Application → Cache Storage, e ver se
   existe `ciclo-v2`. Se existir, é isso.
2. **Que a paleta por vertical não teve nada a ver.** A conta dele é `barber` (âmbar), então não
   deveria — mas se ele tiver criado antes uma conta de cílios/sobrancelha, viu roxo de verdade,
   por R1, e são dois problemas somados.
3. **O tamanho do estrago do §4.3.** Não dá para saber quantos aparelhos compartilhados existem.
   Trato como P0 pelo tipo do dado, não pela frequência medida.

---

## 10 · Ordem de execução para quem for implementar

```
T1 (service worker)        ← apaga o roxo de quem já está contaminado
  ↓
T2 (registro do SW)        ← faz T1 efetivamente chegar nos aparelhos
  ↓  deploy + verificação em produção (caches.keys() com o SHA do deploy)
T3 (cor sai do pacote)  →  migração §7  →  verificação com tenant descartável
  ↓
T4 (default do profissional)  ·  T5 (documentação)  ·  T6 (cabeçalho)
  ↓
T7 (testes de regressão, incluindo o unitário do sw.js)
  ↓
pnpm verify  →  deploy  →  T8 (limpeza do legado, com prova de não-uso)
```

**Não considerar pronto porque o roxo sumiu numa olhada.** Pronto é: cache nomeado por build,
tela autenticada fora do cache, uma fonte só para a cor, os dez testes de §8 no verde, e o
`ciclo-v2` provadamente apagado dos aparelhos que abriram o app depois do deploy.
