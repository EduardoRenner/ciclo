# 36 · Auditoria de segurança completa e plano de implementação

Varredura de 31/08/2026, pedida como "reforçar cyber segurança, proteção de dados e contra ataque
de requisição". Duas rodadas: a primeira achou rate limit e teto de corpo; a segunda (esta) varreu
autorização, isolamento entre tenants, upload, redirect, segredos, LGPD e o assistente de IA.

**Método:** medir, não deduzir. Todo item abaixo foi conferido contra o código ou contra o
comportamento real do servidor — não contra o que a documentação afirma.

---

## Parte I — O que foi conferido e está correto

Nenhuma ação necessária. Listado porque "não achei nada" só vale se disser **onde** procurou.

| Área | Como foi conferido | Resultado |
|---|---|---|
| Dependências | `pnpm audit --audit-level=low` | zero vulnerabilidades conhecidas |
| Cabeçalhos HTTP | leitura do `middleware.ts` | CSP com nonce por requisição, HSTS com preload, `frame-ancestors 'none'`, `X-Content-Type-Options`, COOP, CORP, Permissions-Policy |
| Origem do IP | leitura do `ip.ts` | já endurecido: lê a borda da Vercel/`x-real-ip`, e o **último** elemento de `x-forwarded-for` (o que o proxy anexa), nunca o primeiro |
| CSRF | `origemValida()` no `rota()` | `Origin` conferido contra o `Host` da própria requisição em todo método mutante |
| Comparação de segredo | `segredo.ts`, `token-assinado.ts` | `timingSafeEqual` no cron e nos links públicos |
| Redirect aberto | `auth/callback` + `destino.ts` | `destinoSeguro()` com 8 testes |
| Autorização (RBAC) | varredura das 67 rotas autenticadas | 65 chamam `exigirPermissao`; as 2 exceções são desenho documentado (assistente filtra por ferramenta, push escopa por `userId` da sessão) |
| Operações sensíveis | `data-export`, `vault`, `erase` | as três exigem `exigirAal2()` **e** permissão |
| Chave de storage | `*-upload.ts` | `{tenantId}/{uuid}.webp` — nunca deriva de entrada do usuário, então não há path traversal |
| Mass assignment | varredura por spread do corpo em `update`/`insert` | nenhum: todo campo passa por schema Zod |
| PII em log | varredura de `console.*` com nome/telefone/e-mail | nenhum |
| Segredo no repositório | `git ls-files` por `.env*` | só o `.env.example` |
| RLS | `tests/rls/isolation.test.ts` | política + isolamento verificados, e a descoberta das tabelas é por **introspecção** — tabela nova entra coberta sozinha |
| Assistente de IA | `ferramentas.ts` | todas as ferramentas são `preparar_*`: o modelo **propõe**, a pessoa confirma, e a mutação real passa pela rota normal com o RBAC dela |

---

## Parte II — Achados corrigidos nesta rodada

### S1 · 9 de 11 rotas públicas sem limite por IP · **corrigido**

O teto global do `rota()` é `somenteMemoria: true` de propósito e **não conta entre instâncias** —
num deploy serverless vale por lambda viva, não por IP. Sem limite próprio estavam as quatro rotas
que **mudam estado** por link assinado, a que escreve avaliação, e o perfil público inteiro (várias
consultas por chamada, slug enumerável pelo `sitemap.xml`).

Corrigido com `limitarRotaPublica`, escopo por rota. **Verificado ao vivo:** 10 passam, 11ª devolve
429 com `Retry-After: 60`; IP diferente não é afetado; martelar uma rota não gasta o balde da outra.

### S2 · Cota de e-mail do projeto exaurível por um atacante · **corrigido**

`/forgot` e `/signup` delegavam o limite ao Supabase Auth — que limita, **por projeto**. Um script
com o e-mail de uma pessoa queimava a cota de todos: ninguém mais confirmava cadastro nem
recuperava senha. Dois baldes agora (IP e destinatário em hash), e o estouro por destinatário
responde **igual ao caminho feliz**, para não virar confirmação de existência de conta.

### S3 · `mfa/verify` sem teto — o 2FA era decoração · **corrigido**

O achado mais grave. Código de 6 dígitos (1.000.000 de combinações) numa rota alcançável por quem
**já passou pela senha** (`exigirSessao` aceita `aal1`). Quem tivesse a senha vazada martelava o
segundo fator até acertar.

