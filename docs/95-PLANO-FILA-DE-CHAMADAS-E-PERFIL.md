# 95 · Plano de execução: fila de chamadas, perfil do cliente, mensagens e medição (junto com o Motor)

Escrito em 2026-09-30. Decisão do Vitor: **a reativação fica manual** (sem API por enquanto). O dono
chama pelo próprio WhatsApp, com link de agendamento, e o CICLO mede e aprende. Este plano entra na
**mesma trilha** do Motor de Retorno (`docs/91`), da plataforma (`docs/92`), do Motor Preditivo
(`docs/93`) e da revisão (`docs/94`). Esforços em semanas são **(estimativa)**.

## 0. Ponto de partida (verificado no código em 30/09)
- A seleção em lote da tela Recuperar chama `/api/v1/cycle/recover/send` (número do CICLO, categoria
  paga) e **não entrega nada em produção** (sem canal configurado). Não existe jeito de fazer "vários de
  uma vez" pelo WhatsApp do dono sem API: o `wa.me` abre **uma** conversa por toque.
- O botão **Chamar** de cada linha (WhatsApp do dono) funciona e anota a chamada
  (`/api/v1/cycle/recover/manual`).
- O texto de volta (`textoDeVolta`) **não leva link de agendamento**.
- Não há medição por texto, por hora ou por perfil. Existe modelo de mensagem editável na ficha, com
  variáveis (`nome`, `serviço`, `link` de indicação).

## 1. Épicos, em ordem

### E0 · Tirar a seleção em lote (0,3 semana)
Esconde checkbox e barra de envio em lote; mantém a rota e a capacidade `envio_em_lote` no servidor
(volta quando houver canal oficial). Mantém o botão **Chamar** por linha.
**Aceite:** nenhuma tela oferece envio pago em lote; teste-guarda reprova se a barra voltar sem canal
ativo; texto da tela não promete "avisar vários".

### E1 · Texto com link de agendamento (1 semana)
- Variável `{{link_agendar}}`: link **pessoal e assinado** (mesmo HMAC dos links de confirmar/cancelar)
  para a página de marcação do salão, já reconhecendo o cliente.
- Tabela `personal_links` (tenant, cliente, finalidade, hash do token, validade, aberto em, agendamento
  gerado). RLS forçada.
- Texto padrão de volta passa a incluir o link.
**Aceite:** abrir o link registra `opened_at`; agendar por ele grava `booked_appointment_id`; link
vencido ou de outro salão não abre; teste de isolamento.

### E2 · Fila de chamadas (1,5 semana)
**O que é:** o dono marca quem quer chamar (ou aceita a sugestão do Motor), toca em **Começar**, e a tela
mostra **um cliente por vez**, na ordem escolhida.
- Ações por cliente: **Chamar** (abre o WhatsApp com texto + link), **Já falei**, **Pular hoje**,
  **Não chamar mais** (opt-out interno), **Marcar como VIP**.
- **Ordenar por:** lucro em risco, ticket médio, recorrência (ritmo e atraso relativo), nota do cliente,
  perfil, última visita, nº de visitas, serviço, profissional preferido, prioridade do Motor.
- **Filtrar por:** perfil, nota, serviço, profissional, faixa de atraso, "ainda não chamado esta semana".
- Mostra o resumo no topo: quantos na fila, valor em risco, quantos já chamados hoje.
**Aceite:** a fila persiste se o dono sair e voltar; cada ação grava um evento; nenhuma ação envia nada
sozinha; funciona a 390 px com alvos ≥ 48 px; teto diário de chamadas configurável.

### E3 · Perfil e nota do cliente (1,5 semana)
**Duas coisas separadas:**
1. **Perfil** (rótulo do comportamento): Fiel, Regular, Novo, Atrasado, Faltante, Sumido. São os
   arquétipos que a base de demonstração já usa; passam a ser calculados do histórico real.
