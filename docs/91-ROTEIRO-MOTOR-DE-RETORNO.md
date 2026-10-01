# Roteiro · Motor de Retorno (API oficial, consentimento, estatística por nicho)

Escrito em 2026-09-30. Prazos e custos marcados **(estimativa)** são palpite meu, não medição. Preços de
terceiros (BSP, Meta) vêm de sites de comparação e precisam de confirmação direta antes de decidir.

## 0. A ideia em uma frase
O Motor de Ciclo diz **quem** está atrasado e **quanto vale**. O **Motor de Retorno** decide **como
chamar cada pessoa, quando, com que texto e com que oferta**, mede o **efeito incremental** (com grupo
de controle) e aprende, juntando salões parecidos para superar o problema de pouco dado por salão.

Não é um sistema separado: é uma camada nova em `src/core/` (funções puras, regra 5) que reaproveita
ritmo, lucro em risco, opt-out, regra de 7 dias, janela 8h–21h e a atribuição que já existem.

## 1. Trilhas e dependências

| Trilha | O que entrega | Quem faz | Depende de |
|---|---|---|---|
| A. Canal oficial (Meta) | Envio automático por API oficial | Vitor (papelada) + eu (código) | C |
| B. Consentimento | Opt-in com prova (data, origem, texto) | eu | nada |
| C. Base de medição | Registro de exposição, resultado e controle | eu | B |
| D. Motor de Retorno | Decisão por lucro incremental | eu | C |
| E. Estatística por nicho | Benchmarks e aprendizado agregado | eu + advogado | C, cláusula LGPD |
| F. Jurídico e fiscal | Termos, LGPD agregado, ME | Vitor + advogado/contador | nada |

## 2. Trilha A · O caminho oficial, passo a passo

Duas portas. Escolher a **porta 1 para lançar** e abrir a **porta 2 em paralelo**.

**Porta 1 · BSP com ISV (lançar mais rápido)**
1. Cotar Gupshup (programa ISV, sem mensalidade, ~US$ 0,001 por mensagem) e Twilio (US$ 0,005 por
   mensagem). Descartar 360dialog (€ 49 por número por mês, não fecha a conta em salão pequeno).
2. Perguntar ao comercial: o Embedded Signup deles serve para o dono conectar o próprio número? Eles
   compartilham linha de crédito (mensagem incluída no plano, sem o dono cadastrar cartão)? Qual o
   prazo de aprovação de templates? Tem taxa por número?
3. Integrar (eu): conexão do salão, token cifrado por salão, webhooks de status e resposta, templates.
4. Submeter templates de marketing (aprovação da Meta, horas a dias).
5. Piloto com 2 a 3 salões.

**Porta 2 · Tech Provider próprio (sem markup, mais trabalho)**
1. Portfólio empresarial na Meta e **verificação da empresa** (3 a 10 dias úteis, até 14; 3 tentativas).
   Dados idênticos entre CNPJ, site e cadastro. Documento aceito para MEI: CCMEI.
2. App tipo Business, permissões `whatsapp_business_messaging` e `whatsapp_business_management`.
3. **App Review** com vídeo sem cortes de cada permissão (semanas, sem prazo garantido).
4. Embedded Signup v4 (obrigatório em 2026).
5. Com Tech Provider o salão cadastra o próprio cartão na Meta. Para **incluir a mensagem no plano**
   é preciso um parceiro com linha de crédito (BSP). Por isso a porta 1 é a de lançamento.

**Número:** cada salão com o próprio número (nota de qualidade isolada por salão). A coexistência
(app do celular e API no mesmo número) depende de liberação por país: **verificar no Brasil**.

**Custo por mensagem (Brasil, a confirmar):** marketing ~R$ 0,34 a 0,45; utilidade ~R$ 0,04 a 0,10.
Tem que ser utilidade de verdade: texto com promoção é cobrado como marketing.

## 3. Trilha B · Consentimento (base de tudo, sem custo)

- Caixinha "Quero receber avisos de horários e novidades da [salão] por WhatsApp" no agendamento
  (separada, sem marcar de antemão, com o nome do salão e o tipo de mensagem).
- Tabela append-only `consents` (tenant, cliente, canal, texto aceito, versão, origem, data).
- **Link pessoal**: o dono manda o primeiro toque pelo WhatsApp dele (1 a 1, humano); o link assinado
  abre a página de agendamento já reconhecendo o cliente, com o botão de aceite. Registra sozinho e
  mede a volta por clique (atribuição por link, melhor que por tempo).
- Base importada de outro sistema: só entra no automático se o salão **declarar** que tem consentimento
  específico (a declaração fica registrada). Nunca assumir que "já recebia aviso" vale para marketing.
- Templates de marketing precisam de botão de sair (exigência atual da Meta).

## 4. Trilha C · Base de medição

Tabelas novas (todas com RLS forçada e teste de isolamento):
- `message_variants` (texto, grupo-alvo, oferta, versão).
- `message_exposures` (cliente, variante, canal, enviado, entregue, lido, respondeu, clicou, bloqueou,
  **braço: tratamento ou controle**).
- `return_outcomes` (voltou? quando? valor, serviço, veio de desconto?).

Regra: **10% de grupo de controle** sem mensagem, sorteado de forma reprodutível. Sem isso a campanha
leva o crédito de quem voltaria sozinho (as fontes dizem ~3% voltam sozinhos).

