# O CICLO hoje, para comparar (lido do código em 16/10/2026)

Fonte: `src/core/billing/planos.ts` e `src/core/billing/acesso-aberto.ts` na branch `loja/lacunas-2026-10-15`.

## Planos e preços (FATO)

| Plano | Preço por mês | Profissionais | Clientes | Módulos |
| --- | --- | --- | --- | --- |
| Grátis | R$ 0 | 1 | 50 | agenda, Motor de Ciclo, página pública de agendamento, clientes, lembretes, assistente |
| Solo | R$ 49 | 1 | sem limite | + campanhas, caixa, orçamentos, rotas, equipe, fidelidade, estoque, ficha de saúde, recorrência, clube de assinatura, documentos, pacote Advocacia; envio em lote; sem o selo do CICLO na página |
| Equipe | R$ 99 | até 5 | sem limite | o mesmo do Solo, com até 5 profissionais |
| Avançado | R$ 179 | sem limite | sem limite | legado, não vendido ("fale com a gente" acima de 5) |

`ACESSO_ABERTO = true`: hoje tudo está liberado para todo mundo, sem cobrança (período de pré-lançamento).

## O que o CICLO tem que é próprio

- **Motor de Ciclo:** prevê quando cada cliente volta, classifica (na hora, atrasado, em risco, perdido) e monta a fila de quem chamar, com valor estimado.
- **Lucro de verdade por atendimento:** comissão, material (ficha de consumo), taxa da maquininha e custo fixo.
- **Multinicho:** barbearia, unhas, cílios, sobrancelha, depilação, estética, tatuagem, cabelo e profissões do catálogo (pet, personal, faxina, eletricista...), cada um com serviços e vocabulário próprios. Pacote Advocacia.
- **App nas lojas** (em preparação, PR #151): um app CICLO para o dono, não um app por barbearia.

## O que ainda não tem (a conferir contra o AppBarber)

- App do cliente final com a marca do negócio.
- Pagamento online cobrado pelo próprio sistema (há checkout do plano via Mercado Pago, e "sinal" está em estudo).
- WhatsApp automático com número próprio em produção (depende de credencial da Meta).
- Nota fiscal.
