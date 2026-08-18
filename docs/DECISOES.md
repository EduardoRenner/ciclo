# Decisões tomadas durante a implementação

Formato: `data · pergunta · decisão · motivo`.
Só entra aqui o que **não** estava resolvido em `docs/05-FAQ-DEV.md`.

---

2026-08-17 · Onde mora o repositório? · `C:\Users\Usuario\.claude\code\ciclo` · é onde vivem os
outros projetos da mesma conta; nada na especificação fixava o caminho.

2026-08-17 · A especificação veio como um arquivo único; como fica o `docs/` que o briefing
descreve? · Recortei o documento nos arquivos previstos (`00-BRIEFING` … `06-BACKLOG`) e guardei
o original em `docs/ESPECIFICACAO-COMPLETA.md` · o briefing e o `CLAUDE.md` referenciam esses
caminhos; sem o recorte, toda referência da documentação apontaria para o vazio.

2026-08-17 · Vitest é do TICKET-005, mas a definição de pronto exige `pnpm verify` desde o
TICKET-001 · Instalei o Vitest já no TICKET-001, com `--passWithNoTests` em `test:unit` e
`test:rls` · sem isso o `verify` não existiria no primeiro commit; os testes de verdade entram
nos tickets que os pedem, e o `--passWithNoTests` sai no TICKET-005.

2026-08-17 · Qual base do shadcn/ui, já que a CLI nova pede preset? · `-b radix -p nova` · é a
base Radix clássica, a que a comunidade documenta; o preset só define a paleta inicial, que o
TICKET-013 substitui pelos tokens do CICLO.

2026-08-17 · Fonte da interface · Inter via `next/font/google` · `03-DESIGN-SYSTEM §2` pede uma
família variável e nomeia a Inter; o padrão do `create-next-app` (Geist) foi removido.

2026-08-17 · Não há Docker nem Postgres nesta máquina, e o `supabase start` do TICKET-002 depende
de Docker · Eduardo autorizou criar um projeto Supabase novo (`ciclo`, ref `sukloaoodpxjukngyojo`,
região sa-east-1, US$ 10/mês) e o desenvolvimento roda contra ele · sem banco não dá para cumprir
os TICKET-003/004/005; o ambiente `local` do briefing volta a valer se o Docker for instalado
depois (o `db:types:local` já está no `package.json` para esse caso).

2026-08-17 · `db:types` da PARTE 10 usa `--local`, que exige `supabase start` · `db:types` agora
aponta para `--project-id $SUPABASE_PROJECT_REF` e a versão local virou `db:types:local` · é o
banco que existe hoje; as duas formas geram o mesmo arquivo.

2026-08-17 · **Defeito na 0002:** o cabeçalho promete que `apply_vertical_pack()` é idempotente,
mas rodar duas vezes duplicava tudo (medido: 6→12 serviços, 7→14 produtos, 6→12 dias de
expediente). Os `on conflict do nothing` não tinham índice único para morder · criei a migration
`0003_pack_idempotency.sql` com índices únicos em `services (tenant_id, name)`,
`products (tenant_id, name)` e `business_hours (tenant_id, professional_id, weekday, opens_at)`
· o TICKET-015 chama essa função no onboarding; uma tentativa repetida após falha deixaria o
catálogo duplicado. Verificado: três execuções seguidas agora param em 6/7/7/6.

2026-08-17 · **Falha de segurança na 0002:** `apply_vertical_pack()` é `SECURITY DEFINER` e o
PostgREST expõe toda função do schema `public` em `/rest/v1/rpc/`. O papel `anon` podia chamá-la
com o uuid de qualquer tenant e escrever serviços, produtos e expediente lá dentro, por cima da
RLS · criei a migration `0004_lock_down_helper_functions.sql`, que revoga o EXECUTE de
`apply_vertical_pack`, `set_tenant_context` e `clear_tenant_context` para `anon`/`authenticated`
e fixa o `search_path` das funções que estavam sem · `has_tenant`, `tenant_role`,
`my_professional_id` e `can_see_appointment` continuam executáveis de propósito: as políticas de
RLS avaliam essas funções com o privilégio de quem consulta, então revogar quebraria a RLS
inteira — e elas só respondem sobre o próprio `auth.uid()`.

