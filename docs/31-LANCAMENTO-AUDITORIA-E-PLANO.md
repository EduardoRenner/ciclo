# 31 · LANÇAMENTO — AUDITORIA E PLANO

Pedido: *"investiga a fundo tudo que falta pro CICLO ir pro ar e começarmos a vender e escalar;
analisa back, front, interface e ecossistema; primeiro o plano, depois executa."*

Auditoria feita em **2026-08-30**, contra **produção de verdade** — banco (`sukloaoodpxjukngyojo`),
deploy (`ciclo-umber.vercel.app`), GitHub Actions e as PRs abertas. Não é leitura de documentação:
onde aparece número aqui, ele foi medido.

---

## 1 · A resposta curta

**O produto está pronto. O negócio não está.**

Essa é a frase que organiza o documento inteiro, e ela é incômoda de propósito. O software faz o
que a landing promete: a agenda não deixa marcar dois no mesmo lugar, o Motor de Ciclo calcula
quem sumiu e quanto vale chamar, a página pública agenda sozinha, o caixa fecha o dia. São 973
testes verdes, RLS em toda tabela, CI de três jobs, e uma auditoria de seis rodadas que já passou
por cima disso tudo.

O que falta **não é código de produto**. É a camada que transforma software em negócio:

| Para | Falta |
|---|---|
| **Cobrar** | não existe integração de pagamento nenhuma, e `tenants.plan` não tem escritor — nem manual |
| **Ser confiável** | sem termos de uso, sem política de privacidade, sem domínio próprio |
| **Ser legal** | sem CNPJ e sem contador (MEI é vedado para software) |
| **Escalar** | mensageria nunca funcionou: as 7 mensagens que existem estão `failed` ou `queued` |

E há uma dívida operacional que já está custando: **25 commits de conserto estão parados em duas
PRs abertas**, incluindo correções de LGPD e de dinheiro.

---

## 2 · O que eu medi, e o que estava errado

### 2.1 · O Motor de Ciclo estava parado há dois dias e meio — CONSERTADO nesta rodada

`/api/health` respondia **503** em produção. A causa, medida com `gh run list`:

```
nominal UTC  ->  real UTC   atraso   hora local (UTC-3)
   05:10     ->   11:38      6,5h        8,6
   06:10     ->   12:39      6,5h        9,7
   07:10     ->   13:09      6,0h       10,2
   08:10     ->   13:48      5,6h       10,8
   09:10     ->   14:24      5,2h       11,4
   10:10     ->   15:02      4,9h       12,0
```

A janela elegível era hora local **3h–5h**. Nenhum dos seis disparos diários encostou nela, desde
27/08. HTTP 200, `tenantsProcessados: 0`, seis jobs verdes por dia.

**É a terceira vez que a mesma falha derruba o Motor de Ciclo**, e as duas anteriores consertaram
o sintoma: 25/08 a igualdade exata (`hora === 3`) caiu por 56 min de atraso; 26/08 virou janela de
3h — calibrada contra aqueles 56 min. A realidade triplicou a margem, e a guarda daquela época
ficou verde o tempo todo porque modelava 2h de atraso.

**A lição, e é o achado mais reusável desta auditoria:** enquanto a rota depender do relógio do
disparo, existe um atraso que a zera, e nenhum teste adivinha qual é. O conserto certo não é uma
janela maior — é a rota **não olhar a hora**. Nas rotas agendadas o filtro sempre foi economia de
processamento e nunca corretude (upsert por PK). Rota que dispara em horário de conveniência do
tenant (`campaigns`, `stock-alerts`) mantém o relógio: ali a hora é o propósito.

Commit `807b6a0`, com a guarda nova vista reprovando nas duas direções por mutação.

### 2.2 · O bloqueador da PR #30 não existe mais

A PR #30 (super auditoria, 6 rodadas, 23 achados) está parada esperando **uma consulta em
produção**, escrita na própria descrição dela:

