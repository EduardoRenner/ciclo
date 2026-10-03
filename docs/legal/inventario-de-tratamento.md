# Inventário de tratamento de dados pessoais (LGPD art. 37)

> **J1 do `docs/86`.** Uma linha por tabela do schema `public`, derivada de `src/server/db/types.gen.ts`
> e conferida contra o código em 03/10/2026. **Não é parecer jurídico.** A coluna "Base legal" é a
> **proposta** de quem montou o inventário e entra no dossiê de revisão (`docs/86` §6). Onde está
> `[conferir]`, a resposta depende de algo que o repositório não mostra (produção, escolha do dono).
>
> **A guarda** `tests/unit/legal/inventario-cobre-todas-as-tabelas.test.ts` reprova se uma tabela
> existir no schema e não tiver linha aqui, ou se uma linha apontar para tabela que não existe mais.
> Tabela nova com dado pessoal sem classificação é o jeito de o inventário apodrecer calado.

## Quem é quem

| Papel | Quem | O que decide |
|---|---|---|
| **CICLO é controlador** | do dono do negócio e de quem usa o painel (cadastro, conta, uso, cobrança) | finalidades e meios desses dados |
| **Salão é controlador, CICLO é operador** | das pessoas que o salão atende (clientes finais) e de tudo que o salão cadastra sobre elas | o salão decide o que coletar e por quê; o CICLO só processa, do jeito que o salão mandou |

Quando o dono é MEI, os dados do negócio dele são dado de pessoa física (docs/84 §2.1, pergunta 2).

## Bases legais usadas nas propostas

`7-V` execução de contrato (ou procedimentos preliminares, a pedido do titular) · `7-IX` legítimo interesse ·
`7-II` obrigação legal ou regulatória · `7-VI` exercício regular de direitos · `7-I` consentimento ·
`11-I` consentimento específico e destacado, para dado sensível. Para o dado de saúde o salão **não é
profissional de saúde**, então a proposta é `11-I`, colhido pelo salão e registrado em `consents`.

## Retenção proposta (a validar; `docs/86` §5)

`conta` enquanto a conta existe · `pausa` 90 dias depois da pausa, depois eliminação com aviso ·
`fiscal` 5 anos [confirmar com o contador] · `acesso` 6 meses (Marco Civil art. 15 [confirmar]) ·
`ate-apagar` some quando o salão apaga a pessoa (o apagar já cobre a auditoria, ver Privacidade §6).

---

## A. Dados do dono e de quem usa o painel (CICLO controlador)

| Tabela | Quem é a pessoa | O que tem de pessoal | Finalidade | Base legal (proposta) | Retenção | Observação |
|---|---|---|---|---|---|---|
| `tenants` | dono do negócio | nome do negócio, telefone, endereço, documento (CPF/CNPJ), configurações, cortesia | conta, página pública, cobrança | `7-V` | `conta`, `pausa` | `settings` é jsonb; a cortesia mora aqui (docs/87) |
| `profiles` | quem usa o painel | nome completo, e-mail, telefone | identificar a pessoa na conta | `7-V` | `conta` | ligado ao login do Supabase Auth |
| `memberships` | quem usa o painel | vínculo pessoa + negócio + papel | controle de acesso | `7-V` | `conta` | base da RLS |
| `invites` | pessoa convidada | nome, e-mail, hash do token | convidar alguém para a equipe | `7-V` | `conta` | token só em hash |
| `professionals` | profissional da equipe | nome de exibição, foto, comissão | agenda, comissão, página pública | `7-V` | `conta` | pode não ter login |
| `push_subscriptions` | quem usa o painel | endpoint do navegador, chaves de push | avisos no aparelho | `7-I` consentimento do aparelho | `conta` | o endpoint identifica o aparelho |
| `terms_acceptances` | quem criou a conta | versão aceita, quando, por qual caminho | provar o aceite | `7-II`/`7-VI` | `conta` + prescrição | append-only; sem preencher o passado |
| `experiments` | dono | nada pessoal além do vínculo ao negócio | testes que o dono liga (docs/84) | `7-V` | `conta` | `baseline` é contagem agregada do próprio negócio |
| `monthly_profit` | dono | faturamento e lucro do mês | série mensal congelada | `7-V` | `conta` | dado financeiro do negócio, pessoal se for MEI |
| `product_events` | dono | tipo do evento e origem (canal/ref), sem texto livre | medir o funil do produto | `7-IX` | `conta` | nunca texto de cliente (regra 9) |
| `audit_log` | quem agiu e o alvo | quem, papel, IP, navegador, antes e depois | trilha de quem fez o quê | `7-IX`, `7-VI` | `acesso` + `ate-apagar` | `before`/`after` podem conter dado de cliente: o apagar limpa |
| `vault_access_log` | profissional que abriu a ficha de saúde | quem, qual ficha, IP, navegador | trilha de acesso ao dado sensível | `7-II`/`7-IX` | `conta` | exigência do dado sensível (regra 9) |
| `rate_limits` | quem tentou algo | chave do limitador | impedir abuso | `7-IX` | dias: a limpeza existe (migration 0035 apaga o que expirou há mais de 1 hora) | `[conferir]` se a chave guarda IP puro ou hash |
| `idempotency_keys` | quem fez o pedido | corpo da resposta guardado | não duplicar pedido | `7-V` | `ate-apagar` (redigido) | **`response_body` carrega dado de cliente**: a eliminação o REDIGE (migration 0046) e preserva a linha de propósito, porque apagar quebraria a fila offline. `[conferir]` por quanto tempo as linhas ficam |
| `webhook_events` | quem o provedor citou | payload do Mercado Pago / WhatsApp | conferir pagamento e entrega | `7-V` | `fiscal` para pagamento; resto `[conferir]` | payload pode conter telefone. **Não achei limpeza nem redação na eliminação do cliente** (`lgpd.ts`, 0046) |
| `job_queue` | quem vai receber o aviso | `payload` do trabalho | enviar mensagens e rodar rotinas | `7-V` | dias; `[conferir]` | **`payload` pode carregar telefone e texto.** Não achei limpeza dos concluídos nem redação na eliminação do cliente |
| `cron_heartbeats` | ninguém | hora da última execução | saúde das rotinas | `7-IX` | `conta` | sem dado pessoal |
| `tenant_keys` | ninguém | chave de cifra do cofre, embrulhada | proteger o dado de saúde | `7-IX` | `conta` | nunca sai do banco em claro |
| `tenant_modules` | ninguém | o que o dono ligou ou desligou | personalizar o painel | `7-V` | `conta` | — |

