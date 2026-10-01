# 92 · Plataforma de dados e decisão para negócios de relacionamento recorrente (v2)

Reescrito em 2026-09-30 depois de estudar a arquitetura da Palantir Foundry. Números marcados
**(estimativa)** são meus, não medidos. Fontes no fim. Complementa `docs/91`.

## 1. A tese (agora sem limite de nicho)

O CICLO deixa de ser "sistema de salão" e vira a **camada de decisão de qualquer negócio que vive de
relação recorrente**: quem precisa saber **quando a próxima ocorrência deveria acontecer, quem está
atrasado, quanto isso vale e o que fazer a respeito**. Pode ser o cliente que volta (barbearia, pet,
clínica, academia, limpeza) ou a entrega que **nós devemos** (relatório mensal, manutenção, aula, visita
técnica, renovação de contrato).

Cada recomendação vira uma **ação governada**, cada ação gera **resultado medido**, e cada resultado
melhora a próxima decisão, **no negócio e em todos os outros, cruzados entre si**.

## 2. Como a Palantir estrutura (o que aprendi) e o que vira CICLO

A Foundry é uma pilha de cinco camadas sempre conectadas (Conectar, Pipeline, Ontologia, Aplicações, IA)
com quatro preocupações transversais: linhagem, segurança, cenários e retorno de dados (*writeback*).

| Camada/ideia da Palantir | O que faz | Equivalente hoje no CICLO | O que construir |
|---|---|---|---|
| **Conectar** | Conectores para ERP, CRM, planilha, API, fluxo em tempo real, com linhagem desde a entrada | Importação de planilha, Mercado Pago, e-mail | Conectores: exportação de AppBarber/Belasis, Google Agenda, Pix, Sheets, API/webhook aberta |
| **Pipeline** | Limpa, padroniza e prepara o dado (visual e código) | Hash de telefone, serviço canônico (0097), normalização de datas | Deduplicação, qualidade do dado, dicionário de dados, regras de padronização |
| **Ontologia** | Objetos + vínculos + ações = gêmeo digital da operação | Tabelas do banco e ferramentas `preparar_*` | Ontologia genérica com "pacotes" por vertical (seção 3) |
| **Funções/Lógica** | Regras e modelos atrelados à ontologia | `src/core/` (funções puras) | Registro de modelos com versão e monitoramento de deriva |
| **Aplicações** | Telas operacionais que leem e **escrevem** na ontologia | Hoje, Recuperar, assistente | **Central de Decisões**, áreas por papel |
| **IA (AIP)** | Agentes que usam os objetos e as ações, sob as mesmas permissões | Assistente determinístico (18 ferramentas) | Agente que só **propõe** ações, sempre com confirmação; linguagem natural opcional |
| **Linhagem** | Rastreia de onde veio cada dado e cada transformação | `audit_log`, previsão append-only | "De onde vem este número?" clicável em toda tela |
| **Segurança** | Marcas de dado que **viajam** com os derivados e controle por finalidade | RLS por salão, dado de saúde cifrado | Marcas (contato, financeiro, saúde) que se propagam, e **finalidade** (retorno, benchmark, treino) amarrada ao consentimento |
| **Cenários** | Ações e simulações em sandbox antes de valer | Dial de autonomia, "e se" do assistente | Gêmeo digital com cenários comparáveis |
| **Writeback** | Toda ação e feedback vira dado novo | Atribuição, pontos automáticos | Resultado de cada decisão grava de volta, fecha o ciclo |
| **Implantação (Apollo)** | Entrega contínua e segura | Vercel | Mantém |
| **Engenheiro de implantação (FDE)** | Gente dentro do cliente para modelar o negócio | (não existe) | **Implantação assistida** como serviço: modelar a ontologia do negócio e ligar os conectores |

O ponto de marketing que vem daí: a Palantir vende "sistema operacional de decisão". O CICLO vende o
mesmo para o **pequeno negócio**, com implantação assistida barata e o motor pronto.

## 3. A ontologia genérica (serve para qualquer recorrência)

Objetos neutros, que cada vertical "veste" com vocabulário próprio (já existe mecanismo de vocabulário por
profissão e pacotes de vertical):

| Objeto genérico | Barbearia | Clínica/psicólogo | Contabilidade/consultoria | Academia | Limpeza/manutenção |
|---|---|---|---|---|---|
| **Conta** (quem recebe) | Cliente | Paciente | Empresa cliente | Aluno | Residência/empresa |
| **Oferta** | Corte | Sessão | Fechamento mensal | Plano/aula | Visita |
| **Ocorrência** | Atendimento | Consulta | Relatório entregue | Treino | Serviço feito |
| **Cadência** | A cada 18 dias | Semanal | Todo dia 10 | 3×/semana | Quinzenal |
| **Capacidade** | Hora de cadeira | Hora de agenda | Horas da equipe | Vagas na turma | Rota do dia |
| **Compromisso** | Clube/assinatura | Pacote | Contrato mensal | Mensalidade | Contrato |
| **Comunicação** | Mensagem | Lembrete | Envio do relatório | Aviso | Confirmação de rota |

