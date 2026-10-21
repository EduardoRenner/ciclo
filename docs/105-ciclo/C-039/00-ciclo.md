# C-039 · AUT-103 no banco: a leitura de km do veículo

**Trilha:** plano 106, Fase 1 (fundação). O C-029 fez a parte pura (avaliar a leitura); faltava onde guardar.
O C-038 apontou "rota do check-in" como próximo, mas o check-in (AUT-401) é Fase 4 e depende do 103 —
fundação primeiro, como manda o laço.

## F1 · Prompt
Sem leitura de km gravada, o relógio de uso (C-002, C-038) não tem dado: a oficina só sabe "12 meses" e o
carro de aplicativo vence a troca de óleo em 2. Gravar a leitura do check-in, sem bloquear o balcão e sem
deixar um zero a mais virar histórico do carro.

## F2 · Pesquisa
- Padrão do sujeito (0132/0133): chave composta `(tenant_id, id)` como alvo, para a FK não atravessar tenant.
  `appointments` não tinha `(tenant_id, id)` único — índice novo, sem mudar dado (como `clients` na 0132).
- C-029: leitura que desce ou salta é ACEITA com aviso, nunca bloqueada.
- Guardas que toda rota de escrita nova passa: pausa (C5), alcance own (APR-040), rota com chamador (APR-214).

## F3 · Plano
1. 0141 aditiva: `odometer_readings` (km, `read_on`, `flag` 'desce'|'salto', visita opcional), RLS forçada,
   sem UPDATE/DELETE (correção = leitura nova).
2. Serviço em duas idas: aviso volta SEM gravar (`precisaConfirmar`); com `confirmado`, grava com a `flag`.
3. Rota `POST/GET /api/v1/subjects/[id]/odometer-readings` com idempotência e auditoria.

## F4 · Execução (commit `8ae35d48`)
- Decisões de padrão: **own** = o profissional só alcança o carro de quem ele atende (mesma regra da ficha,
  `exigirClienteDoProfissional`); **pausa** = `bloqueia` (linha nova no histórico); **sem chamador** =
  justificada até o AUT-401/402 (pacote Oficina ainda fechado).
- Testes: integração 7 (normal, desce sem/com confirmação, salto, outro tenant, inativo, visita de outro
  tenant pela chave composta, alcance own); RLS: isolamento + caso com controle positivo (grava e lê a sua,
  não vê a do outro, UPDATE dá 42501, DELETE não apaga).
- Unidade 466 / 4.314 verdes antes do commit.

## F5 · Medida
- Mutação depois do commit: gravar sem confirmação → 2 reprovam; sem filtro de tenant no veículo → 1;
  `own` ignorado → 1; devolver UPDATE/DELETE no banco → o caso RLS reprova. Todas restauradas.
- Antes: 0 lugares para a leitura de km; depois: histórico por veículo, com 100% das leituras suspeitas
  marcadas e conferidas.

- Suíte RLS INTEIRA pegou o que a dos arquivos tocados não pegou: FK `created_by` sem índice (`indices-fk`).
  Índice na própria 0141 (ainda não publicada), commit `34b7deac`. Depois: RLS 361/361, integração 92 arquivos /
  637 testes, nenhuma falha de gateway nesta rodada.

Nota (impacto / esforço / confiança): 7 / 5 / 8.
