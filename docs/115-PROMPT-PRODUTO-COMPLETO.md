# 115 · Prompt do produto completo do CICLO (21/10/2026)

Complementa o `docs/114-PROMPT-LANCAMENTO.md` (que manda na ordem do dia). Aqui está o produto inteiro, para nenhuma ponta ficar de fora no lançamento. Releia este, o 114 e o `_progresso.md` se o contexto for resumido.

## O produto em uma frase

A profissional de beleza (unha, cílios, sobrancelha, cabelo, depilação, estética) tem agenda e clientes que voltam; o CICLO marca, lembra e traz a cliente de volta na hora certa. A cliente acha, marca e volta sem esforço, pelo celular. **Grátis no lançamento.** Entrada pelo número do WhatsApp.

## Os dois lados, ponta a ponta

### Cliente
1. **Chega** pelo link da profissional, pela aba **Buscar** (serviço + cidade/bairro) ou pelo app instalado.
2. **Marca** serviço → dia (a partir de amanhã) → horário → número (código pelo WhatsApp) → pronto. Para hoje: "Chame no WhatsApp".
3. **Recebe** a confirmação na tela (data, hora, endereço com mapa, "Adicionar à agenda", "Falar no WhatsApp", "Remarcar").
4. **É lembrada** (avisos abaixo) na véspera e no dia.
5. **Volta:** "Sua próxima manutenção: por volta de [data]" com "Marcar de novo" (mesmo serviço e profissional).
6. **Área da cliente:** próximos horários, histórico, "Marcar de novo", remarcar/cancelar, avisos ligados/desligados, sair.

### Profissional
1. **Cadastra** pelo número → profissão (as seis da beleza na frente) → serviços prontos do ofício → horários → link público.
2. **Hoje:** agenda do dia, quem vem, quem faltou (1 toque), lembrete da véspera em 1 toque.
3. **Recuperar:** quem passou do ponto de voltar, com a mensagem pronta para chamar.
4. **Clientes, Serviços, Configurações** (antecedência mínima, aparecer na busca, avisos).
5. **Equipe** (salão): convite pelo WhatsApp, cada profissional vê o que é seu.

## L-09 · Avisos no celular da CLIENTE (novo, pedido do Vitor)

Pop-up no celular (notificação do navegador / do app instalado), como nos outros apps:

| Quando | Texto (exemplo) | Toque leva a |
| --- | --- | --- |
| Ao marcar | "Horário confirmado: [serviço] com [profissional], [dia] às [hora]" | detalhes do horário |
| Véspera (horário de Brasília, ~18h) | "Você tem [serviço] amanhã às [hora] com [profissional]" | confirmar / remarcar |
| 2 h antes | "Seu horário é às [hora]. Endereço: [rua]" | mapa |
| Remarcado/cancelado pela profissional | "[profissional] mudou seu horário para…" | detalhes |
| **Recuperação** (no dia previsto pelo Motor) | "Já faz [N] dias da sua [manutenção]. Quer marcar?" | "Marcar de novo" com tudo preenchido |
| Vaga da lista de espera | "Abriu um horário [dia] às [hora]. Quer?" | marcar |

Regras (as da Fresha e as nossas):
- Pedir permissão **depois** do 1º agendamento ("Quer aviso no celular um dia antes?"), nunca na entrada.
- **iPhone só recebe com o app na tela de início** (iOS 16.4+): no iPhone, o pedido vira "Ponha o CICLO na tela de início para receber o aviso" com o passo a passo (Compartilhar → Adicionar à Tela de Início). Android recebe direto.
- Recuperação: não avisar quem já tem horário marcado, nem logo depois de falta/cancelamento; juntar dois avisos do mesmo dia num só; no máximo 1 aviso de recuperação por semana.
- Respeitar o consentimento de marketing (EXP-A08): lembrete de horário é serviço; recuperação é marketing e só vai a quem aceitou.
- Sem dado sensível no texto do aviso (tela bloqueada).
- O agendador que dispara (EXP-A09, a cada 15 min) existe antes de qualquer aviso ligado; com falha de envio, contar e mostrar (nunca "enviado" sem ter saído).
- Reaproveitar o que existe do push da profissional (`server/services/push.ts`, `providers/messaging/push.ts`): inscrição por pessoa, não por estabelecimento.

Testes: integração com o agendador (véspera, 2 h, recuperação com as regras), unitário das regras de silêncio, e prova no navegador de Android (emulação) recebendo o aviso.

## Notificações da profissional (conferir que existem e funcionam)
Novo agendamento, cancelamento, remarcação, lista de espera, resumo do dia de manhã (quem vem hoje, quem recuperar).

## Pronto para lançar quando
- As duas jornadas acima, de ponta a ponta, no celular a 375 px, sem rolagem lateral, toque ≥ 48 px.
- Nenhuma tela com preço de plano, "assine", promessa de canal que não existe, masculino genérico.
- `pnpm verify` com build verde; LCP do link público ≤ 2,5 s medido no build.
- Avisos: o que a tela promete é o que sai.

## Ordem (encaixe no 114)
F0 → F1 → L-01 a L-08 do 114 → **L-09 (avisos da cliente)** → ideias do 114 → o que sobrou do 113.
