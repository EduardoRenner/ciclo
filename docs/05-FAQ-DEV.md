# 05 · FAQ DO DEV (132 decisões)

> **Como usar:** antes de perguntar qualquer coisa, procure aqui (Ctrl+F). Cada resposta é uma **decisão tomada**. Se sua pergunta não estiver aqui: escolha a opção mais simples que atenda ao critério de aceite, registre em `docs/DECISOES.md` no formato `data · pergunta · decisão · motivo` e continue.

---

### A. ESCOPO E PRIORIDADE

**A1. Por onde começo?**
`docs/06-BACKLOG.md`, TICKET-001. Em ordem. Não pule.

**A2. Posso implementar duas features em paralelo?**
Só se não tocarem nos mesmos arquivos. Prefira sequencial — commit atômico por ticket vale mais que velocidade.

**A3. O cliente quer X e não está no backlog. Implemento?**
Não. Anote em `docs/BACKLOG-FUTURO.md` e siga. Escopo aberto é o que mata MVP.

**A4. Faço o app do cliente final no MVP?**
Só o mínimo: página pública de agendamento + confirmação + preenchimento de anamnese por link com token. Área logada da cliente fica para a V1.

**A5. Multi-idioma?**
Não. Só pt-BR. Mas **não hardcode string em JSX** — use `src/lib/i18n/pt-BR.ts` com chaves, para que a extração futura seja mecânica.

**A6. Multi-moeda?**
Não. Só BRL. A coluna `currency` existe para não precisar migrar depois.

**A7. Preciso de landing page/site institucional?**
Não faz parte do app. Fica em outro projeto.

**A8. Modo escuro?**
Sim, e é o **padrão**. Claro é opcional, via `prefers-color-scheme` + toggle.

**A9. Suporte a tablet/desktop?**
O layout deve funcionar, mas a prioridade absoluta é 390 px. Desktop = mesmo layout centralizado com no máximo 2 colunas. Não invista em layout desktop sofisticado no MVP.

**A10. Preciso de testes E2E de tudo?**
Não. E2E só nos 5 fluxos críticos: cadastro/onboarding, criar agendamento, booking público com sinal, fechar comanda, recuperar receita. O resto é unit + RLS.

---

### B. ARQUITETURA E STACK

**B11. Posso usar Prisma/Drizzle em vez de supabase-js?**
Não. RLS depende do JWT do usuário chegar na conexão; ORM com pool próprio fura isso ou obriga gambiarra. Use `supabase-js` no servidor + SQL puro em migration.

**B12. E se eu precisar de uma query complexa que supabase-js não expressa bem?**
Crie uma **função Postgres** (`security invoker`, não definer, salvo justificativa) e chame por `rpc()`. Assim a RLS continua valendo.

**B13. Server Components ou Client Components?**
Padrão: Server Component. Vire client só quando precisar de estado, evento ou hook de browser. Nunca marque a página inteira como `'use client'`.

**B14. Server Actions posso usar?**
Só em formulário simples que não precisa funcionar offline (ex.: salvar configuração). Toda escrita de agenda, comanda ou pagamento vai por `/api/v1`.

**B15. Onde fica a regra de negócio?**
`src/core/`, funções puras, sem import de I/O. Se você precisou de `await` numa função de `core/`, provavelmente errou o lugar.

**B16. Monorepo?**
Não. Um app Next + pasta `supabase/`. Simplicidade ganha.

**B17. Qual gerenciador de pacote?**
pnpm. `packageManager` fixado no `package.json`.

**B18. Posso adicionar biblioteca nova?**
Se for para resolver algo que a stack já cobre, não. Se for realmente necessária: verifique manutenção ativa, tamanho do bundle e licença; registre em `docs/DECISOES.md`. Nunca adicione dependência com menos de 6 meses ou 1 mantenedor para algo crítico.

**B19. Zustand/Redux?**
Não. TanStack Query cobre estado de servidor; `useState`/`useContext` cobre o resto. Se aparecer necessidade real, use Zustand — mas justifique.

**B20. GraphQL?**
Não.

**B21. Como gero os tipos do banco?**
`pnpm db:types` → `supabase gen types typescript --local > src/server/db/types.gen.ts`. Roda no CI; se o arquivo estiver desatualizado, o build falha.

**B22. Onde ficam as migrations?**
`supabase/migrations/NNNN_descricao.sql`. **Nunca edite migration já aplicada** — crie uma nova. `db/schema.sql` deste pacote vira a `0001_initial.sql`.

**B23. Posso rodar `supabase db reset` em produção?**
Nunca — e agora existe trava de verdade. **Até 31/08/2026 esta resposta estava errada**: ela
prometia um guard por `NODE_ENV=production` no `package.json`, e o script era só
`"db:reset": "supabase db reset"`. Não havia trava nenhuma, e promessa de segurança falsa é pior
que a ausência dela — quem lê aqui age com a confiança de quem tem rede.