## B. Dados das pessoas que o salão atende (salão controlador, CICLO operador)

| Tabela | Quem é a pessoa | O que tem de pessoal | Finalidade | Base legal (proposta; do salão) | Retenção | Observação |
|---|---|---|---|---|---|---|
| `clients` | cliente do salão | nome, telefone (e hash para busca), e-mail, aniversário, documento, endereço, gênero, contato de emergência, observações, preferências, etiquetas, opt-out de WhatsApp | ficha e histórico | `7-V` (agendar e atender) | `ate-apagar` | **inclui menores** (LGPD art. 14): o cadastro é feito pelo responsável |
| `client_notes` | cliente | texto livre da recepção | contexto no atendimento | `7-V` | `ate-apagar` | texto livre pode conter dado sensível digitado pelo dono |
| `client_cycles` | cliente | quando costuma voltar, por serviço | Motor de Ciclo | `7-IX` | `ate-apagar` | derivado dos atendimentos |
| `client_scores` | cliente | nota de prioridade e como foi calculada | ordenar quem chamar (docs/95) | `7-IX` | `ate-apagar` | decisão automatizada leve; **sugere, nunca age** |
| `client_reviews` | cliente | nota e comentário | avaliação do atendimento | `7-V` | `ate-apagar` | — |
| `client_subscriptions` | cliente | plano mensal que o cliente tem com o salão | clube de assinatura | `7-V` | `fiscal` | vínculo contratual, não apagado pelo erase |
| `cycle_predictions` | cliente | previsão de volta × realidade | prestação de contas do Motor | `7-IX` | `ate-apagar` | append-only |
| `appointments` | cliente + profissional | quando, qual serviço, valor, endereço (atendimento em domicílio), nota do cliente, nota interna | agenda | `7-V` | `fiscal`; passa a não identificar quando a pessoa é apagada | histórico do negócio não se apaga (regra 11) |
| `appointment_series` | cliente | recorrência, endereço, nota | agenda recorrente | `7-V` | `ate-apagar` | — |
| `waitlist` | cliente | janela de interesse, contato por vínculo | lista de espera | `7-V` | `ate-apagar` | — |
| `messages` | cliente | texto da mensagem, canal, quando, se clicou | histórico de contato e atribuição | `7-V`, `7-IX` | `ate-apagar` | o texto sai com a mensagem; **nunca dado de saúde** |
| `message_templates` | o salão | modelos de texto | mensagens prontas | `7-V` | `conta` | sem dado de cliente |
| `campaigns` | o salão | nome e filtro da campanha | chamar de volta | `7-V` | `conta` | só alcança quem aceitou marketing e não pediu para parar |
| `consents` | cliente | tipo de consentimento, quando, IP, navegador, hash do texto | provar o que o cliente autorizou | `7-II`/`7-VI` | `conta` | **base do dado de saúde e do uso de imagem** |
| `health_records` | cliente | ficha de anamnese **cifrada**; só o rótulo do alerta fica fora | saúde do cliente no atendimento | `11-I` (consentimento específico) | `ate-apagar` | **dado sensível**; cifra com chave por negócio; nunca em log (regra 9) |
| `media` | cliente | foto do antes e depois | histórico visual | `11-I`/`7-I` (uso de imagem) | `ate-apagar` | bucket privado, URL assinada; consentimento em `consents` |
| `portfolio_photos` | cliente | foto escolhida para a vitrine do salão | divulgação | `7-I` consentimento de imagem | `ate-apagar` | só entra com consentimento ativo |
| `packages` | cliente | pacote de sessões comprado | pacote | `7-V` | `fiscal` | — |
| `package_uses` | cliente | uso de cada sessão | pacote | `7-V` | `fiscal` | — |
| `loyalty_entries` | cliente | pontos e movimento | fidelidade | `7-V` | `ate-apagar` | — |
| `wallet_entries` | cliente | saldo e movimento da carteira | crédito do cliente | `7-V` | `fiscal` | append-only (dinheiro) |
| `payments` | cliente | quanto, como, quando | caixa | `7-V`, `7-II` | `fiscal` | **sem dado de cartão**: a gente não guarda |
| `tickets` | cliente | comanda | caixa | `7-V`, `7-II` | `fiscal` | — |
| `ticket_items` | cliente | itens da comanda | caixa | `7-V`, `7-II` | `fiscal` | — |
| `commissions` | profissional | comissão devida | repasse | `7-V`, `7-II` | `fiscal` | dado do profissional, não do cliente |
| `quotes` | cliente | orçamento | orçamento | `7-V` | `ate-apagar` | link com token |
| `quote_items` | cliente | itens do orçamento | orçamento | `7-V` | `ate-apagar` | — |
| `stock_moves` | ninguém direto | movimento de estoque, nota | estoque | `7-V` | `conta` | nota é texto livre; sem cliente |