2. **Nota** (0 a 100) para priorizar, com a **conta à vista**:
   | Componente | Peso inicial **(hipótese)** | Fonte |
   |---|---|---|
   | Valor: ticket médio e total dos últimos 12 meses | 30 | pagamentos e comanda |
   | Frequência: visitas nos últimos 12 meses | 20 | agenda |
   | Regularidade: variação do intervalo entre visitas | 15 | Motor de Ciclo |
   | Presença: faltas e cancelamentos tardios | 15 | agenda |
   | Recência relativa ao ritmo (atraso ÷ ritmo) | 10 | Motor de Ciclo |
   | Antiguidade e indicação de outros | 10 | cadastro e indicação |
- Classe: **Ouro, Prata, Bronze** (por faixa da nota) e **sinais** em separado (risco de falta, atraso
  grande, queda de frequência). O dono vê **por que** a nota é aquela.
- A palavra "ruim" **não aparece** para o dono. Prioridade baixa, sim. Motivo: rotular pessoa é
  sensível (a LGPD dá ao titular direito de pedir revisão de decisão automatizada) e a nota só serve
  para **ordenar a fila do próprio dono**, nunca para negar atendimento.
- Pesos ajustáveis pelo dono e **recalibrados com resultado** quando houver dado (quem voltou depois de
  chamado).
- Tabela `client_scores` (tenant, cliente, nota, classe, perfil, componentes em JSON, versão do
  algoritmo, calculado em) com histórico; cálculo diário junto do Motor de Ciclo, em função pura em
  `src/core/`.
**Aceite:** nota sempre explicável; mesma entrada dá a mesma nota; teste com casos de borda (cliente de
1 visita, sem pagamento, só faltas); versão do algoritmo gravada.

### E4 · Biblioteca de mensagens (1 semana)
- Textos prontos por **nicho × serviço × perfil** (ex.: barbearia, corte, atrasado; salão, coloração,
  sumido; cliente Ouro; primeira visita sem volta).
- O dono usa o pronto ou **edita**; o editado vira **variante própria** (medida à parte, não entra nos
  testes entre salões).
- Várias variantes por situação para permitir comparação; o sistema alterna ou o dono escolhe.
- Variáveis: nome, serviço, profissional, dia da semana sugerido, horário livre mais próximo,
  `{{link_agendar}}`. Texto sem variável preenchida **não sai** (sem "{{nome}}" na cara do cliente).
- Tabela `message_variants` (escopo: global do CICLO ou do salão; segmento; perfil; serviço; texto;
  ativo).
**Aceite:** pré-visualização igual ao que será enviado (mesma função dos dois lados); texto longo
demais avisa; cada variante tem id estável para medir.

### E5 · Medição (2 semanas)
**Eventos** (tabela `call_attempts`, só acrescenta): cliente, serviço, variante, perfil e nota no
momento, **hora local e dia da semana do toque**, ordem na fila, resultado.
**Funil por texto, por hora e por perfil:**
`chamado (tocou em Chamar) → abriu o link → agendou → compareceu → valor`.
| Visão | Pergunta que responde |
|---|---|
| Por texto | Qual mensagem leva mais gente a agendar? |
| Por hora e dia da semana | Em que momento a mensagem funciona melhor? |
| Por perfil e nota | Quem responde mais, e a quem vale a pena insistir? |
| Por cliente | Histórico de contatos e resultado de cada pessoa |
| Por serviço e profissional | Onde o retorno é maior |
**Rigor (honesto):**
- "Chamado" quer dizer que o dono **tocou**; não prova que enviou. A prova forte é o **clique no link**.
- Taxa sempre com **tamanho da amostra e intervalo**; abaixo de um mínimo mostra "poucos dados", sem
  ranking.
- Comparação "chamado × não chamado" é **observacional**: o dono escolhe quem chamar, então não é
  causal. A tela diz isso. A medição causal (controle) entra no automático, não aqui.
