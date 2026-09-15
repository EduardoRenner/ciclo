# 64 · APP NA APP STORE — PLANO DE IMPLEMENTAÇÃO

> Pedido do Eduardo em 15/09: colocar o CICLO na App Store, sem tirar o site do ar — o app é uma
> CAMADA em cima do produto que já existe, não uma reescrita. Motivo declarado (ver
> [[ciclo-apps-mobile-lojas]]): credibilidade, não distribuição — ele já vende direto pelo site.

| Tag | Significado |
|---|---|
| `[M]` | Medido neste repositório em 2026-09-15 |
| `[E]` | Estimativa — vira fato quando alguém tentar |
| `[BLOQ]` | Bloqueio de ambiente, não de código |

---

## 1 · A aposta

**Capacitor embrulha o Next.js que já existe.** Zero reescrita de tela, zero segunda base de
código para manter em paralelo. O que muda é uma casca nativa em volta do mesmo site — o mesmo
`/admin/hoje`, a mesma agenda, o mesmo Motor de Ciclo.

**O site continua no ar exatamente como está, o tempo todo.** Vercel não muda, `seuciclo.com.br`
(ou o domínio que for) não muda, ninguém que já usa pelo navegador percebe nada. O app é aditivo:
uma nova forma de abrir o MESMO produto, não uma versão paralela que pode divergir.

## 1.1 · O que já existe e ajuda (medido `[M]`)

Isto reduz o risco da diretriz 4.2 da Apple (rejeita app que é "só WebView sem nada nativo") — o
CICLO já não é um WebView pelado:

- `public/manifest.json` — PWA instalável, ícones em 4 tamanhos (192/512, normal/maskable), tema
  escuro coerente.
- `public/sw.js` — service worker próprio, com deny-list documentada no `CLAUDE.md` (nunca
  cacheia `/vault` nem mídia assinada).
- Fila offline (`src/lib/offline`) — mutação enfileira quando a rede cai e reenvia depois; é
  exatamente o tipo de comportamento "sente como app" que passa em revisão.
- Push notification já existe do lado web (`VAPID_*`) — a base conceitual está pronta, mas **push
  nativo no iOS não usa VAPID**, usa APNs (Apple Push Notification service) através do
  `@capacitor/push-notifications`. É trabalho novo, não reaproveitamento direto — ver T3.

## 1.2 · O bloqueio que não é código `[BLOQ]`

**Build e assinatura de app iOS exigem Xcode, que só roda em macOS.** Esta sessão roda em Windows.
Eu escrevo e testo toda a parte web/config deste plano até onde o Windows permite; a partir do
primeiro `npx cap open ios`, alguém precisa de uma máquina Mac — a do Eduardo, de terceiro, ou um
serviço de CI que builda iOS na nuvem (Codemagic, Xcode Cloud, Ionic Appflow). **Decidir qual dessas
três é o primeiro item acionável do Eduardo (T0), porque trava tudo depois de T1–T2.**

---

## 2 · Os tickets

Convenção da casa: objetivo, critério de aceite, onde mexer, armadilhas. Um ticket, um commit.

### T0 · Decisão do Eduardo — onde faz o build iOS `[BLOQ]`

**Não é ticket de código.** Três caminhos, escolher um antes de T5:

| Caminho | Custo | Prós | Contras |
|---|---|---|---|
| Mac próprio/emprestado | R$ 0 extra | Controle total, sem depender de terceiro | Precisa ter acesso a um |
| Codemagic (free tier) | Grátis até um limite de minutos/mês | Não precisa de Mac, integra com GitHub | Configuração inicial, limite de build |
| Xcode Cloud (Apple) | Incluso no Developer Program | Integração nativa com App Store Connect | Só funciona se o projeto já estiver num repo que a Apple acessa |

**Recomendação:** Codemagic — mais simples de ligar a este repositório GitHub sem precisar
comprar/pedir emprestado um Mac.

---

### T1 · Scaffold do Capacitor sobre o Next.js

**Objetivo.** `npx cap init` configurado, apontando para o build estático/SSR do Next existente,
sem quebrar o deploy web atual.

**Critério de aceite.**
1. `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios` instalados como dependência do projeto,
   sem afetar o bundle que a Vercel serve (Capacitor só entra no build nativo, nunca no `next
   build` da Vercel).
2. `capacitor.config.ts` na raiz, com `server.url` apontando para o domínio de produção **em vez de**
   empacotar os assets localmente — isso é o que permite o app abrir sempre a versão mais nova do
   site sem precisar de uma nova submissão à Apple a cada deploy. (Trade-off consciente: revisão
   4.2 às vezes pede assets locais também — ver T4.)
3. `pnpm build`/`pnpm verify` da Vercel continuam passando sem tocar em nada do Capacitor —
   pacotes nativos ficam num diretório próprio (`ios/`), fora do caminho que o `next build` varre.
4. Guarda: nenhum arquivo de `ios/` é lido por `tsc`/`eslint` do projeto Next (adicionar ao
   `.eslintignore`/`tsconfig` `exclude` se necessário).

