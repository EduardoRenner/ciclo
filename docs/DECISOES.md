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
