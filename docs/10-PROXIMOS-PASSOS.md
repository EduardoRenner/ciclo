# 10 · Próximos passos (pós-plataforma)

**2026-08-20.** Todas as fases de `09-PLATAFORMA.md` §15 (P−1 a P11) estão resolvidas: feitas,
parciais por decisão consciente, ou bloqueadas por decisão de negócio real. P4 (onboarding) foi
o achado mais importante da revisão — sem ele, todo o catálogo multi-profissão era inacessível
no cadastro; corrigido no mesmo dia (TICKET-072).

Este documento é o que vem depois: não é mais "ampliar o produto", é **verificar que o que foi
construído aguenta gente de verdade**, e depois voltar a ampliar com base no que faltar.

---

## 1. Verificação estrutural (VERIFICACAO-FINAL.md)

O checklist universal de 15 gates criado no início desta sessão (`C:\Users\Usuario\.claude\code\VERIFICACAO-FINAL.md`)
nunca rodou contra o CICLO de ponta a ponta — só pedaços foram tocados de passagem (RLS, testes,
migrations) como parte de cada fase, nunca como auditoria dedicada. Sequência recomendada,
cada uma cabendo numa iteração do loop:

- **V1 — Gates 0-4** (repositório/higiene, build/lint, testes automatizados, config/segredos,
  banco/RLS). Boa parte já está coberta pela disciplina desta sessão (RLS sempre testado,
  `pnpm verify` rodado a cada commit) — o valor aqui é confirmar formalmente, não descobrir do
  zero.
- **V2 — Gate 5** (segurança de aplicação: auth/autorização, injeção, CSP/headers, abuso/custo).
  CSP com nonce já existe (`src/middleware.ts`); vale conferir contra a lista de armadilhas do
  Anexo A do checklist.
- **V3 — Gate 6** (fluxos de negócio ponta a ponta: jornada principal, pagamento, mensageria,
  painel). Pagamento não se aplica ainda (Asaas bloqueado, P11) — mas os outros três sim, e boa
  parte já foi testada ao vivo nesta sessão fase a fase; falta o passe formal comparando contra
  o checklist.
- **V4 — Gates 7-10** (interface/conteúdo/acessibilidade, responsividade, performance,
  SEO/compartilhamento). Ainda não verificado nesta sessão.
- **V5 — Gates 11-14** (observabilidade/resiliência, legal/LGPD, deploy/pós-deploy, entrega ao
  cliente). **Antes de V5:** confirmar se o CICLO está de fato publicado (há projeto Vercel
  linkado — `starkinovacoes/ciclo` — mas `NEXT_PUBLIC_APP_URL` local aponta pra `localhost:3000`
  e não há remoto git configurado). Se não estiver no ar, gates 13/14 ficam ➖ justificados até
  a decisão de publicar ser tomada — não é trabalho técnico, é decisão do Eduardo.

## 2. Verificação de design (DESIGN-E-INTERFACE.md)

O companheiro do checklist acima (`C:\Users\Usuario\.claude\code\DESIGN-E-INTERFACE.md`) também
nunca rodou dedicado contra o CICLO — só `08-REDESIGN-E-IDENTIDADE.md` (Parte I, already ✅) tratou
disso, e antes da virada multi-profissão. Vale conferir se as telas novas desta sessão (série de
recorrência, orçamento, seletor de modelo de preço, busca de profissão no onboarding) seguem os
mesmos tokens/animação/copy do resto do produto — foram construídas rápido, sob o loop, sem o
mesmo nível de escrutínio visual que o resto já recebeu no `08`.

## 3. Backlog conhecido (não é trabalho novo — é o que já ficou registrado)

Tudo abaixo já está em `09-PLATAFORMA.md` §19, listado aqui só pra não se perder no meio de 15+
entradas:

| Item | Por que ainda não foi feito |
|---|---|
| Preço de faxina/eletricista confirmado com gente da área | P5 usou conhecimento geral, sem WebSearch na sessão |
| Tela de gestão de séries de recorrência (P7) | UI que só faz sentido com tenant de verdade usando |
| Tela de gestão de orçamentos (P8) | mesma razão |
| Converter orçamento aprovado em agendamento (P8) | decisão de UX de como escolher data/hora |
| Extensão automática do horizonte de séries (P7) | precisa de cron, não construído |
| Fotos/galeria na página pública (P6) | precisa de desenho de consentimento LGPD primeiro |
| Instrumentação do funil de onboarding (P4/§13.2) | sem tráfego real ainda pra medir |
| Marca única vs. marca recortada por nicho (§8/§13.1) | decisão comercial do Eduardo |
| Projeto Supabase próprio pra dev (§1.1) | decisão de custo do Eduardo |

## 4. O que só o Eduardo decide (não vira tarefa de loop)

- Preço de cada plano e o que libera (§13).
- Publicar o CICLO de verdade (domínio, Vercel) ou continuar em desenvolvimento.
- Segunda profissão-alvo comercial depois da beleza.
- Credenciais Asaas (P11).
- Nome do produto continuar CICLO ou mudar.

---

**Ordem sugerida pro loop:** V1 → V2 → V3 → V4 → (decisão de publicar) → V5, intercalando com
qualquer achado real que apareça no caminho — o padrão desta sessão inteira foi auditar antes
de construir, e registrar bloqueio real em vez de fingir que resolveu. Continua valendo.
