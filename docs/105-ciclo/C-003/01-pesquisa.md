# C-003 · Pesquisa — o mapa da expansão

## O que JÁ serve (LEITURA, 14/10/2026) — não refazer

| Peça da plataforma | Oficina | Pet | Evidência |
| --- | --- | --- | --- |
| Profissão no catálogo, vocabulário por profissão | falta a profissão | **já existe** "Banho e tosa", grupo pet, cliente = "tutor", local = "pet shop" | `0026_catalogo_profundo.sql` |
| Pacote (abas, botão central, palavras extras, 2º fator) | `base` serve; um pacote próprio só se a barra mudar | `base` serve | `src/core/pacotes/` (base, advocacia) |
| Agenda, horário livre, público, confirmação | serve (a OS pode nascer de um horário) | serve | Onda 1 |
| Comanda, Caixa, Mês, comissão | serve; a oficina tem ORÇAMENTO antes da execução | serve | comanda + orçamentos (`quotes`) |
| Orçamento aprovado pelo cliente por link | serve — é o núcleo da oficina (StarkOS: "todo serviço nasce de um orçamento") | pouco usado | `quotes`, `/orcamento/[token]` |
| Motor de Ciclo | serve com o **relógio de km** (C-002) | serve com tempo + vacina (calendário) | `core/cycle/relogios.ts` |
| Prestação de contas, Recuperar, campanhas, mensagens prontas | serve | serve | — |
| Cofre de dado sensível | não precisa | não precisa (dado do animal não é LGPD sensível) | — |

## O que FALTA

1. **O sujeito do ciclo (o maior, e estrutural).** `client_cycles` tem chave (tenant, **cliente**,
   serviço). Na oficina volta o CARRO (StarkOS: placa é a espinha dorsal, histórico no veículo, e
   placa repetida TRANSFERE o veículo de dono); no pet, o ANIMAL. Medido no C-003 (sintético):
   - prever "a próxima visita de alguém da casa" a série misturada até acerta (3 d × 1 d);
   - **detectar que um dos animais sumiu: 0% com a série única, 100% por sujeito.** O dinheiro
     parado de quem saiu fica invisível — a métrica mais importante do produto (Recuperar) cega.
   - Isso vale HOJE para o "Banho e tosa" que já está no catálogo: dano vivo latente (quantos tutores
     têm mais de um animal é [NÃO MEDIDO]; sem acesso à produção).
2. **Leitura do relógio de uso no atendimento** (km de entrada) — sem ela o relógio de km usa o ritmo
   de referência (C-002).
3. **Regra de manutenção por serviço** com dois relógios (km e meses) — hoje o serviço só tem
   `cycle_days`.
4. **Vocabulário e campos do sujeito:** placa/modelo/ano (carro), nome/espécie/porte (pet).
5. **Profissão "oficina mecânica"** no catálogo, com serviços e regras sugeridas (troca de óleo
   10 mil km ou 12 meses; revisão 20 mil/12; alinhamento 10 mil/12 — as sementes do StarkOS).
6. **Papel de quem executa sem ver o dinheiro** (mecânico, no StarkOS o servidor manda `null`) — o
   CICLO já tem `professional` com escopo `own`; conferir que não vê valor do cliente.

## Pergunta de Thiel
O mercado vende "sistema de oficina" e "sistema de pet shop" como coisas diferentes. A verdade pouco
aceita: **são o mesmo produto — um relógio por sujeito, com o dinheiro parado de quem saiu à vista** —
e quem tem o motor certo atende os dois com a mesma base. O sujeito é a peça que falta para isso.