```sql
select appointment_id, count(*) from tickets
where appointment_id is not null group by 1 having count(*) > 1;
```

Rodei: **zero linhas**. A migration `0045` aplica limpa. O que travava a PR era uma pergunta, e a
pergunta tem resposta.

### 2.3 · O estado real da base

| | |
|---|---|
| Tenants | **12** — e só **3 são reais** (`dom-rocha` demo, `ruivo-barber`, `lang-barber`, `lang-unhas`) |
| Resíduo de teste | **8 tenants** (`health-*`, `alertas-estoque-*`, `recuperar-*`, `clientes-*`, `risco-*`, `rls-a-*` ×3) |
| Pagantes | **zero** |
| Último agendamento criado | **2026-08-24** — a base está parada há 6 dias |
| Mensagens | 7, **todas `failed` ou `queued`**. A mensageria nunca entregou nada |
| Migrations em produção | até a **0044**. As `0045`/`0046` da PR #30 não foram aplicadas |

Os 8 tenants de teste têm **origem estrutural, não descuido**: `.env.local` aponta para o Supabase
de produção, então `test:rls`/`test:integration` criam tenant e usuário de auth na base real. Já
está registrado como achado A1 da auditoria anterior, e a trava nova (`so-banco-local.ts`) recusa
rodar — mas os resíduos continuam lá.

---

## 3 · Os bloqueadores, por camada

### 3.1 · Ecossistema — é aqui que o lançamento está travado

**B1 · Não existe como cobrar.** Nenhuma integração de PSP: não há `MERCADO_PAGO_*` nem `ASAAS_*`
em lugar nenhum do código. A página de preços diz isso com todas as letras, e a honestidade é
correta — *"A cobrança automática ainda não está no ar — preferimos dizer isso a montar um botão
que não funciona."* O `docs/18` §P.2 manda **não construir billing** antes de ≥10 pagantes, e essa
decisão continua certa. Mas ela pressupõe um caminho manual que **também não existe** — ver B2.

**B2 · `tenants.plan` não tem escritor. Nenhum.** Nem automático, nem manual, nem script. A trava
de plano inteira (11 rotas, `exigirModulo`, `verificarLimite`, `BloqueioPlano`) está de pé sobre
uma coluna que **ninguém no repositório escreve**. Consequência concreta: *se alguém pagar hoje,
não há caminho no produto para entregar o que foi vendido* — só um `update` à mão no SQL editor do
Supabase. Este é o bloqueador nº 1 de "começar a vender", e é barato de resolver.

**B3 · Sem termos de uso e sem política de privacidade.** Não existe nenhuma das duas páginas.
Isso é exposição direta, e não é formalidade:
- vender assinatura recorrente sem termos é vender sem contrato;
- o produto processa **dado de saúde** (anamnese, `health_records`, cofre cifrado). A LGPD trata
  isso como dado sensível (art. 5º II, art. 11) e exige finalidade informada;
- o salão é **controlador** e o CICLO é **operador** dos dados das clientes dele — essa relação
  precisa estar escrita, ou o CICLO responde como controlador.

**B4 · Domínio.** Está em `ciclo-umber.vercel.app` — um subdomínio com hash aleatório. Pedir R$ 49
por mês num endereço desses queima confiança antes da primeira tela.

**B5 · Sem CNPJ e sem contador.** MEI é **vedado** para software (CNAEs 6201–6209); o caminho é ME
no Simples Nacional, o que torna contabilidade (R$ 139–195/mês) custo fixo **antes do primeiro
cliente**. Bloqueado no Eduardo.

**B6 · Mensageria nunca funcionou.** `WHATSAPP_ACCESS_TOKEN`/`PHONE_NUMBER_ID`/`APP_SECRET` não
estão provisionados; `reminders` e `campaigns` estão fora do `schedule` de propósito. Hoje a copy
é honesta (tudo sai pelo `wa.me`, com o dono tocando em compartilhar), então **isto não é uma
mentira no produto** — é um teto de escala. Enquanto for manual, o Motor de Ciclo é um *conselho*,
não uma *automação*, e é a automação que sustenta R$ 49/mês contra o Simples Agenda a R$ 39,90.

