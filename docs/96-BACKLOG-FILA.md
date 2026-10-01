# 96 · Backlog da fila de chamadas (execução do `docs/95`)

Cada item vira um PR com base na `main`, CI verde e auto-merge. Migrations só aditivas, aplicadas em
produção antes do código e registradas no livro. Parar e perguntar ao Vitor só se precisar apagar ou
reescrever dado, tirar privilégio ou ligar mensagem para cliente final.

Legenda: `[ ]` a fazer · `[~]` em andamento · `[x]` no ar (com o nº do PR).

## E0 · Tirar a seleção em lote
- [x] E0.1 (#135) Remover checkbox, barra de envio pago e estado de seleção da tela Recuperar (mantém a rota
      `recover/send` e a capacidade `envio_em_lote` no servidor).
- [x] E0.2 (#135) Guarda: a tela Recuperar não tem `type="checkbox"`, nem `<ActionBar`, nem chamada a
      `recover/send`; vista reprovando por mutação.

## E1 · Texto com link de agendamento
- [x] E1.1 (#136) Migration aditiva (0099, aplicada em produção): `messages.clicked_at`, `messages.booked_appointment_id`.
- [x] E1.2 Token assinado de escopo `volta` (id = tenant~cliente~serviço, montado ao desenhar a lista), validade 14 dias.
- [x] E1.3 Página pública `?volta=` abre o link: registra `clicked_at`, redireciona para `/{slug}/agendar`
      com o cliente reconhecido e o serviço pré-escolhido.
- [x] E1.4 Agendamento feito pelo link grava `booked_appointment_id` (atribuição por clique).
- [x] E1.5 `textoDeVolta` inclui o link (a lista já chega com ele; sem chave de assinatura, cai para o texto sem link).
- [ ] E1.6 Assistente ("resolve") também mandar o link (precisa do slug no contexto da ferramenta).

## E2 · Fila de chamadas
- [x] E2.1 (#139) Modo fila na tela Recuperar: um cliente por vez; Chamar, Já falei, Pular hoje (verificado no navegador a 390 px).
- [ ] E2.4 "Não chamar mais" (precisa do opt-out do WhatsApp no PATCH de cliente) e "VIP" (etiqueta; seguro depois do #138).
- [x] E2.2 Ordenar por prioridade (lucro × nota), lucro, nota, atraso e nome; filtrar por classe e perfil.
- [ ] E2.5 Ordenar/filtrar também por ticket, última visita, nº de visitas, serviço, profissional e "não chamado nesta semana".
- [~] E2.3 Fila lembra quem já foi tratado no dia (no aparelho). Falta o teto diário configurável.

## E3 · Perfil e nota do cliente
- [x] E3.1 Função pura `notaDoCliente` (0–100, componentes à vista) e `perfilDoCliente` em `src/core/`.
- [x] E3.2 Tabela `client_scores` (estado atual por cliente, com versão do algoritmo; 0100 aplicada em produção) e cálculo diário na rotina de segmentos.
- [x] E3.3 Nota, classe e perfil na lista e na fila (#139); na ficha, com o porquê parte por parte (verificado no navegador a 390 px).

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
