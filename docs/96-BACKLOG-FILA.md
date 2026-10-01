# 96 · Backlog da fila de chamadas (execução do `docs/95`)

Cada item vira um PR com base na `main`, CI verde e auto-merge. Migrations só aditivas, aplicadas em
produção antes do código e registradas no livro. Parar e perguntar ao Vitor só se precisar apagar ou
reescrever dado, tirar privilégio ou ligar mensagem para cliente final.

Legenda: `[ ]` a fazer · `[~]` em andamento · `[x]` no ar (com o nº do PR).

## E0 · Tirar a seleção em lote
- [ ] E0.1 Remover checkbox, barra de envio pago e estado de seleção da tela Recuperar (mantém a rota
      `recover/send` e a capacidade `envio_em_lote` no servidor).
- [ ] E0.2 Guarda: a tela Recuperar não tem `type="checkbox"`, nem `<ActionBar`, nem chamada a
      `recover/send`; vista reprovando por mutação.

## E1 · Texto com link de agendamento
- [ ] E1.1 Migration aditiva: `messages.clicked_at`, `messages.booked_appointment_id`.
- [ ] E1.2 Token assinado de escopo `volta` (id = mensagem da chamada manual), validade 14 dias.
- [ ] E1.3 Rota pública que abre o link: registra `clicked_at`, redireciona para `/{slug}/agendar`
      com o cliente reconhecido e o serviço pré-escolhido.
- [ ] E1.4 Agendamento feito pelo link grava `booked_appointment_id` (atribuição por clique).
- [ ] E1.5 `textoDeVolta` passa a incluir o link; "Chamar" pede o link ao servidor antes de abrir o WhatsApp.

## E2 · Fila de chamadas
- [ ] E2.1 Tela "Fila de chamadas": um cliente por vez; Chamar, Já falei, Pular hoje, Não chamar mais, VIP.
- [ ] E2.2 Ordenar por lucro, ticket, recorrência/atraso, nota, perfil, última visita, nº de visitas,
      serviço, profissional; filtros por perfil, nota, serviço, profissional, atraso, "não chamado nesta semana".
- [ ] E2.3 Teto diário configurável; fila persiste ao sair e voltar.

## E3 · Perfil e nota do cliente
- [ ] E3.1 Função pura `notaDoCliente` (0–100, componentes à vista) e `perfilDoCliente` em `src/core/`.
- [ ] E3.2 Tabela `client_scores` (append-only, versão do algoritmo) e cálculo diário junto do Motor.
- [ ] E3.3 Mostrar nota, classe (Ouro/Prata/Bronze) e o porquê na ficha e na fila.

## E4 · Biblioteca de mensagens
- [ ] E4.1 Tabela `message_variants` (global ou do salão; segmento; perfil; serviço; texto).
- [ ] E4.2 Textos prontos por nicho × serviço × perfil; editar vira variante própria.
- [ ] E4.3 Pré-visualização = envio (mesma função); variável vazia bloqueia o texto.

## E5 · Medição
- [ ] E5.1 Tabela `call_attempts` (variante, perfil, nota, hora local, dia da semana, resultado).
- [ ] E5.2 Funil chamado → abriu → agendou → compareceu → valor, por texto, hora, perfil, cliente,
      serviço e profissional, sempre com amostra.

## E6 · Motor
- [ ] E6.1 Ordem sugerida (nota × lucro × chance de agendar).
- [ ] E6.2 Cruzar com a agenda (semana lotada → aviso; vaga → quem encaixar).
- [ ] E6.3 Placar de acerto e previsão F1.

## E7 · Consentimento
- [ ] E7.1 `consents` ganha `channel` e `source`; caixa de opt-in no agendamento.