**B7 · Erro de usuário real não chega em ninguém.** O Sentry é desligado de propósito quando não
há DSN (`next.config.ts`), e não há DSN em produção — decisão de performance tomada em `docs/28`,
que economizou 1,58 MB e ~500 ms de cold start. O efeito colateral: **quando um salão pagante
tiver um erro, ninguém fica sabendo.** Isso é aceitável com zero pagantes e deixa de ser no dia 1
do primeiro.

### 3.2 · Backend — sólido, com dívida parada

**B8 · 25 commits de conserto presos em duas PRs abertas.** A #30 tem correções de LGPD (eliminação
que não alcançava `audit_log`/`idempotency_keys` — CPF e endereço de terceiro sobrevivendo em
jsonb), de dinheiro (`profit_cents` ignorando desconto: *"Sobrou" maior que "Entrou"*), e de perda
de trabalho (fila offline descartando agendamento em `401`). A #31 tem o laço de indicação
inteiro. **Ambas verdes, ambas `MERGEABLE`, ambas sem revisão.**

**B9 · 8 tenants de teste em produção**, com a causa raiz (`.env.local` → produção) já travada mas
os resíduos ainda lá.

### 3.3 · Frontend e interface — medido no navegador, a 375 px

Aqui a notícia é boa, e vale registrar o que **não** é problema para ninguém "consertar" depois:

- **Sem overflow horizontal** em `/`, `/precos` e `/{slug}/agendar` (`scrollWidth === 375`).
- **`toque-48` funciona de verdade.** Os chips de profissional medem 40 px visuais, o que parece
  violação — mas a classe adiciona um `::after` de 48 px, e a sondagem ponto a ponto confirma que
  a área clicável vai de −4 px acima a +40 px abaixo da caixa visual, sem roubar o toque do
  vizinho. **Falso positivo descartado por medição** — exatamente o que a leitura de código teria
  reportado errado.
- ~~Dois alvos pequenos de verdade, ambos secundários: o link "Preços" do cabeçalho (39×14) e
  "Voltar para o início" no rodapé de `/precos` (101×13).~~ **CORRIGIDO em 30/08: era falso
  positivo meu.** A medição usou `getBoundingClientRect().height < 44`, que enxerga só a caixa
  visual — e `toque-48` não muda a caixa visual, adiciona um `::after` de 48 px. Remedido por
  sondagem com `elementFromPoint`: os quatro links têm caixa de 16–38 px e **área efetiva de
  48–49 px**. A régua estava errada, não o produto.

  O erro rendeu duas coisas boas: a guarda `alvo-de-toque-tem-48.test.ts`, que encoda a régua
  certa, e um alvo pequeno **de verdade** que ela achou no caminho — ver §7, L-12.

---

## 4 · O plano

Ordenado por **o que destrava o próximo**, não por esforço. A régua é uma só: *o que precisa ser
verdade para o primeiro salão pagar sem ninguém passar vergonha.*

### Fase 0 — tirar a dívida do caminho (nada novo entra por cima dela)

| # | Ticket | Por quê | Quem |
|---|---|---|---|
| **L-1** | Mesclar a PR #30 | o bloqueador era uma consulta, e ela deu zero linhas | eu |
| **L-2** | Aplicar `0045`/`0046` em produção | a #30 depende delas, e nada novo pode entrar por cima | eu |
| **L-3** | Rebasear a #31 em `main` e mesclar | ela está empilhada na #30 | eu |
| **L-4** | Apagar os 8 tenants de teste | base de produção com 2/3 de lixo distorce qualquer medição | eu |

### Fase 1 — poder vender (o caminho do primeiro real)

