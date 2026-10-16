# Rumo à loja: execução de 15/10/2026

Continuação de `11-rumo-a-app-store.md`. Branch de código: `loja/lacunas-2026-10-15` (worktree `ciclo-loja`, saída de `origin/main` em `33058dd0`). Nada foi para produção, nada foi publicado em loja, nada foi gasto.

Rótulos: **FATO** (medido nesta rodada), **INFERÊNCIA**, **NÃO VERIFICADO**.

## 1. O que foi feito, um commit por lacuna

Toda lacuna tem teste novo que foi **visto reprovando** antes do conserto e de novo numa mutação depois do commit (o defeito reintroduzido à mão, um por vez). 21 mutações, 21 reprovações.

| Lacuna | Commit | O que mudou | Evidência |
| --- | --- | --- | --- |
| LOJA-22 | `36cbb5d0` | `apple-review` entra em `SLUGS_DE_DEMONSTRACAO` e nos dois scripts que copiam a lista | FATO: teste reprova sem o slug (3 casos) |
| LOJA-02 | `7e3b69cd` | Cadastro e "reenviar" devolvem `EMAIL_UNAVAILABLE` (503) quando o Supabase recusa o envio; evento `signup_email_nao_enviado`; e-mail inválido volta para o campo | FATO: 7 casos, 3 mutações. A tela já mostrava `error.message` |
| LOJA-30 | `a6210314` | Ícones da barra de status saem da cor medida debaixo da barra (troca de tela, de tema e de tema do aparelho) | FATO: regra de contraste testada com as duas paletas. NÃO VERIFICADO em aparelho |
| LOJA-24 | `304a44b0` | "Notificações" some do menu no app; a página aberta por link explica sem falar em navegador; o componente reconhece o app antes do iOS | FATO: guarda de 4 camadas, 2 mutações |
| LOJA-20 e LOJA-35 | `200510df` | O middleware manda `/` e `/precos` para `/entrar` quando o User-Agent tem `CicloApp`; quem já entrou continua indo ao painel | FATO: o teste chama o `middleware()` de verdade (307 → `/entrar`). A FAQ "abra no navegador" era o único texto de "instalar" e só existe na landing |
| LOJA-36 | `ccf832d5` | `docs/55` deixa de dizer que o app foi adiado; duas decisões em `DECISOES.md` | — |
| LOJA-31 | `77efaa5d` | `*.jks`, `*.keystore`, `keystore.properties` e `google-services.json` ignorados; `allowBackup` e transferência entre aparelhos desligados; release assina por `android/keystore.properties` | FATO: `assembleRelease` com chave descartável gerou APK assinado (`apksigner`), manifesto compilado com `allowBackup=false` e `dataExtractionRules` |
| LOJA-25 | `424dd108` | `NSCameraUsageDescription` e `NSPhotoLibraryUsageDescription` em português | FATO: o `plist` abre no `plistlib`. NÃO VERIFICADO num iPhone (precisa do Mac ou Codemagic) |
| LOJA-28 | `535cfa7c` | A privacidade nomeia Vercel, Google (Gemini) e Sentry; versão da privacidade vai a 2026-10-15 | FATO: guarda pela regra (cada provedor que o código chama aparece na página; endereço de API novo reprova). **Achado novo:** o Gemini também faltava |
| LOJA-27 | `7105a41e` | Excluir a conta: segundo fator só para quem o cadastrou; para os outros, login recente (10 min) ou a senha | FATO: 13 casos, 4 mutações. **Defeito a mais achado:** sem segundo fator, a tela mostrava "Não consegui verificar sua conta agora. Confira a conexão", erro falso. NÃO VERIFICADO no navegador |
| LOJA-23 | `c91cdeca` | `seed-tenant-teste.mjs` aceita o plano (5º argumento) e, como `seed-demo-6-negocios.mjs`, sorteia a senha quando falta `SEED_SENHA` | FATO: rodado contra o banco **local**, o tenant nasce com `avancado`, 12 clientes, 59 agendamentos (apagado depois) |
| LOJA-21 | `9e39b7b4` | No app nativo, sem botões de Google e Apple em `/entrar` e `/cadastro`; no navegador nada muda | FATO: teste com os dois provedores ligados (navegador vê os dois, app não vê nenhum nem consulta o Supabase). Escolhi o caminho reversível; fluxo nativo fica para depois da conta Apple |

## 2. O que precisa do Eduardo por causa desta rodada

