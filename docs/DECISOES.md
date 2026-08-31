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

2026-08-18 · O `pnpm add` do TICKET-009 avisou que `next@15.5.4` tem CVE; o `pnpm audit` mostrou
uma RCE crítica no protocolo flight do React e mais quatro falhas em `postcss` e `sharp` ·
subi o Next para 15.5.23 (bump de patch, mesma linha 15.5) e travei `postcss >= 8.5.23` e
`sharp >= 0.35.0` em `pnpm.overrides`, porque as duas são transitivas e não dá para bumpar pelo
dependente · o `pnpm audit` entrou no job Segredos do CI: `high` e acima reprovam, `moderate`
aparece no log sem quebrar o build — senão um aviso novo em dependência transitiva trava o merge
de todo mundo num dia em que ninguém mexeu em dependência.

2026-08-18 · **Contradição entre a especificação e a FAQ:** `01-ESPEC-TECNICA §3.3` dá
`client:*` ao papel `manager`, o que inclui exportar a base; a FAQ C35 diz que exportar é "só
owner, com MFA na hora, no máximo 1×/mês" · a tabela `PERMISSIONS` continua literal como o §3.3
manda, e uma lista `EXCLUSIVAS_DO_DONO` (hoje só `client:export`) é conferida antes do curinga ·
entre as duas leituras vale a restritiva: exportar a base é a carteira inteira saindo pela porta,
e negar demais se conserta com um clique do dono, enquanto vazar não se desfaz. Um teste percorre
todos os papéis e reprova se algum além do dono alcançar `client:export`.

2026-08-18 · O que `own` significa em `appointment:own` (§3.3)? · alcance, não verbo:
`avaliarPermissao` devolve `'own'` para qualquer ação daquele recurso, e quem chamou precisa
filtrar pelo próprio profissional · a alternativa seria ler `own` como uma ação chamada "own", e
aí o profissional não poderia sequer ler a própria agenda. A RLS (`can_see_appointment`) é a
segunda camada.

2026-08-18 · `contextoAtual()` recusa header/cookie que não seja uuid com `TENANT_MISMATCH`, o
mesmo erro de tenant alheio · resposta diferente para "id malformado", "tenant não existe" e
"existe mas não é seu" transforma o header num verificador de quais estabelecimentos existem no
CICLO · também evita ida ao banco com lixo.

2026-08-18 · Sem header e sem cookie: um vínculo ativo → assume esse; nenhum → `FORBIDDEN`
mandando terminar o cadastro; mais de um → `VALIDATION_ERROR` pedindo para escolher · a FAQ C26
prevê o seletor na UI quando `memberships.length > 1`, e escolher um por conta própria colocaria
a pessoa no estabelecimento errado sem ela perceber.

2026-08-18 · `GET /api/v1/me` não usa `contextoAtual()` · usa só `exigirSessao()` e devolve
`activeTenant: null` quando não há vínculo · é a única rota que precisa responder para quem acabou
de se cadastrar e ainda vai passar pelo onboarding; se ela também exigisse tenant, o TICKET-015
não teria como começar.

2026-08-18 · **Terceiro defeito da especificação:** o `withTenant()` de `01-ESPEC-TECNICA §2.3`
chama `set_tenant_context()` antes e `clear_tenant_context()` depois, como se o `app.tenant_id`
protegesse as consultas de dentro. Não protege, e foi medido no banco do projeto: (a)
`set_tenant_context` usa `set_config(..., true)`, que é escopo de transação, e cada chamada pelo
PostgREST é uma transação própria — na chamada seguinte o valor já volta vazio; (b) **nenhuma**
das políticas de RLS deste schema lê `app.tenant_id` (zero linhas em `pg_policies`); elas decidem
por `auth.uid()`, que a service role não tem · implementei o `withTenant()` sem as duas chamadas
· seriam duas idas de rede por escrita para não fazer nada. O que isola de verdade continua
valendo: a chave mora só em `with-tenant.ts` (com regra de lint), o `tenantId` é conferido antes
de virar consulta, e quem usa o cliente filtra `tenant_id` explicitamente, como a FAQ C30 já
manda. As duas funções e o GUC ficam anotados para remoção no TICKET-057.

2026-08-18 · Por onde `writeAudit()` escreve, já que `audit_log` não tem política de insert? ·
pela `service_role`, dentro do `withTenant()` · a ausência da política é proposital e tem teste de
RLS: trilha que o próprio auditado consegue escrever não é trilha. As alternativas eram piores —
uma função `SECURITY DEFINER` chamável por `authenticated` devolveria ao auditado a caneta, e o
PostgREST a exporia em `/rest/v1/rpc/`.

2026-08-18 · O que acontece se a gravação da trilha falhar? · registra `audit_falhou` no log e
segue · a operação da pessoa já foi concluída quando a auditoria roda; estourar ali mostraria
erro para algo que deu certo, e ela tentaria de novo, duplicando o agendamento. O buraco na
trilha vira alarme, que é onde alguém consegue reagir.

2026-08-18 · `before`/`after` da trilha passam por uma lista de redação (`ciphertext`, `iv`,
`auth_tag`, `answers`, `dek_wrapped`, `password`, `token`…) em qualquer profundidade · a regra 9
proíbe dado de saúde em log, e o `after` de uma ficha do cofre traria a anamnese inteira para uma
tabela que dono, gerente e financeiro leem.

2026-08-18 · **Vazamento entre tenants no desenho da idempotência:** `idempotency_keys.key` é
chave primária **global** e o valor vem do cliente. O tenant B podia mandar a mesma
`Idempotency-Key` e o mesmo corpo que o A usou e receber de volta a `response_body` guardada do
A — que é o corpo de um agendamento ou de uma comanda · a chave gravada é
`{tenantId}:{chave-do-cliente}`, e o `select` ainda filtra por `tenant_id` · o prefixo elimina a
colisão e o filtro é a segunda camada, para o caso de o prefixo sumir numa refatoração. Há teste
que roda o ataque.

2026-08-18 · Corrida entre duas tentativas com a mesma chave · a chave é **reservada antes** de a
operação rodar (`insert ... on conflict do nothing`), e a resposta é gravada depois · um `select`
antes do `insert` deixaria as duas tentativas passarem pela verificação e executarem, que é o
agendamento duplicado que a idempotência existe para evitar.

2026-08-18 · O que responder enquanto a primeira tentativa ainda está rodando (reserva existe,
`response_status` é nulo)? · `RATE_LIMITED` com `Retry-After: 2` · a lista de códigos da PARTE 3
§1 é fechada e não tem "em processamento"; entre os que existem, `429` é o único que significa
"tente de novo em instantes". Devolver a resposta é impossível (ainda não existe) e executar de
novo produziria a duplicata.

2026-08-18 · Resposta de erro é guardada e reproduzida? · não: o erro apaga a reserva · a operação
não aconteceu, e prender a chave impediria a pessoa de tentar de novo com a mesma
`Idempotency-Key` — que é exatamente o que a fila offline do PWA (§4.2) faz quando drena.

2026-08-18 · **Erro de contraste na especificação:** `03-DESIGN-SYSTEM §1` anota `--txt-3: #6e6e85`
como "contraste 4,6:1 — nunca abaixo disso", mas a conta medida (WCAG 2.1, luminância relativa)
dá 3,98:1 sobre `--bg` e 3,71:1 sobre `--surface` — os dois abaixo do próprio piso de 4,5:1 que
`§7` exige para texto · troquei para `#7f7f98` (5,07:1 e 4,72:1), o tom mais próximo do original
que cumpre a regra · há teste (`tests/unit/design/contraste.test.ts`) que recalcula o contraste a
partir do `globals.css` de verdade, não de uma cópia — mudar uma cor sem olhar o contraste
reprova o build, que é o que "contraste AA verificado" (critério do TICKET-013) precisa
significar para não virar promessa.

2026-08-18 · O `Sheet` usa `Dialog` do pacote `radix-ui` (não `@radix-ui/react-dialog` avulso) ·
o projeto já depende de `radix-ui@1.6.7`, que reexporta todos os primitivos por namespace
(`Dialog`, `Toast`, …) · instalar o pacote avulso duplicaria a dependência.

2026-08-18 · `/dev/ui` devolve 404 em produção (`notFound()` se `NODE_ENV === 'production'`) ·
é página de trabalho, não faz parte do produto, e deixar rota de `/dev` navegável em produção é
superfície de graça para quem procura · verificado no browser: sem scroll horizontal em 390px,
Sheet trava e libera o scroll do body, Toast dispara com aria-live (a região oculta de anúncio do
Radix), viewport do toast já limpa a faixa da tab bar de 82px de §3.3.

2026-08-18 · Quais são os "5 itens" da tab bar do TICKET-014? A especificação não fixa quais ·
Hoje, Agenda, [FAB central: novo agendamento], Clientes, Recuperar · são os que sustentam o
essencial do MVP se tudo mais for cortado (`00-BRIEFING §1`: agenda sem conflito, Motor de Ciclo
+ Recuperar receita) mais o cadastro de clientes de que os dois dependem. Caixa e configurações
ficam a um toque de "Hoje", fora da barra — são consultados bem menos que os quatro escolhidos.
> **SUPERADA em 2026-08-31** (entrada no fim deste arquivo): os cinco continuam os mesmos, mas o
> CENTRO trocou. O botão central é o Motor de Ciclo (`/admin/recuperar`) e marcar horário passou a
> ser a quarta aba. Quem ler só esta linha põe a ação mais comum no único slot que o polegar
> alcança sem reposicionar a mão — que era exatamente o defeito.

2026-08-18 · TICKET-014 não pede telas — só o shell (`(app)/layout.tsx` + `TabBar`) · não criei
`page.tsx` em `hoje/agenda/clientes/recuperar` · essas rotas nascem nos tickets que as pedem
(TICKET-016 em diante); criar stub agora seria arquivo que o ticket não pediu (regra de estilo do
CLAUDE.md). Verificação em browser feita renderizando o `TabBar` de verdade dentro de `/dev/ui`
(que já é pública, sem exigir sessão) — 390px exatos, 5 alvos, todos ≥48px, barra com 82px,
sem scroll horizontal.

2026-08-18 · `abaAtiva()` não usa só `pathname.startsWith(href)` · compara igualdade OU prefixo
com barra (`href + '/'`) · sem a barra, `/clientes-vip` acenderia a aba `/clientes`; e `/hoje`
precisa do caso de igualdade exata porque prefixo vazio casaria com qualquer rota do app.

2026-08-18 · `VAULT_KEK`, `PHONE_HASH_SALT` e `CRON_SECRET` no `.env.local` não tinham valor —
guardavam o texto de instrução (`<<< openssl rand -base64 32`), que ninguém tinha rodado · gerei
os três com `crypto.randomBytes` (32/24/32 bytes em base64) · sem a KEK o TICKET-015 não gera DEK
nenhuma, então o onboarding inteiro estava bloqueado por um placeholder que passava despercebido
porque o arquivo "parecia" preenchido. `SUPABASE_DB_URL` segue vazia de propósito: é só para
`psql`/CLI direto, que não existe nesta máquina, e a aplicação não a lê.

2026-08-18 · Onde mora o wrap da DEK, já que `encryptVault`/`decryptVault` são do TICKET-049? ·
`src/server/crypto/kek.ts`, só com `gerarDekCifrada`/`abrirDekCifrada` · o TICKET-015 precisa
gerar e guardar a DEK cifrada, mas não precisa cifrar registro nenhum ainda; separar deixa o
módulo do cofre nascer no ticket que o pede, sem stub.

2026-08-18 · Formato de `tenant_keys.dek_wrapped` (bytea) pelo PostgREST · literal hex `\x…`,
com `iv || tag || ciphertext` num campo só · o supabase-js não serializa `Buffer` para bytea
(dá erro de tipo), e o schema já usa esse literal no seed do teste de RLS. Os três pedaços têm
tamanho fixo (12/16/32), então separar de volta não precisa de delimitador.

2026-08-18 · Não há transação entre PostgREST e a RPC `apply_vertical_pack`, e o onboarding faz 5
escritas · um `try/catch` em volta de tudo depois do tenant, que no erro apaga o tenant e deixa o
`on delete cascade` das FKs levar membership, professional e tenant_keys junto · sem isso, uma
falha no meio deixaria tenant órfão sem membership: invisível para todo mundo e sem dono para
tentar de novo, e o slug ficaria ocupado para sempre. Há teste de integração que força a falha e
confirma que nada sobra.

2026-08-18 · A regra de negócio do onboarding ficou em `src/server/services/onboarding.ts`, e não
dentro da rota · a rota depende de `next/headers` (sessão, cookies), o que impede chamar o fluxo
de um teste · assim o `tests/integration/onboarding.test.ts` exercita a sequência real de escritas
contra o projeto de verdade, incluindo a RPC do pack, sem subir HTTP.

2026-08-18 · Criada a pasta `tests/integration/` e o script `test:integration`, ligado ao
`pnpm verify` e ao job `banco` do CI · a FAQ A37 lista o onboarding como um dos 5 fluxos críticos,
e ele é o único que dá para cobrir sem Playwright · no CI roda contra o Supabase efêmero, com uma
`VAULT_KEK` descartável embutida no workflow (não é segredo: o banco morre junto com o job).

2026-08-18 · O dono vira `professionals` no próprio onboarding, com `comp_model: 'owner'` · sem
isso ele não apareceria na própria agenda depois do cadastro, e o MVP é majoritariamente solo ·
`display_name` sai de `profiles.full_name`, com o nome do negócio como reserva.

2026-08-18 · Reordenar serviços: a UI manda a lista inteira na ordem nova, não só o que mudou ·
mandar o delta obrigaria o servidor a recalcular a posição dos vizinhos, e é exatamente aí que a
ordem embaralha quando duas edições se cruzam · a lista tem dezenas de itens, então o custo de
mandar tudo é irrelevante.

2026-08-18 · `reordenarServicos` confere que todos os ids são do tenant **antes** de escrever
qualquer posição · sem a checagem prévia, um id de outro estabelecimento no lote simplesmente não
afetaria nenhuma linha (a RLS barra), e os ids válidos já teriam sido reposicionados — o intruso
passaria como sucesso silencioso. Há teste que injeta um id alheio e confirma que a ordem não
mudou.

2026-08-18 · `listarServicos` ordena por `position` **e depois por `name`** · o pack de vertical
nasce com todos os serviços em `position = 0`, então sem o desempate a lista muda de ordem entre
dois carregamentos iguais — o Postgres não garante ordem estável em empate.

2026-08-18 · Serviço novo nasce com `position` = maior + 1, não 0 · caso contrário todo serviço
cadastrado entraria empatado com os 6 do pack e apareceria no meio deles.

2026-08-18 · O índice `services_tenant_name_uniq` (criado na 0003 para o pack) faz nome repetido
estourar `23505` no CRUD · traduzido para `VALIDATION_ERROR` no campo `name` · sem isso a pessoa
veria "Algo deu errado do nosso lado" ao repetir um nome, que é erro dela e tem conserto óbvio.

2026-08-18 · Reordenar na tela usa setas ↑ ↓, não arrastar · §3.6 exige alvo de 48px, e
drag-and-drop com um dedo só dentro de lista rolável erra mais do que acerta — o gesto compete
com o scroll · a reordenação é otimista e desfaz se o servidor recusar.

2026-08-18 · `DELETE /api/v1/services/:id` arquiva (`active = false`), não apaga · D45 manda soft
delete para serviço, e `ticket_items.service_id` é `on delete restrict`: apagar de verdade seria
recusado pelo banco ou quebraria o histórico de comanda.

2026-08-18 · **Sexto defeito: a FAQ C36 descreve convite por link, mas nenhuma tabela guarda o
token.** Mesmo tipo de lacuna que a 0006 fechou para `profiles` · criada `invites` na migration
0007, com `token_hash` (o cru nunca é gravado, mesmo cuidado de senha) e RLS restrita a `owner`,
espelhando a trava de `memberships_write` — quem convida é sempre o dono, nunca o gerente, porque
convite acaba virando `memberships`, que o schema já protege assim.

2026-08-18 · Aceitar convite não passa pelo cliente do usuário · usa `withNovoTenant`, o mesmo
padrão do onboarding · quem aceita ainda não tem `has_tenant()` naquele tenant até o `insert` em
`memberships` acontecer, então a RLS bloquearia até a leitura do próprio convite pelo token.

2026-08-18 · O e-mail do convite trava com o e-mail de quem está logado ao aceitar · sem isso, um
link encaminhado (por WhatsApp, por exemplo) deixaria qualquer pessoa autenticada entrar no
tenant alheio com o papel do convite.

2026-08-18 · Convite de `reception`/`finance`/`manager` não cria linha em `professionals` — só
`professional` cria · a FAQ C36 diz "cria profile + membership + professional" sem condicionar,
mas as colunas de `professionals` (cor na agenda, comissão, aluguel) só fazem sentido para quem
atende; dar a recepção uma linha ali seria dado morto. Interpretação mais restrita, registrada
porque diverge do texto literal da FAQ.

2026-08-18 · Sem `MessagingProvider` (Sprint 2 não chegou), o convite não é enviado sozinho · o
link volta na resposta da API e a tela copia para a área de transferência, para o dono colar onde
quiser mandar · é o "convite por link" que o critério do TICKET-017 pede, sem inventar envio
automático que a infra ainda não tem.

2026-08-18 · `definirExpediente` sempre apaga e reinsere o expediente inteiro daquele profissional
(ou do padrão do tenant), nunca faz diff · "múltiplos intervalos" é uma lista, e pedir só o delta
faria o servidor recalcular vizinhos — exatamente onde um intervalo passaria a se sobrepor sem
ninguém perceber. `EsquemaExpediente` também recusa dois blocos do mesmo dia se sobrepondo
(intervalos encostados, tipo 13:00–13:00, são aceitos).

2026-08-18 · A conversão de fuso do editor de folgas fica pendente do `date-fns-tz`/Temporal da
PARTE 2 §1, que nenhum ticket instalou ainda · por ora o horário do navegador é tratado como o do
tenant · única vertical em uso é `America/Sao_Paulo`, mas isso precisa ser revisitado quando o
booking público (Sprint 2) expuser o fuso para clientes fora desse horário.

2026-08-18 · Folga (`time_off`) é apagada de verdade, não soft delete · não está na lista de
"nunca deletar" da regra 11 do CLAUDE.md (agendamento, movimento de estoque, auditoria) — é um
bloqueio de agenda que a pessoa cria e desfaz por engano, não histórico protegido.

2026-08-18 · **Sétimo defeito: `libphonenumber-js` sozinho não cumpre "rejeite DDD inexistente"
(D49).** Medido: `parsePhoneNumberFromString('10987654321', 'BR')?.isValid()` devolve `true` —
a biblioteca valida o *formato* do número brasileiro (2 dígitos de DDD + 9 do celular), não se o
DDD foi de fato atribuído pela Anatel. DDD 10 nunca existiu · adicionada uma lista fixa dos 67
DDDs reais em `telefone.ts`, conferida depois do `isValid()` da biblioteca.

2026-08-18 · Busca por telefone e por nome não podem ir no mesmo `.or()` do PostgREST · o termo
digitado como telefone ("(11) 98765-4321") tem parênteses e espaço, que colidem com a sintaxe do
filtro composto do PostgREST (que usa `(`, `)` e `,` como separador) · quando o termo normaliza
para um telefone válido, a busca vira só `eq(phone_hash, hash)`, exata; senão vira `ilike` no
nome. Nunca os dois na mesma consulta.

2026-08-18 · Telefone nunca é buscado por `ilike` no `phone_e164` · não há índice ali (só no hash
e no trigram do nome) — um `ilike` variaria a tabela inteira a cada dígito digitado.

2026-08-18 · `client:own` (papel `professional` na tabela de §3.3) não restringe a consulta a "só
os clientes que esse profissional atendeu" · a política de RLS de `clients` é a genérica do
tenant (`has_tenant`), sem a trava por profissional que `appointments` tem — restringir por
profissional exigiria juntar com `appointments`/`tickets`, que ainda não existem. Fica para o
ticket que constrói agenda/comanda; por ora `client:own` só libera a permissão, sem escopo extra
na consulta, o mesmo tratamento que a permissão recebeu no TICKET-010.

2026-08-18 · `DELETE /api/v1/clients/:id` marca `deleted_at`, não `active = false` · a tabela
`clients` já tem a coluna certa para isso (D45), diferente de `services`/`professionals`, que
usam `active`.

2026-08-18 · **Oitavo defeito: 2 dos 8 verticais do enum `vertical_pack` não têm catálogo
seedado.** `hair` e `tattoo` existem no tipo (0001) mas não têm linha em `vertical_packs`
(0002) — `apply_vertical_pack()` corretamente dá `raise exception 'pack % não encontrado'` para
os dois, e o onboarding desfaz o tenant como projetado (o `try/catch` do TICKET-015 funcionou
exatamente como devia). Não é bug de código, é conteúdo que falta: alguém escolher "Cabelo" ou
"Tatuagem" no onboarding hoje recebe erro, não uma conta com catálogo vazio — o que é o
comportamento mais seguro dos dois ruins. Escrever o catálogo dessas duas verticais é trabalho de
conteúdo de produto, não deste ticket; fica anotado para quem mexer no pack de vertical.

2026-08-18 · **Bug real, achado pelo build:** o layout `(app)` nunca envolvia as telas em
`<ToastProvider>`. Funcionava por acidente em toda tela que usa `cookies()`/`headers()`
(`contextoAtual()` força renderização dinâmica, que pula a pré-renderização estática onde o erro
aparece) — `/clientes/importar` foi a primeira tela 100% estática a usar `useToast()`, e o
`next build` estourou `useToast precisa estar dentro de <ToastProvider>` na geração estática.
Corrigido movendo o `ToastProvider` para dentro do `(app)/layout.tsx`, envolvendo `{children}` e
a `TabBar`. Vale conferir se alguma tela das anteriores (config/servicos, config/profissionais)
também dependia desse acidente — hoje passam porque são dinâmicas, mas ficariam quebradas se
alguém as tornasse estáticas sem saber do motivo.

2026-08-18 · **Nono defeito: `.in()` do PostgREST com centenas de hashes de 64 caracteres excede
algum limite de URL.** Medido: a checagem de duplicata da importação de 500 linhas falhava por
inteiro (não parcialmente) ao mandar todos os `phone_hash` num só `.in()` — a URL resultante passa
de 30 KB. Corrigido dividindo a checagem em lotes de 200, o mesmo tamanho já usado para os
inserts em lote. **Vale para a família inteira:** qualquer `.in()` que possa crescer com o
tamanho do lote do usuário (não um enum fixo) precisa ser paginado.

2026-08-18 · Importação usa `papaparse` para o parsing de CSV, não um parser próprio · a regra
de negócio real (aspas, vírgula dentro de campo, quebra de linha dentro de campo) é bem
documentada e `papaparse` é maduro; escrever isso à mão seria reinventar RFC 4180 pior.

2026-08-18 · "Linha inválida" (nome em branco, telefone malformado) e "duplicata" (telefone já
usado, no arquivo ou no banco) saem em arrays separados (`errors[]` e `skipped[]`), como o
contrato de `docs/02-API.md` já desenhava · são categorias diferentes para a pessoa que revisa o
relatório: uma é erro de digitação para corrigir na planilha, a outra é "essa cliente já existe,
não precisa reimportar".

2026-08-18 · Duplicata é checada em duas rodadas — dentro do próprio arquivo primeiro, depois
contra o banco — porque a mesma linha nunca pode cair nas duas ao mesmo tempo, e checar as duas
juntas exigiria saber se um "match" veio do arquivo ou do banco antes de decidir a mensagem.

2026-08-18 · `availableSlots()` usa `@js-temporal/polyfill`, não `date-fns-tz` (a outra opção que
`§2.1` cita) · Temporal resolve `ZonedDateTime → Instant` com o offset histórico correto para
qualquer data (testado contra as transições reais de 2018/2019), e depois disso toda a aritmética
roda em `Instant` puro — que não tem noção de "horário local", então não tem onde um bug de fuso
se esconder. `date-fns-tz` faria a mesma coisa, mas exigiria carregar o offset manualmente em
cada soma; Temporal faz isso por construção. Não conflita com a regra de lint do `core/` (só
proíbe Next/React/Supabase/módulo de sistema — Temporal é puro).

2026-08-18 · O teste de "dia de mudança de horário de verão" usa datas reais de 2018/2019, não um
fuso inventado · o Brasil aboliu o horário de verão em 2019, mas as transições de 2018-11-04
(dia de 23h) e 2019-02-16 (dia de 25h) aconteceram de verdade em `America/Sao_Paulo` e continuam
no banco de fusos (IANA tzdata) · um teste com fuso fictício provaria menos: o bug clássico é
justamente hardcodar o offset de um fuso real (`UTC-3` fixo para o Brasil), e só uma data real
onde o offset historicamente mudou expõe isso. O teste confirma primeiro que o offset realmente
difere entre os dois dias antes de testar o resultado, para não passar por sorte.

2026-08-18 · Regra 2 (`[início, início+duração] cabe inteiro na janela`) e a checagem de colisão
usam janelas diferentes de propósito · caber no expediente olha só a duração do serviço, sem
buffer; colidir com bloco ocupado olha `[início-bufferBefore, fim+bufferAfter]` · é a leitura
literal de `§5.1`: o buffer é sobre não bater em outro compromisso, não sobre caber na janela —
um serviço com buffer generoso perto do fechamento não devia ser recusado só por isso, desde que
não haja ninguém depois dele.

2026-08-18 · Paralelismo (`§5.5`) conta só `appointments` contra `parallelCapacity`, nunca
`timeOff` · folga é o profissional fora do ar; nenhuma capacidade paralela muda isso. Já dois
agendamentos simultâneos (ex.: duas clientes secando esmalte) são exatamente o caso que
`parallel_capacity > 1` existe para permitir.

2026-08-18 · `src/core/scheduling/state.ts` lê o diagrama de `§6` de um jeito específico: `arrived`
só transiciona para `done`, nunca volta para `canceled` (a seta de cancelamento no topo do
diagrama, ambígua em ASCII, foi lida como saindo de `pending`/`confirmed`, não de `arrived` — faz
sentido de negócio: depois que a cliente chegou, o caminho é concluir ou marcar falta, não
cancelar). `no_show` só existe a partir de `confirmed`, nunca de `pending` — marcar falta de quem
nem chegou a confirmar não é "falta", é `expired`. Teste exaustivo cobre os 49 pares possíveis.

2026-08-18 · A corrida de duas requisições pelo mesmo horário (E59) não usa lock nenhum na
aplicação — é a constraint `appointments_no_overlap` (exclusion do Postgres) que resolve, como a
FAQ manda explicitamente. `criarAgendamento()` só tenta o insert e traduz o erro `23P01`
(exclusion_violation) em `409 SLOT_TAKEN`. Testado com `Promise.allSettled` de duas chamadas
simultâneas de verdade contra o banco: uma cria, a outra recebe o 409.

2026-08-18 · As 3 alternativas do 409 (E71) usam só o mesmo profissional, em até 7 dias · o
fallback multi-profissional que a FAQ descreve ("se não houver 3 em 7 dias, complete com outros
profissionais") não foi implementado — é a opção mais simples que atende ao critério de aceite
("conflito devolve 409 com 3 alternativas", que não especifica a variante multi-profissional).
Fica anotado para quando/se um cliente real pedir.

2026-08-18 · Remarcar revalida disponibilidade tentando o UPDATE direto (mesma exclusion
constraint), não um SELECT antes — mesma razão do E59: SELECT-então-UPDATE tem janela de corrida
que o insert direto não tem.

2026-08-18 · `concluirAgendamento()` cria a comanda (`tickets`) vazia, sem itens — popular a
comanda é do módulo de comanda, que ainda não existe. A idempotência de "concluir duas vezes não
duplica comanda" é por busca antes do insert (`appointment_id` não tem índice único ainda), não
por constraint do banco — a segunda tentativa de "concluir" já esbarra antes disso na transição
ilegal (`done → done`), então na prática a busca defensiva nunca chega a ser exercida por essa
via; ela segura o caso de um retry de rede que perdeu a resposta da primeira chamada.

2026-08-18 · `appointment:read`/`update` para o papel `professional` (escopo `own`) não ganhou
filtro extra na consulta, ao contrário do `client:own` (TICKET-018) que também ficou sem — mas
aqui não é uma lacuna: a política de RLS de `appointments` (não a genérica do tenant) já trava a
visão por profissional via `can_see_appointment()`, então o banco faz o trabalho que faltava para
`clients`.

2026-08-18 · Tela em `/agenda/novo` (é para onde o FAB da tab bar já apontava desde o TICKET-014)
· formulário simples com seleção de serviço/profissional/cliente e horário livre — não um
seletor de slots disponíveis (isso pede o endpoint `GET /availability`, que ainda não existe). Em
conflito, mostra as alternativas do 409 como chips tocáveis que reenviam com o novo horário.

2026-08-18 · `AppointmentRow` (nomeado em `03-DESIGN-SYSTEM §4`, ainda não construído até este
ticket) nasce aqui: barra lateral de 3px por status, horário tabular à esquerda · as cores
reaproveitam a mesma paleta do `Badge` (§5), mas `arrived`/`done`/`expired` não têm uma cor
"oficial" no `§5` (que só define confirmado/aguardando/em risco/faltou/sinal/ciclo) — usei
`info` para `arrived` (chegou, aguardando atendimento) e `txt-3` (neutro) para `done`/`expired`,
por não terem urgência: já aconteceu ou já perdeu a validade.

2026-08-18 · "Ocupação" e "previsto" (critério do TICKET-022, sem definição precisa em nenhum
documento) · ocupação = minutos ocupados por agendamento que ainda vale (`pending`/`confirmed`/
`arrived`/`done`) sobre minutos de expediente do dia; previsto = soma do `price_cents` dos mesmos
· ambos excluem `canceled`/`no_show`/`expired` — são os estados que não geram receita nem ocupam
a agenda de verdade. Testado que cancelar um agendamento tira ele das duas contas.

2026-08-18 · `listarAgendaDoDia` faz **uma consulta com join** (`clients(name)`, `services(name)`,
`professionals(display_name)`) para os agendamentos do dia, não N+1 · é o que permite 60
agendamentos carregarem em bem menos de 200ms (medido: ~50-100ms no teste de integração) — o
critério de aceite do ticket é exatamente sobre isso.

2026-08-18 · **Limite de verificação, registrado com honestidade:** não consegui verificar a tela
`/agenda` ao vivo no browser (390px, visual) porque ela exige sessão autenticada via
`contextoAtual()`, e não existe ainda uma tela `/entrar` (login) — só os endpoints de auth do
TICKET-009. A verificação ficou em três frentes que não substituem ver a tela renderizada: build
passa, os componentes usados (`StatTile`, `Chip`, `EmptyState`, `AppointmentRow`) já foram
verificados a 390px nos tickets anteriores, e os números exibidos (ocupação, previsto, join) têm
teste de integração exato contra o banco real. Vale voltar a isso quando a tela de login existir.

2026-08-18 · TICKET-023 e TICKET-024 viraram uma tela só (`detalhe.tsx`, aberta ao tocar uma
`AppointmentRow` na agenda) · os dois pedem ação sobre o mesmo agendamento (confirmar/chegar/
concluir/faltar de um lado, remarcar/cancelar do outro) — separar em duas telas obrigaria abrir
o mesmo agendamento duas vezes para fazer duas coisas relacionadas.

2026-08-18 · Os botões de estado (confirmar/chegou/concluir/faltou) nascem direto de
`proximosEstados()`, o mesmo módulo puro que o servidor usa para validar (`src/core/scheduling/
state.ts`) · uma transição que o servidor recusaria **nunca aparece como botão** — não é validação
de UI reimplementada, é a mesma fonte de verdade dos dois lados. Se a máquina de estados mudar, a
tela muda sozinha, sem precisar lembrar de atualizar os dois lugares.

2026-08-18 · "Arrastar para remarcar" (texto do TICKET-023) virou um campo de data/hora dentro do
sheet de detalhe, não um gesto de arrastar · mesma razão do TICKET-016 (reordenar serviços com
setas em vez de drag): arrastar um cartão de agendamento numa lista rolável, com um dedo só, num
app mobile, compete com o gesto de rolar a tela e erra mais do que acerta. O critério de aceite
real (revalida disponibilidade, `canceled_by`, não deleta linha) é todo de backend e já estava
resolvido desde o TICKET-021 — a interpretação mais simples que atende ao critério é a que foi
implementada.

2026-08-18 · O cancelamento pede o motivo **dentro do próprio sheet** (troca de conteúdo, não um
sheet aninhado) · Radix `Dialog` dentro de `Dialog` empilha overlay em cima de overlay, que em
390px de largura fecha o teclado virtual duas vezes ao digitar o motivo — é ruído, não confirmação
de verdade. Mostrar/esconder conteúdo dentro do mesmo sheet cumpre a "confirmação" que o critério
pede sem esse efeito colateral.

2026-08-18 · "Carrega em 1 requisição" (TICKET-025) · `resumoDeHoje()` faz uma consulta só (os
agendamentos de hoje, com join) e as quatro seções da tela (faturado, próxima cliente, alertas,
resto do dia) são recortes em memória da mesma lista — não quatro consultas.

2026-08-18 · "Faturamento do dia" é o que já foi **concluído** (`status = 'done'`), não o
"previsto" que o TICKET-022 já mostra na Agenda (que inclui `pending`/`confirmed`/`arrived`) ·
são números diferentes de propósito: a Agenda mostra o que a agenda promete, o Hoje mostra o que
já virou dinheiro. Confundir os dois faria a dona pensar que faturou o que só está marcado.

2026-08-18 · "Alertas" não tem definição em nenhum documento · interpretado como agendamentos
`pending` (ainda não confirmados) que começam nas próximas 3 horas — o que precisa de ação agora,
não a agenda inteira do dia · `confirmed` não gera alerta mesmo que seja em breve, porque já foi
confirmado; não tem o que fazer além de esperar.

2026-08-18 · `/` redireciona para `/hoje` quando há sessão (TICKET-025: "é a rota inicial") · sem
sessão, fica no placeholder — não existe tela de `/entrar` ainda (só os endpoints do TICKET-009),
então redirecionar para lá seria link morto.

2026-08-18 · A tela `/hoje` reaproveita o `DetalheAgendamento` de `/agenda` (mesmo sheet de
ações) em vez de duplicar a lógica de confirmar/chegar/concluir/cancelar/remarcar · o tipo
`LinhaHoje` foi desenhado com as mesmas colunas de `LinhaAgendaDia` de propósito, para caber ali
sem adaptação.

2026-08-18 · **Bug real achado pelo próprio teste do TICKET-027:** `z.iso.datetime()` sem
`{ offset: true }` só aceita sufixo `Z` (UTC) — rejeita `-03:00` e qualquer outro offset
explícito, que é ISO 8601 tão válido quanto. Chamar a rota pública de booking diretamente no
teste de integração (contornando o navegador, que sempre normaliza para `Z` via
`toISOString()`) expôs isso: o mesmo formato `-03:00` que passa despercebido em
`agendamentos.test.ts` (que chama o serviço direto, sem passar pelo Zod da rota) estourava
`VALIDATION_ERROR` aqui. Corrigido nos três schemas que usam `z.iso.datetime()`
(`EsquemaCriarAgendamento`, `EsquemaRemarcar`, `EsquemaFolga`, `EsquemaBookingPublico) — a API
não pode depender silenciosamente de todo cliente mandar só `Z`.

2026-08-18 · O honeypot (`website`) não pode ter `z.string().max(0)` no schema · vira
`z.string().nullish()` sem limite, e quem decide o que fazer com um valor preenchido é a ROTA,
não o Zod · com `max(0)`, preencher o campo já estoura `VALIDATION_ERROR` antes do meu código
rodar — e um 422 específico ensina um bot mais esperto que o honeypot foi notado. A resposta
tem que ser indistinguível de sucesso, e isso só a rota decide.

2026-08-18 · TICKET-026/027: leitura pública (`perfilPublico`, `disponibilidadePublica`,
`criarAgendamentoPublico`) passa inteira por `withNovoTenant` (service_role) · a RLS de
`tenants`/`services`/`professionals` exige `has_tenant()`, que um visitante anônimo nunca tem —
não existe outro caminho de leitura. A disciplina de não vazar dado fica em nunca selecionar
coluna a mais nas queries (nunca `settings`/`document`/`address` no perfil público), não na RLS.

2026-08-18 · Rate limit (G99: "Upstash é a única exceção ao sem Redis") sem `UPSTASH_REDIS_REST_
URL/TOKEN` provisionados · `limitador()` cai para um contador em memória do próprio processo
quando Upstash não está configurado (ou falha) · funciona para provar o comportamento — inclusive
o teste "50 tentativas, só as primeiras passam" roda de verdade — mas **não protege um deploy
serverless com várias instâncias**, que não compartilham memória entre si. Ligar o Upstash de
verdade é passo de infraestrutura (Eduardo), não falta de código.

2026-08-18 · hCaptcha (G100) sem `HCAPTCHA_SECRET` provisionado · `verificarCaptcha()` deixa
passar e registra um aviso, mesmo padrão do HIBP indisponível (TICKET-009) · honeypot e rate
limit continuam ativos de qualquer forma, sem depender de credencial nenhuma — são as duas
camadas que já protegem o `book` mesmo sem hCaptcha ligado.

2026-08-18 · A cliente do público que soma disponibilidade sem `professionalId` agrega **todo
mundo** que aceita online — inclusive o dono, que o TICKET-015 (onboarding) cria como
profissional automaticamente com `accepts_online = true` (o default da coluna). Não é bug: é o
comportamento certo para "qualquer profissional" no formulário público. Documentado porque um
teste inicial assumiu (errado) que só existia um profissional no tenant.

2026-08-18 · **Sexto defeito real na especificação**, achado testando o TICKET-028 com a vertical
`hair`: o enum `vertical_pack` (0001) tem 8 valores, mas a tabela `vertical_packs` (0002) só
semeia 6 — `tattoo` e `hair` não têm pack. `apply_vertical_pack()` estourava exceção para essas
duas, e como o TICKET-015 chama essa função dentro do onboarding, a conta nunca chegava a existir
— quem escolhesse "Tatuagem" ou "Cabelo" no cadastro batia num 500 puro. Migration
`0008_tolerate_missing_vertical_pack.sql`: sem pack, a função pula a etapa de catálogo e segue
para o expediente padrão (que não depende de pack) — a conta nasce com catálogo vazio, a pessoa
cadastra os serviços à mão (TICKET-016), em vez de o cadastro travar inteiro. Não inventei um
catálogo de tatuagem/cabelo porque isso é conhecimento de negócio que não está em nenhum
documento — fica para quando alguém real definir o que entra nesses dois packs.

2026-08-18 · `MessagingProvider` recebe o provider como parâmetro opcional em `enviarComFallback`
(default `new WhatsAppCloudProvider()`) · é o que permite testar toda a lógica de retry/fallback/
dedupe/opt-out com um provider falso, sem precisar de `WHATSAPP_ACCESS_TOKEN` — a orquestração
(quantas vezes tenta, quando desiste, o que grava em `messages`) é testável mesmo sem a conta do
WhatsApp Business existir.

2026-08-18 · "Falha 3 vezes" (§4) não distingue motivo — mas template rejeitado pela Meta (H108)
não melhora tentando de novo, então `enviarComFallback` sai do laço na primeira rejeição de
template e só esgota as 3 tentativas para falha transitória (rede, 5xx). A distinção vem de
`ErroDeEnvio.motivo`, que o provider decide.

2026-08-18 · H110 (opt-out só bloqueia marketing) é checado só quando `kind === 'campaign'` ·
lembrete/confirmação (`reminder`/`confirmation`, kind transacional) ignora `whatsapp_opt_out` de
propósito — "lembrete transacional segue até ela pedir explicitamente para parar tudo" é a frase
exata da FAQ.

2026-08-18 · O e-mail de fallback não implementa `MessagingProvider` inteiro, só uma função solta
(`enviarEmailDeFallback`) · a interface documentada em §4 (`sendTemplate`/`sendText`/
`parseWebhook`) é pensada para WhatsApp — "template" e "webhook de status" não fazem sentido para
e-mail simples, forçar a mesma forma criaria métodos vazios só para satisfazer um tipo.

2026-08-18 · Push (PWA) não está implementado — a ordem documentada é push→e-mail, mas o service
worker (TICKET-055/056) ainda não existe · o fallback vai direto para e-mail, com o comentário no
código marcando onde o push entraria quando existir. Não é lacuna silenciosa: está anotado.

2026-08-18 · A "Edge Function consumidora" de `§7` (TICKET-029) virou rota do Next protegida por
`CRON_SECRET` em vez de Supabase Edge Function · este projeto roda em Vercel, não hospeda
funções no Supabase; `CRON_SECRET` já nasceu variável de app (não do Supabase) no `.env.example`
do TICKET-002, o que já sinalizava esse caminho. `vercel.json` aponta `/api/cron/jobs` com
schedule `*/5 * * * *` — o Vercel Cron chama por **GET**, não POST, e preenche o header
`Authorization: Bearer $CRON_SECRET` sozinho quando essa env var existe no projeto; não é escolha
deste código, é o contrato do Vercel.

2026-08-18 · `SELECT ... FOR UPDATE SKIP LOCKED` (§7) não dá para fazer em duas idas do
PostgREST (um SELECT, depois um UPDATE por id) — reabre a janela de corrida que o SKIP LOCKED
existe para fechar. Virou função `claim_jobs()`: um UPDATE ... WHERE id IN (SELECT ... FOR UPDATE
SKIP LOCKED) que roda inteiro numa transação do banco. Testado com 4 "workers" reivindicando em
paralelo de verdade contra 1.000 jobs — zero duplicata, os 1.000 processam.

2026-08-18 · Job sem handler registrado para o `kind` não morre na hora por padrão — vira uma
falha normal, sujeita ao `max_attempts` de sempre (retry com backoff, `dead` só depois de
esgotar) · um handler pode nascer num deploy seguinte (é exatamente o caso do TICKET-029: os
handlers reais de `send_reminders`/`expire_holds` ainda não existem, chegam nos tickets que os
pedem) — matar na primeira tentativa impediria o job de ser reprocessado quando o handler
finalmente existir.

2026-08-18 · `decidirDesfecho()` mora em `src/core/jobs/backoff.ts`, não em `job-queue.ts` · é
regra de negócio pura (quando falhar vira `dead`), então cabe em `core/` — e como `finish_job()`
no banco faz a MESMA conta de backoff independentemente, os dois lados (app e banco) precisam
concordar; o teste de unidade prova a fórmula sem precisar do banco.

2026-08-18 · `send_reminders` (TICKET-030) roda direto na rota do cron, sem passar por `job_queue`
· ao contrário de `apply_vertical_pack`/outras operações de escrita única, mandar lembrete já é
idempotente por construção — filtra pelo que já está em `messages` antes de mandar, e o unique
index `messages_dedupe` é o backstop se dois runs se sobrepuserem. Enfileirar isso job por job só
faria sentido se cada envio precisasse de retry individual; aqui um run que falha no meio
simplesmente tenta de novo no próximo tick de 15min, sem duplicar o que já mandou de fato.

2026-08-18 · Link de confirmação sem login (`/confirmar/[token]`) usa HMAC assinado com
`CRON_SECRET`, não uma tabela nova · diferente do convite de profissional (TICKET-017, que abre
`invites` porque precisa de revogação), confirmar um agendamento não precisa disso — o link perde
a validade sozinho quando o agendamento sai de `pending` (checado no momento do uso contra o
banco, não contra o token) e tem prazo de 72h embutido no próprio payload assinado.

2026-08-18 · Clicar duas vezes no link de confirmação não estoura erro · se o agendamento já não
está `pending` quando o token é usado, a rota devolve o status atual em vez de tentar
`confirmarAgendamento()` de novo (que bateria em `INVALID_TRANSITION`, confirmed→confirmed) ·
clicar de novo num link que a pessoa já usou tem que parecer que funcionou, não parecer quebrado.

2026-08-18 · D-0 T-3h de um agendamento de manhã cedo (ex.: 9h, T-3h = 6h) é grudado nas 8h em vez
de mandar de madrugada (H109: "nada entre 21h e 8h") · `lembretesDevidos()` clampa para o início
da janela permitida, nunca pula o lembrete — a pessoa ainda recebe, só que na primeira hora
possível, não às 6h da manhã.

2026-08-18 · Bug de determinismo encontrado no próprio teste: usar `new Date().toISOString()`
como "agora" para testar se D-1 18h "já passou" depende da hora real em que o teste roda — passa
de manhã, falha à noite (ou vice-versa). Os testes de integração deste ticket usam datas fixas em
2026 e passam `now` explícito para `identificarLembretesPendentes`/`enviarLembretesPendentes`
(que já aceitam isso como parâmetro), em vez de depender do relógio de verdade.

2026-08-18 · O token de encaixe da lista de espera carrega a oferta inteira (waitlist id +
tenant + serviço + profissional + horário + fuso), não só um id · quem clica no link não tem
como saber qual foi a oferta de outro jeito, e abrir uma tabela só para guardar "qual foi a
última oferta" duplicaria o que o próprio token assinado já consegue carregar. Generalizei o
mecanismo do TICKET-030 (`confirmacao-token.ts`) para `token-assinado.ts`, reaproveitado pelos
dois — `confirmacao-token.ts` virou uma casca fina por cima dele.

2026-08-18 · **Bug de PostgREST, não do meu código:** `waitlist` não tem FK declarada para
`client_cycles` (é tabela derivada, sem relação por constraint), então `client_cycles!left(...)`
embutido na consulta de `waitlist` estourava erro — o PostgREST só embeda o que consegue navegar
por foreign key de verdade. Virou duas consultas separadas, unidas em memória por `client_id`.

2026-08-18 · Ordenação de quem avisar (E69) usa `value_at_risk_cents` de `client_cycles`, que
ainda não tem dado nenhum — o Motor de Ciclo (Sprint 3) é quem popula essa tabela · a consulta já
busca a coluna certa com `COALESCE` para 0, então passa a valer sozinha assim que o TICKET-035 em
diante rodar, sem precisar tocar neste código de novo.

2026-08-18 · `notificarProximoDaLista()` é chamada pela rota de cancelamento (`DELETE /appointments/
:id`), por fora do envelope de resposta e com `.catch()` que só loga · o cancelamento já
aconteceu quando o aviso roda — se avisar a lista falhar, isso não pode desfazer nem atrasar a
resposta do cancelamento, que é a ação que a pessoa pediu de verdade.

2026-08-18 · Sem histórico nenhum, `computeCycle()` devolve `on_track` com `predictedDate = today`
· o algoritmo de gaps pressupõe pelo menos uma visita para ter de onde prever (`predictedDate =
ultimoAtendimento + personalCycleDays`); cliente que nunca veio não está "atrasado para voltar",
ele nunca foi — é um caso diferente de "1 visita" (que já produz 0 gaps normalmente, mas tem uma
última visita real para servir de base).

2026-08-18 · O teste original de "clamp no teto" tinha um erro de aritmética meu: no braço de 1-2
gaps, o blend 60/40 com o padrão junto com o próprio descarte de gaps > 3× o padrão torna
matematicamente impossível estourar o teto de 2,5× por ali (o pior caso, gap = 3×padrão, ainda
fica bem abaixo). O teto só é alcançável no braço de 3+ gaps (mediana pura, sem blend) — o teste
foi refeito nesse braço.

2026-08-18 · TICKET-036 gravava `client_cycles` sem `value_at_risk_cents` — a coluna ficava no
default `0` para toda linha, mesmo `due`/`late`/`at_risk`/`lost` · o job só computava
`personal_cycle_days`/`predicted_on`/`late_days`/`state`, mas a fórmula do §5.3 ("valorParado =
preço atual do serviço × probabilidade de recuperação") nunca rodava. Sem isso a `v_recover_revenue`
existe mas devolve tudo com valor zero, e o TICKET-037 ("Recuperar receita") não teria número
nenhum para mostrar. Adicionado `valorEmRiscoCents()` nos dois caminhos (lote e tempo real), com
teste de integração conferindo o valor exato (6000 × 0,65 = 3900 para `late`).

2026-08-18 · TICKET-036, quatro bugs achados só quando o teste de performance rodou com 10 mil
clientes de verdade (nenhum dos quatro aparece com dados pequenos) · (1) PostgREST devolve no
máximo 1000 linhas por `.select()` mesmo sem `.limit()` — `recomputarCiclosDoTenant` perdia 90%
dos atendimentos concluídos em silêncio; corrigido com `buscarTudoPaginado()` (loop de `.range()`
até página parcial/vazia). (2) Paginar sem `.order()` explícito não garante ordem estável entre
chamadas `.range()` separadas — depois do fix de paginação, `processados` ainda variava entre
execuções (1000, depois 7902); corrigido com `.order('id')` nas três consultas paginadas. (3)
Vitest roda arquivos de teste em `worker_threads`, que compartilham `process.env` por referência
— `confirmacao-token.test.ts` mutava `process.env.CRON_SECRET` em `beforeEach`/`afterEach` e
vazava para outros arquivos de teste concorrentes que também usam o segredo real (só aparecia no
`pnpm verify` completo, nunca isolado); corrigido com injeção de dependência (`segredo?: string`
opcional em `gerarTokenAssinado`/`verificarTokenAssinado` e nas funções de confirmação), nunca
mais mutar `process.env` em teste. (4) Trocar o ÚLTIMO caractere de um token base64url para testar
"token adulterado" às vezes não muda o valor decodificado — base64 empacota 3 bytes em 4
caracteres, e o último caractere de um grupo parcial pode ter bit "não significativo"; corrigido
trocando o caractere do MEIO do token em vez do último. Motivo de registrar: os quatro só se
manifestam sob carga real ou execução paralela — útil lembrar de rodar `pnpm verify` completo
(não só o arquivo isolado) e testar em volume antes de fechar qualquer ticket que grava em lote.

2026-08-18 · TICKET-037, `tests/integration/recuperar-receita.test.ts` inseria todo cliente com o
mesmo `phone_e164` fixo · a constraint `clients_unique_phone` (tenant_id, phone_e164) rejeitava o
segundo insert em diante, e como o teste não checava `error` antes de `data!.id`, o erro real da
constraint virava um `Cannot read properties of null` sem pista nenhuma da causa. Corrigido dando
um telefone único por cliente (contador) e checando `error` explicitamente antes de acessar `data`.

2026-08-18 · `tests/integration/agenda-dia.test.ts` ("carrega 60 agendamentos em menos de 200ms",
TICKET-022) é flaky quando `pnpm verify` roda a suíte de integração inteira em paralelo contra o
mesmo projeto Supabase real: falhou 3 vezes seguidas em ~299ms sob carga total, mas passa
consistentemente em ~90ms quando rodado isolado ou junto de poucos outros arquivos. Não é
regressão de nenhum ticket — é contenção de rede/conexão quando 15+ suítes de integração disputam
o mesmo projeto ao mesmo tempo. Não ajustado o limite de 200ms (é critério de aceite real do
ticket, sob carga normal de uso); registrado aqui para não confundir com bug de verdade numa
próxima rodada de `pnpm verify` que rode tudo em paralelo.

2026-08-18 · `tests/integration/job-queue.test.ts` falha quando `pnpm test:integration` roda o
diretório inteiro (Vitest paraleliza arquivos de teste), mas passa 100% rodado sozinho · não é
regressão deste ticket (não toquei em `job-queue.ts`) — é contenção real entre arquivos de teste
concorrentes batendo no mesmo projeto Supabase na nuvem (sem Postgres local nesta máquina, ver
topo deste arquivo). Registrado como known issue de infraestrutura de teste, não de produto;
investigar isolamento (schema por arquivo de teste, ou reduzir paralelismo do Vitest) fica para
quando afetar CI de verdade.

2026-08-18 · TICKET-038 não define horário fixo para o job diário de campanhas · escolhido 10h no
fuso de cada tenant — bem dentro da janela permitida de 8h-21h (H109), com folga de sobra caso o
cron do Vercel atrase. Mesmo padrão do TICKET-036 (`recompute-cycles`): dispara a cada 15min,
cada tenant só processa quando bate a hora local certa. O job não reimplementa os limites (7 dias
entre campanhas, janela de horário, opt-out) — só decide QUEM entra na lista a cada rodada,
reaproveitando `enviarParaRecuperar` (TICKET-037) que já aplica tudo isso.

2026-08-18 · TICKET-039 não define COMO ligar agendamento a campanha — não existe link de
rastreio no booking público (fora de escopo do MVP) · atribuição por tempo: o primeiro
agendamento que o cliente cria depois de receber uma campanha, dentro de 30 dias, é o que ela
"trouxe" (`core/attribution/compute.ts`). Cada campanha reivindica no máximo um agendamento e
vice-versa, para não contar a mesma receita duas vezes quando o cliente recebeu campanhas
repetidas. Valor em centavos vem de `appointments.price_cents` (preço congelado na criação), não
de `tickets.total_cents` — o TICKET-042 (comanda com itens de verdade) ainda não existe nesta
base; revisar para usar o total real da comanda fechada quando ele existir.

2026-08-18 · TICKET-040, `clients.visits_count`/`ltv_cents`/`last_visit_at` existiam na 0001 mas
nunca eram escritos por código nenhum — ficavam sempre no default (0/null) · adicionado
`recalcularSegmentosDoTenant()` (cron `/api/cron/segments`, 4h local) que reconta a partir de
`appointments` concluídos, mesmo padrão de paginação do TICKET-036. As 3 listas inteligentes
("aniversariante", "primeira visita sem retorno", "ticket alto") viram uma view derivada
(`v_client_segments`, migration 0010) em cima desses campos — sem o recálculo, aniversariante
ainda funcionaria (usa só `birth_date`), mas as outras duas ficariam sempre vazias. "Ticket alto"
não tem definição no backlog: escolhido top 25% de LTV dentro do próprio tenant
(`percent_rank() >= 0.75`, `partition by tenant_id`) — relativo ao salão, não um valor fixo em
reais, porque um salão de bairro e um spa premium não têm o mesmo "alto".

2026-08-18 · `clients.upsert({id, visits_count, ...}, {onConflict: 'id'})` falhava mesmo quando a
linha já existia (só atualização, nunca insert de verdade) · Postgres valida NOT NULL na linha
inteira de um `INSERT ... ON CONFLICT DO UPDATE` antes de decidir entre inserir e atualizar —
sem `name` (NOT NULL, sem default) no payload, a linha é recusada mesmo em atualização pura.
Corrigido incluindo `name` no upsert (buscado junto na mesma consulta paginada). **Padrão pra
família:** upsert usado só para atualizar linha existente ainda precisa de todas as colunas
NOT NULL sem default no payload, não só as que você quer mudar.

2026-08-18 · TICKET-041, score de risco de falta calculado **na criação** do agendamento, não na
confirmação — é o único ponto em que o booking público (futuro TICKET-032) vai poder decidir se
exige sinal. Consequência: `confirmouAte12hAntes` sempre nasce `false` no cálculo gravado (nada
foi confirmado ainda nesse instante), então esse fator do §5.4 sempre soma seus 0,10 no score
gravado — não é bug, é o que "calculado na criação" significa; recalcular no momento da
confirmação fica para quando existir necessidade real de refletir isso. `pagouSinal` e
`assinanteDoClube` ficam sempre `false`: cobrança de sinal (TICKET-032) e clube de assinatura
(fora do MVP) não existem ainda — quando TICKET-032 nascer, passa a alimentar aqui. A aplicação
do limiar de 0,45 ("exige sinal no booking público") também depende do TICKET-032/031 (Asaas,
bloqueado por credencial do Eduardo) — só o cálculo e o alerta ⚡ (limiar 0,60) na agenda estão
prontos nesta sessão.

2026-08-18 · `pnpm build` falhando de forma inconsistente e sem relação com o código (module not
found em `/api/v1/appointments`, depois em `/dev/ui`, depois `pages-manifest.json` ausente mesmo
com "Generating static pages (40/40)" completo) · causa raiz: DOIS servidores dev leftover ainda
rodando desta sessão — um `pnpm dev --port 3015` iniciado horas antes (memória menciona "sobe
local e mostra agora") e um preview server gerenciado pela ferramenta Claude Browser na porta
3014 — os dois escrevendo na MESMA pasta `.next` que o `pnpm build` também usa. Nenhum dos dois
aparecia em `ps aux` de forma óbvia (o da porta 3014 nem sequer estava listado por `ps`, só via
`netstat` + `mcp__Claude_Browser__preview_list`). Corrigido matando os dois processos antes de
rebuildar. **Padrão pra família inteira:** nunca rode `pnpm build`/`pnpm verify` com `pnpm dev`
(ou qualquer preview) ativo no mesmo repo — os dois competem pela mesma `.next` e os erros
resultantes não têm nenhuma relação óbvia com a causa real. Antes de investigar um erro de build
"impossível" (módulo que existe mas não é encontrado, manifest ausente depois de sucesso
aparente), cheque `netstat -ano | grep LISTEN` nas portas de dev conhecidas e `preview_list`.

2026-08-18 · TICKET-042, comissão/fee de maquininha (F78) não entram nesta comanda ainda ·
`fee_cents` fica em 0 até o TICKET-043 (pagamento) escolher o método — a taxa da maquininha só
existe depois que sabemos COMO a cliente paga, e isso é escopo de outro ticket. `commission_base`
(gross|net_of_material) vem de `tenants.settings.commission_base`, sem coluna dedicada — mesma
convenção de `settings` freeform já usada por outros campos (fees, product_commission_bps).
Percentual de comissão de produto usa `settings.product_commission_bps` (padrão 10%, F80), nunca
o percentual de serviço. Estado da comanda fica só em `open`→`closed` neste ticket; `paid` e
`canceled`/`refunded` (máquina de estados completa do §6) ficam para TICKET-043.

2026-08-18 · `ticket_items` não tem coluna `created_at` (só `id`) — `.order('created_at')` em
`buscarComanda` falhava com erro genérico `INTERNAL` sem pista da causa real. Corrigido pra
`.order('id')`, mesma convenção usada em todo outro lugar do projeto que precisa de ordem estável
sem uma coluna de data dedicada.

2026-08-18 · TICKET-049, cofre criptográfico: `encryptVault`/`decryptVault` (`src/server/crypto/
vault.ts`) sempre buscam a DEK atual de `tenant_keys` para decifrar — nunca fixam por
`key_version` do registro. Isso só funciona porque a rotação de KEK (§8, "rotacionada anualmente")
troca a chave que embrulha a DEK, não a DEK em si; a DEK do tenant nasce uma vez no onboarding e
nunca muda. Adicionado `rewrapDek()` em `kek.ts` (extraído de `gerarDekCifrada`, que virou casca
fina por cima) como o primitivo que a rotação de verdade vai usar. `key_version` gravado em cada
registro cifrado é só trilha de auditoria de qual rotação estava vigente na escrita — decidir
decifrar por versão específica seria over-engineering sem um caso de uso real ainda (a única forma
de a DEK mudar de fato seria comprometimento, que é reemissão, não rotação).

2026-08-18 · TICKET-044, sem tela dedicada de estoque nesta rodada · o critério de aceite do
ticket ("fechar comanda gera stock_moves · estorno gera compensação · nunca deleta movimento") é
inteiramente sobre comportamento de servidor, testável por integração — não pede uma tela nova.
Cadastro de produto e ficha de consumo (`service_products`) ficam acessíveis só via API por
enquanto; a tela de catálogo de produtos/estoque fica para quando um ticket futuro (ou o
TICKET-045, alertas de estoque, que precisa mostrar algo na tela Hoje) pedir explicitamente.
`POST /api/v1/inventory/entries` cobre a única lacuna que o próprio `avg_cost_cents` (0 por
default, nunca escrito por nenhum fluxo automático) deixaria sem sentido: sem uma forma manual de
registrar compra/entrada, a média móvel do TICKET-044 nunca sairia do papel.

2026-08-18 · TICKET-050, anamnese por vertical: `alert_label` nunca usa o `label` da pergunta
(frase clínica completa, ex.: "Já teve reação a cola de cílios?") — o pack não define um rótulo
curto por pergunta, e inventar um dicionário id→rótulo sem fonte na especificação seria
over-engineering. Uso rótulo genérico fixo ("Atenção"): cumpre "só o booleano fica em claro" e
"rótulo nunca contém diagnóstico" ao mesmo tempo, ao custo de não diferenciar qual pergunta
disparou — quem quer saber qual, abre a ficha (AAL2 + log). `alertaDoCliente()` é leitura leve
(sem decifrar, sem gravar em `vault_access_log`) para o card do "próximo atendimento" e futura
ficha 360°; só `abrirFicha()` conta como abertura de verdade. Permissão da rota usa `vault:own`
literal da tabela do §3.3 — `manager` não tem `vault:*` nem `vault:own` na tabela, então fica sem
acesso ao cofre por design (só `owner` via `*` e `professional` via `own`); e o escopo `own` do
`professional` não é filtrado por profissional nesta implementação (mesma lacuna que já existe em
`appointment:own`/`client:own` em outras rotas — RLS não tem política extra pra isso ainda).

2026-08-18 · TICKET-047, sétimo defeito real na especificação: a view `v_daily_cash` (0001)
agrupa por `date_trunc('day', closed_at)`, que trunca no fuso da SESSÃO do Postgres — UTC por
padrão via PostgREST/supabase-js, não o fuso do tenant. Um fechamento às 23h30 em São Paulo
(02h30 UTC do dia seguinte) cairia atribuído ao dia errado no fechamento diário. `fechamentoDiario`/
`resumoMensal` (`src/server/services/caixa.ts`) não usam a view — buscam as linhas cruas de
`tickets` num intervalo calculado com `Temporal` no fuso do tenant (mesmo padrão do TICKET-022/
025) e somam em memória. A view continua existindo no schema (nada mais depende dela ainda), só
não virou a fonte de dado deste ticket. Teste de integração cobre o caso de fechamento perto da
meia-noite local justamente para não deixar essa classe de bug voltar em silêncio.

2026-08-18 · TICKET-044 (retroativo) e TICKET-045: `01-ESPEC-TECNICA §5.6` diz "estorno gera
movimento `in` compensatório", mas a FAQ F81 diz "gere stock_moves compensatórios do tipo
**return**". `stock_move_type` tem os dois valores (`in` e `return`) como distintos — não é
sinônimo. Fiquei com `return` (já implementado no TICKET-044): é semanticamente mais preciso
(distingue "voltou por cancelamento" de "entrou por compra", útil pro relatório de estoque um dia
separar os dois) e a FAQ costuma ser a camada mais específica/corrigida sobre a especificação
geral neste projeto (padrão já visto nos defeitos 1-9). Registrado aqui porque é uma contradição
literal entre dois documentos da especificação, não uma decisão livre.

2026-08-18 · TICKET-045, alerta de estoque calculado AO VIVO em `resumoDeHoje`, não armazenado ·
o job diário `/api/cron/stock-alerts` (07:00 local, §7) existe pra bater com a tabela de jobs da
especificação, mas só loga a contagem — a tela Hoje nunca depende do resultado do job, sempre
recalcula na hora. Evita o problema de "alerta desatualizado até o próximo cron rodar" que uma
versão armazenada teria (ex.: comanda fechada às 8h05 zera o estoque, mas o alerta só apareceria
às 7h do dia seguinte se dependesse só do job).

2026-08-18 · TICKET-048, pacotes e carteira: `consumirSessao()` usa CAS
(`update ... where used_sessions = <valor lido>`) em vez de incremento direto —
sem isso, duas requisições concorrentes pelo mesmo pacote (ex.: reabrir a
aba e clicar "usar sessão" duas vezes) liam `used_sessions=0` juntas e as
duas escreviam `1`, perdendo uma baixa. Testado com `Promise.allSettled`
disparando as duas ao mesmo tempo: só uma ganha, a outra recebe `SLOT_TAKEN`.
Nenhuma rota de `/api/v1/packages`/`/wallet` está em `02-API.md` — a
especificação não define contrato pra isso; desenhei o mínimo que atende o
critério (`comanda:own`, mesmo papel de quem já mexe em dinheiro na comanda)
e registrei aqui em vez de inventar section nova no documento fechado.
`debitarCarteira()` recusa saldo insuficiente — a tabela permite qualquer
`amount_cents` negativo, mas deixar a cliente "devendo" na carteira não tem
uso de negócio claro nesta fase, e é mais fácil relaxar a regra depois do
que apertar.

2026-08-18 · TICKET-003 nunca teve commit próprio no histórico — mas está satisfeito: o critério
de aceite ("migration aplica limpa em banco vazio · 34 tabelas · nenhuma sem RLS") é exatamente o
que `supabase/migrations/0001_initial.sql` já faz e sustenta desde o TICKET-001. Registrado aqui
pra não confundir "sem commit com esse número" com "não feito".

2026-08-18 · TICKET-046, comissão simples: percentual congelado por linha (§5.7) já existia desde
o TICKET-042 (`ticket_items.commission_bps`/`commission_cents`, escritos só no fechamento). O que
faltava era o "extrato por período fecha" — `extratoDeComissao()` lista as linhas de um
profissional num intervalo (`tickets.closed_at` entre `desde`/`ate`, só `closed`/`paid`) e prova
que a soma bate com o total. Extrato de um período já fechado nunca muda: como cada linha já
congelou o `bps` no fechamento, mudar o percentual do profissional depois não reescreve nada — é
o mesmo dado, não um recálculo. `GET /api/v1/commissions/extract?professionalId=&desde=&ate=`.

2026-08-18 · TICKET-051, consentimentos: `terms` (termos de uso, aceito no cadastro) fica fora
dos "três consentimentos separados" — são `health_data`, `image_use`, `marketing`, por cliente,
não por conta. `revogarConsentimento()` só marca `revoked_at` na linha ativa (`granted=true`,
`revoked_at is null`); nunca reescreve `granted`/`text_hash` — consentimento é trilha, revogar é
evento novo, não corrigir o passado. O critério "revogar imagem esconde a foto do portfólio
imediatamente" depende de leitura de `media` que ainda não existe (TICKET-052) — quando nascer,
precisa filtrar por `consents.revoked_at is null` do `consent_id` de cada foto; registrado aqui
para não se perder. `signatureKey` é só referenciado, não fez upload nenhum: bucket privado e
storage_key aleatório são infraestrutura do TICKET-052, construir os dois cedo duplicaria
trabalho quando 052 nascer.

2026-08-18 · TICKET-053, trilha de acesso ao cofre · `vault_access_log` já era escrito desde o
TICKET-050 (`abrirFicha()`), só faltava a tela. Join em memória com `clients`/`profiles` em vez
de PostgREST embed — `vault_access_log` não tem FK pra nenhuma das duas (mesmo motivo do
TICKET-034 com `waitlist`/`client_cycles`: `actor_id` pode ser `null` quando o acesso vem de um
job de sistema, sem usuário por trás, e uma FK NOT NULL não deixaria isso acontecer). Tela só pro
dono: nenhum papel além do owner (curinga) tem `vault:audit` na tabela literal de §3.3, então
`exigirPermissao` já restringe sozinha, sem checagem de papel avulsa na rota.

2026-08-18 · TICKET-052, fotos antes/depois: bucket privado `media` criado direto no projeto
(insert em `storage.buckets`, migration 0013) — `storage.objects` já vinha com RLS ligada e
nenhuma política (verificado antes de criar o bucket), então já nasce privado por padrão sem
precisar de política nenhuma; todo acesso passa por `service_role` no servidor (`withTenant`) +
signed URL de 5 min pro cliente, nunca leitura direta do bucket. EXIF removido por reencode em
`sharp` (nunca chama `.withMetadata()`, então nada sobrevive), com `.rotate()` sem argumento antes
disso pra ler a orientação do EXIF e não deixar a foto de lado. `sharp` virou dependência direta
(estava só em `pnpm.overrides` como pin de versão transitiva, TICKET-050/memória da família —
nada o instalava de verdade). `mediaParaPortfolio()` só devolve foto com `consent_id` setado E
`consents.revoked_at is null` — testado ponta a ponta: revogar o consentimento tira a foto da
lista na mesma consulta seguinte, sem cache no meio.

2026-08-18 · TICKET-054, direitos do titular: `POST .../erase` faz eliminação em UM estágio só
(cofre e mídia somem de verdade, na hora), não os "3 estágios" que o backlog descreve (pedido →
30 dias de carência → purga final via job `lgpd_retention`, §7). O job de retenção diário ainda
não existe nesta base — quando nascer, ele é quem cuida da carência e da purga final da linha de
`clients` propriamente dita (hoje ela só é anonimizada + soft-deleted, nunca hard-deleted, porque
`tickets`/`appointments` ainda referenciam o `id` dela pro registro fiscal de 5 anos). `data-export`
devolve só JSON — o "+PDF" do `02-API.md` fica pra quando existir necessidade real de um formato
legível fora do navegador; JSON já cumpre portabilidade (LGPD art. 18, VI) sozinho. Exportar decifra
o cofre (é dado DA titular, diferente de `abrirFicha`) e grava `vault_access_log` com `action:
'export'`, distinto de `'read'`.

2026-08-18 · TICKET-058, observabilidade · `send_reminders` (TICKET-030) roda direto a cada
tick, sem passar por `job_queue` — não havia como checar "sem execução em 30 min" (J129) sem uma
fonte de verdade dedicada. Criada `cron_heartbeats` (migration 0014): tabela global (não por
tenant, é sinal de operação da plataforma), sem política de RLS pra `authenticated`/`anon` — só
`service_role` toca nela, direto ou via `/api/health`. `/api/health` não checa PSP (Asaas, ainda
bloqueado por credencial) nem taxa de erro 5xx (é métrica de request HTTP — Sentry/Vercel
Analytics já cobrem, sem endpoint próprio pra duplicar). Sem autenticação de propósito: é o
endpoint que o monitor externo bate de fora, e só devolve contagens agregadas/booleanos, nada de
tenant específico. Runbook de incidente em `docs/runbooks/incidente.md` (já referenciado por
`04-SEGURANCA-LGPD.md §4`, checklist não editado — arquivo de especificação fechada). Teste de
restauração de backup registrado como pendente (tabela no runbook) — é operação humana fora do
código, não dá pra "fazer" via ticket de desenvolvimento, só documentar o procedimento e o lugar
onde a data fica registrada quando alguém rodar de verdade.

2026-08-18 · TICKET-055, PWA e offline: service worker escrito à mão (`public/sw.js`), sem
Workbox/next-pwa — só intercepta GET, nunca `/api/*` (generaliza a regra do CLAUDE.md de nunca
cachear `/vault`/mídia assinada pra toda chamada de API, não só essas duas). A fila de mutações
tem a lógica de ordem/retry/conflito isolada em `src/core/offline/queue.ts` (puro, testado); o
adaptador de IndexedDB (`src/lib/offline/db.ts`) e o `apiFetch()` (`src/lib/offline/api-client.ts`)
não têm teste automatizado — `vitest.config.ts` roda em `environment: 'node'`, sem jsdom/
IndexedDB, mesmo limite já registrado para as telas sob `(app)/` que exigem sessão de browser.
Verificação real fica para DevTools → Network → Offline. Retrofit de "entra na fila" feito só em
`agenda/novo` (criar agendamento) — é o caminho que o critério de aceite pede; os outros
formulários continuam com `fetch()` cru até precisarem da mesma proteção. Card de conflito
(`ResolucaoDeFila`) mostra que uma mutação falhou e oferece "tentar de novo"/"descartar", mas não
as "duas versões" lado a lado que o `§4.2.5` descreve — mostrar a versão do servidor exigiria uma
leitura genérica por URL que não existe ainda; registrado como simplificação, não como criado por
engano. `manifest.json` referencia ícones em `/icons/` que ainda não existem (asset de design,
fora do escopo de código).

2026-08-18 · TICKET-057, endurecimento final · CSP com nonce por requisição no `middleware.ts`
(Edge Runtime, `crypto.randomUUID()`), gerado a cada request e propagado via header **da
requisição** (não só da resposta) — é assim que o Next encontra o nonce sozinho e carimba o
próprio script de hidratação, sem o que `'strict-dynamic'` derrubaria o app inteiro (confirmado
ao vivo: `link: preload` do CSS de layout já saiu com o `nonce=` certo). `style-src` **não** leva
nonce, ao contrário do `script-src` — testado ao vivo e quebrou na hora: nonce em CSP só cobre
`<style>`/`<link>`, nunca o atributo `style=""` que o React usa toda hora (barra de progresso,
posição no calendário), e com nonce presente o `'unsafe-inline'` é ignorado pelo navegador,
então toda `style={{...}}` do app apanhava com "Applying inline style violates CSP". Solução:
`style-src 'self' 'unsafe-inline'` sem nonce nenhum — risco de XSS por CSS é ordens de grandeza
menor que por script, e é o `script-src` (nonce + strict-dynamic, sem essa concessão) que carrega
a defesa de verdade. `'unsafe-eval'` só entra em `script-src` quando `NODE_ENV=development` (o
webpack do `next dev` usa `eval()` pra HMR — sem isso o próprio dev server quebrava com a mesma
classe de erro; build de produção não usa `eval`, então nunca sai daqui em produção).

Rate limit global: um teto de 120 req/min por IP dentro do próprio `rota()` (`src/server/http/
handler.ts`), em cima de toda `/api/v1` e também cron/health (que passam pelo mesmo wrapper — o
volume deles é ínfimo perto de 120/min). Fica por baixo dos limites finos que login/signup/
booking público já tinham (aqueles sabem o que estão limitando; este só sabe que é IP demais
rápido demais). `ipDe()` saiu duplicado do `book/route.ts` para `src/server/http/ip.ts`,
compartilhado pelos dois.

Sentry (`@sentry/nextjs`): um `src/instrumentation.ts` só (server+edge via `NEXT_RUNTIME`) em vez
de `sentry.server.config.ts`/`sentry.edge.config.ts` separados — é o padrão atual do SDK pra App
Router. `beforeSend`/`beforeSendTransaction` chamam `redigirEventoSentry` (`src/lib/observability/
redact.ts`, função pura testada em `tests/unit/observability/redact.test.ts`) sempre, mesmo sem
`SENTRY_DSN` configurado (mesmo padrão de credencial ausente do WhatsApp/Asaas: sem DSN o SDK só
não manda nada, não é erro). A redação anda em duas camadas — chave sensível apaga o valor
inteiro em qualquer profundidade (telefone, e-mail, cofre, token, cookie…), e o texto que sobra
ainda é varrido por padrão de telefone/e-mail/CPF solto (mensagem de erro livre também vaza PII).
`trace_id`/`event_id`/`release`/`timestamp` ficam isentos da varredura de texto — sem isso, um
hex de 32 caracteres tem chance real de conter 10+ dígitos seguidos e a máscara corromperia o elo
de rastreamento à toa. Adicionado `global-error.tsx` (o SDK pede pra capturar erro de renderização
do React que nenhum `error.tsx` de rota alcança). Sem `SENTRY_AUTH_TOKEN`, o build pula upload de
source map sozinho, com aviso — não falha.

`pnpm audit`: zero vulnerabilidade conhecida nas dependências atuais.

**Pendente de verificação ao vivo, fora do alcance deste ambiente de desenvolvimento** (mesmo
padrão do teste de restauração de backup do TICKET-058): nota do securityheaders.com e varredura
OWASP Top 10 via ZAP contra o deploy real. Os dois exigem uma URL pública e ferramenta que não
existe aqui — o que dava pra verificar sem depender de infraestrutura externa (headers realmente
enviados pelo servidor, ausência de violação de CSP com a aplicação renderizando de verdade,
`pnpm audit`) foi verificado ao vivo com `curl`/o Browser pane. Registrado em
`docs/runbooks/incidente.md`? Não — é checagem pontual pós-deploy, não runbook de incidente;
fica para o Eduardo rodar uma vez a URL de produção existir de fato.

`push_subscriptions` (tabela do TICKET-056, em andamento em paralelo por outra sessão nesta mesma
janela: migration já aplicada no projeto remoto, sem arquivo local ainda) apareceu na descoberta
por introspecção do teste de isolamento e quebrou a suíte inteira por falta de linha semeada —
adicionei só a linha de seed em `tests/rls/isolation.test.ts` (mesmo padrão de toda tabela nova
com `tenant_id`), não o resto da implementação, que não é deste ticket. `package.json`/
`pnpm-lock.yaml` também carregam a dependência `web-push`/`@types/web-push` que aquela sessão já
tinha adicionado antes deste commit — ficou junto porque é o mesmo arquivo, não foi eu quem pediu.

2026-08-18 · TICKET-056, push notification · A outra sessão paralela tinha deixado só a tabela
criada no banco (migration `20260818230107_push_subscriptions`, sem arquivo local, sem código
nenhum em cima) e parado. Assumi o ticket sozinho a pedido do Eduardo. Dois problemas reais na
tabela que peguei pronta, corrigidos na 0016 antes de construir em cima: (1) `UNIQUE (endpoint)`
era global — a mesma pessoa em dois estabelecimentos (memberships N:N) do mesmo aparelho reusa o
mesmo endpoint de push (decisão do navegador, não da aplicação), então a segunda inscrição
falharia sem motivo de negócio; virou `UNIQUE (tenant_id, endpoint)`. (2) a política só checava
`has_tenant(tenant_id)` — qualquer membro do tenant lia/apagava a inscrição de push de QUALQUER
outro membro (endpoint + chaves de outro dispositivo, que dá pra usar pra mandar notificação se
vazar); virou `user_id = auth.uid() and has_tenant(tenant_id)`.

Alcance real do canal push em `enviarComFallback`: só clientes com `clients.user_id` preenchido
(coluna "se criou conta no app da cliente", existe desde a 0001). A área `(client)/minha-conta`
do briefing não está no backlog de 58 tickets — não existe hoje. Na prática, o canal cobre o
caso de uma cliente que também é membro da equipe (raro, mas real) e fica pronto e testado
(`tests/integration/mensageria.test.ts`, canal push) para o dia em que o portal da cliente
nascer, sem precisar mexer em `mensageria.ts` de novo — só alimentar `clients.user_id`.

`web-push` não devolve id de mensagem (não existe esse conceito no protocolo Web Push) — o
`providerId` gravado em `messages.provider_id` é sintético (`push.<statusCode>.<sufixo do
endpoint>`), só para manter o mesmo formato que os outros providers preenchem. Inscrição morta
(404/410 do serviço de push — navegador desinstalou ou revogou) é apagada automaticamente na
hora que a tentativa de envio esbarra nela, dentro do próprio `enviarComFallback` — não existe
job de limpeza separado, e não precisa: só se descobre que morreu na hora de tentar mandar.

UI em `config/notificacoes`: detecta iOS Safari fora do modo standalone (`navigator.standalone`)
e mostra instrução de instalar na tela de início antes de qualquer botão de ativar — no iOS,
pedir permissão de notificação fora do PWA instalado nem aparece pro usuário (I118 do FAQ), então
mostrar o botão ali seria um botão que não faz nada. Sem ícones em `/icons/` ainda (mesmo gap já
registrado no TICKET-055 pro `manifest.json` — asset de design, fora do escopo de código); o
`showNotification` referencia os paths mesmo assim, do jeito que o `manifest.json` já fazia.

Sem `SENTRY_DSN`/consulta ao Sentry aqui — reforça só o padrão já registrado: sem
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`, o botão de ativar mostra erro amigável e
`enviarPush` lança `falha_transitoria` (o chamador já sabe cair pro e-mail); nunca finge que
funcionou, nunca derruba o fluxo de lembrete inteiro por falta de credencial.

2026-08-18 · Deploy inicial no Vercel · Projeto `ciclo` criado no time `starkinovacoes`
(Hobby, não Pro) e as 17 variáveis de ambiente com valor local (Supabase, VAULT_KEK,
CRON_SECRET, feature flags) subidas para `production` via `vercel env add`. Gerado o par de
chaves VAPID nesta sessão (`web-push generateVAPIDKeys()`) para o TICKET-056 funcionar de
verdade em produção — guardado em `.env.local` e no Vercel, nunca commitado.

**`vercel.json` ficou com `crons: []`** — o plano Hobby só permite cron 1×/dia, e os 6 jobs do
`01-ESPEC-TECNICA §7` rodam a cada 5-15 min (lembretes, expirar reserva de sinal, recalcular
ciclo…). Sem eles, o site funciona (agenda, comanda, booking público, motor de ciclo sob
demanda) mas nada dispara sozinho: reservas com sinal pendente não expiram automaticamente,
lembrete D-1/D-0 não sai sozinho, campanha de reativação não roda. **Isso é um buraco real, não
cosmético** — precisa de uma destas duas resoluções antes do produto valer para um salão de
verdade: (1) upgrade do time para Vercel Pro (US$20/mês/membro, libera cron nativo de alta
frequência) ou (2) cron externo gratuito (ex.: cron-job.org) batendo em `/api/cron/*` com
`Authorization: Bearer $CRON_SECRET` a cada 5-15 min, sem custo. Decisão do Eduardo, registrada
aqui para não se perder — nenhuma das duas foi feita ainda nesta sessão.

2026-08-18 · Descoberto ao vivo, pós-deploy: não existia tela de login/cadastro nenhuma.
O TICKET-009 do backlog só tinha critério de aceite de API ("rota autenticada sem sessão →
401", "senha fraca rejeitada", "HIBP checado") — a pasta `(auth)/` do briefing (§1.7) nunca
virou ticket explícito nos 58, e ninguém construiu essa UI em nenhum ticket subsequente. O site
publicado ficava com uma tela estática sem link nenhum ("Entre para ver o resumo do seu dia.",
sem forma de entrar). Não é falha de nenhum ticket específico — é um buraco real na
especificação, só visível depois do primeiro deploy de verdade.

Corrigido fora da numeração de ticket (não tem ticket próprio no backlog): `/entrar`,
`/cadastro`, `/onboarding` e `/auth/callback` (troca do `code` de confirmação de e-mail por
sessão via `exchangeCodeForSession` — nunca confiar em token que passou pela URL do navegador).
De quebra, corrigido `emailRedirectTo` ausente em `/api/v1/auth/signup` — sem ele, o link do
e-mail de confirmação usa o Site URL configurado no painel do Supabase, que aponta para
localhost até alguém trocar lá; agora usa `NEXT_PUBLIC_APP_URL`, que já é a variável certa
(mesma que `/api/v1/auth/password/forgot` já usava). `/nova-senha` (troca de senha após o link
de "esqueci minha senha") continua sem tela — fica para quando alguém precisar de verdade,
mesmo padrão de simplificação registrado no TICKET-055.

Fluxo testado ao vivo contra o Supabase de produção via `pnpm dev`: cadastro devolve
"confirmação enviada" e login com credencial errada devolve a mensagem certa sem vazar se o
e-mail existe. Não testado: clicar no link de confirmação de verdade (exige e-mail real chegando
na caixa de entrada, fora do alcance desta sessão) — o código do callback segue o padrão
documentado do Supabase (PKCE, troca no servidor), mas a ponta a ponta com e-mail real ainda
precisa de alguém confirmar manualmente.

2026-08-18 · Otimização de UI (padrão de sistemas grandes) — plano aprovado antes de mexer.
Achado por auditoria de código (não só "gosto"): de ~15 superfícies do app, só 2 usavam sombra
(`toast.tsx`, FAB da tab bar) — todo o resto (Card, StatTile, AppointmentRow, Sheet) era plano
com só borda de 1px, e `grep hover:` no projeto inteiro não retornava nada (decisão consciente
pro mobile, mas invisível pra quem testa no navegador de desktop). Corrigido: token de sombra
`--shadow-elevado`/`--shadow-flutuante` em `globals.css` (sombra escura + realce sutil de 1px,
não a `shadow-lg` genérica do Tailwind, pensada pra fundo claro); `Card` ganha a sombra por
padrão; `StatTile`/`AppointmentRow` passaram a **compor** `Card` em vez de duplicar a mesma
string de borda/fundo/raio; `hover:` adicionado em `Button`/`Chip`/`AppointmentRow`/`TabBar`/
seletor de dia da agenda, sempre ao lado do `active:scale` que já existia (não troca, `hover:`
nunca dispara sozinho em touch). Emoji (`⚡⚠✓⏳✕🔒✦`) trocado por ícone `lucide-react` em
`AppointmentRow` e `Badge` — misturado com ícone de verdade no resto do app, renderiza diferente
por SO/navegador. Novo `Topbar` (`src/components/shell/topbar.tsx`) no shell autenticado — não
existia nenhuma barra de marca/orientação; sem fetch de dado nenhum, pra não adicionar latência
em toda tela. `SectionHeader` consolida uma string de classe repetida 4x em `hoje.tsx`.

Verificado ao vivo: `/dev/ui` (vitrine de componentes, não exige login — usei pra conferir sem
sessão, adicionei `AppointmentRow` lá que não estava) e um tenant+usuário de teste criado via
MCP só para ver `Hoje`/`Agenda` reais autenticados — apagado ao final (cascade delete do tenant
+ `admin.deleteUser`), mesmo padrão dos testes de integração.

**`pnpm test:integration` tem 3 falhas em `resumo-hoje.test.ts`, sem relação com esta mudança**
(não toquei em `resumo-hoje.ts` nem no teste — `git log` confirma o último commit nesses
arquivos é de sprint anterior). Rodei perto da meia-noite; o fixture do teste cria agendamentos
"X horas a partir de agora" sem travar horário de execução — passando da virada do dia, o
agendamento cai no dia seguinte e quebra a asserção de "hoje". É fragilidade de teste dependente
de horário de execução, pré-existente, não bug de produto. `test:rls` (103) e `build` passam
limpos; segui o deploy sem bloquear nisso.

2026-08-18 · Bug crítico achado ao vivo em produção logo após o deploy da otimização de UI:
`/config/notificacoes` e `/clientes/importar` estavam **completamente quebradas** (nenhum
script carregava, console cheio de `violates Content Security Policy`). Causa: as duas páginas
não fazem fetch de servidor nenhum, então o Next as pré-renderizava como **estáticas** — o CSP
com nonce (TICKET-057, `src/middleware.ts`) gera um nonce **novo a cada requisição**, mas o HTML
estático carimba o nonce de uma única vez, no build. Os dois nunca batem: todo script (inclusive
o de hidratação do próprio Next) é bloqueado. `/_not-found` (a página de 404 embutida do Next,
sem arquivo próprio até agora) tinha o mesmo problema.

Corrigido com `export const dynamic = 'force-dynamic'` nas duas páginas + um `src/app/not-found.tsx`
próprio (também `force-dynamic`) — as três eram os únicos casos de página 100% estática no app
inteiro (confirmado reconstruindo e conferindo a lista `○ (Static)` do build; só sobrou `/dev/ui`,
que devolve 404 de propósito fora de desenvolvimento e por isso nunca serve conteúdo real em
produção mesmo estática). Testado com `pnpm build && pnpm start` local (não dá pra reproduzir em
`pnpm dev`, que não faz pré-renderização estática real) — confirmado sem violação de CSP.

**Padrão pra lembrar:** toda vez que criar uma página nova sob `(app)/` sem `await` nenhum no
Server Component, ela vira candidata a pré-renderização estática — e quebra silenciosamente sob
esse CSP. Checar a lista `○` do `pnpm build` antes de cada deploy até isso virar teste automático.

2026-08-19 · Fase 3 do plano /admin + site público: `perfilPublico` (agora `React.cache()`, evita
3 idas ao banco por view entre `layout.tsx`/`page.tsx`/`generateMetadata`) ganhou tagline, sobre,
endereço, WhatsApp, Instagram, horário padrão do negócio e cor de acento (de `vertical_packs`).
Corrigido bug real achado na auditoria: `disponibilidadePublica` mandava `bufferBeforeMin`/
`bufferAfterMin` fixos em `0` pro cálculo de horário — o preparo/limpeza que o serviço cadastra
(Fase 2) nunca valia no site público, só no agendamento interno. Cor de acento por tenant vira
variável CSS **inline no wrapper** de `[slug]/layout.tsx` (`--acc`/`--acc-2`/`--acc-soft` via
`color-mix`), nunca um `<style>` global nem sobrescrita de `:root` — o admin é árvore irmã, nunca
é afetado, e todo componente que já usa `bg-acc`/`text-acc-2` recolore de graça. Agendamento
migrou de `[slug]/booking.tsx` pra `[slug]/agendar/` com reskin (cartão de serviço, faixa de 14
dias, horários agrupados Manhã/Tarde/Noite, carrega o primeiro dia sozinho) — a lógica de 3
fetches/honeypot/tratamento de erro foi mantida palavra por palavra, só a casca mudou.
`lista-espera/[token]/` criada (a API já existia, o link do WhatsApp estava morto).

**`perfilPublico` agora devolve `address` de propósito** — o teste
`tests/integration/booking-publico.test.ts` que garantia "nunca devolve address" foi atualizado
pra refletir que isso é intencional desde que o site ganhou seção de contato (Fase 3); `settings`
e `document`, esses sim, continuam nunca saindo pro público.

**Bug crítico achado ao vivo, sistêmico, afetava toda rota de mutação com idempotency-key do app
inteiro** (não só código desta rodada): `lerCorpo(req, schema)` lia `req.json()` direto no
`Request` original, e toda rota chama isso ANTES de `comIdempotencia(req, ...)`, que precisa de
`req.clone().text()` pra calcular o hash do pedido. Contra um `Request` de verdade vindo de um
`fetch()` de navegador (não um construído em teste com `body` de string solta), clonar depois de
consumido estoura `TypeError: unusable` — a rota inteira vira `500 INTERNAL` sempre. Reproduzido
ao vivo tentando salvar `/admin/config/negocio` (a rota nova desta sessão) e confirmado que
`POST /api/v1/services` (pré-existente, nunca alterada) tem o mesmíssimo stack trace — **não é
bug desta rodada, é falha de projeto que atravessa toda a base desde que `comIdempotencia`
existe**, só nunca foi pega porque nenhum teste de integração chama `lerCorpo` e
`comIdempotencia` no mesmo `Request` (todos testam os dois separados) e nenhuma tela sob `(app)/`
tinha sido testada num navegador de verdade antes desta sessão (limite já registrado desde o
TICKET-022). Corrigido em `src/server/http/body.ts`: `lerCorpo` agora lê de `req.clone().json()`,
deixando o `Request` original intocado para quem vier depois clonar. Teste de regressão em
`tests/unit/server/idempotency.test.ts` reproduz a ordem real (`lerCorpo` → `comIdempotencia` no
mesmo `Request`) — confirmado que falha sem a correção (revertida e testada de propósito antes de
restaurar) e passa com ela. **Padrão pra família inteira**: qualquer wrapper que precise ler o
corpo de um `Request` mais de uma vez (idempotência, log de auditoria, replay) só é seguro se a
PRIMEIRA leitura em qualquer lugar do código for sempre a partir de um clone, nunca do original —
constructed-body de teste mascara esse tipo de bug, só um `fetch()` de navegador real revela.

2026-08-19 · CRM, conversão e personalização (pedido do Eduardo, fora da numeração de tickets,
para apresentar a ideia): o banco já era um CRM e a interface escondia quase tudo — `clients`
tinha `tags`/`birth_date`/`source`/`referred_by`/`ltv_cents`/`visits_count`/`no_show_count`
desde a 0001, `campaigns` tinha o funil inteiro (`sent_count`/`booked_count`/`revenue_cents`) e
`v_client_segments` as três listas inteligentes, mas **não existia ficha do cliente** (nenhuma
rota `/admin/clientes/[id]`), nem tela de campanha, nem mensagem pronta. O trabalho foi quase
todo dar porta de entrada para dado que já estava lá.

**A virada que destrava tudo hoje: link `wa.me`.** O envio oficial por WhatsApp depende de
credencial da Meta que continua bloqueada (TICKET-043). Mas `wa.me/55...?text=` com o texto já
personalizado abre o WhatsApp da própria pessoa com a mensagem escrita — funciona sem credencial
nenhuma e é exatamente o que ela já faz na mão, só que sem digitar. É o que torna "mensagens
prontas" e "campanha" utilizáveis hoje em vez de promessa.

Migration 0017: `clients.preferences` (jsonb livre — cada vertical pergunta coisa diferente; numa
barbearia é número da máquina e como faz a barba, não CEP) e `message_templates` (por tenant, não
catálogo global: o texto é a voz do negócio, e a graça é o dono reescrever). `EsquemaCliente.
preferences` ficou `.optional()` e **não** `.default({})` — com default o tipo de saída do Zod
exigiria o campo em toda chamada de `criarCliente` já existente, quebrando 9 pontos do código
por causa de um campo novo opcional.

Telas: ficha do cliente (métricas, selo de ciclo, preferências, etiquetas, aniversário, quem
indicou/indicados, histórico, mensagens), `config/mensagens` (biblioteca editável com prévia
real e inserção de variável no cursor), `campanhas` (funil enviadas→agendaram→receita, com ROI
por mensagem) e `campanhas/nova` (segmento → modelo → lista com um toque por pessoa). Painel da
carteira no topo de `/admin/clientes` com atalho acionável para "Recuperar" — número que não
leva a lugar nenhum não muda o dia de ninguém.

**Modelo que usa `{{data}}`/`{{hora}}`/`{{servico}}` depende de horário marcado** — em disparo
de campanha esse horário não existe e o texto sairia "no dia às ." na cara do cliente. Na
campanha esses modelos são filtrados; na ficha eles aparecem bloqueados com o motivo, e quando
há agendamento futuro as variáveis são preenchidas com ele (`precisaDeAgendamento` em
`src/lib/mensagens.ts`, que fica em `lib/` e não em `server/` porque a prévia roda no navegador
enquanto a pessoa escolhe — mesma função dos dois lados evita a prévia divergir do envio).

`scripts/seed-demo-barbearia.mjs`: barbearia fictícia "Dom Rocha" com 45 clientes e 6 meses de
história, porque sem cron (plano Hobby) `ltv_cents`/`visits_count` ficam zerados e toda tela de
CRM nasce vazia. Três defeitos do próprio seed, todos achados conferindo o resultado no banco em
vez de confiar no "rodou sem erro": (1) passo fixo de 30min entre atendimentos fazia um
"corte + barba" de 60min invadir o horário seguinte e a `appointments_no_overlap` recusava o
lote — passou a encadear pelo fim do atendimento anterior; (2) **cadência quase sempre é múltiplo
de 7** (21 dias, 14 dias), então todas as visitas de um cliente caem no mesmo dia da semana, e
descartar domingo/segunda apagava o histórico inteiro de quem calhou nesses dias — 10 dos 45
ficavam com ficha zerada; agora empurra para o próximo dia aberto; (3) todo mundo nascia com
`created_at` de hoje e o painel anunciava "45 clientes novos este mês", que denuncia o dado de
mentira na hora. Senha do demo vem de `DEMO_SENHA` no ambiente (regra 10: segredo nenhum no
repositório, nem em seed) e é sorteada e impressa se a variável não existir.

`tests/rls/isolation.test.ts` ganhou linha de `message_templates`: o teste descobre tabela por
introspecção, então **toda tabela nova com `tenant_id` precisa de seed lá** ou o teste genérico
de "sobrou linha do outro tenant" falha por não ter o que sobrar (mesma pegadinha já registrada
para `push_subscriptions`). A regra de lint `service-client-confinado` passou a valer também
para `scripts/**` como já valia para `tests/**` — script de manutenção roda na mão, fora do app,
sem sessão de usuário nenhuma.

2026-08-19 · Dois defeitos do próprio CRM, achados na revisão logo depois de subir — os dois eram
promessa que a tela fazia e o código não cumpria:

1. **O funil de campanha nasceria morto.** `registrarCampanha` gravava só a linha em `campaigns`,
   mas a atribuição de receita (TICKET-039, `atribuicao.ts`) procura `messages` com
   `kind = 'campaign'` e `status = 'sent'` para creditar o agendamento concluído em até 30 dias.
   Sem essas linhas, `booked_count`/`revenue_cents` de toda campanha criada pela tela nova
   ficariam zerados para sempre e o funil seria enfeite. Passou a receber `clientIds` (quem
   recebeu, não só quantos) e a gravar uma `messages` por pessoa. `status: 'sent'` e não
   `'queued'` porque a mensagem saiu de fato — quem apertou enviar foi a pessoa, no WhatsApp
   dela; o que o sistema não sabe, e por isso não finge saber, é se foi entregue.
2. **"Marcar horário" na ficha abria o formulário em branco.** O botão mandava `?cliente=<id>` e
   `agenda/novo/formulario.tsx` simplesmente ignorava a query — a pessoa tinha que redigitar o
   nome de quem estava na tela anterior. Agora o formulário lê o id e busca nome/telefone.
   **Só o id viaja na URL, nunca nome nem telefone**: dado pessoal não entra em query string
   (fica em histórico de navegador, log de servidor e cabeçalho Referer). O telefone é
   reformatado para `(11) 99111-0001` na hora de preencher — `+5511991110001` é o formato do
   banco, não o que a pessoa lê.

Também reaprendida na marra a armadilha já registrada na memória do projeto: **rodar `pnpm build`
com `pnpm dev` ativo no mesmo repositório corrompe o `.next`** (os dois escrevem na mesma pasta).
O sintoma não tem relação óbvia com a causa — `Cannot find module './vendor-chunks/...'` e 500 em
página que funcionava. Conserto: matar o dev, apagar `.next`, subir de novo.

2026-08-19 · Rodada de revisão do CRM — três coisas que funcionavam na demonstração e quebrariam
num salão de verdade, mais a dívida de teste:

1. **`painelDaCarteira` baixava a carteira inteira** (`select ltv_cents, visits_count` de TODOS os
   clientes) só para somar no Node e exibir quatro números. Além do desperdício, o teto de 1000
   linhas por `.select()` do PostgREST (TICKET-036) faria ticket médio e taxa de retorno saírem
   **errados em silêncio** a partir do milésimo cliente. Virou a view `v_carteira_resumo`
   (migration 0018), que agrega no banco e devolve uma linha. `security_invoker = true`
   obrigatório — sem ele a view roda com o dono e entrega o resumo de todos os tenants
   (armadilha do CLAUDE.md; conferido depois no `pg_class` que as quatro views do schema têm a
   opção).
2. **`publicoDaCampanha` mandava todos os ids num `.in()` só.** Com algumas centenas de uuids a
   URL estoura o limite do PostgREST — defeito nº 9 já pago nesta base. Passou a filtrar em
   lotes de 200. A ordenação saiu do banco e foi para o Node de propósito: com o filtro
   quebrado em lotes, cada consulta só ordenaria o próprio pedaço e a lista final sairia
   embaralhada entre lotes.
3. **Zero teste para todo o CRM**, contra a regra do próprio projeto ("teste novo para o caminho
   feliz e um caminho de erro"). Criados `tests/unit/lib/mensagens.test.ts` (11 casos: primeiro
   nome só, variável sem valor virando vazio em vez de `{{nome}}` cru na cara do cliente, link
   `wa.me` com emoji/quebra de linha, número curto recusado) e `tests/integration/crm.test.ts`
   (9 casos). O mais importante deles é o de opt-out: **`publicoDaCampanha` nunca inclui quem
   pediu para não receber nem quem não deu opt-in de marketing** — é a única garantia entre um
   clique distraído e uma mensagem para quem já mandou parar, e agora está travada por teste.

Um dos testes nasceu inútil e foi refeito: `expect(Array.isArray([])).toBe(true)` não testa nada.
Virou verificação de verdade do `EsquemaCampanha` recusando `clientIds: []`.

2026-08-19 · Buraco achado varrendo a interface como usuário novo, não como autor: **a tela de
cadastro de cliente nunca existiu**. O estado vazio da lista mandava para `/admin/clientes/nova`
e essa rota não existe — ou seja, um salão recém-criado clicava no único botão da tela, no
primeiro minuto de uso, e caía num 404. Pior: com um cliente que fosse na lista, o botão sumia
junto com o estado vazio e não sobrava caminho nenhum para registrar alguém pela interface (só
importando planilha, ou de raspão ao marcar horário). Criada `/admin/clientes/nova` e um botão
permanente no cabeçalho da lista. `marketing_opt_in` nasce **desmarcado**: consentimento é
opt-in de verdade (LGPD), quem marca é quem perguntou ao cliente, nunca o sistema por
conveniência.

As listas de preferência por vertical saíram de dentro da ficha para `src/lib/preferencias.ts` —
a ficha e o cadastro precisam perguntar exatamente as mesmas coisas, e duplicar levaria a um
formulário que grava campo que o outro não mostra. De quebra ganharam as verticais que faltavam
(cílios, sobrancelha, depilação, estética).

Varredura de toque a 390px (checklist do CLAUDE.md, "alvos ≥ 48px"): os botões só de ícone que
eu vinha usando estavam em 44px (`size-11`), e a engrenagem da `Topbar` em 36px (`size-9`) —
todos abaixo do mínimo. Subidos para `size-12` (48px), com o ícone continuando pequeno dentro: o
alvo cresce, o desenho não. Ficaram de fora, de propósito, os chips de filtro de segmento (40px):
o `03-DESIGN-SYSTEM` define chip com altura 32 por especificação, e mudar isso seria alterar a
linguagem visual do projeto por conta própria, não corrigir um defeito. Nenhuma das telas novas
tem rolagem horizontal a 390px.

2026-08-19 · Polimento contra o próprio checklist, achado relendo as telas como quem usa e não
como quem escreveu: (1) a ficha mostrava o `kind` cru da mensagem — o dono lia "campaign" e
"transactional", valor de enum do banco vazando para a interface; ganhou tradução. (2) Os cartões
de segmento da campanha ficavam desabilitados quando o grupo estava vazio, **sem dizer por quê**
— o `03-DESIGN-SYSTEM §4` proíbe exatamente isso; agora a própria linha explica ("Ninguém se
encaixa nesse grupo agora"), com `title` para mouse e leitor de tela, e o hover some junto com a
ação. (3) Se todos os modelos do negócio falarem de data/hora, a seção "O que mandar" da campanha
ficaria vazia e sem explicação, parecendo tela quebrada — ganhou estado vazio com o motivo e
atalho para criar um modelo sem data.

O `seed-demo-barbearia.mjs` passou a montar o payload de cliente por lista explícita de colunas
em vez de desestruturar-para-descartar (`{ __servico, ...c }`), que deixava três variáveis "não
usadas" acusadas pelo lint. E o cabeçalho do script agora documenta o passo que faltava: **depois
de semear é preciso forçar o Motor de Ciclo**, senão `client_cycles` fica vazio (o cron só passa
às 3h no fuso do tenant) e a tela "Recuperar" e o selo de ciclo da ficha nascem vazios.

2026-08-19 · CRM profundo: cadastro/perfil do cliente muito mais rico (pedido do Eduardo,
referências de mercado pesquisadas antes de planejar). Fresha (formulários flexíveis, fotos,
consentimento digital) e Booksy validam o padrão internacional; Trinks — o líder do mercado
brasileiro, com página dedicada a barbearia — validou dois pontos que não estavam no plano
anterior: **fidelidade por pontos** e **clube de assinatura mensal**, ambos padrão do nicho aqui.

**Ligado o que já estava pronto no banco sem tela nenhuma** (mesmo padrão da rodada anterior):
anamnese/ficha de saúde cifrada (TICKET-049), fotos antes/depois (TICKET-052), consentimento
assinado (TICKET-054), pacotes de sessão (TICKET-046) e carteira/fiado (TICKET-047) — todos com
API e RLS testadas, zero UI. Viraram a seção "Saúde e LGPD" (alerta + fotos + termos) e "Pacotes
e carteira" na ficha.

**A ficha de saúde nunca pré-carrega.** Abrir o cofre é ação deliberada que passa por
`GET /vault` com AAL2 (2FA) e fica registrada em `vault_access_log` — carregar o conteúdo junto
com o resto da ficha geraria um acesso registrado a cada visualização da tela, mesmo sem ninguém
pedir para ver. A ficha só recebe o *sinal* de que existe alerta (`alertaDoCliente`, que não abre
nada); o conteúdo só chega ao navegador quando a pessoa toca para abrir.

Migration 0019: seis colunas novas em `clients` (document, gender, address, emergency_contact,
preferred_professional_id, online_booking_blocked — todas opcionais, um salão que só quer nome e
telefone continua funcionando sem preencher nada disso) e quatro tabelas — `client_notes`
(anotação datada, nunca sobrescreve: `clients.notes` era um campo só que se perdia a cada
edição), `loyalty_entries` (livro-razão de pontos, resgate é lançamento negativo com motivo —
nunca UPDATE, regra 11), `subscription_plans` e `client_subscriptions` (índice único parcial
`WHERE status = 'active'` garante no máximo uma assinatura ativa por cliente; cancelar muda
estado e data, nunca apaga, para o histórico de receita continuar explicável).

Cadastro rápido (`/admin/clientes/nova`) deliberadamente **não** ganhou os campos ricos de
perfil — CPF, endereço, contato de emergência ficam só na edição da ficha. Cadastro no balcão
precisa ser rápido; quem preenche o resto faz com calma depois.

`tests/rls/isolation.test.ts`: as 4 tabelas novas com `tenant_id` entraram no seed genérico
(mesma exigência já documentada para `push_subscriptions`/`message_templates` — a suíte descobre
tabela por introspecção e falha se não houver o que "sobrar" no teste de vazamento entre
tenants). `subscription_plans` precisou nascer ANTES da lista simples de seed porque
`client_subscriptions.plan_id` referencia o plano — não dá para entrar como as outras.

**Build travou com o worker do Next crashando** (`exit code 3221226505`, sem relação óbvia com
o código) — processos `node.exe` de sessões anteriores (um com 1,7GB de memória) ainda vivos
disputando recurso no Windows. `taskkill //F //IM node.exe` e build limpo resolveu. Vale
verificar `tasklist` antes de investigar um crash de build "impossível" — mesmo padrão já
registrado para o `.next` corrompido por dev+build simultâneos.

2026-08-19 · CRM inovador sem depender de credencial bloqueada (pedido do Eduardo: "que outras
funcionalidades daria pra ficar um CRM completo e inovador"). Pesquisa de mercado (SalonIQ,
BonusQR, Zenia Partners, thecxlead) confirmou três padrões que ainda não existiam aqui: fidelidade
**automática** (não manual), barra de progresso de gamificação, e "next best action" — um health
score só vale a pena quando dispara uma ação concreta, não como número solto.

**Fidelidade automática por atendimento.** `pontuarAtendimentoConcluido` (`fidelidade.ts`) é
chamada de dentro de `concluirAgendamento`, no mesmo padrão non-blocking do recálculo de ciclo
que já existia ali do lado — bônus nunca pode derrubar a conclusão do atendimento se falhar.
Configurável por `tenants.settings.loyalty` (mesmo namespace-merge de `site.ts`): pontos por real
gasto (0 desliga), bônus de indicação, e o "tamanho da volta" da barra de progresso.

**Bônus de indicação automático nos dois lados.** Quando o indicado (`clients.referred_by`)
conclui a PRIMEIRA visita, padrinho e afilhado ganham pontos ao mesmo tempo — nenhum concorrente
pesquisado faz essa combinação automática. "Primeira visita" é detectado por
`visits_count === 0` no momento da conclusão (o campo só reflete o job diário, então ainda mostra
o número de ANTES desta visita) — testado explicitamente que a segunda visita do mesmo indicado
não repete o bônus.

**Avaliação pós-atendimento sem credencial nenhuma.** WhatsApp/e-mail seguem bloqueados
(TICKET-043), mas o link `/avaliar/[token]` (migration 0020, tabela `client_reviews`) usa o
MESMO mecanismo HMAC do link de confirmação (`token-assinado.ts`) — não abre coluna de token, o
`verificarTokenAssinado` prova a validade sozinho. Ao concluir um atendimento, a tela de agenda
ganha um botão "Pedir avaliação" que abre `api.whatsapp.com/send?text=` **sem número** — o
seletor de contato do próprio WhatsApp, porque a tela de agenda não carrega o telefone da
cliente e não vale a pena buscar só para isso. Responder duas vezes o mesmo link não quebra: a
constraint única em `appointment_id` devolve sucesso com o valor da primeira resposta.

**Central de Ações ("Vale a pena hoje")** na tela mais importante do app: em vez de números soltos,
uma lista do que fazer agora (clientes sumindo → link pra Recuperar, aniversariantes → link pra
Campanha nova, pontos perto do resgate → link pros Clientes), cada item some sozinho quando não
há nada a sugerir. `centralDeAcoes` nunca lança — um resumo de CRM que falhar vira lista vazia,
não pode derrubar a tela "Hoje".

`tests/rls/isolation.test.ts`: `client_reviews` entrou no seed genérico (mesma exigência já
registrada 3x nesta base para tabela nova com `tenant_id`). `tests/integration/crm-inovacoes.test.ts`
novo (7 casos) prova especificamente: pontuação automática calcula certo, `pointsPerReal: 0`
desliga de verdade, bônus de indicação credita os dois lados só uma vez, token forjado é
recusado, e resposta duplicada não quebra. Testado ao vivo em `dom-rocha`: barra de progresso
("Faltam 60 pontos"), Central de Ações com os cartões certos, e uma avaliação real de 5 estrelas
registrada via link público sem sessão nenhuma.

2026-08-19 · O banco de produção tinha 78 tenants e 365 mil clientes — quem é real e quem é
resíduo de teste? · Medido antes de mexer: nenhum tenant tinha mais de 7 dias, 35 tinham mais
de 1.000 clientes (o maior, 10.004), e só 97 dos 351 mil agendamentos vinham da página pública
— sinal de dado de teste de carga, não uso real. Confirmado por nome: 76 dos 78 chamavam-se
"Salão do Ciclo"/"Salão da Importação"/"Salão da Agenda do Dia" (padrão de fixture gerado);
os 2 restantes — `dom-rocha` (46 clientes, 278 agendamentos) e `ruivo-barber` (1 cliente, 2
agendamentos) — bateram com testes manuais reais já registrados nesta base e foram preservados.
Apaguei os 76 · é pré-requisito (`docs/09-PLATAFORMA.md` §1.1/P−1) para o primeiro cliente real
não nascer num banco com dezenas de milhares de clientes fantasma.

2026-08-19 · Apagar um tenant grande (10 mil clientes) travava em `statement timeout` · Causa:
`client_cycles.client_id`, `appointments.client_id` e `clients.referred_by` referenciam outras
tabelas mas só tinham índice composto começando por `tenant_id` (ou nenhum) — o mecanismo de
`ON DELETE CASCADE`/`SET NULL` do Postgres consulta só pela coluna da FK, então cada linha
apagada disparava varredura sequencial de uma tabela com 300k+ linhas. Migration `0021` criou
os três índices simples que faltavam · achado ao executar a limpeza, não planejado — e vale a
pena ter ficado: qualquer exclusão em lote no futuro (LGPD, cancelamento de conta) teria o
mesmo problema.

2026-08-19 · P1 do plano de plataforma tem 5 itens (tokens+merge, regra de copy, G2, G10,
teste-guarda) — dá para fazer tudo numa rodada? · Fiz G2 e G10, que são correções reais e
independentes; deixei o mecanismo de merge de vocabulário e o teste-guarda para quando P2/P3
existir · o guard "nenhuma profissão cravada em src/" só faz sentido depois que o app começa a
renderizar por token em vez de string fixa — escrevê-lo agora reprovaria toda a interface atual,
que ainda é 100% hardcoded de propósito (nada lê `profession_id` em runtime ainda). Forçar isso
nesta rodada seria ou um teste que não protege nada, ou uma reescrita prematura da interface
inteira sem P2 (comportamento por eixo) estar pronto para orientar o que cada tela deveria virar.

2026-08-19 · Ao escrever a migration dos 4 eixos em tenants, professions.inicio='direto' para
as 8 verticais de beleza (seed do P0) parecia sugerir que o app já auto-confirma agendamento pra
elas · Verifiquei o código de ponta a ponta antes de assumir: não existe NENHUM caminho de
auto-confirmação hoje — todo agendamento (público ou do painel) nasce `pending`, e só sai daí
quando a cliente confirma pelo próprio link (redução de falta, TICKET-030) ou a equipe confirma
no painel · `professions.inicio='direto'` é vocabulário para quando esse modo existir de verdade,
registrado assim de propósito — não é bug do seed, mas precisava estar escrito, senão alguém lê a
coluna no futuro e assume um comportamento que não existe. Construir o modo direto de verdade
(bypass de revisão humana) fica em P2b, fase própria — envolve decidir limite de risco/sinal antes
de deixar algo pular a revisão humana, e isso é decisão de produto, não algo a improvisar dentro
de uma migration de coluna.

2026-08-19 · O modo "solicitação" do plano previa construir aviso à equipe do zero · Achado: o
`pending` universal já existia (nada precisou ser construído para isso) — só faltava avisar
alguém. `push_subscriptions` já existia mas só tinha `inscricoesPushDoCliente` (dispositivo de
CLIENTE com conta de staff, caso raro documentado). Criei `inscricoesPushDoTenant` +
`notificarEquipe()` em cima da infraestrutura de push já existente (TICKET-056), sem tabela nova
· Testado ponta a ponta com dispositivo de push morto/inválido: o agendamento nasce normalmente,
o aviso falha em silêncio (mesmo padrão de "credencial de terceiro ausente" já usado 3x no
projeto).

2026-08-19 · P2.5 (endereço do atendimento) devia ser condicionado ao eixo "onde" do tenant
(só mostrar pra quem "vai até o cliente")? · Não — campo sempre opcional pra qualquer tenant ·
nenhum tenant real hoje tem onde='vai_ate' (as 2 profissões ativas são barbearia), então
ramificar a interface por eixo agora seria código sem ninguém pra testar de verdade. Um salão
fixo também atende em domicílio às vezes; o campo "some" da conversa sozinho se ninguém
preencher. Gating por eixo fica pra quando existir tenant de verdade que precise dele.

2026-08-19 · P5.5 (G12) pedia "cancelar e remarcar" pelo link — remarcar de verdade (escolher
novo horário sem sair da página do token) ou reusar a página pública de agendamento? · Reusar:
cancelar libera a vaga e devolve o slug do tenant; a tela mostra um botão "Marcar outro horário"
que leva pra `/[slug]/agendar`, a mesma UI de escolha de horário que já existe e já é testada ·
construir um segundo seletor de horário dentro de uma página sem sessão (autorizada só por
token) duplicaria toda a lógica de disponibilidade/slot que `agendar.tsx` já resolve, por um
ganho pequeno (economizar um clique). O mesmo token HMAC do TICKET-030 (confirmação) autoriza o
cancelamento também — não abriu tabela nova, ele já prova "quem clicou recebeu o link" pra
qualquer ação sobre aquele agendamento específico, não só confirmar.

2026-08-19 · Ao criar tenant_modules (P3), test:rls achou "expected 0 to be greater than 0"
em "delete em tenant_modules não afeta linha do outro tenant" — é falha de segurança de verdade
ou só fixture faltando? · Investigado antes de seguir (regra do loop: nunca pular RLS sem
entender a causa). Não é segurança: o teste genérico de isolamento precisa de uma linha
semeada por tabela pra ter "o que sobrar" depois da tentativa de delete do tenant B — toda
tabela nova com tenant_id precisa dessa linha no array `restantes` de isolation.test.ts
(já documentado ali, mesma exigência que push_subscriptions/message_templates/client_notes
etc. já passaram). Adicionei a linha de seed; 124/124 voltou a passar.

2026-08-19 · "Modo solo" (P3) — construir do zero ou verificar o que já existe? · Verifiquei
antes de escrever código novo: `agenda.tsx` já escondia o filtro de profissional quando
`profissionais.length === 1` (achado, não construído). Só o formulário de novo agendamento
(`agenda/novo/formulario.tsx`) ainda mostrava o Select sempre — corrigido pra seguir o mesmo
padrão. A tela de config de módulos (tenant_modules) e um sweep completo por outras telas de
config/comissão ficaram de fora desta rodada — schema primeiro, como P0/P2.

2026-08-19 · P5 pedia preço/duração pesquisados "que a área reconhece como certo" — de onde
vieram os números, já que não há acesso a pesquisa de campo nesta sessão? · Para barbearia,
reaproveitei o catálogo REAL do tenant dom-rocha (Corte R$45/40min, Corte+barba R$70/1h, etc.),
que é dado de negócio de verdade já cadastrado nesta família de projetos, não inventado · Para
faxina/diarista e eletricista (profissões novas), usei preço/duração plausíveis de mercado
brasileiro urbano com base em conhecimento geral (sem WebSearch disponível nesta sessão) — é
honesto dizer que isso é MELHOR que INSERT solto ("Serviço 1 · 60min · R$100"), mas NÃO é o
mesmo nível de confiança do dom-rocha. Registrado como pendência real: antes de usar faxina/
eletricista pra vender de verdade, os preços merecem confirmação com alguém da área (ver §19).

2026-08-19 · P6 pedia "página pública como mini-site" (§8) — por onde começar, já que §8 lista
várias coisas (avaliações, fotos, "feito com CICLO" condicionado ao plano)? · Comecei pelo que
já tinha dado pronto no banco e zero risco: `client_reviews` existe desde a migration 0020,
tem nota e comentário, e nunca foi lido fora do painel — a página pública prometia "avaliações"
desde que o plano foi escrito e nunca entregou. Implementei isso primeiro (TICKET-066) · dado
parado que já existia é o menor risco possível pra fechar uma lacuna real; fotos e o gate de
plano do watermark exigem decisão de produto/jurídico ou seriam código morto, então ficaram
pra depois (registrado em §19).

2026-08-19 · O rodapé "Feito com CICLO" — amarrar a `tenant.plan === 'gratis'` agora (P6/§13.1)
ou deixar como está? · Deixei como está (sem condição). Cobrança via Asaas está bloqueada
(P11) e todo tenant hoje é gratuito por definição — um `if (plano === 'gratis')` seria uma
ramificação cujo outro lado (`plano === 'pago'`) nunca executa em produção até P11 sair do
papel. Registrar a decisão em vez de escrever esse `if` agora evita código morto sem teste
de verdade por trás.

2026-08-19 · A média de avaliações exibida na página pública deve considerar só as 5 mais
recentes (as que aparecem como card) ou todas? · Todas — a query de `average`/`count` é
separada da query de `recentes` (limit 5, só com comentário). Se a média usasse só a amostra
exibida, ela mentiria pra melhor ou pra pior dependendo de qual fatia de avaliações caiu
dentro do limite de 5, o que é pior que simplesmente não mostrar nota nenhuma.

2026-08-20 · P7 (recorrência de verdade, §12) — feriado/folga do profissional deve
"deslocar" a ocorrência (§12 permite as duas) ou "pular" com aviso? · Pular. Deslocar exige
decidir pra onde (+1 dia? próximo dia útil? e se o novo dia também colidir?) e checar
disponibilidade de novo em cada tentativa — cada regra nova é mais um jeito de a série
surpreender quem não olhou a agenda. Pular é determinístico, sempre visível na resposta da
API (`status: 'pulada_folga'`), e §12 permite explicitamente as duas opções — não é
descumprir o requisito, é escolher o lado mais simples dele. Se um tenant de verdade pedir
deslocamento, vira ticket específico com a regra que ele realmente quer.

2026-08-20 · Uma ocorrência gerada pela série que colide com outro agendamento (corrida ou
conflito real) deve derrubar a criação da série inteira, ou só aquela ocorrência? · Só
aquela ocorrência (`status: 'pulada_conflito'`) — a série continua e planta o resto. Falhar a
série inteira por causa de 1 ocorrência em 8 puniria o profissional por um conflito que não
tem nada a ver com as outras 7 datas, que estão livres. O mesmo raciocínio de "não travar por
causa de uma parte" já apareceu em P5 (migration inteira reverte, mas dentro da aplicação um
erro isolado não devia propagar).

2026-08-20 · Série de recorrência exige cliente já cadastrado (`clientId`) ou aceita
`clientDraft` como o agendamento avulso? · Aceita os dois — `resolverCliente()` (antes
privada em `agendamentos.ts`) foi exportada e reaproveitada em `recorrencia.ts` em vez de
duplicar a lógica de normalização de telefone e busca por telefone existente. Sem isso, a UI
teria que forçar "cadastre a cliente primeiro, depois crie a série", um passo a mais sem
motivo técnico — o fluxo avulso já resolve isso numa etapa só.

2026-08-20 · O horizonte de geração (90 dias, teto de 26 ocorrências por rodada) devia vir
com um cron pra manter séries "sem fim" sempre geradas à frente? · Não nesta rodada — registrado
em §19 como pendência real. Construir fila/cron novo só pra isso, sem nenhum tenant de
verdade usando recorrência ainda, seria infraestrutura especulativa; a série + as primeiras
ocorrências já resolvem o caso de uso principal (agendar HOJE algo que se repete), e estender
o horizonte manualmente (rodar a mesma lógica de novo) é um comando, não um projeto.

2026-08-20 · P8 (orçamento com aprovação por link, §11) — enviar o link por WhatsApp Cloud
API (automatizado, mesmo canal de lembrete/confirmação) ou link manual (`wa.me`, clique do
profissional)? · Link manual. Cloud API exige template pré-aprovado pela Meta Business — não
existe processo nesta sessão pra criar/aprovar um template novo (é aprovação externa, fora do
controle do código), e usar um template genérico já aprovado pra outra finalidade seria burlar
a política do WhatsApp. `wa.me` com texto pré-preenchido é exatamente o padrão já usado no
botão "Falar no WhatsApp" da página pública (`secoes.tsx`) — reaproveitar em vez de inventar
um segundo jeito de "abrir o WhatsApp" no mesmo produto.

2026-08-20 · §11 pede `Referrer-Policy: no-referrer` na rota do orçamento pra o token não
vazar no header ao clicar pelo WhatsApp — vale a pena um override por rota? · Não: o
middleware global (`src/middleware.ts`) já aplica `strict-origin-when-cross-origin` a
**toda** rota, inclusive `/orcamento/[token]`. Esse valor só envia a ORIGEM (esquema+host) em
navegação cross-origin, nunca o path — o token, que vive no path, nunca sai da página nem que
ela tenha um link de saída pra outro domínio. Verificado o comportamento antes de adicionar um
header redundante; as rotas de confirmação/cancelamento (P5.5, TICKET-030/063) já contam com a
mesma proteção sem override nenhum, então tratar orçamento diferente seria inconsistência sem
motivo.

2026-08-20 · A validade TÉCNICA do token HMAC (o prazo em que a assinatura em si continua
válida) devia ser igual à validade de NEGÓCIO do orçamento (`valid_until`, "vale por 15 dias")?
· Não — são independentes de propósito. O token tem 180 dias de validade técnica (generoso);
`valid_until` é decidido pelo profissional por orçamento e checado à parte, em
`orcamentoExpirado()` (core puro). Se as duas fossem a mesma coisa, um orçamento "sem data pra
vencer" (`valid_until = null`, opção que o formulário oferece) precisaria de um token que nunca
expira — HMAC com prazo infinito é ruim de revogar. Separar as duas validades resolve isso: o
token sempre tem um teto técnico razoável, e quem decide "até quando vale de verdade" é sempre
a regra de negócio, nunca a criptografia.

2026-08-20 · Aprovar/recusar pelo link deviam usar `Idempotency-Key` (como as rotas
autenticadas) ou o padrão de idempotência natural das outras rotas públicas? · Padrão natural,
igual a `public/appointments/cancel` e `public/reviews`: clicar duas vezes no mesmo botão
devolve o mesmo resultado (checagem `status === alvo` antes de tentar mudar), sem exigir que o
cliente (sem sessão, só o link) saiba gerar um header de idempotência. `Idempotency-Key` seria
redundante aqui e adicionaria uma dependência que o link em si não tem como cumprir sozinho.

2026-08-20 · P9 (deslocamento avançado, §10) — construir uma versão "fake" de área de
atendimento ou buffer automático só pra marcar a fase como ✅, já que a geocodificação de
verdade está bloqueada por decisão de negócio? · Não. Uma área de atendimento sem coordenada
real (ex.: comparar string de bairro) daria falso positivo/negativo o tempo todo, e um "buffer
automático" sem distância real seria só um número inventado com nome de feature séria — pior
que não ter nada, porque parece funcionar e não funciona. Registrado como bloqueio real em
§15/§19, e a fase virou uma auditoria: o que dá pra entregar SEM a decisão de geocodificação?
Achou duas coisas de verdade (buffer do painel administrativo desligado por engano, link de
mapa nunca construído) — essas entraram no ticket, o resto ficou honestamente bloqueado.

2026-08-20 · Ao auditar P9, achei que `agendamentos.ts` (fluxo manual do painel) nunca lia o
buffer do serviço nas alternativas do 409 — é regressão desta sessão ou já existia? · Já
existia antes desta sessão: `servicoDoTenant` nunca selecionava `buffer_before_min`/
`buffer_after_min`, e `slotsDaJanela` passava `bufferBeforeMin: 0, bufferAfterMin: 0` fixo pro
`availableSlots()`. `public-booking.ts` (o fluxo de cliente agendando sozinha) sempre leu o
buffer corretamente — as duas rotas divergiam silenciosamente desde que o buffer por serviço
foi implementado. Corrigido pra ler o buffer real do serviço nos dois caminhos.

2026-08-20 · O link "abrir no mapa" do endereço do agendamento deve geocodificar o endereço
(lat/lng) antes de linkar, ou mandar o texto puro pro Google Maps decidir? · Texto puro
(`maps.google.com/search/?query=<endereço>`) — o próprio Google Maps já resolve endereço em
texto livre do jeito que uma pessoa digitaria, sem custo de API nem chamada de geocodificação.
Isso é literalmente a diferença entre P2.5 (barato) e P9 (caro) do §10: qualquer coisa que
precise de lat/lng real (calcular distância, ordenar rota, desenhar raio) é P9 e continua
bloqueada; um link que só delega pro app de mapa do celular decidir não precisa de coordenada
nenhuma.

2026-08-20 · P10 (modelos de preço, G5) — antes de desenhar schema novo, os 6 modelos que G5
listava como faltando já estavam TODOS faltando de verdade, ou algum já tinha sido resolvido
sem cruzar com o G5? · Verificado antes de codar: "por orçamento" fechou em P8 (quotes), "por
pacote" e "mensalidade recorrente" já existiam desde a migration `0019` (`packages`/
`client_subscriptions`, um recurso de CRM que ninguém tinha ligado de volta ao G5 no plano).
Só "por hora", "visita + hora" e "diária" restavam de verdade — o schema novo (migration 0029)
cobre só esses 3, em vez de reconstruir algo que já funcionava.

2026-08-20 · O novo `services.pricing_model` deve mudar como o AGENDAMENTO e a COMANDA
calculam o valor final, ou só como o CATÁLOGO anuncia o preço? · Só o catálogo. A cobrança de
verdade (o que entra no caixa) já é flexível desde sempre via `ticket_items`/`quote_items`
(qty × preço unitário livre, editável na hora de fechar) — reescrever o motor de agendamento
pra "saber" cobrar por hora seria duplicar uma capacidade que já existe, só que num lugar
errado. `pricing_model` resolve o problema real do G5 (o catálogo fingindo que R$50 é sempre
"o preço fechado" quando na real é "R$50 a hora"), sem inventar um segundo motor de cobrança.

2026-08-20 · `src/core/pricing/` já existia (só com `.gitkeep`) desde o TICKET-001 — é
coincidência ou o plano original (antes da virada multi-profissão) já sabia que ia precisar
disso? · O `.gitkeep` está lá desde a fundação do repositório (mesmo commit dos primeiros
migrations), então é vaga reservada de propósito — a especificação original da PARTE 1 já
antecipava um módulo de precificação, só nunca chegou a ser construído até agora. Mesmo padrão
do G4 (`appointments.recurrence_id` sem tabela) e de `tenants.cobranca` (coluna sem leitor):
esta base tem um histórico de deixar o andaime pronto e não completar a obra — vale continuar
de olho nisso em fases futuras, não é a primeira vez.

2026-08-20 · `tenants.cobranca` (o eixo de P2, migration `0023` — fixo/hora/visita_hora/
diaria/orcamento_antes/pacote/recorrente) e o novo `services.pricing_model` são a mesma coisa
duplicada? · Não, são níveis diferentes de propósito: `tenants.cobranca` é o eixo do TENANT
(um valor por profissão/negócio, usado pra personalizar vocabulário e — quando algo passar a
lê-lo — o comportamento geral da interface). `services.pricing_model` é por SERVIÇO (um
eletricista pode ter "visita técnica" grátis e "instalação" por hora, no mesmo tenant). Os
dois continuam sem se cruzar por enquanto — `tenants.cobranca` segue órfão (nada lê essa
coluna ainda, registrado desde a auditoria do G4), e isso não faz parte do escopo do P10.

2026-08-20 · P11 (planos e cobrança, §13) — antes de bloquear a fase inteira por causa do
Asaas, existe alguma fatia real que não dependa da credencial? · Sim: `plan_tier` (G9, "os
planos têm nome de beleza" — `studio`/`network`) podia ser corrigido sem tocar em cobrança
nenhuma. Grep confirmou que **nada no código lê `tenants.plan`** — a cobrança nunca foi
construída de verdade, então renomear o enum (`start→gratis`, `studio→profissional`,
`network→avancado`) não tinha nenhum call site pra atualizar. Risco zero, resolve G9 de
verdade, e não finge que resolveu cobrança.

2026-08-20 · `plan_tier` devia virar tabela-catálogo agora, seguindo a "mesma solução do G1"
que o §13 item 3 sugere? · Não. G1 virou catálogo (`professions`) porque já havia conteúdo de
verdade pra catalogar (17 profissões com eixos, serviços, vocabulário). `plan_tier` hoje não
tem NENHUM limite ou preço decidido — construir um catálogo rico de planos sem saber o que
cada tier realmente vai oferecer seria estrutura especulativa, o oposto do que essa sessão
vem evitando desde a auditoria do banco (P−1). Renomear resolve o problema de vocabulário sem
fingir resolver o de cobrança — o catálogo pode vir depois, quando o conteúdo existir.

2026-08-20 · Revisão geral pós-P11 (todas as fases originais do plano resolvidas) — antes de
escrever um plano novo, vale reler §16 (critérios de aceite) contra o estado real do produto?
· Sim, e valeu a pena: achou que P4 (onboarding) nunca tinha sido executado — sumiu da lista
mental de "fases feitas" porque as fases ao redor (P0, P5, P7, P9, P10) todas pareciam
completas e criavam a sensação de "catálogo multi-profissão pronto". Mas nada testava o
CADASTRO em si, e o cadastro continuava só com as 8 verticais de beleza — toda a ampliação de
profissões era, na prática, inacessível pra qualquer pessoa nova. Lição: terminar cada fase
individualmente não garante que a lista inteira foi coberta; vale conferir a lista contra o
plano de execução (§15) inteiro antes de declarar o produto pronto, não só contra a memória do
que já foi feito.

2026-08-20 · `executarOnboarding()` devia trocar `vertical` por `professionId` (quebrando as 38
chamadas existentes, 34 delas em teste) ou ganhar `professionId` como parâmetro opcional
retrocompatível? · Opcional. Trocar o parâmetro obrigatório exigiria editar 34 arquivos de
teste só pra manter o comportamento de sempre — risco desnecessário numa mudança que o produto
real também precisa continuar aceitando (a rota resolve `vertical` a partir da profissão, mas
a função de serviço em si não precisava saber disso). Parâmetro opcional com fallback pro
comportamento anterior é o mesmo princípio que orientou o schema de `EsquemaCriarOrcamento`
(P8) e `EsquemaCriarSerie` (P7) aceitando `clientId` OU `clientDraft`.

2026-08-20 · Profissão legada (barber) escolhida via `professionId` (novo fluxo) devia usar
`apply_profession_pack()` (novo, lendo `profession_services`) ou continuar em
`apply_vertical_pack()` (antigo, lendo `vertical_packs`)? · Continuar no antigo. `barber` tem
catálogo real nos dois lugares agora (P5 populou `profession_services.barber` também), mas
`vertical_packs` é o caminho testado desde o TICKET-004 e as outras 5 verticais com pack real
(nails/lashes/brows/waxing/aesthetics) só existem lá — trocar TODAS as 8 legadas pro RPC novo
de uma vez arriscaria regressão sem necessidade (nail/lashes/etc virariam catálogo vazio, já
que `profession_services` só tem dado rico pra barber entre as 8). A troca de RPC só se aplica
a profissão que não tinha NENHUM caminho de catálogo antes.

2026-08-20 · V1 (verificação estrutural, Gates 0-4) achou `profiles` com 2340 linhas órfãs
(sem `auth.users` correspondente) — apagar direto ou investigar antes? · Investigado antes:
confirmado que nenhuma tabela do produto (memberships, appointments, tickets, quotes, etc.)
referenciava qualquer um dos 2340 ids órfãos. Causa raiz identificada — `profiles` nunca teve
FK pra `auth.users`, então a limpeza de tenants de teste em P−1 (que apagou as contas de auth)
não teve como arrastar os profiles junto. Corrigido com migration `0032`: apaga os órfãos
confirmados e adiciona a FK com `on delete cascade`, travando a causa raiz — não só o sintoma.

2026-08-19 (retroativo, achado em V1) · A limpeza de P−1 devia ter incluído `profiles` desde
o início? · Sim, tecnicamente — mas sem a FK, não havia como o `on delete cascade` do
`auth.users` ter avisado ninguém que `profiles` também precisava de limpeza manual; a ausência
da FK é a causa, não a limpeza incompleta em si. Registrado aqui pra não repetir: qualquer
tabela nova que referencia `auth.users` diretamente (não via `profiles`) merece a mesma
pergunta — "tem FK com cascade, ou vai deixar resíduo na próxima limpeza?".

2026-08-20 · V2 achou MFA obrigatória em 4 rotas sensíveis sem NENHUMA tela de cadastro de
segundo fator — construir a tela agora, no meio da auditoria, ou registrar e seguir? ·
Registrar e seguir. Construir cadastro de TOTP/QR code/gestão de fatores de verdade é recurso
do tamanho de uma fase inteira (P7/P8), não ajuste de auditoria — apressar sob pressão de
"fechar o Gate 5" arriscaria um fluxo de segurança malfeito, que é pior que a lacuna atual (o
cofre de saúde estar inacessível é ruim, mas um MFA malfeito poderia trancar contas de verdade
fora do próprio negócio). Registrado como prioridade máxima do backlog em
docs/10-PROXIMOS-PASSOS.md e docs/09-PLATAFORMA.md §19 — não é esquecimento, é decisão de
escopo explícita: essa lacuna merece ser a próxima fase de CONSTRUÇÃO, com o cuidado que
segurança de verdade pede, não um remendo dentro de uma auditoria.

2026-08-20 · A checagem de Origin (CSRF, Gate 5.1.5) deve travar TODA rota escrita, ou só as
que passam por rota()? · Só as que passam por rota() — mas isso é, na prática, todo o
`/api/v1/*` e `/api/cron/*`, então cobre tudo que precisa. Rotas de cron/webhook não mandam
header Origin (chamada servidor-a-servidor), e a checagem já trata "Origin ausente" como
"passa" de propósito — não seria certo exigir Origin presente, isso quebraria justamente as
chamadas legítimas sem navegador. Só Origin PRESENTE E DIFERENTE do app é bloqueado.

2026-08-20 · V3 (Gate 6, teste ao vivo) achou que a checagem de Origin do V2 quebrava o
agendamento público de verdade em qualquer host diferente do configurado em
NEXT_PUBLIC_APP_URL — comparar contra Host da própria requisição, ou contra uma lista de
domínios permitidos? · Contra o Host da própria requisição (padrão OWASP de "same-origin
check"). Uma lista de domínios permitidos precisaria ser mantida manualmente toda vez que um
novo domínio de preview/staging/custom entrar em cena — o Host da requisição já É a resposta
certa pra "qual domínio o Next está servindo agora", sem precisar de configuração nenhuma.

2026-08-20 · Um fix de segurança (V2, Origin/CSRF) passou em 4 testes unitários E num curl
manual contra produção — como ele ainda quebrou o produto de verdade? · O curl usou
`localhost:3000`, que por coincidência batia com `NEXT_PUBLIC_APP_URL` configurado — nenhum
teste (unitário ou manual) cobriu um HOST DIFERENTE do configurado, que é exatamente o cenário
real de qualquer preview/staging/deploy alternativo. Lição registrada: verificação de
segurança precisa testar o caso onde o ambiente NÃO bate com a configuração esperada, não só o
caminho feliz onde os dois coincidem — é fácil confirmar "funciona" testando só contra o
cenário que já se sabe que vai dar certo.

2026-08-20 · Construir o MFA agora ou terminar V4-V5 do ciclo de verificação primeiro? ·
Construir agora (TICKET-076). O achado de V2 não era polimento — 3 rotas reais
(`data-export`, `erase` LGPD, `vault` de saúde) ficavam permanentemente inacessíveis pra
qualquer conta por falta de UI de cadastro de segundo fator, e mais uma rodada de verificação
só produziria mais achados registrados, não fecharia os que já existiam. Decisão de dev sênior:
parar de descobrir problemas e fechar o mais grave primeiro.

2026-08-20 · Como testar rotas que dependem de `criarClienteDoUsuario()` (cookies via
`next/headers`, só existe dentro de um request real do Next) sem poder chamar a rota direto
num teste de integração comum? · Seguir o padrão já estabelecido em
`tests/unit/server/session.test.ts`: `vi.mock('@/server/db/server-client', ...)` com um cliente
falso expondo só os métodos que a rota usa. Aplicado às 4 rotas de MFA + o novo ramo do login
em `tests/unit/server/mfa.test.ts` (13 casos). Complementado com verificação ao vivo ponta a
ponta contra o Supabase real (tenant descartável, código TOTP calculado de verdade via RFC
6238 num one-liner Node — não tem `otplib`/`speakeasy` no projeto), porque mock nenhum prova
que `challengeAndVerify` de fato eleva a sessão pra `aal2` no mundo real.

2026-08-20 · V4 achou 2 problemas reais (SEO ausente, alvo de toque abaixo do mínimo) — corrigir
na hora ou registrar e continuar? · Corrigir na hora (TICKET-077). Os dois eram baratos (nenhuma
decisão de produto envolvida, só código faltando) e um deles — alvo de toque — é o defeito mais
recorrente da própria família de projetos (7 ocorrências anteriores catalogadas em
DESIGN-E-INTERFACE.md Anexo A), então deixar registrado sem corrigir teria sido inconsistente
com o próprio padrão que a sessão vinha seguindo (S0/S1 corrige na hora, S2/S3 registra).

2026-08-20 · Sitemap dinâmico precisa listar todos os tenants — isso exige service_role
(RLS de `tenants` exige `has_tenant()`, que um gerador de sitemap sem sessão nunca tem). Criar
um novo ponto de acesso service_role só pra isso, ou reusar algo existente? · Reusar
`withNovoTenant()` (já em `with-tenant.ts`, já é o padrão usado por `public-booking.ts` pra
exatamente o mesmo problema — leitura anônima cross-tenant). Não é uma exceção nova à regra 2
do CLAUDE.md, é o mesmo uso sancionado que já existia, aplicado a mais um lugar.

2026-08-20 · V5 achou que a Política de Privacidade/Termos de Uso (Gate 12) tem conteúdo
100% conhecível hoje, mas falta identidade jurídica (razão social, CNPJ, contato do
encarregado) — escrever mesmo assim com placeholder, ou bloquear? · Bloquear e registrar
(não escrever com dado inventado). Publicar um documento legal citando uma empresa que não
existe seria pior do que não publicar nada — mesma categoria de decisão que credencial do
Asaas: não é lacuna técnica, é dado que só o Eduardo tem. Adicionado a §4 de
docs/10-PROXIMOS-PASSOS.md.

2026-08-20 · Ciclo de verificação estrutural (VERIFICACAO-FINAL.md V1-V5) fechado — próxima
iteração continua auditando ou pivota pra construção? · Recomendação registrada: pivotar. A
maioria dos achados de V4/V5 já era S2 (polimento), sinal de retorno decrescente; os gates que
restam (12-14) não são trabalho de engenharia, são decisão de negócio/deploy que só o Eduardo
resolve. Mais uma rodada de auditoria tem menos valor esperado do que construir um item real
do backlog (§3 de docs/10-PROXIMOS-PASSOS.md).

2026-08-20 · Ciclo de verificação fechado (V1-V5) — pivotar pra construção. Qual item do
backlog construir primeiro: tela de séries de recorrência (P7) ou tela de gestão de orçamentos
(P8)? · Orçamentos. Orçamento é visibilidade de receita em risco — sem a tela, o dono não sabe
se está vendendo, só descobre por acidente (link direto ou SQL). Recorrência é utilidade de
bastidor, menos urgente. Maior valor real, não a mais fácil das duas.

2026-08-20 · Ao construir a lista de orçamentos, achei que `/admin/orcamentos/novo` (existe
desde P8/TICKET-068) nunca tinha entrado no mapa de navegação de `navegacao.ts` — beco sem
saída num PWA standalone. Corrigir agora junto com a rota nova, ou registrar separado? ·
Corrigir junto (mesmo commit) — é a mesma categoria de bug que o próprio arquivo existe pra
prevenir, e a lista nova cairia na mesma armadilha sem a regra; separar em dois commits só
fragmentaria o contexto de por que a regra mudou.

2026-08-20 · Depois de fechar orçamentos (TICKET-079), qual a próxima iteração: outro item do
backlog ou verificação de design (§2, nunca rodou dedicada)? · Verificação de design leve.
Várias telas foram construídas rápido sob o loop (recorrência, orçamento, preço, onboarding)
sem o mesmo escrutínio visual que o resto do produto já teve — risco de regressão silenciosa
barato de checar contra o build real antes de acumular mais telas sem revisão.

2026-08-20 · Achado ao medir ao vivo: os botões de profissão do onboarding tinham `h-11` na
classe (44px) mas renderizavam 23px. Causa raiz: flex-shrink comprimindo item flex com altura
explícita dentro de contêiner `flex-col + max-height + overflow-y-auto`. Corrigido com
`shrink-0`. Registrado explicitamente: esta classe de bug é CSS de layout puro — jsdom não
calcula layout, um teste unitário nunca teria pego isso. Só verificação ao vivo contra
navegador de verdade encontra — reforça por que o protocolo desta sessão nunca aceitou "passou
no lint" como prova de UI funcionando.

2026-08-20 · Próximo item do backlog: tela de séries de recorrência ou converter orçamento
aprovado em agendamento? · Séries de recorrência. A conversão de orçamento tem uma decisão de
UX real e ainda em aberto (como escolher data/hora reaproveitando a checagem de disponibilidade
da agenda sem duplicar lógica) — resolver isso a toque de caixa dentro de uma iteração arriscaria
uma decisão de produto malfeita. Séries já tinha o endpoint de cancelar pronto e testado desde
P7; era puramente trabalho de UI, mesmo formato já validado em orçamentos.

2026-08-20 · Copy da descrição de recorrência ("Toda terça" vs. "Terça-feira, toda semana"):
por que dia da semana primeiro, nunca "Todo"/"Toda" antes? · Regra de copy sem concordância
(já estabelecida em P1, docs/09-PLATAFORMA.md §3.2): "sábado"/"domingo" são masculinos, as
demais são femininas via "-feira" — um artigo antes do dia quebraria a concordância pra metade
dos casos. Dia primeiro + cláusula fixa depois evita o problema estruturalmente.

2026-08-20 · Converter orçamento aprovado em agendamento: escolher serviço/data/hora
automaticamente a partir do orçamento, ou só prefiler cliente e deixar o profissional escolher
na tela normal? · Só prefiler cliente. `quote_items` é texto livre (mão de obra + material),
sem `service_id` nenhum por trás — não existe mapeamento correto pra um serviço real do
catálogo. Inventar um (por nome parecido, por preço mais próximo) seria adivinhação disfarçada
de automação, e a tela normal de "novo agendamento" já faz a checagem de disponibilidade de
verdade — duplicar essa lógica só pra "escolher sozinho" não valeria o risco.

2026-08-20 · Auditoria pós-construção: repetir V1-V5 inteiro de novo, ou focar só no que mudou
desde a última auditoria dedicada? · Focar no que mudou — as 3 telas construídas depois de V5
(orçamentos, séries, conversão). Repetir tudo teria retorno decrescente (já confirmado sem
achados novos há duas rodadas); auditar especificamente o código novo contra os mesmos padrões
de defeito já catalogados (toque, overflow, estados de tela) é onde realisticamente haveria algo
para achar — e havia: loading.tsx ausente nas duas telas novas.

2026-08-19 · Interface Parte III (`docs/11-INTERFACE-ESTRUTURA-E-FLUXO.md`), fases E0 e E1.

**E0 — sobra de alvo da Parte I.** `toque-48` usava `inset: -4px 0` + `min-height: 48px`: num
elemento de 16px isso rendia 48px de área **deslocados para baixo**, com metade da área tocável
fora do que a pessoa enxerga. Passou a centralizar (`top: 50%` + `translateY(-50%)`), o que vale
igual para alvo de 16 ou de 40px. Corrigidos: "Cancelar assinatura" (16px, e **destrutivo** —
encerra mensalidade de cliente pagante) e os links de indicados (18px, separados por vírgula
dentro do parágrafo). Os indicados viraram pastilhas de 40px+`toque-48`: nome em link inline não
tem como virar alvo decente. De quebra, "Indicada por" virou "Veio por indicação de" — o mesmo
app é de barbearia e de manicure, e o texto não pode escolher um gênero (Parte II).

**E1 — a ficha em camadas.** Era 2429px numa pilha só (3,0 telas de rolagem), sete blocos de
peso visual idêntico, sem índice. O problema não era quantidade — todo bloco ali é útil — era
**não haver camada**: a ficha responde a três perguntas diferentes ("quem é", "como atender",
"quanto vale") fingindo ser uma. Agora:
- **Camada 1, sem rolar:** nome, telefone, etiquetas, alerta de ciclo e **"Como atender"**. Este
  último subiu do segundo scroll para o topo — é o que a profissional precisa com o cliente na
  cadeira, e estava embaixo de LTV e pontos.
- **Camada 2:** `Segmented` novo com Resumo · Histórico · Fidelidade · Ficha.
- **Camada 3:** `ActionBar` permanente com as duas ações reais (Horário, Mensagem), que eram
  botões no meio da página e sumiam no primeiro rolar.

Medido depois: 995–1279px por aba (1,2–1,6 telas), contra 2429px antes.

**A aba NÃO usa `router.replace`.** Foi a primeira tentativa e está errada aqui: a página é
`force-dynamic`, então trocar de aba viraria ida ao servidor e piscar de tela — sendo que o dado
das quatro abas já veio junto na primeira carga. Ficou `useState` + `history.replaceState`: URL
continua compartilhável e restaurável, sem re-renderizar rota nem empilhar entrada no voltar.
**Regra para a família:** aba dentro de uma tela é troca de camada, não navegação; só vira rota
quando o conteúdo de cada aba for buscado separado.

Dois falsos positivos registrados para não custarem tempo de novo: (1) a ficha aparece
**duplicada no DOM** em dev — a segunda cópia está dentro de `div#S:2[hidden]`, que é o
placeholder de streaming do React, não render duplo; (2) `Segmented` nasceu com um utilitário
`trilho` próprio que era cópia do `scroll-x` que já existia em `globals.css` — removido antes de
commitar, o `scroll-x` já fazia encaixe por item, barra escondida e esmaecimento de borda.

2026-08-19 · Interface Parte III, fases E3 e E2.

**E3 — carregamento nas 18 telas que faltavam.** Só 8 de 27 tinham `loading.tsx`; nas outras o
Next não mostra nada entre o toque e o Server Component terminar, e a tela anterior fica
congelada — no 4G do salão isso lê como travamento. Em vez de 18 esqueletos à mão (que dariam
18 ritmos verticais diferentes, o mesmo problema que o `PageHeader` resolveu), criado
`components/ui/esqueleto-tela.tsx` com quatro peças componíveis (cabeçalho, lista, formulário,
números) e cada `loading.tsx` compõe a **forma real** da sua tela. Esqueleto de forma errada é
pior que nenhum: o conteúdo "pula" quando chega, e o pulo lê como defeito. `admin/page.tsx`
ficou de fora de propósito — é `redirect()` puro, não tem tela para esqueletizar.

**E2 — continuidade de navegação.** `TransicaoDeTela` no layout do admin (não por página: por
página a animação reiniciaria a cada re-render interno — trocar de aba na ficha, filtrar lista —
e a tela piscaria a cada interação). `key={pathname}` é o mecanismo inteiro: o React descarta a
árvore anterior e monta a nova, sem biblioteca nem a API experimental de View Transitions.
O recuo do fundo com sheet aberto saiu de graça: o Radix põe `data-scroll-locked` no `body`
enquanto o diálogo está aberto, o que dá o gancho de CSS sem estado global nem contexto.

**Defeito real encontrado durante a verificação desta fase — regra nova para a família.**
A animação de entrada nasceu com `from { opacity: 0 }` + `fill-mode: both`. Medindo, a tela
apareceu com `opacity: 0` e `currentTime` travado em 0: **enquanto uma animação está "running",
o quadro `from` se aplica, independente de `fill-mode`** — então qualquer situação em que ela
não avança (aba em segundo plano, painel que não compõe quadros) deixa a TELA INTEIRA invisível.
Tirar o `fill-mode` não resolveu, porque o problema é o estado `running`, não o preenchimento.
Resolvido com **piso de opacidade visível** (`from { opacity: 0.45 }`): o pior caso vira
"conteúdo um pouco apagado" em vez de "tela branca", e a diferença entre 0,45 e 0 não é
perceptível numa entrada de 220ms. **Regra:** enfeite nunca pode ter poder de esconder conteúdo
— nenhuma animação decorativa deve ter `opacity: 0` num quadro que possa congelar.

Registrado também que `document.hidden` no painel do navegador congela animação CSS: se uma
medição acusar elemento preso no estado inicial, checar `document.hidden` antes de caçar bug.

2026-08-19 · Interface Parte III, fases E4 e E5 — fim do plano.

**E4 já estava pronta.** A varredura encontrou um único `overflow-x-auto` solto no app, e é a
tabela de prévia da importação de clientes — onde está **certo** assim: `scroll-x` usa
`display: flex` e quebraria a tabela. Os filtros e a faixa de 14 dias do agendamento público já
passavam por `FilterRow`/`scroll-x` desde a Parte I. Nada a fazer.

**E5 — a coluna lateral no monitor.** Medido: conteúdo de 558px em 1440px, **882px (61%)
desperdiçados**, e a barra inferior comendo 7% da altura sem ganho nenhum (num monitor não
existe polegar para alcançar). A partir de `lg` a barra de abas vira coluna à esquerda de 232px,
com ícone e rótulo lado a lado.

O truque que faz isso caber em poucas linhas: **zerar `--tabbar-h` no `lg`**. Três lugares
dependem desse token por conta própria — folga inferior do conteúdo, `ActionBar` e viewport do
toast — e nenhum precisou conhecer o breakpoint. Foi exatamente para isso que o token nasceu na
Parte I, quando a barra mudou de 82 para 64px e todo `pb-24` solto pelo app ficou errado de uma
vez.

**Erro cometido e corrigido na verificação:** a primeira versão usava
`lg:ml-[var(--sidebar-w)]` na mesma camada do `mx-auto`. Margem explícita de um lado anula o
`auto` do outro, então o conteúdo grudava na coluna com 649px vazios à direita. Resolvido com
duas camadas — a de fora recua (`lg:pl-`), a de dentro centraliza (`mx-auto`).

**Escopo reduzido de propósito.** O documento previa também lista+detalhe em duas colunas no
desktop. Ficou de fora: toca todas as telas de lista, o ganho é especulativo, e o produto é
usado em pé, com uma mão, no celular. A coluna lateral entrega a maior parte do valor da fase
com risco quase zero — é `lg:` puro, e foi confirmado ao vivo que o mobile não mudou (barra
inferior de 64px, zero alvo abaixo do mínimo, zero estouro).

**Resultado da Parte III, medido:** ficha do cliente de 2429px (3,0 telas) para 995–1279px por
camada; 8 → 26 telas com estado de carregamento; nenhum alvo abaixo de 44px; transição de
entrada entre rotas; e o desktop deixou de ser uma tira de celular no meio de um fundo preto.

---

2026-08-21 · Auditoria de produto pedida pelo Eduardo ("transforme o site num produto melhor"):
por onde começar, com o app já auditado três vezes (Partes I-III de interface, V1-V5
estruturais)? · Auditei o que essas rodadas **não** cobriam: o funil público, a porta de entrada
do produto e o casamento entre back-end pronto e interface ausente · as rodadas anteriores
olharam execução, identidade e estrutura da interface existente; nenhuma perguntou "o que o
servidor já sabe fazer e a pessoa não tem como pedir?". Foi essa pergunta que rendeu quase todos
os achados desta rodada.

2026-08-21 · A recuperação de senha tinha rota (`/auth/password/forgot|reset`, TICKET-009) e
nenhuma tela; `robots.ts` já bloqueava `/nova-senha`, rota inexistente · Criadas
`/recuperar-senha` e `/nova-senha`, com o link do e-mail passando por `/auth/callback?next=` ·
o `code` do PKCE só vira sessão num Route Handler (Server Component não grava cookie), então o
callback que já existia é o único lugar onde a troca pode acontecer; `next` é restrito a caminho
interno para a rota não virar redirecionamento aberto. Sem isso, esquecer a senha era perder a
conta para sempre.

2026-08-21 · `apply_vertical_pack` semeia produto com estoque 0 e ponto de pedido > 0, e
`precisaRecomprar` alerta com `estoque <= ponto` — toda conta nova abria "Hoje" com meia dúzia de
avisos de recompra impossíveis de resolver (não existia tela de estoque) · `listarAlertasDeEstoque`
só alerta produto que o salão acompanha de fato (tem estoque, consumiu nos últimos 30 dias, ou já
teve algum movimento), e `/admin/estoque` passa a existir · alarme que ninguém consegue apagar
ensina a ignorar todos os outros, inclusive os que importam. A alternativa (calar o alerta e
pronto) deixaria o estoque sendo só um número que desce; a alternativa oposta (só criar a tela)
manteria o ruído para quem nunca vai usar controle de estoque.

2026-08-21 · Caixa (`services/caixa.ts` + duas rotas, TICKET-047) e extrato de comissão
(TICKET-046) existiam sem tela nenhuma, com `src/app/admin/caixa/` vazia no repositório ·
Construída `/admin/caixa` com dia na URL, resumo do mês e comissão por profissional · é o ritual
diário de quem tem salão e era a única pergunta do produto que só o banco respondia.

2026-08-21 · "Faturado hoje" (soma de atendimentos concluídos) e o caixa (soma de comandas
fechadas) dão números diferentes, e agora um leva ao outro · Mantidas as duas fontes, e o caixa
zerado com atendimento no dia explica a diferença em vez de mostrar R$ 0,00 sem motivo · §5.7 é
explícito: receita é o que passou pela comanda. Igualar as duas fontes quebraria material, taxa e
comissão, que só a comanda conhece.

2026-08-21 · O trilho de dias do agendamento público oferecia os 14 dias como se todos fossem
iguais, e montava as datas em UTC · Dia fechado ganha marca visual e rótulo no leitor de tela
(mas continua clicável), a tela abre no próximo dia em que o salão realmente atende, e as datas
passam a ser calculadas no fuso do salão · quem entrava numa sexta às 21h via "Sem horários
livres nesse dia" como primeira impressão, que lê como "está lotado". Continua clicável porque a
agenda de um profissional pode fugir do expediente padrão do negócio — esconder o dia esconderia
horário que existe.

2026-08-21 · `/` era um splash com uma frase e dois botões; construir uma landing exige preço, e
preço é decisão do Eduardo (`10-PROXIMOS-PASSOS` §4) · Landing completa, sem seção de preço,
sem depoimento e sem logotipo de cliente · o que falta decidir é o preço, não a explicação do
produto; inventar número, prova social ou identidade jurídica seria mentira logo na primeira
tela. O botão "Ver um salão de exemplo" aponta para `/dom-rocha`, que é prova de verdade.

2026-08-21 · "Valor parado" na tela de recuperar receita mostrava `preço × chance de retorno`
(R$ 5,40 para uma cliente de corte de R$ 45) sem nenhuma explicação · Rótulo virou "Dá para
recuperar" e a tela explica a conta · o número está certo por §5.3 e é ele que ordena a lista
pela prioridade correta; o defeito era só ninguém ter como entendê-lo.

2026-08-21 · Export e eliminação LGPD (TICKET-054) tinham rota e nenhuma porta na interface ·
Ações na aba "Ficha" da cliente, com o erro `MFA_REQUIRED` virando caminho para Configurações ·
Segurança · quem responde ao pedido de uma titular é o salão, não o programador. O arquivo é
montado no navegador a partir da resposta porque o endereço do export é dado pessoal numa URL, e
URL vai para histórico, log e Referer.

2026-08-21 · A central de ações nascia vazia numa conta nova (sem cliente não há ciclo, nem
aniversariante, nem pontos), então a tela principal do produto abria muda logo depois do
onboarding · `centralDeAcoes` passa a devolver `{ titulo, acoes }` e, quando o tenant não tem
nenhum cliente E nenhum agendamento, entrega três primeiros passos com o título "Primeiros
passos" · o teste de "conta que ainda não começou" precisa dos dois zerados: quem só recebe
agendamento online tem cliente criado pela própria reserva, então cliente=0 sozinho marcaria como
"nova" uma conta que já está rodando.

2026-08-21 · O item P3 #16 do relatório (`/admin/campanhas` e `/admin/comanda/*` sem
`loading.tsx`) era herdado da nota do TICKET-083 · Varredura mostrou que a Parte III já cobriu as
duas; o item foi marcado como falso no próprio relatório em vez de removido · relatório que
esconde o próprio erro vale menos que relatório com o erro anotado.

2026-08-21 · `/sitemap.xml` saía estático no build, congelando a lista de salões no momento do
deploy — e aqui o deploy é manual e esparso, então um salão novo podia ficar semanas fora do
sitemap · `export const revalidate = 3600` · uma hora mantém a consulta longe de cada visita de
crawler sem congelar a lista. Nota de método: minha primeira leitura da tabela de rotas disse
"zero rotas estáticas" porque a janela do `sed` cortava antes das últimas linhas — a checagem
correta não é a contagem total, é conferir que nenhuma página de `admin/`, `(auth)/` ou
`(public)/` aparece como `○`.

2026-08-22 · Revisão adversarial do próprio diff achou redirecionamento aberto no `next` que EU
tinha adicionado em `/auth/callback`: `/\evil.com` começa com `/`, não começa com `//`, passa
pela checagem ingênua — e `new URL()` resolve a barra invertida como barra, devolvendo
`https://evil.com/` · Trocado por lista fechada de destinos (`src/server/auth/destino.ts`) com
teste · validar caminho é fácil de errar e `next` chega por link de e-mail, que é o canal de quem
quer usar o domínio do CICLO como trampolim. Como só existe um destino de verdade
(`/nova-senha`), a lista custa nada. **Vale pra família inteira:** nenhum parâmetro de
redirecionamento deve ser validado por prefixo — ou é lista fechada, ou não existe.

2026-08-22 · Deploy de produção depois da auditoria (`vercel --prod`, alias `ciclo-umber.vercel.app`,
build 1m) · Conferido ao vivo em produção antes de declarar pronto: as 11 rotas principais
respondem (públicas 200, `/admin/*` 307 para `/entrar?proximo=`, `/dev/ui` 404), `?next=/\evil.com`
e `//evil.com` caem em `/onboarding`, os cinco cabeçalhos de segurança vêm com nonce por
requisição, o `<script ld+json>` sai sem nonce, o sitemap lista os dois salões, e o console da
página de agendamento e da landing fica limpo — zero erro de hidratação, zero violação de CSP.
O trilho de dias abriu no sábado (dia útil corrente) com 4 dias fechados marcados e horários
carregados de verdade contra o banco de produção.

2026-08-22 · Aviso do linter do Supabase que continua aberto e **não** foi mexido:
`auth_leaked_password_protection` desligado (checagem de senha vazada contra o HaveIBeenPwned no
próprio Auth) · é um botão no painel, e ligar mexe no fluxo de cadastro de quem já usa · fica
para o Eduardo decidir. Os demais avisos são conhecidos e corretos: RLS sem política nas 4
tabelas de infraestrutura (só `service_role` toca), extensões no schema público, e as quatro
funções `SECURITY DEFINER` que **precisam** continuar executáveis porque a RLS as chama.

2026-08-22 · **Achado grave, conferido em produção: a configuração de Auth do projeto na nuvem
ainda aponta inteira para `localhost`.** Sondado com `GET /auth/v1/verify?token=x&type=recovery&
redirect_to=…` (read-only, não dispara e-mail nenhum: com token inválido o GoTrue redireciona
para o destino **se ele for permitido**, e cai no Site URL se não for). Resultado:
`http://localhost:3000/auth/callback` é preservado; **todo** destino
`https://ciclo-umber.vercel.app/...` cai em `http://localhost:3000/`. Ou seja, o Site URL do
projeto continua `http://localhost:3000` e a produção não está na lista de Redirect URLs ·
Consequência: e-mail de confirmação de cadastro **e** o link de recuperação de senha (TICKET-084)
chegam apontando para localhost — ninguém consegue confirmar conta nem trocar senha em produção.
O código está certo (`emailRedirectTo`/`redirectTo` usam `NEXT_PUBLIC_APP_URL`, que na Vercel é a
URL de produção); o que falta é config de painel, que não dá para mudar por MCP nem por CLI sem
token de gestão · Registrado como pendência do Eduardo, com os valores exatos, em vez de ficar
"a conferir": Site URL `https://ciclo-umber.vercel.app` e Redirect URLs incluindo
`https://ciclo-umber.vercel.app/**` (mantendo `http://localhost:3000/**` para o desenvolvimento).
**Explica a nota antiga** de que o clique no link de confirmação nunca tinha sido testado de
verdade — não era falta de teste, era config quebrada desde o primeiro deploy.

2026-08-22 · Eduardo corrigiu Site URL e Redirect URLs no painel do Supabase (Authentication →
URL Configuration) · Reconferido com a mesma sonda: `https://ciclo-umber.vercel.app`,
`.../auth/callback` e `.../auth/callback?next=/nova-senha` agora são preservados pelo GoTrue —
os três deixaram de cair em localhost. Bloqueio de e-mail de confirmação e recuperação de senha
em produção, **resolvido**.

2026-08-22 · Execução do plano de docs/13-CAUSA-RAIZ-LAYOUT-LEGADO.md (T1-T7): o dono escolhe a
cor do site (decisão do Eduardo, confirmada antes de começar) · T3 implementado assim: campo de
cor em `/admin/config/negocio`, guardado em `tenants.settings.site.accent`, sem escolha cai em
osso · `vertical_packs.accent_color` (T3/§7): coluna virou nullable e os 6 valores foram zerados
via migration 0033, aplicada no banco de verdade (idempotente, reversível — rollback documentado
no próprio arquivo). A coluna **não foi removida** de propósito: `vertical_packs` continua
existindo para semear serviço/produto, e apagar coluna é passo mais caro que só vale a pena depois
que o Eduardo confirmar em produção que o cache antigo (`ciclo-v2`) sumiu dos aparelhos reais —
isso este ambiente não consegue verificar.

2026-08-22 · R3 (`professionals.color` gravado, nunca lido) — usar na agenda (feature nova) ou
remover (mudança maior, decisão de produto)? · Nenhum dos dois: corrigida só a causa do roxo
(paleta sem purple, sem pré-seleção — CORES[0] deixou de ser aplicado por default), a
funcionalidade em si (ligar a cor à agenda, ou apagar o campo) fica em aberto · a sessão tinha
escopo de corrigir a regressão do layout, não de desenhar feature nova de agenda nem de decidir
remoção de dado que pode voltar a ter uso. Registrado para não se perder: hoje o campo é
puramente decorativo e nenhuma tela lê `professionals.color` além do próprio formulário que grava.

2026-08-22 · T6 (Cache-Control explícito em `/admin/*`) medido ao vivo: em página já dinâmica
(`force-dynamic`/`cookies()`), o próprio Next sobrescreve com o `no-store` dele — meu header some
do resultado final, mas o efeito prático (nunca cachear) já estava garantido por outro caminho.
Onde o header do middleware realmente aparece é no redirect de "sem sessão" (gerado só pelo
middleware, sem passar pelo pipeline de página) e serve de rede de segurança para qualquer tela
futura sob `/admin/*` que algum dia esqueça `force-dynamic` e vire candidata a página estática —
exatamente o tipo de esquecimento que causou o bug do roxo.

2026-08-23 · Deploy de produção depois da auditoria de design/UX e do adendo do Motor de Ciclo
(`vercel --prod`, alias `ciclo-umber.vercel.app`) · Conferido ao vivo: `/` responde, `/admin/hoje`
redireciona para `/entrar` sem sessão, `/dom-rocha/agendar` mostra 42 horários sem duplicata
(TICKET-109), títulos de aba corretos em `/entrar`, `/avaliar/[token]` e `/dom-rocha/agendar`
(TICKET-101/111), zero erro no console em todas as páginas conferidas. 19 tickets no ar:
TICKET-101 a TICKET-113.

2026-08-24 · Renomear `plan_tier`: `pro`→`essencial`, `profissional`→`equipe` (migration 0040) ·
A 0030 deixou 'pro' de pé por já ser neutro e criou um efeito colateral que só apareceu ao
desenhar a tabela de preço: dois rótulos sinônimos ('Pro' e 'Profissional') disputando o mesmo
significado, impossíveis de explicar num site. Conferido antes: nenhuma linha lê `tenants.plan`
(só o types.gen.ts, gerado) e os 8 tenants de produção estão todos em 'gratis' — troca de rótulo
pura. Depois de existir pagante isso vira migração de dado de assinatura.

2026-08-24 · Catálogo `modules` com FK a partir de `tenant_modules.modulo` (migration 0041) ·
A coluna nasceu `text` sem check nem referência na 0025. Vira a resposta de "o que este plano
libera", e sem restrição um erro de digitação cria módulo fantasma que nenhuma query acusa.
A coluna `modules.eixo` existe para separar as duas razões de um módulo estar desligado:
EIXO (não faz sentido, some) antes de PLANO (não liberado, bloqueia com motivo). Nenhum
mapeamento plano→módulo foi gravado em migration: os limites ainda são suposição.

2026-08-24 · Limites do plano grátis implementados como 1 profissional / 50 clientes em
`src/core/billing/planos.ts`, seguindo a tabela D.3 do plano de monetização · PENDÊNCIA ABERTA:
a própria auditoria do plano (Fase K) achou que `dom-rocha` tem 3 profissionais e 46 clientes,
ou seja, o tenant de demonstração do produto não caberia no grátis que o documento propõe, e
está a 4 clientes do teto. A recomendação de revisar para 2 profissionais está registrada no
plano e NÃO foi aplicada aqui — implementei a tabela publicada, não a sugestão de revisão, para
o código e o documento não divergirem. Decidir junto com o preço.

2026-08-24 · Cron por GitHub Actions (`.github/workflows/cron.yml`), não por Vercel Cron ·
Existiam 6 rotas de cron construídas e `vercel.json` com `crons: []` — nenhuma jamais rodou,
incluindo `recompute-cycles`, que é o Motor de Ciclo. Vercel Hobby trava em 1 execução por dia
(o limite de 100 jobs/projeto de jan/2026 é de quantidade, não de frequência); Vercel Pro custa
US$ 20/mês, que no unit economics da Fase F são 2,4 assinantes só para pagar o agendador.
Agendados apenas `recompute-cycles` e `segments`, que só calculam e gravam no próprio banco.
`reminders` e `campaigns` ficaram FORA do agendamento de propósito: mandam mensagem para cliente
final de verdade e `dom-rocha` tem 46 clientes em produção. Ligar isso não é decisão de YAML.

2026-08-24 · `tests/unit/design/titulos-de-tela.test.ts`: regex do título passou a ser preguiçosa
(`[^}]*?` no lugar de `[^}]*`) · Com quantificador guloso a busca ia até o ÚLTIMO `title:` antes
da primeira `}`, o que numa página com `openGraph` capturava o título social em vez do título do
documento — e reprovava por "repete a marca" um título de tela que estava correto. Achado ao
criar `/precos`, a primeira página do projeto com openGraph e título próprio. Corrigido o guarda
em vez de contornar na página: a intenção do teste continua valendo e o defeito atingiria
qualquer página futura com Open Graph.

2026-08-24 · Página `/precos` não tem botão de assinar · A cobrança automática não existe
(regra 5.4: não fingir que integração de pagamento está pronta). Todos os CTA levam a `/cadastro`
e a pergunta "Como eu pago hoje?" responde em texto que a cobrança é combinada direto. Preferido
a um botão que não funciona ou a um "assine agora" que abre formulário morto.

2026-08-24 · ⚠️ ACHADO: `.env.local` aponta para o Supabase de PRODUÇÃO
(`sukloaoodpxjukngyojo`), então `pnpm test:integration` e `pnpm test:rls` criam tenant e usuário
de auth na base real · É a origem dos 5 tenants órfãos (`health-*`, `alertas-estoque-*`,
`recuperar-*`, `clientes-*`, `risco-*`) que a auditoria do plano de monetização encontrou e
atribuiu a "suíte que falhou antes do afterAll limpar" — a causa é mais estrutural que isso.
Por causa disso, a cobertura do limite de plano foi feita em `tests/unit/server/` com cliente
falso, e não em `tests/integration/`: um teste de limite precisaria escrever em `tenants.plan`
de produção. NÃO corrigido nesta rodada (mexer no ambiente de teste é mudança de infraestrutura,
não de monetização), mas registrado porque decide onde teste novo pode morar.

2026-08-24 · `exigirLimite` vem ANTES de `comIdempotencia` na rota de profissionais · Repetir uma
requisição que já era proibida tem que continuar proibida. Se a idempotência viesse primeiro, uma
chave reaproveitada devolveria o resultado guardado de uma tentativa anterior e passaria por cima
do teto do plano.

2026-08-24 · `normalizarPlano` traduz `pro`/`profissional` e cai para `gratis` no desconhecido ·
Código e migration não sobem no mesmo instante; entre o deploy e o `db push` o banco ainda
responde os nomes anteriores à 0040, e `PLANOS['pro']` seria `undefined` — crash em vez de
bloqueio. Valor desconhecido cai para o degrau MAIS restrito porque errar para menos bloqueia uma
ação (a pessoa reclama e se corrige) e errar para mais libera o que não foi pago (silencioso).

2026-08-24 · Envio em lote do Motor de Ciclo trava em `items.length > 1`, não em "enviar" ·
§D.2: o grátis mostra quem sumiu e quanto vale; o que ele não dá é a alavanca de chamar todo mundo
de uma vez. Mandar uma de cada vez continua livre para sempre, e é o caminho que a própria tela de
bloqueio oferece. Trava no servidor porque sumir com o botão não impede montar a requisição na mão.

2026-08-24 · `BloqueioPlano` adicionado à vitrine `/dev/ui` · Duas variantes (com e sem
evidência) porque a diferença entre elas é o argumento do §M.1. A vitrine pagou o custo dela na
mesma sessão: expôs dois defeitos reais do componente — a frase duplicada "de uma vez de uma vez"
(o molde completava o que a prop já dizia) e `aria-labelledby` com id fixo, que duplicava id com
duas instâncias na mesma página.

2026-08-24 · Selo "Feito com CICLO" passa a ser condicional: sai no primeiro degrau pago ·
§D.3/G.1 do plano de monetização. Era incondicional por decisão consciente (P6), tomada quando
cobrança estava bloqueada. Agora é o benefício mais concreto do Essencial — e é receita trocada
por distribuição, com a troca sendo consciente: cada página com selo é impressão para o próximo
profissional, e é o único canal de aquisição gratuito do produto. Todo cliente que converte apaga
uma peça de distribuição; o laço se autolimita conforme o negócio dá certo. Decidido no SERVIDOR e
entregue como booleano `mostrarSelo` — mandar `plan` para a página pública exporia o degrau
comercial de cada salão para qualquer visitante anônimo. O rodapé inteiro desaparece quando o selo
sai, em vez de virar rodapé vazio ocupando altura no celular.

2026-08-24 · ⚠️ TENSÃO REGISTRADA, NÃO RESOLVIDA: o teto de 50 clientes do grátis não bloqueia
nada · §L.1 classifica cliente como limite SUAVE (avisa e deixa passar), porque travar cadastro no
meio de um atendimento é o jeito mais rápido de o salão largar o sistema. A consequência honesta é
que **o teto de 50 clientes hoje é um aviso, não um limite** — quem passar de 50 continua
cadastrando. A tela de clientes diz isso com essas palavras ("Nada foi bloqueado") em vez de
insinuar uma parede que não existe. Se isso deve algum dia virar limite duro é decisão comercial
(Do Eduardo); o que NÃO pode acontecer é o marketing prometer um teto que o código não aplica.
O aviso só aparece a partir de 80% do teto: contador permanente de "42/50" no alto da tela
transforma trabalho normal em ansiedade.

2026-08-24 · Tela "Meu plano" mora em `/admin/config/meu-plano`, NÃO em `/admin/config/planos` ·
`/admin/config/planos` já existe e significa "Fidelidade e assinatura" — o salão vendendo plano
mensal para a CLIENTE dele. É a mesma colisão que a regra 5.6 do prompt de monetização manda
evitar em nome de tabela (`subscription_plans`/`client_subscriptions`), e ela vale igual para o
espaço de URL: duas telas chamadas "planos" com significados opostos é armadilha para quem chegar
depois. No hub de configurações ela ganhou grupo próprio ("Sua conta no CICLO") pelo mesmo motivo
— pendurar em "Receita recorrente", junto de "Fidelidade e assinatura", juntaria exatamente as
duas coisas que a regra manda separar.

2026-08-24 · A tela "Meu plano" não tem botão de assinar nem de cancelar · Regra 5.4: não fingir
que integração de pagamento está pronta. Um botão "cancelar assinatura" que abre formulário morto
é pior que a ausência dele. A Fase K exige que cancelar custe os mesmos toques que assinar — hoje
os dois custam a mesma coisa (uma conversa), o que satisfaz a regra pelo caminho honesto
disponível. Quando a cobrança existir, é nessa tela que ela entra.

2026-08-24 · Item P-B do plano de monetização reescrito (nova seção P.1.1) · O diagnóstico
original estava errado: a Fase K atribuía os 5 tenants órfãos a "suíte que falhou antes do
afterAll limpar". A causa real é `.env.local` apontar para o Supabase de produção, então a suíte
os CRIA na base real toda vez que roda — apagá-los é enxugar gelo. P-B passa a ter dois passos
(apontar teste para banco separado, DEPOIS limpar) e deixa de ser "trivial": vira mudança de
infraestrutura, com o risco do teto de projetos da organização Supabase gratuita. Também
adicionado à auto-auditoria do §R.6, porque é o sétimo caso do mesmo padrão — a primeira versão
do plano errou para o lado otimista, por ausência de dado.

2026-08-24 · As 4 `FEATURE_*` foram aposentadas do `.env.example` (§L.3 do plano de monetização) ·
`FEATURE_AI_RECEPTIONIST`, `FEATURE_CLUB`, `FEATURE_COMMISSION_ADVANCED` e `FEATURE_MULTI_UNIT`
nunca foram lidas por nenhuma linha do projeto — e, sendo variável de ambiente, são GLOBAIS: não
conseguem por natureza ligar funcionalidade por tenant, que é o que um SaaS multi-tenant precisa.
Manter variável que promete controle e não entrega é dívida que engana quem chega depois. Quem
responde "este tenant pode X?" agora é `src/core/billing/planos.ts`. No lugar das quatro linhas
ficou o comentário explicando o motivo, para ninguém recriá-las achando que resolvem algo.
PENDÊNCIA que não é de código: as quatro continuam definidas no Vercel de produção — apagar é ação
no painel. Sem uso não fazem nada, mas sujam a configuração.

2026-08-24 · `tenant_modules` finalmente tem escritor: tela `/admin/config/modulos` + rota
`PATCH /api/v1/tenant/modules` · A tabela existia desde a migration 0025 e ganhou catálogo e FK na
0041, mas nenhuma linha jamais escreveu nela — era metade de um desenho de duas fontes de verdade
com só a metade do plano funcionando. Regra da §L.2 implementada literalmente: **o plano é teto, o
dono só desliga**. Ligar módulo que o plano não libera é recusado no servidor (402), senão
`tenant_modules` viraria uma segunda fonte brigando com `tenants.plan`.

2026-08-24 · Ligar módulo de volta APAGA a linha, em vez de gravar `ligado = true` · Uma linha
`(ligado = true, origem = 'dono')` afirmaria que o dono escolheu ter aquilo. No dia em que ele
caísse de degrau, essa afirmação entraria em conflito com o teto do plano — e o desempate seria
arbitrário. Ausência de linha significa "vale o padrão do plano", que é a única leitura sem
ambiguidade.

2026-08-24 · Catálogo de módulos duplicado de propósito, com teste de vigia · Os 16 módulos
existem em `src/core/billing/planos.ts` (rótulo para a interface, sem ida ao banco) e na migration
0041 (alvo da FK de `tenant_modules.modulo`). São papéis diferentes, mas as listas precisam bater.
`tests/unit/core/modulos-catalogo.test.ts` lê o SQL da migration e compara chaves, ordem e quais
são "sempre ligados" — duplicação vigiada é segura, duplicação silenciosa é a armadilha da §L.6 de
novo. O teste também recusa módulo órfão: se algum não for liberado nem no plano mais alto, é
defeito de empacotamento, não decisão.

2026-08-24 · O hub de configurações passa a esconder item de módulo desligado · A tela de módulos
promete, com essas palavras, que "desligar esconde da interface" — sem o filtro no hub a promessa
seria falsa na primeira vez que alguém desligasse algo. Some o que está `desligado_pelo_dono` ou
fora do eixo; **bloqueado pelo plano continua aparecendo**, porque a regra 5.2 manda mostrar motivo
e caminho, e sumir com o item esconderia o que dá para comprar.

2026-08-24 · Nome e preço dos planos consolidados em `src/core/billing/planos.ts`, com teste que
varre o fonte · Estavam duplicados em cinco arquivos — serviço de planos, tela de bloqueio, "Meu
plano", tela de módulos e a página pública de preço — porque cada tela foi escrita numa rodada
diferente e cada uma redeclarou o que precisava. Fui eu que criei a duplicação, andando rápido; é
a mesma armadilha da §L.6 que eu tinha acabado de documentar. Preço em cinco lugares é preço que
um dia diverge em um deles, e o lugar onde ninguém olha é sempre o errado. Guardado por
`tests/unit/design/preco-em-um-lugar-so.test.ts`, no mesmo padrão de varredura de fonte que o
projeto já usa em `actions-fixadas` e `titulos-de-tela`. Preço em CENTAVOS (regra 3), mesmo sendo
dinheiro que ainda não é cobrado — a hora de acertar a unidade é antes da primeira cobrança.

2026-08-24 · ⚠️ ARMADILHA: `Intl.NumberFormat('pt-BR')` separa "R$" do número com espaço
NÃO-QUEBRÁVEL (U+00A0), não com espaço comum · Descoberto quando o teste acima falhou com o
indecifrável `expected 'R$ 49' to be 'R$ 49'`. Consequência prática, e é séria: **a primeira versão
do guarda passava vazia** — ela procurava no código-fonte a string devolvida pelo formatador
(com NBSP), e nenhum humano digita NBSP à mão, então nunca haveria acerto. Guarda que não pode
falhar não é guarda. A versão final normaliza NBSP para espaço comum antes de comparar. Vale para
qualquer teste futuro que compare texto formatado com texto escrito à mão — o `dinheiro` de
`src/lib/formato.ts` tem o mesmo comportamento.

2026-08-24 · A página de preço para de anunciar "Até 50 clientes" como se fosse parede · O teto de
clientes é SUAVE no código (§L.1: avisa e deixa passar). Uma tabela de preço que diz "até 50" sem
mais nada promete um limite que o produto não tem — e é o tipo de letra miúda ao contrário que
ninguém perdoa depois. Os números passaram a vir de `PLANOS` do core (nunca escritos à mão), e
entrou uma pergunta no FAQ: "E se eu passar de 50 clientes?" → "Você continua cadastrando. O CICLO
avisa quando você chega perto, mas não trava no meio de um atendimento — e nenhuma ficha some. O
limite que vale de verdade no Grátis é o de um profissional." De quebra, o array local de cartões
que se chamava `PLANOS` virou `CARTOES`: colidia com o `PLANOS` do core e era o pior nome dos dois.

2026-08-24 · Os três guardas de duplicação foram verificados por MUTAÇÃO, não por confiança ·
Depois de descobrir que a primeira versão do guarda de preço passava vazia (armadilha do NBSP),
não dava para confiar em guarda que nunca falhou. Cada um foi quebrado de propósito e observado
reprovando: preço escrito à mão numa tela, tabela de nomes redeclarada, e o catálogo de módulos do
core divergindo da migration 0041. Os três reprovaram, e a mensagem nomeia o arquivo culpado.
Guarda que nunca falhou é guarda não testado.

2026-08-24 · ⚠️ AUTOCORREÇÃO: o plano afirmava que `exigirModulo` "existe e está testado". Não
estava · Varredura por exports mortos achou `exigirModulo` com ZERO usos — nem rota, nem teste.
A frase no §L.2.1 era minha e estava errada. Corrigida no documento, e a cobertura foi escrita
(4 casos: liberado, bloqueado pelo plano com 402, fora do eixo com 403 e sem oferta de upgrade,
desligado pelo dono). A função continua sem ser chamada por rota nenhuma de propósito — ligar hoje
tiraria comanda e caixa do `dom-rocha` —, mas agora o passo de ligar é mexer numa linha por rota,
não descobrir o comportamento na hora.

2026-08-24 · Números de limite na cópia passam a vir de `PLANOS` do core · "Até 5 profissionais" e
"Você passou de cinco" estavam escritos à mão em "Meu plano" e na página de preço. Mesma razão do
preço: número de plano escrito à mão é número que um dia diverge do que o código aplica. Ficou de
fora só o "um profissional" da prosa — "1 profissional" lê pior e o valor 1 é o mais estável da
tabela; se um dia mudar, o guarda de preço não pega, então está registrado aqui.

2026-08-24 · `podeUsarModulo` passa a ignorar a escolha do dono em módulo "sempre ligado" · Achado
na varredura: a função respeitava `desligadosPeloDono` sem consultar `sempreLigado`. `definirModulo`
recusa desligar agenda e Motor de Ciclo, mas `tenant_modules.modulo` não tem restrição que impeça
uma linha chegar por outro caminho (seed, correção manual, migration futura) — e nesse caso a
agenda sumiria inteira da interface. O produto desaparecendo por causa de um registro de
configuração. Defesa no core, com teste, e o teste foi verificado por mutação: sem a guarda, ele
reprova.

2026-08-24 · A página de preço deixa de ser prosa solta: cada item de cartão carrega a chave do
módulo/capacidade que o justifica, e um teste confere · `tests/unit/design/precos-nao-promete-demais.test.ts`
verifica três coisas: (1) todo módulo anunciado num degrau é mesmo liberado por ele; (2) nenhum
degrau pago vende como novidade algo que o degrau abaixo já dava; (3) todo degrau pago anuncia ao
menos uma coisa que só ele libera — que é a pergunta da Fase D ("qual dor específica faz alguém
subir daqui?") virando asserção. O cenário impedido é concreto: alguém acrescenta "controle de
estoque" ao Essencial porque soa bem, o cliente paga, descobre que é do Avançado, cancela e conta
para o bairro. Num público que se conhece por ofício, é a forma mais cara de perder cliente de
ticket baixo. Verificado por mutação nas duas direções.

2026-08-24 · Os cartões saíram de `precos/page.tsx` para `precos/cartoes.ts` · O teste precisa
importar os dados, e exportar coisa arbitrária de um arquivo de página do App Router não é padrão
documentado do Next — funciona hoje e uma versão futura pode recusar. Módulo irmão remove o risco
e é a separação idiomática: dado de um lado, renderização do outro.

2026-08-24 · "Meu plano" passa a usar a MESMA lista da página pública de preço · A tela tinha um
`O_QUE_MUDA` próprio, em prosa, descrevendo os mesmos degraus com outras palavras — segunda cópia
das mesmas promessas, e sem nenhuma verificação. Agora as duas leem `src/lib/planos-cartoes.ts`.
Não é economia de linha: **o que a pessoa leu antes de pagar e o que ela vê depois, dentro do app,
precisam ser a mesma frase.** Duas listas com as mesmas promessas escritas de jeitos diferentes é
como se descobre, tarde, que uma das duas mentia. De quebra, "Meu plano" herdou o teste que impede
a página de preço de prometer o que o código não libera.

2026-08-24 · `BloqueioPlano.precisaDo` deixa de aceitar `gratis` no tipo · "Ver o Grátis — R$ 0" é
frase sem sentido numa tela cujo trabalho é oferecer o caminho pago. Na prática o veredito nunca
devolveria `gratis` (todo degrau contém os módulos do grátis, então módulo gratuito nunca fica
bloqueado), mas é mais barato tornar o estado impossível do que confiar nesse raciocínio continuar
verdadeiro depois de alguém mexer no empacotamento. Custo zero: os chamadores passam literais.

2026-08-24 · Desligar módulo já bloqueado pelo plano não grava linha nenhuma · A tela mostra
cadeado, não interruptor, então só a API direta chega nesse caso — e registrar "o dono desligou"
para algo que ele nunca viu é guardar uma decisão que ninguém tomou. Ela morderia no dia do
upgrade: módulo desligado, e nenhuma explicação de quando isso teria acontecido. Não confundir com
a linha legítima: quem desliga ESTANDO no degrau que libera grava normal, e essa preferência
sobrevive a um rebaixamento e ao retorno — que é o comportamento certo. Os dois casos têm teste, e
o no-op foi verificado por mutação.

2026-08-24 · ⚠️ BUG REAL ACHADO NA PENEIRA: `writeAudit` engolia recusa do banco sem nem logar ·
`.insert()` do supabase-js NÃO lança em erro de banco — devolve `{ error }`. O `writeAudit` não
olhava esse retorno, então o `catch` só pegava exceção de rede: qualquer recusa do Postgres (tipo
errado, RLS, constraint) sumia sem deixar nem o alarme que o comentário da própria função promete.
**Trilha de acesso que falha em silêncio é pior que trilha ausente: ninguém sabe que não tem** — e
isso é LGPD, não estética. Corrigido com `if (error) throw error`, teste novo, e verificação por
mutação. Defeito PRÉ-EXISTENTE, não introduzido nesta rodada; achado só porque o defeito abaixo o
acionou.

2026-08-24 · A rota de módulos mandava chave de texto para `audit_log.entity_id`, que é `uuid` ·
`entityId: entrada.modulo` com valor `'campaigns'`. Os tipos gerados dizem `string | null` e não
pegam — o Postgres pegaria, a cada toque no interruptor, e (por causa do defeito acima) em
silêncio absoluto. Removido: qual módulo mudou já está em `after`. Conferidos TODOS os outros 45
chamadores de `writeAudit`: passam `.id` ou `ctx.tenantId`, todos uuid. Este era o único infrator,
então tornar o erro visível não gera ruído novo.

2026-08-24 · `cron.yml`: opção de string vazia no `choice` trocada por sentinela nomeado ·
`options: ['', ...]` renderiza linha em branco no menu e eu não consigo validar aqui como o parser
do GitHub a trata. `os-dois-seguros` custa o mesmo e não deixa dúvida. As condições passaram a usar
`github.event_name` em vez de comparar a entrada com vazio: no evento `schedule` não existe
`inputs`, e depender de como a expressão trata ausente é o tipo de detalhe que só falha em
produção, às 3h da manhã, em silêncio.

2026-08-24 · Varredura completa por escrita supabase-js com `error` ignorado: 8 casos, todos
corrigidos · O defeito do `writeAudit` não estava sozinho. Encontrados varrendo `await db|svc` em
statement solto seguido de insert/update/upsert/delete/rpc. Tratamento por consequência, não em
bloco:
  · **`vault_access_log` ×3** (anamnese, exportação LGPD, mídia) — trilha de acesso a dado de
    saúde. Viraram `registrarAcessoAoCofre()`, que checa o erro e alarma sem derrubar a leitura
    que a pessoa já fez (mesmo contrato do `writeAudit`).
  · **`idempotency.ts` soltar reserva** — falhando calado, a chave ficava presa PARA SEMPRE e a
    pessoa nunca mais repetia a operação com o mesmo `Idempotency-Key` — que é o que a fila
    offline faz ao voltar a ter rede. Trava permanente, sem mensagem. Alarma (não pode estourar:
    o erro original é a causa real e tem que subir).
  · **`idempotency.ts` gravar resposta** — falhando calado, uma repetição não acha o resultado e a
    operação **corre de novo**, que é exatamente o que a idempotência existe para impedir. Esse
    estoura: falhar alto é melhor que cobrar duas vezes.
  · **`onboarding.ts` rollback** — o delete que desfaz o tenant recém-criado. Calado, deixa tenant
    órfão no banco para sempre. Alarma, e o erro original continua sendo o que sobe.
  · **`orcamentos.ts` ×2** — marcar orçamento como vencido. Estoura.

2026-08-24 · O alarme do cofre carrega `tenant_id` e `client_id`, mas NÃO ip nem user-agent · São
identificadores, permitem reconstruir o que ficou sem registro, e não são dado de saúde (regra 9
do CLAUDE.md). IP e user-agent do acessante ficariam num log de erro sem necessidade. Há teste.

2026-08-24 · `scripts/metricas-ativacao.mjs` — as métricas da §O.1 que não precisam de
instrumentação · Ativação, tempo até configurar, tempo até o 1º agendamento, momento "aha"
(agendamento com `origin = 'public_page'`), retenção 30/90d e sinal de churn, tudo derivado de
timestamps que já existem. SÓ LEITURA, e isso não é escrúpulo: o `.env.local` aponta para
produção, então script daqui escreve na base real — um medidor que altera o que mede não é medidor.
O bloco mais importante da saída é o AVISO: quando a mediana de configuração fica abaixo de 1
minuto, é assinatura de base semeada (tenant, serviço e profissional nascem na mesma transação) e
o script diz em letra garrafal que os números NÃO descrevem uso real. Hoje a mediana é 0,01 min —
ler os 100% de ativação como "o onboarding funciona" seria Suposto apresentado como Medido, o
defeito mais grave do §2.4 do prompt.

2026-08-24 · APLICADO EM PRODUÇÃO, com autorização explícita do Eduardo: migrations 0040 e 0041,
e `dom-rocha` → Avançado de cortesia · Ordem do §L.2.1 respeitada: schema, depois dado, depois
enforcement. Estado final conferido: enum = `gratis, essencial, equipe, avancado`; `modules` com
16 linhas (2 sempre ligados, 4 condicionados por eixo); `dom-rocha` em `avancado` com 3
profissionais e 46 clientes; `ruivo-barber` e `lang-barber` em `gratis` com 1 profissional cada,
dentro do teto. Advisors de segurança: `modules` saiu limpa (RLS + política); os avisos restantes
são todos pré-existentes.

2026-08-24 · ⚠️ A migration 0041 quebrou a suíte de RLS, e a culpa era do seed · O seed inseria
`tenant_modules` com `modulo: 'seed_de_teste'` — valor que só passava porque a coluna não tinha
restrição nenhuma. A chave estrangeira nova o rejeitou, e isso é **literalmente o defeito que ela
existe para pegar** (§L.6: módulo fantasma que nunca liga nada e que nenhuma query acusa). O
primeiro a esbarrar na trava foi o próprio teste. Corrigido no seed, com chave real e uma linha
que poderia existir de verdade (`campaigns`, desligado pelo dono). Achado só porque o `pnpm
test:rls` roda inteiro antes de commitar — sozinho, o `test:unit` não teria visto.

2026-08-24 · `exigirModulo` ligado em 4 rotas, e SÓ na escrita · `campaigns` POST, `quotes` POST,
`inventory/entries` POST e `clients/[id]/vault` PUT. Os GET continuam liberados de propósito: a
regra 5.1 é inviolável, e cair de plano limita o que dá para FAZER, nunca esconde o que já existe.
No cofre isso é mais importante ainda — ficha de saúde já preenchida é o tipo de dado que NUNCA
pode sumir por causa de plano. Quem desce de degrau continua abrindo o que registrou (com AAL2 e
trilha, como sempre); o que trava é gravar resposta nova. Leituras de caixa, comissão e trilha do
cofre também ficaram livres pelo mesmo motivo.

2026-08-24 · `types.gen.ts` corrigido À MÃO nos valores de `plan_tier`, e só neles · Depois de
aplicar a 0040 em produção, o arquivo gerado continuava afirmando que existem `pro` e
`profissional` — valores que o banco não tem mais. `pnpm db:types` exige `supabase login` ou
`SUPABASE_ACCESS_TOKEN`, que não dá para fazer daqui. Editei só a renomeação do enum: é exata,
trivial e de risco zero. **NÃO escrevi à mão a tabela `modules`** — nenhuma linha de código a
consulta (a FK é do banco, e o catálogo da interface vive no core), e inventar a forma de um tipo
gerado é como um arquivo gerado começa a mentir. PENDÊNCIA: rodar `pnpm db:types` no próximo
`supabase login` para o arquivo voltar a ser realmente gerado.

2026-08-24 · A flake noturna do `resumo-hoje` foi consertada encolhendo os deslocamentos, não
ancorando · Entre ~22:30 e a meia-noite de São Paulo, TODO push quebrava a CI: o teste marcava um
agendamento a "+90 min de agora", ele nascia amanhã, e `resumoDeHoje` — que filtra pelo dia de
calendário no fuso do tenant — corretamente não o devolvia. O registro anterior recusava consertar,
com um argumento certo: ancorar num ponto fixo (`meioDiaDeHoje`) destruiria a asserção de
futuro/passado contra o agora real, que é o que aqueles casos existem para provar. **O que faltava
era ver a terceira saída.** Os casos não afirmam "+90 minutos"; afirmam "dois futuros, nesta ordem,
e o passado fora". `marcosDeHoje` posiciona marcos pequenos e FIXOS (passado em -35, futuros em +5
e +40) dentro do que resta do dia em TZ, preservando ordem estrita — e pulam, dizendo por quê, quando nem o cenário encolhido
cabe. O caso do alerta é o único que NÃO encolhe: ele prova a fronteira literal de 3 horas, então
encolher o marco de +240 o moveria para dentro da janela e o faria provar o contrário do que
afirma; esse pula. Achado de brinde, e o pior dos cinco: o caso "cancelado não aparece em nenhuma
seção" afirmava que tudo fica VAZIO, então quando o agendamento escorregava para amanhã ele passava
— vazio pelo motivo errado, sem provar nada. Falso verde é pior que flake: flake incomoda, falso
verde tranquiliza. Aritmética conferida em 11 horários ao longo do dia antes de commitar.


2026-08-24 · CORREÇÃO da entrada acima, na mesma noite: encolher proporcionalmente estava errado ·
A primeira versão do conserto reduzia os deslocamentos por um fator — às 23:07, `[30,90]` virava
`[6,18]`. Preservava a ordem e cabia no dia, e a CI recusou com `conflicting key value violates
exclusion constraint "appointments_no_overlap"`: cada agendamento do teste dura 30 minutos, então
dois marcos a 12 minutos de distância se sobrepõem. Ordem certa, cenário impossível — e é a
**primeira armadilha da tabela do CLAUDE.md**. O erro de método vale mais que o de código: eu tinha
conferido a aritmética em 11 horários olhando ordem e "cabe no dia", **sem olhar a invariante do
banco**. Validação que não inclui a invariante do banco não é validação. A versão que ficou usa
marcos fixos e pequenos separados por um passo maior que a duração (`PASSO_MIN = 35 > DURACAO_MIN =
30`), e pula quando nem o cenário mínimo cabe. Reconferido em 96 horários com as três invariantes
juntas — dentro do dia, sem sobrepor, em ordem estrita: zero violações. Efeito colateral honesto:
entre 22:50 e 00:40 os dois casos de ordenação PULAM em vez de rodar, e **verde com skip não é
prova** de que o cenário funciona — provar exige um run em horário em que ele execute.
2026-08-25 · O `schedule` do cron passou de 1 para 5 horários, porque as rotas filtram por HORA
LOCAL do tenant · Achado ao disparar o `cron.yml` pela primeira vez à mão (ele nunca tinha rodado:
entrou em 24/08 às 18h UTC e o `schedule` só fecharia às 06:10 UTC). Os dois jobs voltaram **verdes,
HTTP 200, `tenantsProcessados: 0`** — e zero era o correto naquele instante, porque as rotas só
agem no tenant cuja hora local bate com a delas (`recompute-cycles` às 3h, `segments` às 4h). Esse
desenho pressupunha o cron do Vercel disparando a cada 15 min, que era o plano antigo; o comentário
no topo da rota ainda descreve esse mundo. Com UM disparo diário às 06:10 UTC, `recompute-cycles`
só alcançava UTC-3 e `segments` só alcançaria UTC-2 — Fernando de Noronha, ou seja, ninguém. Como o
fuso do tenant vem do NAVEGADOR no onboarding, quem se cadastrasse em Manaus, Cuiabá ou Rio Branco
nunca teria o Motor de Ciclo recalculado, **e nada apitaria**: 200, zero processados, job verde.
Rodar de hora em hora consertaria e custaria ~43% da cota de Actions do repositório privado; as
cinco horas escolhidas (05–09 UTC) cobrem hora local 3 e 4 nos quatro fusos do Brasil por ~9%. A
proteção que importa não é o YAML, é o teste: `tests/unit/server/cron-cobre-os-fusos.test.ts` lê o
schedule E o filtro dentro de cada rota e confere a cobertura fuso a fuso, além de proibir
`reminders`/`campaigns` dentro de `schedule`. Reprovação verificada contra os três defeitos reais:
voltar ao horário único, mudar a hora dentro da rota, e agendar uma rota que fala com cliente final.

2026-08-25 · Tenant de demonstração sai do sitemap por lista em `core/`, não por coluna no banco ·
O `sitemap.ts` entregava o `dom-rocha` ao buscador como estabelecimento real — e ele é INTEIRAMENTE
fictício (`scripts/seed-demo-barbearia.mjs`: "um tenant fictício"), com o agendamento público
ligado. Dava para achar a barbearia de exemplo numa busca e marcar horário num lugar que não
existe. O desenho durável seria uma coluna `is_demo` em `tenants`, e ela continua sendo o alvo — mas
**migration neste projeto não é aplicada por deploy**: a CI só aplica em banco efêmero e produção é
manual (ver a entrada da 0040). Código consultando coluna inexistente ficaria quebrado no intervalo
entre o deploy e a migration, e o sintoma seria um sitemap VAZIO — pior que o problema original.
Lista pura em `src/core/tenants/demonstracao.ts` funciona no instante em que sobe. Três leitores
usam a mesma regra, e é isso que o teste guarda: o sitemap filtra, o `generateMetadata` marca
`noindex`, e a página mostra um aviso visível — este último é o único que alcança quem abre a URL
direto, por print ou link no WhatsApp, que nem sitemap nem robots protegem. O teste também proíbe
datilografar o slug no código (funciona hoje, some na próxima demonstração semeada) e proíbe
esvaziar a lista. LIMITE CONHECIDO: não cobre os tenants órfãos que as suítes criam na base de
produção, porque nascem com slug aleatório; aquilo é o P-B.1 do 18 §P.1.1 (apontar o teste para
outro projeto Supabase), e continua pendente.

2026-08-25 · Sair da conta com fila offline pendente passa a CONTAR e AVISAR antes de descartar ·
O descarte em si estava certo e continua: num tablet de balcão compartilhado, entregar depois uma
mutação em nome de quem entrar a seguir é pior que perdê-la, e o comentário original já dizia isso.
O que faltava era a pessoa saber. Antes disto, quem marcasse doze atendimentos sem rede e tocasse
"Sair da conta" perdia os doze **sem uma palavra** — a tela só prometia "limpa o que estiver
guardado aqui". Descartar trabalho em silêncio é o defeito que só aparece no dia seguinte, quando o
cliente chega para um horário que não existe. Agora: tenta drenar, RELÊ a fila (é o que de fato não
subiu, seja por estar offline, seja por o envio ter falhado no meio), e se sobrou alguma coisa para
e mostra a quantidade, com duas saídas — "Sair e descartar as N alterações" ou "Continuar na conta",
mais a instrução do que fazer para não perder. Guarda em `tests/unit/shell/sair-da-conta.test.ts`.
⚠️ Nota de método: o teste de mutação pegou um buraco na PRÓPRIA guarda — ela procurava
`drenarFilaPendente` com `indexOf` e casava com a linha de `import` no topo, então passava mesmo se
a contagem voltasse a acontecer antes da drenagem. Corrigido para procurar a CHAMADA
(`await drenarFilaPendente(`). Guarda que nunca foi vista reprovando é guarda que ninguém sabe se
funciona — e desta vez ela estava mesmo cega em um dos três casos.
2026-08-25 · A página de agendamento público prometia confirmação por WhatsApp, e nada chegava ·
Achado rastreando a cadeia inteira, e a promessa era falsa em TRÊS níveis independentes:
(1) `criarAgendamentoPublico` não manda nada para o cliente — só um push para a equipe;
(2) quem mandaria é `identificarLembretesPendentes`, chamada só por `/api/cron/reminders`;
(3) `reminders` está fora do `schedule` de propósito e o WhatsApp não tem credencial — e o
formulário público nem coleta e-mail, então o fallback de `enviarComFallback` também não alcança
ninguém. Nenhum canal chegava a essa pessoa, nunca. Aqui a mentira custa mais caro que na landing:
quem fica mal com um cliente esperando confirmação que não vem não é o CICLO, é o salão que confiou
nele. A copy passa a dizer o que de fato acontece ("Seu pedido chegou e já apareceu para a equipe. A
confirmação vem de quem vai te atender…"), sem prometer canal e mantendo o caminho de saída, porque
tirar promessa falsa não pode virar silêncio sobre o que fazer. A leitura do `cron.yml` saiu de
dentro do teste da home para `tests/helpers/cron.ts`: eram duas cópias, e foi justamente a cópia
que nasceu lendo o arquivo errado (`vercel.json`). ⚠️ Método: das três mutações, UMA passou — a
asserção do caminho de saída procurava `/telefone/` e casava com o RÓTULO DO CAMPO ("Seu telefone
(WhatsApp)"), que está sempre lá. Terceira guarda desta rodada que o teste de mutação flagrou
casando com algo incidental em vez do que importa. Padrão que vale para as próximas: guarda de copy
tem que casar com a FRASE, não com uma palavra que a página contém por outro motivo.

2026-08-25 · A página de agendamento passa a anunciar a mudança de horários para leitor de tela ·
Medido no navegador, não deduzido: clicar num dia trazia DEZ botões de horário para a tela, e
`[aria-live]`/`[role=status]`/`[role=alert]` continuavam em ZERO na página, com o foco parado no
`body`. Dez opções novas apareciam e nada avisava — WCAG 4.1.3 (Status Messages), nível AA, na
página que atende o cliente do salão. A região é `aria-live="polite"` (a pessoa acabou de tocar num
dia e está esperando; interromper não acrescenta) e vive SEMPRE no DOM, mesmo vazia — leitor de tela
precisa observar o nó antes de o texto mudar, e região que nasce junto com o conteúdo costuma não
ser anunciada. É o erro que tornaria o atributo presente e o anúncio inútil, e foi mutado para
confirmar que a guarda pega. O texto sai do MESMO estado que desenha a tela (`slots`), então os dois
não podem divergir — tela mostrando nove horários e leitor dizendo outra coisa seria pior que
silêncio. Verificado no navegador ponta a ponta: ao abrir "9 horários livres em terça-feira, 25 de
agosto", ao clicar "Buscando horários.", depois de carregar o mesmo texto com 9 horários de fato na
tela. O que a auditoria de acessibilidade encontrou de resto está limpo e fica registrado como
verificado: alvos de toque (nenhum abaixo de 44px nas páginas públicas), nome acessível em todos os
controles, hierarquia de títulos, `lang="pt-BR"`, `:focus-visible`, `prefers-reduced-motion`, e o
componente `Input` com `<label htmlFor>`, `aria-invalid`, `aria-describedby` e `role="alert"`.

2026-08-25 · A tela do Motor de Ciclo também não anunciava a troca de filtro · Mesmo defeito do
agendamento público, e aqui dói mais: é o diferencial que sustenta o preço. Trocar o filtro
recarrega a lista E os dois números do topo, sem trocar de rota, e nada avisava. Mesmo padrão:
região `aria-live="polite"` que vive sempre no DOM, com texto saindo do MESMO `lista` que desenha os
StatTiles — número lido diferente do número mostrado seria pior que silêncio. ⚠️ Rigor desigual,
dito na cara: o caso do agendamento foi verificado no navegador ponta a ponta; ESTE não, porque
`/admin` exige sessão e daqui não dá para autenticar sem credencial de produção. O mecanismo é o
mesmo já provado na página pública; o que a guarda cobre aqui é a estrutura, não o comportamento
renderizado. E o teste de mutação achou a QUARTA guarda cega desta auditoria: a asserção recortava
500 caracteres a partir da região e o `{carregando}` do esqueleto logo abaixo caía na janela.
Corolário novo, registrado no docs/21 §3: a regra do recorte vale como a do padrão — delimitar pelo
fim real do elemento, nunca por número de caracteres.

2026-08-25 · A busca de clientes anuncia o resultado e para de engolir a falha · Dois defeitos na
mesma tela. (1) Acessibilidade: a pessoa digita, a lista inteira troca sem trocar de rota, e quem
usa leitor de tela não sabia se achou trinta ou nenhum — é o caso mais clássico da WCAG 4.1.3.
(2) Falha silenciosa, da família do docs/21 §0: as duas buscas usavam `.then().finally()` **sem
`.catch()`**, então a que falhasse deixava a lista ANTERIOR na tela sem sinal nenhum. A pessoa
digitava um nome, via os resultados de antes e concluía que aquele era o resultado — lista errada
com cara de certa é pior que lista vazia. Agora há `catch` nas duas (termo e segmento), aviso
visível com o que fazer, e o anúncio distingue os três estados: buscando, falhou, N encontrados. A
guarda CONTA `.catch(` contra o número de `fetch` para `/api/v1/clients`, em vez de procurar uma
ocorrência — é o que impede consertar metade, e foi o primeiro caso mutado.
2026-08-25 · A tela de erro passa a decidir a saída pelo caminho onde o erro aconteceu · Medido no
navegador quebrando o `fetch` de propósito em `/dom-rocha/agendar`: um único pedido que falha ao
escolher o dia derruba a tela inteira, e `src/app/error.tsx` é o boundary da RAIZ — pega toda rota,
inclusive as públicas. O que o CLIENTE DO SALÃO encontrava era escrito para outra pessoa: "Seus
dados estão salvos" (ele estava escolhendo horário, não salvando nada) e um botão "Ir para Hoje"
apontando para `/admin/hoje`, o painel do profissional, atrás de um login que não é dele. Mesmo
raciocínio do docs/21 sobre a promessa de WhatsApp: na superfície do cliente do tenant o erro custa
mais caro, porque quem fica mal é o salão. Agora a saída depende de `usePathname()`: no painel, "Ir
para Hoje"; numa rota com slug, "Voltar para a página do estabelecimento" (`/{slug}`); no resto, "Ir
para o início". A frase de conforto também virou condicional. ⚠️ Achado de contexto, e vale
registrar: a hipótese inicial era que `await fetch` sem `try/catch` dentro de `useTransition` falharia
em SILÊNCIO. Testado, e é o oposto — no React 19 a Action que rejeita é re-lançada para o error
boundary, então uma piscada de rede derruba a tela toda. Pior que silêncio, e só apareceu porque
quebrei o `fetch` de propósito em vez de deduzir pelo código. Sobra a pergunta maior, NÃO resolvida
aqui: 22 arquivos têm `await fetch` dentro de transição e só 4 têm `try` — cada um deles troca uma
falha de rede transitória por uma tela de erro inteira.

2026-08-25 · O agendamento público trata falha de rede em vez de deixar a tela cair · No React 19,
`await fetch` sem `try/catch` dentro de `useTransition` não falha em silêncio: a Action que rejeita
é RE-LANÇADA para o error boundary, e a tela inteira some. Medido no navegador quebrando o `fetch`
de propósito. Numa rede de subsolo — o cenário declarado do produto — isso acontece por uma piscada,
e leva junto o serviço, o profissional e o dia que a pessoa já tinha escolhido; na confirmação, leva
nome e telefone. Agora as duas chamadas tratam, e o texto distingue falha de REDE (confira a
conexão) de resposta de erro do servidor (repassa o motivo). Na confirmação o texto ainda diz o que
fazer para não marcar duas vezes: o pedido pode ter chegado antes de a resposta se perder. ⚠️ Achado
DENTRO do conserto, e é o mais instrutivo: a primeira versão do catch fazia `setSlots([])`, e com a
lista vazia a região viva passava a anunciar "Sem horários livres nesse dia" — mentira, quando o que
houve foi a rede cair. Podem existir dez horários; ninguém sabe. Afirmar ao leitor de tela o que não
se sabe é o defeito que esta auditoria persegue, cometido dentro da correção dele. Pego na
VERIFICAÇÃO EM NAVEGADOR, não em revisão de código — revisão nenhuma teria olhado o texto da região
viva depois de um catch. Agora, havendo erro, a região de status cala e quem fala é o `role="alert"`.

2026-08-25 · A dívida dos 18 `fetch` sem `try` em transição virou linha de base, não conserto em
massa · O detector preciso (casando chaves do callback, não grep de arquivo) achou 25 callbacks em
18 telas do painel. Consertar as 18 de uma vez seria uma edição mecânica grande em telas que
dependem de sessão e que não consigo abrir no navegador para verificar — trocar um defeito conhecido
por 18 mudanças não verificadas não é progresso. E criar um helper central esbarra na regra do
CLAUDE.md ("nada de utils.ts genérico"). Então: `tests/unit/design/rede-nao-derruba-tela.test.ts`
guarda nos DOIS sentidos — tela nova com o defeito reprova (a dívida para de crescer), e tela já
consertada que continue na lista TAMBÉM reprova (a lista só encolhe, e nunca vira decoração). A
terceira asserção guarda contra o próprio detector: se o regex parar de casar, a lista de
"consertadas" fica cheia e o teste grita, em vez de passar verde vazio — foi a mutação que mais
importou verificar. Caminho para zerar a lista passa por resolver o limite do `apiFetch` (devolve
`{queued}` sem o corpo da resposta), ou por tratar caso a caso com verificação.

2026-08-26 · Auditoria de lançamento (docs/22-23), F2 · `HCAPTCHA_SECRET` aceito ausente por ora,
`UPSTASH_*` reclassificado — não é achado · A hipótese inicial (docs/23 §4) era que as duas
credenciais ausentes eram "mitigação fantasma". Lendo `rate-limit.ts`: sem Upstash, o limitador cai
para o Postgres (`consumir_rate_limit`, `on conflict do update` atômico) — compartilhado entre
instâncias e correto, não uma memória por instância. Só o teto global de 120/min usa memória de
propósito (decisão já documentada no próprio arquivo, para não pagar uma ida ao banco em toda
requisição). **`UPSTASH_*` sai da lista de achados** — degradar para Postgres é o desenho, não uma
falha. `HCAPTCHA_SECRET` é diferente: ausente, a verificação sempre devolve `true` — o booking
público fica sem essa camada. Honeypot e rate limit continuam ativos e não dependem de credencial.
Decisão: aceitar por ora (abrir conta hCaptcha é `[E]`, não bloqueia lançamento com zero tráfego
adversarial observado até hoje), revisitar se o volume de agendamento público crescer ou se
aparecer spam real nos logs. Dono: Eduardo, sem prazo — condicionado a sinal, não a data.

2026-08-26 · Auditoria de lançamento, F5 · `loyalty` e `recurrence` ganharam trava — mas não em
toda rota que o nome sugeria · `POST /api/v1/appointments/series` (criar série) e
`PATCH /api/v1/tenant/loyalty-config` (ligar `pointsPerReal`) receberam `exigirModulo`. A segunda
importa mais do que a primeira: é ali, não em `clients/[id]/loyalty` (lançamento manual), que a
fidelidade automática de verdade é ligada — `pontuarAtendimentoConcluido` roda sozinho em todo
atendimento concluído depois disso, sem passar por rota nenhuma de novo. Travar só o lançamento
manual teria deixado a automação de graça.

Dois casos ficaram **de propósito** fora desta rodada, por serem decisão e não mecânica:

1. **`POST /appointments/series/[id]/cancel`** — cancelar uma série já existente. Gating aqui
   colidiria com a regra 5.1 ("cair de plano nunca esconde o que já existe"): cancelar é encerrar
   algo que já existe, não criar valor novo. Deixar destravado parece certo, mas não foi decidido
   com a mesma régua que decidiu o resto — só não foi mexido.
2. **`POST /api/v1/packages`** (vender pacote) — a cópia de `/precos` anuncia "Recorrência **e
   pacotes**" como um item só do Avançado, mas a rota usa a permissão `comanda:own`, do mesmo
   mundo de `register` (Essencial), não de `recurrence`. Não travei porque a classificação do
   próprio módulo está ambígua no código — decidir isso é escolher se "pacotes" é `recurrence`,
   `register`, ou um módulo próprio, e essa escolha muda a página de preço, não só o servidor.

Nenhum dos dois tenants `gratis` reais usa qualquer um dos dois hoje (medido: zero séries, zero
pacotes) — não há urgência de quebra, só a decisão pendente.

2026-08-26 · F0 (`docs/25-ESTRATEGIA-E-EXECUCAO.md`): a pergunta "dom-rocha é gente real ou
semente?" está fechada, e por dois caminhos que se reforçam · O `docs/20-COPY-PLANO.md` §A.4.1 já
registrava confirmação do Eduardo de que o tenant é inteiramente fictício
(`scripts/seed-demo-barbearia.mjs`), mas essa confirmação não tinha chegado ao `25`, que ainda
tratava a pergunta como aberta — e o próprio `.github/workflows/cron.yml` também a lista como
passo manual pendente antes de agendar `reminders`/`campaigns`. Em vez de rodar a consulta contra
produção para fechar por medição, a exclusão por tenant (item A do F0) tornou a pergunta
estruturalmente irrelevante: `dom-rocha` e `ruivo-barber` agora são pulados DENTRO das próprias
rotas de mensageria (`ehDemonstracao()`, já eram excluídos do sitemap) — nenhum dos dois recebe
WhatsApp/e-mail automático, gente real ou não. Curiosidade residual, não bloqueio: o 46º cliente
de `dom-rocha` não está em nenhum script de seed rastreado (o array `CLIENTES` de
`seed-demo-barbearia.mjs` tem 45 nomes); provavelmente cadastro manual de teste, sem consequência
agora que a exclusão por tenant cobre o caso de qualquer forma.

2026-08-26 · F0, teto diário de mensagem por tenant: 300/dia transacional (`reminder` +
`confirmation` + `transactional`), 100/dia campanha — valor **estimado**, sem uso real para
calibrar ainda · `src/server/services/mensageria.ts`, `dentroDoTetoDiario`. Ajustar depois que
houver volume real de tenant pagante — hoje é freio de segurança, não previsão de tráfego.

2026-08-26 · Programa de indicação (pedido nesta sessão: "quem indica ganha desconto/grátis")
não entra em código agora · Já está inteiramente desenhado em `docs/18-MONETIZACAO-PLANO.md` Fase
H (crédito em `billing_credits`, recompensa só no 1º pagamento do indicado, antifraude, teto de
12 meses/ano) — e o mesmo documento trava a fase atrás de **≥20 pagantes** (linha 1276: "antes
disso é máquina sem combustível"). A base tem zero pagantes hoje. Construir agora contradiria uma
decisão já tomada e é o tipo de trabalho que o red-team do `18` avisa para não fazer cedo demais.
Decisão: registrar como já desenhado, e oferecer a recompensa **à mão** durante o piloto manual
(F3 de `docs/25-ESTRATEGIA-E-EXECUCAO.md`) se/quando fizer sentido comercialmente — sem
`billing_credits`, sem gatilho automático. Fase H entra em código só depois de ≥20 pagantes.

2026-08-26 · F2 (`docs/25-ESTRATEGIA-E-EXECUCAO.md`), ticket 11 — instrumentação de funil de
ativação **não construída nesta execução, de propósito** · O projeto não tem nenhuma infra de
evento/analytics de produto hoje: só Sentry (erro/performance, com `redigirEventoSentry` para
LGPD). `docs/05-FAQ-DEV.md` (J129) e `docs/ESPECIFICACAO-COMPLETA.md` citam "PostHog (funil de
ativação)" como se existisse — é aspiracional, não reflete o repo (confirmado: nenhum pacote de
analytics em `package.json`, nenhuma tabela `funnel_events`/`activation_events` em
`supabase/migrations/`). `scripts/metricas-ativacao.mjs` é o único mecanismo hoje, e é derivado de
timestamps já existentes (sem evento de front), com autodiagnóstico próprio de "isso é base
semeada" quando os números não fazem sentido — já registrado em 2026-08-24 acima. Instrumentar de
verdade exige escolher ferramenta (self-hospedado vs. PostHog/terceiro — implica custo recorrente
e, sob LGPD, um NOVO fluxo de dado de cliente saindo para um processador terceiro) e desenhar o
schema de evento — isso é decisão de arquitetura/vendor do dono do produto, não um ticket para
decidir sozinho dentro de uma sessão de execução. Os tickets 12 e 13 da mesma fase (colocar a
importação no caminho crítico, e a "primeira previsão" calculada com `computeCycle`) não dependem
disso e foram implementados.

2026-08-26 · F1-b (`docs/23` §2.6/§9, `docs/24` §5) · **medido, com os 5 corpos de resposta reais
de hoje** — e confirma exatamente o defeito que a auditoria previu · As 5 execuções agendadas de
hoje (05:46, 07:06, 07:57, 09:00, 09:52 UTC) rodaram **todas antes** do merge do PR #15 (12:58 UTC)
que corrige `recompute-cycles` para janela em vez de igualdade exata. Resultado, lido no corpo, não
na cor do job: `recompute-cycles` devolveu `tenantsProcessados: 0` nas **5 de 5** execuções de
hoje — o Motor de Ciclo não processou nenhum tenant no único dia em que o defeito original (`docs/23`
§2) ainda estava em produção. `segments` (janela mais larga por sorte de desenho, não por correção)
acertou 2 de 5 (11 e 21 tenants). Disparo manual `workflow_dispatch` às 13:15 UTC (depois do merge)
também devolveu 0 — **não é regressão**: a janela de `recompute-cycles` é `[3h, 6h)` local
(`TOLERANCIA_HORAS = 3`, `src/core/cron/janela.ts`), e 13:15 UTC é 10:15 local em UTC-3, fora da
janela por desenho. A validação real da correção só acontece dentro da janela — a próxima chance é
o schedule de amanhã (27/08), agora com o PR #15 já em `main`. Nada a fazer além de deixar o
schedule rodar; registrado aqui para quem checar amanhã não precisar repetir a investigação.

2026-08-26 · F3 (`docs/23` §5, `docs/24` §3) — restauração de backup verificada por decisão do
Eduardo, e a decisão foi **não gastar** · O plano original pedia criar uma branch de teste no
Supabase (`$0,01344/hora`, org Stark Inovações) e usar `restore_project` **só no `project_id` da
branch, nunca no de produção** (`sukloaoodpxjukngyojo`), para comparar contagem de linhas contra
produção. Apresentado o custo, a decisão foi explícita: "não precisa, não quero gastar o CICLO nem
foi lançado ainda". Verificação alternativa sem custo: a API de gestão do Supabase usada aqui não
expõe configuração de backup/PITR diretamente — o fato já registrado em sessão anterior de que o
projeto é **Supabase Pro** (que inclui backup diário por padrão do plano) segue sendo a única
evidência disponível sem custo. Fica `[E]`: se um dia for preciso confirmar retenção/restauração de
verdade, o caminho é o painel do Supabase (Database → Backups) direto, sem precisar de branch paga,
ou aceitar o custo trivial da branch quando fizer sentido gastar.

2026-08-26 · O acento do produto deixa de ser osso e passa a ser o aqua da marca · Decisão do
Eduardo, tomada a partir de uma medição, não de gosto. Depois que o uróboros entrou (PRs #19/#20),
uma varredura de todas as propriedades CSS da landing procurando `#14B8A6`/`#5EEAD4` voltou
**vazia**: o turquesa existia só dentro do PNG do logo. Na prática o produto era osso monocromático
com um símbolo colorido colado por cima — o logo lia como adesivo, não como origem do sistema. As
três saídas oferecidas foram (a) aqua vira a cor específica do Motor de Ciclo, (b) aqua vira o
acento do produto inteiro, (c) assumir o logo como ilha cromática e registrar. Escolhida a (b).
`--acc: #f0ebe3 → #14b8a6`, `--acc-soft` idem. **O que se perde, aceito conscientemente:** osso dava
16,46:1 sobre `--bg` e aqua dá 7,85:1 — continua bem acima do piso de 4,5 do §7, mas acaba o luxo de
"nunca precisar pensar no contraste" que o E0–E6 tinha comprado. Medido depois: o aqua saiu de 0
para 26 usos em CSS na landing, com zero reprovação de contraste. A página pública do salão foi
conferida e **não vaza**: `--acc` lá continua vindo de `tenants.settings.site.accent`, e a marca do
CICLO (`MarcaCiclo`, favicon) segue com o aqua cravado justamente para não vestir a cor do cliente.

2026-08-26 · `--acc-2` é `#99F6E4` e não a menta `#5EEAD4` que veio no arquivo de marca · A menta
era o candidato óbvio (é a variante clara do próprio logo) e passava em todos os testes que
existiam. Medindo antes de aceitar: Δ luminância de **0,037** contra `--ok` (`#90dfba`). As duas são
da família verde, e em daltonismo vermelho-verde (~8% dos homens, público direto de barbearia) link
ativo e selo de sucesso seriam a mesma cor. O bloco de daltonismo do `contraste.test.ts` não pegava
porque só comparava semântico com semântico, e `--acc-2` não é semântico. `#99F6E4` dá Δ0,160,
acima do piso de 0,15 que o resto da paleta respeita. O teste foi **estendido** para comparar
`--acc-2` com `ok/warn/risk/bad`, e a guarda foi vista reprovando (menta reintroduzida derruba
exatamente o par `--acc-2 × --ok`).

2026-08-26 · `/api/health` estava em **503 permanente por desenho**, e isso é o defeito de 25/26
de agosto pelo avesso · Medido na produção às 17:38 (`https://ciclo-umber.vercel.app/api/health`):
`{"ok":false,...,"sendReminders":{"ok":false,"detail":"job \"send_reminders\" sem execução há 454
min (limite 30 min)"},"recomputeCycles":{"ok":false,"detail":"job \"recompute_cycles\" nunca
rodou"}}`. O segundo é verdadeiro e esperado (cura sozinho no schedule de 27/08, `docs/24` §6.6).
O primeiro **nunca ia curar**: `reminders` está fora do `on.schedule` de propósito — quem a liga é
o dono do produto, no passo 4 do F0 (`docs/25`) — então o atraso só cresce, todo dia, para sempre.
O mesmo valeria para `send_campaigns` a partir de amanhã (limiar de 26h, último disparo manual foi
hoje). Ou seja: dois dos seis checks ficariam vermelhos por decisão consciente, e um endpoint que
vive em 503 não distingue mais "desligado de propósito" de "o Motor de Ciclo morreu" — que é
exatamente o sinal que a auditoria de ontem pagou dois dias de silêncio para construir.
**O raciocínio já existia no repositório e não tinha sido aplicado aqui:** o passo 4 do rodapé do
`cron.yml` diz, sobre o step de CI, *"ativá-lo antes faria o Action falhar sempre, porque um
heartbeat que nunca rodou está sempre atrasado por definição"*. Valia igual para o `/api/health`,
que fazia isso desde já. Decisão: **vigilância condicionada ao agendamento real**
(`src/core/cron/agendadas.ts`). Job cuja rota não está no `schedule` volta `ok: true` com o motivo
escrito no corpo (`não está no schedule de .github/workflows/cron.yml — vigilância desligada de
propósito`) em vez de sumir do relatório: a regra da casa é ler o corpo, não a cor, e um check que
desaparece é a mesma ausência silenciosa por outro nome. A vigilância **volta sozinha** no dia em
que a rota entrar no schedule, sem ninguém lembrar de nada.
`ROTAS_AGENDADAS` é uma **cópia** do que está no YAML — o bundle da Vercel não carrega `.github/`,
então o runtime não tem como ler o arquivo de verdade. A cópia é ancorada por
`tests/unit/server/saude-vigia-so-o-que-roda.test.ts`, que reprova nas duas direções (rota
agendada fora da lista, rota da lista fora do schedule), confere `ROTAS_DE_CRON` contra os
diretórios em disco e amarra cada `kind` de heartbeat à rota que o grava. As seis guardas foram
**vistas reprovando** por mutação antes de aceitas (tirar `segments`, incluir `reminders`, esvaziar
a lista, apontar o mapa para a rota errada, sumir com uma rota do disco, e remover a dispensa de
dentro do `health.ts`). O dublê de banco de `motor-de-ciclo-observavel` virou `tests/helpers/saude.ts`
no caminho, porque a segunda cópia dele nasceria aqui — e cópia de dublê foi como a leitura do
`cron.yml` já errou de arquivo uma vez.
**O que NÃO mudou, de propósito:** `checarFila` continua alarmando por job parado há 15 min mesmo
com a rota `jobs` fora do schedule. Fila crescendo é problema real independentemente de quem devia
drená-la — é trabalho enfileirado que não acontece, não um relógio parado.

2026-08-26 · A receita que o dono ia seguir para ligar a campanha estava errada — e nada a testava
porque estava comentada · O rodapé do `cron.yml` (passo 4 do F0) mandava descomentar
`- cron: '0 12 * * *'   # campaigns`. Mas `campaigns` só age no tenant cuja **hora local** é 10, e
12:00 UTC é 10h local **só em UTC-2** — Fernando de Noronha, ou seja, ninguém; com os 36 a 56 min
de atraso medidos do agendador (`docs/24` §6.5), nem lá. Descomentar aquela linha teria ligado a
campanha para zero tenants, com HTTP 200 e job verde: **o mesmo defeito e o mesmo silêncio que o
Motor de Ciclo passou dois dias produzindo**, esperando dentro da única instrução que existe para
ligar a mensageria. Junto veio o defeito irmão: `campaigns` e `stock-alerts` eram as duas rotas que
ainda usavam **igualdade exata** de hora (`horaLocal !== 10`, `!== 7`) — a auditoria do `docs/23`
§2 trocou por janela só as duas que já estavam no `schedule`, e as outras duas ficaram como
armadilha para o dia em que fossem agendadas. Corrigido: as duas passam por `dentroDaJanela`
(`src/core/cron/janela.ts`), a receita do rodapé virou quatro horários (10h local em cada fuso), e
`cron-cobre-os-fusos.test.ts` passou a conferir **as linhas comentadas** pela mesma aritmética das
agendadas — receita errada agora reprova o build antes de alguém segui-la.
**Por que alargar a janela de `campaigns` é seguro** (a pergunta que decide se isso pode ou não):
duas passadas no mesmo dia não mandam duas mensagens. `enviarParaRecuperar` filtra por
`last_campaign_at` + `DIAS_ENTRE_CAMPANHAS` antes de enviar, então a segunda passada devolve
`rate_limited` para quem a primeira já pegou. Em `stock-alerts` o custo de repetir é uma linha de
log — a rota não é fonte da verdade, a tela Hoje calcula o mesmo alerta ao vivo.
`reminders` **não** ganhou janela porque não filtra por hora local nenhuma (ela olha a hora do
agendamento, não a do tenant); por isso a receita dela continua sendo um `*/15` só, e há um teste
que amarra essa justificativa ao código.
Aproveitado no mesmo passo: `cron-cobre-os-fusos.test.ts` tinha a sua **própria cópia** da lista de
rotas agendadas, que virou a terceira depois do `/api/health`. Agora as três leem
`@/core/cron/agendadas`, que é a única ancorada ao YAML nas duas direções.

2026-08-26 · Quando desligar o assistente de IA, se ninguém usar · Regra registrada ANTES de
existir uso para julgá-la: se, passados 30 dias com pelo menos 5 tenants com o módulo `assistant`
liberado, o uso médio ficar abaixo de 1 pergunta por semana por tenant, o assistente é desligado e
o esforço para na Fase A (docs/26-AGENTE-IA-PLANO.md §9). Não é aprovação de feature — é a
condição de parada de um experimento, escrita antes do apego ao trabalho já feito poder distorcer
a decisão. Pendente aprovação do Eduardo (§10 do plano); até lá vale como proposta, não como regra
em vigor. Junto: aprovar o provider (Gemini 2.5 Flash) e confirmar nos termos que dado enviado não
treina modelo — sem isso, mandar pergunta com contexto de cliente para o provedor é exposição de
LGPD que nenhuma minimização de payload cobre sozinha.

2026-08-27 · Lacuna de teste: tabelas globais "negadas por design" sem verificação de deny-all ·
Achado na manutenção noturna (rodada de revisão de RLS). `tests/rls/isolation.test.ts` verifica
que `idempotency_keys` e `job_queue` (RLS on + force + zero políticas) não devolvem nada ao
cliente. Mas a descoberta automática (`tenant_rls_report()`, migration 0005) só enxerga tabelas
com coluna `tenant_id` — então as 3 tabelas globais que seguem o MESMO padrão de deny-all
(`rate_limits`, `webhook_events`, `cron_heartbeats`) nunca entram no relatório e **nenhum teste
confirma que elas negam acesso ao cliente**. Uma política permissiva adicionada a qualquer uma
delas por engano passaria despercebida. O comentário de `0038_grants_base_postgrest.sql`
("zero políticas com RLS forçada nega tudo... é o comportamento que o teste de isolamento já
cobra") superdeclara: o teste cobre 2 das 5, não as 5. NÃO corrigido no loop (o conserto é um
`it` novo em `tests/rls/`, que roda contra o Supabase de PRODUÇÃO — fora do escopo seguro da
manutenção noturna). Pendência pro Eduardo: adicionar ao `isolation.test.ts` um bloco que faça
`clienteAnon.from(t).select('*')` para `t` em `['rate_limits','webhook_events','cron_heartbeats']`
e exija erro ou lista vazia — rodável no `supabase start` local ou no job de CI, nunca no
`.env.local`.

2026-08-27 · Correção de um [M] do 18 §I.3 (sinais de churn) · O §I.3 afirma que os três sinais
("queda de agendamentos criados/semana", "sem login há 14 dias", "página pública sem visita há 30
dias") são "todos calculáveis com timestamps que já existem — não exigem instrumentação nova".
Conferido contra o schema: é um de três. (1) Agendamentos por semana: sim, direto,
`appointments.created_at`. (2) Sem login: o dado existe em `auth.users.last_sign_in_at` e o
`service_role` de `withNovoTenant` alcança por `auth.admin.listUsers()` — mas está fora do schema
`public`, então não junta com dado de tenant em SQL; precisa de paginação e cruzamento com
`memberships` no código, e hoje há ZERO uso de `auth.admin` no projeto. (3) Página pública sem
visita: não existe nenhuma contagem de visita — é justamente o que exigiria instrumentação nova.
Não corrigido no 18 (documento de outra fase); registrado aqui e em `docs/27-ESCALA-E-CONVERSAO.md`
§7.4. Decisão de escopo junto: painel de sinais de churn NÃO entra no plano enquanto houver 2
tenants — é consulta SQL, não produto, pela mesma lógica que trava a indicação B2B em ≥20 pagantes.

2026-08-27 · O fallback de mensagem alcança a metade errada da base · Medido ao auditar
`enviarComFallback` (WhatsApp → push → e-mail). Dois fatos que mudam a leitura do `25` F0 passo 2:
(1) o ramo de PUSH para cliente nunca dispara para ninguém — `inscricoesPushDoCliente` resolve
`clients.user_id`, e NADA no projeto escreve essa coluna; o comentário da 0001 diz "se criou conta
no app da cliente", app que não existe e que o FAQ da landing promete que não vai existir. É
andaime, como `trial_ends_at`. (2) `EsquemaBookingPublico` não coleta e-mail, enquanto
`EsquemaCliente` e a importação de CSV coletam. Consequência: ligar `reminders` sem WhatsApp
entregaria e-mail à base importada/manual (onde mora o risco que o passo 1 do F0 quer medir, e
quem o salão já contata por outro meio) e NADA a quem agendou pela página pública (quem mais
espera retorno, e a população que o laço de crescimento gera). O canal disponível hoje alcança quem
menos precisa e não alcança quem mais precisa. Conserto barato possível: campo opcional de e-mail
no formulário público — mas cobra conversão num formulário de 2 campos obrigatórios, e vira
redundante se o F0b (WhatsApp) acontecer. Decisão do dono, encadeada à do F0b. Detalhe em
`docs/27-ESCALA-E-CONVERSAO.md` §7.3.

2026-08-27 · A página pública de agendamento leva ~4,3 s até o primeiro horário · Medido no ar
(3 amostras consecutivas, cache no-store): HTML ~1,3 s e API de disponibilidade ~2,9-3,7 s. Não é
cold start — as amostras batem entre si; o primeiro acesso da sessão (esse frio) deu TTFB 4196 ms e
primeiro horário perto de 7,6 s. Causa parcial MEDIDA: `disponibilidadePublica` faz QUATRO idas ao
banco em série (tenantPeloSlug → services → professionals → Promise.all de business_hours/time_off/
appointments), e as duas pontas estão em continentes diferentes — Supabase em sa-east-1 e função
Vercel no padrão `iad1`, porque `vercel.json` não define `regions`. NÃO PROVADO daqui que a latência
transcontinental responda pela maior parte dos 3 s (exigiria medir de uma função em gru1). Dois
consertos: (a) `"regions": ["gru1"]` — uma linha, MAS escolha de região é historicamente recurso de
plano pago na Vercel e o projeto está no Hobby; conferir antes de contar com isso; (b) paralelizar
`services` e `professionals` num Promise.all — eles não dependem um do outro, corta 4 saltos em
série para 3, não depende de plano nem de decisão de ninguém. Detalhe em
`docs/27-ESCALA-E-CONVERSAO.md` §7.2.


2026-08-28 · O quadro "Taxa" do caixa some, em vez de virar "em breve" · Nada no projeto escreve
`tickets.fee_cents`, então o quadro mostrava R$ 0,00 desde a primeira comanda. Três saídas:
(a) implementar taxa de maquininha — depende de credencial de pagamento, que é o mesmo bloqueio do
TICKET-043; (b) rotular como "em breve" — ocupa espaço numa tela de 375px para não informar nada;
(c) tirar. Escolhida a (c), que é a mais simples e atende ao critério. A coluna, o campo do resumo
da API e o desconto dentro de `calcularSobraDaComanda` ficam, e a guarda
`caixa-nao-promete-taxa` EXIGE o quadro de volta no dia em que alguém escrever `fee_cents` — a
decisão não vira dívida esquecida.

2026-08-28 · A comissão continua sobre o total do item, sem o desconto da comanda · Ao consertar
`profit_cents` apareceu a pergunta: desconto de R$ 20 numa comanda de R$ 100 reduz a comissão do
profissional? Decidido que não. O desconto é concessão comercial do dono; o profissional entregou o
serviço inteiro. Consequência assumida: o desconto sai inteiro da linha do salão, e é exatamente
por isso que ele precisa aparecer no "Sobrou".

2026-08-28 · A migration 0045 falha alto em vez de limpar duplicata sozinha · O índice único de
`tickets(appointment_id)` não pode ser criado se já existir agendamento com duas comandas. Resolver
apagando é proibido pela regra 11. Resolver zerando o `appointment_id` da mais nova seria decidir,
sem contexto, qual comanda tem o faturamento certo. A migration levanta exceção com a consulta de
diagnóstico na própria mensagem, e a decisão fica com quem conhece o dado.

2026-08-28 · A trava de banco local mora numa config separada, não na `vitest.config.ts` ·
`tests/unit` não abre banco e não deve carregar `.env.local` nem pagar a checagem. `test:integration`
e `test:rls` passam a rodar com `--config vitest.banco.config.ts`. Escape explícito:
`PERMITIR_BANCO_REMOTO=1`, para o caso legítimo de apontar para um projeto de staging.


2026-08-28 · A redação da trilha é `service_role`, não `authenticated` · `audit_log` e
`idempotency_keys` não têm política de UPDATE de propósito, então redigi-las exige `security
definer`. Conceder essa função a `authenticated` — mesmo com `has_tenant` + papel conferidos dentro
— entrega a quem está logado uma ferramenta de apagar o próprio rastro. Escolhido conceder só a
`service_role` e chamar por `withTenant()`; a autorização de quem pode eliminar já é feita na rota
(`client:delete` + AAL2). Dentro da função fica a trava que não depende do chamador:
`anonymized_at is not null`.

2026-08-28 · A chave de idempotência guarda um marcador, não `null`, e a linha não é apagada ·
Apagar a linha faria uma repetição da fila offline com a mesma chave **reexecutar** a mutação —
recriando a cliente que acabou de ser eliminada. `null` faria a repetição devolver `null` onde a API
promete um objeto. `{"eliminado": true}` mantém a chave reservada, a repetição continua não
reexecutando nada, e o corpo não carrega mais ninguém.

2026-08-28 · `preferences` passa a ser redigido na trilha; `document` e `address` não ·
`preferences` tem campo `alergia` em seis das sete verticais — dado de saúde, e a regra 9 é
absoluta. CPF e endereço são dado pessoal comum: a trilha existe para mostrar **o que mudou**, e
redigir tudo na escrita a esvaziaria. Eles saem na eliminação, que é o que a LGPD art. 18 VI pede,
pela RPC da 0046.

2026-08-28 · Não construí caminho para promover um tenant de plano · `tenants.plan` é lido pela
trava inteira e escrito por ninguém. Quem pode promover (super-admin? webhook do PSP? o dono do
CICLO?) é decisão de produto, e o `CLAUDE.md` proíbe criar arquivo que o ticket não pediu. Fica
reportado em `docs/29` §C1, com o caminho mais barato descrito para quando a decisão existir.

2026-08-28 · O portfólio ganhou guarda em vez de código morto removido · `mediaParaPortfolio` não
tem chamador e sempre voltaria vazia (`consent_id` nunca é gravado). Apagar a função perderia a
implementação pensada do TICKET-051; deixá-la sem aviso faz o repositório parecer entregar uma
galeria que não existe. Escolhida a guarda de mão dupla, mesma forma do quadro "Taxa": proíbe ligar
antes de existir escritor, e exige o cruzamento com `revoked_at` depois que existir.


2026-08-28 · `401`/`403` na fila offline viram `retry`, não descarte · Sessão vencida e permissão
revogada são estados do cliente, não veredito sobre a mutação: entrar de novo faz a mesma mutação
passar. O risco aceito é a fila ficar tentando enquanto a sessão estiver vencida — sem perda de
dado, e a drenagem só roda no evento `online` ou no botão, então não é laço quente. O caminho
oposto (descartar) apagava o agendamento que a pessoa criou sem rede, em silêncio.

2026-08-28 · Descarte da fila vira card SEM "tentar de novo" · Diferente do 409, o descarte vem de
recusa definitiva do servidor (400/402/404/422): reenviar daria o mesmo resultado, e oferecer o
botão seria mentir sobre o que ele faz. O card conta o que se perdeu e oferece "Entendi"; refazer é
pela tela normal, que mostra o motivo real do erro.

2026-08-28 · A classificação de status saiu do adaptador de browser e virou `core` · O adaptador é
declaradamente intestável neste projeto (Vitest em `node`, sem jsdom). Deixar ali a regra que decide
entre reenviar, avisar e **apagar trabalho** significava a única parte da fila sem teste ser a que
destrói dado. `classificarResposta` é função pura, em `core/offline/queue.ts`, com teste de
comportamento.

2026-08-28 · A faxina de `idempotency_keys` mora no `recompute-cycles` · Não tem relação com o Motor
de Ciclo, e é o preço de não ter agendador dedicado: `recompute-cycles` e `segments` são as duas
únicas rotas no `on.schedule` do `cron.yml`, e a primeira dispara seis vezes por dia. Uma sétima
rota de cron só para varrer uma tabela obrigaria a mexer no `cron.yml`, no `ROTAS_DE_CRON` e nas
duas guardas de agendamento. Fica fora do `if (processados > 0)` porque chave órfã prende reenvio a
qualquer hora.

2026-08-28 · Reserva de idempotência é considerada órfã depois de 1 hora, e a chave vence em 30 dias
· Uma hora porque nenhuma função serverless dura isso — abaixo disso haveria risco de apagar
reserva em voo. Trinta dias porque a fila offline não reenvia com esse atraso, e porque
`response_body` carrega a cliente inteira (necessidade, LGPD art. 6).


2026-08-28 · O período do extrato de comissão passa a exigir o fuso do tenant como parâmetro · A
alternativa era buscar `tenants.timezone` dentro da própria função, mas ela é chamada em laço na
tela do caixa (uma vez por profissional) e isso viraria N idas ao banco por render. Os três
chamadores já tinham o fuso em mãos: a rota lê como `cash/daily` já lê, e as duas páginas recebem
pelo contexto.

2026-08-28 · `alertas-estoque.ts` fica na lista de dívida do dia-em-UTC, e não é consertado · A
janela é CORRIDA de 30 dias, para tirar consumo médio diário dividindo por 30 fixo. Três horas em
720 não mudam a decisão de "está na hora de repor", e o número não vira pagamento de ninguém.
Consertar exigiria passar o fuso por mais uma cadeia para não mudar resultado nenhum. Fica
declarado na guarda, que reprova se ele for consertado e a lista não encolher junto.

2026-08-28 · A guarda do dia-em-UTC é de classe, não das três funções conhecidas · Varre
`src/server` e `src/app` procurando o TEXTO do instante literal (`T00:00:00Z`, `T23:59:59`), com
lista de dívida que só encolhe. Travar só `caixa`/`comissao`/`atribuicao` deixaria o próximo arquivo
livre para repetir — que é exatamente como esta classe chegou à quarta rodada.


2026-08-28 · A dispensa da guarda de botão travado é uma lista fechada, não um padrão · "Parece
estado de envio" (qualquer identificador terminado em -ndo, por exemplo) deixaria qualquer condição
nova entrar sem justificar. A lista é explícita (`pendente`, `salvando`, `saindo`, `enviando`,
`carregando`, `importando`, `processando`) e há um teste que reprova se ela crescer para casar
`!nome` ou `length === 0`.

2026-08-28 · Os dois botões de `(public)/confirmar` ganharam motivo em vez de entrar na dispensa ·
Eles travam enquanto o OUTRO está em curso — o spinner que explicaria a espera está no botão
vizinho. Tecnicamente é "ação em curso"; para quem usa leitor de tela, não é: o feedback está em
outro elemento. Alargar a exceção para cobrir esse caso a tornaria inútil.

2026-08-28 · Não adicionei índice único em `loyalty_entries` nesta rodada · O caminho de dupla
pontuação já está fechado no app pelo compare-and-swap da rodada 1. Um índice único sobre dado que
pode ter duplicata histórica PARA o deploy, e já existe uma migration nessa condição (`0045`)
esperando conferência em produção. As duas devem ir juntas, na mesma passada em que alguém rodar a
consulta de diagnóstico no banco de verdade.


2026-08-28 · Não escolhi um lado da capacidade paralela · `parallel_capacity` é oferecido pela
disponibilidade e proibido por `appointments_no_overlap`. Ou o banco aprende a contar (exclusion
constraint não expressa "no máximo N sobrepostos" — precisaria de trigger com trava, e trava mal
feita devolve a corrida que a constraint resolve), ou a capacidade sai do produto. As duas são
decisão de produto. O que dá para fazer sozinho é impedir que a armadilha dispare: a guarda proíbe
o formulário de oferecer o campo enquanto o banco não souber contar, e proíbe a restrição de
sobreposição de sumir.

2026-08-28 · Consertei a conta da capacidade mesmo com o recurso bloqueado · `cabeSemColidir` é
função pura em `core/`, com contrato escrito (§5.5) e testes próprios, e estava errada em relação
ao próprio contrato. Deixar errado "porque o recurso não funciona mesmo" faria o conserto do banco,
quando vier, herdar um bug silencioso de agenda vazia.


2026-08-29 · O link de indicação fica no Grátis; os pontos automáticos ficam no Equipe · Decidido
pelo Eduardo. O módulo `loyalty` (que credita os dois lados) continua no Equipe, mas o **link de
convite**, a gravação de `referred_by`, o "quem trouxe quem" e o card do dono passam a valer desde
o Grátis. Três motivos: (1) cada link compartilhado é uma página `/{slug}` do CICLO circulando no
WhatsApp de quem não é usuário, com o selo do Grátis — é distribuição; (2) o laço enche o teto de 50
clientes, que é o gatilho de upgrade para o Essencial, e travá-lo mataria o laço exatamente onde ele
gera mais pressão; (3) o salão do Grátis continua recompensando na mão ("10% no próximo"), que
funciona para sempre — o que ele não tem é o automático, e automação é o que se cobra. Detalhe em
`docs/30-INDICACAO-PLANO.md` §5.2.

2026-08-29 · A auditoria é mesclada antes de a indicação começar · Decidido pelo Eduardo. O ticket
I-1 mexe em `public-booking.ts` e `clientes.ts`, dois arquivos que a auditoria tocou; e as migrations
`0045`/`0046` precisam ir para produção antes de qualquer coisa nova entrar por cima delas.


2026-08-30 · O link do convite de indicação aponta pra /{slug}/agendar, não pra /{slug} · O
`docs/30` original desenhava o link como `/{slug}?ind=`, a raiz do perfil do tenant. Medido durante
a implementação do I-1: o CTA "Agendar" daquela tela (`secoes.tsx`) linka pra `/{slug}/agendar` SEM
repassar nenhuma query string — um convite pra raiz perderia o token no primeiro toque, antes de
chegar na única tela que lê `?ind=`. Corrigido para apontar direto pra `/{slug}/agendar`, e o
`docs/30` foi atualizado com a correção registrada inline. Poupa um clique de quem já sabe o que
quer, de quebra.

2026-08-30 · I-10 fica pra depois, não travado por técnica · I-1 a I-9 do `docs/30` mesclados
(escritor, guarda, convite no pico, moldura de chegada, botão manual, barra de upgrade, extrato
mensal, paywall no instante da prova). I-10 (níveis e barra de progresso da cliente, degrau Equipe)
não entrou porque grava pontuação em cima de duas perguntas que `docs/30` §9 deixa abertas: qual é
o prêmio e se os dois lados recebem o mesmo valor. Construir a UI de nível agora seria herdar um
número que pode mudar. Falta decidir §9.2 e §9.3 pra desbloquear.

2026-08-30 · Assistente de IA destravado; 4 bugs corrigidos; 9 sugestões viram resposta sem
LLM · Chave `GEMINI_API_KEY` criada pelo Eduardo e testada de ponta a ponta em produção pela
primeira vez desde que o `docs/26` foi escrito (a Fase A nunca tinha rodado contra a API real).
Quatro bugs de infraestrutura achados e corrigidos nesta rodada, todos medidos direto contra a
API do Gemini, não deduzidos:
1. `gemini-2.5-flash` devolvia 404 — o modelo foi descontinuado para chaves novas entre 26/08
   (quando o `docs/26` foi escrito) e hoje. Trocado por `gemini-3.1-flash-lite` (`gemini.ts`).
2. `gemini-3.6-flash` (tentativa intermediária) é modelo de raciocínio por padrão — gastava
   tokens de "pensamento" até em pergunta trivial e estourava o timeout de 10s numa chamada real
   com ferramenta (medido 12,7s só na primeira chamada). `flash-lite` não tem esse problema.
3. Gemini 3.x exige reenviar o `thoughtSignature` da resposta anterior em qualquer `functionCall`
   reenviado no histórico — sem isso, 400 "missing thought_signature" na segunda chamada do laço
   (a que vem depois de rodar a ferramenta). Campo opcional novo em `MensagemDoAssistente`/
   `RespostaDoModelo` (`types.ts`), capturado em `gemini.ts`, replicado em `assistente.ts`.
4. "Tenho horário vago amanhã?" respondia com uma data de outro ano — `EsquemaData`/`EsquemaMes`
   marcavam o campo como obrigatório no JSON Schema que o Gemini lê, mas a pergunta nem sempre
   especifica data; sem valor natural para preencher o campo obrigatório, o MODELO inventava um.
   Corrigido em duas frentes: os campos viraram `.optional()` de verdade (batendo com o fallback
   que o `executar()` já tinha), e o prompt de sistema passou a levar a data de hoje no fuso do
   tenant (`promptDeSistema(hojeNoFuso(...))`) — sem isso a instrução "nunca invente data" não
   tinha como ser obedecida, porque não havia nenhuma data de referência no contexto.

Além dos bugs, implementada a "Opção 1" discutida com o Eduardo: as 9 sugestões prontas do
assistente (3 em `/admin/hoje`, 3 em `/admin/recuperar`, 2 em `/admin/caixa`, 1 em
`/admin/orcamentos`) agora respondem via `POST /api/v1/assistant/rapido`
(`src/server/assistente/respostas-rapidas.ts`) — template de texto fixo com o número vindo direto
do mesmo serviço que a ferramenta equivalente do Gemini usaria, ZERO chamada ao LLM. Latência
medida: 400-950ms (contra 2-8s no caminho com Gemini). Cada id tem seu próprio par
módulo+permissão em `PERMISSAO_POR_ID`, igual ao par que a ferramenta Gemini equivalente já
exigia — nenhuma resposta rápida contorna RBAC ou módulo do plano. Pergunta livre digitada pelo
usuário continua indo para o Gemini normalmente; só as 9 sugestões com clique têm atalho.

Achado colateral: o rótulo do botão em `/admin/caixa` dizia "Quanto faturei essa semana?" mas a
pergunta por trás sempre foi o mês corrente — corrigido para "Quanto faturei este mês?" ao
escrever o template fixo (a resposta determinística ia contradizer o próprio botão).

Pendência registrada, não resolvida: o custo real por pergunta do `gemini-3.1-flash-lite` ainda
não foi medido (o `docs/26 §7` estimava ~R$0,004 para o `2.5-flash`, hoje desatualizado) — falta
volume de uso real para calibrar, mesma regra do `docs/17 §4.8` sobre não fingir dado que não
existe. `pnpm verify` completo não pôde rodar nesta sessão: não há Docker disponível neste
ambiente para `supabase start`, então `test:integration` e `test:rls` ficaram fora — typecheck,
lint, `test:unit` (1001 testes, 0 falhas) e `build` passaram limpos.

2026-08-30 · Assistente vira janela flutuante arrastável no desktop · Pedido do Eduardo,
comparando com Intercom/Drift/ChatGPT: "movível que nem os grandes". No desktop (≥1024px, mesmo
corte que `tab-bar.tsx` já usa pra virar barra lateral) o painel deixou de ser o `Sheet` modal
(que sobe do fundo, trava a tela) e virou uma janela flutuante NÃO modal, arrastável pela alça do
cabeçalho, ancorada perto do botão que a abre. Sem overlay, sem travar o resto da página — igual
ao padrão dos widgets de chat grandes. No mobile (<1024px) continua sendo o `Sheet` de sempre,
sem nenhuma mudança: arrastar uma janela pela tela não faz sentido numa largura de 390px.

Bug achado e corrigido durante o teste ao vivo (arrastar até o canto extremo da tela): o limite
vertical (`limitarNaTela`) travava contra um número fixo (`- 80`, copiado do cálculo da posição
INICIAL) em vez da altura REAL da janela, que muda com o conteúdo (367px com poucas sugestões,
até 600px com conversa longa). Arrastado até o fundo, o rodapé ficava 271px fora da tela.
Corrigido: o limite agora mede `janelaRef.current.getBoundingClientRect().height` de verdade a
cada arrasto, em vez de presumir um valor. Testado nos dois extremos (canto superior-esquerdo e
inferior-direito) depois do conserto — os dois travam dentro do viewport.

2026-08-30 · Assistente ganha visual de conversa (parecido com Claude/GPT) · Pedido do Eduardo:
"a interface do chat em si tá feia, deixa que nem dos grandes players". Medido antes de mexer:
o Gemini já respondia em Markdown de verdade (negrito, listas numeradas, sub-itens) — a tela
mostrava tudo como texto puro, com `**` aparecendo literal na tela. Não era só estética, era bug
de renderização. Corrigido com um parser de Markdown-lite local (`renderMarkdownLeve`,
`assistente-flutuante.tsx`), sem dependência nova — cobre só o que foi medido nas respostas reais
(negrito + lista de até dois níveis), de propósito não é um Markdown completo.

Junto, o resto do pacote "parece um chat de verdade": pergunta em bolha alinhada à direita
(`bg-acc-soft`), resposta com ícone (sem caixa pesada, texto flui como nos grandes players),
"digitando…" com três pontos animados em vez do texto "Consultando…", campo de texto que cresce
com o conteúdo (até 128px) em vez de uma linha só, Enter envia / Shift+Enter quebra linha, rolagem
automática para a mensagem mais nova. Testado ao vivo contra uma resposta real de 13 negritos e
lista de dois níveis — zero `**` literal na tela, tudo renderizado como HTML de verdade. Mesmo
`conteudo` compartilhado entre a janela flutuante (desktop) e o Sheet (mobile) — testado nos dois.

2026-08-30 · Etapa 2 do docs/33 (resumo proativo) completada — orçamento parado some da lista de
"perguntar ao assistente" e vira card em "Hoje" · Pedido do Eduardo: avançar nas automações do
`docs/33-AUTOMACAO-AGENTE-PLANO.md` via `/loop`, respeitando a trava explícita da etapa 4 (nível
3, "escreve/envia sozinho" — travada em ≥10 pagantes, zero hoje, NADA implementado nessa
direção).

Achado antes de escrever qualquer linha: `centralDeAcoes` (`server/services/crm.ts`, já mostrado
em "Hoje" como "Vale a pena hoje") **já era** a Etapa 2/Fase C do `docs/26` — proativo, sem LLM,
calculado a cada carregamento da tela mais aberta do produto. Cobria clientes sumindo,
aniversariantes e pontos de fidelidade; confirmação pendente já tinha seção própria
("Precisa confirmar"). Faltava só **orçamento parado** — a única lacuna real, dado que o
assistente já sabia responder isso (`orcamentos_parados`, `orcamentos_sem_resposta`) mas a tela
nunca mostrava sem o dono perguntar.

Nota sobre o gate: `docs/26` original travava a Fase C em **≥30 pagantes**; `docs/33 §7.2`
revisou esse gate para "etapa 1 medida" (Fase A no ar), classificando como Recomendado — decisão
já tomada num documento mais recente, não inventada agora. Zero pagantes ainda hoje, então
"medida" aqui significa o teste extensivo desta própria sessão, não uso real de cliente pagante —
registrado como o que é, não maquiado de "medido" de verdade.

Implementação: nova consulta a `listarOrcamentos` (já existente, reusada — mesma que os tools do
assistente usam) mais `contextoDePlano`/`podeUsarModulo(ctx, 'quotes')` para NÃO mostrar o card em
plano Grátis (que não tem módulo de orçamento). Testado em produção inserindo um orçamento
`status='sent'` de verdade na conta `teste-essencial` via SQL, confirmando "1 orçamento parado"
aparecer na posição certa com gramática singular correta, e apagando o dado de teste depois —
zero sujeira deixada no banco.

Pendência que NÃO foi testada: o caminho negativo (tenant em plano Grátis não deveria ver o card)
não tem uma conta de teste em `gratis` disponível nesta sessão para confirmar ao vivo — a
garantia vem só de revisão de código (mesmo `podeUsarModulo` que a ferramenta do assistente já
usa) e typecheck, não de teste real. Fica registrado, não escondido.

`pnpm verify` completo continua fora de alcance neste ambiente (sem Docker para
`test:integration`/`test:rls`) — typecheck, lint, `test:unit` (1001 testes, 0 falhas) e `build`
passaram limpos.

2026-08-30 · Rodada de "aprimora e executa" — o que foi checado, o que ficou pendente de você ·
Revisão de `docs/29-SUPER-AUDITORIA.md` e `docs/31-LANCAMENTO-AUDITORIA-E-PLANO.md` em busca de
achados ainda abertos, antes de inventar polimento sem necessidade.

**Descoberta: os dois docs já estavam desatualizados no mesmo dia.** B2 (`tenants.plan` sem
escritor) e B3 (sem termos/privacidade), listados como bloqueadores no `docs/31` (11:49), já
tinham sido resolvidos por trabalho posterior à própria escrita do doc — `scripts/promover-tenant.mjs`
existe (criado 11:18, ANTES do doc que reclama da ausência dele, numa corrida de sessões em
paralelo) e `src/app/(public)/termos`/`privacidade` existem. B8 (25 commits presos em PRs #30/#31
sem revisão) também está resolvido — as duas já foram mescladas (`git log`: `61b246f`, `3a4b7ba`).
Confirmado por leitura de código, não presumido.

**O que segue de pé, sem eu poder resolver sozinho:**
- B1/B4/B5/B6/B7 (cobrança, domínio, CNPJ, WhatsApp, Sentry) — todos dependem de credencial ou
  decisão de negócio sua, já registrado no próprio `docs/31 §6`.
- **B9, quantificado agora: 8 tenants de teste órfãos em produção** (`rls-a-f16e1b5a`,
  `rls-a-2fa03eaf`, `rls-a-3c0109d3`, `risco-cb7633df`, `clientes-d639e994`, `recuperar-4be7726b`,
  `alertas-estoque-ce1e38f5`, `health-a8a70755`), todos criados 23–24/08 pela mesma causa raiz já
  travada (`.env.local` apontando pra produção durante teste de integração). São lixo de teste
  claro pelo padrão do nome/slug, não cliente real. **Não apaguei** — excluir linha de tenant é
  ação irreversível em produção, e mesmo parecendo óbvio isso é confirmação sua, não decisão que
  o loop toma sozinho. Comando pronto para quando você autorizar:
  `delete from tenants where slug in ('rls-a-f16e1b5a','rls-a-2fa03eaf','rls-a-3c0109d3','risco-cb7633df','clientes-d639e994','recuperar-4be7726b','alertas-estoque-ce1e38f5','health-a8a70755');`
  (a cascata de FK deve levar clientes/agendamentos/etc. desses tenants junto — conferir
  `on delete cascade` antes de rodar, não assumir).

**O que também ficou pendente, sem risco mas sem como testar hoje:** o caminho negativo do gate
de módulo do card de orçamento (tenant Grátis não deveria ver "orçamento parado") — as únicas
contas Grátis disponíveis em produção são as 8 órfãs acima ou `lang-barber` (tenant real, não-
demo, citado no `cron.yml` como cliente de verdade) — nenhuma segura para eu logar e testar sem
autorização.

Não forcei polimento de UX sem achado real: as três telas mais usadas (Hoje, Recuperar, Caixa)
já foram medidas nesta sessão (touch target, contraste, overflow) sem defeito novo encontrado.
Loop parado aqui — o que sobrou é decisão sua, não falta de trabalho.

2026-08-30 · B9 resolvido — 8 tenants de teste órfãos apagados de produção · Autorizado pelo
Eduardo. Conferido antes: toda tabela com `tenant_id` tem `ON DELETE CASCADE` (37 tabelas
checadas via `information_schema`), então o `delete from tenants` levou clientes, agendamentos,
orçamentos etc. desses 8 tenants junto, sem deixar linha órfã de dado real de gente (eram todos
sintéticos, criados por teste de integração rodando contra produção — causa raiz já travada
separadamente). Confirmado depois: `0` tenants restantes com o padrão de slug sintético.

2026-08-30 · "0% de ocupação" ao lado de agendamentos reais — achado medindo /admin/agenda ao
vivo · Rodada de polimento pedida pelo Eduardo ("aprimora como os dos grandes players"). Medido
antes de mudar (regra da casa: "verde não é prova"): domingo (hoje) tinha 3 agendamentos reais na
tela e mostrava "OCUPAÇÃO DO DIA: 0%" — matematicamente certo (`minutosDeExpediente=0` porque este
salão de teste não tem `business_hours` cadastrado pra domingo/segunda) mas lido como "dia vazio",
que é falso. Mesma classe do achado `docs/29 A3` ("Taxa" sempre R$ 0,00: número certo, leitura
errada).

Corrigido nos três lugares que leem `occupancyRate` (`listarAgendaDoDia`, `agendamentos.ts`):
- `ResumoAgendaDia` ganhou `temExpediente: boolean` (`janelas.length > 0`), sem mudar o cálculo
  de `occupancyRate` em si — quem já fazia conta com o número continua funcionando igual.
- Tela da Agenda (`agenda.tsx`): mostra "—" em vez de "0%" quando não há expediente, e esconde a
  barra de progresso (`progresso={undefined}`), não mostra uma barra zerada.
- `ocupacao_do_dia` (ferramenta do assistente): devolve `temExpedienteCadastrado` no objeto que o
  Gemini lê — testado ao vivo, o modelo já explica sozinho "não há expediente cadastrado... por
  isso a taxa é 0%" em vez de só afirmar "0% de ocupação" sem contexto.
- `hoje_horario_vago_amanha` (resposta rápida, sem LLM): troca "0% de ocupação" por "Não há
  expediente cadastrado para esse dia" quando `temExpediente` é falso.

Testado em produção nos dois sentidos: domingo (sem expediente) → "—"; terça (com expediente
cadastrado) → "9%" real, sem regressão no caminho normal. 1001 testes unit passando, build limpo.

2026-08-30 · Achado real: "Marcaram horário: 444%" em Campanhas — e uma armadilha de deploy que
vale registrar pra família toda · Medido ao vivo, tela /admin/campanhas: duas campanhas mostravam
444% e 233% de conversão — impossível matematicamente (mais gente "marcou horário" do que
mensagens enviadas). Causa raiz: `booked_count`/`revenue_cents` não têm NENHUM job/trigger no
código ou nas migrations que os escreva (só o default 0) — é dado de seed manual inconsistente
nesta conta de teste, não bug de lógica de atribuição (que não existe ainda). Corrigido na camada
de exibição (`Etapa`, `campanhas/page.tsx`): `pct` agora trava em `Math.min(100, ...)` — uma etapa
de funil nunca pode ser maior que a de cima dela, não importa a causa do dado errado.

**A armadilha, e por que ela comeu ~40 minutos desta rodada:** depois de deployado via `vercel
--prod` (CLI, direto do working directory local, sem commit), a tela continuou mostrando 444% —
em aba nova, sem service worker, sem cache de navegador, direto do servidor. `.next` local
recompilado do zero confirmava o fix presente no bundle certo. A explicação: **o deploy via CLI
não é o único gatilho neste projeto** — o repositório está conectado ao GitHub e cada `git push`
dispara um deploy automático próprio. Como o fix ainda estava só no working directory (não
commitado), o deploy automático mais recente — disparado pelo commit ANTERIOR, sem o fix —
corria em paralelo ou depois do meu deploy manual e reassumia o alias de produção, apagando o
resultado do `vercel --prod` sem aviso nenhum.

**A lição, registrada para não repetir**: neste projeto (e provavelmente em qualquer um com
Vercel+GitHub conectados), `vercel --prod` isolado, sem commit, é instável — o alias pode voltar
para trás a qualquer momento por um gatilho automático que não aparece no terminal. **A partir de
agora: commitar e empurrar ANTES de considerar um deploy manual definitivo**, ou pelo menos
verificar de novo alguns minutos depois. Nesta sessão, cada rodada anterior já vinha
commitando+empurrando logo após o `vercel --prod` funcionar — a diferença desta vez foi testar
demais antes de commitar, o que abriu a janela para o gatilho automático competir.

Testado depois do commit+push: `444%`/`233%` viram `100%` na tela, em aba nova, sem cache.

2026-08-30 · Correção do achado anterior — "444%" nunca foi bug de matemática, era falta de
separador de texto · Investigação mais funda depois do commit `2b93ebc` revelou o diagnóstico
original errado. O `<span>` externo do `Etapa` mostra `{valor}` (ex.: "4") seguido, sem nenhum
caractere entre eles, do `<span>` interno com `{pct}%` (ex.: "44%") — o `ml-1.5` que os separa é
`margin` CSS, que afasta visualmente mas não produz espaço nenhum em extração de texto. Leitor de
tela, copiar-e-colar, e o próprio teste desta sessão (que lê `body.innerText`) veem "4" + "44%" =
"444%", sem pausa — dois números corretos, grudados. Confirmado depois de um teste exaustivo (SW,
Cache Storage, HTTP cache, Router Cache do Next, deploy automático via GitHub, tudo descartado um
por um) que o servidor **sempre** mandou o número certo; o problema nunca esteve no back-end.

Mantido o teto `Math.min(100, ...)` do commit anterior — continua correto como rede de segurança
para quando a atribuição de campanha existir de verdade, só não era a causa do que foi visto.
Adicionado separador de texto de verdade (`· ` antes do `{pct}%`) para o número parar de grudar
em qualquer forma de extração de texto, não só visualmente.

**A lição real desta rodada, para não repetir**: extração de texto via `innerText`/`get_page_text`
NÃO é confiável para provar que dois números estão "grudados" ou não — `margin`/`padding` CSS
nunca aparecem como caractere. Para julgar se falta separador de verdade, a checagem certa é opon
`querySelector` no elemento específico e olhar sua estrutura (como foi feito aqui, tarde demais),
não confiar no texto concatenado da página inteira.

2026-08-30 · Acentuação faltando em "Sua conta no CICLO" (Configurações) · Medido ao vivo:
"Modulos" (sem acento), "voce" (2×), "so" — só nesse um bloco de `config/page.tsx`, resto do
arquivo com acentuação correta. Corrigido: "Módulos", "você" (2×), "só" — no texto visível e no
comentário interno do código.

2026-08-30 · "Popout não mexe no PC" — reproduzido e corrigido: arrasto só funcionava pegando a
faixa fina do cabeçalho · Pedido do Eduardo relatando que a janela flutuante não arrastava.
Testado no Chrome real (não a ferramenta de automação), com drag de mouse de verdade, não evento
sintético: (1) a janela abre bem posicionada, dentro da tela — não é bug de posição; (2) arrastar
pela faixa do cabeçalho (ícone + "Assistente") FUNCIONA, moveu de (838,34) para (417,265) num
teste real; (3) arrastar pelo CORPO da janela (onde ficam as sugestões e o campo de texto) NÃO
FAZ NADA — testado, posição não mudou. Essa é a explicação mais provável do relato: o corpo é a
maior parte visual da janela, é o lugar mais óbvio para tentar arrastar primeiro, e só a faixa
fina do topo respondia.

Corrigido: o clique-e-arraste agora funciona em qualquer parte da janela que não seja um elemento
interativo (`closest('button, input, textarea, a, select')` barra o início do arrasto) — a
mesma regra que Windows/macOS usam em janelas de verdade: qualquer área "morta" da janela arrasta,
só que a área "morta" aqui é a maioria do painel, não só uma faixa de 56px. O cursor visual de
"arrastar" continua só na faixa do cabeçalho (dica mais forte), mas a função funciona na janela
inteira.

2026-08-30 · Telefone cru na vitrine — a página pública do salão mostrava E.164 para a cliente
final · Rodada "aprimora tudo", área 1 (site público, `/{slug}`). Medido em produção, inspecionando
o ELEMENTO e não o `innerText` (lição do "444%"): o `<a href="tel:...">` da seção Contato tinha
como texto visível `+5511999990000` — E.164 cru. O `href` está correto e continua E.164 (é o
formato certo para `tel:`, e o schema.org `LocalBusiness.telephone` em `page.tsx` também deve
continuar assim). O problema é só o texto que a CLIENTE LÊ.

Peso do achado: `formatarTelefone()` (`src/lib/formato.ts`) já existia, com o comentário
explicando que `(11) 98765-4321` "é o formato que a profissional reconhece de cabeça", e já era
aplicada em `clientes/lista.tsx` e `clientes/[id]/ficha.tsx`. Ou seja: a formatação foi feita nas
telas internas e a **vitrine ficou de fora** — justamente a tela mais exposta do produto, a única
que a cliente final vê, e (por `docs/33`) a que o salão mostra pro bairro dele.

Corrigido em `src/app/(public)/[slug]/secoes.tsx`: `{formatarTelefone(perfil.phone)}` no texto,
`href` intocado. Conferido que era o único lugar — os outros dois usos de `perfil.phone` em
`(public)/` são o schema.org (deve ser E.164) e uma checagem de existência.

2026-08-30 · A tela mentia para o DONO: "lembrete e campanha saem sozinhos" com `reminders` fora
do schedule · Rodada "aprimora tudo", área 4 (subtelas de config). O achado mais grave da sessão.
`/admin/config/mensagens` mostrava, no estado ligado do interruptor: *"Ligado — lembrete de
agendamento e campanha de recuperação saem sozinhos, no horário certo."*

Medido, não deduzido: `ROTAS_AGENDADAS` (`core/cron/agendadas.ts`) é `['recompute-cycles',
'segments']`; no `cron.yml` o job que roda em `on.schedule` tem `matrix: rota:
[recompute-cycles, segments]`, com comentário explícito — *"só os jobs que APENAS calculam e
gravam no próprio banco; nenhum deles fala com o mundo externo"*. `reminders` e `campaigns`
aparecem só nas opções do `workflow_dispatch` (menu manual). E as credenciais de WhatsApp seguem
não provisionadas (TICKET-043). Ou seja: nada saía sozinho, e a tela dizia que saía.

**Por que isso é grave e não é typo:** é exatamente a armadilha que o `CLAUDE.md` lista
("prometer canal só se houver rota agendada e credencial existente"), virada para dentro. Quem é
enganado aqui não é a cliente do salão — é o **dono**, que confia que o produto está trabalhando
por ele e não manda a mensagem que deveria mandar na mão. O prejuízo é o cliente dele não voltar.

**Por que a guarda existente passou verde:** `promessa-de-canal.test.ts` foi bem escrita — ataca o
conceito e não a redação, e exercita `textoDoCanalDeConfirmacao()` nos dois estados do mundo. Mas
`pausar-envios.tsx` escrevia a frase **à mão**, sem chamar função nenhuma. Guarda não alcança quem
não a chama — uma terceira variação da mesma lição já registrada duas vezes neste arquivo.

Corrigido no padrão que a casa já tinha escolhido para este conceito: a copy virou
`textoDoEnvioAutomatico(pausado, remindersAgendada)` em `core/messaging/promessa.ts` — um lugar
só, ao lado da função irmã, lendo a mesma `ROTAS_AGENDADAS`. No dia em que `reminders` entrar no
`schedule`, a frase verdadeira volta sozinha, sem ninguém caçar string.

Detalhe que a mutação ensinou: a primeira redação honesta era *"nada sai sozinho ainda"* — e a
guarda **reprovou**, porque proíbe a construção e não sabe ler negação. Ensinar a regex a
entender "nada"/"não" seria a mesma lista fechada que já falhou antes (negação em português tem
forma demais). Mais firme: a copy verdadeira não encosta na construção proibida. Ficou *"Liberado
— mas o disparo é seu: a mensagem vai quando você toca em 'Avisar', pelo WhatsApp."*

Guarda nova **vista reprovando** antes de ser aceita (regra do `CLAUDE.md`): mutação reintroduziu
a frase original no ramo não-agendado, 2 asserções reprovaram apontando o texto exato, arquivo
restaurado do backup e conferido. 1005 testes passando (eram 1001), build limpo.

2026-08-30 · Varredura "aprimora tudo" — as outras 3 áreas, e a pendência que fica para o Eduardo ·
Áreas 1–5 medidas em produção. Além dos dois achados corrigidos (telefone cru na vitrine, promessa
falsa de envio automático), o que foi conferido e estava LIMPO:

- **Site público** (`/{slug}`, `/{slug}/agendar`): sem overflow horizontal; dia fechado explica
  ("Nesse dia o atendimento não abre. Escolha outra data no trilho acima"), não é tela muda.
- **Landing/preços**: sem overflow; a feature que o Grátis NÃO tem aparece com ícone `minus` e
  cor terciária, distinta das disponíveis — inspecionado no elemento, não no `innerText`.
- **Config** (11 subtelas): todos os 11 `href` do menu têm diretório correspondente, nenhum link
  quebrado. `/admin/config/time` deu 404 num primeiro teste, mas era **erro meu** — o href real é
  `/admin/config/profissionais`; falso positivo descartado antes de virar "achado".
- **Fluxo de entrada**: `/cadastro` e `/recuperar-senha` redirecionam ao painel quando já logado
  (correto). Login com credencial inexistente devolve `401` + *"E-mail ou senha não conferem."* —
  medido ao vivo. Mensagem única para "e-mail não existe" e "senha errada", com o motivo comentado
  no código (separar as duas entregaria a lista de quem tem conta). Segurança bem feita.
- **Fidelidade automática** (`/config/planos`): a tela afirma que o cliente "ganha pontos sozinho".
  Verificado em vez de presumido, logo depois de corrigir uma afirmação parecida que era falsa:
  aqui é **verdade** — `pontuarAtendimentoConcluido` roda dentro da conclusão do atendimento
  (`agendamentos.ts`), não depende de cron. A diferença entre as duas é exatamente essa.

**PENDÊNCIA PARA O EDUARDO — `/confirmar/[token]` com token inválido.** Das quatro páginas
públicas de token, três rejeitam link morto ao carregar: `/orcamento` ("Link inválido ou
expirado"), `/avaliar` ("Esse link de avaliação não é mais válido"), `/lista-espera` ("Esse link de
encaixe não é mais válido"). `/confirmar` **não** — mostra "Confirma seu horário? Vou sim /
Preciso desmarcar" normalmente, e a cliente só descobre que o link morreu depois de tocar.

Não corrigi de propósito, e o motivo importa: as três que validam têm rota **GET** pública
(`quotes/[token]`, `reviews/[token]`); `appointments/confirm|cancel/[token]` só têm **POST**, e a
tela deliberadamente não dispara ação ao carregar (comentário em `confirmar.tsx`, `docs/09` G12:
com duas ações possíveis, disparar uma sozinha não faria sentido — decisão correta, não reabri).
Consertar exigiria **criar uma rota GET pública nova**, que expõe dado de agendamento por token
sem sessão: superfície de segurança nova, com escolha de o que devolver, rate-limit próprio, e um
round-trip a mais em toda abertura do link (contra o que o `docs/28` fez por latência) — inclusive
nos 99% de casos válidos. Isso é decisão de produto/segurança sua, não de loop.

2026-08-30 · "Aprimorar automações" — o que a MEDIÇÃO deixou construir, e o que ela impediu ·
Pedido do Eduardo. Antes de escrever código, a tensão declarada: nesta mesma sessão foi corrigida
uma tela que prometia automação que não roda; construir personalização rica para automações
desligadas seria a mesma mentira com outra roupa. Então primeiro medir o que roda.

**O que REALMENTE roda sozinho hoje** (`ROTAS_AGENDADAS` + matriz do job `seguros` no `cron.yml`):
só `recompute-cycles` (Motor de Ciclo) e `segments`. Nenhum dos dois fala com o mundo externo.
`reminders`/`campaigns` estão fora por decisão; `stock-alerts` e `jobs` existem só no
`workflow_dispatch`. **Roda a cada abertura de tela** (não é cron, e é onde o `docs/33 §7.1` diz
estar "quase toda a sensação"): `centralDeAcoes` (o "Vale a pena hoje"), `resumoDeHoje`, e
`pontuarAtendimentoConcluido` (fidelidade, dentro da conclusão do atendimento).

**O que a medição IMPEDIU de construir — e é o resultado mais valioso desta rodada.** O candidato
óbvio era personalizar o Motor de Ciclo: `estadoPorAtraso` (`core/cycle/compute.ts`) usa limiares
ABSOLUTOS (`late` ≤10 dias, `at_risk` ≤30, depois `lost`) enquanto o ciclo em si é RELATIVO
(`personalCycleDays`). Em serviço de ciclo longo isso marca "perdida" cedo demais — 31 dias de
atraso num ciclo semestral é 17%, não abandono. Parecia achado forte. **Medido na base real:
`cycle_days` vai de 1 a 40, média 24, ZERO serviços acima de 45 dias.** Na faixa que existe, 10 e
30 dias são 25% e 75% do ciclo — os limiares fixos funcionam. O defeito é teórico, e construir
personalização para ele seria inventar funcionalidade que a medição não justifica. Não construído,
de propósito. Fica registrado para reabrir SE aparecer tenant de ciclo longo (eletricista,
manutenção semestral — nichos que o `docs/09` prevê).

**O que foi construído:** o card "clientes perto do prêmio" do resumo proativo usava `>= 80`
cravado, enquanto `rewardThreshold` é escolha do dono (1 a 100.000, padrão 100). No padrão a conta
fechava por coincidência (80 é 80% de 100) — foi por isso que sobreviveu. Fora dele mentia nas
duas direções, e a segunda é a pior:
  • prêmio 500 → anunciava "perto do prêmio" com 16% do caminho andado;
  • prêmio 50  → quem estava DE FATO perto (40 pontos, 80%) NUNCA aparecia, porque 40 < 80 — a
    automação proativa ficava cega justamente para quem ela existe para pegar.
Corrigido: o limiar virou `limiarPertoDoPremio(rewardThreshold)`, derivado de `FRACAO_PERTO_DO_PREMIO
= 0.8`, preservando exatamente o comportamento no prêmio padrão.

**Guarda cega pega em flagrante, e por isso a regra foi para `core/`.** A primeira versão do teste
espelhava `Math.ceil(0.8 * premio)` DENTRO do próprio arquivo de teste: provava que a fórmula é
proporcional, não que o produto a usa. Com o defeito reintroduzido em `crm.ts`
(`const limiarDePontos = 80`), ela passou **verde** — terceira aparição da mesma armadilha nesta
base. Por isso a regra saiu de `crm.ts` e virou `core/loyalty/limiar.ts` (função pura, sem I/O,
regra 5 do `CLAUDE.md`), e o teste passou a chamar a MESMA função que a tela chama.

Guarda final vista reprovando em DUAS mutações independentes antes de ser aceita: número fixo de
volta (4 asserções falham) e `Math.floor` no lugar de `Math.ceil` (1 asserção falha — prêmio
mínimo 1 viraria limiar 0, e `saldo >= 0` dispararia o card para a base inteira, inclusive quem
nunca pontuou). 1010 testes passando (eram 1005), build limpo.

2026-08-30 · Varredura final por outros números mágicos em automação — e por que a rodada parou ·
Depois de corrigir o limiar de fidelidade, varredura sistemática nos serviços de automação e
proatividade (`resumo-hoje`, `recuperar-receita`, `alertas-estoque`, `fidelidade`, `ciclo`) atrás
do MESMO padrão: número fixo ignorando configuração que o dono já pode escolher. **Não há outro.**
O que existe se divide em duas categorias, nenhuma delas defeito:

- **Técnicos**: `TAMANHO_PAGINA = 1000` (teto do PostgREST), `LIMITE_PADRAO = 200`,
  `JANELA_CONSUMO_DIAS = 30` (base estatística do consumo médio de estoque).
- **Proteções deliberadas, que afrouxar seria PIORAR**: `JANELA_PERMITIDA_INICIO/FIM = 8/21`
  (não mandar mensagem de madrugada) e `DIAS_ENTRE_CAMPANHAS = 7` (não bombardear a mesma
  pessoa). Personalizá-las é dar ao dono a corda para irritar a cliente dele — e a `docs/33 §1.4`
  (caso Air Canada) lembra de quem sobra o prejuízo: do salão, na frente da cliente. Se um dia a
  etapa 4 destravar, estes são os candidatos naturais a virar configuração **com teto**, nunca
  livres. Registrado, não construído.

`JANELA_ALERTA_HORAS = 3` (confirmações "das próximas 3 horas", em `resumo-hoje`) é o único
limítrofe: é preferência, não proteção. Mas não há configuração existente sendo ignorada — criar
uma agora seria inventar funcionalidade sem medição que a justifique, que é exatamente a regra
desta rodada. Fica anotado como candidato SE alguém pedir.

**Loop encerrado por ausência de melhoria honesta restante, não por limite de tempo.** As
automações que de fato rodam (Motor de Ciclo, segmentos, e a camada proativa da tela "Hoje") já
têm a personalização que faz sentido: `cycle_days` por serviço, `reorder_point` por produto,
`rewardThreshold` por tenant — e o único ponto onde essa configuração era ignorada foi corrigido.
O resto do que se chamaria "personalizar automação" hoje é ou personalizar máquina desligada
(`reminders`/`campaigns`), ou construir envio autônomo — ambos travados por decisão registrada.

2026-08-30 · Busca de cliente não perdoava acento — metade das buscas reais falhava · Rodada
"referências de grandes players". Problema escolhido por ser diário, de alta frequência e
específico do português.

**Medido em produção antes de mexer**, na base de teste, via `/api/v1/clients?q=`:
"Otávio"→acha · **"Otavio"→NADA** · "João"→acha · **"Joao"→NADA** · "Vinícius"→acha ·
**"Vinicius"→NADA** · "Sérgio"→acha · **"Sergio"→NADA**. Quatro de oito, e são justamente as
quatro que a pessoa digita de verdade: ninguém põe acento com pressa, no celular, com a cliente
na frente. Causa: `ilike` do Postgres é case-insensitive mas **não** é accent-insensitive.

**Pesquisa** ([PostgreSQL docs, F.48 unaccent](https://www.postgresql.org/docs/current/unaccent.html)
· [Neon Docs](https://neon.com/docs/extensions/unaccent), consultados 2026-08-30): o caminho
canônico é a extensão `unaccent` + wrapper IMMUTABLE (o `unaccent()` padrão é STABLE e por isso
não entra em índice de expressão) + índice GIN `pg_trgm` sobre a expressão normalizada, aplicando
a normalização **nos dois lados** da comparação.

**Desenho escolhido, e por que não RPC:** `supabase-js` não sabe aplicar função no lado da
coluna, então usar o wrapper no path de query obrigaria uma RPC. Em vez disso a normalização foi
**materializada**: coluna gerada `clients.name_busca` (`generated always as
imutavel_sem_acento(name) stored`) + índice `clients_name_busca_trgm`. O termo digitado passa
pelo par em JS (`semAcento`, `core/text/normalizar.ts`), e a comparação volta a ser um `ilike`
simples — que é o que o `supabase-js` faz e o que o trigram indexa. `clients_name_trgm` original
ficou onde estava. Migration `0047`, aditiva: nenhuma coluna some, nenhum dado muda.

**A guarda de LGPD da casa pegou a mudança, e isso é o melhor que aconteceu nesta rodada.**
`lgpd-cobertura.test.ts` reprovou o commit porque `clients.name_busca` carrega o nome da cliente
e não tinha tratamento declarado em `TRATAMENTO_NA_ELIMINACAO` (LGPD art. 18, VI). Não foi
guarda cega nenhuma: foi escrita para exatamente este caso — coluna nova, capaz de carregar dado
pessoal, entrando sem ninguém pensar na eliminação. Declarada como `anonimiza`, **sem** adicionar
escrita: é coluna gerada, deriva de `name` (que vira 'Cliente eliminada' no mesmo `update`), e o
Postgres recalcula sozinho — tentar escrever nela quebraria a eliminação, no pior momento
possível. O comentário ao lado registra isso para quem vier depois.

Guarda nova (`busca-perdoa-acento.test.ts`) vista reprovando em duas mutações antes de ser
aceita: sem `NFD` (4 asserções falham) e com regex guloso `[^a-zA-Z0-9]` (1 falha — a asserção
que protege espaço, hífen e apóstrofo, para não quebrar "Ana Clara" e "D'Ávila"). Ela exercita a
MESMA função que a busca usa, não uma cópia — lição da guarda cega pega mais cedo hoje.

Nota de ambiente: `pnpm db:types` falhou (`SUPABASE_PROJECT_REF` só existe na Vercel, não local) e
sobrescreveu `types.gen.ts` com o JSON do erro. Restaurado do git; a coluna foi adicionada à mão
**só em `Row`** — é gerada, nunca aceita `Insert`/`Update`.

2026-08-30 · Segunda cópia da mesma normalização — consolidada em `core/text/normalizar.ts` ·
Ao varrer o projeto atrás de OUTRAS buscas com o mesmo problema de acento (extensão natural do
achado anterior, não trabalho inventado), o resultado:
- **`ilike` existe em um lugar só** no projeto inteiro — o de `clientes.ts`, já corrigido. Não há
  outra query com o defeito.
- **Mas havia uma segunda cópia da regra**: `onboarding/formulario.tsx` tinha `normalizar()` com
  exatamente o mesmo `normalize('NFD')` + mesmo range de diacríticos + `.toLowerCase()`, mais um
  `.trim()`. Ou seja: ao criar `semAcento` eu tinha acabado de escrever a terceira versão da
  mesma ideia sem perceber.

Duas cópias da mesma regra é a condição exata para divergirem — e para uma guarda cobrir uma e
deixar a outra sem rede, que é como as duas guardas cegas desta sessão nasceram. Consolidadas:
`semAcento` absorveu o `.trim()` (no-op na busca de cliente, onde o termo já chega aparado) e o
onboarding passou a importar de `core/`. Mesmo espírito de `ROTAS_AGENDADAS`, `NOME_DO_PLANO` e
`promessa.ts`: um lugar só. Guarda ganhou o caso do `.trim()` e foi vista reprovando sem ele
(`'  otavio  '` ≠ `'otavio'`) — sem essa asserção, a busca de profissão do onboarding regrediria
em silêncio.

Verificado e NÃO mexido: `importar/importador.tsx` casa cabeçalho de planilha por
`toLowerCase().includes()` com os alvos `nome`, `telefone`, `mail`, `etiqueta` — nenhum tem
acento, então não há defeito medido. Fica anotado que o dia em que alguém adicionar um alvo
acentuado (`endereço`) o mesmo problema aparece ali, e a função já existe para resolver.

2026-08-30 · Regra "não construir antes de pagantes" REVOGADA pelo Eduardo — e a tela de
automações do `docs/33 §3.2` construída · Eu vinha aplicando o gate de sequenciamento do
`docs/33 §7.2` (etapa 3 travada em uso real, etapa 4 em ≥10 pagantes) como se fosse regra de
segurança. **Não é** — é regra de PRIORIZAÇÃO, e priorização é decisão do dono do produto. O
Eduardo foi explícito: não vai lançar amanhã, quer lançar com o produto forte, e deixar pronto
agora não é desperdício. Regra excluída; não reabrir.

O que continua travado **não é regra minha e não é opinião**: `reminders`/`campaigns` precisam de
`WHATSAPP_ACCESS_TOKEN`/`PHONE_NUMBER_ID`/`APP_SECRET` (TICKET-043), que não existem. Sem
credencial o envio não funciona, ligado ou não. A copy já está preparada para o dia em que entrar:
`promessa.ts` e o catálogo de automações leem `ROTAS_AGENDADAS`, então a frase e o selo viram
"ativa" sozinhos, sem ninguém caçar string.

**Construído** (`/admin/config/automacoes`, o dial do §3.1 na tela do §3.2):
- `core/automacoes/catalogo.ts` — as 6 automações reais do produto, com nome em português, teto de
  autonomia por automação e o MOTIVO do teto. Funções puras: `nivelEfetivo`, `niveisDisponiveis`,
  `rodaDeVerdade`.
- `core/automacoes/config.ts` — leitura de `tenants.settings.automacoes`, que nunca lança: o que
  não dá para entender vira nível 1, o valor seguro por definição.
- `server/services/automacoes.ts` + `PATCH /api/v1/tenant/automacoes` — grava uma automação por
  vez, com merge no `settings` (padrão de `atualizarConfigFidelidade`), teto aplicado no
  SERVIDOR e não só na tela, e `writeAudit` da mudança de nível (§6 item 2: sem clique humano
  depois, o log é a única prova de quem ligou e quando).

Três decisões do plano que viraram código executável, não prosa:
1. **Padrão de fábrica é 1** — tenant novo, `settings` vazio ou JSON estranho, todos caem no 1.
2. **Nível que a automação não alcança nem aparece** (§3.1) — e quando o dial trava, a tela DIZ
   por quê. Campanha para no 2 pela régua (d) do §2.1: alcança várias de uma vez.
3. **"Você escolheu" ≠ "o produto consegue"** — o selo Ativa/Parada vem de `ROTAS_AGENDADAS`, não
   do desejo. É a trava que impede esta tela de repetir a mentira que a de mensagens contava.

Guarda vista reprovando em QUATRO mutações antes de ser aceita: teto ignorado, padrão de fábrica
virando 3, `rodaDeVerdade` sempre true, e teto da campanha subindo para 3 (que seria envio em
lote sozinho — o cenário do pré-mortem do §8.1).

**E uma guarda da casa me pegou de novo**: `telas-do-admin-tem-loading` reprovou a tela nova por
falta de `loading.tsx` — Server Component async com fetch e sem esqueleto fica imóvel entre o
clique e a resposta. Corrigido. É a segunda vez hoje que uma guarda desta base pega uma adição
minha antes do commit (a primeira foi a de LGPD).

2026-08-30 · O chat passa a OPERAR o produto: primeira ferramenta de escrita, e a pesquisa que
mudou o desenho · Pedido do Eduardo ("o chat que ele já controlaria as coisas"). Até aqui as 8
ferramentas do assistente eram todas de leitura (`docs/33 §2.3`).

**Pesquisa, e ela contradisse o instinto** ([Anthropic — How we contain Claude](https://www.anthropic.com/engineering/how-we-contain-claude)
· [Tool use overview](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview),
consultados 2026-08-30). Três achados que valem mais que a feature:
1. **Fadiga de aprovação é medida, não teórica**: usuários aprovaram ~93% dos pedidos de
   permissão, e *quanto mais aprovações veem, menos atenção dão a cada uma*. Encher de
   confirmação não aumenta segurança — gasta a atenção que deveria sobrar para o que importa.
2. **A supervisão tem que caber em quem supervisiona**: "um trabalhador não-técnico não deveria
   ter que julgar comandos bash". Aqui quem confirma é dono de salão, não engenheiro — logo a
   confirmação precisa ser legível em português, com nome de gente e preço, nunca JSON nem id.
3. **Contenção ambiental vence portão de aprovação**: melhor limitar o que a ferramenta ALCANÇA
   do que esperar que o diálogo pegue o erro. Isso valida a régua do `docs/33 §2.1` por outro
   caminho — ela é, em outras palavras, um limite de raio de alcance.

**Construído: `preparar_agendamento`** — a ferramenta resolve "marca a Maria pra terça 14h" em
ids e devolve uma PROPOSTA legível; **não escreve nada**. Quem executa continua sendo
`POST /api/v1/appointments` com o clique do dono, que é literalmente a regra inegociável nº4 do
`docs/26 §0`. Ela exige `appointment:create` — a MESMA permissão da rota de execução, para o
assistente nunca preparar o que o papel não poderia executar depois.

**A regra que dá nome à guarda: empatou, pergunta — nunca desempata sozinho.** É o pré-mortem do
`docs/33 §8.1` (o modelo escolheu a cliente errada) aplicado ao nível com confirmação. Duas
"Maria" na base devolvem `qual_delas` com as opções, e o prompt manda perguntar. A resolução mora
em `core/assistente/resolver.ts` (função pura, regra 5 do `CLAUDE.md`) justamente para a guarda
exercitar o código real — não uma cópia, que foi como duas guardas cegas nasceram nesta sessão.

Detalhe do desenho que a medição impôs: a busca tenta EXATO → PREFIXO → CONTÉM e para no primeiro
resultado único. Sem essa ordem, "Ana" viraria ambiguidade por causa de "Mariana" — e perguntar
onde havia resposta certa também é defeito, só que de ruído.

Guarda vista reprovando em QUATRO mutações: empate virando escolha do primeiro (o pré-mortem),
"não achou" virando primeiro da lista, perda da ordem exato>prefixo, e vários profissionais
virando escolha silenciosa. Uma quinta descoberta veio de graça: a primeira versão do teste
esperava 2 opções para "Maria" e o código devolveu 3, incluindo "Mariana Lopes" — a EXPECTATIVA
estava errada, não o código. Esconder uma opção legítima para a lista ficar bonita é escolher pelo
dono por outro caminho. Registrado no próprio teste.

2026-08-30 · `preparar_agendamento` testada em produção — os quatro caminhos · Não só o caminho
feliz; o que interessa é o que ela faz quando NÃO tem certeza.

1. **Caminho feliz** — "marca um corte pro Bruno Almeida amanhã às 15h" → resolveu serviço,
   cliente, profissional, data e preço, e respondeu *"Preparei... Confirma para eu prosseguir?"*.
   Não disse que marcou. É a diferença entre preparar e executar, e ela apareceu na frase.
2. **Não existe** — "marca um corte pra Maria" (não há Maria na base) → *"Não encontrei nenhuma
   cliente chamada Maria. Você teria o sobrenome dela ou o telefone?"*. Perguntou em vez de pegar
   a primeira da lista, que era o modo de falha mais perigoso.
3. **Ambiguidade real, o pré-mortem do §8.1** — criadas duas clientes de teste com o mesmo
   prefixo ("Joana ZZTESTE Alves" e "Joana ZZTESTE Braga"), pedido "marca um corte pra Joana" →
   *"Encontrei duas clientes com o nome Joana: ... Qual delas?"*. **Não desempatou.** Dado de
   teste apagado e a base conferida de volta em 22 clientes.
4. **Prefixo vence "contém", e isso importa** — "marca pro Eduardo" resolveu direto para "Eduardo
   Nogueira" mesmo existindo "Carlos Eduardo Lima" na base. Correto: quem diz "Eduardo" quer
   alguém cujo nome COMEÇA com Eduardo. Perguntar aqui seria ruído, e ruído também é defeito.

**A prova que fecha o desenho**: consultado o banco depois de três pedidos de "marca um corte",
`0` agendamentos criados. A ferramenta prepara e nada mais — quem escreve continua sendo o
endpoint normal, com o clique do dono.

2026-08-30 · O cartão de confirmação: a proposta vira botão, e o laço fecha · Sem isto, a
ferramenta preparava e o dono lia "confirma?" — sem nada onde tocar. Teria que ir à tela marcar na
mão, e a proposta seria só um texto bonito. Agora o chat opera de verdade.

Desenho, e ele preserva a regra em vez de contorná-la: a proposta viaja até a tela
(`ResultadoDoAssistente.proposta`), vira cartão com os campos resolvidos, e o botão manda os
`dados` para a **rota normal** (`POST /api/v1/appointments`) — a mesma que a tela de "Novo
agendamento" usa, com a mesma validação, RLS, idempotência e trava de horário sobreposto. O
assistente segue sem escrever nada: ele diz o que preencher; o clique do dono executa.

O cartão mostra Cliente · Serviço · Com · Quando · Valor, em português, com nome de gente e preço
formatado — nunca id nem JSON. Isso é resposta direta à pesquisa da Anthropic sobre fadiga de
aprovação: confirmação que a pessoa não consegue JULGAR vira clique automático, e aí não protege
ninguém. `formatarQuando` não usa `new Date()` de propósito — a string já vem no fuso do salão, e
deixar o navegador interpretá-la reintroduziria a classe de bug de fuso que o `docs/28` já pagou.

**Terceira guarda cega desta sessão, e a mais instrutiva.** A guarda de `extrairProposta` (a porta
que decide se um retorno vira botão) passou VERDE com a checagem de `status` removida do produto.
Motivo: todos os meus casos negativos — `qual_delas`, `nao_achei`, retorno de ferramenta de
leitura — falhavam por **outro** motivo (não tinham `acao`). A checagem de status nunca era
exercitada sozinha; ela passava por acidente. Corrigido com um caso que isola a variável: objeto
completo e perfeito em tudo, MENOS no status. Aí a mutação reprova.

É a mesma lição pela terceira vez, agora numa forma nova: não basta ter caso negativo — o caso
negativo precisa falhar pelo motivo que você quer testar. Caso que reprova por acidente cobre o
acidente, não a regra.

Guarda final pega três mutações: status não verificado, `dados`/`resumo` não validados, e `acao`
vazia aceita.

2026-08-30 · Retry no Gemini — a pendência que virou urgente quando o assistente passou a operar ·
Testando o fluxo completo no navegador, o pedido "marca um corte pro Kleber dia 05/09 às 10h"
voltou "O assistente está indisponível agora". Conferido no log antes de concluir qualquer coisa:
`ErroDeInferencia: Gemini não respondeu a tempo` / `motivo: 'timeout'` — a instabilidade já
medida e registrada do `gemini-3.1-flash-lite` (1 de 3 chamadas travou num teste; o 503 "high
demand" apareceu à parte). **Não era regressão**: o mesmo pedido funcionou pela API minutos antes.

O comentário do `TIMEOUT_MS` registrava, em aberto: *"Retry automático em cima de timeout NÃO foi
adicionado nesta rodada — fica registrado como pendência, não como resolvido."* Ela virou urgente
agora: errar uma pergunta é chato; **errar a marcação de um horário é o dono perdendo a confiança
na feature inteira**. Resolvida.

Desenho do retry, e o que ele NÃO faz:
- **Uma** tentativa extra, não um laço. Com `TIMEOUT_MS` de 15s, duas já são 30s no pior caso, e
  o `maxDuration` da rota é 60 — cabe, com folga para o laço de ferramentas.
- **Só timeout e 5xx.** `4xx` nunca: `400` (schema errado), `401` (chave), `404` (modelo) não
  melhoram repetindo. Repetir erro de código é gastar o tempo do dono duas vezes para chegar no
  mesmo lugar — e foi um `400` e um `404` que custaram esta manhã inteira.
- Não esconde falha permanente: esgotadas as tentativas, o erro sobe igual e a tela mostra o 503
  honesto, em vez de fingir resposta.

2026-08-30 · Fluxo completo do chat testado de ponta a ponta em produção · "marca um corte pro
Kleber Dias dia 05/09 às 10h" → assistente resolveu tudo → proposta estruturada → o corpo exato
que o botão manda → `POST /api/v1/appointments` → **200, agendamento criado**. Conferido no banco:
`starts_at = 2026-09-05 13:00:00+00`, e `at time zone 'America/Sao_Paulo'` = **10:00:00** — a hora
que foi pedida no chat. Agendamento de teste apagado, base conferida de volta em zero para o dia.

**O defeito que só apareceu porque testei antes de confiar:** a primeira versão da proposta
mandava `startsAtLocal: "2026-09-05T10:00"`, mas `EsquemaCriarAgendamento` exige `startsAt` **com
offset**. O botão teria falhado no clique — o pior lugar para falhar, porque o dono já tinha lido,
julgado e confirmado. Corrigido convertendo no SERVIDOR, com `Temporal` e o fuso do salão.

Por que não converter na tela, que seria mais simples: a tela tem o fuso do APARELHO. Uma dona
viajando, ou um celular com fuso errado, marcaria no horário errado — e o erro apareceria só
quando a cliente batesse na porta na hora errada. É a armadilha literal do `CLAUDE.md` ("nunca
aritmética em horário local"), e `Temporal` ainda resolve o dia de mudança de horário de verão,
que tem 23 ou 25 horas.

2026-08-30 · Cliente nova pelo chat: o fluxo do balcão deixa de travar em "não achei" · Antes, o
caso mais comum do balcão — "marca pra Fulana, ela é nova" — morria num "não encontrei". O
assistente sabia dizer que não existia e nada mais.

`criarAgendamento` **já** aceitava `clientDraft` (nome + telefone) e já reusava cliente existente
pelo telefone. Então não foi preciso ferramenta nova nem regra nova: `preparar_agendamento` ganhou
um `telefone` opcional e, quando a cliente não existe, propõe cadastrar e marcar no MESMO toque —
com o serviço decidindo quem é a pessoa, não o assistente. Refazer essa regra aqui criaria uma
segunda verdade sobre "quem é essa cliente", e é assim que se cria cliente duplicada.

Duas decisões que valem registro:
- **Só cadastra com telefone.** Sem número, o assistente devolve `podeCadastrar` e o prompt manda
  PEDIR o telefone, nunca inventar. Ficha sem contato é ficha que não serve para chamar de volta —
  e chamar de volta é o produto inteiro.
- **O cartão diz "Cadastrar nova"**, com o telefone, além de "Cliente". São duas coisas
  acontecendo num toque só; mostrar apenas "marcar horário" seria a confirmação mentindo por
  omissão — exatamente o que a pesquisa sobre fadiga de aprovação diz que destrói a confiança no
  gesto de confirmar.

---

### 2026-08-30 · Concluir atendimento pelo chat: passa na régua, mas com aviso e URL montada no código

**Pergunta.** O assistente pode concluir um atendimento?

**A régua do `docs/33 §2.1`, item por item.** Manda mensagem para fora? Não. Escreve em registro de
cliente? Sim — abre comanda e credita ponto de fidelidade. Gasta dinheiro? Não, só registra o que já
foi combinado. Alcança mais de uma pessoa? Não, uma cliente por vez. **Passa** — mas com a agravante
que o item 2 não cobre: `done` é estado **terminal** (`core/scheduling/state.ts`: `done: new Set([])`).
Não há transição de saída. A interface não desfaz.

**Decisão: existe, com três travas.**

1. **Só propõe o que a máquina de estados aceita.** A ferramenta filtra `status === 'arrived'` — o
   único estado com transição para `done`. Sem ninguém em atendimento ela devolve
   `nao_da: nenhum_atendimento_em_andamento` com a situação da cliente, e o assistente explica que
   falta marcar "Chegou". Propor o impossível e deixar a rota recusar depois seria fazer o dono
   confirmar para receber erro.
2. **O cartão avisa antes do toque.** `acaoTemVolta` separa por reversibilidade, que é o eixo que a
   pesquisa da Anthropic usa: o que dá para desfazer pode passar batido, o que não dá precisa de um
   gesto consciente. Ação sem volta ganha a linha "Depois de confirmar, não dá para desfazer por
   aqui."
3. **A URL é montada no código, não vem da proposta.** Esta é a que quase passou despercebida. A
   proposta atravessa o modelo, e o modelo lê nome de cliente — campo que o **cliente final**
   preenche no agendamento público. Se a tela aceitasse uma rota vinda dali, o destino do POST seria
   influenciável por texto de terceiro. `core/assistente/acoes.ts` fixa o formato e aceita da
   proposta só o id, validado como UUID: `../../../admin/config` não vira rota, vira `null`, e o
   botão não dispara nada.

A guarda foi vista reprovando nas duas mutações: sem a validação de UUID a travessia de caminho
passa, e esvaziando a lista de ações sem volta o aviso some da tela em silêncio.

---

### 2026-08-30 · Nota na ficha pelo chat, e a guarda que faltava entre PREPARAR e EXECUTAR

**A régua do `docs/33 §2.1`.** Manda mensagem para fora? Não. Escreve em registro de cliente? Sim.
Gasta dinheiro? Não. Alcança mais de uma pessoa? Não. É a de **menor risco das quatro**.

**Correção do que este parágrafo dizia antes.** Registrei nota como "totalmente reversível". Está
errado, e conferir em vez de deduzir foi o que mostrou: `client_notes` **não tem rota de exclusão**
em lugar nenhum do produto — nem API, nem tela. Nota criada fica. Ela continua sendo a de menor
risco, porque é aditiva e não dispara nada, mas o eixo da reversibilidade é o que decide o aviso no
cartão, e chamar de reversível o que não é envenena a próxima aplicação da régua.

Uma trava, ainda assim: nota na ficha **errada** é pior que nota nenhuma. Vira informação falsa
sobre uma pessoa que ninguém vai desconfiar depois, porque ficha de cliente é lida como verdade. Por
isso reusa `resolverPorNome` igual às outras — empatou, pergunta.

E o prompt manda copiar a anotação **palavra por palavra**. Um modelo que "melhora" o texto do dono
está escrevendo na ficha uma coisa que ele não disse.

**O achado desta rodada foi outro, e vale para todas as ferramentas.** Toda ferramenta declara uma
`permissao`, e a rota que executa exige a dela. As duas estão certas sozinhas — só a **distância
entre elas** pode estar errada. Se a da ferramenta for mais frouxa, o assistente monta a proposta, o
cartão aparece, o dono confirma e leva 403. Nenhum teste pega: cada metade passa.

`tests/unit/assistente/permissao-igual-a-da-rota.test.ts` lê a permissão **do arquivo da rota** e
compara com a do catálogo real. Escrever a permissão esperada dentro do teste seria exatamente a
guarda cega de 2026-08-25 — passaria verde com a rota mudando embaixo.

Três coisas fazem a guarda não ser cega, e as três foram vistas reprovando:
1. Afrouxar a permissão da ferramenta reprova.
2. Ferramenta `preparar_*` nova **sem entrada no mapa** reprova — senão a próxima nasce sem guarda e
   a suíte segue verde por omissão.
3. Rota **sem** `exigirPermissao` faz a guarda **gritar**, não passar vazio. Este é o guard contra o
   próprio detector: um regex que para de casar é como as três guardas cegas sobreviveram.

---

### 2026-08-30 · Item na comanda e cadastro de cliente: as duas travas que o modelo não pode furar

**Item na comanda — régua do `docs/33 §2.1`.** Mensagem para fora? Não. Escreve em registro de
cliente? Sim. Gasta dinheiro? **Registra** dinheiro, dentro da comanda do próprio atendimento — não
cobra nada de fora. Alcança mais de uma pessoa? Não. Reversível: sim, o item se remove.

A trava central não é nenhuma dessas. É o **preço**. `unitPriceCents` é opcional em
`EsquemaItemComanda`: omitido, o serviço lê o catálogo; preenchido, ele cobra o que veio no corpo.
Se a ferramenta aceitasse preço, um número inventado pelo modelo viraria o valor cobrado da cliente
— e o cartão mostraria **esse mesmo número inventado**. O dono conferiria a invenção contra ela
mesma e confirmaria. Por isso `EsquemaItemNaComanda` não tem campo de dinheiro nenhum: o modelo não
enxerga onde errar, e o que ele mandar por cima o Zod descarta. As duas metades têm guarda, e as
duas foram vistas reprovando com o campo de volta.

Segunda decisão: um nome que existe como serviço **e** como produto vira pergunta, nunca chute.
Produto baixa estoque no fechamento; serviço não. Adivinhar ali tem consequência em duas tabelas.

**Cadastro de cliente — mesma régua.** Escreve em registro de cliente, reversível por soft delete,
não sai da casa, uma pessoa. Passa. Duas travas:

- **Telefone obrigatório**, pela razão já registrada: ficha sem contato não serve para chamar de
  volta, e chamar de volta é o produto. O prompt manda PERGUNTAR — inventar telefone é a pior
  forma do erro, porque parece certo até alguém ligar.
- **Telefone repetido bloqueia; nome repetido só avisa.** Cadastrar de novo quem já existe não dá
  erro — dá uma segunda ficha, e dali em diante o histórico da pessoa se parte em duas sem ninguém
  perceber. Já homônima é comum, e o telefone diferente já provou que é outra pessoa: bloquear ali
  seria o sistema recusando um cadastro legítimo. Então o cartão mostra as fichas parecidas e quem
  decide é o dono, com a informação na frente.

**A guarda de paridade de permissão agora cobre as quatro**, e reprova se uma quinta nascer sem
entrada no mapa.

---

### 2026-08-30 · Um campo `quantidade` derrubou o assistente inteiro em produção

**O achado mais caro da rodada, e ele não estava em nenhuma das quatro ferramentas.**

`z.number().int().positive()` no campo `quantidade` de `preparar_item_na_comanda` gerou
`exclusiveMinimum` no JSON Schema. O Gemini não ignora palavra que não conhece — recusa a
requisição inteira: `Unknown name "exclusiveMinimum" ... Cannot find field`. E como **todas** as
ferramentas viajam no mesmo `tools[0]`, o 400 levou junto as outras: perguntar "quanto faturei"
parou de funcionar por causa de um campo de comanda. `ASSISTANT_UNAVAILABLE` em toda pergunta.

**Typecheck, lint, 1052 testes e build passaram.** Nenhum deles fala com a API do Gemini. Foi mais
um caso do "verde não é prova" do CLAUDE.md, e o mais direto de todos: o verde não sabia da
existência do único juiz que importava.

Também é o motivo de a disciplina mandar **testar em produção de verdade**. Este defeito não tinha
como aparecer na máquina.

**O conserto: lista do que PODE, não do que não pode.** `paraJsonSchema` já descartava `$schema` e
`additionalProperties` — a mesma defesa, cobrindo só os dois casos que já tinham acontecido. Uma
lista de proibidos só conhece os erros do passado: a próxima palavra que o Zod resolver emitir
passaria direto e derrubaria tudo de novo. `core/assistente/json-schema.ts` inverte para uma lista
de permitidos, aplicada em profundidade. O que sai fora afrouxa a descrição para o modelo e não
enfraquece nada de verdade — quem valida é o Zod no servidor, que roda depois.

A guarda percorre o schema de **toda** ferramenta e reprova em palavra fora da lista. Vista
reprovando com a limpeza desligada, e ela pegou de saída que `pattern` e `minLength` já viajavam
para a API antes — o Gemini tolerava esses dois, e era só questão de qual palavra chegaria primeiro.

---

### 2026-08-30 · O erro de argumento precisa dizer QUAL campo, e é consequência direta da limpeza de schema

Quando os argumentos do modelo não passam no Zod, o laço devolvia a frase fixa "Argumentos
inválidos para esta ferramenta." — e frase fixa é beco sem saída: sem saber qual campo nem por quê,
a correção mais provável do modelo é repetir o mesmo erro. Com `MAX_CHAMADAS_DE_FERRAMENTA = 3`, as
voltas queimam às cegas e o dono recebe "não consegui terminar de responder" numa pergunta que
falhou por um traço no lugar errado.

Isso ficou mais provável **hoje**, pela limpeza de schema para o Gemini: `pattern` e `minLength` não
viajam mais, então o formato que antes ia no schema agora só existe na descrição, e o Zod virou a
única checagem de verdade. Uma checagem que não explica o que quer é uma checagem que o modelo não
consegue obedecer. Medido em produção antes de mexer: `AAAA-MM` e `AAAA-MM-DD` continuam saindo
certos só com a descrição — o conserto é para quando não saírem, não para um defeito ativo.

Nunca inclui o valor recebido, só caminho e mensagem: o valor pode ser nome ou telefone que o dono
ditou, e ele entraria no histórico da conversa e no log do provedor sem nenhum ganho.

**E a mutação ensinou algo sobre a própria guarda de vazamento.** Duas tentativas de fazê-la
reprovar passaram verdes: as `issues` do Zod simplesmente não carregam o valor recebido, então
vazar por ali é impossível e a guarda não tinha o que pegar. Guarda que nada consegue reprovar é
decoração. O que ela protege de verdade é a **assinatura** — alguém "melhorando" a função para
receber os argumentos crus e "dar mais contexto ao modelo". Essa mutação reprova, e é ela que
justifica a guarda existir.

Registro também dois falsos positivos descartados nesta rodada, porque descartar contou como
trabalho: o painel do assistente "não abrir" era leitura errada da árvore de acessibilidade (ele
abre — `role="dialog"`, `data-state=open`, textarea presente), e o overlay com `opacity: 0`
bloqueando clique era a aba oculta congelando a animação em `currentTime: 0`. Nenhum dos dois é
defeito.

---

### 2026-08-30 · O cartão de confirmação saía EM BRANCO em três das quatro ferramentas novas

**Medido no navegador, em produção: o `<dl>` do cartão com ZERO filhos.** O dono via um botão
"Confirmar" sobre uma caixa vazia.

A causa é de uma banalidade que assusta. O cartão procurava uma **lista fixa** de seis chaves
minúsculas — `cliente`, `clienteNova`, `servico`, `profissional`, `quando`, `precoCents` — escrita
quando `preparar_agendamento` era a única ferramenta que existia. As três de hoje devolveram
`Cliente`, `Telefone`, `Anotação`. JavaScript diferencia maiúscula: toda busca deu `undefined`, o
`.filter()` descartou tudo, e o `<dl>` ficou vazio sem erro nenhum.

**É a pior forma do erro possível neste produto.** A proposta estava certa, o JSON estava certo,
1069 testes verdes, o build limpo, e o único pedaço em branco era exatamente aquele que uma pessoa
de verdade tinha que ler para decidir se confirmava. O comentário que fica logo acima desse código
já avisava: *"confirmação que a pessoa não consegue julgar vira clique automático, e aí não protege
ninguém."* O código embaixo do comentário fazia o contrário do que ele dizia.

E só apareceu porque a rodada anterior **abriu a tela e olhou o elemento**. Os testes de proposta
passaram, a resposta da API veio perfeita nas quatro, e nada disso toca em renderização — mesma
lição de `auditoria-medir-nao-estimar`, agora com um caso onde o defeito estava a um `Object.keys`
de distância.

**O conserto tira a lista fixa do caminho.** `core/assistente/resumo.ts` DERIVA as linhas do
`resumo`: chave conhecida ganha rótulo e formatação próprios, e qualquer outra aparece com o
próprio nome. Ferramenta futura não consegue mais nascer com cartão em branco — que era a
verdadeira falha, não as três chaves erradas. Chave terminada em `Cents` é dinheiro venha de onde
vier, senão um `totalCents` novo apareceria como "4500" na tela.

A guarda lê as chaves de `resumo` **do código-fonte das ferramentas** e passa pelo renderizador
real, exigindo que toda chave declarada vire linha. Vista reprovando com a lista fixa de volta (5
casos) e com o extrator cego (aí ela grita, em vez de aprovar por não ter o que checar).

---

### 2026-08-30 · "expired" aparecia em inglês na ficha da cliente

Varrendo o resto do produto atrás da MESMA classe do cartão em branco — tela que lê uma lista fixa
de chaves enquanto a fonte cresce — apareceu um caso vivo.

`appointment_status` tem **sete** valores no banco. O `ROTULO_STATUS` da ficha da cliente traduzia
seis: faltava `expired`. E `expired` é alcançável de verdade — `pending → expired` está na máquina
de estados. O `?? h.status` no fim da linha, que existe justamente para não quebrar, fazia a tela
mostrar a palavra inglesa crua **"expired"** no histórico, numa tela inteira em português.

A causa é a de sempre: dois lugares guardando a mesma verdade. `appointment-row.tsx` já traduzia
(`expired: 'Vencido'`); a ficha era uma segunda cópia que ficou para trás.

**O que NÃO foi feito, de propósito:** fundir os dois mapas. Os rótulos diferem por gramática, não
por descuido — na linha da agenda o sujeito é o agendamento ("Concluído", "Cancelado"), na ficha é
a cliente ("Atendida", "Cancelada"). Unificar quebraria o português. O conserto certo era outro:
tipar os mapas por `EstadoAgendamento` e `EstadoCiclo` em vez de `Record<string, …>`, e apertar os
tipos na origem (`crm.ts` devolvia `status: string`). Agora acrescentar um estado quebra o build
nos dois lugares — que é onde tem que quebrar.

**Mas o TypeScript só conhece a união, e não sabe se ela ainda bate com o ENUM do banco.** Essa
costura é por onde o buraco entrou, e é o que a guarda nova cobre: lê o `create type … as enum` das
migrações e a união do código e exige que sejam iguais.

Nota sobre a própria guarda: ela nasceu **gritando**, porque um `\s` dentro de template literal
vira `s` e o regex parou de casar. Foi ela que me avisou do meu próprio defeito, em vez de aprovar
vazia — que é exatamente o que se pede dela. Consertado com `String.raw`, e a mutação confirma:
extrator quebrado reprova, união sem `expired` reprova.

Também conferidos e SEM lacuna: `ROTULO_MENSAGEM` cobre os 6 de `message_kind`,
`ROTULO_CONSENTIMENTO` cobre os 4 de `consent_type`, `ROTULO_CICLO` cobre os 5 de `cycle_state`.
`ROTULO_ORIGEM` é de texto livre (`source` é string no schema), então o `?? cliente.source` ali é
correto e não é lacuna.

---

### 2026-08-30 · "Ver comanda" levava a uma mentira: "O endereço não existe ou mudou de lugar"

A ponte `/admin/comanda/agendamento/[id]` chamava `notFound()` quando o agendamento não tinha
comanda. A tela então dizia *"O endereço não existe ou mudou de lugar"* — e isso é **falso**: o
endereço está certo e o agendamento existe; o que não existe é a comanda. O dono passa a duvidar do
endereço, quando devia duvidar do dado.

**O tamanho disso só apareceu medindo o banco: 263 de 263** atendimentos concluídos da Barbearia
Dom Rocha — o tenant de demonstração — estão nesse caso. E é 100% em todos os tenants. Ou seja,
hoje, TODO atendimento concluído do sistema mostra um botão que leva a esse beco.

**Diagnóstico honesto da causa:** não é defeito de código de hoje. `POST .../complete` é o único
caminho para `done` e sempre cria a comanda (`concluirAgendamento`); a importação de clientes não
cria agendamento; o PATCH genérico só remarca e cancela. Os 263 vieram de semente escrita direto no
banco. **Mas dado histórico não some por o código ter melhorado** — quem abrir a demo hoje encontra
o beco, e um salão que migrar histórico por SQL cairá no mesmo lugar.

O conserto é a frase, não o fluxo: em vez de `notFound()`, um estado vazio que diz a verdade
("Esse atendimento não tem comanda... foi concluído antes disso") com caminho de volta — §4, estado
vazio nunca é beco sem saída.

**O que NÃO foi feito, e é a parte importante:** criar a comanda que falta. Abrir comanda é escrita
em registro de dinheiro, e uma navegação (GET) que escreve transforma um refresh em dois
lançamentos. Também não foi feito backfill dos 263 — isso é migração de dado financeiro e é decisão
do dono, não minha.

Varridos os outros `notFound()` do app: os cinco restantes (`!perfil`, `!ficha`, `!profissional`)
são legítimos — ali o endereço realmente não existe. Nenhuma outra ocorrência da mesma armadilha.

Sem guarda nova de propósito: o que restaria seria varrer o arquivo atrás de `notFound(`, que é
exatamente o padrão brittle que o CLAUDE.md registra como fonte de guarda cega. A verificação aqui
é a tela no ar.

---

### 2026-08-30 · O assistente inventava que "está tudo certo" sobre o que o plano esconde

**O achado mais sério do dia, e ele veio de uma pergunta banal.** Num tenant sem o módulo `stock`:

> **pergunta:** "quais produtos estão acabando no meu estoque?"
> **resposta:** "Não há alertas de estoque no momento. Todos os itens estão com níveis adequados."
> **ferramentasUsadas:** `["resumo_de_hoje"]` ← nada a ver com estoque

A ferramenta de estoque está escondida por plano, e isso está **certo**. O errado é o que acontece
depois: o modelo não percebe a AUSÊNCIA dela, pega uma ferramenta qualquer e preenche o vazio com
a resposta mais simpática. O dono é informado de que o estoque está bem quando o sistema
literalmente não pode saber — e descobre a falta com a cliente na cadeira. Reproduzido duas vezes,
com perguntas diferentes.

É a mesma armadilha que o `catch` do laço já registra em código — *"resposta vazia parece 'você não
tem nada atrasado', que é mentira"* — agora uma camada acima, no modelo. O CLAUDE.md chama isso de
falso verde; aqui é falso "está tudo bem", que é a versão que chega ao dono.

**O prompt JÁ mandava** *"se a pergunta exigir um dado que nenhuma ferramenta traz, diga que não
consegue responder isso"*. Não bastou, e o motivo é o que interessa: a instrução é **passiva**. O
modelo não enxerga o que não está na lista — ele vê o que TEM e assume que cobre a pergunta. Vazio
não é um sinal; só vira informação quando alguém diz o nome dele.

Então o prompt passou a nomear o que falta e por quê, com uma frase que é o coração do conserto e
não detalhe de redação: *"NUNCA responda que está tudo certo... você não tem como saber, e dizer
que está tudo bem é pior do que não responder."*

Dizer o **motivo** também é a regra 5.2 do plano de monetização: bloqueio mostra o motivo e o
caminho. Sumir em silêncio esconde do dono o que ele poderia comprar — e o plano grátis tem
`assistant` mas não tem `register` nem `stock`, então este é o caminho do funil de entrada inteiro,
não um canto raro.

Guarda vista reprovando em duas mutações: o aviso não chegando ao prompt (4 casos) e a frase
anti-confabulação removida sozinha (1 caso).

**Negativos desta rodada, que também são entrega:** o módulo de comanda foi auditado e está
saudável — `cost_cents` já multiplica pela quantidade (hipótese de lucro inflado descartada),
`fecharComanda` e `cancelarComandaFechada` travam a corrida no próprio UPDATE, o estorno gera
movimento `return` em vez de apagar o `out`, o caixa soma de uma fonte só (sem dupla contagem) e o
núcleo tem 18 testes, incluindo propriedade. Também conferida a paridade de MÓDULO entre ferramenta
e rota (bate), e o filtro por módulo roda antes de montar o pedido (correto).

Registrado como lacuna de produto, sem conserto: **não existe comanda avulsa**. O único caminho é
concluir um agendamento, então um cliente de passagem que só leva um produto não tem por onde ser
lançado — e o caminho do dinheiro não é exercitável de ponta a ponta sem uma ação irreversível.

---

### 2026-08-30 · "Espere um instante" para uma espera de 24 horas

Achado por acidente, e vale registrar o acidente: esbarrei no limite do próprio assistente
testando o conserto anterior. A resposta veio com `"Espere um instante e tente de novo."` e, no
mesmo corpo, `retryAfterSeconds: 86400`.

As janelas deste produto vão de 2 segundos a 86.400 e **todas** recebiam a mesma frase, porque
`RATE_LIMITED` tinha uma mensagem fixa e `limiteDeTaxa()` só preenchia o `Retry-After`. Para o
limite diário do assistente (60 perguntas por salão), "um instante" são 24 horas.

Terceira ocorrência da mesma classe hoje — **a frase não descreve o fato** — depois do cartão em
branco e do "O endereço não existe ou mudou de lugar". O dano aqui é específico: quem lê "um
instante" tenta de novo em vinte segundos, tenta em um minuto, e conclui que o produto quebrou,
quando ele está funcionando exatamente como projetado e só não soube dizer isso.

`core/http/espera.ts` faz a frase acompanhar a janela. Uma decisão de redação merece registro: no
caso diário ele diz "Tente de novo mais tarde" e **não** promete "amanhã". A janela é deslizante —
o crédito volta aos poucos, não à meia-noite — e prometer hora certa seria trocar uma frase errada
por outra.

A guarda tem um caso para a costura, não só para a função: `AppError.limiteDeTaxa(86_400)` tem que
carregar a frase certa. Sem ele, o teste aprovaria uma função que ninguém chama — e a primeira
mutação (tirar `message:` do `AppError`) foi exatamente esse caso, reprovando só ali.

---

### 2026-08-31 · A proteção que se desligava sozinha no escuro: "não sei" virava "não tem nada"

Sair da conta APAGA a fila offline do aparelho. A tela já tinha a proteção certa e o argumento
certo, escrito em 25/08: contar o que não subiu e avisar, porque *"descartar trabalho de alguém em
silêncio é o tipo de coisa que a pessoa só descobre no dia seguinte, quando o cliente aparece para
um horário que não existe"*.

Só que a contagem vinha de `listarMutacoes().catch(() => [])`. Esse `catch` transforma **"não
consegui LER a fila"** em **"a fila está VAZIA"** — e aí o portão é pulado exatamente na hora em que
mais importa. IndexedDB falha de verdade: janela anônima, armazenamento cheio, base corrompida,
navegador com dados de site bloqueados. A proteção existia, estava testada, e se desligava sozinha
no escuro sem nada reprovar.

É a armadilha do "catch que descarta" da tabela do CLAUDE.md, e a mesma família das três frases de
ontem: **a tela afirma um fato que ninguém verificou** — aqui, a afirmação implícita "não há nada
pendente".

Agora "não sei" é um estado próprio (`core/offline/aviso-de-saida.ts`), com texto próprio: não
inventa número e também não finge que está tudo certo, porque as duas coisas seriam inventar.
Diante da dúvida, avisa — o custo de avisar à toa é um toque; o de não avisar é perder doze
agendamentos.

**Duas coisas que a rodada ensinou sobre guardas, e as duas por reprovação:**

1. **A guarda que já existia me pegou.** `tests/unit/shell/sair-da-conta.test.ts` reprovou minha
   refatoração porque casava com os nomes antigos. Reescrevi para verificar a INTENÇÃO (o portão
   consulta a regra; o aviso mostra a quantidade; existe o caso "não sei") e depois **mutei a
   própria reescrita** — portão removido e aviso do "não sei" removido — para provar que não
   enfraqueci ao atualizar. Atualizar guarda que reprova é o momento mais fácil de afrouxá-la sem
   perceber.
2. **Minha guarda nova caiu na armadilha nº1 da tabela do CLAUDE.md**, na primeira tentativa:
   ancorei em `drenarFilaPendente`, cuja primeira ocorrência é a linha de `import`, e o recorte
   pegou o arquivo inteiro. O mesmo erro que o comentário do teste vizinho já registrava. Corrigido
   ancorando em `await drenarFilaPendente(`.

**Correção de algo que EU escrevi ontem:** o comentário em `core/http/espera.ts` afirmava que a
janela do limitador é deslizante e "o crédito volta aos poucos". É **fixa** — `expiraEm` é gravado
na primeira requisição e a contagem zera de uma vez. Afirmei um mecanismo sem conferir, que é o
defeito que venho catando nos outros. A frase genérica continua certa por outro motivo, agora
escrito: `limiteDeTaxa()` recebe o TAMANHO da janela, não quanto falta dela.

Fica registrado, sem conserto: por isso o `Retry-After` também superestima a espera. Consertar exige
devolver o instante de reset nos três backends (memória, Upstash e a RPC `consumir_rate_limit`, que
é migração), e fazer só num deles deixaria o cabeçalho certo às vezes — pior do que errado sempre.

Verificado em produção nesta rodada: a mensagem do TICKET-054 está no ar ("Você atingiu o limite de
uso de hoje"). O caminho feliz do assistente segue **não** reverificado — a cota do tenant de teste
ainda não voltou, e a janela é fixa, então volta de uma vez.

---

### 2026-08-31 · A outra rota agendada rodava seis vezes por dia sem ninguém olhando

Em 26/08 o Motor de Ciclo passou dois dias sem processar tenant nenhum, com HTTP 200 e job verde. O
conserto foi dar heartbeat a ele e vigiá-lo em `/api/health`.

**O conserto olhou o job que tinha falhado, não a pergunta que o defeito fazia:** *quais jobs
agendados ninguém observa?* Cinco dias depois, `segments` — a OUTRA rota do `on.schedule`, seis
disparos por dia — continuava sem heartbeat e sem checagem. Se falhasse em todo disparo,
`/api/health` ficaria verde para sempre, porque a **ausência de sinal era lida como "está tudo
bem"**. É a mesma família das quatro frases desta semana: a interface afirma um estado que ninguém
verificou.

Medido antes de mexer, para não consertar o que não estava quebrado: `recompute_cycles` bateu há
12h (dentro da janela, com o atraso de horas já documentado do GitHub Actions) e os 111 ciclos foram
recalculados nos últimos 2 dias. O Motor está saudável — o problema era só o vizinho sem vigia.

Agora `segments` grava `recompute_segments`, com o mesmo `> 0` de `recompute-cycles`: "a rota foi
chamada" já era verdade nos cinco disparos zerados de 26/08; o que precisa ser observável é que
algum tenant teve segmento recalculado.

**A guarda é para a PERGUNTA, não para o caso.** `todo-cron-agendado-tem-heartbeat.test.ts` cobre os
três pontos da costura, cada um visto reprovando: rota agendada sem `kind` no mapa; `kind` no mapa
mas rota que não chama `registrarHeartbeat` (o defeito espelhado — promete sinal que ninguém emite);
e sinal gravado que `/api/health` não lê. Rota nova no `schedule` sem vigia agora reprova antes de
virar mais um silêncio de dois dias.

**Uma armadilha que quase entrou junto**, e que o próprio `agendadas.ts` já avisava: *"um heartbeat
que nunca rodou está sempre atrasado por definição"*. Como `recompute_segments` nunca rodou, o
`/api/health` fica **503 até o primeiro disparo** — reintroduzindo o vermelho permanente que o
conserto de 26/08 removeu. Por isso o passo seguinte não é opcional: disparar `segments` à mão pelo
`workflow_dispatch` logo após o deploy, o que também verifica o heartbeat novo de ponta a ponta.

---

### 2026-08-31 · SEO: o que faltava era prévia, dados ricos e llms.txt — não sitemap

Pedido: "implementa sitemap, robots, llms.txt e SEO". Auditado antes de escrever, e **metade já
existia e estava bem feita**: `sitemap.ts` lista os tenants ativos com revalidação de 1h e deixa o
tenant de demonstração de fora; `robots.ts` bloqueia painel, API e rotas de sessão; a página do
salão já tinha canonical, openGraph, twitter e `noindex` na demo. Não refiz nada disso.

O que faltava de verdade:

**1. `metadataBase` + imagem de prévia.** Sem `metadataBase`, todo caminho relativo de imagem em
`openGraph` fica relativo e o WhatsApp não resolve — o link do CICLO colado num grupo aparecia sem
prévia nenhuma. Para um produto cujo canal de aquisição é o link mandado de um profissional para
outro, isso é a vitrine fechada.

A imagem é **gerada** (`opengraph-image.tsx`, `ImageResponse`) e não um PNG em `public/`, por uma
medição: os dois arquivos de marca são 1102×448 (2,46:1) e 894×950 (0,94:1), e o formato que as
redes cortam é 1200×630 (1,91:1). Usar qualquer um direto entrega o logo cortado ou espremido.

**2. Dados estruturados de verdade.** Já existia um `jsonLdNegocioLocal` inline com quatro campos e
`@type: 'LocalBusiness'` genérico. Foi **substituído** — não duplicado — por
`core/seo/dados-estruturados.ts`, que agora usa o `vertical` do tenant para dizer `HairSalon`,
`NailSalon` ou `TattooParlor` (especificidade é o que o buscador usa para casar com a intenção),
mais `aggregateRating`, `priceRange`, `hasOfferCatalog` e `sameAs`.

Três decisões que valem mais que o código:

- **`aggregateRating` só com avaliação de verdade.** Com `ratingCount: 0` o Google trata como
  marcação inválida e pode desqualificar o resultado rico da página inteira — o oposto do objetivo.
  Salão novo simplesmente não tem estrelas.
- **Serviço por hora não vira oferta.** Anunciar o valor da hora como preço do serviço faz a busca
  mostrar um número que a cliente não vai pagar, e preço errado na busca é pior que preço nenhum.
- **Endereço vai como `streetAddress` de um `PostalAddress`**, não decomposto: o cadastro é texto
  livre e inventar cidade/estado/CEP daria endereço errado em resultado rico.

O tenant de demonstração não recebe marcação nenhuma, pelo mesmo motivo que já está fora do sitemap.

**3. `/llms.txt`.** Rota gerada, não arquivo estático, e por uma razão registrada: preço de plano
fora de `core/billing/planos.ts` é proibido neste repo, com guarda. Um `public/llms.txt` com
"R$ 49" seria a primeira coisa que um modelo lê e a última que alguém lembra de atualizar. Os
planos e a lista de módulos saem de `precoDoPlanoPorMes()` e `CATALOGO`.

**A guarda do llms.txt nasceu errada e o erro é instrutivo.** A primeira versão varria o
arquivo-fonte proibindo `/R\$\s*\d/` — e reprovou casando com "R$ 49" dentro de um COMENTÁRIO que
explicava justamente por que não escrever preço à mão. É a armadilha nº1 da tabela do CLAUDE.md.
Reescrita para chamar o handler e conferir o TEXTO SERVIDO contra `precoDoPlanoPorMes()`: deixa de
ser varredura de fonte, vira teste de comportamento, e ainda prova que a rota responde.

---

### 2026-08-31 · Os tenants de teste de plano estavam no sitemap de produção

Achado **baixando o `/sitemap.xml` do ar**, não lendo código — e essa é a parte que importa. O
`sitemap.ts` estava certo, o `ehDemonstracao` estava certo; a lista só não conhecia
`teste-essencial`, `teste-equipe` e `teste-avancado`. Eles são as contas criadas para exercitar
cada degrau de plano, não são negócio nenhum, e estavam sendo entregues ao Google como
estabelecimentos. É o mesmo defeito que criou `core/tenants/demonstracao.ts`, com outro nome.

Adicionados à lista, que é exatamente o caso que ela cobre: slug conhecido e permanente.

**NÃO tocados, e a decisão é do Eduardo:** `lang-barber` e `lang-unhas` também estão no sitemap.
Pela aparência (1 e 0 clientes) parecem contas de experimento, mas tirar do buscador a página de um
salão de verdade é pior do que deixar uma conta de teste indexada — então fica perguntado, não
adivinhado.

Nota de processo: mutei este arquivo sem commitar antes, e o `git checkout --` da restauração levou
junto a correção. É literalmente o passo 1 do procedimento de teste-guarda do CLAUDE.md
("Commite antes de mutar"), e ele existe porque isso já custou um conserto commitado sem o código
que ele guardava.

---

### 2026-08-31 · O cadastro por e-mail NÃO está quebrado — a `docs/31` §6 está desatualizada

`docs/31-LANCAMENTO-AUDITORIA-E-PLANO.md` §6 item 1 afirma que, sem trocar o Site URL no Supabase,
*"o link de confirmação de e-mail continua caindo em `localhost:3000`"*. Repeti isso num relatório
para o Eduardo antes de conferir. Fui conferir, e é falso.

**A medida que decide.** Em `auth.users` há 17 usuários, todos confirmados. O que separa "confirmou
clicando" de "nasceu confirmado" é a distância entre `created_at` e `email_confirmed_at`:

| conta | envio de confirmação | demora para confirmar |
|---|---|---|
| `merlin.ia.smart@gmail.com` | **sim** | **24,7 s** |
| `teste.*@ciclo.app` (3) | não | ~4 ms |
| `*.ciclo.test` (13) | não | ~3 ms |

Vinte e quatro segundos é uma pessoa abrindo o e-mail e clicando. Os outros dezesseis foram criados
por script/admin, sem envio, confirmados no mesmo instante. O código já mandava
`emailRedirectTo: ${NEXT_PUBLIC_APP_URL}/auth/callback` explicitamente, e o Supabase o honrou.

O que continua verdade, e mudou de natureza: trocar o domínio **sem** atualizar Site URL e Redirect
URLs no Supabase quebra a confirmação. Deixa de ser "está quebrado, o domínio conserta" e passa a
ser "funciona, e o domínio pode quebrar se feito pela metade" — que é um aviso, não um bloqueador.

Também conferido nesta rodada, e correto: os tenants de teste estão `noindex, nofollow` **e** fora
do sitemap (as duas metades da mesma lista); o tenant de demonstração não emite JSON-LD; e a página
pública do salão não vaza identidade — a consulta de avaliações seleciona `rating, comment,
created_at` e nada mais, então não há como o nome de uma cliente aparecer ao lado da nota.

---

### 2026-08-31 · O Motor de Ciclo foi para o centro da barra; marcar horário assumiu o slot dele

Pedido do Eduardo, e a razão de projeto sustenta o pedido: **o slot central é o único que o polegar
alcança sem reposicionar a mão**, e estava com a ação mais COMUM do dia — não a mais valiosa.
Marcar horário é o que qualquer caderno faz. O Motor de Ciclo é o que justifica o produto ter
preço, e vivia no canto direito, que é de onde as coisas somem da rotina. Um recurso que precisa
ser LEMBRADO não gera receita — e receita recuperada é justamente a que ninguém buscaria sozinho.

Foi uma troca, não uma remoção: "Marcar" ocupou a quarta aba, e continua também nos botões da tela
"Hoje" e da agenda, que são de onde o gesto costuma partir de verdade.

**Duas coisas quebraram na troca, e as duas eram guardas antigas fazendo o trabalho delas:**

1. **Duas abas acendendo ao mesmo tempo.** `/admin/agenda/novo` casa com a aba Agenda por PREFIXO e
   com a própria Marcar por igualdade. Sem desempate, a barra diria à pessoa que ela está em dois
   lugares. Resolvido com `hrefDaAbaAtiva`: vence a mais específica.

2. **O formulário perdeu o botão voltar.** A regra era *"está na lista de abas ⇒ sem voltar"*, e
   fazia sentido enquanto toda aba era um destino de topo. `/admin/agenda/novo` é um FORMULÁRIO
   aninhado sob a Agenda: quem chega pelo botão da agenda ficava sem saída. A barra continuaria
   ali, mas "voltar para a agenda" e "trocar de aba" não são o mesmo gesto nem levam ao mesmo lugar
   na cabeça de quem usa.

   A regra passou a ser **topológica em vez de baseada na lista**: uma aba cujo href é sub-rota de
   OUTRA aba é um formulário, e mantém o voltar do pai. Isso é mais verdadeiro do que a regra
   antiga era mesmo antes desta mudança — a lista era um proxy para "é raiz", e o proxy quebrou
   assim que uma aba deixou de ser raiz.

Quatro mutações, quatro reprovações: Motor de volta ao canto; desempate removido; regra de voltar
baseada na lista de novo; e a checagem de que as abas de topo de verdade continuam sem voltar.

---

### 2026-08-31 · Promover a tela expôs o estado vazio dela: uma frase para três situações

Consequência direta de pôr o Motor de Ciclo no botão central. A tela era um destino de canto e
passou a ser a primeira coisa que um salão novo toca — e o que ela dizia quando a lista está vazia
era: *"Ninguém para recuperar agora / Volte mais tarde"*, com o "Volte mais tarde" passado como a
prop `acao` do `EmptyState`.

Duas coisas erradas aí, e a segunda é a que interessa:

1. **A mesma frase para três situações**, das quais só uma é boa notícia: salão sem cliente
   cadastrada, salão com cliente mas sem atendimento concluído (o ciclo nasce do atendimento, não
   da ficha), e salão com tudo em dia. As duas primeiras têm o que fazer; a terceira é vitória e
   precisa soar como tal.

2. **A "ação" era texto.** `EmptyState` exige a prop `acao` com um comentário explícito — *"estado
   vazio nunca é só 'nenhum resultado'. Tela vazia sem saída é beco sem saída"* — mas o tipo é
   `React.ReactNode`, então um `<span>` satisfaz a obrigação sem cumprir nada. A regra existia e
   era contornável sem ninguém notar.

**A varredura da mesma classe, e um falso positivo que quase virei relatório.** A primeira medição
acusou 17 telas quebradas. Era o extrator: `icone={<X ... />}` também contém `/>`, e parar no
primeiro recortava o bloco antes da prop `acao`. Medindo direito: **16 dos 17 usos já davam saída
de verdade** — o código estava certo e eu quase reportei o contrário.

O único outro caso de texto é a trilha do cofre, e fica como está **por decisão declarada**: é log
de conformidade alcançado de propósito pelas Configurações, com voltar no topo; vazio ali é boa
notícia (ninguém abriu ficha de saúde) e não há ação a oferecer. A guarda nova exige saída
interativa em todo `EmptyState` e obriga qualquer exceção a trazer o motivo escrito — a exceção
passa a ser visível em vez de acidental.

A escolha da frase virou função pura em `core/ciclo/vazio-de-recuperar.ts`: o que precisa de guarda
é a decisão, não a marcação. Três mutações, três reprovações — o "Volte mais tarde" de volta, as
três situações dizendo a mesma coisa, e o extrator cego (que grita em vez de passar vazio).

---

### 2026-08-31 · "Faturado hoje" era mentira por uma palavra

Dois números de "hoje", de fontes diferentes, e um deles se chamava faturamento:

| tela | rótulo | o que soma |
|---|---|---|
| Hoje | ~~"Faturado hoje"~~ → **"Atendido hoje"** | `appointments.price_cents` dos concluídos — **preço de tabela** |
| Caixa | "Entrou no dia" | `tickets.total_cents` das comandas **fechadas** — o dinheiro |

O número do Hoje não enxerga desconto dado na comanda, item extra lançado nem gorjeta. **Num dia
com desconto, "Faturado hoje" mostra mais do que a pessoa recebeu** — e "faturar", em português de
negócio, é o que entrou. O comentário do serviço reforçava o erro: dizia "faturado de verdade".

Os dois números estão certos para o que medem, e é bom que sejam diferentes: um responde "o que eu
atendi", o outro "o que entrou no caixa". O errado era só o nome de um deles. Achado comparando as
duas telas de propósito — a classe de "duas fontes para a mesma pergunta" que já rendeu o rótulo
`expired` e o cartão em branco esta semana.

Conserto de uma palavra, mas o rótulo virou constante documentada (`ROTULO_DO_ATENDIDO`) em vez de
string solta no JSX: assim o motivo mora ao lado da decisão, e a guarda tem onde ancorar sem casar
com texto que aparece por outro motivo. A segunda mutação foi exatamente essa — transformar de
volta em string solta faz a guarda GRITAR ("se virou string solta, este teste fica cego") em vez de
passar vazia.

Não mudei a matemática de propósito. Somar comandas no Hoje mostraria zero até alguém fechar a
comanda, e a tela principal do dia ficaria mentindo para baixo em vez de para cima — trocar uma
mentira por outra.

---

### 2026-08-31 · "Já gastou" na ficha: número de ontem, sobre preço de tabela

Puxando o fio de "Faturado hoje", a mesma classe apareceu por cliente — e mais grave, porque aqui o
número tem nome de pessoa ao lado.

**Defasagem.** "Visitas" e "Já gastou" vinham de `clients.visits_count` e `clients.ltv_cents`.
Rastreado até o único escritor: `recalcularSegmentosDoTenant`, ou seja o cron `segments` — o mesmo
que esta madrugada eu descobri rodando **sem vigilância nenhuma**. Ele recalcula tudo do zero uma
vez por dia, e o atraso real do GitHub Actions nesta base é de 5 a 6 horas. Concluir um atendimento
às 14h e abrir a ficha da cliente mostrava o número de ontem.

Isso também recontextualiza o heartbeat de ontem: se aquele cron parasse, não era só segmentação
que congelava — era o histórico de valor de toda cliente, em silêncio.

**Preço de tabela.** E "Já gastou" prometia mais do que sabe: o valor sai do `price_cents` do
AGENDAMENTO, então não enxerga desconto dado na comanda nem item extra. Dizer a uma dona de salão
que a cliente "já gastou R$ 540" quando ela deu R$ 60 de desconto ao longo do ano é errar sobre uma
pessoa específica. Virou **"Valor atendido"**, a mesma palavra de "Atendido hoje": no CICLO
"atendido" passa a ser preço de tabela e "entrou" é dinheiro no caixa. Vocabulário, não sinônimo.

**O conserto da defasagem custa zero de latência.** O histórico da ficha não servia para recalcular
— é `limit(40)`, e uma cliente antiga daria um total menor que o verdadeiro, que é pior que
defasado: seria errado com cara de exato. Uma consulta agregada de uma coluna, no mesmo
`Promise.all` que já existia, resolve com exatidão. O ticket médio passou a usar o mesmo valor: com
fontes diferentes, média e total discordariam na mesma tela.

**A guarda nasceu cega e a mutação pegou.** A primeira versão recortava 400 caracteres a partir do
primeiro `metricas: {` — que é a DECLARAÇÃO DE TIPO, não o retorno. Reverter para
`cliente.ltv_cents` passou verde. É exatamente a armadilha da "janela de N caracteres" da tabela do
CLAUDE.md. Reescrita para casar com a leitura em si, em qualquer lugar do arquivo; aí reprova.

---

### 2026-08-31 · O bônus de indicação pagava duas vezes

Puxando o fio das colunas desnormalizadas, o terceiro leitor de `visits_count` não era tela — era
**regra**. E estava errada.

`pontuarAtendimentoConcluido` decidia o bônus de indicação por `cliente.visits_count === 0`, com um
comentário que raciocinava exatamente sobre a defasagem: *"`visits_count` só reflete o job diário —
na conclusão de agora ele ainda mostra o número ANTES desta visita"*. O raciocínio está certo e o
efeito é o oposto do pretendido: **como o contador não muda entre uma conclusão e a seguinte, ele
continua `0` na segunda, na terceira, e em toda conclusão até o cron rodar** — uma vez por dia, com
5 a 6 horas de atraso medido.

Corte e barba marcados como dois atendimentos no mesmo dia bastam para pagar o bônus duas vezes,
para a cliente e para quem indicou. Ponto de fidelidade é resgatável: é dinheiro saindo por engano,
e do jeito mais difícil de perceber — o extrato mostra dois lançamentos com o mesmo motivo e nada
acusa.

**Latente, não ativo:** medido em produção, não existe nenhum lançamento de indicação ainda. Mas
morde o primeiro salão que usar o laço de indicação, que é o canal de aquisição do produto.

O conserto pergunta ao **livro-razão** em vez do contador: se o lançamento existe, o bônus já foi
pago. Idempotente por construção, que é o que uma regra de "primeira vez" precisa ser, e não
depende de cron nenhum. Os dois textos de motivo viraram constantes porque deixaram de ser rótulo:
`MOTIVO_VEIO_POR_INDICACAO` agora é chave de idempotência, e mudá-lo sem migrar as linhas
existentes repagaria o bônus de quem já recebeu — está escrito lá.

**Duas guardas antigas reprovaram a refatoração, e as duas estavam certas.** Uma casava com a
condição inteira (`referred_by && visits_count === 0`), a outra com o literal `'Indicou um novo
cliente'` — que virou constante e mudou de posição no arquivo, passando a ficar ANTES da trava de
módulo e fazendo a guarda medir a declaração em vez do lançamento. Reescritas para ancorar no USO,
e depois **mutadas** para provar que ainda pegam o que existiam para pegar: fidelidade sem ler
`referred_by`, e bônus fora da trava de módulo.

**Minha guarda nova nasceu casando com o próprio comentário** que explica por que não usar mais
`visits_count` — segunda vez hoje (a primeira foi "R$ 49" dentro do comentário do `llms.txt`).
Passou a ignorar linhas de comentário antes de casar.

---

### 2026-08-31 · Dinheiro tem duas palavras, e cinco cópias do detector de comentários

**Fim da varredura dos leitores de `ltv_cents`.** A tela de criar campanha dizia "já gastou R$ X"
sobre cada cliente da lista — mesma imprecisão da ficha, e aqui ao lado da decisão de quem recebe
mensagem. Virou "R$ X em atendimentos".

O "ainda não gastou" virou **"ainda sem atendimento"**, e a troca não é cosmética: com o cron
atrasado, uma cliente atendida hoje ainda aparece zerada, e dizer que ela "não gastou" erra sobre
uma pessoa. Dizer que não há atendimento registrado descreve o REGISTRO, e é sempre verdade.

**Deixada como está, por decisão:** a lista de clientes mostra o valor sem rótulo, ao lado de
"12 visitas" — lê-se como "valor dessas visitas", que é o que é. Não afirma "gastou", então não
entra na regra. Mudar tudo o que casa com um padrão é como uma guarda fica ruim.

O vocabulário virou guarda: **nenhuma tela que exibe valor derivado de preço de tabela pode chamá-lo
de "faturado" ou "gastou"**. No CICLO, "atendido" é preço de tabela e "entrou" é dinheiro no caixa.

---

**E o achado de infraestrutura, que vale mais que a copy.** A guarda nova reprovou casando com
"gastou" dentro do meu próprio comentário JSX — **terceira vez no mesmo dia** (antes: "R$ 49" no
comentário do `llms.txt`, `visits_count` no comentário do `fidelidade.ts`).

Investigando, achei **cinco cópias** de `semComentarios` espalhadas pelos testes, com
implementações diferentes. As três antigas estavam certas por acidente feliz — remover `/* … */`
também apaga o miolo de `{/* … */}`. As duas escritas hoje filtravam por PREFIXO DE LINHA e eram
cegas a comentário JSX, cujas linhas internas não começam com `*`.

Cinco cópias divergentes de uma regra é a mesma armadilha de "duas fontes da mesma verdade" que
este projeto persegue no produto — aplicada à ferramenta que faz a perseguição. Consolidadas em
`tests/helpers/fonte.ts`.

A mutação que prova a consolidação é a mais bonita da noite: quebrar o stripper compartilhado faz
**15 testes gritarem "veio vazio"** em vez de passarem por não terem olhado nada. As guardas antigas
já se protegiam contra o próprio detector — exatamente o passo 4 do procedimento do CLAUDE.md.

---

### 2026-08-31 · "Faltas: 0" para quem faltou cinco vezes

O fim da varredura das colunas desnormalizadas de `clients`, e o pior caso da família — de outra
natureza que os anteriores.

`visits_count`, `ltv_cents` e `last_visit_at` são **defasadas**: o cron `segments` as reescreve uma
vez por dia. `no_show_count` não é defasada, é **morta**: o único escritor dela no repositório
inteiro é `scripts/seed-demo-barbearia.mjs`. Em uso real ela fica em **zero para sempre**.

Conferido em produção, e o número engana: 11 faltas na coluna, 11 faltas reais, zero divergência —
porque a semente escreveu as duas coisas de forma consistente. A sincronia perfeita era prova de
que ninguém mexe, não de que funciona.

É a mesma classe de `referred_by` e `fee_cents`, que este repositório já nomeou e já guardou:
*coluna lida por todo mundo e escrita por ninguém*. Aqui dói mais que nas outras, porque
"Faltas: 0" é o número com que uma dona de salão decide cobrar sinal ou confirmar com mais cuidado
— e ele dizia que a cliente é confiável quando ela não é.

**O conserto foi de graça**, porque a consulta certa já estava lá: a agregada que eu tinha
adicionado há duas rodadas para tirar a defasagem de visitas e LTV. Ampliada de `status = 'done'`
para `in ('done','no_show')`, ela passa a alimentar as **quatro** métricas da ficha — visitas, valor
atendido, faltas e última visita. Nenhuma depende mais de coluna derivada.

As colunas continuam existindo e continuam sendo escritas pelo cron, porque a view
`v_client_segments` as usa para segmentar — mas nenhuma tela lê mais o número derivado quando pode
ler o fato.

---

### 2026-08-31 · A tela de campanhas dizia que toda campanha valeu R$ 0,00

Varri o schema inteiro atrás de outras colunas da classe "lida por todo mundo, escrita por
ninguém". Das 44 candidatas, os falsos positivos caíram (defaults do banco, escrita inline,
variáveis locais de função SQL) e sobrou uma: **`campaigns.booked_count`** — e com ela
`revenue_cents`.

`registrarCampanha` as deixa em zero **de propósito**, com um comentário que envelheceu virando
profecia: *"quem preenche é a atribuição, não o usuário: número de conversão digitado à mão não é
medição, é opinião"* — e *"sem elas, `booked_count`/`revenue_cents` ficariam zerados para sempre e
o funil da tela seria decorativo"*. Não existe um único `update` em `campaigns` no repositório. A
atribuição nunca escreveu de volta.

**E o efeito era pior que decorativo.** Cada campanha aparecia com receita **R$ 0,00**, funil
"Marcaram horário: **0**", e a frase **"Cada mensagem valeu R$ 0,00 em média"**. O topo somava tudo
e mostrava "Receita gerada: R$ 0,00" e "Viraram horário: 0%". A tela informava ao salão que toda
campanha que ele já rodou não valeu nada — estruturalmente, para sempre, no recurso que a
descrição da própria página promete medir.

**A causa raiz não é código, é modelo de dados:** `messages` não guarda de qual campanha a linha
saiu. Só tem `client_id`, `kind`, `status`, `sent_at`. Sem esse vínculo, a quebra por campanha não
existe no banco — não dá para calcular ao vivo, como fiz com a ficha da cliente.

**O que existe e é verdade:** `receitaAtribuidaAoCiclo` casa mensagem de campanha enviada com
atendimento concluído na janela, e é a mesma função em que a tela "Hoje" confia. Ela mede por
SALÃO, não por campanha. O topo passou a mostrar esse número; cada cartão passou a mostrar só o que
é verdade sobre aquela campanha (nome, data, quantas mensagens saíram). As colunas mortas saíram
até do `select` — buscar dado que ninguém escreve era trazer zero para a tela.

**Não construí a medição por campanha, e é decisão consciente.** O conserto de verdade é
`messages.campaign_id` (migration aditiva) + gravar na criação + calcular por campanha. É pequeno,
mas é atribuição de dinheiro, e atribuição meio-construída é pior que ausente — ela volta a
produzir número que ninguém conferiu. Fica registrado como o próximo passo, com o caminho inteiro
escrito acima.

A guarda tem um caso de DIREÇÃO, não de proibição: no dia em que aparecer um `update` em
`campaigns`, ela reprova e quem estiver mexendo lê que a tela pode voltar a medir por campanha.

---

### 2026-08-31 · Duas views cortavam o mês no fuso do servidor (0048, 0049)

Varri as quatro views do banco com a mesma pergunta das colunas. Duas estavam erradas, as duas em
uso, e as duas pelo mesmo motivo: **data de view roda no fuso da SESSÃO, e a sessão do PostgREST é
UTC** — medido em produção (`current_setting('TimeZone')` = `'UTC'`).

Demonstrado com números antes de mexer:

| hora no salão | mês que a view usava | mês do salão | |
|---|---|---|---|
| 31/08 20:00 | 8 | 8 | ok |
| 31/08 21:00 | **9** | 8 | **erra** |
| 31/08 23:30 | **9** | 8 | **erra** |

**`v_client_segments.is_aniversariante` (0048).** Das 21h à meia-noite do último dia de todo mês, o
segmento "Aniversariantes do mês" lista as pessoas do mês SEGUINTE. Quem disparar a campanha nessa
janela — que é justamente o fim de expediente, quando dá tempo de mexer no sistema — manda "feliz
aniversário" para quem não faz, e não manda para quem faz.

**`v_carteira_resumo.novos_mes` (0049).** Uma cliente cadastrada às 22h do dia 31 sai da contagem
de "novos" do mês que o salão acabou de fechar. Some do número exatamente quando a dona olha para
saber como foi o mês.

É a **quarta** aparição da classe: `v_daily_cash` foi abandonada por causa dela (o comentário no
topo de `caixa.ts` conta a história), `receitaAtribuidaAoCiclo` foi corrigida em 28/08, e estas
duas ficaram de fora das duas rodadas anteriores.

**Duas armadilhas no próprio conserto, as duas pegas medindo antes de aplicar:**

1. **`create or replace view` foi recusado pelo Postgres** — ele exige a mesma lista de colunas na
   mesma ordem, e `c.*` passou a expandir uma coluna a mais desde que a 0047 adicionou
   `clients.name_busca`. A view em produção nem expunha essa coluna. Virou `drop` + `create` na
   mesma transação; de brinde, a view voltou a acompanhar a tabela.

2. **O primeiro conserto do `novos_mes` estava errado.** `date_trunc('month', now() at time zone
   tz)` devolve um `timestamp` SEM fuso — relógio de parede. Comparado com `created_at`, que é
   `timestamptz`, o Postgres reinterpreta esse relógio no fuso da sessão e o defeito volta pela
   porta dos fundos. Medido: com o segundo `at time zone`, o corte cai em `2026-08-01 03:00+00` =
   1º/08 00h no salão; sem ele, em 31/07 21h. O segundo `at time zone` não é redundância, é o
   conserto.

Aplicadas em produção pelo MCP e conferidas contra a linha de base: `v_client_segments` manteve 114
linhas e 52 aniversariantes; `v_carteira_resumo` manteve os seis tenants coluna por coluna. As duas
mantiveram `security_invoker=true` — sem ele a view furaria a RLS.

A guarda varre a ÚLTIMA declaração de cada view (migration é histórico append-only: a primeira
versão dela reprovava as versões antigas de 0010/0018, acusando defeito já consertado) e aceita
qualquer forma de corte de data, não só `now()` — `v_daily_cash` usa `date_trunc('day',
t.closed_at)` sobre `timestamptz`, e a primeira versão não a pegava. Ela fica como exceção
declarada, com o motivo escrito: ninguém a consulta.

---

### 2026-08-31 · A dívida do "dia em UTC" foi zerada — e o comentário dela ensinou como

Levei a pergunta das views para as funções SQL e para o TypeScript.

**Funções SQL: negativo limpo.** As cinco que mexem com tempo (`touch_updated_at`, `claim_jobs`,
`finish_job`, `consumir_rate_limit`) usam `now()` como INSTANTE, nunca truncado para dia — que é o
uso correto e independe de fuso. O detector marcou por `now()`; conferir uma a uma mostrou que
nenhuma trunca.

**TypeScript: três falsos positivos e dois defeitos reais.** `agenda.tsx`, `caixa.tsx` e
`agendar.tsx` usam `toISOString().slice(0,10)` de propósito — constroem a data a partir de uma
string `AAAA-MM-DD` já resolvida com `Date.UTC`, fazem aritmética em UTC e leem de volta em UTC. A
ida e volta é exata, e os comentários dizem isso. Meu detector pegou a FORMA, não o defeito: a
forma perigosa é `new Date()` (agora) → `toISOString()`.

**Os dois reais já estavam catalogados**, com motivo escrito, numa lista de dívida conhecida em
`tests/unit/design/dia-no-fuso-do-salao.test.ts`. E o motivo de cada um é o que mostrou como
consertar:

1. **`started_on` da assinatura.** O comentário dizia que a raiz era o `default current_date` da
   coluna (0019) e que "mexer nela é migration". Não foi preciso: `assinar()` passou a gravar a
   data no fuso do salão. O default do banco **não pode** fazer isso — ele não enxerga o tenant, e
   o fuso é por salão. Assinatura feita às 22h do dia 31 nascia começando no mês seguinte, e isso é
   data de cobrança.

   O mesmo comentário avisava que "corrigir só o cliente faria a tela discordar do dado guardado" —
   e o inverso vale igual. Por isso o valor otimista da tela foi junto, no mesmo commit.

2. **Validade do orçamento.** Aqui **revertí uma decisão consciente** de quem veio antes: o
   comentário julgou que um dia a mais é "a favor de quem recebe o orçamento" e "não paga o risco".
   Discordo, e o motivo é a costura: `orcamentoExpirado(valid_until, tenant.timezone)` — a outra
   ponta da MESMA regra — já lia no fuso do salão. Gravar num fuso e conferir noutro é ter duas
   ideias de "que dia é hoje" dentro da mesma regra. E o salão combinou 7 dias, não "7 ou 8 conforme
   a hora". O conserto custou uma prop.

`diaNoFuso`/`diaDaquiA` foram para `core/tempo/dia.ts` — eram uma função pura morando dentro de
`server/assistente/ferramentas.ts`, onde só o assistente alcançava.

**A lista de dívida está zerada**, e continua fazendo efeito: um arquivo novo com o defeito reprova
o build — conferido reintroduzindo. Uma das guardas novas é de COSTURA e não de comportamento, por
um motivo medido: apagar a linha `started_on: diaNoFuso(timezone)` **compila e nenhum teste de
unidade reprova**. O defeito voltaria calado, exatamente como entrou.

---

### 2026-08-31 · Um falso positivo meu, um produto correto, e um comando que não existia

**Fui medir no navegador em vez de ler código**, e a rodada rendeu três coisas — nenhuma delas do
tipo que eu esperava.

**1. As outras listas de dívida estão limpas.** `rede-nao-derruba-tela` e `precos-tem-trava` já
estão zeradas. A única entrada viva é `alertas-estoque.ts` em `dia-do-salao-nao-e-utc`, e o
argumento dela é sólido: janela CORRIDA de 30 dias para tirar média diária, três horas em 720 não
mudam "está na hora de repor", e o número não vira pagamento de ninguém. Fica.

**2. O produto está certo, e a régua era minha.** Medi a página pública de agendamento a 375 px e
achei 30 botões de horário com caixa visual de 66×40 px — abaixo do piso de 48. Antes de reportar,
segui a receita que a própria guarda `alvo-de-toque-tem-48` documenta: sondar `elementFromPoint`
ponto a ponto. **Área efetiva: 48–49 px em toda a amostra.** A classe `toque-48` faz exatamente o
que promete — adiciona um `::after` que não muda a caixa visual.

É o mesmo falso positivo que a auditoria de 30/08 cometeu, e que está escrito naquele arquivo em
letras grandes. Repeti o erro documentado; a receita registrada foi o que me salvou de reportá-lo.

Também errei a sondagem na primeira tentativa: `elementFromPoint` usa coordenadas de viewport, e os
botões estavam abaixo da dobra — deu "área efetiva 0", que é resultado sem sentido. Resultado
absurdo é sinal de instrumento quebrado, não de defeito encontrado.

**3. `pnpm test:e2e` nunca existiu.** O `CLAUDE.md` listava o comando entre os do projeto, o
`package.json` tinha o script, e `tests/e2e/` tem só um `.gitkeep`. Rodando: *"'playwright' não é
reconhecido como um comando"* — o pacote nem está instalado.

Isso é pior que um comando quebrado: quem lê a lista de comandos conclui que existe cobertura de
ponta a ponta. O `CLAUDE.md` passou a dizer que não existe, e o script passou a falhar com a frase
que explica, em vez de um erro do Windows.

**Não montei o Playwright**, e é decisão: a CI não roda e2e, o harness precisaria de navegador
baixado e servidor de pé, e montar isso de madrugada entregaria infraestrutura que ninguém pediu
para rodar. O que a guarda de toque pede — medição no navegador — continua sendo manual, com a
receita escrita nela.

---

### 2026-08-31 · `pnpm db:types` destruía o arquivo de tipos, e saía com código 0

Continuando a conferência dos comandos que o `CLAUDE.md` promete, achei um pior que o `test:e2e`
inexistente: um que **funciona o suficiente para destruir**.

```
db:types → supabase gen types typescript --project-id $SUPABASE_PROJECT_REF > src/server/db/types.gen.ts
```

O `>` do shell **trunca o destino antes de o comando rodar**. E `SUPABASE_PROJECT_REF` só existe na
Vercel — conferido: na máquina de desenvolvimento ela é vazia.

**Reproduzido sobre uma cópia descartável:** 3.590 linhas viraram **1**, com
`{"_tag":"Error","error":{"code":"UnknownError","message":"Must specify one of --local, --linked,
--project-id..."}}` dentro. O arquivo destruído é o de tipos de que o app inteiro depende. Já
aconteceu nesta base e foi recuperado do git.

**E o detalhe que torna isso especialmente traiçoeiro:** o `supabase gen types` **saiu com código
0** enquanto imprimia o erro no stdout. Nem "o comando falhou" servia de aviso — o shell fez
exatamente o que mandaram, gravando o erro com a mesma naturalidade com que gravaria os tipos.

Agora passa por `scripts/gerar-types.mjs`, que falha ANTES de tocar o arquivo quando a variável não
existe, e que confere três coisas na saída antes de gravar: tamanho mínimo, a marca
`export type Json`, e a presença de `tenants:`. As três existem por causa do código 0 — sem elas, o
"conserto" gravaria o erro com a mesma naturalidade de antes.

Conferido rodando: `pnpm db:types` sem a variável agora falha com a explicação e o arquivo continua
com 3.590 linhas.

A guarda é a regra, não o caso: **nenhum script do `package.json` pode redirecionar (`>`) para
dentro de `src/`, `supabase/` ou `tests/`**. E confere que a escrita do gerador vem DEPOIS das
checagens — a segunda mutação inverte a ordem e ela reprova, que é o que de fato protege.

---

### 2026-08-31 · O FAQ prometia uma trava no `db:reset` que não existia

Fechando a conferência dos comandos, o pior dos três.

`docs/05-FAQ-DEV.md` B23 — *"Posso rodar `supabase db reset` em produção?"* — respondia: *"Nunca. O
comando é bloqueado por guard no `package.json` quando `NODE_ENV=production`."*

O `package.json` tinha `"db:reset": "supabase db reset"`. **Não havia guard nenhum.**

Promessa de segurança falsa é pior que a ausência dela: quem lê o FAQ age com a confiança de quem
tem rede. E o comando apaga e recria o banco inteiro.

**A trava prometida também seria a errada.** Ninguém define `NODE_ENV=production` na máquina de
desenvolvimento, então ela nunca dispararia no caso real. O caminho perigoso é `--linked` — e
linkar é passo normal para `db push` e para gerar tipos.

A trava real olha o que de fato indica perigo, reusando a MESMA regra de
`tests/setup/so-banco-local.ts`, que já provou valor: recusa `--linked`/`--db-url`, e recusa quando
`NEXT_PUBLIC_SUPABASE_URL` não é local. Escape consciente por `PERMITIR_BANCO_REMOTO=1`.

**O que a trava revelou ao ser testada:** o `.env.local` desta máquina aponta para **produção**.
Rodando `pnpm db:reset` agora, ela recusa dizendo isso com todas as letras. Antes, com o projeto
linkado, o comando seguiria em frente — com o FAQ garantindo que não seguiria.

O FAQ passou a descrever a trava que existe, e a registrar que a resposta anterior estava errada —
apagar o erro sem dizer que houve erro é o mesmo tipo de silêncio.

**Quarta vez no dia que a guarda casou com o próprio comentário:** a asserção "recusa `--linked`"
passou verde com a recusa REMOVIDA, porque a palavra continuava na prosa que explica por que ela
existe. Corrigida com o `semComentarios` compartilhado — o mesmo utilitário que consolidei mais
cedo justamente por isso.

---

### 2026-08-31 · O FAQ prometia anonimização automática que não roda — e a política pública estava certa

Depois do `db:reset`, varri as outras afirmações de mecanismo do FAQ. **Quatro conferidas contra o
banco de produção, todas verdadeiras**: índice único `(tenant_id, phone_e164)`, a constraint de
exclusão `appointments_no_overlap`, a PK composta de `client_cycles` e `consents.text_hash`.

A regra de lint que confina `service_role` também existe **e funciona** — testei criando um arquivo
que a viola e ela reprovou com mensagem clara ("só pode aparecer em `with-tenant.ts`"). Declarada é
diferente de funcionando, e aqui as duas coisas batem.

**O achado foi na G92**, a resposta sobre exclusão por LGPD. Ela descrevia três estágios, sendo o
segundo *"após 30 dias, **anonimização**"* — automático — e terminava com *"Explique isso ao titular
na resposta."*

Esse estágio não roda. O job `lgpd_retention` está registrado como pendência dentro do próprio
`lgpd.ts` (*"ainda não existe nesta base"*), não há rota de cron para ele, e `eliminarCliente` só é
chamado pelo endpoint manual de apagar. Um cliente soft-deletado permanece soft-deletado.

**A boa notícia, e ela importa:** a política pública (`/privacidade`) sempre esteve **correta**. Ela
descreve o botão de apagar — que funciona de verdade, incluindo redigir a trilha de auditoria — e
não promete prazo automático nenhum. A promessa falsa estava confinada ao documento interno, que
orienta o dev a repassá-la ao titular.

O que existe funciona bem, e isso também ficou registrado: o botão apaga nome, telefone, e-mail,
cofre, mídia e trilha, e mantém o financeiro sem vínculo pessoal.

A G93 (backups) tinha o mesmo problema pelo mesmo motivo — prometia reaplicação automática das
exclusões após restauração, que depende do mesmo job inexistente. Corrigida junto.

**A guarda liga as duas pontas nas DUAS direções:** enquanto não houver cron de LGPD, o FAQ não pode
prometer um; e no dia em que houver, ela reprova e manda atualizar o FAQ. Prometer o que não existe
e esquecer de anunciar o que passou a existir são o mesmo defeito.

---

### 2026-08-31 · O job `lgpd_retention` existe — e fica desligado, de propósito

A pendência que a rodada anterior expôs virou código: `/api/cron/lgpd-retention` passa de
`deleted_at` para eliminação depois de 30 dias de carência, chamando o `eliminarCliente` que já
existia e já fazia o trabalho inteiro (cofre e mídia apagados, dado pessoal anonimizado coluna a
coluna, trilha redigida).

**Ela fica FORA do `on.schedule`, e isso é a decisão principal.** Mesmo padrão de `reminders` e
`campaigns`: ligar destruição irreversível de dado pessoal é decisão do dono do produto, não efeito
colateral de um deploy. O gap deixa de ser "código a escrever" e vira "chave a virar".

Três coisas foram desenhadas em volta do fato de ser irreversível:

- **`?simular=1`** não apaga nada: conta e devolve quantas pessoas entrariam. O primeiro disparo de
  um job destrutivo não pode ser também a primeira vez que alguém descobre quantas linhas ele
  alcança.
- **Falha de uma pessoa não derruba a fila** — as outras têm o mesmo direito de serem eliminadas no
  prazo. O erro é contado e registrado, nunca engolido.
- **Carência de 30 dias** porque é o prazo que o FAQ já usava e coincide com a expiração de backup:
  eliminar antes deixaria o dado voltar numa restauração, que é o pior dos dois mundos.

**A mutação mais importante foi a que NÃO era pega.** Apagar a linha do filtro de carência deixa a
rota anonimizar cliente excluída há segundos — e nenhum teste reprovava, com typecheck e lint
limpos. Numa consulta destrutiva, o modo de falha não é "quebra", é "alcança gente demais, em
silêncio". A guarda passou a travar os quatro filtros (`deleted_at` preenchido, passou da carência,
ainda não anonimizada, carência ≥ 30 dias), cada um visto reprovando.

**E a guarda da rodada anterior estava imprecisa.** Ela reprovou assim que a rota foi CRIADA, mesmo
ficando fora do schedule — lia o arquivo inteiro em vez de `ROTAS_AGENDADAS`. Rota que ninguém
dispara não anonimiza ninguém, então o FAQ continuava certo. Corrigida para olhar o agendamento:
imprecisão de guarda cobra conserto onde não há defeito, e isso custa tanto quanto absolver o
errado.

**Para ligar, quando for a hora:** rodar com `?simular=1` primeiro e olhar o número, depois
acrescentar `lgpd-retention` ao `on.schedule` do `cron.yml` e a `ROTAS_AGENDADAS`. A guarda vai
reprovar pedindo que a G92 do FAQ seja atualizada junto — de propósito.

---

### 2026-08-31 · Revisando o próprio trabalho: eu quase troquei defasado por truncado

Rodada de auto-revisão, olhando o que construí na madrugada como se não tivesse escrito. Achou um
defeito meu e um que já existia.

**O meu.** Quando as métricas da ficha da cliente deixaram de ler colunas desnormalizadas
(TICKET-062/065) e passaram a contar as linhas de verdade, a consulta saiu **sem paginação**. O
PostgREST corta em `max_rows = 1000` (`supabase/config.toml`) e **não erra ao cortar**: devolve as
primeiras mil e cala.

Ou seja, troquei *"completo porém defasado"* por *"fresco porém truncável em silêncio"* — e a
segunda é pior, porque erra com cara de exata. Uma cliente semanal por vinte anos passaria de mil.

Medido antes de consertar, para não exagerar o achado: o maior histórico por cliente nesta base é
de **7 atendimentos**. O risco é teórico hoje. Consertei mesmo assim, porque o custo é zero para o
caso normal (uma requisição, igual a antes) e porque silêncio em número de dinheiro é exatamente o
que passei a noite removendo.

**O que já existia.** A guarda nova pediu que o paginador morasse num lugar só — e achou uma
**terceira cópia**, em `ciclo.ts`, que eu não tinha visto. A duplicação já era de dois antes de eu
começar.

Consolidado em `src/server/db/paginar.ts`, com a melhor prosa das três preservada: a história do
TICKET-036, em que um tenant com 10 mil atendimentos perdia 90% deles e quem denunciou foi o teste
de performance — `processados` deu **1000**, não 10000.

De brinde, uma confusão de nomes foi desfeita: `TAMANHO_PAGINA` era usada tanto para o teto de
LEITURA do PostgREST quanto para o tamanho do LOTE de escrita do upsert. São decisões diferentes
que coincidiam no valor; agora o lote se chama `TAMANHO_DO_LOTE` e mora com quem escreve.

**Uma guarda minha de duas rodadas atrás precisou de ajuste**, e é o caso honesto do gênero: ela
casava com `concluidosBruto.data`, que deixou de existir quando a leitura virou paginada. A
asserção seguiu a mudança; a intenção não mudou — e ganhou uma linha a mais, exigindo a paginação.

---

### 2026-08-31 · Auto-revisão, parte 2: o job de retenção não caberia no tempo da função

Segunda passada sobre o trabalho da madrugada.

**A troca da barra está correta no desktop também** — só tinha medido a 375 px. Na coluna lateral,
"Recuperar receita" fica no TOPO (y=24), acima de Hoje/Agenda/Clientes/Marcar, porque o
`lg:order-first` do botão central o promove ali. Todos os cinco com 207×48 px, sem sobreposição, e
o `aria-current` que acrescentei acende só ele em `/admin/recuperar`. O ícone da marca herda
`text-on-acc` sobre o fundo de acento, com contraste correto.

**O defeito era meu, e de dimensionamento.** O job de retenção pegava **500 clientes por execução**.
Cada `eliminarCliente` faz várias consultas, apaga arquivos no storage, atualiza colunas e redige a
trilha de auditoria — 500 disso, sequencialmente, não cabe em `maxDuration` nenhum. O job morreria
no meio toda vez que a fila fosse grande.

Morrer no meio é **seguro** aqui, e isso foi desenhado: `eliminarCliente` recusa quem já tem
`anonymized_at`, então a execução seguinte continua de onde parou em vez de repetir. Mas job que
sempre estoura é job em que ninguém confia, e enche o log de timeout que não significa nada.

Passou para **100 por execução**, com `maxDuration = 60` declarado (como `/api/v1/assistant`, a
única outra rota que declara). A fila normal — ninguém apaga cliente todo dia — esvazia numa
execução; uma fila grande esvazia em alguns dias, o que é aceitável porque a carência de 30 dias já
disse que isto não é urgente. Quem precisa de eliminação imediata usa o botão da ficha, que é
síncrono.

Nota de escala, registrada sem conserto: `recompute-cycles` e `segments` também iteram todos os
tenants sem lote e sem `maxDuration`. Passam hoje porque são 7 tenants. Vira problema em algum
número de clientes, não hoje — e mexer nas duas rotas que estão rodando bem, de madrugada, seria
trocar risco conhecido por risco novo.

---

### 2026-08-31 · Auto-revisão, parte 3: as views recriadas sob RLS de usuário de verdade

Rodada de verificação, sem conserto — e ela fecha a pergunta que ficou em aberto nas migrations
0048/0049.

Ao trocar `create or replace` por **`drop` + `create`** nas duas views, eu havia conferido o
resultado com `service_role`, que **passa por cima da RLS**. Isso responde "a view calcula certo",
não "o usuário enxerga". E o modo de falha aqui não é erro: um join que quebre a política devolve
tela **vazia**, silenciosamente.

Conferido agora com sessão de usuário real, número por número:

| | banco | tela |
|---|---|---|
| carteira | 22 | "22 na carteira" |
| ticket médio | 58,95 | "R$ 58,95" |
| voltam de novo | 100% | "100%" |
| aniversariantes | 10 | "10 fazem aniversário esse mês" |
| linhas da lista | 22 | 22 |

O `join tenants` não quebrou o isolamento — como o raciocínio previa (`tenants_select` usa
`has_tenant(id)`), mas agora está medido em vez de deduzido.

**O que NÃO foi possível reverificar:** o assistente de ponta a ponta. A cota diária do tenant de
teste (60 perguntas) segue esgotada — janela FIXA, então ela volta de uma vez, não aos poucos.
Mudei quatro coisas naquele caminho hoje (limpeza de schema, mensagem de erro de argumento,
renderização do cartão, e as ferramentas), e todas têm teste de unidade e guarda, mas a passagem
completa pelo Gemini não foi refeita depois da última mudança. Fica dito.

**Uma coisa que decidi NÃO mudar:** "Ticket médio" na tela de clientes sai de `ltv_total /
visitas_total`, ou seja preço de tabela — a mesma origem de "Faturado hoje" e "Já gastou", que
corrigi hoje. Não entra na regra do vocabulário porque "ticket médio" é termo de mercado com
definição própria, e renomeá-lo confundiria mais do que esclarece. A guarda mira quem afirma
dinheiro RECEBIDO ("faturado", "gastou"); esta é uma média de valor atendido, e o nome não promete
outra coisa.

---

### 2026-08-31 · Estoque: o botão abria o formulário e a rota recusava depois

Varrendo as telas que ainda não tinha aberto (caixa, estoque, orçamentos, séries — todas 200, sem
zero estrutural como o das campanhas), o estoque tinha um problema real.

`/admin/estoque` abre **inteira** para um tenant sem o módulo `stock` — este de teste é Essencial, e
`stock` é do Avançado. Com um botão "Entrada" **habilitado** em cada produto. O formulário abre, a
pessoa preenche quantidade e custo, e só então `exigirModulo(..., 'stock')` recusa na rota.

**Não é falha de segurança**, e conferi: a escrita está travada no servidor, que é a regra da casa
(*"o módulo vale no SERVIDOR, e só na ESCRITA"*). É falha de **aviso** — e a regra 5.2 é explícita:
bloqueio mostra o motivo e o caminho.

A tela continua visível sem o módulo, de propósito: sumir com ela esconderia o que dá para comprar.
O que muda é o botão travado com `motivoDesabilitado` (que vira `title` e `sr-only` — sem ela, o
leitor de tela anuncia "Entrada, indisponível" e ponto) e o `BloqueioPlano` com o dado dela: quantos
produtos estão abaixo do ponto de recompra.

Usei a peça que já existia em vez de inventar outra. O comentário dela explica por que é o lugar
certo: *"a peça de conversão mais importante do produto, mais que a página de preço, porque aparece
no momento em que a pessoa JÁ QUER FAZER alguma coisa"*.

**A guarda existente não cobria este caso**, e vale registrar a distinção:
`botao-travado-diz-por-que` varre `<Button disabled>` — botão que se vê travado. Aqui o botão
parecia disponível e falhava depois. É a mesma família, um degrau pior.

**E a minha guarda nova nasceu cega.** A asserção "o botão explica" casava com `motivoDesabilitado`
em qualquer lugar do arquivo — e havia OUTRA ocorrência, no formulário de entrada. A mutação que
apagava a explicação do botão passava verde por causa da vizinha. Só descobri porque confirmei que
a mutação tinha sido aplicada antes de ler o resultado, que é o passo 3 do procedimento do
CLAUDE.md. Reancorada no bloco do botão.

**2026-08-31 · presets de cor (TICKET-070, plano `docs/34-PAGINA-PUBLICA-PLANO.md`)**: em vez de
"temas" completos (claro/escuro/vibrante), entreguei 6 swatches curados ao lado do seletor de cor
livre já existente, e corrigi um bug latente achado ao implementar — `--on-acc` (texto do botão
primário na página pública) era fixo `#0d0c0c` global, então um dono que já escolhia acento escuro
no seletor livre ganhava texto ilegível. Agora é calculado por luminância (`core/text/cor.ts`,
`corDeContraste`) e escopado por tenant em `[slug]/layout.tsx`, junto de `--acc`. Motivo de não
fazer temas completos: só `--acc`/`--acc-2`/`--acc-soft` são escopados por tenant hoje — trocar
`--bg`/`--surface` por tenant exigiria reauditar contraste na árvore inteira da vitrine.

**2026-08-31 · reconhecer cliente sem lookup aberto por telefone (TICKET-071, plano
`docs/34-PAGINA-PUBLICA-PLANO.md`)**: o plano original pedia "telefone digitado → ficha
encontrada", mas isso seria um endpoint público que devolve nome+padrão de visita de qualquer
pessoa para quem souber (ou tentar em sequência) o número dela — enumeração, sem OTP/SMS
disponível pra provar posse de verdade. Resolvido com um token HMAC (mesmo mecanismo de
`token-assinado.ts` já usado em confirmação/avaliação/orçamento): `POST .../book` devolve um
`reconhecimentoToken` só depois que a pessoa PROVOU o telefone agendando; o token vai só pro
`localStorage`, nunca cookie nem URL. `GET .../reconhecer` só aceita esse token — nunca telefone
cru — e o payload assinado carrega o `tenantId`, então um token de um salão nunca reconhece nada
em outro. Nome/telefone pré-preenchidos são 100% client-side (o mesmo navegador já sabe o que a
pessoa digitou da última vez), sem round-trip nenhum pra essa parte.

**2026-08-31 · "prova social" fica de fora do plano da página pública**: ao investigar pra
implementar, achei que `media.consent_id`/`mediaParaPortfolio` (TICKET-051/052) são infraestrutura
morta — sem upload UI, sem captura de consentimento UI, sem visualização de foto em lugar nenhum
do admin (a ficha só mostra "N fotos", sem abrir), e `fazerUploadMedia` nem aceita `consentId`
como parâmetro. "Publicar no site" precisaria de 3 camadas de UI que não existem antes de chegar
nessa quarta. Reclassifiquei de médio pra alto em `docs/34-PAGINA-PUBLICA-PLANO.md` e tirei do
escopo deste plano — é candidato a ticket próprio (completar TICKET-052), não item de "página
pública".

**2026-08-31 · TICKET-115, publicar foto no site (docs/35-FOTOS-CONSENTIMENTO-PLANO.md)**:
`portfolio_photos` (migration 0053) é uma CÓPIA no bucket público `vitrine`, nunca o `media`
privado — mesma disciplina de logo/capa (0051). Revalida consentimento `image_use` no momento de
publicar, não confia em estado da tela. Achado ao implementar: `eliminarCliente` (LGPD) já
apagava `media` mas nunca soube de `portfolio_photos` — corrigido, com bucket `vitrine` limpo via
`withTenant` (service_role), nunca o `db` de sessão recebido (a escrita em `storage.objects` do
bucket público só é permitida a service_role, migration 0051). Ao consertar isso percebi que o
MESMO problema provavelmente já existe pro bucket `media` dentro de `eliminarCliente` — não
corrigido aqui (fora de escopo), registrado como tarefa separada (spawn_task).

**2026-08-31 · toda campanha voltou a mostrar retorno de verdade (migration 0054)**: fechou o
"próximo passo" que a rodada de "campanhas dizia R$ 0,00" tinha deixado escrito — `messages`
ganhou `campaign_id` (nullable, `on delete set null`: apagar uma campanha nunca apaga o histórico
de envio). `registrarCampanha` grava o vínculo nas mensagens que ela mesma insere;
`receitaPorCampanha` (nova, `atribuicao.ts`) roda a mesma `atribuirReceita` já usada pela tela
"Hoje", sem janela de mês (um cartão de campanha é registro permanente, não relatório mensal), e
agrupa por campanha. `campaigns.booked_count`/`revenue_cents` continuam mortas de propósito —
quem calcula é a atribuição ao vivo, nunca um contador gravado que precisaria de cron pra não
divergir. A guarda `campanhas-nao-inventam-retorno.test.ts` era de DIREÇÃO desde a rodada
anterior (seu próprio comentário já previa "messages ganhando campaign_id" como gatilho) mas só
checava `campaigns.update` — não pegaria esta mudança. Reescrita para checar o novo caminho real
(campaign_id gravado, `receitaPorCampanha` usada) e reprovar se `campaigns` ganhar um `update` de
volta (isso reintroduziria a classe de bug original — número guardado divergindo do calculado).
Confirmado que reprova: revertida a escrita de `campaign_id`, o teste falhou; restaurada, passou.
Verificado ao vivo: duas campanhas para clientes diferentes, cada uma mostra só o que ELA trouxe
("1 pessoa voltou · R$ 90,00" vs "Ninguém voltou por aqui ainda"), sem misturar receita entre elas.

**2026-08-31 · `search_path` fixado em `imutavel_sem_acento` (migration 0055)**: `get_advisors`
(Supabase) apontou `function_search_path_mutable` — a função da busca sem acento (0047) não
fixava `search_path`. Não é `SECURITY DEFINER` (risco baixo), mas é hardening padrão de graça:
`alter function ... set search_path = pg_catalog, public`, sem recriar a função nem a coluna
gerada (`clients.name_busca`) nem o índice. Confirmado que `imutavel_sem_acento('Otávio')`
continua devolvendo `'otavio'` depois, e o advisor não aponta mais essa função. Os outros achados
do advisor são intencionais/já reasoned-through: `has_tenant`/`tenant_role`/`can_see_appointment`/
`my_professional_id` PRECISAM ser executáveis por anon/authenticated (são a base da própria RLS,
ver `with-tenant.ts`); tabelas de infraestrutura (`job_queue`, `rate_limits` etc.) com RLS sem
política são o padrão seguro (deny-by-default, nunca acessadas fora de service_role); extensão em
`public` é estilo, não risco real, e mover exigiria recriar objetos dependentes sem necessidade
clara; `auth_leaked_password_protection` é toggle do painel do Supabase, fora do que migration
alcança.

**2026-08-31 · índices de FK faltando em `portfolio_photos` (migration 0056)**: `get_advisors`
(performance) apontou as duas FKs da tabela nova (TICKET-115, mesma tarde) sem índice cobrindo a
coluna como líder — `portfolio_photos_tenant_idx`/`_client_idx` têm `tenant_id` na frente, o que
não serve pra varredura por `client_id`/`source_media_id` sozinhos. Sem isso, apagar uma
`clients`/`media` referenciada varreria `portfolio_photos` inteira — e é exatamente o tipo de
consulta que `despublicarTudoDoCliente` (revogar consentimento) e `deletarMedia` fazem.

**2026-08-31 · pendência antiga da P7 fechada: tela de gestão de séries funciona de ponta a
ponta** — memória registrava "tela de gestão de séries (só dá pra cancelar via API/SQL por
enquanto)" como pendência consciente do TICKET-067. Um processo paralelo já tinha construído
`/admin/series` (link em Config, atrás do módulo `recurrence`) desde então; verifiquei ao vivo
num tenant descartável: criar série semanal plantou 13 ocorrências, a tela lista corretamente
(cliente, serviço, profissional, "Terça-feira, toda semana", contagem), cancelar pede
confirmação e, no banco, as 13 ocorrências viraram `canceled` de verdade — não só a linha da
série. Nada a corrigir; registrado pra não reabrir essa pendência por engano no futuro.