`NODE_ENV=production` também seria a trava errada: ninguém define isso na máquina de
desenvolvimento, então ela nunca dispararia no caso real. O caminho perigoso é `--linked`, e linkar
é passo normal para `db push`.

Hoje `pnpm db:reset` passa por `scripts/db-reset.mjs`, que recusa quando `--linked`/`--db-url`
aparecem, ou quando `NEXT_PUBLIC_SUPABASE_URL` não é local — a mesma regra de
`tests/setup/so-banco-local.ts`. Escape consciente: `PERMITIR_BANCO_REMOTO=1`.

**B24. Como faço deploy?**
Push na `main` → Vercel prod. PR → preview. Migration roda por GitHub Action com `supabase db push`, antes do deploy do app.

**B25. Migration destrutiva (drop column)?**
Duas etapas, em releases diferentes: (1) para de usar a coluna, deploy; (2) drop na release seguinte. Nunca junte.

---

### C. MULTI-TENANCY, AUTH E PERMISSÃO

**C26. Um usuário pode ter mais de um tenant?**
Sim. `memberships` é N:N. A UI mostra um seletor quando `memberships.length > 1`.

**C27. Como o servidor sabe o tenant da requisição?**
Header `X-Tenant-Id` + cookie. **O servidor sempre valida** que existe membership ativo daquele usuário naquele tenant, em toda requisição. Nunca confie no header sozinho.

**C28. Posso confiar no `tenant_id` do corpo da requisição?**
Nunca. Ignore o do corpo; use o validado do contexto.

**C29. E se o usuário trocar o header para o tenant de outro?**
`has_tenant()` retorna false, RLS bloqueia, e a checagem de aplicação devolve `TENANT_MISMATCH`. Existe teste.

**C30. Preciso filtrar `tenant_id` nas queries se a RLS já filtra?**
Sim, **sempre filtre também**. Defesa em profundidade: se alguém desativar uma policy por engano, o filtro segura. E ajuda o planner a usar o índice.

**C31. Quando uso `service_role`?**
Só em worker/webhook, e só dentro de `withTenant()`. Regra de lint impede o resto.

**C32. Como testo RLS?**
`tests/rls/isolation.test.ts`. Ele descobre as tabelas por introspecção, cria 2 tenants e tenta cruzar. Roda no CI e **quebra o build**. Não desative.

**C33. O profissional deve ver o telefone da cliente?**
Depende de `tenants.settings.restrict_professional_view`. Padrão: **vê**. Quando ativado, o profissional só enxerga a própria agenda e clientes que ele atendeu, e o telefone aparece mascarado (`(11) 9****-1234`) com botão "abrir no WhatsApp" que funciona sem revelar o número.

**C34. Por que mascarar se ele pode abrir o WhatsApp mesmo assim?**
Porque impede **cópia em massa**. O objetivo é evitar exportação da carteira, não impedir o atendimento.

**C35. Quem pode exportar a base de clientes?**
Só `owner`, com MFA na hora, no máximo 1×/mês, com auditoria e notificação por push + e-mail. A planilha sai com uma linha-marca-d'água identificando quem exportou.

**C36. Como funciona convite de profissional?**
`POST /api/v1/memberships/invite` gera token de 7 dias enviado por WhatsApp/e-mail. Ao aceitar, cria `profile` (se novo) + `membership` + `professional`.

**C37. Profissional saiu. O que acontece com a agenda dele?**
`memberships.active = false` e `professionals.active = false`. Agendamentos futuros ficam órfãos e aparecem numa tela "precisa realocar". Não deletar nada.

**C38. Senha: qual política?**
Mínimo 10 caracteres, sem exigência de símbolo (isso piora senha). Bloquear as 10 mil mais comuns e checar vazamento no HIBP por k-anonymity. Sem expiração forçada.

**C39. Login por telefone?**
V1.1, via OTP no WhatsApp. No MVP é e-mail+senha. **Não use SMS** — SIM swap é real e o custo é alto.

**C40. Sessão dura quanto?**
Access token 15 min, refresh rotativo de 30 dias com detecção de reuso. Reautenticação (AAL2) para ações sensíveis, listadas em `01-ESPEC-TECNICA §3.2`.

---

### D. MODELO DE DADOS

**D41. Por que colunas em inglês se a UI é em português?**
Padrão de mercado, evita acentuação e plural irregular em SQL, e facilita contratar/integrar. A tradução vive na camada de apresentação.

**D42. Por que dinheiro em centavos?**
Float perde centavo em divisão de comissão. `bigint` em centavos é exato. Formatação só na UI, com `Intl.NumberFormat('pt-BR')`.