**Onde mexer.** Raiz do projeto (`capacitor.config.ts`, `package.json`), `ios/` (gerado pelo CLI,
não escrito à mão).

**Armadilhas.**
- `server.url` para produção real, nunca para `localhost` — child da mesma armadilha que
  `criar-tenant-real.mjs` já documentou para scripts de banco: ambiente errado, gravado sem avisar.
- Next.js com Server Components/Server Actions dentro de uma WebView exige atenção a cookies/CORS
  — testar login de verdade antes de considerar T1 pronto (precisa do Mac de T0).

---

### T2 · Ícone, splash screen e identidade nativa

**Objetivo.** O app abre com a marca do CICLO, não com o ícone genérico do Capacitor.

**Critério de aceite.**
1. Ícone gerado nos tamanhos que a Apple exige (1024×1024 fonte, o resto derivado por
   `@capacitor/assets` ou similar) a partir do mesmo ícone que já existe em `public/icons/`.
2. Splash screen com o `background_color`/`theme_color` do `manifest.json` (`#0d0c0c`) — consistência
   com o que a PWA já usa, não uma escolha nova.
3. Nome do app no `Info.plist`: "CICLO" (mesmo `short_name` do manifest).

**Onde mexer.** `ios/App/App/Assets.xcassets/`, `ios/App/App/Info.plist` (gerados, editados depois
do `cap sync`).

**Armadilhas.** Ícone com transparência é rejeitado pela Apple — o `public/icons/icon-512.png`
precisa ser conferido antes.

---

### T3 · Push notification nativo (APNs)

**Objetivo.** Quem instalar o app recebe notificação de verdade — lembrete de horário, alerta de
cliente sumindo — sem depender do navegador estar aberto.

**Critério de aceite.**
1. `@capacitor/push-notifications` integrado; token do dispositivo salvo do mesmo jeito que o
   `VAPID_*` já salva subscription web hoje — **mesma tabela, uma coluna a mais** para o tipo de
   token (`web` vs `apns`), não uma tabela nova (a mesma disciplina de "coluna sem escritor" que já
   guiou o resto do produto: se cria coluna, tem que nascer com escritor E leitor).
2. Certificado APNs gerado no Apple Developer Portal (requer T0/conta ativa) e configurado no
   provedor de push do servidor (`server/providers/messaging/`, que já tem `whatsapp.ts`/
   `email.ts`/`push.ts` — este ticket estende `push.ts`, não cria arquivo novo).
3. Guarda: mesmo padrão de teto diário e pausa que `reminders`/`campaigns` já respeitam — push
   nativo não é um canal novo sem as travas que os outros dois já têm.

**Onde mexer.** `src/server/providers/messaging/push.ts`, migration nova (coluna de tipo de token),
`ios/` (capabilities do Xcode: Push Notifications habilitado).

**Armadilhas.** Certificado APNs expira anualmente — documentar a data de expiração em algum lugar
visível (`docs/DECISOES.md` serve), senão o push para de funcionar em silêncio um ano depois, sem
ninguém entender por quê.

---

### T4 · Ajustes para a diretriz 4.2 (não ser "só WebView")

**Objetivo.** Reduzir o risco de rejeição na primeira submissão — este é o item de MAIOR risco de
prazo do plano inteiro, porque só se confirma testando de verdade contra a revisão da Apple.

**Critério de aceite.**
1. Pelo menos DOIS comportamentos nativos genuínos além do push (T3): candidatos, em ordem de
   esforço — haptic feedback (`@capacitor/haptics`, esforço baixo) em ações de confirmar/cancelar
   agendamento; compartilhamento nativo (`@capacitor/share`) no lugar do link `wa.me` cru, quando
   dentro do app; status bar/safe area nativos (`@capacitor/status-bar`) para não ter WebView com
   barra branca por cima do notch.
2. Ícone de rede/estado offline reconhecível dentro do app — a fila offline que já existe
   (`src/lib/offline`) ganha um indicador visual dentro do app nativo (a versão web pode já ter
   isso; conferir antes de reconstruir).
3. **Não fazer nada disto até T1 estar rodando de verdade num dispositivo** (precisa do Mac de T0)
   — decidir o escopo de "nativo o suficiente" sem ver o app rodando é o mesmo erro que o `docs/51`
   §0 já nomeou para outros planos ("planejar sobre premissa não testada").

**Onde mexer.** Componentes React existentes que dependem do host (detectar `Capacitor.isNativePlatform()`
e ramificar comportamento), nunca duplicar tela.

**Armadilhas.** Adicionar "nativo" demais quebra a promessa original do plano (reaproveitar 100% do
código) — o critério de aceite pede o MÍNIMO que reduz risco de rejeição, não uma reescrita.

---

### T5 · Apple Developer Program + certificados

**Objetivo.** Conta ativa, certificados de assinatura, provisioning profile — os itens que só o
Eduardo pode comprar/assinar (é uma conta de pessoa jurídica ou física dele).

