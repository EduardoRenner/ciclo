# C-028 · AUT-102: a placa e a ficha do veículo

**F1 · Objetivo:** a placa é a espinha da oficina — é por ela que o balcão acha o carro (StarkOS). O
sujeito (C-021) já guarda o veículo; falta a placa que não duplica o carro e a ficha (marca, modelo, ano).
Número: entradas da mesma placa que viram a mesma chave.

**F2:** o StarkOS (só leitura) não normaliza placa. Regra da conversão Mercosul: o 5º caractere (dígito)
vira a letra de mesma posição (0→A … 9→J): ABC1234 → ABC1C34. O mesmo carro chega com qualquer das duas.

**F3/F4:** `src/core/manutencao/placa.ts`: `normalizarPlaca` (limpa a digitação; antiga ou Mercosul; o
resto é nulo, nunca "consertado"), chave sempre na forma Mercosul, placa digitada para exibir;
`mesmaPlaca`; `EsquemaFichaDoVeiculo` (marca, modelo, ano 1950..ano seguinte, combustível, câmbio,
motor; campo desconhecido recusado). Decisão (DECISOES.md 2026-10-14): sem tabela `vehicle_specs`; a
ficha mora em `subjects.attributes` e a chave em `subjects.identifier`, cuja unicidade entre ativos (0132)
já impede o carro duplicado.

**F5 · Medida:** "abc-1234", "ABC 1234", "ABC1C34" e "abc1c34 " → 1 chave (antes: 4 identificadores
diferentes para o mesmo carro). 7 entradas inválidas → nulo. 5 casos de teste.

**Nota:** cliente 6 · segredo 5 · engenharia 8. **Próximo (C-029):** AUT-103, a leitura de km no
check-in (`odometer_readings` ou leitura na visita), que alimenta o relógio de uso do C-002.