## 5. Trilha D · Motor de Retorno (a decisão)

Pergunta central: **vale mandar?** Manda só se
`lucro incremental esperado = (P(volta | mensagem) − P(volta | nada)) × margem − custo da mensagem − custo do brinde > 0`.

Camadas, em ordem de maturidade:
1. **Regras por grupo** (chegando, atrasado, em risco, perdido) com texto e oferta por grupo.
2. **Teste A/B com semelhança entre salões** e leitura com amostra e intervalo, nunca "comprovado".
3. **Bandido bayesiano** (Thompson sampling) para dividir o tráfego entre variantes e convergir.
4. **Uplift por cliente** (modelo de efeito incremental): quem responde **por causa** da mensagem, não
   quem já voltaria. Evita gastar mensagem e desconto com quem não precisa.
5. **Melhor horário e dia** por grupo.
6. **Frequência ótima** por cliente (fadiga) com teto mensal.

Guardas: 7 dias, janela 8h–21h, opt-out, teto do plano, **pausa automática** se a taxa de bloqueio
passar do limite, nunca desconto para quem já volta sem desconto.

## 6. Trilha E · Estatística avançada e mistura entre salões

Problema: um salão tem ~100 sumidos por mês; para detectar 5 pontos de diferença são necessárias
centenas de envios. Solução: **aprender juntando salões parecidos**.

- **Modelo hierárquico (partial pooling / empirical Bayes):** cada salão começa com a média do seu
  nicho e se afasta dela conforme ganha dado próprio. Resolve o "cold start" de salão novo.
- **Similaridade de nicho:** agrupar salões por vertical, ticket médio, porte da equipe, cidade
  (tamanho), mix de serviços e ritmo de retorno. Comparar sempre com os vizinhos mais próximos, não com
  a média do Brasil.
- **Análise de sobrevivência** (curva de quando a pessoa volta, risco ao longo do tempo) no lugar de
  "atrasado por N dias".
- **Modelos de "cliente ainda ativo"** (BG/NBD e Pareto/NBD, padrão para negócios de visita recorrente):
  probabilidade de o cliente ainda estar ativo e de quantas visitas vêm, por cliente.
- **Coortes e retenção:** curva por mês de entrada, por origem de cliente e por profissional.
- **Calibração auditada:** já existe `cycle_predictions` append-only. Estender para a probabilidade de
  retorno e publicar o erro (escore de Brier, curva de calibração). "Previsão auditada" vira prova.
- **Indicadores de dono:** lucro incremental por mensagem, custo por cliente recuperado, mensagens por
  retorno, eficiência do desconto, taxa de fidelização 30/60/90 dias após voltar, ocupação de cadeira,
  risco de falta por cliente, LTV por origem.
- **Benchmark anônimo:** "seu retorno está no percentil X do seu nicho".

**Privacidade (obrigatório):** nenhum dado de cliente sai do salão. Só agregados. Regras: mínimo de
salões por célula (comece com 5), sem célula com 1 salão dominante, ruído ou arredondamento em número
pequeno, participação com aceite explícito do salão, e cláusula de dados agregados nos termos revisada
por advogado (já está redigida, parada). Dado de saúde fica fora de tudo.

## 7. Extras para o Motor virar elite (além do retorno)

1. **Horário vago inteligente:** cruzar vaga na agenda com quem está na hora de voltar ("abriu 16h hoje").
2. **Risco de falta** por cliente, com lembrete mais cedo para quem costuma faltar.
3. **Previsão de demanda** por dia e hora e sugestão de abrir ou fechar turno (já há experimentos).
4. **Ticket e preço:** teste de preço com leitura de elasticidade.
5. **Reativação de pacote/assinatura** (quem não usou o que pagou).
6. **Explicação em português** para cada decisão ("mandei para a Ana porque..."), e o dono pode vetar.

## 8. Linha do tempo (estimativa)

| Semanas | Entrega | Quem |
|---|---|---|
| 0 | Iniciar verificação da empresa na Meta; conversar com advogado; decidir ME com contador | Vitor |
| 0 a 3 | Trilha B: opt-in, link pessoal, registro de consentimento | eu |
| 2 a 5 | Trilha C: exposição, controle e painel de métricas v1 | eu |
| 1 a 3 | Cotações reais de BSP; escolher | Vitor + eu |
| 3 a 8 | Integração com o BSP, templates aprovados, teto e cobrança de excedente | eu |
| 6 a 10 | Piloto de envio automático (2 a 3 salões, só com opt-in) | juntos |
| 8 a 16 | Trilha D camadas 1 a 3; Trilha E com benchmark quando houver salões suficientes | eu |
| 12 a 24 | Uplift, sobrevivência, BG/NBD, horário ótimo | eu |

## 9. Portões de decisão (parar ou seguir)
- Após o piloto manual de diagnóstico: retorno medido com controle ≥ 5% e 2 de 5 salões pagando? Senão,
  não construir o automático.
- Antes do envio automático: opt-in de pelo menos 30% da base ativa de 3 salões.
- Antes do benchmark: no mínimo 5 salões por nicho, senão só o nicho largo.

## 10. O que depende do Vitor
Verificação Meta, advogado (termos e cláusula agregada), contador (ME), cotações de BSP (contato
comercial), escolher os salões-piloto e autorizar publicar cada etapa.
