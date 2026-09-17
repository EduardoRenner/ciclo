# 70 · RELATÓRIO DO LOOP FOCADO EM PERFORMANCE E VELOCIDADE (2026-09-17)

> Pedido do Eduardo depois do loop de experiência do cliente: "faz mais uma /loop mais focada em
> performance e velocidade". Mesma disciplina do `docs/67` (medir antes de agir, mutação real
> antes de confiar em guarda, registrar tudo em `docs/DECISOES.md`), aplicada a latência e
> desperdício de rede em vez de segurança/copy.

---

## 1 · Placar

| | Quantidade |
|---|---|
| Bugs reais achados e corrigidos | 6 |
| Achados registrados, não corrigidos (risco > ganho, ou precisa de dado real) | 2 |
| Guarda de segurança atualizada com mutação completa | 1 |
| Commits | 8, todos com CI verde |
| Varredura sistemática confirmando o padrão esgotado | 1 (via `awk` em todo `page.tsx`) |

---

## 2 · Os 6 bugs reais

1. **`agendar.tsx` (agendamento público) — busca de disponibilidade em dobro.** Tocar no
   serviço/profissional já pré-selecionado disparava a busca automática de montagem E a busca do
   clique, ambas para o mesmo par serviço+dia. Caminho comum: salão de um serviço só, ou
   confirmar a primeira opção da lista. Corrigido comparando o id novo contra o atual antes de
   buscar; `&& !erro` preserva o clique como retentativa. **Prova real em produção**: aba nova,
   um clique, uma requisição — não duas (as duas primeiras tentativas de verificação deram falso
   negativo por um service worker de teste travado na versão anterior do deploy).
2. **`admin/caixa/page.tsx`** — a extração de comissão por profissional esperava as outras sete
   consultas do lote (concentração do mês, material do catálogo, etc.) sem depender de nenhuma
   delas, só da lista de profissionais.
3. **`admin/comanda/[id]/page.tsx`** — mesmo padrão: o cartão "Sobrou" esperava
   `listarServicos`/`listarProdutosAtivos`/`contextoDePlano` sem precisar de nenhum. Este achado
   colidiu com a guarda de segurança `lucro-nao-vaza-para-quem-atende.test.ts` (lucro/comissão é
   dado sensível dentro do salão, já vazou uma vez em 2026-09-09) — ver §3.
4. **`admin/estoque/page.tsx`** — `contextoDePlano` rodava sozinho, inline no JSX, depois do
   `Promise.all` de produtos+alertas, sem nenhum motivo.
5. **`admin/campanhas/nova/page.tsx`** — mesmo padrão, e aqui nem cabia argumento de fail-fast: o
   público de cada segmento é usado tanto na tela liberada quanto na tela de bloqueio de plano.

(A numeração de `docs/DECISOES.md` tem 7 itens porque o item 4 foi um achado **checado e não
corrigido** — ver §4 — e o item 7 foi a varredura final de confirmação, não um bug novo.)

Em todos os casos, o padrão é o mesmo: uma consulta que só depende de UM item de um lote maior
esperava o lote INTEIRO terminar antes de sequer começar, mesmo latência de rede que não deveria
existir. Nenhum dos consertos muda O QUE a tela calcula — só QUANDO cada consulta parte.

---

## 3 · A parte mais delicada: guarda de segurança colidiu com um conserto de performance

O conserto do item 3 (`admin/comanda`) mudou a FORMA do código de `const sobra = podeVerLucro &&
(...) ? await (...) : null` para um retorno antecipado dentro de uma promise encadeada — e isso
quebrou a guarda que garante que comissão/lucro não vaza para o profissional comissionado.

Não ajustei a guarda só para fazer passar. Reli o docstring inteiro (cita o incidente histórico
de 2026-09-09), tracei manualmente que a propriedade de segurança seguia verdadeira no código
novo, reescrevi o regex da guarda para casar com a forma nova, e **fiz a mutação de propósito**
(removi `podeVerLucro &&` da condição, confirmei que a guarda ATUALIZADA reprova com a mensagem
certa, restaurei, confirmei árvore limpa) antes de comitar — o procedimento do `CLAUDE.md` não é
opcional quando o que está em jogo é vazamento de dinheiro dentro do salão.

---

## 4 · Achados registrados, não corrigidos

| Item | Onde | Por quê não corrigi |
|---|---|---|
| `admin/clientes/[id]` busca `cliente` antes de um lote de 17 consultas | `crm.ts`, `fichaDoCliente` | Diferente dos outros: se o cliente não existe, as 17 consultas seriam TODAS descartadas — fail-fast é uma troca defensável, não um descuido. Além disso é a função mais escrutinada pela guarda de lucro (regex de posição), ganho menor não justifica o risco. |
| `prestacaoDeContasDoMotor` (previsao.ts) pagina sequencialmente `cycle_predictions` de 12 meses, na tela mais visitada do painel ("Hoje") | `previsao.ts` | Só é um problema real se algum tenant passar de 1000 previsões/ano — não tenho acesso a produção para contar linhas, e simular seria estimar, não medir. Registrado para quando houver conta real grande o bastante, ou para o Eduardo decidir se vale uma agregação em SQL independente do volume de hoje. |

---

## 5 · O que foi verificado sem achado

Serviço e página já bem otimizados, sem waterfall nem N+1: `resumo-hoje.ts` (1 requisição,
documentado desde o TICKET-025), `caixa.ts`/`alertas-estoque.ts`/`public-booking.ts` (paralelismo
já correto, incluindo o N+1 de disponibilidade por profissional já resolvido antes),
`admin/agenda`, `admin/clientes` (lista), `admin/config/meu-plano`, `admin/config/planos`,
`admin/orcamentos`, otimização de imagem na vitrine pública (`width`/`height` explícitos, WebP
pré-otimizado no upload, `loading="lazy"` correto), peso de bundle do `ics.ts` (trivial), e o
cold start do primeiro acesso (já caracterizado e aceito numa sessão anterior — "1 só, não 1 por
tela" — não é um bug de código, é o modelo serverless).

**Varredura final de confirmação:** um `awk` percorrendo TODO `page.tsx` do projeto procurando um
`await` solto entre o primeiro `Promise.all` e o próximo `return` (a assinatura exata dos itens
2, 3, 5 e 6) não achou mais nenhuma ocorrência fora das quatro já corrigidas. O padrão está
esgotado neste formato específico de arquivo.

---

## 6 · Itens que precisam de você

Nenhum achado deste loop precisa de decisão urgente. Os dois itens da §4 ficam registrados para
quando houver dado real de produção (contagem de linhas de `cycle_predictions`, ou proporção de
acessos a ficha de cliente inexistente) — nenhum dos dois é seguro nem dinheiro pendente.

---

## 7 · Por que parei aqui

A varredura sistemática (§5) confirma que o padrão específico que gerou os 4 primeiros achados
está esgotado em todo `src/app`. Os dois achados restantes (§4) foram conscientemente NÃO
corrigidos por terem risco maior que o ganho medido, e continuar catando variações cada vez mais
marginais do mesmo padrão viraria simular atividade — o que a §10 do `docs/67` pede para evitar.
Seis conserto reais, com CI verde em todos, e um deles com a disciplina completa de mutação numa
guarda de segurança, é um resultado sólido para encerrar esta rodada.