1. **Trocar a senha da conta `revisor-apple@ciclo.app` e das seis demonstrações `demo-*`, se elas foram criadas sem `SEED_SENHA`.** Os dois scripts caíam numa senha escrita no código, e o repositório é público. Não dá para saber daqui como cada conta foi criada [NÃO VERIFICADO]. Trocar custa um minuto no painel do Supabase; não trocar deixa a conta do revisor aberta a qualquer um.
2. **Rodar de novo a semente do revisor com plano:** `SEED_SENHA='...' node scripts/seed-tenant-teste.mjs apple-review barber "<nome>" "revisor-apple@ciclo.app" avancado` (o script apaga e recria o tenant pelo slug).
3. **Data da privacidade:** a versão ficou 2026-10-15. Se o merge for noutro dia, trocar para o dia em que entrar no ar (`src/core/legal/versoes.ts` e o teste `versoes-legais`).
4. **SMTP (LOJA-01) continua sendo o conserto de verdade do cadastro.** O LOJA-02 só para de mentir: com o SMTP padrão, quem não é do time agora vê "Não conseguimos enviar o e-mail de confirmação agora" em vez de esperar para sempre.
5. As decisões de `11-rumo-a-app-store.md` §8 continuam abertas (conta Apple, Codemagic ou Mac, iPad e paisagem, login social no app, Play e keystore).

## 3. Verificação

| Verificação | Resultado |
| --- | --- |
| `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` | FATO: verdes (ver o relatório final da sessão para os números da última rodada) |
| `pnpm build` | FATO: verde |
| `pnpm test:integration` e `pnpm test:rls` | **Não servem de prova nesta máquina.** FATO: o banco local compartilhado tem 21 migrations (0121 a 0141) que não estão na `main`, vindas de outras branches. Falham 8 arquivos de integração com `42P10` em `client_cycles` e 3 casos de RLS em tabelas que a `main` nem tem (`import_batches`, `odometer_readings`, `subjects`). Nenhum toca o que esta branch mudou. A prova limpa é a CI do PR, que sobe banco do zero |
| CI do PR #151 (banco limpo) | FATO: 1ª rodada, 541 passaram e 2 falharam, os dois em `legal-casos-estado.test.ts`, que esta branch não toca. Causa: o teste fixa HOJE = 2026-10-08 e o caso nasce com `opened_on = current_date`; desde 09/10 `closed_on` cai antes da abertura e a constraint recusa. Bomba de data, falharia em qualquer branch. Consertado no teste (`opened_on` fixo); visto reprovar sem o conserto e passar com ele no banco local |
| Navegador | NÃO VERIFICADO: o servidor de prévia desta sessão sobe da pasta `ciclo` (outra sessão, outra branch); o resultado de lá não vale para esta branch e foi descartado |
| Aparelho (Android/iPhone) | NÃO VERIFICADO |

## 4. Em que degrau o app está

| Degrau | Situação |
| --- | --- |
| Teste interno | Código das lacunas de loja pronto numa branch, com testes. Falta merge, build nativo e o roteiro de 12 passos em aparelho (faixa 5) |
| Beta (TestFlight / teste fechado do Play) | Bloqueado: conta Apple, conta Play, keystore real e onde buildar o iOS (LOJA-40 a 44) |
| Envio à loja | Bloqueado: o de cima, mais ficha, imagens, questionário de privacidade e notas ao revisor (LOJA-50 a 55) |
| Publicado | Não |

## 5. O que ainda dá para fazer sem o Eduardo

- LOJA-26 depende da decisão iPad e paisagem; o caminho recomendado (só iPhone, só retrato) é uma linha no `project.pbxproj` e quatro no `Info.plist`.
- Faixa 2 (interface e velocidade nas 10 telas do dono) precisa de navegador apontando para esta branch.

## 6. Rodada 2 (noite de 15/10)

### 6.1 Verificação no navegador, apontando para esta branch

O servidor de prévia da sessão sobe da pasta de outra sessão, então a prova foi feita com Playwright contra o `next start` desta worktree (porta 3041), com um negócio de teste do banco **local** criado e apagado na hora. Roteiro: `medidas/verificar-loja-151.mjs`; resultado: `medidas/verificar-loja-151-resultado.json`.

**FATO: 19 de 19 conferências**, simulando o app (User-Agent com `CicloApp`, iPhone 390x844) e o Safari:

- app: `/` e `/precos` abrem em `/entrar`; sem botão de Google ou Apple; Configurações sem Notificações; Notificações aberta por link sem falar em Safari; Excluir conta sem o erro falso de conexão, `GET /api/v1/account` 200 com `confirmacao: "pronta"` logo depois do login, botão final inteiro na tela (y=712, 48 px); nenhum erro de JavaScript;
- Safari: landing e `/precos` continuam; Notificações aparece e mostra o Web Push;
- sem rede (modo avião do Playwright): navegar no painel mostra "Não conseguimos abrir o CICLO agora"; o cache do service worker só tem `/manifest.json`, `/sem-internet.html` e arquivos de `/_next/static`.

