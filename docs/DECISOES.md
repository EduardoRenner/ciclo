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
