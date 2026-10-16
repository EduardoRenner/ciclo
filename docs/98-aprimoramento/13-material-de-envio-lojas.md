# Material de envio às lojas (rascunho, LOJA-50 a LOJA-53)

Para colar no App Store Connect e no Play Console quando as contas existirem. Tudo aqui foi tirado do que o código faz em 15/10/2026 (branch `loja/lacunas-2026-10-15`, PR #151). Onde depende de decisão ou de conferência no site da loja, está marcado. Nada foi enviado a lugar nenhum.

Rótulos: **FATO** (conferido no código ou medido), **NÃO VERIFICADO** (conferir no site da loja antes de enviar), **DECISÃO** (do Eduardo).

## 1. Ficha (LOJA-50)

| Campo | Limite | Texto proposto | Observação |
| --- | --- | --- | --- |
| Nome | 30 | **CICLO** | NÃO VERIFICADO: o nome precisa estar livre na App Store. Alternativa: "CICLO: agenda e retorno" (23) |
| Subtítulo (Apple) | 30 | **Agenda e clientes que voltam** (28) | |
| Descrição curta (Google) | 80 | **Agenda, caixa e clientes que voltam, para quem atende com hora marcada.** (71) | |
| Palavras-chave (Apple) | 100 | `agenda,salão,barbearia,manicure,estética,clientes,retorno,caixa,comanda,lembrete,personal,autônomo` (98) | Sem espaço depois da vírgula; não repetir o nome nem o subtítulo |
| Categoria | | Principal **Negócios**; secundária **Produtividade** | |
| Classificação etária | | **4+** (sem conteúdo gerado por usuário público, sem compra, sem anúncio) | A ficha de saúde é do cliente do profissional, não conteúdo exposto |
| URL de privacidade | | `https://seuciclo.com.br/privacidade` | FATO: a página existe e, no PR #151, nomeia Vercel, Google (Gemini), Sentry, Supabase, Resend, WhatsApp e Mercado Pago |
| URL de suporte | | `https://seuciclo.com.br/contato` | **Bloqueado pela LOJA-04:** hoje `/contato` não tem canal (variáveis `NEXT_PUBLIC_CONTATO_*` vazias em produção). A loja exige um canal que responda |
| Direitos autorais | | `2026 <nome do titular da conta>` | DECISÃO: pessoa ou empresa (LOJA-41) |

### Descrição (até 4.000 caracteres)

> O CICLO é a agenda de quem atende com hora marcada e vive de cliente que volta: barbearia, salão, unhas, estética, personal, faxina, eletricista e quem mais trabalha assim.
>
> **Sua agenda no bolso.** Veja o dia de hoje, marque, remarque e confirme em poucos toques. Cada profissional vê a própria agenda.
>
> **Quem está sumindo.** O CICLO aprende de quanto em quanto tempo cada cliente costuma voltar e mostra quem já passou da hora, para você chamar antes de perder.
>
> **Comanda e caixa.** Feche o atendimento, registre como a pessoa pagou e veja quanto entrou no dia e no mês.
>
> **Ficha do cliente.** Histórico de atendimentos, preferências, fotos do trabalho e, se você usar, ficha de anamnese guardada com cuidado extra.
>
> **Sua página de agendamento.** Um link para seus clientes marcarem sozinhos.
>
> Seus dados ficam separados dos de qualquer outro negócio, e você pode excluir sua conta pelo próprio app.

Conferir antes de enviar: nenhuma frase pode prometer o que a conta do revisor não mostra (regra 2.3). Por isso a descrição não cita WhatsApp automático, assistente de IA nem cobrança de sinal: dependem de credencial ou de plano que podem não estar ligados no dia da revisão.

## 2. Questionário de privacidade da Apple ("App Privacy", LOJA-52)

Rastreamento entre apps e sites de outras empresas: **Não** (FATO: sem SDK de anúncio; o cookie de origem é do próprio CICLO, `docs/82` §6).

| Tipo de dado (nome da Apple) | Coleta? | Para quê | Ligado à pessoa | Fonte no código |
| --- | --- | --- | --- | --- |
| Nome | Sim | Funcionalidade do app | Sim | cadastro (`EsquemaCadastro.fullName`) e fichas de cliente |
| E-mail | Sim | Funcionalidade do app | Sim | login |
| Telefone | Sim | Funcionalidade do app | Sim | cadastro e fichas de cliente |
| Saúde | **Sim** | Funcionalidade do app | Sim | ficha de anamnese cifrada (cofre). É do cliente do profissional, mas é coletada pelo app; declarar |
| Fotos | Sim | Funcionalidade do app | Sim | fotos do trabalho, logo e profissionais (`fotos.tsx`, `upload-de-foto.tsx`) |
| Outro conteúdo do usuário | Sim | Funcionalidade do app | Sim | observações e preferências de cliente |
| Interação com o produto | Sim | Análise (do próprio CICLO) | Sim | `product_events` (funil próprio, sem terceiro) |
| Dados de falha | Sim, quando o Sentry está ligado | Funcionalidade do app | Não | Sentry com `sendDefaultPii: false` e redator (`lib/observability/redact.ts`) |
| Compras | **Não no app** | | | os planos não são vendidos dentro do app (LOJA-20/24) |
| Localização, contatos, identificadores de anúncio, histórico de navegação | Não | | | |

**Regra 5.1.3 (saúde):** o dado de saúde não pode ir para anúncio nem para terceiros fora da operação. FATO no código: fica no cofre cifrado e é redigido antes de Sentry e log (regra 9 do CLAUDE.md). FATO no código: `src/server/assistente/ferramentas.ts` tira `health_records`, alerta de saúde e anotações de saúde do que vai ao Gemini, por construção (não por instrução no prompt). Conferir de novo antes de responder, porque o assistente muda.

## 3. Google Play, "Segurança dos dados" (LOJA-52)

Mesma tabela, nos nomes do Google: **Informações pessoais** (nome, e-mail, telefone), **Informações de saúde e fitness** (saúde), **Fotos e vídeos** (fotos), **Atividade no app** (interações), **Informações e desempenho do app** (registros de falha). Respostas:

- Dados criptografados em trânsito: **Sim** (HTTPS, `cleartext: false`).
- A pessoa pode pedir exclusão: **Sim**, no próprio app (Configurações → Excluir minha conta) e a URL de exclusão exigida pelo Google é `https://seuciclo.com.br/admin/config/excluir-conta` (NÃO VERIFICADO: o Google pede uma página acessível sem o app; conferir se a tela atrás de login basta ou se precisa de página pública explicando o caminho).
- Compartilhamento com terceiros: os operadores listados na privacidade, para operar o serviço (o Google não conta operador como "compartilhamento").

## 4. Notas ao revisor (App Review Information, LOJA-53)

Revisar o inglês e conferir a conta no dia do envio (LOJA-54). Atualizadas para o que o PR #151 mudou:

> **Sign in:** use the email and password provided in the Sign-In Information fields. The app opens directly on the sign-in screen. Sign in with Google/Apple is not offered inside the app; email and password is the only method.
>
> **What to look at:**
> 1. "Hoje" (Today): today's schedule and pending actions.
> 2. "Clientes" (Clients): each client shows when they usually come back; clients tagged "Sumindo" (Fading) are overdue for their next visit.
> 3. Tap a client to see visit history and the predicted next visit.
> 4. "Agenda": appointments across the team.
>
> This is a demo business with fictitious clients and history, so the prediction engine has data to show. Messages to clients from this account are simulated and never sent.
>
> **Purchases:** there are no purchases in the app and no links to buy anything. The demo account already has all features enabled.
>
> **Account deletion:** Configurações (Settings) → "Excluir minha conta" (Delete my account). Right after signing in it asks for no extra step; later it asks for the password.
>
> **Offline:** without a connection the app shows its own "Não conseguimos abrir o CICLO agora" screen with a retry button.

## 5. Imagens (LOJA-51)

Geradas do build de produção desta branch, com um negócio fictício do banco local, tema claro, simulando o app (sem a barra do navegador). Roteiro: `medidas/capturas-loja.mjs`; arquivos em `medidas/capturas-loja/`.

| Loja | Tamanho | Por quê |
| --- | --- | --- |
| App Store, iPhone 6,9" | 1320 × 2868 | Tamanho exigido para iPhone; o app é só iPhone (LOJA-26), então não precisa de iPad. NÃO VERIFICADO: conferir a lista de tamanhos aceitos no App Store Connect no dia |
| Google Play, celular | 1080 × 2160 | O Play recusa imagem com o lado maior acima de 2× o menor; 1320×2868 passaria disso |

As imagens mostram só o que a conta do revisor também mostra (regra 2.3).

**Estado em 16/10, de manhã:** refeitas com a semente corrigida (Hoje e Agenda com 3 atendimentos, Recuperar com 7 pessoas e R$ 226,50, profissional "Rafael Costa"). A semente também passou a registrar custo e ficha de consumo: o aviso de material sumiu e o lucro desconta o insumo. As imagens estão prontas para uso; refazer só se a interface mudar antes do envio. Histórico: geradas com o ensaio completo da seção 6 num Supabase local **isolado** com o esquema da `main` (o banco local compartilhado está 21 migrations à frente e quebrava o Motor). Hoje mostra "3 clientes estão sumindo" e Recuperar mostra a fila. Para a versão final: capturar **de dia** (à noite aparece "Boa noite" e "Nada marcado para hoje"), preencher o custo dos serviços (some o aviso "6 serviços estão sem o custo") (a semente foi corrigida no #151: agora há cliente em cada estado do Motor, e o Recuperar mostra 7 pessoas e R$ 202,65; era R$ 10,80 com três perdidos).

## 6. Preparar a conta do revisor (LOJA-54), na véspera de cada envio

Ensaiado no banco local em 15/10. **FATO:** uma conta recém-semeada abre com o "Recuperar" vazio ("O Motor ainda não processou seus atendimentos") e com o "Hoje" sem nada marcado, até o recálculo agendado rodar e a agenda futura ser renovada. O revisor veria a principal função do produto vazia. Passos, todos pelo Eduardo (produção):

1. `SEED_SENHA='...' node scripts/seed-tenant-teste.mjs apple-review barber "<nome>" "revisor-apple@ciclo.app" avancado` (plano que abre todas as telas; senha nova, fora do repositório).
2. `node scripts/seed-demo-agenda-futura.mjs apple-review` (só funciona depois do merge do #151, que põe `apple-review` na lista de demonstração).
3. `node scripts/seed-demo-imagens.mjs apple-review` (logo e capa).
4. Rodar o Motor (`/api/cron/recompute-cycles` com o segredo do agendador) ou esperar a rodada da noite, e **conferir que "Recuperar" mostra pessoas** e "Clientes" mostra "sumido" e "fiel". O agendador do CICLO já ficou parado por dias antes (`docs/runbooks`, memória "cron morto"): olhar, não supor.
5. Entrar no celular com a credencial que vai na ficha e abrir as quatro telas das notas.
