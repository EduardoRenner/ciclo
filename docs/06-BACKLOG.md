# 06 · BACKLOG (58 tickets)

Formato: **ID · título** → critério de aceite verificável. Implemente na ordem. Cada ticket = 1 commit.
Legenda: 🔒 toca segurança · 💰 toca dinheiro · 📱 tela mobile

---

### SPRINT 0 · Fundação (semanas 1–2)

**TICKET-001 · Inicializar o repositório**
Next.js 15 + TS strict + Tailwind + shadcn/ui + pnpm. `tsconfig` com `strict`, `noUncheckedIndexedAccess`, paths `@/*`.
✅ `pnpm dev` sobe · `pnpm build` passa · README com 5 comandos.

**TICKET-002 · Configurar Supabase local e projeto**
`supabase init`, projeto em São Paulo, `.env.example` preenchido.
✅ `supabase start` funciona · `pnpm db:types` gera tipos.

**TICKET-003 · Aplicar o schema inicial** 🔒
`db/schema.sql` vira `supabase/migrations/0001_initial.sql`.
✅ Migration aplica limpa em banco vazio · 34 tabelas · nenhuma sem RLS.

**TICKET-004 · Packs de vertical**
`db/seed-packs.sql` vira `0002_vertical_packs.sql`.
✅ `select apply_vertical_pack(tenant, 'lashes')` cria 6 serviços, 7 produtos, ficha de consumo e expediente.

**TICKET-005 · Teste automático de isolamento multi-tenant** 🔒
`tests/rls/isolation.test.ts` com descoberta por introspecção.
✅ Cria 2 tenants, tenta cruzar select/update/insert/delete em **toda** tabela com `tenant_id` · falha o build se vazar · uma tabela nova sem policy é detectada automaticamente.

**TICKET-006 · Lint de segurança** 🔒
Regras ESLint próprias: (a) `createServiceClient` só em `src/server/db/with-tenant.ts`; (b) `src/core/**` não importa `src/server/**` nem libs de I/O; (c) proibido `any`.
✅ Violar qualquer uma quebra `pnpm lint`.

**TICKET-007 · CI**
GitHub Actions: typecheck, lint, unit, rls, build, `supabase db lint`. Bloqueio de merge.
✅ PR com RLS faltando não passa.

**TICKET-008 · Camada de erro e envelope de resposta**
`AppError`, códigos de `02-API §1`, handler global, `requestId` em tudo.
✅ Erro nunca vaza stack · toda resposta segue o envelope.

**TICKET-009 · Autenticação** 🔒
Cadastro, login, logout, recuperação de senha, sessão, guard de rota.
✅ Rota autenticada sem sessão → 401 · senha fraca rejeitada · HIBP checado.

**TICKET-010 · Contexto de tenant e RBAC** 🔒
Resolução do tenant ativo, validação de membership, `requirePermission()`.
✅ Header forjado de outro tenant → `TENANT_MISMATCH` · profissional não acessa rota de dono.

**TICKET-011 · Auditoria**
`writeAudit()` chamado por middleware nas mutações; tabela `audit_log`.
✅ Toda escrita relevante gera linha com actor, antes/depois, IP.

**TICKET-012 · Idempotência**
Middleware que lê `Idempotency-Key`, grava e reusa resposta.
✅ Mesmo POST duas vezes cria 1 registro · payload diferente com a mesma chave → 422.

**TICKET-013 · Design system base** 📱
Tokens de `03-DESIGN-SYSTEM.md`, tema escuro padrão, componentes: Button, Card, Sheet, Chip, StatTile, Badge, EmptyState, Skeleton, Toast.
✅ Página de showcase em `/dev/ui` · contraste AA verificado.

**TICKET-014 · Shell do app** 📱
Bottom tab bar de 5 itens com FAB central, navegação, safe-area.
✅ Funciona a 390 px · alvos ≥ 48 px · sem scroll horizontal.

---

### SPRINT 1 · Cadastros e agenda (semanas 3–4)

**TICKET-015 · Onboarding**
Nome do negócio, vertical, slug, fuso → cria tenant, membership, professional, aplica pack, gera DEK.
✅ Em menos de 60 s a conta existe com serviços prontos · slug único e validado.

**TICKET-016 · CRUD de serviços** 📱
✅ Criar, editar, arquivar, reordenar · duração, buffer, preço, ciclo, sinal.

**TICKET-017 · CRUD de profissionais e expediente** 📱
✅ Convite por link · expediente por dia da semana com múltiplos intervalos · folgas.

**TICKET-018 · CRUD de clientes + busca** 📱
✅ Busca por nome (trigram) e telefone · telefone normalizado E.164 · duplicata bloqueada.

**TICKET-019 · Importação de clientes por CSV**
Mapeamento de coluna, pré-visualização, relatório de erro.
✅ 500 linhas importam em < 10 s · linha inválida não derruba o lote · duplicata sinalizada.

