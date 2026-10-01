# 94 · Revisão do Motor de Retorno, da plataforma e do Motor Preditivo

Execução do `docs/PROMPT-REVISAO-MOTOR-E-PLATAFORMA.md`, em rodadas. Data: 2026-09-30.
Legenda de confiança das fontes: **[oficial]** documento da Meta/lei; **[fornecedor]** blog ou doc de quem
vende o serviço; **[relato]** terceiro sem vínculo; **(estimativa)** conta minha.

| Bloco | Situação |
|---|---|
| A. Revisão crítica | rodadas 1–3 |
| B. Pesquisa | concluída (rodadas 1–3) |
| C. Arquitetura de dados | rodada 4 |
| D. Funcionalidades | rodada 4 |
| E. Economia | rodada 5 |
| F. Plano de 90 dias | rodada 5 |
| G. Perguntas em aberto | rodada 5 |

---

## 1. Resumo do que muda (final)

1. **Coexistência funciona no Brasil.** O dono conecta o **mesmo número** que já usa no WhatsApp Business
   do celular à API, e continua usando o app. Isso derruba o maior atrito apontado nos docs 91–93.
2. **Mensagem mandada pelo app do dono continua grátis**, mesmo com o número ligado à API. Só a mensagem
   automática (pela API) é cobrada. O "primeiro toque humano" do doc 91 fica **dentro** do canal oficial.
3. **O opt-in por resposta passa a ser capturável.** Com coexistência, a resposta do cliente chega por
   webhook no CICLO. O furo que o doc 91 tinha ("o CICLO não enxerga o 'sim' no WhatsApp pessoal") some.
4. **Existe um teto global de marketing por pessoa** (≈ 2 templates de marketing por dia, somando todas as
   empresas, dinâmico). Campanha de recuperação pode **não ser entregue** a quem já recebe muito
   marketing. O motor precisa tratar esse erro e não contar como envio.
5. **Tech Provider não impede "mensagem incluída no plano":** o Gupshup permite que o Tech Provider use a
   **linha de crédito** dele para os negócios conectados. O CICLO pode ser Tech Provider **e** cobrar o
   plano com a mensagem dentro.
6. **Para marketing por WhatsApp a base legal é consentimento, não legítimo interesse.** O legítimo
   interesse para "cliente antigo" que os docs citavam é usado em e-mail; para WhatsApp as fontes dizem
   opt-in explícito (LGPD art. 7º, I + política da Meta). Base importada sem opt-in não entra no automático.
7. **Ao treinar o modelo global, o CICLO vira controlador** daquele tratamento (não mais só operador do
   salão). Precisa base legal própria, minimização variável por variável e RIPD. Isso é tarefa de advogado
   antes da Fase P3, não depois.
8. **Benchmark entre salões já existe lá fora.** A Phorest entrega relatórios trimestrais comparando o
   salão com o local, o nacional e os melhores, a partir de mais de 11 mil salões. O diferencial do CICLO
   não pode ser "benchmark"; é **decisão + medição causal + previsão auditada**, e ser o primeiro a fazer
   isso no Brasil (não achei concorrente brasileiro com benchmark público).
9. **Preço de mercado no Brasil:** AppBarber R$ 79,90 (1 prof.) e R$ 109,90 (2–5); Trinks a partir de
   R$ 76 com WhatsApp automático **cobrado à parte por mensagem**. R$ 37 é agressivo; R$ 149–199 para
   recuperação precisa ser vendido como resultado, não como sistema.
10. **Ordem de verticais revisada:** depois de beleza, **pet (banho e tosa)**, porque o ritmo e a agenda são
    quase iguais aos de barbearia. Imobiliária e contabilidade ficam para bem depois (produto diferente).

---

## A. Revisão crítica (por gravidade)

### Grave
1. **Doc 91/92 assumem que o dono perde o WhatsApp do celular.** Falso para o Brasil em 2026: a
   coexistência está liberada. O desenho deve ser **coexistência por padrão**, não "número novo por salão".
2. **Atribuição por tempo vira lucro inflado.** O CICLO hoje atribui por tempo (primeiro agendamento em
   30 dias depois da mensagem). Com campanha automática, isso dá crédito a quem voltaria sozinho
   (fontes de fornecedor falam em ~3% de volta espontânea, e para cliente "chegando" é bem mais). Tudo que
   for vendido como "o Motor trouxe R$ X" precisa de **controle**, senão vira promessa sem prova.
3. **Teto de marketing por pessoa não estava no plano.** Com ≈ 2 marketing/dia por usuário somando todas
   as empresas, parte das campanhas falha (erro 131049). O doc 91 conta custo e retorno como se todas
   fossem entregues. Precisa: tratar o erro, não cobrar o salão por mensagem não entregue no teto do
   plano, e preferir **utilidade** quando o conteúdo for de fato informativo (ex.: "abriu horário que você
   pediu para ser avisado" pode ser utilidade **se** for resposta a um pedido do cliente — confirmar regra
   de categoria antes de usar).