**D43. Por que percentual em basis points?**
30% = 3000 bps, inteiro. Evita `0.30000000000000004`.

**D44. UUID ou serial?**
UUID (`gen_random_uuid()`). Serial vaza volume de negócio e complica multi-tenant.

**D45. Soft delete ou hard delete?**
Soft (`deleted_at`) para cliente, serviço, produto e profissional. Hard delete só na eliminação por LGPD, e mesmo assim é anonimização — ver seção G.

**D46. Posso deletar um agendamento?**
Não. Cancele (`status = 'canceled'`). Histórico é receita, retenção e prova.

**D47. Cliente sem telefone, pode?**
Pode (cliente que só aparece presencialmente). Mas sem telefone não entra em automação — a UI avisa.

**D48. Como trato cliente duplicada?**
Índice único em `(tenant_id, phone_e164)` impede duplicata por telefone. Para duplicata por nome, a tela de cliente sugere merge quando a similaridade trigram > 0,6. `POST /clients/merge` move agendamentos, comandas, pacotes e cofre para o registro que fica, e soft-deleta o outro.

**D49. Telefone: como normalizo?**
Sempre E.164 (`+5511987654321`). Use `libphonenumber-js`. Guarde também `phone_hash = sha256(phone + tenant_salt)` para busca sem expor. Rejeite DDD inexistente.

**D50. Onde guardo CPF?**
Só se o tenant for emitir nota. Quando guardar, cifre na aplicação (mesmo mecanismo do cofre). Nunca em log, nunca em índice em claro.

**D51. Preciso de tabela de endereço?**
Não no MVP. `tenants.address` é jsonb. Cliente não tem endereço (só atendimento em domicílio precisa, e isso é V2).

**D52. Como armazeno horário de funcionamento?**
`business_hours` com `weekday` (0=domingo) + `time`. Múltiplas linhas no mesmo dia = intervalos (ex.: 9-12 e 14-19). Fuso vem do tenant.

**D53. E feriado?**
`time_off` com `professional_id = null` fecha o estabelecimento todo. No MVP não há calendário nacional automático — o usuário cria. (V1: importar feriados nacionais.)

**D54. Como registro que a duração real é diferente da cadastrada?**
`professional_services.duration_min` sobrescreve. Um job semanal (`learn_durations`, V1) calcula a mediana real de `arrived_at → completed_at` e **sugere** o ajuste. Nunca altera sozinho.

**D55. `client_cycles` tem PK composta. Não deveria ter id próprio?**
Não. É uma tabela derivada, uma linha por (tenant, cliente, serviço). PK composta é mais rápida e impede duplicata por construção.

**D56. Posso adicionar coluna sem migration?**
Não existe "sem migration". Toda mudança de schema é um arquivo SQL versionado.

**D57. Índice: quando crio?**
Toda FK usada em filtro, toda coluna em `WHERE` de tela quente. Confira com `EXPLAIN ANALYZE` antes de commitar consulta nova de lista.

**D58. Preciso de particionamento?**
Não no MVP. Reavalie `appointments` e `messages` acima de 50 milhões de linhas.

---

### E. REGRAS DE NEGÓCIO — AGENDA

**E59. Duas pessoas clicam no mesmo horário ao mesmo tempo. O que acontece?**
A constraint de exclusão (`appointments_no_overlap`) deixa só uma passar. A outra recebe `409 SLOT_TAKEN` com 3 alternativas. **Não resolva isso com lock na aplicação** — já está resolvido no banco. (Testado: ver `tests/rls`.)

**E60. Como trato horário de verão?**
Guarde `timestamptz`. Nunca faça aritmética em horário local. Para gerar slots, converta o expediente local do dia para instantes com a biblioteca de fuso — o dia pode ter 23 ou 25 horas. Existe teste específico com uma data de transição.

**E61. Cliente quer marcar para daqui a 6 meses?**
Limite padrão: 60 dias (`tenants.settings.max_advance_days`). Configurável.

**E62. Antecedência mínima?**
120 minutos por padrão (`min_lead_time_minutes`). No app do profissional ele pode furar (encaixe manual); no booking público, não.

**E63. Como funciona o buffer?**
`buffer_before_min` e `buffer_after_min` do serviço. O bloco ocupado é `[início − antes, fim + depois]`. O horário mostrado à cliente é sempre o de início real do atendimento.

**E64. Serviço com capacidade paralela (ex.: secagem)?**
`services.parallel_capacity`. Se > 1, a constraint de exclusão não serve — nesse caso o insert passa por uma função `book_appointment()` que faz `SELECT ... FOR UPDATE` na janela e conta ocupação. **No MVP, mantenha 1** e só implemente o caminho paralelo se um cliente real pedir.

