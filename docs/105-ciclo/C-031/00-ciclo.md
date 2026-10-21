# C-031 · AUT-104: o pacote Oficina no catálogo, fechado até a decisão

**F1 · Objetivo:** a oficina como profissão do CICLO: onboarding que cria uma oficina utilizável, com
vocabulário e serviços iniciais. Número: profissões com pacote próprio e a trava conferida no servidor.

**F2:** molde da advocacia (0102 + `ADVOCACIA_ABERTA = false`): a linha existe para o local e a demo, e
`pacoteAberto` recusa no servidor o pacote fechado. Entrar no mercado de oficinas é decisão pendente do
Eduardo (docs/106 AUT-D1..D4), então o pacote nasce FECHADO (`OFICINA_ABERTA = false`).

**F3/F4:**
- 0140 (aditiva, catálogo): o `check` de `professions.pacote` ganha `oficina`; a profissão
  `oficina_mecanica` (lugar "oficina", atendimento "serviço"; sinônimos de busca nas duas formas,
  "mecânico" e "mecânica"); 4 serviços iniciais com preço SUGERIDO (estimativa de bairro, editável) e
  ciclo de referência: troca de óleo e filtro, alinhamento e balanceamento, pastilhas de freio, revisão.
- `core/pacotes/oficina.ts`: as abas do base (as telas próprias são a fase 4 do 106) e o vocabulário do
  balcão; registro e trava em `abertos.ts`, com a chave da oficina independente da da advocacia.

**O que as guardas pegaram:**
- `pacote-tem-registro` lia o `check` SÓ na 0102: com a 0140 redefinindo, comparava o registro com uma
  lista velha (guarda cega pela raiz). Agora lê a ÚLTIMA definição entre as migrations; e confere que a
  linha da oficina grava o pacote `oficina`.
- `copy-nao-supoe-genero` recusou `profissional = "mecânico"`: há mecânicas. A chave ficou "profissional".

**F5 · Medida:** profissões com pacote próprio 1 → 2 (catálogo 19 → 20, integração 7 de 7); trava: com a
chave fechada a oficina não aparece na lista nem passa no onboarding pela API; a chave da oficina não abre
a advocacia nem o contrário (unidade).

**Decisão para o Eduardo:** abrir a oficina para contas novas = virar `OFICINA_ABERTA` para `true`.

**Nota:** cliente 6 · segredo 5 · engenharia 8. **Próximo (C-032):** AUT-105 (o papel do mecânico sem
valor e sem contato) ou algoritmo (regra ≥ 1 a cada 3; o último foi o C-030).

**Suítes inteiras:** RLS 357 de 357. Integração 603 verdes, 26 pulados (arquivos que caíram no preparo),
1 falha + 2 arquivos no preparo (seed da demo do escritório, serviços, casos jurídicos), todos com a
assinatura do gateway local. Isolados, incluindo `servicos.test.ts` (que toca o catálogo): 29 de 29.
