# 112 · Progresso da auditoria final (execução do docs/111)

Releia este arquivo e o `docs/111-PROMPT-EXPERIENCIA-DOIS-PUBLICOS.md` se o contexto for resumido.

## Ambiente (registrado antes de qualquer consulta)

| Item | Valor |
| --- | --- |
| Repositório | worktree `C:\Users\Usuario\.claude\code\ciclo-marca`, branch `marca/feminina-2026-10-20` (PR #155, rascunho) |
| Banco | Supabase **local** isolado `ciclo-marca`, API `http://127.0.0.1:57821`, Postgres `127.0.0.1:57822` |
| É produção? | **Não.** Produção é `seuciclo.com.br` + Supabase `eqzlv…`, não tocados |
| App | `next dev` na porta 3041 (launch config `ciclo-marca`) |
| Data | 21/10/2026 |

## Frentes e responsáveis

| Arquivo | Frente | Quem | Estado |
| --- | --- | --- | --- |
| `01-diagnostico.md` | jornadas P1-P7 e C1-C6 medidas | sessão principal (navegador) | feito (P7 não medida) |
| `04-salao.md` | C1, produto com cara de salão | agente | feito, 60 itens, EXP-S01 a S18 |
| `05-avisos.md` | C2, avisos e notificações | agente | feito, 13 defeitos Onda 0, EXP-A01 a A15 |
| `06-desempenho.md` | C3, leve e rápido | agente (worktree próprio para build) | feito (entregue depois do commit do plano), EXP-D01 a D10 |
| `medidas/concorrentes.md` | jornadas e avisos dos concorrentes | agente | feito |
| `medidas/copy-e-acessibilidade.md` | copy e acessibilidade das telas das jornadas | agente | feito, 38 achados, EXP-K01 a K16 |
| `medidas/tickets-das-jornadas.md` | tickets EXP-J01 a J08 | sessão principal | feito |
| `00-resumo.md`, `02`, `03`, `07`, `08`, `09` | síntese, tickets, revisão, veredito | sessão principal | feito |

## Registro da execução (loop da noite de 21/10)

Pedido do Vitor (21/10, madrugada, repassado pela sessão "Ciclo: mudanças e lacunas para venda" e registrado na memória `loop-noturno-regras`): seguir sem parar, um ticket por rodada, nunca deploy, conta, mensagem a pessoas ou produção. Decisão dele = padrão atrás de chave, anotado aqui, e pular.

| Hora | Ticket | Resultado | Commit |
| --- | --- | --- | --- |
| 00:50 | EXP-J08 | número só quando o código sai; teste visto reprovando nas duas metades | `0a5e2b8b` |
| 01:40 | EXP-A06 | push da equipe só para quem administra e para a profissional do horário; integração no banco local (2 profissionais, visão restrita) e 2 mutações reprovando. Suíte: 12 testes estouraram 5 s sob carga, todos passaram sozinhos (34/34); integração 95 arquivos, isolamento 16 | `26978f27` |
| 02:30 | EXP-A03 (parte 1) | cancelar pelo link avisa a profissional do horário e quem administra, depois da resposta; `quandoLocal` saiu do `public-booking` para o `core` (uma cópia só); 3 mutações reprovando. A guarda de gênero pegou "A cliente cancelou" no texto reserva: virou "Quem tinha marcado". **Parte 2 pendente:** acionar a lista de espera no cancelamento pelo link só depois do EXP-A04 (hoje ela marcaria "avisada" sem avisar) | ver git log |