4. **Unit economics do doc 91 usam 250 mensagens de marketing/mês por salão sem base.** Não há dado de
   quantos sumidos um salão tem por mês. É a variável que mais mexe na margem do plano de R$ 149–199.
   Precisa vir do piloto, não de palpite.

### Média
5. **Doc 92 v2 promete "zero de mínimo para aprender".** Aceitável para treinar um modelo global com
   linhas sem identificação, **mas** a LGPD (art. 12) só deixa de tratar como dado pessoal se a
   reversão não for possível com esforço razoável. Linha com (cidade pequena + vertical rara + ticket +
   data) pode identificar o **negócio** e às vezes o cliente. Precisa de RIPD/avaliação e advogado (B5).
6. **Doc 93 lista 10 previsões para "F1 em 2 a 3 semanas".** Otimista. A F1 honesta são **3**: receita do
   mês com faixa, vagas sobrando nos próximos 7 dias, e chance de retorno por cliente usando o ritmo que
   já existe. O resto depende de dado que ainda não existe.
7. **Imobiliária como segundo vertical.** Ciclo de venda longo (meses), volume baixo por corretor e
   decisão rara: o motor aprende devagar. Bom exemplo de ontologia, **ruim** como próximo vertical. Ver B8.
8. **"Cobrança por resultado" (doc 92/91).** Exige medição causal sólida por salão, que não existe com
   ~100 sumidos/mês. Deixar para quando houver controle agregado entre muitos salões.

### Leve
9. Doc 91 cita "R$ 0,34 a 0,45" como faixa de marketing. Pela tabela de julho/2026 (US$ 0,0625), em reais
   fica **≈ R$ 0,31 a 0,38** dependendo do câmbio. A faixa de cima vinha de BSP com markup.
10. Doc 92 chama o primeiro contato de "sem risco". Mesmo humano, mandar muitas mensagens iguais pelo app
    gera denúncia. Manter o limite diário e a variação de texto também no modo manual.

---

## B. Pesquisa

### B1. Preço oficial e regras da Meta (Brasil)
| Fato | Valor | Confiança |
|---|---|---|
| Modelo de cobrança | Por mensagem de template entregue (desde 01/07/2025) | [fornecedor], aponta a página oficial `developers.facebook.com/docs/whatsapp/pricing` |
| Marketing, Brasil | US$ 0,0625 (≈ R$ 0,31–0,38) | [fornecedor] citando tabela de 01/07/2026 |
| Utilidade, Brasil | US$ 0,0068 (≈ R$ 0,04–0,05) | idem |
| Serviço (resposta do negócio dentro de 24 h) | Grátis hoje; a partir de 01/10/2026 há relatos de cobrança após cota grátis | [fornecedor], **conferir na página oficial** |
| Quem define o preço | O país do **destinatário** | [fornecedor] |
| Teto por pessoa | ≈ 2 templates de marketing/dia somando todas as empresas, dinâmico; erro 131049 | [fornecedor: Infobip, Gupshup, outros] |
| Utilidade e serviço | Não entram no teto de marketing | [fornecedor] |

**Ação:** antes de fixar preço de plano, abrir a página oficial de preços e anotar data e câmbio.

### B2. BSP/ISV e "mensagem incluída no plano"
- **Solution Partner** tem linha de crédito e a estende ao negócio, sem o negócio cadastrar cartão
  [fornecedor: Gupshup partner docs].
- **Tech Provider dentro do Gupshup** pode continuar usando a linha de crédito do Gupshup, com API para
  "verificar e anexar a linha de crédito" ao WABA do cliente após o Embedded Signup [fornecedor: Gupshup
  partner docs]. **Isso resolve o "incluído no plano" sem abrir mão de ser Tech Provider.**
- Custos citados (a confirmar com o comercial): Gupshup ISV ≈ US$ 0,001/msg sem mensalidade; Twilio
  US$ 0,005/msg; 360dialog € 49/número/mês (inviável em salão pequeno).
- **Próximo passo do Vitor:** pedir ao Gupshup e ao Twilio, por escrito: taxa por mensagem, linha de
  crédito para Tech Provider, Embedded Signup hospedado por eles, suporte a coexistência, prazo.

### B3. Coexistência no Brasil
| Fato | Confiança |
|---|---|
| Brasil está entre os países liberados; em 2026 relatos dizem "todos os países" | [fornecedor] |
| Precisa do WhatsApp Business **app** (não o WhatsApp comum), versão 2.24.17+ | [fornecedor] |
| Mensagem enviada pelo app continua **grátis**; só a da API é cobrada | [fornecedor: Chakra, Wati] |
| Mensagens novas dos dois lados são espelhadas por webhook | [fornecedor] |
| Limites: vazão fixa baixa (5 a 20 msg/s, fontes divergem), listas de transmissão e mensagens temporárias limitadas, grupos e ligações só no app | [fornecedor] |
| Entrada é pelo Embedded Signup (ou BSP verificado) | [fornecedor] |