**Critério de aceite.**
1. Conta Apple Developer Program ativa (US$ 99/ano `[M]`, confirmado em 2026-08-31).
2. App ID registrado no portal, com capability de Push Notifications habilitada (pré-requisito de
   T3).
3. Certificado de distribuição + provisioning profile gerados — se usar Xcode Cloud (T0), isso é
   automatizado; se usar Mac próprio/Codemagic, é manual pelo App Store Connect.

**Onde mexer.** Fora do repositório — é conta/portal da Apple. **Só o Eduardo pode fazer este
ticket**, nenhuma sessão de IA tem como comprar a assinatura em nome dele.

---

### T6 · Build, TestFlight e teste em dispositivo real

**Objetivo.** Antes de submeter para revisão pública, alguém usa o app de verdade num iPhone.

**Critério de aceite.**
1. Build via TestFlight (beta interno da própria Apple, sem revisão completa — é rápido, geralmente
   liberado em minutos a poucas horas).
2. Login, agenda, Motor de Ciclo, push (T3) testados manualmente num aparelho real, não só
   simulador — simulador não testa push nativo de verdade.
3. Uma lista de bugs encontrados vira ticket normal antes de avançar para T7.

**Onde mexer.** Nenhuma mudança de código previsível aqui — é ciclo de teste manual e conserto do
que aparecer.

**Armadilhas.** Pular TestFlight e submeter direto pra revisão pública é o jeito mais caro de achar
bug — cada rejeição da revisão completa custa dias, o TestFlight custa minutos.

---

### T7 · Submissão e revisão da App Store

**Objetivo.** O app aprovado e publicado.

**Critério de aceite.**
1. Ficha da loja preenchida: descrição, screenshots (mínimo por tamanho de tela exigido pela
   Apple), categoria (Business ou Productivity), política de privacidade **linkada para
   `/privacidade`, que já existe** (`docs/31` confirma que a página já foi criada por decisão de
   lançamento anterior — reaproveitar, não recriar).
2. Submissão enviada via App Store Connect.
3. Se rejeitado: ler o motivo exato, corrigir, ressubmeter — **não é permitido "tentar de novo sem
   mudar nada"**, a Apple registra o padrão de tentativa e piora a relação com contas que fazem isso.

**Onde mexer.** App Store Connect (fora do repositório).

**Armadilhas.** A causa mais comum de rejeição para apps deste perfil (WebView + PWA) é
precisamente a 4.2 — é por isso que T4 vem antes, não depois.

---

## 3 · Ordem e paralelismo

```
T0 (Eduardo, decide onde builda)
  └─▶ T1 (scaffold) ─▶ T2 (ícone/splash) ─▶ T6 (testar em device — precisa do Mac de T0)
         │                                        ▲
         └─▶ T3 (push nativo) ──────────────────┘
         └─▶ T4 (ajustes 4.2) ──────────────────┘
                                                   │
T5 (Eduardo, conta+certificados — pode rodar em paralelo com T1-T4)
                                                   ▼
                                                  T7 (submissão)
```

**T0 e T5 são do Eduardo e podem começar imediatamente, em paralelo com T1-T4.** T1-T4 são código e
podem ser escritos nesta sessão, mas **T6 em diante depende fisicamente do Mac** que T0 escolhe.

## 4 · Custos `[M]`

| Item | Custo | Recorrência |
|---|---|---|
| Apple Developer Program | US$ 99 (~R$ 550-600) | Anual |
| Codemagic (se for essa a escolha de T0) | Grátis até um teto de minutos/mês | — |
| Certificado APNs | Incluso no Developer Program | Anual (expira junto) |

## 5 · Prazo, honesto sobre a variável que eu não controlo

| Fase | Tempo `[E]` |
|---|---|
| T1 + T2 (scaffold, ícone) | 1 dia de trabalho de código |
| T3 (push nativo) | 1-2 dias |
| T4 (ajustes 4.2) | 1-3 dias — a variável mais incerta, só se confirma testando |
| T5 (conta Apple) | 1-2 dias, aprovação da Apple pode demorar |
| T6 (TestFlight + teste real) | 1-2 dias |
| T7 (revisão da Apple) | 1-3 dias, mais se rejeitar na primeira |

**Total: 1 a 3 semanas**, quase todo o range vindo de quantas vezes a Apple rejeita e de quão rápido
o Eduardo resolve T0/T5 (que não sou eu que resolvo).

## 6 · O que NÃO muda

1. **O site continua no ar, sem interrupção, durante todo este plano.** Nenhum ticket aqui toca
   `next.config`, rotas ou deploy da Vercel de um jeito que afete quem usa pelo navegador.
2. **Nenhum dado de saúde/RLS/multi-tenant muda de comportamento** — o app é uma casca sobre a
   mesma API, mesma autenticação, mesma regra de negócio.
3. **Não é um "app separado" para manter.** Toda tela nova no site aparece automaticamente no app
   (por causa do `server.url` apontando pra produção, T1) — o único trabalho contínuo depois do
   lançamento é revisão de certificado anual (T3/T5) e, ocasionalmente, um novo build se a Apple
   mudar requisito de SDK mínimo.
