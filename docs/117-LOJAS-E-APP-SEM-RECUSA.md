# 117 · Lojas (Apple e Google) e app sem recusa · parte do lançamento (21/10/2026)

Entra no plano do `docs/114` (ordem) e do `docs/115` (produto). Constrói em cima do `docs/64-APP-STORE-CAPACITOR-PLANO.md` (fonte detalhada, com as pesquisas oficiais) e do `APP_STORE_READINESS.md` (painel). **Antes de cada item, conferir a regra na página oficial do dia** (App Store Review Guidelines; Google Play Policy Center): as regras mudam, e o que está aqui é o mapa, não a fonte.

## Verdade de calendário (dizer ao Vitor sem rodeio)
- **Web/PWA pode ir ao ar hoje** (deploy na Vercel).
- **Apple:** revisão costuma levar de 1 a 3 dias, e só depois de: conta Apple Developer paga, build num Mac/CI (T0/T5 do docs/64), TestFlight. Hoje dá para **deixar tudo pronto para submeter**.
- **Google Play:** conta pessoal nova precisa de **teste fechado com 12 testadores por 14 dias** antes de publicar em produção (regra de 2023/2024; conferir hoje). Conta de **organização** (com CNPJ, D-U-N-S) não tem essa exigência. Decisão do Vitor: abrir como organização.

## O que mudou com as decisões de hoje (e simplifica a revisão)
- **Tudo grátis** (L-01): no app nativo não pode haver NENHUM caminho de compra, preço de plano ou link para pagar fora (Apple 3.1.1/3.1.3; Google Payments). Com a chave `CICLO_COBRANCA` desligada E o bloqueio nativo do T1.5, a guarda precisa provar: nenhuma tela do app nativo cita plano, preço de plano, "assinar", "teste grátis", "upgrade".
- **Login só pelo número** (L-03): sem login social, a regra 4.8 (Sign in with Apple obrigatório quando há login de terceiros) não se aplica. **Mas o revisor precisa entrar:** o número de teste com código fixo (`auth.sms.test_otp`) tem de existir **no Supabase de produção** só para a conta de revisão, e as instruções ficam nas notas da revisão. Sem isso, recusa certa (2.1, "não conseguimos entrar").

## Motivos de recusa mais comuns e o que fazer (checklist do loop)

| Regra (Apple / Google) | Por que recusam | O que o CICLO faz / falta |
| --- | --- | --- |
| 2.1 Completude | app quebra, tela vazia, link morto, conta de teste não entra | percorrer TODAS as telas no app nativo com a conta de revisão; nenhum "em breve"; nenhum link para 404 |
| 2.3 Metadados | prints que não mostram o app, descrição prometendo o que não tem | prints reais das contas de salão (S01 parte 2) com a logo nova; descrição só com o que existe hoje |
| 4.2 Funcionalidade mínima | "site embrulhado" | casca nativa: push nativo (T3, falta), compartilhar, vibração, barra de status, offline (`sem-internet.html`); navegação sem barra do navegador; nada de link que abre o Safari para o fluxo principal |
| 3.1.1 Compras | cobrança fora da loja | L-01 + T1.5 (acima) |
| 5.1.1(v) Excluir conta | conta criada no app tem de poder ser apagada no app | T-DEL feito; conferir que funciona com conta criada **pelo número** (sem e-mail) e para a **cliente**, não só a dona |
| 5.1.1 / Data safety | coleta sem dizer o quê e para quê | "Nutrition label" da Apple e "Segurança dos dados" do Google preenchidos com: telefone, nome, agenda, histórico de atendimento, identificadores de push; nada vendido; política de privacidade no ar e com o texto certo (pendência do Vitor: o trecho da Meta) |
| 5.1.2 Permissões | pedir permissão sem contexto | notificação só depois do 1º agendamento (L-09), com texto que diz o porquê; textos de uso no `Info.plist` para cada permissão que o binário pedir |
| 4.0 Design / iPad | layout quebrado em tela grande | se o app aceita iPad, conferir a 1024 px; senão, marcar só iPhone |
| 1.2 Conteúdo de usuário | busca pública mostra perfis de terceiros | aba de busca (L-06): botão "Denunciar perfil" e o caminho de remoção; termos de uso com regra de conteúdo |
| Privacidade iOS | `PrivacyInfo.xcprivacy` ausente | gerar no archive do Xcode (pendência do docs/64, só com Mac) |
| Google: API alvo | target SDK abaixo do exigido | `targetSdkVersion` no mínimo o exigido no dia |
| Google: exclusão de conta | URL pública para pedir exclusão | página `/excluir-conta` acessível sem login, explicando o caminho |

## Experiência de app (otimizar já, vale para web e lojas)
- **Toque:** todo alvo ≥ 48 px, medido (não deduzido); nada de dois links colados (`toque-48`, CLAUDE.md).
- **Peso:** página pública e agendar com LCP ≤ 2,5 s no build de produção (docs/112 Onda 3, D01 a D05 entram aqui como bloqueio de lançamento: tela de erro fora do JS público, Fraunces enxuta, Recuperar sem polyfill).
- **Erro e sem rede:** toda tela tem estado de carregando, vazio e erro que diz o que fazer; sem rede, a fila offline guarda e avisa; o app nativo cai em `sem-internet.html`, nunca na tela de erro da WebView.
- **Toque e retorno:** vibração leve (`@capacitor/haptics`) em confirmar agendamento e marcar atendimento; botão voltar do Android funciona em toda tela (nunca fecha o app no meio de um fluxo).
- **Teclado:** campo de número abre o teclado numérico; o código de 6 dígitos tem `autocomplete="one-time-code"` (iOS preenche sozinho).
- **Área segura:** nada embaixo do entalhe nem da barra de gestos (safe-area).
- **Primeira abertura:** sem tela branca (splash até a 1ª pintura).

## Tickets (encaixe no 114, logo depois do L-09)
- **APP-01** · Conta de revisão por número com código fixo (local e roteiro para produção) + notas da revisão prontas (`docs/runbooks/notas-para-o-revisor.md`).
- **APP-02** · Guarda "nada de compra no app nativo" revista para o modo grátis (vista reprovando).
- **APP-03** · Exclusão de conta para conta criada pelo número e para a cliente; página pública `/excluir-conta`.
- **APP-04** · Denunciar perfil na busca (L-06) e regra de conteúdo nos termos.
- **APP-05** · Varredura das telas no app Android (emulador): botão voltar, área segura, teclado, sem link que sai para o navegador no fluxo principal, `sem-internet`.
- **APP-06** · Data safety e nutrition label: rascunho preenchido em `docs/runbooks/lojas-formularios.md` (o Vitor cola nos painéis).
- **APP-07** · Prints das lojas (6,7" e 6,5" iPhone; telefone Android) com a logo nova, contas de salão.
- **APP-08** · Push nativo (T3) fica como próximo passo depois da conta Apple/Firebase do Vitor; até lá, a 4.2 se apoia em compartilhar, vibração, offline e notificação do navegador.

## Do Vitor (o loop não faz)
Conta Apple Developer (US$ 99/ano) e onde builda o iOS (Mac, Codemagic ou Xcode Cloud); conta Google Play como **organização**; confirmar o `appId` `br.com.seuciclo.app` (permanente depois da 1ª submissão); política de privacidade; Firebase (push Android) e chave APNs (push iOS).