**Consequências para o desenho:**
- O dono **não troca de número nem de app**. Onboarding: "conecte seu WhatsApp Business" (QR + login Meta).
- O botão "Próximo cliente" pode continuar abrindo o app (grátis) **e** o CICLO enxerga a resposta pelo
  webhook: registra opt-in, mede quem respondeu e quem voltou.
- Exige que o dono use **WhatsApp Business** (não o comum). Se usa o comum, migrar para o Business é
  passo 0 do onboarding.
- Vazão baixa não é problema para salão.

*(Rodada 1 encerrada.)*

### B4. Verificação da Meta: MEI hoje, ME amanhã
| Fato | Confiança |
|---|---|
| A Meta compara o **nome legal** caractere por caractere com o documento (pontuação e sufixo contam) | [fornecedor] |
| Documento aceito para MEI: CCMEI; deve mostrar nome, endereço e, em geral, ter até 12 meses | [fornecedor] |
| Trocar o nome legal depois de verificado **dispara nova revisão** | [fornecedor/relato] |
| Prazo comum: 3 a 10 dias úteis (até 14); 3 tentativas antes de apelar | [fornecedor] |
| Verificação libera níveis maiores de envio na API | [fornecedor] |

**Consequência:** o Vitor vai virar ME (software não cabe no MEI). Se verificar como MEI agora e depois
mudar a natureza/nome, passa por **nova revisão** no meio do lançamento. Duas opções:
- **(a)** Verificar já como MEI e aceitar uma reverificação depois (bom se a ME estiver a 6+ meses).
- **(b)** Abrir a ME antes e verificar uma vez só (bom se a ME vier em semanas).
**Recomendação:** começar pelo BSP (a verificação do BSP pode cobrir o início) e decidir (a)/(b) com o
contador. Não usei nenhum relato de rejeição específico de MEI; **não achei evidência de que o CNAE seja
checado** pela Meta.

### B5. LGPD
| Ponto | O que achei | Confiança |
|---|---|---|
| Base legal para marketing por WhatsApp | Consentimento (art. 7º, I) com opt-in explícito; legítimo interesse aparece para **e-mail** a cliente recente, não para WhatsApp | [relato jurídico/blog] |
| Legítimo interesse | Exige teste de balanceamento documentado (LIA); ANPD publicou guia em 02/2024; modelo recomendado, não obrigatório | [oficial: guia ANPD] |
| RIPD | Necessário quando há risco a direitos ou quando a base é legítimo interesse; quem faz é o **controlador** | [oficial: gov.br/anpd] |
| Anonimização | ANPD: não há técnica com eficácia plena; abordagem por risco; agregar não elimina o risco (granularidade, região, cruzamento) | [oficial: estudo técnico + consulta do guia] |
| Minimização em IA | Relato de guia de 2026 exigindo justificar cada variável do dataset de treino | [relato, **conferir no site da ANPD**] |
| Controlador × operador | Quem decide finalidade é controlador. Salão = controlador dos dados dos clientes; CICLO = operador. **Ao usar os dados para treinar modelo próprio, o CICLO decide finalidade nova → controlador desse tratamento** | [relato jurídico] |

**O que isso muda no plano:**
1. **Opt-in no agendamento e no link pessoal** é obrigatório para o automático (confirma o doc 91).
2. **Base importada** (AppBarber/Belasis) só entra no automático com consentimento que nomeie o salão e
   o tipo de mensagem. "Já recebia aviso" não vale para marketing.
3. **Aprendizado entre negócios (doc 92):** precisa (i) cláusula nos termos com o **negócio** como
   controlador concordando, (ii) aviso aos clientes finais na política de privacidade do salão, (iii)
   minimização por variável, (iv) RIPD, (v) avaliação de reidentificação. **Advogado antes da P3.**
4. A regra "aprender com tudo, mostrar só o que reúne vários negócios" está **alinhada** com a abordagem
   por risco da ANPD. Não basta como garantia jurídica sozinha.

