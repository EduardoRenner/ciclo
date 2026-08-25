# 21 · AUDITORIA — FALHA SILENCIOSA

> Rodada em **2026-08-24/25**, na madrugada, começando como auditoria de copy (`docs/20`) e
> virando outra coisa no meio: seis defeitos da mesma família, em quatro camadas diferentes do
> produto.
>
> **Rótulos** (§2.4 do `17-MONETIZACAO-PROMPT.md`): **[M]** Medido · **[E]** Estimado · **[S]** Suposto.

---

## 0 · A família

Nenhum dos seis defeitos abaixo aparecia como erro. **Todos passavam em teste, respondiam 200, ou
funcionavam exatamente como escritos.** É por isso que sobreviveram — alguns por meses.

> **Um sistema que não faz nada e diz que está bem é pior que um que quebra.** O que quebra pede
> socorro. O que finge não pede, e ninguém procura.

A auditoria não começou por essa tese; ela apareceu ao terceiro achado e organizou o resto.

---

## 1 · Os seis achados

| # | Onde | O que parecia | O que era | PR |
|---|---|---|---|---|
| 1 | copy da landing e de `/precos` | promessas de lembrete, confirmação por WhatsApp e "menos de três minutos" | **quatro** promessas que o código não cumpre; o número era a meta do `09` §13.2, nunca medida | [#2](https://github.com/EduardoRenner/ciclo/pull/2) |
| 2 | `tests/integration/resumo-hoje.test.ts` | flake noturna conhecida e documentada | além da flake, um caso que **passava vazio**: afirmava que tudo fica vazio, e passava quando o agendamento escorregava para amanhã | [#3](https://github.com/EduardoRenner/ciclo/pull/3) |
| 3 | `cron.yml` × rotas de cron | agendador ligado, jobs verdes | `200` com `tenantsProcessados: 0` — o schedule diário só alcançava **UTC-3**; `segments` só alcançaria Fernando de Noronha | [#4](https://github.com/EduardoRenner/ciclo/pull/4) |
| 4 | `sitemap.ts` | sitemap correto | entregava ao buscador uma **barbearia que não existe**, com agendamento ligado | [#5](https://github.com/EduardoRenner/ciclo/pull/5) |
| 5 | `sair.tsx` | logout limpa o aparelho | **descartava trabalho pendente sem avisar** — doze atendimentos marcados sem rede sumiam calados | [#6](https://github.com/EduardoRenner/ciclo/pull/6) |
| 6 | `agendar.tsx` | "Você vai receber a confirmação por WhatsApp" | falso em **três níveis independentes**; nenhum canal alcançava aquela pessoa | [#7](https://github.com/EduardoRenner/ciclo/pull/7) |

**Base de testes:** 668 → 698 **[M]**.

### 1.1 · O achado nº 6 merece nota separada

É o único em que quem paga a conta **não é o CICLO**. Na landing, promessa falsa queima a
credibilidade do produto. Ali, quem fica mal é o **salão**: o cliente dele espera uma confirmação
que não vem e conclui que o estabelecimento é desorganizado — usando um software escolhido para
parecer o contrário.

---

## 2 · Por que sobreviveram

Uma causa, medida em todos os seis: **existia guarda onde o defeito não estava.**

`/precos` tinha `precos-nao-promete-demais.test.ts` e **não deixou** promessa falsa entrar. A home
não tinha, e deixou entrar quatro. O padrão se repete em cada camada:

| Camada | Tinha guarda? | Resultado |
|---|---|---|
| `/precos` | sim | limpa |
| home, agendamento público | não | quatro e uma promessas falsas |
| schedule × filtro de hora da rota | não | dois anos-luz de distância, verde |
| sitemap × natureza do tenant | não | negócio fictício indexado |

E há uma armadilha específica de guarda: **o teste do `/precos` confere o degrau do plano, não se o
motor está ligado.** Ele nunca pegaria o item "Lembrete e confirmação" — o módulo existe e o Grátis
o libera; o que não acontece é a rota rodar. Guarda certa, pergunta errada.

---

## 3 · O achado de método, e é o mais reaproveitável

Escrevi cinco guardas nesta rodada. Para cada uma, reintroduzi os defeitos que ela existe para
pegar. **Três delas estavam cegas em pelo menos um caso** — e as três teriam sido entregues como
verificadas:

| Guarda | O que ela casava | O que devia casar |
|---|---|---|
| copy da home | `vercel.json` com `crons: []` | o `cron.yml`, que é o agendador de verdade — o `vercel.json` fica vazio **de propósito e para sempre** (`18` §L.5) |
| logout | `drenarFilaPendente` via `indexOf` | a **chamada** `await drenarFilaPendente(` — o nome solto casava com a linha de `import` no topo, onde a ordem é a dos imports, não a da execução |
| agendamento público | `/telefone/` | a **frase** da instrução — `/telefone/` casava com o rótulo do campo "Seu telefone (WhatsApp)", que está sempre lá |

As três falham do mesmo jeito: **casam com algo incidental que o arquivo contém por outro motivo.**
Uma guarda assim é pior que nenhuma, porque produz confiança sem informação.

> **Regra que sai daqui:** guarda que varre código tem que casar com o que MUDA quando o defeito
> volta — a chamada, a frase, o valor. Nunca com um nome que aparece no import, num rótulo, num
> comentário ou numa string vizinha.

E o corolário, que custou caro para aprender:

> **Guarda que nunca foi vista reprovando é guarda que ninguém sabe se funciona.** Reintroduzir o
> defeito é barato; descobrir em produção que a guarda era decorativa, não.

### 3.1 · Uma guarda pegou o autor

O teste do cron reprovou o **meu próprio commit**: durante o teste de mutação, cada rodada
terminava com `git checkout -- .github/workflows/cron.yml`, e como a correção ainda não estava no
índice, o último checkout a reverteu. Subi o teste sem o conserto que ele guarda, e a CI apontou
exatamente o defeito que ele existe para pegar.

**Lição operacional:** em teste de mutação, commitar **antes** de mutar. `git checkout --` sobre
mudança não commitada apaga a mudança, e o `git status` não denuncia se o arquivo novo era
untracked.

---

## 4 · Verde não é prova

Três episódios distintos desta rodada, todos com check verde:

1. **`resumo-hoje` às 23:17** — `5 tests | 3 skipped`. Verde legítimo, e os três casos que
   importavam **não rodaram**. A prova real só veio às 00:44: `5 tests`, zero pulados **[M]**.
2. **Cron disparado à mão** — dois jobs verdes, `tenantsProcessados: 0`. O zero estava *certo*
   naquele instante (filtro de hora local), e ler o porquê revelou o defeito nº 3.
3. **O caso "cancelado"** — passava afirmando que tudo fica vazio, quando o vazio vinha do
   agendamento ter escorregado para o dia seguinte. **Nunca apareceu como vermelho.**

> **Falso verde é pior que flake.** Flake incomoda até alguém consertar; falso verde tranquiliza
> até alguém se machucar.

Corolário para skip: um caso que pula precisa dizer **por quê**, e o verde de uma suíte com skip
não pode ser lido como prova de que o cenário funciona.

---

## 5 · O que ficou aberto

| # | Item | Onde | Classificação |
|---|---|---|---|
| A.1 | `.env.local` aponta para o **Supabase de produção**, então `test:rls` e `test:integration` criam tenant e usuário na base real toda vez que rodam. É a causa dos tenants órfãos que o `sitemap` não consegue filtrar (nascem com slug aleatório) | `18` §P.1.1, P-B.1 | **Do Eduardo** — envolve conta e possivelmente dinheiro |
| A.2 | `reminders` e `campaigns` continuam fora do `schedule`, de propósito. Ligar exige os três passos do cabeçalho do `cron.yml` — entre eles conferir se os telefones do tenant de demonstração são de gente real | `cron.yml` | **Bloqueado** por credencial (TICKET-043) |
| A.3 | A coluna `is_demo` continua sendo o desenho durável para distinguir tenant de demonstração; hoje é lista em `core/` porque migration aqui não é aplicada por deploy | `src/core/tenants/demonstracao.ts` | **Recomendado** |
| A.4 | `"Não consegui abrir o cofre agora."` não diz o que fazer — e é a área de dado de saúde. O projeto já tem o padrão certo em `sair.tsx` (`"Confira a conexão e tente de novo."`) | `admin/clientes/[id]/saude.tsx` | **Decidido** — corrigido nesta rodada |
| A.5 | Nenhuma medição de visita existe, então `visitante → cadastro` continua incalculável | `docs/20` §G.1 | **Recomendado** |

---

## 5.1 · ⭐ Achado nº 7, na frente de performance: 129 kB de Sentry inerte

Aberta a auditoria de performance, o primeiro número já era o achado — e ele é da **mesma família
dos outros seis**, agora na camada do que o navegador baixa.

**Medido em 2026-08-25**, sobre o build e sobre o bundle de produção:

| | |
|---|---|
| First Load JS compartilhado por **todas** as páginas | **188 kB** **[M]** |
| Dentro dele, o maior chunk | **129 kB** gzip · 412 kB brutos **[M]** |
| O que há nesse chunk | **Sentry** — 170 ocorrências de `sentry`, mais `captureException` e `sentry.io`; zero Supabase, zero lucide **[M]** |
| O segundo chunk | React, 54 kB **[M]** |
| DSN no bundle de **produção** | **nenhum**, nos 12 chunks varridos **[M]** |

`NEXT_PUBLIC_SENTRY_DSN` é inlinado no build. Não estando no bundle, `Sentry.init` roda em
produção com `dsn: undefined`: o SDK inicializa e **não envia nada**.

**Dois terços do JS inicial de qualquer tela são observabilidade que não observa** — num produto
mobile-first, para quem atende de celular barato em 4G.

### O custo, medido na página de produção que está no ar

Baixando `ciclo-umber.vercel.app/` com `Accept-Encoding: gzip`, somando HTML, os 12 chunks e o
CSS **[M]**:

| | |
|---|---|
| HTML | 7 kB |
| JS (12 chunks) | 242 kB |
| CSS | 10 kB |
| **Total** | **258 kB comprimidos** |
| Sentry dentro disso | **129 kB — metade de tudo que a página baixa** |

E em tempo, que é a unidade que a pessoa sente **[E]** (largura de banda nominal, sem latência):

| Conexão | Hoje | Sem o Sentry |
|---|---|---|
| 3G lento (400 kbps) | **5,2s** | 2,6s |
| 4G ruim (1,5 Mbps) | 1,4s | 0,7s |

**A página carrega no dobro do tempo, numa conexão ruim, por causa de um SDK que hoje não envia
nada.** Este é o número que transforma o achado de curiosidade técnica em decisão de produto: o
público-alvo do CICLO é quem atende de celular, e a primeira tela é a única que precisa convencer.

### A hipótese que eu testei e que estava errada

Supus que o peso viesse do Replay viajando sem ser usado, e apliquei `bundleSizeOptimizations` no
`withSentryConfig`. Medido antes e depois: **208 bytes brutos, 57 gzip. 0,0%.** O Sentry v10 já
removia aquilo sozinho. **Revertido** — configuração que não faz nada é ruído que a próxima pessoa
vai ler achando que faz.

Fica registrado porque hipótese refutada com número vale mais que hipótese não testada.

### As duas saídas, e por que a escolha não é minha

| Saída | O que ganha | O que exige |
|---|---|---|
| **Ligar o Sentry** — definir `NEXT_PUBLIC_SENTRY_DSN` na Vercel | os 129 kB passam a pagar por si; erro de produção deixa de ser invisível | acesso à conta da Vercel, e aceitar que o dado comece a fluir (a redação do TICKET-057 já está pronta) |
| **Não embarcar o que não se usa** — carregar o SDK por `import()` dinâmico, guardado pelo DSN | com DSN ausente, os 129 kB somem; com DSN presente, idêntico a hoje | mexer na fiação que o TICKET-057 montou, e o `onRouterTransitionStart` que o Next espera exportado |

**Classificação: Do Eduardo.** — e eu não implementei a segunda, de propósito: **não tenho como
testar o caminho com DSN presente**, porque não posso definir variável na Vercel. Entregar um ramo
não verificado da fiação de observabilidade, numa auditoria cujo tema é "verificado × suposto",
seria repetir o defeito com outro nome. Se a fiação quebrasse, ela quebraria em silêncio — que é
literalmente o §0 deste documento.

**Recomendação, se for para escolher uma:** ligar o DSN. O produto tem seis rotas de cron, uma fila
offline e um cofre cifrado; descobrir falha de produção por relato de cliente é caro demais para
economizar num campo de formulário na Vercel.

---

## 5.2 · A landing resolve a sessão duas vezes, e por isso não pode ser cacheada

Medido no código **[M]**:

| Onde | O que faz |
|---|---|
| `src/middleware.ts` | `db.auth.getUser()` em **toda** requisição não-estática — o matcher só exclui `_next/static`, `_next/image` e imagem. Existe para renovar o access token de 15 min |
| `src/app/page.tsx:116` | `sessaoAtual()` de novo, **só** para redirecionar quem já está logado para `/admin/hoje` |

Duas resoluções de sessão por visita à landing. E a segunda é o que marca a página como dinâmica
(`ƒ` no build **[M]**): a única tela do produto cujo trabalho é **convencer um visitante anônimo**
é também a única que não pode ser servida de cache.

TTFB medido em produção **[M]**, três amostras: `/` entre **0,44s e 0,83s**. Uma página estática
sairia do CDN em fração disso.

**A resposta já está no middleware.** Ele computa `data.user` de qualquer jeito; o redirecionamento
de quem está logado caberia ali sem custo novo, e `/` voltaria a ser estática.

**Não implementei**, e o motivo é o mesmo do §5.1: mexer em roteamento de autenticação exige
verificar os dois caminhos, e daqui eu só consigo testar o anônimo. O caminho de quem está logado
precisaria de credencial real. — **Recomendado**, com a ressalva de que o ganho (centenas de ms de
TTFB) é menor que o do §5.1 (129 kB, metade da página).

⚠️ **Nota de medição, para não virar achado falso:** `/precos` variou entre **0,78s e 2,47s** nas
três amostras. Três amostras, de uma máquina só, não distinguem cold start de problema real —
então **isso não é um achado**, é uma pergunta. Quem for medir de verdade precisa de amostragem ao
longo do dia, e o próprio Sentry (§5.1) daria isso de graça se estivesse ligado.

---

## 6 · Onde procurar da próxima vez

Em ordem do que rendeu:

1. **Costura entre agendador e código agendado.** Quem dispara e quem filtra foram escritos em
   momentos diferentes, e ninguém reviu a emenda quando o agendador mudou.
2. **Teste que afirma ausência.** "Tudo fica vazio" passa por acidente. Todo caso que assere lista
   vazia precisa provar que o cenário foi montado.
3. **`catch` que devolve um padrão.** A maioria é legítima; a minoria apaga trabalho de alguém.
   O critério: o `catch` decide **descartar** alguma coisa? Então tem que contar e avisar.
4. **Promessa de canal.** Toda frase que diz que algo "vai chegar" precisa apontar para uma rota
   agendada e uma credencial existente.
5. **O que é publicado para fora.** `sitemap`, `robots`, metadados: eles falam com o mundo sem
   ninguém olhando.
6. **Ferramenta instalada e não ligada.** O Sentry tinha SDK, redação, wrapper de build e ticket
   fechado — e nenhum DSN em produção (§5.1). Instalar não é ligar, e o custo continua sendo pago
   pelo usuário a cada tela.

---

## 7 · Definição de pronto desta auditoria

- [x] Seis achados corrigidos, cada um com PR próprio e teste-guarda
- [x] Cada guarda verificada contra os defeitos reais que existe para pegar
- [x] As três guardas cegas encontradas e corrigidas — e registradas aqui, não escondidas
- [x] Cada decisão registrada em `docs/DECISOES.md`
- [x] O que ficou aberto está no §5, com classificação e dono
- [x] Nenhuma correção depende de migration não aplicada