**E65. Agendamento recorrente: como modelo?**
`recurrence_id` agrupa. Materialize as próximas **8 ocorrências** no banco (não gere infinito). Um job cria as seguintes. Editar uma ocorrência não mexe nas outras; editar a série pergunta "só esta ou todas as futuras?".

**E66. Cliente cancela em cima da hora. Cobro?**
Política configurável em `tenants.settings.cancellation`: `{ freeUntilHours: 24, retainDeposit: true, chargeNoShowFee: false }`. No MVP, sinal retido é o único mecanismo — não invente cobrança automática de multa (risco jurídico e de chargeback).

**E67. E se o profissional cancelar?**
Sinal devolvido integralmente e automaticamente. Mensagem de desculpa com sugestão de 3 horários. Não conta como no-show da cliente.

**E68. No-show: quem marca?**
O profissional, manualmente, na agenda. Um job **sugere** (`status = 'confirmed'` e passou 30 min do início) mas nunca marca sozinho.

**E69. Lista de espera: como escolho quem chamar?**
Ordene por: (1) compatibilidade de serviço, (2) preferência de período bate, (3) `value_at_risk_cents` do ciclo, (4) ordem de entrada. Avise **uma** pessoa por vez, com 20 min de exclusividade; se não responder, passa para a próxima.

**E70. Encaixe: pode furar o expediente?**
Sim, no app do profissional, com confirmação explícita ("esse horário está fora do seu expediente, quer marcar mesmo assim?").

**E71. Como calculo os 3 horários alternativos do 409?**
Os 3 slots livres mais próximos temporalmente do horário pedido, do mesmo profissional; se não houver 3 em 7 dias, complete com outros profissionais que fazem o serviço.

---

### F. PAGAMENTO, COMANDA, ESTOQUE

**F72. Qual PSP?**
Asaas no MVP (Pix, cartão, split, sandbox bom, documentação em português). Tudo atrás de `PaymentProvider` — trocar é um arquivo.

**F73. Guardo dado de cartão?**
**Nunca.** Tokenização no cliente, direto com o PSP. O nosso servidor nunca vê PAN nem CVV. Isso mantém o escopo PCI em SAQ-A.

**F74. Sinal expira. Quem libera o horário?**
Job `expire_holds` a cada 2 min: `status='pending' AND hold_expires_at < now()` → `expired`. Mensagem para a cliente com link para tentar de novo.

**F75. E se o Pix for pago 1 segundo depois de expirar?**
O webhook chega e encontra o agendamento `expired`. Regra: se o slot **ainda está livre**, reative o agendamento. Se já foi ocupado, **estorne automaticamente** e avise a cliente com 3 alternativas. Isso é obrigatório — cliente pagando e ficando sem horário é o pior bug possível.

**F76. Pagamento parcial na comanda?**
Sim. Uma comanda pode ter N `payments`. Fecha quando `sum(paid) >= total`. Diferença para menos deixa a comanda como `closed` mas não `paid`.

**F77. Desconto: valor ou percentual?**
Guarde sempre em **centavos** (`discount_cents`). Se a UI oferecer percentual, converta na hora e grave o valor. Assim histórico não muda quando o preço muda.

**F78. Onde entra a taxa da maquininha?**
Tabela em `tenants.settings.fees` por método e parcelamento. Aplique no fechamento, grave em `tickets.fee_cents`. É estimativa; a conciliação real fica para a V2.

**F79. Comissão sobre o bruto ou sobre o líquido?**
Configurável (`settings.commission_base`: `gross` | `net_of_material`). Padrão `gross`, que é o que o mercado usa. Congele o `bps` usado na linha.

**F80. Comissão sobre produto vendido?**
Percentual próprio (`settings.product_commission_bps`, padrão 10%). Não use o mesmo do serviço.

**F81. Estorno de comanda fechada: como reverto o estoque?**
Gere `stock_moves` compensatórios do tipo `return`. **Jamais delete** o movimento original.

**F82. Custo do produto: FIFO ou média?**
Média móvel ponderada. FIFO no MVP é complexidade sem retorno.

**F83. Estoque pode ficar negativo?**
Pode (a pessoa usou e não lançou a compra). Não bloqueie o atendimento por causa disso — mostre alerta. Bloquear estoque em salão gera abandono do sistema.

**F84. Gorjeta entra na comissão?**
Não. Gorjeta é 100% do profissional e não entra em base de comissão nem em receita do estabelecimento. Campo separado.

**F85. Pacote: quando reconheço a receita?**
Dinheiro entra em `payments` na venda; **receita é reconhecida por sessão consumida**. O relatório de caixa mostra as duas linhas separadas ("entrou" ≠ "faturei"). Isso é o que evita o estúdio quebrar achando que está lucrando.

