# 41 · Auditoria de colunas sem consumidor e plano de execução

**Data:** 2026-09-04 · **Método:** varredura das 58 tabelas de `types.gen.ts` contra os 443
arquivos de `src/` e as 59 migrations.

## O varredor estava cego três vezes, e isso é parte do resultado

Registrado porque a mesma classe de erro já apareceu quatro vezes nesta base e vai aparecer de novo:

1. **CRLF.** O regex de tabela usava `\n` e o arquivo é CRLF. Resultado: `Row: {` aparecia 58 vezes
   e o varredor casava **zero** tabelas, reportando "0 órfãs" com ar de aprovação.
2. **`\b` dentro de template literal.** O heredoc colapsou `\b` em `\b`, e em template literal do
   JS `\b` é **backspace (U+0008)**. A regex passou a não casar nada e o varredor acusou 488
   órfãs, incluindo `appointments.price_cents`, que tem leitor em cinco arquivos.
   **Variante nova:** a checagem de byte no arquivo **passa limpa**, porque a corrupção só nasce
   quando o JS avalia o template. Conferir o arquivo não basta; tem que conferir a regex montada.
   O conserto é `String.raw`.
3. O piso ("achei N tabelas, N arquivos, N migrations") foi o que denunciou os dois. Sem ele, os
   dois resultados falsos teriam virado conclusão.

## Resultado real

- **0 colunas sem consumidor nenhum.** A classe que rendeu oito achados (de `fee_cents` a
  `appointments.deposit_cents`) está esgotada no nível de coluna solta.
- **34 colunas sem consumidor em TypeScript.** Classificadas abaixo. A maioria não é defeito.

## Classificação

### A. Recurso desenhado e não construído (documentar, não "consertar")

| O quê | Situação |
|---|---|
| `commissions` (6 colunas) | A tabela **nunca é lida nem escrita**. Comissão é calculada em `core/comanda/totals.ts` e congelada em `ticket_items.commission_bps`/`commission_cents` — que é o certo, e já resolve o histórico. A tabela `commissions` foi desenhada para **fechamento por período** (`period_start`, `settled_at`) e esse recurso não existe. |
| `payments` (5 colunas) | A tabela **não é acessada em lugar nenhum** do produto; só aparece no mapa de eliminação da LGPD. O livro-caixa funciona por outro caminho. |

**Risco a verificar antes de mexer:** o mapa de eliminação da LGPD (`server/services/lgpd.ts`)
lista `payments`. Se a tabela nunca recebe linha, o relatório de eliminação afirma ter limpado algo
que não existe — inofensivo hoje, mas vira falso se alguém ligar pagamentos depois.

### B. Recurso construído pela metade (aqui está o valor)

| O quê | Situação |
|---|---|
| `tenants.vocab_override`, `professions.vocab` | **Zero consumidores.** O produto pergunta a profissão, guarda o vocabulário dela e nunca aplica. É exatamente a mesma classe de `tenants.cobranca` (1 escritor, nenhum leitor de tela) que originou o `docs/40`. Um eletricista lê "Serviço" e "Cliente" onde deveria ler o vocabulário da profissão dele. |
| `professions.campos_ficha`, `modulos_padrao`, `ciclo_padrao_dias`, `duracao_padrao_min` | Mesma família: o pacote de profissão guarda padrões que nada aplica em TS (parte é consumida por `apply_profession_pack` no SQL — **verificar quais**, para não repetir o falso positivo de `profession_services.*`). |
| Serviço sob orçamento, fase 2 | O cliente final **não tem como pedir orçamento**. `/orcamento/[token]` só exibe um que já existe; quem cria é sempre o profissional. Ver `docs/40`. |

### C. Sobra pequena (baixa prioridade)

`v_clientes_a_recuperar.maior_atraso_dias` e `maior_valor_cents` (agregados que a view expõe e o
`crm.ts` não lê), `products.sku`, `package_uses.used_at`, `messages.scheduled_for`,
`tenant_keys.rotated_at`, `webhook_events.processed_at`, `audit_log.orphaned_at`.

## Plano de execução, em ordem

**1. Vocabulário por profissão (item B, o de maior valor).** FEITO em 2026-09-04: público e painel.
Antes de escrever código: pesquisar como produtos multi-vertical resolvem rótulo por segmento
(Jobber, Housecall Pro, ServiceTitan, e SaaS horizontal que faz isso via terminologia
configurável), e decidir se o vocabulário é (a) por profissão, vindo do pacote, (b) editável pelo
dono, via `vocab_override`, ou (c) os dois com precedência. As duas colunas existem para o caso
(c), o que é uma pista forte — mas pista não é decisão, e o custo de errar é uma camada de
indireção em toda a UI. **Medir primeiro quantos rótulos realmente mudariam**: se forem três
palavras, isso é um `Record` pequeno; se forem cem, é arquitetura.

**2. Fase 2 do sob orçamento.** FEITO em 2026-09-04, ver `docs/40` fase 2.
Entrada pública de pedido de orçamento. Bloqueada por decisão de anti-abuso (formulário público
sem autenticação) e pela regra de não prometer canal que o cron não agenda. Desenhar primeiro,
implementar só a parte que não promete aviso automático.

**3. Documentar A no lugar certo.** FEITO em 2026-09-04, ver `docs/05-FAQ-DEV.md`.
`commissions` e `payments` viram nota em `docs/05-FAQ-DEV.md`: existem, estão vazias, e o motivo.
Sem isso, a próxima pessoa que abrir o schema vai achar que é bug e "consertar" escrevendo nelas,
duplicando o que `ticket_items` já congela corretamente.

**4. Item C**, só depois, e só o que tiver dono claro. FECHADO em 2026-09-04, ver
`docs/05-FAQ-DEV.md` §"As oito colunas do item C".

Medidas uma a uma, com piso conferido (450 arquivos em `src/`, 61 migrations) e `grep` de string
fixa. **As oito têm zero referência em `src/` e nenhuma tem dono claro, então nenhuma foi ligada** —
que é o que esta linha mandava fazer. Duas merecem nota:

- `orphaned_at` **não** é falta de leitor: a `0050` a criou como coluna administrativa, e a
  afirmação dela ("nenhum tenant real enxerga estas linhas") foi conferida, não assumida —
  `trilha-cofre.ts:35` filtra por `tenant_id`, e `audit_log` não é lido por tela nenhuma.
- Os dois agregados de `v_clientes_a_recuperar` são **regra duplicada**: o mesmo `max` por cliente
  já é calculado, de propósito e com motivo registrado, em `core/ciclo/quem-recuperar.ts`, a partir
  de outra view. O comentário da `0058` afirma um leitor que não existe — o FAQ registra isso para
  ninguém "consertar" a ausência.