2026-08-17 · Extensões `btree_gist`, `pg_trgm` e `citext` ficam no schema `public` (aviso do
advisor) · mantidas onde a 0001 as colocou · mover exige recriar o índice trigram de `clients` e
a exclusion constraint de `appointments`; fica anotado para o TICKET-057 (endurecimento final).

2026-08-18 · O TICKET-007 pede `supabase db lint` e teste de RLS no CI, mas aqui o
desenvolvimento roda contra o projeto na nuvem por falta de Docker · o CI sobe um Supabase
efêmero (`supabase start`) no runner do GitHub, que tem Docker, e roda tudo contra ele · assim o
CI aplica as migrations **em banco vazio** a cada PR (o que revalida o critério do TICKET-003),
não precisa de nenhum segredo do projeto real, e não corre o risco de um teste que cria e apaga
tenants encostar em produção. Há uma trava explícita: se a URL do stack não for `127.0.0.1`, o
job reprova — é o "CI bloqueia se detectar" da PARTE 1 §4.

2026-08-18 · `supabase db lint` não devolve código de saída diferente de zero quando acha
problema · o job gera `--output json` e um `node -e` reprova o build se houver achado de nível
`error` · sem isso o passo passaria verde com o relatório cheio de erro.

2026-08-18 · `test:rls` ainda tinha `--passWithNoTests`, herdado do TICKET-001 · removido · com a
flag, apagar `tests/rls/isolation.test.ts` deixaria o `pnpm verify` verde sem nenhum teste de
isolamento — exatamente o cenário que o TICKET-005 existe para impedir. `test:unit` perdeu a flag
no TICKET-008, quando ganhou o primeiro teste.

2026-08-18 · Onde mora a camada de erro do TICKET-008? A estrutura de pastas da PARTE 1 §7 não
prevê um lugar para HTTP · `src/server/http/` (`errors.ts`, `response.ts`, `handler.ts`) · é
orquestração de servidor, não regra de negócio (não pode ir para `core/`, que é puro) e não é do
cliente (não pode ir para `lib/`); `src/server/` já é a caixa de tudo que fala com o mundo.

2026-08-18 · Formato do `requestId`; a documentação mostra `req_01H…`, que é ULID · `req_` + uuid
v4 sem hífen · ULID exigiria implementar codificação base32 monotônica só para ter ordenação
lexicográfica, que ninguém consome; o exemplo da PARTE 3 §1 ilustra, não fixa. O handler também
reaproveita um `x-request-id` recebido quando ele casa com `^[A-Za-z0-9_-]{8,64}$` — valor fora
do formato é descartado, não sanitizado, porque ele acaba em log e em header de resposta.

2026-08-18 · `AppError('INTERNAL')` aceitaria mensagem customizada e viraria a porta de saída do
texto de exceção do Postgres · o construtor ignora `message` quando o código é `INTERNAL` e força
a mensagem canônica · é o único código que nasce de erro não previsto; deixar a mensagem aberta
transforma um `catch (e) { throw new AppError('INTERNAL', { message: e.message }) }` distraído em
vazamento. A causa original continua indo para o log do servidor.

2026-08-18 · Rota que devolve binário (PDF do TICKET-052, CSV) não cabe no envelope JSON · o
`rota()` deixa passar uma `Response` montada pela própria rota, só injetando o `x-request-id` ·
o envelope vale para tudo que é JSON, que é o que a UI consome; forçar binário dentro dele
exigiria base64 no corpo.

2026-08-18 · Faltava `vitest.config.ts`, e o teste do TICKET-008 importa por `@/` · criado, só com
o alias `@ → src` e `environment: 'node'` · sem ele o teste teria de usar caminho relativo, que
diverge do resto do código.

