# 55 · O QUE FALTA PARA RODAR — TÉCNICO E NEGÓCIO

> **Contexto.** O `docs/31-LANÇAMENTO-AUDITORIA-E-PLANO.md` fez este exercício em 2026-08-30. Uma
> semana depois, boa parte mudou (`/termos` e `/privacidade` foram ao ar, o Motor de Ciclo foi
> consertado, 30+ PRs entraram). Este documento **reconfere ao vivo**, não repete o antigo — e cita
> ele quando a resposta continua igual.
>
> **Dois relógios diferentes, e a confusão entre eles é o erro mais caro que dá para cometer aqui:**
> o **código** está pronto para muito mais do que o **negócio** está pronto para vender. Misturar os
> dois faz alguém "terminar" o produto e descobrir que ainda não dá para cobrar de ninguém — ou
> abrir a cobrança e descobrir que o produto tem um buraco que ninguém tapou.

---

# 1 · O estado, medido agora (2026-09-06)

| Pergunta | Resposta | Como sei |
|---|---|---|
| Dá para cobrar de alguém hoje? | **Não.** Zero integração de PSP no código | `grep -rn asaas src` devolve vazio; `.env.example` tem os campos `ASAAS_*` como esqueleto, nunca preenchidos |
| WhatsApp está ligado? | **Não.** | `cron.yml`: as linhas de `reminders`/`campaigns` continuam **comentadas** |
| As migrations mais recentes estão em produção? | **Não.** | `0066` a `0072` (taxa de pagamento, custo fixo, série mensal) não aplicadas — mesmo problema que já aconteceu uma vez com `0059`-`0061` e virou incidente documentado (`docs/DECISOES.md`, 2026-09-05) |
| Existe CNPJ / domínio próprio / contrato de termos revisado por advogado? | **Não verificável no código** — decisão e trâmite são do Eduardo, fora do repositório |
| O produto tem cliente pagante? | **Não.** Só contas de demonstração (`demo-*`, `dom-rocha`) | `seed-demo-6-negocios.mjs` e o histórico de commits recentes |
| A base de código é estável? | **Relativamente, com ressalva.** 30+ PRs em 4 dias, um deles crítico (CSP quebrando JS em produção), vários bugs de dinheiro (insumo a R$0, estoque descontado 2×) | histórico de commits desta semana |
| Existe RLS/segurança madura? | **Em geral sim, com um buraco conhecido.** `tickets`/`ticket_items` não restringem por profissional na política de banco — descoberto e documentado nesta sessão (`docs/DECISOES.md`, 2026-09-06) | auditoria feita hoje |

---

# 2 · Parte técnica — o que falta, em ordem de bloqueio

## Fase 0 · Destravar o que já devia estar no ar (1-2 dias, sem decisão de ninguém)

1. **Aplicar as migrations `0066`-`0072` em produção.** Sem isso, boa parte do que foi construído
   esta semana (taxa por forma de pagamento, custo fixo, série mensal de lucro) está no código e
   **não no banco** — `compararSchema` vai acusar isso assim que alguém rodar `/api/health`.