**F86. Pacote vencido, o que faço?**
Não some. Fica com saldo e badge "vencido"; o profissional decide liberar ou não. Alerta em D-15.

---

### G. SEGURANÇA, COFRE E LGPD

**G87. O que exatamente vai para o cofre criptografado?**
Respostas de anamnese, observações clínicas e qualquer texto sobre saúde. **Não** vão: nome, telefone, e-mail, histórico de compras (são pessoais, não sensíveis, e precisam ser indexáveis).

**G88. Se está tudo cifrado, como mostro o alerta de alergia na agenda?**
`health_records.has_alert` (boolean) e `alert_label` (rótulo curto, ex.: "Alergia") ficam em claro. O **detalhe clínico** só aparece ao abrir a ficha, que descriptografa e registra o acesso. Rótulo nunca contém diagnóstico.

**G89. Onde fica a chave mestra (KEK)?**
Variável de ambiente em prod (`VAULT_KEK`), idealmente KMS. **Nunca** no repositório, nunca em `.env` commitado. Rotação anual, com `key_version` para reencriptar em lote.

**G90. Nosso suporte consegue ler o cofre?**
Não. O modo impersonation nunca carrega a DEK. Se precisar dar suporte a um caso do cofre, oriente o cliente por tela compartilhada. Isso é feature de venda, escreva no marketing.

**G91. O que vai para o log/Sentry?**
Nunca: dado de saúde, telefone completo, e-mail, CPF, foto, token, chave. Configure `beforeSend` do Sentry para redigir. Existe teste que injeta PII e verifica que foi redigida.

**G92. Como funciona a exclusão por LGPD?**
**Corrigido em 31/08/2026** — a resposta anterior descrevia como automático um estágio que não roda.

O que EXISTE e funciona: o botão de apagar na ficha chama `eliminarCliente` (`lgpd.ts`), que faz a
anonimização inteira na hora — nome vira marcador, telefone/e-mail viram null, cofre e mídia são
apagados de verdade, `anonymized_at` é preenchido, e a trilha de auditoria é redigida
(`redigir_trilha_do_cliente`, migration 0046). Registros financeiros permanecem sem vínculo
pessoal, porque a lei fiscal exige guarda.

**Atualizado — a rota existe desde 31/08/2026, o automatismo ainda não.** `GET
/api/cron/lgpd-retention` (`route.ts`) já implementa o estágio inteiro: acha clientes com
`deleted_at` há mais de 30 dias e `anonymized_at` nulo, chama `eliminarCliente` em lote (100 por
execução, uma falha não derruba a fila), e tem modo `?simular=1` que só conta sem apagar — pensado
pra medir o alcance antes do primeiro disparo de verdade. O que **NÃO existe** é o gatilho
automático: a rota está DE PROPÓSITO fora do `.github/workflows/cron.yml` (nem `vercel.json`) —
ligar destruição irreversível de dado pessoal é decisão do dono do produto, registrada no
cabeçalho do próprio arquivo, não efeito colateral de um deploy. Hoje ela só roda se alguém a
chamar na mão (com o `CRON_SECRET`).

**Não diga ao titular que a anonimização acontece sozinha em 30 dias — ainda não acontece.** Diga
que a eliminação acontece quando pedida, e peça-a. A política pública (`/privacidade`) já está
correta: ela descreve o botão, não um prazo automático.

**G93. E os backups?**
Backup expira em 30 dias. **A reaplicação automática após restauração ainda não existe** — depende
do mesmo `lgpd_retention` da G92, que existe em código mas não está agendado (mesma pendência de
decisão de negócio). Hoje, restauração dentro da janela exige reexecutar as eliminações à mão, ou
esperar o Eduardo autorizar ligar o `schedule`. Não documente no aviso de privacidade um
automatismo que não roda ainda.

**G94. Foto: quanto tempo guardo?**
Padrão 24 meses ou até revogação do consentimento de imagem, o que vier primeiro. Configurável por tenant, com mínimo de 12 meses (para prova) e máximo de 60.

**G95. Preciso remover EXIF das fotos?**
Sim, obrigatoriamente. Foto de celular carrega **geolocalização**. Reprocesse a imagem no upload (sharp), o que também destrói payload malicioso embutido.

**G96. Como sirvo as fotos?**
Bucket privado, `storage_key` aleatório (nunca previsível como `client-123/foto-1.jpg`), signed URL de 5 minutos, `Cache-Control: private, no-store`. Cada geração de URL registra em `vault_access_log`.

**G97. Assinatura no dedo tem valor jurídico?**
Como prova, sim, desde que você guarde: imagem da assinatura, **hash do texto exibido**, timestamp, IP e user-agent. Guardar só a imagem não prova o que a pessoa assinou. Por isso existe `consents.text_hash`.