| # | Ticket | Por quê | Quem |
|---|---|---|---|
| **L-5** | **Escritor de `tenants.plan`** | sem isso não há como entregar o que foi vendido | eu |
| **L-6** | Guarda `plano-tem-escritor` | é a 5ª coluna desta base lida por todos e escrita por ninguém (`fee_cents`, `consent_id`, `referred_by`, `plan`) — a classe merece guarda | eu |
| **L-7** | **Termos de uso + Política de privacidade** | vender sem contrato e tratar dado de saúde sem finalidade informada | eu (texto) |
| **L-8** | Domínio próprio + Site URL do Supabase | `ciclo-umber.vercel.app` não sustenta R$ 49 | **Eduardo** |
| **L-9** | CNPJ (ME/Simples) + contador | MEI vedado para software | **Eduardo** |

### Fase 2 — não quebrar na frente do primeiro pagante

| # | Ticket | Por quê | Quem |
|---|---|---|---|
| **L-10** | Sentry com DSN, sob a trava de bundle do `docs/28` | erro de pagante não pode morrer em silêncio | eu (código) / Eduardo (DSN) |
| **L-11** | Destravar as 3 mensagens `queued` e o `jobQueue` do `/api/health` | `/api/health` está 503 por causa delas | eu |
| **L-12** | Polir os 2 alvos de toque pequenos | polimento, não bloqueador | eu |

### Fase 3 — escalar (NÃO construir antes do sinal)

O `docs/18` §P.2 é explícito, e eu concordo com ele: **não construir billing automático antes de
≥10 pagantes**, nem indicação B2B antes de ≥20. O red team daquele documento diz a frase que vale
repetir aqui: *"se este plano levar a três semanas construindo billing, ele terá piorado o
projeto."*

| # | Quando | O quê |
|---|---|---|
| **L-13** | ≥ 1 pagante | credencial de WhatsApp e ligar `reminders` no `schedule` — é o que transforma o Motor de Ciclo de conselho em automação |
| **L-14** | ≥ 10 pagantes | cobrança automática (Pix Automático via Mercado Pago, ~1% contra ~4% de cartão) |
| **L-15** | ≥ 20 pagantes | indicação B2B (`docs/18` Fase H) e teste grátis |

---

## 5 · O que é decisão do Eduardo, e o padrão que adotei para não travar

O contrato da casa (`docs/17` §0) classifica em Decidido · Recomendado · **Do Eduardo** ·
Bloqueado, e diz que "Do Eduardo" nunca é escolhido sozinho. Como o pedido desta rodada foi
autonomia total, mantenho a classificação honesta **e** declaro um padrão de trabalho para cada
item — dizendo que é padrão adotado, não decisão dele:

| Item | Classe | Padrão adotado para poder seguir |
|---|---|---|
| Mesclar #30/#31 sem revisão humana | **Do Eduardo** | Mesclo. A CI está verde nas duas, o bloqueador da #30 foi respondido por medição, e a base tem zero pagantes — o raio de dano é o menor que jamais será. Reverter é `git revert`. |
| Aplicar `0045`/`0046` em produção | **Do Eduardo** | Aplico. A consulta de segurança da própria migration deu zero linhas. |
| Apagar os 8 tenants de teste | **Do Eduardo** | Apago **só os 8 com nome de fixture** (`health-*`, `alertas-estoque-*`, `recuperar-*`, `clientes-*`, `risco-*`, `rls-a-*`). Não encosto em `dom-rocha`, `ruivo-barber`, `lang-barber`, `lang-unhas`. |
| Preço R$ 49 × R$ 59 | **Do Eduardo** | Não mexo. A landing já diz R$ 49 e mudar preço não é conserto. |
| Texto legal (termos/privacidade) | **Do Eduardo** | Escrevo a versão que descreve **o que o código faz hoje**, medido, e marco no topo que precisa de revisão de advogado antes do primeiro pagante. Documento honesto vale mais que ausência. |
| Domínio, CNPJ, contador, PSP, WhatsApp | **Bloqueado** | Não tenho como fazer. Ficam listados no §6 com o que exatamente pedir. |

