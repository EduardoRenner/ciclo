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

| Hora (do commit) | Ticket | Resultado | Commit |
| --- | --- | --- | --- |
| 00:47 | EXP-J08 | número só quando o código sai; teste visto reprovando nas duas metades | `0a5e2b8b` |
| 01:23 | EXP-A06 | push da equipe só para quem administra e para a profissional do horário; integração no banco local (2 profissionais, visão restrita) e 2 mutações reprovando. Suíte: 12 testes estouraram 5 s sob carga, todos passaram sozinhos (34/34); integração 95 arquivos, isolamento 16 | `26978f27` |
| 01:26 | EXP-A03 (parte 1) | cancelar pelo link avisa a profissional do horário e quem administra, depois da resposta; `quandoLocal` saiu do `public-booking` para o `core` (uma cópia só); 3 mutações reprovando. A guarda de gênero pegou "A cliente cancelou" no texto reserva: virou "Quem tinha marcado". **Parte 2 pendente:** acionar a lista de espera no cancelamento pelo link só depois do EXP-A04 (hoje ela marcaria "avisada" sem avisar) | ver git log |
| 01:37 | EXP-A04 | a lista de espera só grava `notified_at` depois de um envio que saiu; teste novo reprovou no código antigo e passa; mutação reprova. Suíte: 4.475 unitários, 652 integração, 361 isolamento. O "Timeout calling onTaskUpdate" do Vitest aparece em toda rodada de integração sob carga, sem teste falhando. **Pendente (cartão P-A2):** sem canal, a vaga vira cartão no Hoje para a profissional chamar a 1ª da fila pelo WhatsApp dela | ver git log |
| 02:00 | EXP-A03 (parte 2) | cancelar pelo link oferece a vaga à lista de espera (como o painel já fazia), depois de cancelar e dentro de `agendarDepois`; guarda estendida e mutação reprovando. Suíte sob carga: 6 testes de integração e 3 de isolamento estouraram o tempo (5 a 60 s); rodados sozinhos, passaram (27/27 e 361/361) | ver git log |
| 02:00 | EXP-A02 (3 de 4) | Automações diz o motivo de cada uma parada (o estoque não fala mais de WhatsApp); Notificações deixa de prometer "lembretes" e diz o que chega (pedido, cancelamento, orçamento). Visto no navegador a 375 px (motivos certos, sem rolagem lateral); o cartão de Notificações **não visto** (a permissão de notificação está bloqueada neste navegador e não mexo nela). 3 mutações reprovando. **Pendente do Vitor:** o texto da política de privacidade que diz que a Meta "entrega lembrete" (documento legal; sugestão: "quando o envio pelo WhatsApp estiver ligado"). **Pendente:** `promessa.ts` olhar `campaigns` e a credencial (D12) | ver git log |
| 02:22 | EXP-A01 | o dial de Automações passa a valer: lembrete só sai sozinho no nível 3 ("Faz e me conta"); campanha nunca sai sozinha (teto 2), como a tela promete; "Pontos automáticos" perde o dial (padrão provisório) e diz que segue o programa de pontos. Integração: no nível 1 o lembrete não aparece e no 3 aparece (controle positivo); os testes antigos de lembrete e de pausa passaram a declarar o nível 3. 3 mutações reprovando. Visto a 375 px. Suíte: 4.484 unitários, 653 integração (2 tempos de 5 s em `lote-de-importacao`, que passa sozinho 11/11 e estoura sempre sob a suíte inteira), 361 isolamento. **Pendentes do Vitor:** (1) com o padrão de fábrica 1, ligar a Meta **não** manda lembrete até a dona subir o dial: confirmar se é isso ou se o lembrete nasce no 3; (2) se o nível da fidelidade deve mudar o comportamento; (3) o selo "Ativa" dos pontos aparece mesmo com o programa desligado | ver git log |