2. **Fundir a fila de PRs abertos** (#74 a #79 no momento em que escrevo isso) — cada um sozinho é
   pequeno, mas empilhados eles são a diferença entre "o Motor de Ciclo aprende com os próprios
   erros" estar no ar ou não.
3. **Construir a Action que aplica migration automaticamente antes do deploy.** Hoje isso é manual,
   e já causou um incidente real (`docs/62`, 2026-09-04): código dependendo de coluna que a
   produção não tinha. `docs/runbooks/aplicar-migrations-pendentes.md` documenta o processo manual
   — automatizar isso é o que impede o próximo incidente igual.

## Fase 1 · Poder vender (bloqueia qualquer receita — é o item que mais importa)

4. **Integração de PSP.** O esqueleto de env var (`ASAAS_*`) existe, o código não. Isto é o
   trabalho de verdade: criar cobrança recorrente, webhook de confirmação, e ligar o resultado ao
   `tenants.plan` (que já tem escritor, `scripts/promover-tenant.mjs`, construído em 30/08).
5. **Decidir e testar o fluxo de cobrança do sinal (Pix) fim a fim com dinheiro de verdade** — um
   dos quatro pilares do produto (`docs/00-BRIEFING`), e hoje só testado com seed.
6. **Ligar o F0 (WhatsApp).** Precisa de: `WHATSAPP_PHONE_NUMBER_ID`, `ACCESS_TOKEN`, `APP_SECRET`
   reais (conta comercial da Meta — decisão e cadastro são do Eduardo, não código); depois, um
   disparo manual de teste (`workflow_dispatch` já existe no `cron.yml`); só então descomentar o
   `schedule`. As duas travas de segurança (teto diário por tenant, interruptor de pausa) **já
   estão prontas**, esperando o F0 ligar.

## Fase 2 · Não quebrar na frente do primeiro pagante

7. **Fechar o buraco de RLS em `tickets`/`ticket_items`** encontrado hoje — hoje qualquer papel
   (inclusive `professional`/`reception`) pode ler dados financeiros de qualquer colega via chamada
   direta à API do Supabase, contornando o painel. Baixo risco enquanto só existem contas demo;
   vira risco real no primeiro cliente com equipe de verdade.
8. **Resolver por que testes passam verdes com bugs dentro** — pelo menos 7 "guardas cegas"
   documentadas nesta base em auditorias recentes. Isso não é um item, é um processo: todo teste
   novo que varre código (em vez de testar comportamento) precisa ser visto **reprovando** antes de
   ser considerado pronto — a regra já existe no `CLAUDE.md`, o que falta é ninguém pular a etapa
   sob pressão de prazo.
9. **Rodar a suíte de RLS/integração contra um banco de teste de verdade em CI**, não só
   confiar em revisão manual — hoje, sessões de trabalho (inclusive esta) não conseguem rodar
   `test:integration`/`test:rls` localmente porque o `.env.local` do time aponta para o Supabase de
   produção. Ter um projeto Supabase de teste dedicado, ou ao menos documentar isso com clareza
   para quem chegar depois, evita o mesmo susto de novo.

## Fase 3 · Só depois do primeiro sinal real (não adiantar)

10. Apps mobile (Capacitor) — já orçado (~R$140 + R$550-600/ano), mas **decisão consciente foi
    adiar** até domínio/CNPJ/pagamento resolverem (`docs/ciclo-apps-mobile-lojas`).
11. Multi-unidade, integrações de terceiros, features de escala — nada disso importa sem ninguém
    pagando ainda.

---

# 3 · Parte de negócio — o que só o Eduardo decide ou executa

Isto não é código. Nenhuma sessão de IA resolve isto sozinha, e fingir que resolve seria a mesma
mentira que este projeto inteiro existe para evitar.

| # | O quê | Por que trava o resto |
|---|---|---|
| 1 | **CNPJ** | Sem ele não tem como emitir nota fiscal nem abrir conta PJ para receber o PSP |
| 2 | **Domínio próprio** | `seuciclo.com.br` já é a produção real, segundo a memória do projeto — confirmar que está registrado no nome certo e que o DNS não depende de ninguém temporário |
| 3 | **Conta na adquirente/PSP** (Asaas, pelo esqueleto do `.env`) | Sem conta ativa, o item técnico 4 (integração) não tem o que integrar |
| 4 | **Conta comercial do WhatsApp Business API** | Bloqueia o item técnico 6 sozinho — é o único item desta lista que **também** é pré-requisito técnico direto |
| 5 | **Termos de uso e política de privacidade revisados por quem entende de LGPD** | As páginas existem (`/termos`, `/privacidade`), a revisão jurídica de conteúdo é outra etapa |
| 6 | **Preço final decidido** | O plano de monetização (`docs/18`) já tem a pesquisa e a recomendação — falta o "sim, é esse" |
| 7 | **Primeiro cliente real, fora de demo** | Nada disso importa sem alguém pagando de verdade e usando sem ninguém segurando a mão — é o teste que valida (ou derruba) cada suposição do produto |
| 8 | **Canal de suporte** | Quando o primeiro pagante tiver um problema às 22h de sábado, quem responde? |

---

# 4 · A ordem que eu seguiria, se fosse decidir

```
Fase 0 (técnico, sem decisão) ──┐
                                 ├──► Fase 1 código (PSP + WhatsApp)
Decisões 1-6 do Eduardo ────────┘         │
                                           ▼
                                 Fase 2 (RLS + guarda cega)
                                           │
                                           ▼
                          Decisão 7: primeiro cliente real
                                           │
                                           ▼
                             Decisão 8: suporte, ANTES
                             do cliente ligar pela primeira vez
                                           │
                                           ▼
                                    Fase 3 (escala)
```

**O gargalo real não é código.** É a Fase 0 (mecânica, sem decisão) rodando em paralelo com as
decisões 1-4 do Eduardo — o CNPJ e a conta de WhatsApp Business levam dias/semanas por fora do
controle de qualquer sessão de trabalho, então **começar esses trâmites agora** é o item de maior
alavancagem desta lista inteira: enquanto eles tramitam, dá tempo de fazer as Fases 1 e 2 técnicas
inteiras.

---

# 5 · O que eu NÃO incluí, de propósito

- **Nenhuma feature nova.** Todo o backlog de "vantagem competitiva" (docs/52-53) é sobre ficar
  melhor depois de lançar, não sobre poder lançar.
- **Nenhuma reescrita.** O motor central (agenda, comanda, Motor de Ciclo) está pronto o
  suficiente para um primeiro cliente real — o risco não está em fazer mais, está em girar a
  chave sem ter resolvido cobrança, canal e o buraco de RLS.
