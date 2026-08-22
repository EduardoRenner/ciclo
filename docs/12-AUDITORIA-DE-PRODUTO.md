# 12 · AUDITORIA DE PRODUTO — 2026-08-21

> Escopo pedido: olhar o CICLO como produto (não como código), achar o que dá para melhorar,
> priorizar por impacto e implementar o que valer mais. Auditoria e execução na mesma sessão.
>
> **Este documento não repete as auditorias anteriores.** `08-REDESIGN-E-IDENTIDADE.md`
> (Partes I e II), `11-INTERFACE-ESTRUTURA-E-FLUXO.md` (Parte III) e os relatórios V1–V5 de
> `10-PROXIMOS-PASSOS.md` já cobriram execução visual, identidade, estrutura de tela,
> segurança, RLS, testes e deploy. Tudo que eles fecharam foi verificado como fechado e **não
> foi mexido**.

---

## 1 · Resumo executivo

O CICLO é um produto bem construído com um desequilíbrio específico e caro: **o servidor sabe
muito mais do que a interface deixa pedir**. Caixa, comissão, estoque, direitos de LGPD e
recuperação de senha estavam inteiros no back-end — com serviço, rota, validação, teste e
auditoria — e **sem nenhuma tela**. Não é dívida técnica: é produto que existe e o dono do salão
não tem como usar.

O segundo eixo é o funil que decide se alguém vira cliente: a porta de entrada (`/`) era um
splash de oito palavras, e a página de agendamento — o link que o salão cola na bio do Instagram
— abria com o título "CICLO", oferecia dias em que o salão está fechado e recebia quem chega à
noite com "Sem horários livres nesse dia".

Nenhum dos dois eixos aparecia nas auditorias anteriores, porque nenhuma delas perguntou "o que
o servidor já faz e ninguém consegue pedir?" nem "o que vê quem ainda não é cliente?".

**Nove frentes foram implementadas nesta rodada** (§6). O que sobrou está em §7, com o motivo.

---

## 2 · Método

Medição ao vivo, não leitura de código: dev server em `:3015`, sessão real no tenant de
demonstração `dom-rocha` (45 clientes, 6 meses de histórico), viewport 375×812 e 1440×900,
medida de alvo de toque e de estouro horizontal lida do DOM. Onde a interface exigia sessão,
as telas foram buscadas autenticadas e o HTML conferido diretamente.

Duas suspeitas caíram na medição e **não viraram item** — registradas aqui porque não inventar
problema é parte do trabalho:

| Suspeita | O que a medição mostrou |
|---|---|
| "Fechado agora" na página do salão estaria errado | Estava certo: 20h53 em São Paulo, salão fecha 20h |
| Telefone e Instagram com alvo de 23px no rodapé | `toque-48` estende a área para 48px; meu primeiro script lia `min-height` em vez de `height` |

---

## 3 · O que está bom e não deve ser mexido

- **A tese do produto está clara na interface.** O Motor de Ciclo não é uma aba escondida: é
  uma das quatro abas da barra, com a marca do produto como ícone.
- **Identidade visual coerente e sem marca de "gerado por IA"** — sem gradiente decorativo, sem
  emoji, sem glow, com marca própria. A Parte II fez esse trabalho e ele se sustenta.
- **Copy em português de gente.** "Nada mais para hoje", "hora de recomprar", "Ninguém para
  recuperar agora". Nenhum jargão de software nas telas auditadas.
- **Página pública do salão bem resolvida**: JSON-LD `LocalBusiness`, canonical, cor de acento
  por tenant, "aberto agora" calculado no fuso do salão, seções que somem sozinhas quando não há
  dado.
- **Arquitetura**: RLS em tudo, dinheiro em centavos, tempo em UTC com conversão só na
  apresentação, regra de negócio pura em `src/core`, idempotência por tenant. 422 testes.

---

## 4 · Diagnóstico, por eixo

Nota, e o que sustenta a nota — não é impressão:

