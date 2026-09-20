# Experiments — CICLO

> Estrutura: hipótese → evidência → mudança → métrica primária → métricas secundárias → risco →
> critério de sucesso. Experimentos de alto risco (preço, cobrança, contrato, dado sensível,
> produção crítica) exigem aprovação explícita antes de implementar — os demais seguem a autonomia
> concedida pelo usuário em 2026-09-20.

---

## EXP-01 · Consulta de funil sobre dado existente (GO-0)

- **Hipótese:** existe uma etapa específica do funil cadastro→ativação→retenção onde a maioria dos
  tenants para, e hoje ninguém sabe qual é.
- **Evidência que motivou:** `funnel.md` — confirmado que `tenants`, `appointments`,
  `cycle_predictions` já têm o dado necessário; zero consulta rodada até agora.
- **Achado ao tentar executar, mais valioso que o script em si:** a ferramenta **já existe** —
  `scripts/metricas-ativacao.mjs`, já mede exatamente isto (ativação, 1º agendamento, "momento aha"
  via página pública, retenção 30/90 dias, sinais de churn), e já tem um guard sofisticado que
  detecta e avisa quando os números vêm de seed em vez de uso real. Não havia necessidade de
  construir nada novo — GO-0 já estava feito antes desta pesquisa começar.
- **Bloqueio encontrado ao rodar:** `.env.local` deste ambiente aponta para
  `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` com `NEXT_PUBLIC_APP_ENV=local` **[FACT,
  verificado 2026-09-20]** — Supabase local via Docker, não iniciado nesta sessão (`ECONNREFUSED`).
  Isso **contradiz o comentário no cabeçalho do próprio script**, que afirma "`.env.local` deste
  projeto aponta para o Supabase de PRODUÇÃO" — comentário desatualizado, não mais verdadeiro neste
  ambiente. Mesmo se o Supabase local fosse iniciado, os números resultantes seriam de tenants de
  seed (`docs`/memória: "ambiente local funcionando", 6 salões semeados) — o próprio guard do
  script (`cheiroDeSeed`) confirmaria isso e invalidaria a leitura para o propósito de medir uso
  real.
- **Por que não troquei as credenciais para apontar à produção:** rodar um script com
  `service_role` (que ignora RLS) contra o banco de produção é uma categoria de risco diferente de
  leitura via navegador com login demo — é acesso direto, automatizado, com credencial elevada, a
  dado real de tenants reais. A convenção já estabelecida nesta sessão (fase anterior) é nunca
  tocar produção diretamente fora de teste via navegador. Decidi tratar "trocar `.env.local` para
  produção e rodar" como fora da autonomia concedida para pesquisa de mercado — é uma ação sobre
  infraestrutura/acesso a dado real de cliente, não uma decisão de produto ou pesquisa externa.
- **Métrica primária (não obtida):** taxa de conclusão de onboarding, taxa de 1º agendamento em
  7/14/30 dias, taxa de 1ª previsão do Motor resolvida — por coorte semanal de cadastro.
- **Risco:** baixo para RODAR o script como está (é leitura); médio-alto para reconfigurar o
  ambiente para apontar a produção sem confirmação explícita — por isso não fiz essa parte.
- **Critério de sucesso:** não atingido nesta rodada.
- **Status:** **bloqueado, não por falta de ferramenta — a ferramenta é boa — mas por falta de
  acesso seguro a produção nesta sessão.** Registrado como pendência explícita para o usuário:
  rodar `node scripts/metricas-ativacao.mjs` com as credenciais de produção (ou iniciar
  `supabase start` local sabendo que o resultado será sobre dado de seed, não uso real) é a
  ação de maior alavancagem disponível para todo o resto deste documento de oportunidades — mas
  precisa ser feita por alguém com acesso já configurado corretamente, ou com autorização explícita
  para eu reconfigurar o ambiente.

---

## Template para o próximo experimento

```
## EXP-NN · <nome curto>

- **Hipótese:**
- **Evidência que motivou:** (referência a growth-opportunities.md/market-intelligence.md/etc.)
- **Mudança:**
- **Métrica primária:**
- **Métricas secundárias:**
- **Risco:** baixo | médio | alto (alto = precisa aprovação explícita antes de implementar)
- **Critério de sucesso:**
- **Status:** identificado | implementado | medido | aprendizado registrado
```
