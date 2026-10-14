# C-025 · O ciclo por sujeito, passo 4: o animal em dia não esconde o que sumiu

**F1 · Objetivo:** a fila de recuperar mostra o sujeito ("Thor · Banho · Perdida"). Número: tutor com um
animal em dia e outro sumido aparece na fila (antes: não aparecia).

**F2 · Achado ao ler a view:** `v_quem_sumiu` (0121) tirava da fila o cliente com QUALQUER ciclo em dia.
Com sujeito, a Mel recém-banhada escondia o Thor sumido: o mesmo dano do C-003 (perda invisível),
reaparecendo na view, não no job.

**F3/F4:**
- 0137: o ciclo em dia só tira da fila o MESMO sujeito (`is not distinct from`: nulo casa com nulo, a
  beleza fica idêntica); a view expõe `subject_id` e `subject_name` no fim, `security_invoker` repetido;
  `v_clientes_a_recuperar` (dependente) não muda.
- Serviço: `ItemRecuperar.subjectName`. Cartão da fila e lista: "Thor · Barba · Perdida · 60d".
- Mensagem: "seu último horário de banho para Thor" — grafia original, sem artigo ("da Mel" supõe gênero).

**F5 · Medida:**
- Integração: Mel em dia + Thor perdido → o tutor está na fila, 1 linha, mostrando Thor. Mutação (view com
  a regra antiga, no banco local): "esperado 1, veio 0"; view restaurada, teste verde.
- Unidade 4.269; integração da fila, CRM e notas 68 de 68.
- **Navegador, build de produção, 390 px** (`/admin/recuperar`, conta de demonstração, tutor de prova
  criado e depois removido do banco local): cartão "Ana Prova Sujeito / Thor · Barba · Perdida · 60d de
  atr…" e link do WhatsApp com "horário de barba para Thor".

**Tropeço registrado:** o `\b` do regex do teste virou backspace na escrita (memória "regex corrompido
por heredoc"); a asserção negativa passava vazia. Corrigido no byte e provado com controle ("da Mel"
reprova). E um `git checkout --` para desfazer a mutação apagou a mudança ainda não commitada da
mensagem (memória "commite antes de mutar"); reaplicada.

**Nota:** cliente 9 · segredo 8 · engenharia 8. **Próximo (C-026):** o sujeito na trilha de previsões
(prestação de contas do Motor por animal/carro) ou o automotivo no banco (AUT-102 `vehicle_specs` + placa).