Balde por **usuário**, não por IP. **Verificado ao vivo com um IP diferente em cada requisição** —
o limite disparou na 9ª mesmo assim. 8/10min transforma 1M de tentativas em ~48/hora.

### S4 · `login` sem limite por conta · **corrigido**

Mesma raiz do S2. Dois baldes (conta em hash, IP). Verificado com IP rotativo: bloqueia por conta
na 10ª, outra conta segue respondendo normal.

### S5 · `lerCorpo` sem teto de tamanho · **corrigido**

`req.json()` carregava o corpo inteiro na memória antes de o Zod ver o primeiro campo. A Vercel
corta em ~4,5 MB, mas esse é o limite de outra pessoa — some em self-host, container e dev local.
512 KB, conferido em duas etapas. **Verificado ao vivo inclusive sem `content-length`** (chunked),
que é como o header seria contornado.

### S6 · Filtro `.or()` com interpolação crua · **corrigido**

Seis lugares montavam `professional_id.eq.${id}` direto na gramática de filtro do PostgREST.
Nenhum explorável hoje, mas a validação morava fora da função. Movida para `server/db/filtro.ts`.

### S7 · Isolamento entre tenants apoiado em disciplina · **guarda criada**

`withTenant` empresta `service_role`, que **ignora a RLS**. Auditei as 19 consultas sem
`.eq('tenant_id')` uma por uma: **nenhuma é explorável** — cada id vem de consulta já filtrada, de
token HMAC que carrega o tenant, ou de cron global de propósito. Mas a segurança está inteira fora
da consulta. Guarda com lista justificada: consulta nova reprova, e entrar na lista exige escrever
o motivo.

---

## Parte III — Plano de implementação do que falta

Ordenado por **risco ÷ esforço**, não por gosto. Os três primeiros dependem de você; os demais eu
faço sozinho.

### P1 · Ligar proteção de senha vazada · **5 minutos, sem código, seu**

Supabase → Authentication → Password → *Leaked password protection*. Confere a senha contra o
HaveIBeenPwned no cadastro e na troca. Hoje está **desligado** (apontado pelo `get_advisors`).

Por que primeiro: é o melhor retorno por esforço do plano inteiro. Senha reusada de vazamento é o
vetor nº 1 de tomada de conta, e o limite de login que criei (S4) reduz a velocidade do ataque, não
a existência da senha fraca.

**Risco de não fazer:** alto. **Esforço:** um clique.

### P2 · Provisionar hCaptcha · **~30 minutos, seu**

`verificarCaptcha` já está no código e é chamado no agendamento público — mas **é no-op**: sem
`HCAPTCHA_SECRET` ela deixa passar e registra aviso. Criar conta em hcaptcha.com (grátis), pôr
`HCAPTCHA_SECRET` e a site key nas variáveis da Vercel.

Destrava duas coisas: o captcha do booking público passa a valer de verdade, e abre o caminho do P4.

**Risco de não fazer:** médio. **Esforço:** conta em terceiro + 2 variáveis.

### P3 · Provisionar Upstash Redis · **~20 minutos, seu — opcional**

O limitador tem a ordem Upstash → Postgres → memória, e hoje cai no **Postgres**, que funciona e é
compartilhado (foi o que verifiquei ao vivo). Upstash tiraria uma ida ao banco do caminho de toda
rota pública. É otimização de latência, não correção de segurança.

**Risco de não fazer:** baixo. **Esforço:** conta em terceiro + 2 variáveis.

### P4 · CAPTCHA no lugar do lockout de login · **~2h, minhas — depende do P2**

O limite por conta do S4 tem um custo que registrei: depois de 10 tentativas erradas o dono
legítimo também espera 15 minutos, e quem souber o e-mail mantém alguém de fora repetindo isso.
Escolhi o lado do sequestro (irreversível) contra o lockout (15 min, se cura sozinho) — mas a
saída que evita os dois é exigir CAPTCHA a partir da Nª falha, em vez de bloquear.

Desenho: contar falhas por conta; abaixo do limiar, nada muda; acima, a rota passa a exigir
`captchaToken` válido. Quem é dono resolve o desafio e entra; script para.

**Bloqueado por:** P2. **Risco de não fazer:** baixo (o lockout se cura).

### P5 · `.eq('tenant_id')` nos updates de check-then-act · ✅ **feito em 2026-09-01**

