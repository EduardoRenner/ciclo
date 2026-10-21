# C-026 · A suíte de banco com menos paralelismo (experimento, não adotado)

**F1 · Objetivo:** depois do C-024, a integração inteira passou 1 vez em 6 rodadas desta sessão. As falhas
mudam de arquivo e têm a mesma assinatura: erro de gravação genérico ("Algo deu errado do nosso lado") ou,
quando o serviço não embrulha, "An invalid response was received from the upstream server" — o gateway do
Supabase local devolvendo resposta inválida sob carga. Hipótese: 12 workers em paralelo contra um Supabase
local sobrecarregam o gateway.

**F2/F3 · Experimento:** integração inteira com `--maxWorkers=4`, 2 rodadas, contra a referência (padrão).

**F4/F5 · Medida:**

| | rodadas | falhas por rodada | duração |
| --- | --- | --- | --- |
| padrão (12 workers), C-020..C-025 | 6 | 0 a 4 (1 rodada verde) | ~76 s |
| 4 workers | 2 | 1 e 1 | 106 s e 116 s |

As 2 falhas com 4 workers têm a mesma assinatura (perfil-onboarding; o ramo de FALHA de `processarLote`,
que não tem nova tentativa na baixa). Menos paralelismo reduz, não elimina, e custa ~45% de tempo.
**Não adotado.** A causa está no gateway local, não no produto.

**Protocolo de verificação que fica valendo (já usado desde o C-020):** rodada inteira de RLS e
integração a cada ciclo; arquivo que falhar é rodado isolado; falha só se reproduzir isolada ou tocar o
que o ciclo mudou. Registrar sempre a contagem e a assinatura, nunca chamar de verde.

**Observação para depois (não feita):** os serviços embrulham o erro do gateway num `AppError` genérico, e o
teste perde a causa; um campo `cause` legível no log do teste encurtaria cada diagnóstico destes.

**Nota:** cliente 2 · segredo 2 · engenharia 7. **Próximo (C-027):** AUT-102, o veículo no banco
(`vehicle_specs` com marca/modelo/ano e a placa normalizada Mercosul e antiga), core puro primeiro.
