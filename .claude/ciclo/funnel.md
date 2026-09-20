# Funnel — CICLO

> Mapeamento do funil de crescimento. **Achado mais importante deste arquivo não é uma etapa — é a
> ausência de instrumentação**: confirmado por leitura de código (`package.json`, `src/**`) que o
> CICLO não tem NENHUM SDK de analytics de produto — nem Google Analytics, nem PostHog/Mixpanel/
> Amplitude, nem sequer o `@vercel/analytics` nativo da própria plataforma de hospedagem
> **[FACT, verificado 2026-09-20]**. Isso já era conhecido (`docs/09-PLATAFORMA.md` §0.5, decisão
> deliberada de não rastrear usuário por privacidade/LGPD) — mas tem um custo que este documento
> tem que dizer sem rodeio: **quase todo número abaixo é UNKNOWN, não porque ninguém mediu, mas
> porque não existe onde medir.**

```
VISITOR
  ↓  UNKNOWN (sem analytics de tráfego)
LANDING VIEW
  ↓  UNKNOWN
CTA ("Criar minha conta grátis")
  ↓  UNKNOWN
SIGNUP
  ↓  MENSURÁVEL NO BANCO (contagem de tenants criados) — não consultado nesta rodada, ver nota
ONBOARDING
  ↓  MENSURÁVEL NO BANCO (tenant criado sem nenhum serviço/cliente = abandonou no onboarding)
ACTIVATION
  ↓  MENSURÁVEL NO BANCO (primeiro agendamento concluído)
FIRST VALUE
  ↓  MENSURÁVEL NO BANCO (primeira previsão do Motor de Ciclo resolvida)
RETURN
  ↓  UNKNOWN (não há definição operacional de "usuário retornou" instrumentada)
RETAINED USER
  ↓  UNKNOWN
PAYING CUSTOMER
  ↓  MENSURÁVEL NO BANCO (`tenants.plan != 'gratis'`) — hoje é ZERO **[FACT]**, não há nenhum
     tenant pagante em produção ainda (confirmado em `docs/43`: "Zero pagantes [M]")
EXPANSION
  ↓  UNKNOWN
REFERRAL
  ↓  MENSURÁVEL NO BANCO (tabela de indicação já existe, `docs/30`) — volume não consultado
```

---

## 1 · O que É mensurável hoje, sem instrumentar nada novo

Estas etapas já têm o dado no banco — só falta ALGUÉM RODAR A CONSULTA, não construir
infraestrutura nova:

| Etapa | Onde mora o dado | Consultado nesta rodada? |
|---|---|---|
| Signup (conta criada) | `auth.users` / `memberships` | Não — **UNKNOWN**, oportunidade de baixo esforço |
| Onboarding completo | `tenants` com `slug`/`vocabulario` preenchidos (o formulário de 3 respostas) | Não — **UNKNOWN** |
| Ativação (primeiro agendamento concluído) | `appointments.status = 'done'`, primeira ocorrência por tenant | Não — **UNKNOWN** |
| Primeira previsão do Motor resolvida | `cycle_predictions.resolved_at` | Não — **UNKNOWN** |
| Clientes pagantes | `tenants.plan` | **Sim, já sabido: zero** **[FACT]**, `docs/43` |
| Indicação (convite entre donos) | `docs/30-INDICACAO-PLANO.md`, laço B2B | Não — **UNKNOWN** |

**Isto é a oportunidade de maior alavancagem deste documento inteiro** — e a ferramenta para isso
**já existe e já está pronta**: `scripts/metricas-ativacao.mjs`, que já cobre exatamente estas
etapas (ativação, 1º agendamento, "momento aha", retenção 30/90 dias, sinais de churn), com um
guard que detecta quando o resultado é seed em vez de uso real. Não é preciso construir nada.

**O que falta não é construir, é RODAR com acesso a produção.** Tentei executar nesta sessão
(2026-09-20) e `.env.local` deste ambiente aponta para Supabase local (`127.0.0.1:54321`), não
iniciado — o comentário no script que diz "aponta para produção" está desatualizado para este
ambiente. Decidi não reconfigurar credenciais de produção autonomamente (ver `experiments.md`
EXP-01, raciocínio de risco completo). **Esta é a ação de maior valor que falta neste documento
inteiro, e depende de alguém com acesso já configurado — não de mais pesquisa.**

## 2 · O que genuinamente exige instrumentação nova

Aquisição (de onde vêm os visitantes) e comportamento pré-cadastro (o que fazem na landing antes
de decidir) não têm NENHUMA fonte de dado hoje — nem no banco, nem em ferramenta externa. Construir
isso é uma decisão deliberada (custo de engenharia + decisão de privacidade/LGPD sobre o que
rastrear de visitante anônimo) e está registrada como oportunidade separada, não pré-requisito
para as outras.

## 3 · Por que isto não bloqueia o resto da missão

A pergunta mais valiosa agora não é "quantos visitantes viram a landing" — é "de quem JÁ se
cadastrou, quantos chegaram a usar de verdade, e onde pararam". Essa pergunta é respondível HOJE
com o dado que já existe. Aquisição de topo de funil só importa depois que ativação/retenção
estiverem validadas — gastar esforço em rastrear tráfego antes disso otimizaria a etapa errada
primeiro.