### B6. Estatística com pouco dado
| Técnica | Para quê | Com ~100 clientes ativos por negócio | Confiança |
|---|---|---|---|
| BG/NBD / Pareto/NBD | Chance de o cliente estar ativo e nº de visitas futuras | **Fraco sozinho**: o estudo original calibrou com ~2.357 clientes; clientes de uma visita só (mais da metade em muitas bases) são mal modelados. **Bom com priors hierárquicos** (versão bayesiana, ex.: pymc-marketing) | [acadêmico/doc de biblioteca] |
| Sobrevivência (tempo até voltar) | Momento certo de agir | Funciona por **serviço**, juntando clientes; o CICLO já usa mediana do ritmo, que é um começo honesto | (estimativa) |
| Hierárquico bayesiano | Juntar negócios parecidos | É **a** técnica que torna o resto viável; encolhimento reduz falso positivo | [acadêmico] |
| Uplift (X-learner) | Quem responde **por causa** da mensagem | Exige milhares de exposições; só faz sentido **agregado entre negócios** (P3) | [fornecedor/acadêmico] |
| Bandido bayesiano | Escolher variante | Dentro de um negócio converge devagar; usar com prior do nicho | (estimativa) |
| Teste A/B clássico | Comparar textos | ~1.000/grupo para 10% de diferença: **não serve** por negócio | [fornecedor] |

**Conclusão de B6:** a ordem certa é (1) ritmo empírico + intervalo (já existe a base), (2) controle
atrasado agregado entre negócios, (3) BG/NBD **bayesiano hierárquico** quando houver ~30 negócios, (4)
uplift só no agregado. "6 em 10 clientes novos não voltam" casa com o problema dos clientes de uma
visita: a **segunda visita** merece modelo próprio (já está no catálogo do doc 92).

*(Rodada 2 encerrada.)*

### B7. Concorrentes: o que realmente fazem
| Empresa | O que faz em retenção/dados | Fonte |
|---|---|---|
| **Phorest** (IE/UK/US) | Relatórios de benchmark trimestrais (retenção, remarcação, ticket, varejo) contra local, nacional e elite, com base em >11 mil salões. Referência: retenção de cliente novo ≈ 29–30%, existente ≈ 68%, geral ≈ 58% | [fornecedor] |
| **Zenoti** | Preço dinâmico por demanda e horário; IA para remarcação e marketing preditivo | [fornecedor] |
| **Boulevard** | Otimização de horário, remarcação, nota de retenção | [relato] |
| **Fresha** | Preço inteligente de horário, mensagens automáticas | [relato] |
| **Trinks** (BR) | IA que agenda e responde 24 h; convite de retorno para quem sumiu; WhatsApp automático **pago por mensagem, fora do plano** | [fornecedor] |
| **Belasis** (BR) | Campanhas automáticas no WhatsApp, recuperação de inativos, reduzir horário vago, conexão por QR | [fornecedor] |
| **AppBarber** (BR) | Lembrete por WhatsApp Web do dono (sem custo), mensagens de retorno automáticas, fidelidade | [fornecedor] |

**Conclusão:** cada peça isolada existe. O que **não achei** em nenhum, no Brasil ou fora: decisão por
**lucro incremental** com **grupo de controle**, **previsão gravada antes e conferida depois** (placar
público) e **ciclo de obrigação** (a cadência do que o negócio deve entregar). Isso é o diferencial
defensável. "Benchmark" e "IA de retorno" sozinhos não são.

A referência da Phorest (retenção de cliente novo ≈ 30%) bate com "6 em 10 não voltam" das fontes
brasileiras: o problema da **segunda visita** é universal e é o melhor ponto de entrada do motor.

### B8. Verticais de recorrência: ordem recomendada
| Ordem | Vertical | Por quê | Risco |
|---|---|---|---|
| 1 | **Beleza ampliada** (barbearia, salão, unhas, sobrancelha, cílios, estética leve) | É o produto atual; mesma ontologia | Concorrência alta; diferencial é o motor |
| 2 | **Pet: banho e tosa** | Ritmo de 15–30 dias, agenda por horário, cliente recorrente: quase igual a barbearia. Mercado de ~170 mi pets; software pet já faz lembrete de vacina, mas pouco de retorno por ritmo | Clínica veterinária é outra coisa (prontuário); começar só no banho e tosa |
| 3 | **Personal e estúdios** (pilates, funcional) | Evasão é a dor central (72% das evasões nos 90 primeiros dias em academias; estúdios 3–5%/mês de churn) | Academias grandes têm Next Fit/Pacto/EVO; mirar estúdio pequeno |
| 4 | **Serviços em casa** (faxina, jardinagem, manutenção) | Recorrência por contrato; entra o ciclo de obrigação | Agenda por rota, não por cadeira |
| 5 | **Contabilidade/consultoria** | Ciclo de obrigação puro (entregas mensais) | Produto diferente; concorrentes de gestão contábil |
| 6 | **Imobiliária** | Bom exemplo de ontologia, mas venda rara e ciclo longo: o motor aprende devagar | Volume baixo, concorrentes de CRM imobiliário |

### B9. Preço
| Referência | Valor | Fonte |
|---|---|---|
| AppBarber | R$ 79,90 (1 prof.), R$ 109,90 (2–5); anual com 30% off | [fornecedor] |
| Trinks | a partir de R$ 76 (1–2 prof.); WhatsApp automático pago por mensagem | [fornecedor/comparativo] |
| Faixa do mercado | R$ 19,90 a R$ 110 para 1–2 profissionais | [comparativo] |
| Sistemas de academia | R$ 150 a R$ 1.200/mês por unidade | [comparativo] |