| Eixo | Antes | O que pesou |
|---|---|---|
| Arquitetura | 9,0 | Camadas limpas, RLS testada, sem `any`, decisões registradas |
| Responsividade | 9,0 | Zero estouro medido em 375px; coluna lateral no desktop |
| Acessibilidade | 8,5 | Alvos ≥ 44px, `aria` de verdade, contraste medido, `prefers-reduced-motion` |
| UI / design | 8,5 | Sistema de tokens usado de verdade; elevação, tipografia e marca decididas |
| UX | 7,5 | Ótima dentro do app; a fricção estava toda nas bordas (entrar, agendar, primeiro dia) |
| Maturidade de produto | 7,0 | Backlog fechado, mas com features inacessíveis |
| Personalização | 6,0 | Cor e catálogo por profissão; nada aprendido do uso |
| **Funcionalidade** | **5,5** | Cinco áreas prontas no servidor e invisíveis na interface |
| **SEO / compartilhamento** | **5,0** | Página do salão exemplar; a de agendamento e a landing sem nada |
| **Conversão (CRO)** | **3,0** | A porta de entrada não explicava o produto; o funil começava num beco |

Os três últimos são o assunto desta rodada.

---

## 5 · Matriz de prioridade

Ordenada por impacto × frequência ÷ esforço. `▲` = medido ao vivo, não inferido.

### P0 — impede o uso

| # | Problema | Evidência | Solução | Esforço |
|---|---|---|---|---|
| 1 | ▲ **Sem recuperação de senha na interface.** Quem esquece a senha perde a conta | `/entrar` sem link; `/recuperar-senha` e `/nova-senha` não existiam; `robots.ts` já bloqueava `/nova-senha` | Duas telas sobre a API que já existia | 1h ✅ |

### P1 — alto impacto

| # | Problema | Evidência | Solução | Esforço |
|---|---|---|---|---|
| 2 | ▲ **Alerta de estoque que ninguém consegue resolver.** Toda conta nova abre "Hoje" com 6–8 avisos de recompra de produto que nunca comprou | 6 alertas no tenant de demonstração; `estoque 0 <= ponto de pedido` do pacote da profissão; nenhuma tela de estoque no projeto | Só alertar o que o salão acompanha + tela de estoque | 2h ✅ |
| 3 | ▲ **Caixa sem tela.** `services/caixa.ts` + 2 rotas prontas; `src/app/admin/caixa/` vazia no repositório | Ritual diário sem resposta na interface | `/admin/caixa` (dia, mês, comissão) | 3h ✅ |
| 4 | ▲ **Comissão sem tela.** `extratoDeComissao` pronto e testado | "Quanto pago pro Diego?" só o banco respondia | Seção no caixa | incluído ✅ |
| 5 | ▲ **A landing não explica o produto.** 8 palavras e 2 botões | `/` media 812px, 1 `h1`, 2 links | Landing de verdade, sem preço inventado | 3h ✅ |
| 6 | ▲ **Página de agendamento sem metadado.** É o link que o salão divulga | `<title>` = "CICLO", zero `og:` | `generateMetadata` por tenant | 20min ✅ |
| 7 | ▲ **LGPD sem porta.** Export e eliminação existem desde o TICKET-054 | Zero referência em `src/app/admin` | Ações na ficha, com o caminho do MFA | 1h30 ✅ |

### P2 — melhoria relevante

| # | Problema | Evidência | Solução | Esforço |
|---|---|---|---|---|
| 8 | ▲ **O funil começa num beco.** Dias fechados oferecidos como iguais; sexta 21h abre em "Sem horários livres" | Trilho de 14 dias sem relação com o expediente | Marca de fechado + abrir no próximo dia útil | 1h ✅ |
| 9 | ▲ **Datas do agendamento em UTC.** Das 21h à meia-noite em Brasília a coluna de hoje some | `toISOString()` em `proximosDias` | Data e hora no fuso do salão | 30min ✅ |
| 10 | ▲ **A confirmação não confirma nada.** Nem dia, nem hora, nem com quem, nem saída | Tela de sucesso com 2 parágrafos genéricos | Recibo + volta para o salão | 40min ✅ |
| 11 | ▲ **"Valor parado" incompreensível.** R$ 5,40 numa cliente de corte de R$ 45 | `preço × chance de retorno`, sem explicação na tela | Rótulo honesto + a conta explicada | 20min ✅ |
| 12 | ▲ **Sem como compartilhar o próprio link.** Dava para ver o site, nunca para mandá-lo | Nenhuma ação de compartilhar no app; PWA não tem barra de endereço | Folha nativa do celular + cópia no desktop | 30min ✅ |
| 13 | ▲ **Endereço do salão era texto morto** e "Feito com CICLO" não levava a lugar nenhum | Página pública | Link de rota + link do produto | 15min ✅ |
| 14 | ▲ **Venda de pacote e crédito na carteira sem tela.** A ficha mostra saldo e pacotes, mas só leitura | `/api/v1/packages`, `/wallet` sem referência na interface | Sheets de venda e crédito na ficha | 2h ✅ |
| 15 | **Campanhas e orçamentos moram em "Configurações"** | Hub de config agrupa ferramenta operacional com ajuste | Repensar a casa dessas duas | ~2h ⬜ |

