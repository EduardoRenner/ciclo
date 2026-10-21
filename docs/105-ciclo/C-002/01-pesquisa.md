# C-002 · Pesquisa

## Interna (LEITURA, StarkOS, 14/10/2026)
- `regras_manutencao`: `intervalo_km`, `intervalo_meses`, regra "precisa de pelo menos um";
  sementes: troca de óleo 10.000 km / 12 meses; revisão 20.000 / 12; alinhamento 10.000 / 12.
- `lembretes_manutencao`: `previsto_em = data_base + intervalo_meses` e `previsto_km = km_base +
  intervalo_km`. **O km previsto nunca vira data**: a fila de lembretes ordena por `previsto_em`
  (índice `idx_lembretes_fila`), ou seja, só o tempo dispara o lembrete. Não existe ritmo de uso
  do veículo. `veiculos.km_atual` sobe a cada OS (`GREATEST(km_atual, km_saida, km_entrada)`).

## Externa
- **Km médio por ano no Brasil: ~13 mil.** KBB Brasil (2019, >1 milhão de anúncios): 12,9 mil km no
  1º ano, caindo ~390 km/ano; Pernambuco 11,1 mil × Tocantins 17,6 mil; SUV compacto roda mais.
  Sindipeças: 13.275 km/ano, estável. [Monitor Mercantil](https://monitormercantil.com.br/brasileiro-roda-media-de-12-9-mil-km-no-primeiro-ano-de-uso-do-veiculo/);
  [Money Times](https://moneytimes.com.br/motoristas-brasileiros-rodam-129-mil-km-no-1o-ano-de-uso-do-veiculo-veja-comparacao-por-estado/);
  [O Mecânico](https://omecanico.com.br/mais-de-50-da-frota-necessita-de-manutencao-preventiva/). Consultado 14/10/2026.
- **Regra das montadoras: "10 mil km ou 12 meses, o que ocorrer primeiro"; uso severo (trânsito
  urbano, trajetos curtos, terra) 5 mil km ou 6 meses** — e o uso urbano comum já costuma ser
  severo. [AutoPapo / Boris Feldman](https://autopapo.com.br/blog-do-boris/trocar-o-oleo-motor-saiba-prazo-correto/);
  [CNN Brasil / Boris Feldman](https://www.cnnbrasil.com.br/blogs/boris-feldman/auto/troca-de-oleo-voce-nao-sabe-mas-dirige-sob-condicoes-severas/);
  [O Mecânico](https://omecanico.com.br/oleo-15w40-semissintetico-intervalo-de-10-000-km-e-adequado-para-qualquer-motor-mecanico-responde/).

## O que isso muda
- Com 13 mil km/ano, 10 mil km chegam em ~281 dias, antes dos 365 dos 12 meses: o lembrete só por
  tempo chega ~84 dias tarde para o motorista MÉDIO. H1 deve se confirmar no placar.
- O dado para o ritmo já existe na oficina (km de entrada em cada OS). Falta só a conta.

## Pergunta de Thiel
Verdade pouco aceita: **a oficina acha que o problema é "cliente esquecido"; o problema é que ela
lembra na hora errada** — tarde para quem roda muito (o cliente que mais vale) e cedo para quem roda
pouco. Quem prevê por carro, e não por tabela, chama no momento em que a pessoa precisa.