**Leitura:**
- **R$ 37** fica abaixo de todo o mercado relevante: bom para entrada, mas **não deixa margem para
  mensagem**. Correto não incluir envio automático nele.
- **R$ 149 com recuperação automática** fica ≈ 2× AppBarber. Defensável **se** a tela mostrar "o motor
  trouxe R$ X a mais (medido com controle)". Sem medição, o dono compara com R$ 79,90 e acha caro.
- Teste de aceitação recomendado: no piloto, oferecer R$ 149 e R$ 199 a grupos diferentes de salões e ver
  quem fecha (amostra pequena, só indicativo).

*(Rodada 3 encerrada.)*

## C. Arquitetura de dados

**Princípio:** reaproveitar o que existe. O banco já tem três peças que os docs 91–93 desenhavam como
"novas":
- `consents` (0001) já tem `kind = 'marketing'`, `version`, `text_hash` (hash do texto exibido), `ip`,
  `user_agent`, `granted_at`, `revoked_at`, e a 0084 já a deixou sem DELETE. **Falta só origem e canal.**
- `messages` (0001) já tem canal, tipo, status, custo em centavos, `provider_id` e `campaign_id` (0054).
  **É a tabela de exposição**; falta o braço do experimento e os eventos de entrega, leitura e resposta.
- `cycle_predictions` (0064) já é previsão gravada antes e conferida depois, com `algo_version`.
  **É o molde das novas previsões.**

### C1. Alterações (aditivas, sobem antes do código)
| Tabela | Mudança | Por quê |
|---|---|---|
| `consents` | `+ channel text` (`whatsapp`, `email`, `sms`), `+ source text` (`booking`, `personal_link`, `whatsapp_reply`, `import_declared`, `in_person`), `+ business_name_shown text` | Prova exigida pela Meta: nome do negócio, tipo, origem e data |
| `messages` | `+ category text` (`marketing`, `utility`, `service`), `+ experiment_arm text` (`treatment`, `delayed_control`), `+ delivered_at`, `+ read_at`, `+ replied_at`, `+ clicked_at`, `+ failure_code text` | Medição; `failure_code = 131049` (teto de marketing) **não** conta como exposição |
| `tenants` | `+ whatsapp_connection jsonb` (WABA, número, estado, modo coexistência) e token **cifrado** com a chave do salão (mesmo envelope do cofre) | Cada salão com o próprio número |

### C2. Tabelas novas (RLS forçada, política por `has_tenant`, teste de isolamento)
| Tabela | Colunas principais | Regra |
|---|---|---|
| `personal_links` | `tenant_id`, `client_id`, `purpose` (`return`, `slot_offer`, `consent`), `token_hash`, `expires_at`, `opened_at`, `booked_appointment_id` | Atribuição por clique, melhor que por tempo |
| `message_variants` | `tenant_id` (nulo = variante global), `segment` (`due`, `late`, `at_risk`, `lost`, `second_visit`, `slot_offer`), `template_name`, `offer_kind`, `offer_cents`, `active` | Um template aprovado na Meta por variante |
| `return_outcomes` | `message_id`, `tenant_id`, `client_id`, `returned_at`, `appointment_id`, `revenue_cents`, `margin_cents`, `days_to_return` | Preenchido pelo recálculo noturno; só acrescenta |
| `forecasts` | `tenant_id`, `target` (`month_revenue`, `open_slots_7d`, `client_return_30d`...), `subject_id`, `horizon_end`, `q10`, `q50`, `q90`, `algo_version`, `made_at` | Só acrescenta, como `cycle_predictions` |
| `forecast_outcomes` | `forecast_id`, `actual`, `measured_at`, `covered` (o real caiu entre q10 e q90?) | Alimenta o placar de acerto |
| `decisions` | `tenant_id`, `kind`, `subject_id`, `expected_gain_cents`, `explanation`, `status` (`proposed`, `approved`, `edited`, `ignored`, `executed`), `decided_by`, `decided_at` | A Central de Decisões, auditada |

### C3. Aprender × mostrar (como a regra vira código)
- **Camada de treino:** view materializada **fora do schema `public`** (o PostgREST não expõe), gerada
  por rotina com `service_role`, só com atributos sem identificação: `tenant_pseudo` (hash com sal que
  roda), vertical, faixa de ticket, faixa de porte, região grande (não cidade), mês, segmento, variante,
  braço, voltou (sim/não), dias até voltar, margem em faixa. **Sem** nome, telefone, e-mail, texto livre,
  data exata, cidade e dado de saúde.
- Só os **parâmetros** do modelo (médias e variâncias do nicho) voltam para cada salão. O salão nunca lê
  a camada de treino.