### P3 — refinamento

| # | Problema | Solução |
|---|---|---|
| 16 | ~~`/admin/campanhas` e `/admin/comanda/*` sem `loading.tsx`~~ — **item falso**, herdado da nota do TICKET-083: a Parte III já cobriu as duas. Varredura confirma que só `admin/` (um `redirect`) não tem, e não precisa | nada a fazer ✅ |
| 17 | Sem "adicionar à agenda" (`.ics`) na confirmação do agendamento | Avaliar contra a CSP antes ⬜ |
| 18 | ▲ Nenhum "primeiros passos" para conta nova (o painel nascia vazio e mudo) | Central de ações reconhece conta sem cliente nem agendamento ✅ |

---

## 6 · O que foi implementado

Sete commits, cada um com o porquê na mensagem:

| Commit | O que entrou |
|---|---|
| `TICKET-084` | `/recuperar-senha` e `/nova-senha`; `/auth/callback` honra `next` restrito a caminho interno |
| `TICKET-085` | `/admin/caixa`: dia navegável pela URL, mês, comissão por profissional, guard de `report:read` |
| `TICKET-086` | Alerta de estoque só para o que o salão acompanha + `/admin/estoque` com entrada de compra; 2 testes de regressão |
| `TICKET-087` | Funil público: metadado próprio, fuso do salão, dia fechado visível, abre no próximo dia útil, recibo na confirmação, endereço com rota, assinatura clicável |
| `TICKET-088` | Landing de verdade em `/`, com metadado e exemplo real |
| `TICKET-089` | Compartilhar o link de agendamento; "Dá para recuperar" explicado |
| `TICKET-090` | Direitos LGPD da cliente na ficha, com o caminho do MFA quando falta o segundo fator |
| `TICKET-091` | Vender pacote e lançar crédito na ficha — o último "servidor pronto, tela ausente" |
| `TICKET-092` | Primeiros passos na tela "Hoje" para conta que ainda não começou |

Verificado ao vivo, não só compilado: `POST /inventory/entries` (estoque foi de 0 para 12 e o
custo médio de R$ 18,00 para R$ 19,50), `GET /clients/:id/data-export` com TOTP real cadastrado e
removido depois, o caixa em três datas diferentes, e o trilho do agendamento abrindo em sábado
depois do fechamento de sexta.

---

## 7 · O que não foi feito, e por quê

- **Preço na landing** — decisão comercial do Eduardo (`10-PROXIMOS-PASSOS` §4). A seção não
  existe em vez de existir com número inventado.
- **Depoimento, logotipo de cliente, número de usuários** — não há nenhum real. Prova social
  falsa é o defeito mais caro que uma landing pode ter.
- **Identidade jurídica no rodapé** (razão social, CNPJ, encarregado de dados) — pendência já
  registrada em V5; nada disso pode ser inventado.
- **`.ics` na confirmação** — a CSP do TICKET-057 é estrita e o efeito de `blob:`/`data:` em
  download precisa de teste em aparelho de verdade antes de virar promessa.
- **O caminho feliz de "Apagar os dados"** não foi executado: apagar cliente de verdade no
  tenant de demonstração destruiria o histórico que sustenta as telas de CRM. O caminho de erro
  (sem MFA) e o export completo foram, os dois ao vivo.

---

## 8 · Roadmap sugerido

**Agora (destrava dinheiro ou lei):**
1. Definir preço e ligar a seção na landing.
2. Identidade jurídica → Política de Privacidade e Termos.

**Próxima etapa:**
3. Repensar a casa de campanhas e orçamentos (P2 #15) — ferramenta de trabalho atrás de uma
   engrenagem de "Configurações".

**Depois:**
4. Cron de verdade (lembrete e expiração de sinal ainda não rodam sozinhos — decisão de custo já
   registrada).
5. Foto/galeria na página pública, com o consentimento desenhado antes.

**Futuro:**
6. Instrumentar o funil (`/` → cadastro → onboarding → primeiro agendamento) quando houver
   tráfego real para medir.