Achado ao implementar: eram **sete** updates/deletes fazendo "confere e depois escreve" sem
repetir o filtro, não quatro — a contagem original era o resumo de prosa; a lista `JUSTIFICADAS`
da guarda do S7 (a fonte de verdade linha a linha) já mostrava `orcamentos.ts::quotes` ×4,
`lista-espera.ts::waitlist` ×2, `portfolio-upload.ts::portfolio_photos` ×1. Corrigidos os sete.
Não era explorável — a checagem imediata acima já provava o tenant — mas repetir o filtro no
`update`/`delete` custa uma linha e fecha a janela teórica entre a checagem e a escrita, inclusive
contra um refactor futuro que troque como a linha checada é buscada.

A lista de `JUSTIFICADAS` encolheu de 19 para 12 consultas sem filtro (15 → 12 pontos distintos de
código) — a medida de quanto o isolamento ainda depende de contexto, não de banco. As 12 que
restam ficam assim de propósito: token HMAC que É a autorização, ou cron que varre todos os
tenants por desenho. Verificado por mutação: removida uma das quatro correções de `orcamentos.ts`
e confirmado que `tests/unit/server/consulta-filtra-tenant.test.ts` reprova.

### P6 · Rotacionar `CRON_SECRET` para fora da assinatura de link · **~30 min, minhas**

`token-assinado.ts` aceita `PUBLIC_LINK_SIGNING_KEY` **ou** `CRON_SECRET` na verificação, de
propósito, para não invalidar link em circulação durante a transição. O de orçamento dura 180 dias.
Passado esse prazo desde a criação da chave nova, `CRON_SECRET` deve sair de `chavesDeVerificacao`
— enquanto estiver lá, um vazamento do segredo de cron ainda permite forjar link público.

**Quando:** a partir de ~fev/2027. Vale um lembrete, não trabalho agora.

### P7 · Teste de penetração de verdade · **externo**

Nada do que fiz substitui alguém tentando quebrar de fora, com ferramenta e tempo. É outra
categoria de trabalho — vale quando existir cliente pagante e dado real em volume.

---

## O que esta auditoria NÃO cobriu

Dito para o limite ficar no papel, não na memória de quem leu:

- **Segurança da infraestrutura Supabase/Vercel** — confio na configuração deles; não auditei rede,
  backup em repouso nem acesso físico.
- **Dependências transitivas além do `pnpm audit`** — não fiz análise de cadeia de suprimentos
  (script de pós-instalação, typosquatting).
- **Ataque de temporização em `has_tenant`/RLS** — assumi que o Postgres não vaza pertencimento
  pelo tempo de resposta.
- **DoS na camada de rede** — é a borda da Vercel que responde por isso, não o app.
- **O caminho negativo do gate de módulo em conta Grátis** — segue sem tenant seguro para testar,
  pendência antiga registrada em 30/08.

---

## Parte IV — Segunda rodada: todos os endpoints e a proteção dos dados (01/09/2026)

Pedida como "verifica a segurança de todos os endpoints e a proteção dos dados". Cobertura: as
**98 rotas** de `src/app/api`, mais RLS, views, buckets, tokens e o que sai para quem não está
autenticado. Medido contra o banco de produção e contra o código, não contra a documentação.

### O que estava certo, e é a maior parte

| Área | Como foi medido | Resultado |
|---|---|---|
| Cobertura do `rota()` | varredura das 98 rotas | 97 passam; a exceção (`/health`) virou achado abaixo |
| Autenticação | `contextoAtual` / `exigirSessao` / `exigirAal2` por rota | toda rota de painel autentica |
| `tenant_id` da requisição | leitura de `contextoAtual` | **nunca é confiado**: validado contra `vinculosAtivos(userId)`, e "não existe" e "não é seu" devolvem o MESMO erro — sem oráculo de enumeração |
| RLS | `pg_class` em produção | **zero** tabela sem RLS e **zero** sem `force` |
| Views | `reloptions` em produção | as 4 com `security_invoker=true` |
| Buckets | `storage.buckets` | `media` privado, `vitrine` público **por desenho** (TICKET-115) |
| Token de convite | `convites.ts` | `randomBytes(24)` = 192 bits, guardado como **hash**, e o e-mail do convite trava com o da sessão — link encaminhado não vira acesso |
| Links públicos | `token-assinado.ts` | HMAC-SHA256 com `timingSafeEqual` |
| Agendamento público | `public/[slug]/book` | **três** baldes (IP/min, IP/dia, telefone/dia com o telefone em hash), honeypot e captcha |
| Rotas sem `exigirPermissao` | 5 rotas | todas legítimas: `/me` devolve o próprio usuário; `/onboarding` e `/memberships/accept` rodam **antes** de existir papel; assistente valida por ferramenta; push escopa por `sessao.userId` |

