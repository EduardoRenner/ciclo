# C-036 · AUT-401 puro: o check-in pela placa decide o próximo passo

**F1 · Objetivo:** o balcão digita a placa e o sistema decide o que pedir; meta do 106: OS aberta em até
6 toques. Número: toques até abrir, por caminho.

**F2:** placa como chave (C-028, antiga e Mercosul iguais); veículo é sujeito do cliente (C-021); placa
única só entre ATIVOS (0132); o StarkOS ensinou que placa repetida em nome de outro cliente é carro
vendido.

**F3/F4:** `src/core/manutencao/check-in.ts`: `passoDoCheckIn` → placa inválida (pede de novo, com
exemplo) | veículo do mesmo cliente (pede só o km) | veículo de OUTRO cliente (pergunta "O carro mudou de
dono?" e nunca transfere sozinho; o histórico vai junto) | veículo novo (marca, modelo, ano, km). Veículo
inativo não responde pela placa. `toquesAteAbrir` conta placa + campos + abrir.

**F5 · Medida:**

| Caminho | Toques até a OS aberta |
| --- | --- |
| carro do cliente | 3 |
| carro de outro cliente (transferência) | 4 |
| carro novo | 6 (no limite da meta) |
| placa inválida | não abre |

6 casos de teste, incluindo a placa digitada no formato antigo achando o carro cadastrado no Mercosul.

**Nota:** cliente 7 · segredo 5 · engenharia 8. **Próximo (C-037):** algoritmo (regra ≥ 1 a cada 3; o
último foi o C-035) ou a rota do check-in no servidor (cria sujeito, transfere com confirmação, abre a OS).