2026-08-18 · A 0001 chama `profiles` de "espelho de auth.users", mas nada preenchia a tabela ·
migration `0006_profile_on_signup.sql`, com trigger `on_auth_user_created` em `auth.users` ·
criar a linha pela aplicação não funciona: com confirmação de e-mail ligada, logo depois do
`signUp` ainda não existe sessão, então não há `auth.uid()` para a política `profiles_self`
autorizar o insert; e deixar para o primeiro login obrigaria todo código adiante a tratar usuário
sem profile. A função é `SECURITY DEFINER` e escreve, então levou o `revoke execute` da 0004.
O seed do teste de RLS passou a fazer `update` no lugar de `insert` — assim ele confirma a
trigger em vez de duplicá-la.

2026-08-18 · O que fazer quando o HIBP não responde no cadastro? · deixa passar e registra
`hibp_indisponivel` no log · a senha já passou no tamanho mínimo e na lista local; derrubar o
cadastro do salão porque um serviço de terceiro caiu troca um risco pequeno por uma perda certa.

2026-08-18 · A FAQ C38 pede "bloquear as 10 mil senhas mais comuns", e não há como baixar essa
lista para dentro do repositório · a checagem local guarda ~60 **raízes** (não senhas inteiras) e
descasca dígito, ano e pontuação antes de comparar, então pega "Flamengo2024!" e "senha123456"
com uma entrada cada · o HIBP tem 800 milhões de senhas e é superconjunto estrito de qualquer
top-10 mil; a lista local existe como piso para quando ele estiver fora do ar, e raiz cobre mais
variação por byte que uma lista truncada. Um teste cobre exatamente esses casos.

2026-08-18 · O login devolve `session` com token? · não: devolve só `expiresAt`, e a sessão anda
nos cookies que o `@supabase/ssr` grava · access token no corpo da resposta acaba em
`localStorage` por conveniência, e aí qualquer XSS leva a sessão embora.

2026-08-18 · `getSession()` ou `getUser()` no guard? · `getUser()` · `getSession()` decodifica o
JWT do cookie e acredita nele; `getUser()` manda o token para o servidor de auth conferir a
assinatura. Cookie é coisa que o cliente escreve.

2026-08-18 · O guard do middleware protege por lista explícita de prefixos (`/hoje`, `/agenda`,
`/clientes`, `/recuperar`, `/comanda`, `/caixa`, `/config`), e não por "tudo protegido menos uma
allow-list" · o booking público mora na raiz (`/{slug}`), então negar por padrão bloquearia a
página que qualquer cliente precisa abrir · quando entrar rota nova em `(app)/`, o prefixo entra
aqui junto.

2026-08-18 · `jwt_expiry` estava em 3600 e a FAQ C40 fixa 15 min · `config.toml` agora tem 900 ·
**isso vale só para o stack local**; falta o Eduardo mudar o mesmo valor no painel do projeto da
nuvem (Authentication → Sessions), porque é lá que o desenvolvimento roda.

2026-08-18 · Escopo do logout · `signOut({ scope: 'global' })` no logout e `scope: 'others'` na
troca de senha · quem sai da conta porque perdeu o celular precisa derrubar o celular junto, e
quem troca a senha por desconfiar de invasão precisa derrubar o invasor — sair só deste navegador
não protege ninguém.

2026-08-18 · A recuperação de senha não estava no contrato da PARTE 3 §2.1, mas o TICKET-009 pede ·
`POST /api/v1/auth/password/forgot` e `POST /api/v1/auth/password/reset`, acrescentados a
`docs/02-API.md` · o `forgot` responde igual para e-mail que existe e que não existe, senão a tela
de recuperar senha vira uma lista de quem é cliente do CICLO. Mesma regra no `signup`.

2026-08-18 · O critério "bloqueio de merge" do TICKET-007 é configuração do GitHub, não arquivo ·
os três jobs têm nome estável (`Segredos`, `Qualidade`, `Banco e RLS`) e o README diz quais marcar
como *required status checks* · o repositório ainda não tem remoto; a regra é aplicada por Eduardo
quando ele criar.
