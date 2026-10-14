# C-016 · Dano vivo: trabalho pronto que nunca chegou à main

**F1 · Objetivo:** o C-015 achou uma funcionalidade inteira parada numa branch local. Medir quantas
mais existem. Número: funcionalidades confirmadas fora da main, por conteúdo (não por título).

**F2 · Método:**
- `git cherry` (identidade de patch) INFLA: a main recebeu muito trabalho em squash ("pilha de 126
  commits", 12d338a0), e tudo aquilo aparece como faltando.
- Régua usada: `git merge-tree --write-tree origin/main <branch>` simula o merge sem tocar em nada; conta
  os arquivos que ele mudaria. Depois, marca distintiva de cada funcionalidade procurada na main
  (`git grep`) e arquivo novo da branch que não existe na main (`git cat-file -e`).

**F3 · Resultado (só as branches locais, sem cópia no GitHub; perde-se se o disco se perder):**

| Branch local | Arquivos que o merge mudaria | O que está FORA da main (por conteúdo) |
| --- | --- | --- |
| `loop/integracao-final` (rodadas 1–30, 22/09) | 104 | **rampa de aquecimento do WhatsApp** (`core/messaging/rampa-whatsapp.ts`, docs/74); **X-Powered-By** (portado neste ciclo); `confianca-da-amostra`, `registro` de provedores de mensageria, `limite-de-pixels`, `opcao-inicial`, `servico-inicial`, `preco-sugerido`, tipos de pagamento; uma OUTRA `0092_amostra_de_historico_do_ciclo.sql` (número já usado na main) |
| `noite/2026-09-27` | 48 | **painel de demonstração do dono** (`[slug]/agendar/demo-dono/`, 6 negócios em JSON, telas Hoje/Recuperar simuladas); `recorte-de-hoje`, `resumo-do-dia` puros |
| `melhoria/orcamento-e-motor-2026-09-27` | 33 | ritmo na fila (reimplementado no C-015) |
| `fix/motor-nao-esquece`, `melhoria/onboarding-inteligencia`, `feat/cortesia-prelancamento` | 114–122 | BL-42/46/48, Motor de Inteligência, cortesia: **já na main por conteúdo** (marcas presentes); o que sobra são diferenças de versão, não funcionalidade órfã |
| `lucro/custo-que-o-ciclo-inventou` | 20 | 0069 e o "Sobrou": já na main por conteúdo |

**F4 · Feito neste ciclo:** `poweredByHeader: false` + a guarda original (`config-nao-anuncia-a-stack`),
portados de aac4d356. O app anunciava "Next.js" em toda resposta (medido em produção em 21/09).

**F5 · Medida:** funcionalidades órfãs confirmadas por conteúdo: 3 grupos (rampa do WhatsApp e a pilha
do loop de 22/09; demo do dono; ritmo na fila, já resolvido). 1 portado aqui, 1 no C-015.

**Prioridade para o Eduardo (registrada, não bloqueia):**
1. **Rampa do WhatsApp antes do lançamento:** número novo mandando volume sem aquecimento é o caminho
   mais curto para bloqueio. Portar exige revisão própria (mexe em `mensageria.ts`).
2. **Empurrar as branches locais para o GitHub** (sem PR), só como cópia de segurança: hoje 137+110+104
   commits existem num disco só. Push de branch é ação remota: fica para o Eduardo decidir.
3. Demo do dono: decidir se ainda faz parte da landing.

**Nota:** cliente 6 · segredo 5 · engenharia 8. **Próximo (C-017):** banco do automotivo se o Docker
voltar; senão portar a rampa de aquecimento do WhatsApp (core puro primeiro, `rampa-whatsapp.ts`, com
os testes dela), sem ligar no envio até revisão.
