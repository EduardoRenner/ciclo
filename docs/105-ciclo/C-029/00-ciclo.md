# C-029 · AUT-103: a leitura de km no check-in, com o erro avisado na hora

**F1 · Objetivo:** a leitura de km de cada visita alimenta o relógio de uso (C-002). Dois erros de balcão:
zero a mais (41.300 → 413.000) e km que desce (painel trocado ou dígito trocado). Número: leituras erradas
avisadas no check-in; ritmo de uso com uma leitura absurda no meio.

**F2/F3:** `src/core/manutencao/leitura-de-km.ts`: `avaliarLeitura` → primeira, ok, desce (com a diferença
e "Trocou o painel?") ou salto (acima de 1.500 km/dia, com "Confira se não sobrou um zero"). Nada é
bloqueado: aviso na hora, a oficina decide (mesma regra do estoque negativo no CLAUDE.md).

**F4/F5 · Hipótese derrubada no caminho:** eu ia filtrar as leituras ruins antes do relógio de uso. Medido:
com um zero a mais no meio, o `ritmoDeUso` do C-002 já dá 36 km/dia sozinho (mediana robusta). O filtro
não acrescentava nada e foi removido; o teste agora FIXA essa robustez. O valor da peça é o histórico do
carro, que a oficina e o motorista leem, não o relógio.

**Decisão:** sem coluna de km no agendamento ainda. Coluna sem escritor é armadilha registrada ("coluna
sem escritor vem em fila"); ela nasce junto com o check-in que a preenche (AUT-401), e o histórico de
leituras do carro é o dos agendamentos dele (um por visita), sem tabela `odometer_readings`.

**Nota:** cliente 5 · segredo 4 · engenharia 8. **Próximo (C-030):** algoritmo (regra ≥ 1 a cada 3; o
último foi o C-027): o sujeito na trilha de previsões, para a prestação de contas do Motor por animal ou
carro; ou AUT-104 (o pacote oficina no catálogo).