**G98. Versionamento de termo?**
`consents.version` + `text_hash`. Se o texto mudar, o consentimento antigo continua válido para o texto antigo, e o sistema pede a nova aceitação no próximo atendimento.

**G99. Rate limit: onde aplico?**
Middleware do Next + Edge. Camadas: por IP (global), por conta, por telefone e por endpoint. Booking público é o mais restrito. Use `@upstash/ratelimit` ou implementação própria com a tabela `job_queue`... **não**: use Upstash Redis só para isso — é a única exceção ao "sem Redis".

**G100. CAPTCHA em qual tela?**
Booking público, cadastro e recuperação de senha. hCaptcha invisível; só desafia sob suspeita.

**G101. CSP: qual política?**
`default-src 'self'`; scripts só de `self` e do domínio do PSP; `frame-ancestors 'none'`; sem `unsafe-inline` (use nonce). Configure no `next.config.js` e teste no CI.

**G102. Upload: como valido?**
Magic bytes (não confie na extensão nem no `Content-Type`), limite de 10 MB, tipos permitidos: jpeg/png/webp/heic. Reprocessa com sharp. Bucket sem execução.

**G103. Webhook: como evito replay?**
HMAC + timestamp com janela de 5 min + `webhook_events` com unique em `(provider, event_id)`.

**G104. Preciso de WAF?**
Vercel já entrega proteção básica. Configure regras de bot no booking público. Pentest externo antes do lançamento comercial.

**G105. O que é "impersonation" e como implemento?**
Suporte assumir a conta do cliente. Requisitos: consentimento do dono registrado, sessão de 60 min, banner permanente na tela, cofre bloqueado, tudo em `audit_log`, e um e-mail para o dono depois com o que foi feito.

**G106. Preciso de seguro cyber / ISO?**
Não no MVP. Planeje SOC 2 Tipo II para o ano 2 (destrava venda para rede).

---

### H. MENSAGERIA E IA

**H107. Posso mandar mensagem livre pelo WhatsApp?**
Só dentro da janela de 24h após a cliente escrever. Fora disso, **template aprovado**. A lista está em `02-API §4`.

**H108. E se o template for reprovado pela Meta?**
Tenha 2 variações de cada template crítico. Se as duas falharem, caia para push/e-mail. Nunca deixe o lembrete sumir em silêncio.

**H109. Quantas mensagens posso mandar por cliente?**
Máximo 3/semana no total, 1 campanha a cada 7 dias, nada entre 21h e 8h. Isso protege o número do WhatsApp do cliente de ser banido — é responsabilidade nossa.

**H110. Opt-out: como funciona?**
Qualquer mensagem com "SAIR", "PARAR", "CANCELAR" → `clients.whatsapp_opt_out = true`, resposta de confirmação, e nunca mais mensagem de marketing. Lembrete transacional segue até ela pedir explicitamente para parar tudo.

**H111. IA está no MVP?**
Não. Mas deixe a interface `AiProvider` pronta e o campo de texto da campanha editável, para que a V2 encaixe.

**H112. Como protejo contra injeção de prompt (V2)?**
Entrada da cliente sempre delimitada e marcada como não confiável; allow-list de ferramentas; o modelo **nunca** recebe conteúdo do cofre; toda ação de escrita passa por confirmação humana nos primeiros 30 dias da conta; saída sanitizada antes de virar mensagem.

**H113. Dado de cliente pode ir para o provedor de LLM?**
Só nome e histórico de serviços, com contrato de não-treinamento. **Nunca** dado de saúde, foto ou telefone completo.

---

### I. FRONTEND, PWA E OFFLINE

**I114. Como funciona o offline exatamente?**
Leitura: cache do TanStack Query persistido em IndexedDB (agenda dos próximos 7 dias + clientes recentes). Escrita: fila em IndexedDB com `Idempotency-Key`, drenada em ordem ao voltar a conexão. Ver `01-ESPEC-TECNICA §4.2`.

**I115. E se o agendamento offline conflitar ao sincronizar?**
Servidor recusa com 409. O item vira um card "precisa da sua atenção" com as duas versões e botões de resolver. **Nunca descarte em silêncio.**

**I116. Posso usar localStorage?**
Só para preferência de tema e último tenant. Nada sensível, nunca token.

**I117. Service worker: gerado como?**
`next-pwa` ou Workbox manual. Estratégias: app shell `CacheFirst`, API `NetworkFirst` com timeout de 3 s, imagens `StaleWhileRevalidate`. **Nunca** cachear resposta de `/vault` nem mídia assinada.

