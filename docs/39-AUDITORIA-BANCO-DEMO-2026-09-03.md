# Auditoria do banco de demonstração · 2026-09-03

Varredura completa das 8 contas em produção (`sukloaoodpxjukngyojo`), o que estava quebrado e o
que foi corrigido nesta rodada. PRs #54, #55 (mergeados) e #56.

## Estado das contas — depois

| conta | plano | clientes | concluídos | comandas | faturamento | avaliações | pacotes | fila | ciclos | hash nulo | logo/capa |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|:--|
| **dom-rocha** | avançado | 46 | 263 | 263 | R$ 16.000 | 45 | 7 | 9 | 45 | 0 | sim |
| teste-essencial | essencial | 23 | 138 | 138 | R$ 8.092 | 37 | 6 | 9 | 22 | 0 | sim |
| teste-equipe | equipe | 22 | 138 | 138 | R$ 8.199 | 28 | 6 | 9 | 22 | 0 | sim |
| teste-avançado | avançado | 22 | 138 | 138 | R$ 8.096 | 28 | 6 | 9 | 22 | 0 | sim |
| lang-barber | grátis | 12 | 57 | 57 | R$ 3.275 | 24 | 6 | 9 | 12 | 0 | sim |
| lang-unhas | essencial | 12 | 57 | 0 | — | 0 | 0 | 0 | 12 | 0 | sim |
| ruivo-barber | grátis | 1 | 0 | 0 | — | 0 | 0 | 0 | 0 | 0 | sim |
| verify-series-526807 | grátis | 0 | 0 | 0 | — | — | — | — | — | 0 | não |

## Bugs reais encontrados

### 1. `phone_hash` nulo em 134 clientes de 6 contas 🔴

44 deles no `dom-rocha`, que é o botão "Ver um salão de exemplo" da landing. Nada quebra na tela,
mas toda busca por telefone no produto passa pelo hash: com ele nulo, o reconhecimento nunca
reconhece ninguém e quem **já é cliente** toma 500 ao tentar remarcar. Falha que só aparece na
hora de demonstrar.

- **Causa:** `seed-demo-barbearia.mjs`, `seed-demo-6-negocios.mjs` e `seed-tenant-teste.mjs`
  montam a linha do cliente por lista de colunas e `phone_hash` não estava nela.
- **Corrigido:** backfill rodado (134 gravados, 0 restantes, conferido de ponta a ponta) + os três
  scripts + guarda nova que **varre o diretório** de scripts em vez de mirar um arquivo.

### 2. Camada de dinheiro vazia em 5 contas

`dom-rocha` tinha 0 comandas; `teste-*` tinham 3; `lang-barber` tinha 0 — com 138/57 atendimentos
concluídos cada. "Caixa", "Faturamento" e "Sobrou" abriam zerados.

- **Corrigido:** `seed-demo-dinheiro.mjs` agora roda para as 5 barbearias. Uma comanda fechada por
  atendimento concluído, com comissão por profissional, custo de material da ficha de consumo,
  desconto e gorjeta ocasionais. As fórmulas espelham `core/comanda/totals.ts` e o script confere
  no fim.

### 3. Agenda futura zerada em todas as contas

O histórico parava num dia fixo; passadas duas semanas, "Hoje" e "Agenda" abriam vazias — na
demo do produto cujo coração é a agenda.

- **Corrigido:** `seed-demo-agenda-futura.mjs` recria os próximos 21 dias em relação a hoje. O
  volume sai do ritmo real do negócio (concluídos por dia útil nos últimos 90 dias), com teto de
  2 marcações por pessoa, distribuído por dia com peso decrescente. 60% dos horários vão para
  quem o Motor de Ciclo marcou como `due`/`late`/`at_risk`.

### 4. `client_cycles` = 0 em `lang-barber`

O cron do Motor de Ciclo nunca passou nessa conta — "Recuperar" abria vazia.

- **Corrigido:** recalculado (12 ciclos). Feito também nas outras contas por garantia.

### 5. Tenant de demonstração podia disparar WhatsApp/e-mail real (latente)

`notificarProximoDaLista` (fila de espera) e `/cycle/recover/send` chamam `enviarComFallback`
direto, sem o filtro de demonstração que `lembretes` e `campaigns` têm. Se o WhatsApp Cloud for
configurado, um cancelamento numa conta de exemplo mandaria mensagem real para um telefone
inventado.

- **Corrigido (#54):** trava no ponto único por onde todo envio passa.

### 6. Personalização visual invisível

Nenhuma das contas tinha logo, capa ou foto de profissional — a página que a cliente abre saía
só com texto.

- **Corrigido (#55):** monograma como logo, faixa com a cor do negócio como capa, avatar de
  iniciais por profissional (ativos de marca de verdade, nunca fotografia inventada). `generateMetadata`
  passa a usar a capa como imagem de Open Graph — o card do WhatsApp/Instagram do salão mostra a
  marca.

## Pendências

| Item | Por quê está pendente |
|---|---|
| **`verify-series-526807`** — órfão de teste, 0 dados, slug aleatório, **entra no sitemap** | O classificador me barrou de apagar tenant em produção. Precisa ser deletado à mão. |
| **`dom-rocha` ainda magro** — 46 clientes, ~10 cortes/semana num salão de 3 cadeiras, visitas achatadas em 5–7 | Engordar de verdade exige refazer o histórico, e `seed-demo-barbearia.mjs` **deleta o tenant + o usuário dono** ao rodar. Risco alto de fazer autônomo. |
| **`lang-unhas`** — sem camada de dinheiro | Vertical de unhas, vocabulário de serviço diferente do `seed-demo-dinheiro` (feito para barbearia). |
| **6 contas `demo-*`** do `seed-demo-carteira.sql` (PR #53) | Não existem neste banco — aquele SQL de 78 KB é inerte. Só rodaria com as contas criadas antes, ou apontando o `.env.local` para o projeto certo. |
