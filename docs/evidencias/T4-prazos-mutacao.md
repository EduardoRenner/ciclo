# T4 · ações de prazo · mutações (2026-10-08)

Commit 5b7a93a0 antes de mutar; cada mutação conferida por `git diff --stat` e desfeita.

| Mutação em `server/advocacia/prazos.ts` | Resultado |
|---|---|
| sem a recusa de confirmação por quem é de estágio | `legal-prazos-acoes` reprovou (estágio confirmou o próprio prazo) |
| sem a tradução da constraint `fatal_cumprido_com_prova` | `legal-prazos-acoes` reprovou (a tela receberia erro interno em vez da frase) |

As regras de fundo (fatal não adia, motivo no histórico, fatal só da advocacia) são do banco e já têm
mutação própria nas evidências da Fase 1 e na matriz de papéis (`T1.11-mutacao.md`).