Sobre as 5 tabelas que o advisor da Supabase marca como "RLS sem política": `idempotency_keys`,
`job_queue`, `rate_limits`, `webhook_events` e `cron_heartbeats`. **Não é lacuna.** RLS ligada com
`force` e zero políticas significa "ninguém", não "todo mundo" — é a configuração correta para
tabela de infraestrutura que só o servidor escreve.

### S8 · `/api/health` ecoava erro cru do Postgres, sem teto de taxa · **corrigido**

A única rota que não passa pelo `rota()` — logo, a única fora do teto global de 120/min. Duas
consequências que a primeira rodada não cobriu:

**Cinco checagens devolviam `error.message` cru.** Mensagem de erro do Postgres carrega nome de
tabela, de coluna e de constraint — e num erro de unicidade carrega **o valor que colidiu**
(`Key (phone_e164)=(+55...) already exists`). Era o telefone de uma cliente saindo por um endpoint
anônimo no dia em que o banco tossisse. Agora o detalhe vai para o log do servidor e para fora sai
só qual checagem falhou.

**Sem limite nenhum**, um endpoint anônimo que custa **sete idas sequenciais ao banco** com
`service_role` fica aberto para qualquer um marretar. Não vaza dado, mas consome a conexão que o
app pagante precisa. 30/min por IP: folgado para monitor de uptime (o normal é 1/min), apertado
para script. O contrato 200/503 não mudou, então monitor externo continua funcionando.

Guarda com mutação nas duas direções: eco de volta → reprova; log removido (o conserto virando
silêncio) → reprova.

### S9 · Funções `SECURITY DEFINER` expostas ao `anon` · **achado, e o conserto óbvio é PERIGOSO**

`has_tenant`, `tenant_role`, `my_professional_id` e `can_see_appointment` são chamáveis via
`/rest/v1/rpc/` sem login. O advisor da Supabase manda revogar `EXECUTE`.

**Medido antes de agir, e é bom que sim:**

- **Não vazam nada.** As quatro são escopadas por `auth.uid()`, que é nulo para anônimo — só sabem
  responder sobre quem chama. Para `anon`, sempre `false`/`null`.
- **Revogar quebraria o app inteiro.** Política de RLS é avaliada com os privilégios de quem
  consulta: sem `EXECUTE`, toda consulta a tabela protegida falha. Medi: **55 políticas em 43
  tabelas** dependem de `has_tenant`. E o ACL mostra `=X/postgres`, ou seja, **PUBLIC** tem o
  grant — revogar só de `anon` nem teria efeito.

**Decisão: não mexer**, e registrar por quê. Fica aqui para o dia em que alguém abrir o painel de
advisors e quiser "consertar" — o conserto derruba os 43.

### Os três falsos positivos que eu produzi, e por que ficam escritos

Nesta rodada eu escrevi três detectores e **todos os três acusaram defeito que não existe**:

1. Varredura de comparação com valor de enum impossível: **57 falsos positivos**, todos por casar
   `tipo`/`status`/`kind` por **nome** — uniões locais do TypeScript, não colunas.
2. "Rota pública sem limite de taxa": acusou `book` e `availability`. As duas têm limite; meu regex
   procurava `limitarRotaPublica|limitar(` e elas usam `limitador(`.
3. **O mais perigoso:** "view sem `security_invoker`" acusou as quatro views — as de dinheiro e de
   carteira de clientes. Eu procurava a string `security_invoker=on`; o Postgres guarda
   `security_invoker=true`. **Eu teria reportado vazamento entre tenants nas views financeiras que
   não existe.**

Os três são a mesma armadilha da tabela do CLAUDE.md — casar com o nome em vez do que muda — agora
cometida dentro da ferramenta de auditoria, onde ela é pior: uma guarda cega deixa passar defeito,
um auditor cego **inventa** defeito. O que salvou os três foi a regra de conferir cada achado
lendo a fonte antes de escrever. Fica registrado porque o próximo a auditar esta base vai escrever
detectores parecidos.