- Comparação entre textos só com amostra suficiente; entre salões, via aprendizado agregado (P3).
**Aceite:** nenhum número sem amostra; recorte por hora usa o fuso do salão; dado de saúde nunca entra.

### E6 · Motor: decisão e aprendizado (2 semanas, em paralelo com E2 a E5)
- **Quem chamar primeiro:** nota × lucro em risco × chance de agendar (do ritmo).
- **Cruzar com a agenda:** semana lotada → aviso "agenda cheia, deixe para a próxima"; vagas sobrando →
  sugere quem encaixar (casamento vaga × cliente, `docs/93`).
- **Aprender com o dono:** VIP, "hoje não" e "não chamar mais" viram sinal.
- **Melhor hora e texto sugeridos** quando houver amostra.
- **Previsão F1** e **placar de acerto** (`docs/93` e `docs/94`, funcionalidades 5 e 6).
**Aceite:** toda sugestão tem explicação em português; o dono pode ignorar; nada é enviado sozinho.

### E7 · Base de consentimento (0,5 semana, paralelo)
Caixa de opt-in no agendamento e registro em `consents` (origem e canal). **Não é exigência para o
manual**, mas prepara o automático e a LGPD. Opt-out interno ("não chamar mais") respeitado na fila.

## 2. Ordem e dependências
```
E0 ─┐
E1 ─┼─► E2 ─► E5 ─► (E6 usa dados de E5)
E3 ─┘          ▲
E4 ────────────┘ (variantes alimentam a medição)
E7 em paralelo
```
**Sequência de entrega sugerida (cada passo já vale sozinho):**
1. **E0 + E1** (1,3 semana): para de prometer lote; texto com link.
2. **E2** (1,5): fila de chamadas, com ordenação.
3. **E3** (1,5): perfil e nota (a fila passa a ordenar por nota).
4. **E4 + E5** (3): biblioteca e medição por texto, hora, perfil e cliente.
5. **E6** (2, parcialmente em paralelo): decisão do Motor.
Total ≈ **8 semanas em série; 5 a 6 com paralelismo (estimativa)**.

## 3. Regras de implementação (do `CLAUDE.md`)
- Regra de negócio em `src/core/` (funções puras): nota, perfil, ordenação, funil.
- Tabelas novas com RLS forçada, política por `has_tenant`, teste de isolamento; `personal_links`,
  `client_scores`, `message_variants`, `call_attempts`. Dinheiro em centavos; tempo em UTC.
- Escrita por `/api/v1` com Idempotency-Key; Zod na borda; `audit_log` nas mutações.
- Teste-guarda: cada guarda deve ser vista **reprovando** (mutação), conforme o procedimento do repo.
- Migrations aditivas antes do código; aplicar em produção pelo runbook, uma por vez.
- Texto da tela não promete envio automático (`home-nao-promete-demais`).

## 4. Portões (parar ou seguir)
- **Depois do E2:** o dono usa a fila em ≥ 3 salões por 2 semanas? Se ninguém usa, rever a ideia antes
  de investir em medição.
- **Depois do E5:** ≥ 300 chamadas com link no total? Só então mostrar ranking de textos.
- **Antes de qualquer envio automático:** cumprir o portão do dia 35 do `docs/94` (retorno com controle
  ≥ 4 pontos percentuais e pagantes dispostos).

## 5. Riscos
- **"Chamado" não é "enviado":** a medição forte depende do clique no link.
- **Nota vira rótulo injusto:** conta à vista, sem palavra "ruim", revisão possível, só prioriza fila.
- **Pouco dado por salão:** por isso a comparação de textos é do conjunto de salões.
- **Dono não usa a fila:** o portão depois do E2 existe para descobrir cedo.
- **Complexidade:** E3 e E5 são as partes grandes; entregar cada uma só quando a anterior estiver em uso.

## 6. O que depende do Vitor
Escolher 3 salões para usar a fila; validar os textos prontos com donos reais; decidir se o dono pode
editar os pesos da nota; confirmar a política de "Não chamar mais".