**I118. Push notification no iOS?**
Funciona a partir do iOS 16.4 **só se o PWA estiver instalado na tela de início**. O onboarding precisa ensinar isso explicitamente. É a razão de existir a V2 com wrapper nativo.

**I119. Como faço a agenda arrastável?**
`@dnd-kit` com sensor de toque, `activationConstraint: { delay: 200, tolerance: 8 }` para não conflitar com scroll. Haptic via `navigator.vibrate(10)` no drop. Sempre com confirmação antes de gravar.

**I120. Formulário longo no celular?**
Quebre em passos (máximo 5 campos por tela), salve rascunho a cada passo, teclado correto por tipo (`inputMode="numeric"` para valor, `type="tel"` para telefone), e nunca perca dado ao girar a tela.

**I121. Como formato dinheiro?**
`new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100)`. Uma função `formatBRL(cents)` em `src/lib/format.ts`. Nunca inline.

**I122. Skeleton ou spinner?**
Skeleton para lista e card. Spinner só em botão. Nada de tela branca — o CI tem teste de "tela vazia" nas 5 rotas principais.

**I123. Acessibilidade: qual nível?**
WCAG AA. Contraste 4,5:1, alvo de toque 48 px, foco visível, estado nunca comunicado só por cor, `aria-live` em toast. Roda `axe` no e2e.

**I124. Preciso de animação?**
Poucas e curtas (150–250 ms). Respeite `prefers-reduced-motion`. Confete só ao bater meta, no máximo 1×/dia.

---

### J. QUALIDADE, OBSERVABILIDADE E OPERAÇÃO

**J125. O que `pnpm verify` roda?**
`typecheck` → `lint` (inclui a regra de import de `service_role` e a de dependência de `core/`) → `test:unit` → `test:rls` → `build`. Se qualquer um falhar, o ticket não está pronto.

**J126. Cobertura mínima de teste?**
`src/core/` ≥ 90%. O resto sem meta numérica — mas todo bug corrigido entra com teste de regressão.

**J127. Como testo função de banco?**
`tests/rls/` sobe um Postgres em container (ou usa o Supabase local), aplica as migrations e roda SQL de verdade. Nada de mock de banco.

**J128. Seed de desenvolvimento?**
`supabase/seed.sql` cria 1 tenant de cada vertical, 3 profissionais, 120 clientes com histórico de 8 meses (para o Motor de Ciclo ter o que calcular) e agendamentos passados e futuros. Dado fake gerado com faker, **sem** nome de pessoa real.

**J129. Como monitoro em produção?**
Sentry (erro), PostHog (funil de ativação), e um endpoint `/api/health` que checa banco, fila e PSP. Alerta se: fila com item parado > 15 min, taxa de erro 5xx > 1%, mensagem `failed` > 5% na hora, job `send_reminders` sem execução em 30 min.

**J130. Qual o RTO/RPO?**
RTO 4 h, RPO 15 min. PITR do Supabase com 30 dias. **Teste de restauração mensal** — documentado, não prometido.

**J131. Como faço rollback de um deploy ruim?**
Vercel: promover o deploy anterior (instantâneo). Banco: migration nunca é revertida automaticamente — por isso migration destrutiva é sempre em duas etapas (D/B25).

**J132. Quando considero o MVP pronto para o primeiro cliente real?**
Quando todos estes forem verdadeiros: os 5 fluxos E2E passam; `test:rls` verde; pentest básico feito (pelo menos OWASP Top 10 com ZAP); política de privacidade e termos publicados; DPA disponível; restauração de backup testada; e você conseguiu usar o app um dia inteiro no seu próprio celular sem abrir o desktop.

---

### Perguntas que você NÃO precisa fazer

- *"Uso Tailwind ou CSS Modules?"* → Tailwind.
- *"Crio um design system do zero?"* → Não, shadcn/ui + os tokens de `03-DESIGN-SYSTEM.md`.
- *"Faço testes antes ou depois?"* → Junto. Ticket sem teste não fecha.
- *"Commito o `.env`?"* → Não. Nunca. Nem vazio com valores de exemplo reais.
- *"Posso desabilitar RLS só para debugar?"* → Não. Use `set_tenant_context` no psql local.
- *"Uso `any` só nesse ponto?"* → Não. Use `unknown` e refine.


---


### `commissions` e `payments` estão vazias — isso é bug?

**Não. São recurso desenhado na `0001` e nunca construído.** Confirmado por varredura em
2026-09-04: nenhuma das duas tabelas tem uma única leitura ou escrita em `src/`. `payments` só
aparece no mapa de eliminação da LGPD.