**TICKET-020 · Motor de disponibilidade (core)**
`availableSlots()` puro, em `src/core/scheduling/`.
✅ Testes: expediente, buffer, folga, antecedência mínima, **dia de mudança de horário de verão**, serviço maior que a janela.

**TICKET-021 · Criar agendamento** 💰
Endpoint + tela.
✅ Conflito devolve 409 com 3 alternativas · duas requisições simultâneas criam só 1 · transição de estado validada.

**TICKET-022 · Tela de agenda** 📱
Timeline vertical do dia, seletor de semana, cor por status, ocupação e previsto.
✅ Carrega em < 200 ms com 60 agendamentos · funciona a 390 px.

**TICKET-023 · Remarcar e cancelar** 📱
Arrastar para remarcar + sheet de confirmação.
✅ Revalida disponibilidade · registra `canceled_by` e motivo · não deleta linha.

**TICKET-024 · Estados do atendimento** 📱
Confirmar, chegou, concluir, faltou.
✅ Transição ilegal → 422 · concluir gera a comanda.

**TICKET-025 · Tela "Hoje"** 📱
Faturamento do dia, próximo cliente, alertas, resto do dia.
✅ É a rota inicial · carrega em 1 requisição.

---

### SPRINT 2 · Booking público, WhatsApp e sinal (semanas 5–6)

**TICKET-026 · Página pública `/{slug}`** 📱
Perfil, serviços, escolha de profissional e horário, SSR.
✅ Lighthouse mobile ≥ 90 · não expõe nenhum dado de outra cliente.

**TICKET-027 · Endurecimento do booking público** 🔒
CAPTCHA invisível, honeypot, rate limit por IP/telefone/dia, validação de DDD.
✅ Script que tenta 50 agendamentos é bloqueado · resposta idêntica para telefone novo e existente.

**TICKET-028 · Provider de mensageria**
Interface + implementação WhatsApp Cloud API + fallback push/e-mail.
✅ Template enviado em sandbox · falha 3× cai para o fallback · tudo gravado em `messages`.

**TICKET-029 · Fila de jobs**
`job_queue` + `pg_cron` + Edge Function consumidora com `SKIP LOCKED`, backoff e dead letter.
✅ 1.000 jobs processam sem duplicar · falha 5× vai para `dead`.

**TICKET-030 · Lembrete e confirmação**
D-1 18h e D-0 T-3h no fuso do tenant, com botões.
✅ Nunca envia duas vezes (índice de dedupe) · respeita janela 8h–21h · botão confirma sem login.

**TICKET-031 · Provider de pagamento** 💰
Interface + Asaas: Pix, cartão, estorno, webhook.
✅ Cobrança Pix criada em sandbox · webhook com assinatura inválida → 401 · evento repetido processa 1×.

**TICKET-032 · Sinal no agendamento** 💰
Cobrança na reserva, hold de 30 min, QR na tela, confirmação em tempo real.
✅ Sem pagamento, slot libera em 30 min · **pagamento após expirar com slot livre reativa; com slot ocupado estorna automaticamente e avisa**.

**TICKET-033 · Política de cancelamento** 💰
Configuração + aplicação (crédito na carteira ou retenção).
✅ Cancelamento do profissional devolve 100% automaticamente.

**TICKET-034 · Lista de espera** 📱
Entrar na lista, sugestão de encaixe, notificação com exclusividade de 20 min.
✅ Um horário liberado avisa 1 pessoa por vez, na ordem correta.

---

### SPRINT 3 · Motor de Ciclo (semana 7)

**TICKET-035 · `computeCycle()` (core)**
✅ Testes: sem histórico, 1 gap, 5 gaps, gap absurdo descartado, clamp, agendamento futuro força `on_track`.

**TICKET-036 · Job `recompute_cycles`**
03:00 no fuso de cada tenant + recálculo ao concluir atendimento.
✅ 10 mil clientes em < 60 s · idempotente.

**TICKET-037 · Tela "Recuperar receita"** 📱💰
Valor total, lista priorizada, filtros por estado, ação individual e em massa.
✅ Carrega em < 200 ms com 500 clientes · valor bate com a soma das linhas · abre em 1 toque da tela Hoje.

**TICKET-038 · Campanhas de ciclo**
Job diário respeitando limites, opt-out e janela de horário.
✅ Nunca 2 campanhas para a mesma cliente em 7 dias · `skipped` retorna o motivo.

**TICKET-039 · Atribuição de receita**
Ligar agendamento originado de campanha → receita.
✅ Tela mostra "o CICLO trouxe R$ X este mês" com número auditável.

**TICKET-040 · Segmentação RFV**
Cálculo e listas inteligentes (aniversariantes, primeira visita sem retorno, ticket alto).
✅ Segmento recalcula diariamente · filtro na lista de clientes funciona.