**Duas direções da mesma cadência (a generalização central):**
- **Cadência do cliente:** "quando ele deveria voltar" e está atrasado → risco de perder.
- **Cadência nossa (obrigação):** "quando nós deveríamos entregar" e está atrasado → risco de quebrar
  o combinado (relatório não enviado, visita não feita). É o mesmo motor, sentido inverso.

**Ações genéricas:** ChamarDeVolta, EntregarAgora, OferecerVaga, PedirConsentimento, Reagendar,
CobrarRenovação, AbrirCapacidade, AjustarPreço. Cada ação tem permissão, nível do dial de autonomia,
auditoria e retorno (writeback).

## 4. Privacidade: tudo junto, sem célula mínima, e onde ainda existe limite

Você pediu para tudo se cruzar, sem mínimo de grupo. Dá para fazer, separando **aprender** de **mostrar**:

**Aprender (sem mínimo, tudo junto):**
- Um **único modelo global** treinado com linhas de atributos de **todos** os negócios e verticais,
  onde o nicho é só um atributo a mais. Nada de células.
- Hierarquia de nichos (recorrência, depois vertical, depois subnicho, depois região) com **encolhimento
  hierárquico**: um subnicho com 1 negócio só herda do nível acima. Isso dispensa o mínimo por célula,
  porque o próprio modelo lida com grupo pequeno.
- As linhas que alimentam o modelo **não têm identificação**: sem nome, telefone, e-mail, texto livre;
  datas em janelas; o negócio vira código aleatório. É o padrão da LGPD para dado anonimizado (perde a
  possibilidade de associação a um indivíduo com meios razoáveis), **mas exige avaliação documentada e
  advogado**, porque ela vira dado pessoal de novo se for reversível com esforço razoável.
- Dado de saúde nunca entra.

**Mostrar (aqui continua existindo um limite, por um motivo técnico, não burocrático):**
- Se a tela mostrar "a média do seu nicho" e só existe **um** negócio naquele nicho, a "média" é o dado
  dele, e você estaria expondo um concorrente a outro. Por isso o que aparece para o cliente é sempre o
  **nível mais fino que já reúna vários negócios**, subindo a hierarquia automaticamente. Sem burocracia
  de tamanho fixo: o sistema sobe sozinho até ter base.
- O modelo entrega **recomendação para o seu negócio**, nunca o dado de outro.

**Consentimento:** o negócio aceita participar do aprendizado comum (termos), e pode sair. Cláusula já
redigida, **aguardando advogado**.

## 5. O que se cruza (o grafo de cruzamentos)

Tudo vira atributo de tudo. Exemplos de cruzamentos que o motor passa a explorar:
- Ritmo × vaga × risco de falta × margem × profissional → **casamento de vaga com quem volta**.
- Preço × demanda × retenção → elasticidade por serviço e horário.
- Origem do cliente × resposta × valor de vida → onde investir em aquisição.
- Profissional × cliente × serviço → quem fideliza quem.
- **Sinais externos:** feriado, semana de pagamento, clima, datas comerciais, calendário escolar, eventos
  locais → demanda e retorno.
- **Entre verticais:** a forma da curva de retorno e de cancelamento se repete entre negócios de
  recorrência (aprendizado transferido). Barbearia ensina pet, e vice-versa.
- Comunicação × consentimento × bloqueio → orçamento de atenção por pessoa.
- Obrigações nossas × atraso × satisfação → risco de perder contrato.

## 6. Módulos que a plataforma deve englobar