## C. Catálogo e configuração (sem dado pessoal direto)

| Tabela | Quem é a pessoa | O que tem de pessoal | Finalidade | Base legal (proposta) | Retenção | Observação |
|---|---|---|---|---|---|---|
| `services` | ninguém | nome, preço e duração do serviço | catálogo do salão | `7-V` | `conta` | `canonical_key` liga ao catálogo |
| `service_categories` | ninguém | nome da categoria | catálogo | `7-V` | `conta` | — |
| `products` | ninguém | nome e custo do produto | estoque e revenda | `7-V` | `conta` | — |
| `service_products` | ninguém | ficha de consumo | custo do serviço | `7-V` | `conta` | — |
| `professional_services` | profissional | quais serviços ele faz | agenda | `7-V` | `conta` | vínculo sem dado novo |
| `business_hours` | ninguém | horário de funcionamento | agenda | `7-V` | `conta` | — |
| `time_off` | profissional | folgas e bloqueios | agenda | `7-V` | `conta` | pode revelar ausência; sem motivo guardado |
| `subscription_plans` | ninguém | planos que o salão vende ao cliente | clube | `7-V` | `conta` | — |
| `professions` | ninguém | catálogo de profissões e vocabulário | onboarding | `7-V` | global | dado do produto |
| `profession_services` | ninguém | serviços de cada profissão | onboarding | `7-V` | global | dado do produto |
| `vertical_packs` | ninguém | pacote de serviços inicial | onboarding | `7-V` | global | dado do produto |
| `modules` | ninguém | catálogo de módulos | plano | `7-V` | global | dado do produto |

---

## Pontos que precisam de resposta de produção ou de decisão

1. **`job_queue.payload` e `webhook_events.payload`** podem carregar telefone ou texto de cliente, e não achei nem limpeza de linhas antigas nem redação na eliminação (que alcança `audit_log` e `idempotency_keys`, migration 0046, mas não estas duas). Definir o prazo (dias, não anos), escrever a limpeza, e incluir as duas na eliminação, com guarda. Enquanto isso não existir, "a eliminação é completa" (Privacidade §6) precisa de ressalva. `idempotency_keys` tem a redação, falta confirmar o prazo de vida das linhas.
2. **`rate_limits.key`**: confirmar que guarda hash e não IP puro.
3. **Menores**: o cadastro de criança é feito pelo responsável. A política precisa dizer isso (LGPD art. 14) e o salão precisa saber que a autorização é dele.
4. **`client_scores`**: é a única decisão automatizada sobre uma pessoa. Hoje só ordena uma fila e o dono decide; manter assim, e dizer na política (art. 20).