- **Benchmark na tela:** função que sobe a hierarquia (subnicho → vertical → recorrência) até haver mais
  de um negócio e nenhum dominante; senão mostra "ainda sem base para comparar".
- Liga só depois de: cláusula dos termos revisada por advogado, aceite do negócio e RIPD.

## D. Funcionalidades priorizadas

Esforço em semanas **(estimativa)** para uma pessoa com o Claude.

| # | Funcionalidade | Propósito | Métrica | Critério de aceite | Depende de | Esforço |
|---|---|---|---|---|---|---|
| 1 | **Opt-in no agendamento** | Base legal do automático | % da base ativa com opt-in | Caixa separada, desmarcada, com nome do salão e tipo; grava em `consents` com origem | — | 0,5 |
| 2 | **Link pessoal** | Primeiro toque humano + opt-in + atribuição por clique | Cliques, agendamentos por link | Link assinado abre a página já reconhecendo o cliente; registra abertura, opt-in e agendamento | 1 | 1 |
| 3 | **"Próximo cliente"** | Recuperar sem API, grátis | Mensagens por dia, retornos | Abre o WhatsApp do dono com texto e link; pula quem pediu para parar; teto diário | 2 | 0,5 |
| 4 | **Medição com controle atrasado** | Efeito real | Retorno tratamento × controle, com intervalo | Sorteio reprodutível; controle recebe a mesma mensagem dias depois; amostra na tela | 2, C1 | 1,5 |
| 5 | **Placar de acerto** | Prova pública | Cobertura do intervalo | "Previu X, aconteceu Y" a partir de `cycle_predictions` | já existe a base | 1 |
| 6 | **Previsão F1** (receita do mês com faixa, vagas sobrando em 7 dias, chance de retorno em 30 dias) | Olhar para frente | q10/q50/q90 e cobertura | Passa no teste retroativo do próprio negócio antes de aparecer | 5 | 2 |
| 7 | **Casamento vaga × cliente** | Encher cadeira que ia se perder | Vagas preenchidas a mais | Para cada vaga provável de sobrar, sugere até 3 clientes com opt-in e ritmo vencendo | 6, 1 | 1,5 |
| 8 | **Central de Decisões v1** | Uma fila do dia | Decisões aprovadas, ganho | Até 10 itens com explicação e ganho; aprovar, editar ou ignorar grava em `decisions` | 3, 7 | 1,5 |
| 9 | **Conexão WhatsApp em coexistência** | Envio automático oficial | % dos salões conectados | Embedded Signup do BSP; token cifrado; webhook de status e resposta | cotação BSP | 3 |
| 10 | **Campanha automática com orçamento de atenção** | O plano de R$ 149 | Lucro incremental por mensagem | Só com opt-in; teto do plano; no máximo 1 marketing por semana por cliente; trata 131049; pausa por bloqueio | 4, 9 | 2 |
| 11 | **Segunda visita** | A maior perda (~70% dos novos não voltam) | Taxa de 2ª visita | Programa próprio para quem tem 1 visita, com prazo pelo serviço | 4 | 1 |
| 12 | **Ciclo de obrigação** | Abrir verticais de entrega | Entregas no prazo | Mesma cadência no sentido "nós devemos entregar" | — | 2 |
| 13 | **Modelo hierárquico + benchmark** | Aprender entre negócios | Erro menor em negócio novo | Só após advogado, RIPD e ~30 negócios | C3 | 4+ |
| 14 | **Uplift e bandido** | Mandar só para quem muda de ideia | Lucro por mensagem | Só agregado entre negócios | 13 | 4+ |

**Cortados por enquanto:** gêmeo digital completo, cobrança por resultado, preço dinâmico, overbooking
automático, imobiliária. Voltam com ~100 negócios ou dado que prove a necessidade.

*(Rodada 4 encerrada.)*

## E. Economia por plano

### Hipóteses (todas trocáveis; nenhuma medida ainda)
| Hipótese | Valor | Origem |
|---|---|---|
| Câmbio | R$ 5,50 por US$ | hipótese |
| Mensagem de marketing | US$ 0,0625 (Meta) + US$ 0,001 (Gupshup ISV) = **≈ R$ 0,35** | B1, B2 |
| Taxa do Mercado Pago (cartão recorrente) | 4,5% | faixa 3,99–4,99% achada antes |
| Custo fixo do sistema | R$ 238/mês (Vercel Pro + Supabase Pro + domínio), a partir do 1º pagante | docs/88 |
| DAS do MEI | R$ 86/mês | docs/89 |
| Ticket médio do salão | R$ 50 (barbearia) e R$ 80 (salão/estética) | B9 / fontes de mercado |
| Volta espontânea (controle) | 3% em 30 dias | fornecedor (Gendo) |
| Volta com mensagem | 7% (pessimista), 10% (base), 15% (otimista) | fornecedores, puxado para baixo |
| Clientes com opt-in contatados por mês | 60 / 100 / 150 | hipótese (depende do piloto) |
| Mensagens por cliente contatado | 1,5 (com o teto de ~1 marketing/semana) | B1 |