**TICKET-041 · Score de risco de falta**
Regras de `01-ESPEC §5.4`, features gravadas em jsonb.
✅ Score ≥ 0,45 exige sinal no booking público · alerta ⚡ aparece na agenda.

---

### SPRINT 4 · Comanda, caixa e estoque (semana 8)

**TICKET-042 · Comanda** 📱💰
Abrir, itens, desconto, gorjeta, fechar.
✅ Soma das partes = total (teste de arredondamento) · fechar congela preço e comissão.

**TICKET-043 · Pagamento da comanda** 💰
Múltiplos métodos, Pix com QR na tela, confirmação em tempo real.
✅ Pagamento parcial suportado · webhook confirma sem refresh manual.

**TICKET-044 · Estoque e ficha de consumo** 📱
Produtos, consumo por serviço, baixa no fechamento, média móvel.
✅ Fechar comanda gera `stock_moves` · estorno gera compensação · nunca deleta movimento.

**TICKET-045 · Alertas de estoque**
Ponto de pedido, dias de cobertura, validade.
✅ Alerta aparece na tela Hoje · job diário.

**TICKET-046 · Comissão simples** 💰
Percentual por serviço/profissional, congelado na linha.
✅ Alterar o percentual depois não muda histórico · extrato por período fecha.

**TICKET-047 · Caixa** 📱💰
Fechamento diário, resumo mensal, composição da receita, lucro real.
✅ "Sobrou" = receita − material − taxa − comissão · pacote não infla receita (reconhecimento por sessão).

**TICKET-048 · Pacotes e carteira** 💰
Venda, saldo, baixa por sessão, validade, crédito.
✅ Sessão consumida baixa saldo · alerta em D-15 do vencimento.

---

### SPRINT 5 · Cofre, LGPD, PWA e endurecimento (semanas 9–10)

**TICKET-049 · Cofre criptográfico** 🔒
Envelope encryption, DEK por tenant, AES-256-GCM, cache de 5 min.
✅ Registro ilegível no banco · chave errada não descriptografa · teste de rotação de versão.

**TICKET-050 · Anamnese por vertical** 📱🔒
Formulário do pack, perguntas condicionais, alerta em claro (`has_alert` + rótulo).
✅ Alerta aparece no topo da ficha e no card do próximo atendimento · detalhe só ao abrir, com log.

**TICKET-051 · Consentimentos e assinatura** 🔒
Três consentimentos separados, assinatura no dedo, hash do texto, IP, revogação.
✅ Revogar imagem esconde a foto do portfólio imediatamente · hash confere.

**TICKET-052 · Fotos antes/depois** 📱🔒
Upload com strip de EXIF, bucket privado, signed URL 5 min, comparador.
✅ URL expira · EXIF ausente no arquivo salvo · acesso registrado.

**TICKET-053 · Trilha de acesso ao cofre** 📱🔒
Tela visível para o dono.
✅ Toda leitura aparece com quem, quando, IP.

**TICKET-054 · Direitos do titular** 🔒
Exportação (JSON+PDF), correção, eliminação em 3 estágios, job de retenção.
✅ Eliminação apaga cofre e mídia de verdade e preserva o registro fiscal sem vínculo pessoal.

**TICKET-055 · PWA e offline** 📱
Manifest, service worker, cache do app shell, fila de mutações, resolução de conflito.
✅ Modo avião: agenda abre e agendamento entra na fila · ao voltar, sincroniza em ordem · 409 vira card de resolução.

**TICKET-056 · Push notification** 📱
Web Push com VAPID; instrução de instalação para iOS.
✅ Lembrete chega no PWA instalado.

**TICKET-057 · Endurecimento final** 🔒
CSP com nonce, HSTS, headers de segurança, scrubbing do Sentry, rate limit global, varredura ZAP.
✅ securityheaders.com nota A · teste que injeta PII no Sentry confirma redação · OWASP Top 10 sem achado alto.

**TICKET-058 · Observabilidade e prontidão**
`/api/health`, alertas, runbook de incidente, teste de restauração de backup documentado.
✅ Restauração testada e registrada com data · alertas disparam em simulação.

---

### Ordem de dependência (resumo)

```
001→002→003→004→005→006→007
                    ↓
     008→009→010→011→012  (base de plataforma)
                    ↓
              013→014      (UI)
                    ↓
   015→016→017→018→019     (cadastros)
                    ↓
        020→021→022→023→024→025   (agenda)
                    ↓
   026→027 ─┐
   028→029→030    (mensageria)
   031→032→033→034 (dinheiro)
                    ↓
        035→036→037→038→039→040→041  (ciclo)
                    ↓
        042→043→044→045→046→047→048  (financeiro)
                    ↓
        049→050→051→052→053→054      (cofre/LGPD)
                    ↓
              055→056→057→058
```


---