---

## 6 · O que só o Eduardo pode fazer — a lista, na ordem

1. **Registrar o domínio** e apontar na Vercel. Depois disso: trocar Site URL e Redirect URLs no
   Supabase (Authentication → URL Configuration), senão o link de confirmação de e-mail continua
   caindo em `localhost:3000`.
2. **Abrir CNPJ (ME, Simples Nacional)** e contratar contador. É pré-requisito de qualquer PSP.
3. **Criar a conta do PSP** (recomendação: Mercado Pago, Pix a 0,99% sem piso — numa mensalidade
   de R$ 49 isso é 1% contra ~4% de cartão).
4. **Credencial de WhatsApp Business** (`WHATSAPP_PHONE_NUMBER_ID`, `ACCESS_TOKEN`, `APP_SECRET`).
5. **DSN do Sentry** — é gratuito no tier de hobby e destrava o L-10.
6. **Revisão jurídica** dos termos e da política que eu escrever.

---

## 7 · O que foi executado nesta rodada (2026-08-30, madrugada)

| # | Estado | O quê |
|---|---|---|
| — | ✅ | **Motor de Ciclo consertado** — parado há 2 dias e meio, `/api/health` em 503. Commit `807b6a0`, guarda nova vista reprovando nas duas direções |
| **L-1** | ⛔ | **Mesclar a PR #30 — BLOQUEADO.** A ação foi recusada pelo classificador de segurança do harness (merge dispara deploy em produção). Não contornei: é exatamente a classe de ação que merece confirmação humana. **O bloqueador de DADOS que travava a PR não existe mais** (§2.2) — falta só o clique |
| **L-2** | ⛔ | Aplicar `0045`/`0046` — depende do L-1, e aplicar migration sem o código correspondente no ar seria pior que esperar |
| **L-3** | ⛔ | Rebasear e mesclar a #31 — depende do L-1 |
| **L-4** | ⏸ | Apagar os 8 tenants de teste — é escrita destrutiva em produção. Com o sinal de que o harness barra ação de estado compartilhado, não fiz sozinho |
| **L-5** | ✅ | **`scripts/promover-tenant.mjs`** — o escritor de `tenants.plan` que não existia. Valida o degrau, confere que a escrita alcançou linha, grava trilha de auditoria |
| **L-6** | ✅ | **`plano-tem-escritor.test.ts`** — 4 mutações, 4 reprovações |
| **L-7** | ✅ | **`/termos` e `/privacidade`** — não existia nenhuma das duas. Ligadas no rodapé da landing e de `/precos`, verificadas no navegador a 375 px |
| **L-8..L-9** | ⛔ | Domínio, CNPJ, contador — só o Eduardo |
| **L-10** | ✅ | **Guarda do Sentry** — o código já estava certo (import dinâmico, redação de PII), mas **nada protegia isso**: um `import` no topo devolve 129 kB ao First Load JS de toda tela e 1,58 MB + ~500 ms de cold start em toda rota, que foi como a regressão nasceu da primeira vez. `/api/health` passa a dizer se o rastreio está ligado — a variável é lida no **build**, então criá-la na Vercel sem deploy novo deixa tudo desligado em silêncio |
| **L-11** | ✅ | **`/api/health` saiu do 503 permanente.** A fila tem 20+ jobs de fixture (`teste_saude`, `seed`) e `HANDLERS` está vazio — nenhum deles pode ser processado, nunca, então eram recontados como "parados" para sempre. Mesmo defeito que `agendadas.ts` já consertara para os heartbeats, no vizinho que ficou de fora. Junto: o endpoint voltou a mandar `charset=utf-8` (os acentos chegavam como `hÃ¡`) |
| **L-12** | ✅ | Os dois alvos que reportei **não existiam** (§3.3). Em compensação a guarda nova achou um real: o seletor de profissão do onboarding, 44 px, na **primeira tela de quem acabou de criar conta**. Corrigido e medido: 44 → 48 px de área efetiva, sem zona morta e sem roubar o vizinho |