### Margem do CICLO por salão (por mês)
| Plano | Preço | Taxa MP | Mensagens | Custo das mensagens | **Margem** |
|---|---|---|---|---|---|
| Básico (manual, sem API) | R$ 37 | R$ 1,67 | 0 | R$ 0 | **≈ R$ 35** |
| Recuperação, pessimista (60 contatados) | R$ 149 | R$ 6,71 | 90 | R$ 32 | **≈ R$ 111** |
| Recuperação, base (100 contatados) | R$ 149 | R$ 6,71 | 150 | R$ 52 | **≈ R$ 90** |
| Recuperação, otimista (150 contatados) | R$ 149 | R$ 6,71 | 225 | R$ 79 | **≈ R$ 63** |
| Recuperação, pior caso de volume (250 msgs, teto) | R$ 149 | R$ 6,71 | 250 | R$ 88 | **≈ R$ 54** |
| Recuperação a R$ 199, teto | R$ 199 | R$ 8,96 | 250 | R$ 88 | **≈ R$ 102** |

O **teto de mensagens do plano** é o que garante a margem: com 250 mensagens o plano de R$ 149 ainda
rende mais que o básico (R$ 54 contra R$ 35). Acima do teto, cobrar excedente.

### Valor para o dono (o que sustenta o preço)
Ganho **incremental** = (volta com mensagem − volta espontânea) × contatados × ticket.
| Cenário | Contatados | Incremental | Ticket | Faturamento a mais/mês | Contra R$ 149 |
|---|---|---|---|---|---|
| Pessimista | 60 | 4 p.p. (7% − 3%) | R$ 50 | **R$ 120** | **Não paga** |
| Base | 100 | 7 p.p. | R$ 50 | R$ 350 | 2,3× |
| Base, salão | 100 | 7 p.p. | R$ 80 | R$ 560 | 3,8× |
| Otimista | 150 | 12 p.p. | R$ 80 | R$ 1.440 | 9,7× |

**Leitura honesta:** em barbearia pequena com ticket de R$ 50, o plano de R$ 149 **só se paga no
cenário base**, e no pessimista não. O público do plano de recuperação é **salão/estética com ticket ≥
R$ 80 ou barbearia com base grande**. Barbearia pequena fica no básico com o "Próximo cliente" manual.
E o número que decide tudo (a diferença tratamento × controle) **só o piloto mede**.

### Ponto de equilíbrio
Custo fixo mensal: R$ 238 (sistema) + R$ 86 (DAS) = **R$ 324**.
| Mistura de planos | Margem média por pagante | Pagantes para empatar |
|---|---|---|
| 100% básico | R$ 35 | **10** |
| 70% básico + 30% recuperação (base) | R$ 51 | **7** |
| Incluindo R$ 25/dia de rua (22 dias = R$ 550) | R$ 51 | **18** |

## F. Plano de 90 dias