1. **Conectores** (planilha, exportações de sistemas concorrentes, Google Agenda, Pix, API e webhook abertos).
2. **Pipeline de qualidade** (deduplicação, padronização, dicionário de dados, serviço canônico).
3. **Ontologia por vertical**, editável e versionada, com pacotes prontos.
4. **Motor de ciclo e de obrigação** (as duas direções da cadência).
5. **Motor de previsão** (ativo/perdido, sobrevivência, risco de falta, demanda), com **placar de acerto**.
6. **Motor de decisão** (quem, quando, o quê, por qual canal, a que oferta), por **lucro incremental**.
7. **Plataforma de experimentos** (controle atrasado, A/B, bandido bayesiano, uplift).
8. **Modelo hierárquico global** e **registro de modelos** (versão, erro, deriva).
9. **Central de Decisões** (fila do dia com explicação, aprovar/editar/ignorar).
10. **Cenários e gêmeo digital** (simula antes de valer, faixa pessimista/provável/otimista).
11. **Automação por gatilho** ("quando X acontecer, proponha Y"), com o dial de autonomia.
12. **Linhagem e explicação** ("de onde vem este número", "por que recomendei").
13. **Governança**: marcas de dado que viajam, finalidade de uso, auditoria, consentimento com prova.
14. **Canal de saída** (WhatsApp oficial via BSP, e-mail, push, relatório em PDF/link).
15. **Benchmark e receitas** por nível da hierarquia (com a regra de "mostrar" acima).
16. **Análise livre em português** (assistente): "me mostre os clientes que caíram de frequência".
17. **API e exportação** (o dono leva tudo embora, como já existe).
18. **Implantação assistida** (o "engenheiro dentro do cliente" em versão barata).
19. **Modelo de cobrança por resultado** quando a medição for sólida.

## 7. Estrela do norte e métricas
**Lucro incremental comprovado por negócio por mês.** Apoio: clientes recuperados a mais, obrigações
entregues no prazo, lucro por vaga, custo por retorno, bloqueio e saída, fidelização em 30/60/90 dias,
erro de previsão. **Do ativo de dados:** negócios, verticais, eventos por dia, cobertura de consentimento,
experimentos concluídos, calibração.

## 8. Fases e portões
| Fase | Entrega | Portão |
|---|---|---|
| P0 | Consentimento, link pessoal, eventos padronizados, ontologia genérica e vocabulário por vertical | Opt-in em 3 negócios |
| P1 | Exposição e resultado, controle atrasado, painel de métricas, linhagem básica | Atribuição por link batendo com a agenda |
| P2 | Central de Decisões, casamento de vaga, orçamento de atenção, ciclo de obrigação (entregas) | Lucro incremental positivo em 3 negócios |
| P3 | Modelo hierárquico global, uplift, bandido, benchmark, conectores | 30 a 50 negócios e cláusula LGPD revisada |
| P4 | Cenários, gêmeo digital, automação por gatilho, implantação assistida, cobrança por resultado | 100 negócios |

## 9. Riscos (incluindo as críticas à Palantir)
- **"Ontologia" sozinha não gera valor:** as críticas à Palantir dizem que o valor vem de decisão e
  retorno de dado, e que a implantação dá muito trabalho humano. Por isso P0 e P1 são enxutos e o valor
  aparece na Central de Decisões, não na modelagem.
- **Generalizar cedo demais dilui o produto:** manter **um vertical forte (beleza)** e abrir os outros
  por pacote, um de cada vez, com um negócio-piloto real em cada.
- **Privacidade:** mostrar só o nível com vários negócios; linhas sem identificação; advogado.
- **Falsa precisão com pouco dado:** mostrar incerteza e amostra, nunca "comprovado".
- **Mensagem e LGPD:** marketing só com consentimento registrado; canal oficial.
- **Complexidade:** não construir P3 e P4 antes de ter negócios.

## Fontes
- Palantir, *Why create an Ontology?*: https://www.palantir.com/docs/foundry/ontology/why-ontology
- Palantir, *Platform overview*: https://www.palantir.com/docs/foundry/platform-overview/overview
- Arquitetura em cinco camadas: https://ontologyaimap.com/en/palantir-foundry-architecture-overview-2/
- Ontologia em produção (objetos, vínculos, ações): https://dev.to/kaviwrites/designing-a-palantir-foundry-ontology-that-holds-up-in-production-object-types-link-types-and-5gel
- Agentes, ações e cenários (AIP): https://zerofuturetech.substack.com/p/palantir-aip-agent-ontology-interaction
- Segurança: marcas e acesso por finalidade: https://www.palantir.com/docs/foundry/security/protecting-sensitive-data
- Engenheiro de implantação e gêmeo digital: https://getperspective.ai/blog/palantir-forward-deployed-engineering-playbook-anthropic-openai-copying
- Crítica à ontologia: https://vonng.com/en/db/ontology-bullshit/ e https://www.lokad.com/review-of-palantir-com/
- Dado de moat em SaaS vertical: https://www.thefoundersreport.com/the-vertical-saas-moat-in-2026-is-proprietary-data-not-agent-features
- Incrementalidade e hierarquia bayesiana: https://towardsdatascience.com/marketing-incremental-lift-test-101-f2983af1da8e/ e https://sites.stat.columbia.edu/gelman/research/published/HierarchicalCausal.pdf
- LGPD art. 12: https://www.jusbrasil.com.br/topicos/200399120/artigo-12-da-lei-n-13709-de-14-de-agosto-de-2018