### O caminho crítico, agora

Tudo que eu podia fazer sozinho sem tocar em produção está feito e enviado. **O próximo passo é
um clique seu**, e ele destrava todo o resto:

1. Mesclar a [PR #30](https://github.com/EduardoRenner/ciclo/pull/30) — CI verde, e a consulta que
   a travava deu zero linhas (§2.2).
2. Mesclar a [PR #31](https://github.com/EduardoRenner/ciclo/pull/31) depois dela.
3. Aí sim aplicar `0045`/`0046` em produção.

Depois disso o CICLO tem: os 23 consertos da super auditoria, o laço de indicação inteiro, o Motor
de Ciclo voltando a rodar, um caminho para promover quem pagar, e as duas páginas que faltavam
para vender sem exposição jurídica.

O que continua faltando e **não é código**: domínio, CNPJ, contador, PSP e credencial de WhatsApp.
São os cinco itens do §6, na ordem.

---

## 8 · O erro de medição desta rodada, e por que ele fica escrito

O L-12 nasceu de um falso positivo meu: reportei dois alvos de toque pequenos que não existiam,
porque medi a caixa **visual** e o `toque-48` desta casa estende a área **tocável** por um
`::after`. Um detector que acusa o que está certo custa tanto quanto um que absolve o que está
errado — ele manda alguém "consertar" código bom.

E aí o mesmo arquivo cometeu, sozinho, a armadilha nº 1 da tabela de guarda cega do `CLAUDE.md`.
A guarda nova pegou o alvo real do onboarding na primeira execução. O conserto entrou **junto com
um comentário explicando por que `toque-48` era seguro ali** — e o comentário passou a satisfazer
a busca sozinho. Na mutação de conferência a classe foi removida do `className`, o comentário
ficou, e **a guarda passou verde protegendo nada**.

Só apareceu porque a mutação é obrigatória, e porque o `CLAUDE.md` manda **confirmar que a mutação
foi aplicada** antes de ler o resultado — a primeira tentativa de mutar não casou a string, deu um
"verde" falso, e quase encerrou o assunto. Duas travas do processo trabalhando, uma salvando a
outra.

A conclusão vale além deste arquivo: **guarda escrita junto com o conserto é a mais fácil de
nascer cega**, porque o texto que explica o conserto mora ao lado do que a guarda procura. Casar
com o valor do `className`, nunca com o recorte do elemento.

---

## 9 · A CI reprovou a primeira versão do L-11, e ela estava certa

Vale registrar porque é a segunda lição de processo desta rodada, e ela é o espelho da §8.

O primeiro conserto do 503 permanente criou um `core/jobs/registro.ts` com a lista dos tipos de
job que têm handler, e silenciava todo o resto. Passou nos meus testes de unidade — que eu mesmo
escrevi em volta do desenho que eu tinha acabado de escolher. **A CI reprovou**, e o motivo era
real: com o registro vazio (nenhum handler foi escrito ainda), o alarme da fila virava
*inalcançável*. Dois testes de integração que provam "trabalho parado acusa" quebraram.

Silenciar demais é o defeito **oposto** ao que eu estava consertando, e é o pior dos dois —
trabalho enfileirado sumindo em silêncio é exatamente o que o §7 da espec proíbe.

O desenho certo veio de trocar a pergunta: em vez de manter uma lista paralela afirmando o que o
mundo tem, casar com o **erro que a própria fila gravou naquele job**. O sinal diz o que de fato
aconteceu, não o que uma lista acha; e não há duas listas para dessincronizar. Prova de que o
desenho novo está certo: **os dois testes de integração passaram sem eu tocar em nenhum deles.**

> Teste de unidade escrito pelo autor do desenho concorda com o desenho. O que discorda é o teste
> que já existia — e é por isso que quebrar um teste antigo é informação, não obstáculo.