| Semanas | CICLO (eu) | Vitor | Portão |
|---|---|---|---|
| 1–2 | Opt-in no agendamento (#1), link pessoal (#2), "Próximo cliente" (#3); migration aditiva de `consents` e `messages` | Escolher 5 salões-piloto (de preferência ticket ≥ R$ 80); termo de LGPD do diagnóstico; pedir cotação por escrito ao Gupshup e ao Twilio; perguntar ao contador **quando** sai a ME | — |
| 2–5 | Diagnóstico com a base exportada dos pilotos; medição com controle atrasado (#4); placar de acerto (#5) | Visitar os pilotos; pedir a exportação ao AppBarber/Belasis deles | **Dia 35:** diferença tratamento × controle ≥ 4 p.p. somando os pilotos **e** 2 de 5 dispostos a pagar. Se não, parar o automático e ficar no manual |
| 5–8 | Previsão F1 (#6); segunda visita (#11) | Advogado: termos, cláusula de dados agregados, rascunho de RIPD; decidir ME antes da verificação Meta | — |
| 6–10 | Conexão WhatsApp em coexistência via BSP (#9); templates de marketing por segmento | Verificação da empresa na Meta (com o nome legal definitivo); aceitar contrato do BSP | — |
| 9–12 | Campanha automática com orçamento de atenção (#10) em 2–3 salões; casamento vaga × cliente (#7); Central de Decisões v1 (#8) | Cobrar os primeiros planos de recuperação | **Dia 75:** lucro incremental positivo com controle **e** taxa de bloqueio baixa (nenhum salão com nota de qualidade rebaixada). **Dia 90:** ≥ 10 pagantes, ≥ 3 no plano de recuperação → abrir o pacote **pet (banho e tosa)** |

Fora dos 90 dias: modelo hierárquico, benchmark, uplift e bandido (#13, #14) só com ~30 negócios e
parecer do advogado.

## G. Perguntas em aberto para o Vitor (por impacto)
1. **Quando sai a ME?** Define se a verificação da Meta é feita uma vez ou duas.
2. **Quais 5 salões-piloto?** Quanto maior o ticket e a base, mais rápido o portão do dia 35.
3. **Aceita que barbearia pequena (ticket R$ 50) fique no plano básico** e o de recuperação mire salão/estética?
4. **Preço do plano de recuperação:** testar R$ 149 e R$ 199 em grupos diferentes?
5. **Quer ser Tech Provider desde o início** (mais trabalho, sem markup) ou entrar pelo BSP e migrar depois?
6. **Advogado:** já tem alguém? Termos, cláusula agregada e RIPD são pré-requisito do aprendizado entre negócios.
7. **O diagnóstico com base exportada vai ser cobrado** ou só isca? (muda o termo de LGPD e o esforço)
8. **Abrir pet no dia 90** ou continuar só em beleza até ~50 pagantes?

## Fontes da rodada 5
Mesmas das rodadas 1–3 (preço Meta, Gupshup, Mercado Pago, mercado). Contas: este documento.



## Fontes da rodada 3
- Preços AppBarber: https://appbarber-appbeleza.zendesk.com/hc/pt-br/articles/360001701331-Planos-e-Pre%C3%A7os-do-Sistema
- Preços Trinks: https://negocios.trinks.com/planos/ e https://agende-me.com/comparacao-sistemas-agendamento/
- Phorest benchmark: https://professionalbeauty.ie/phorest-unveils-salon-industry-insights-in-new-benchmarking-reports e https://lutily.com/blog/more-clients-wont-fix-revenue
- Pet: https://www.agendapetapp.com.br/guia-gestao-petshop e https://simples.vet/blog/gestao/melhor-software-para-pet-shop/
- Academias e churn: https://blog.sistemapacto.com.br/como-reduzir-churn-em-academia-framework-4-fases/ e https://www.cartacapital.com.br/esporte/com-mais-de-100-mil-empresas-mercado-de-academias-busca-tecnologia-para-enfrentar-evasao-de-alunos/


## Fontes da rodada 2
- Verificação e nome legal: https://anylinga.com/blog/en/meta-business-verification-rejected-7-fixes.html e https://help.blip.ai/hc/en-us/articles/4474390521367-How-to-verify-your-business-in-Meta-Business-Manager
- Guia ANPD de legítimo interesse: https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia_legitimo_interesse.pdf/@@display-file/file
- Marketing, consentimento e WhatsApp: https://confidata.com.br/blog/legitimo-interesse-lgpd-lia-exemplos-limites e https://confidata.com.br/blog/lgpd-marketing-digital-campanhas-crm-automacao
- RIPD (ANPD): https://www.gov.br/anpd/pt-br/canais_atendimento/agente-de-tratamento/relatorio-de-impacto-a-protecao-de-dados-pessoais-ripd
- Anonimização (ANPD e análise): https://www.gov.br/anpd/pt-br/centrais-de-conteudo/documentos-tecnicos-orientativos e https://www.machertecnologia.com.br/lgpd-dados-agregados/
- Controlador × operador em SaaS: https://www.yapoli.com/post/desafios-da-lgpd-em-plataformas-saas-b2b-parte-1
- Treino de modelos e LGPD 2026: https://techlaam.com/posts/2026-05-30-protecao-de-dados-e-inteligencia-artificial-como-treinar-modelos-em-conformidade-com-a-lgpd-em-2026
- BG/NBD: https://www.brucehardie.com/papers/bgnbd_2004-04-20.pdf e https://www.pymc-marketing.io/en/0.6.0/notebooks/clv/pareto_nbd.html


## Fontes da rodada 1
- Preço Brasil 2026: https://www.messagecentral.com/blog/whatsapp-business-api-pricing-brazil e https://www.go4whatsup.com/guides/meta-whatsapp-pricing/
- Teto de marketing por pessoa: https://www.infobip.com/blog/what-is-whatsapp-frequency-capping e https://www.gupshup.ai/resources/blog/all-you-need-to-know-about-whatsapp-business-api-frequency-capping/
- Coexistência (países, requisitos): https://chakrahq.com/article/whatsapp-coexistence-live-eu-uk-europe-whatsapp-business-for-api-live/ e https://whautomate.com/whatsapp-coexistence
- Coexistência (preço e limites): https://chakrahq.com/article/whatsapp-coexistence-all-about-coexistence-mode-pricing-and-how-to-optimize-cost/ e https://support.wati.io/en/articles/11822402-introducing-whatsapp-coexistence
- Gupshup, Solution Partner e Tech Provider, linha de crédito: https://partner-docs.gupshup.io/docs/what-is-sp-tp e https://partner-docs.gupshup.io/reference/get_partner-app-appid-obotoembed-verify