**Não escreva nelas para "consertar".** A comissão já funciona, e funciona do jeito certo: o valor é
calculado em `core/comanda/totals.ts` e **congelado** em `ticket_items.commission_bps` e
`ticket_items.commission_cents` no fechamento da comanda — a `0001` marca essas colunas com o
comentário *"congelado no momento"*. É a armadilha *"guarde o valor em centavos; preço muda,
histórico não pode mudar"* do `CLAUDE.md` já resolvida. Passar a gravar em `commissions` duplicaria
a verdade e criaria a chance de os dois números discordarem.

O que `commissions` foi desenhada para ser, e ainda não é: **fechamento por período**. As colunas
contam a história sozinhas (`period_start`, `period_end`, `settled_at`). O dia em que existir uma
tela de "fechar o mês do profissional", ela agrega o que `ticket_items` já congelou — ela não
recalcula, e não vira uma segunda fonte.

O mesmo vale para `payments`: o livro-caixa de hoje não passa por ela. Se alguém ligar pagamentos
depois, conferir antes o que o relatório de eliminação da LGPD promete sobre essa tabela — hoje ele
lista uma tabela que nunca recebe linha, o que é inofensivo agora e vira falso naquele dia.

### As oito colunas do item C do `docs/41` — todas sem leitor, e por quê

**2026-09-04.** Fechamento do item C da auditoria das 58 tabelas. Varredura com piso conferido
(450 arquivos `.ts`/`.tsx` em `src/`, 61 migrations) e `grep` de string fixa, sem regex em template
literal — que já cegou esta mesma varredura duas vezes.

**Resultado: as oito têm zero referência em `src/`, e nenhuma tem dono claro.** Nenhuma foi ligada.
O `docs/41` manda fazer "só o que tiver dono claro", e inventar um consumidor para uma coluna é
como se cria a segunda fonte de verdade que o resto deste arquivo passa a vida desfazendo.

| Coluna | Quem escreve | Situação |
|---|---|---|
| `vault_access_log.orphaned_at`, `audit_log.orphaned_at` | migration `0050`, uma vez | **Administrativa por desenho** |
| `package_uses.used_at` | `default now()` | Tela de histórico de consumo não existe |
| `tenant_keys.rotated_at` | `default now()` | Rotação de chave não construída |
| `messages.scheduled_for` | ninguém | Envio agendado não construído |
| `webhook_events.processed_at` | ninguém | Webhook não construído (depende de PSP) |
| `products.sku` | ninguém | Não existe CRUD de produto |
| `v_clientes_a_recuperar.maior_valor_cents`, `maior_atraso_dias` | a própria view | **Regra duplicada** |

#### `orphaned_at` não é bug, e a `0050` já explicava

A migration afirma que *"nenhum tenant real enxerga estas linhas hoje"*. **Conferido, não assumido:**
`trilha-cofre.ts:35` filtra `.eq('tenant_id', tenantId)`, e um tenant vivo nunca tem o id de um
tenant apagado — que é a definição de órfã. E `audit_log` não é lido por tela nenhuma: a única
referência em `src/` é o `insert` de `audit/write.ts`.

A coluna existe para uma rotina de arquivamento futura poder excluir a linha do caminho quente sem
apagá-la (regra 11 do `CLAUDE.md`). Ler não resolve problema nenhum hoje.

#### Os dois agregados da view são regra duplicada, e o comentário da view engana

O cabeçalho da `0058` diz, sobre `maior_valor_cents`: *"O serviço de maior valor em risco é o que a
tela mostra na linha da cliente"*. **Essa frase descreve o comportamento certo e o lugar errado.**

Quem monta aquela linha é `listarParaRecuperar`, que lê a `v_recover_revenue` — outra view — e
escolhe o maior valor por cliente em `core/ciclo/quem-recuperar.ts`. E escolhe ali de propósito: o
docstring daquela função explica que não vai depender da ordem da view, porque *"ordem que não está
escrita é ordem que um dia muda sem aviso, e a troca seria silenciosa"*.

Ou seja: a `v_clientes_a_recuperar` calcula um `max` por cliente que ninguém consome, enquanto o
mesmo `max` é calculado em TypeScript, deliberadamente, a partir de outra view. Os dois agregados
ficam onde estão — tirá-los exige `drop view` mais recriação por uma economia desprezível de
`max()` sobre um conjunto já agrupado. **Mas ninguém deve "consertar" a ausência de leitor: o leitor
correto já existe, noutro lugar, por decisão registrada.**

#### `messages.scheduled_for` paga um índice por um recurso que não existe

A `0001` cria `create index on messages (status, scheduled_for) where status = 'queued'`. O índice é
parcial e a tabela de mensagens é pequena, então o custo é teórico hoje — mas vale saber que ele
existe antes de alguém medir escrita em `messages` e estranhar. Quando o envio agendado for
construído, o índice já está lá; até lá, é o único vestígio do recurso.