**A medição desmentiu uma suposição minha:** `/entrar` e o painel pintam `#faf8f5` debaixo da barra de status. Com os ícones brancos fixos de antes, hora e bateria ficariam invisíveis em todas as telas, não só no painel.

Achado de texto na mesma rodada: "O histórico **de o** negócio" na tela de excluir a conta (corrigido).

### 6.2 Commits novos

| Item | Commit | O que mudou | Evidência |
| --- | --- | --- | --- |
| Texto | `24a3ca56` | "o histórico do negócio" | conferência no navegador |
| LOJA-26 | `c1adcf0f` | iOS só iPhone (`TARGETED_DEVICE_FAMILY = 1`) e só retrato | FATO: guarda de 4 casos, 2 mutações. NÃO VERIFICADO no Xcode |
| APR-611 | `270c2111` | `public/sem-internet.html`; `server.errorPath` do Capacitor (no iOS o service worker não roda na tela embutida); o SW serve a página quando uma navegação falha sem rede, e a tela autenticada continua fora do cache | FATO: 7 casos novos no teste que roda o `sw.js` de verdade, 2 mutações; `cap sync` copiou a página e a configuração para Android e iOS; conferido sem rede no navegador. NÃO VERIFICADO em aparelho |

A página não promete que a fila offline sobe sozinha: ela só sai no evento `online` com o app aberto. Fechar sem rede e abrir já com rede deixa a fila parada até a próxima troca de conexão. Isso é a APR-021 (depende da 020), de outra onda; não mexi.

### 6.3 Faixa 2: tempo das 10 telas do dono

Roteiro `medidas/medir-telas-loja.mjs`: build de produção desta branch, 390x844, **CPU 4× mais lenta**, banco local (em produção soma a ida à rede e ao banco em `gru1`). Valores em ms; 1ª visita / 2ª visita.

| Tela | TTFB | LCP | CLS | Transferido | Rolagem lateral |
| --- | --- | --- | --- | --- | --- |
| Entrar | 390 / 289 | 748 / 412 | 0 | 74 KB | 0 |
| Cadastro | 320 / 319 | 704 / 456 | 0 | 74 KB | 0 |
| Hoje | 154 / 168 | 400 / 564 | 0 | 74 KB | 0 |
| Agenda | 176 / 233 | 588 / 568 | 0 | 62 KB | 0 |
| Comanda e Receber | 215 / 190 | 296 / 484 | 0 | 46 KB | 0 |
| Clientes | 158 / 167 | 704 / 544 | 0 | 107 KB | 0 |
| Recuperar | 220 / 181 | 484 / 392 | 0 | 73 KB | 0 |
| Caixa | 195 / 167 | 388 / 388 | 0 | 61 KB | 0 |
| Serviços | 162 / 200 | 564 / 308 | 0 | 95 KB | 0 |
| Mês | 178 / 230 | 324 / 476 | 0 | 66 KB | 0 |

Troca pela barra de baixo, do toque até o título novo (3 rodadas): a **primeira** ida à Agenda levou **1.044 ms** (meta < 1 s); todas as outras ficaram entre 449 e 510 ms. É o primeiro carregamento do código da tela com CPU lenta; a APR-102 (aba/dia em 51/57 ms) já trata isso na branch da onda 1, então não dupliquei aqui.

Limites desta medida: o banco local tem poucos dados (12 clientes); a APR-418/419 mediu Clientes com 295 fichas em 6,6 s, cenário que esta medida não monta. INP não foi medido (precisa de interação real em cada tela).

### 6.4 Integração e RLS provadas nesta máquina

Subi um Supabase local **isolado** só para esta worktree (cópia de `supabase/` no scratchpad com `project_id = "ciclo-loja"` e portas 573xx, studio/analytics/realtime desligados; `npx supabase start --workdir <cópia>`), com as migrations da `main` até a 0117. O banco compartilhado das outras sessões não foi tocado. **FATO:** `pnpm test:integration` 543 passaram e 1 pulado (o pulo já existia); `pnpm test:rls` 322 de 322. Com isso o `pnpm verify` inteiro passa aqui, não só na CI.

O mesmo banco permitiu ensaiar a conta do revisor de ponta a ponta (semente com plano, agenda futura, imagens, Motor): o Motor processou sem falha e o Hoje passou a mostrar "3 clientes estão sumindo". No banco compartilhado o Motor falhava em 26 de 40 negócios pelo esquema adiantado. Roteiro de preparo em `13-material-de-envio-lojas.md` §6.
