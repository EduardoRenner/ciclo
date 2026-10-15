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
