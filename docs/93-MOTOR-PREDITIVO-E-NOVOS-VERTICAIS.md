# 93 · Motor Preditivo e expansão para novos verticais (beleza e imobiliária como exemplos)

Escrito em 2026-09-30. Complementa `docs/91` e `docs/92`. Números marcados **(estimativa)** são meus.
Benchmarks de imobiliária vêm de blogs do setor, não de pesquisa auditada.

## 1. Do retrovisor para o para-brisa

Hoje o Motor de Ciclo olha o passado ("faz 38 dias que ele não vem") e projeta **uma data**. O passo
seguinte é que **todo número importante seja uma previsão com incerteza**, não um histórico: o que
**provavelmente vai acontecer**, com faixa e nível de confiança, e o que fazer a respeito.

Regra de produto: nenhuma previsão aparece sem **intervalo** e sem **aviso de dado insuficiente**. Nunca
"vai faturar R$ 12 mil", sempre "provável R$ 11,4 mil (faixa R$ 9,8 a 13,1 mil)".

## 2. O que o Motor Preditivo prevê (beleza)

| # | Previsão | Horizonte | Alimenta |
|---|---|---|---|
| 1 | **Receita do mês**, como distribuição (pior, provável, melhor) | resto do mês | Plano de meta, caixa |
| 2 | **Quem vai voltar** (probabilidade por cliente) | 7, 14 e 30 dias | Quem chamar, quando |
| 3 | **Quem vai sumir** e por quê (fatores principais) | 30, 60 e 90 dias | Retenção antes da perda |
| 4 | **Vagas que vão sobrar** por dia e hora | 7 a 14 dias | Casamento de vaga, oferta por perecibilidade |
| 5 | **Faltas esperadas** por dia | 1 a 7 dias | Overbooking, lembrete antecipado |
| 6 | **Valor de vida previsto** (LTV) por cliente | 12 meses | Onde gastar atenção e oferta |
| 7 | **Consumo de produto** | 30 dias | Reposição de estoque |
| 8 | **Chance de bater a meta** | fim do mês | Plano de meta |
| 9 | **Efeito previsto de uma ação** ("chamar estes 40 traz +R$ X, faixa Y") | 7 a 30 dias | Central de Decisões, cenários |
| 10 | **Choques** (feriado, clima, semana de pagamento) | calendário | Todas as anteriores |

## 3. Como o motor prevê (desenho técnico)

1. **Insumos:** histórico do negócio, **agenda já marcada** (o futuro conhecido), calendário externo
   (feriados, semana de pagamento) e o **conhecimento do nicho** (`docs/92`).
2. **Por cliente:** probabilidade de estar ativo e de quantas visitas vêm (BG/NBD), curva de retorno
   (sobrevivência), risco de falta.
3. **Por vaga e por dia:** demanda como **contagem intermitente** (poucas visitas por horário) com
   distribuição de contagem (binomial negativa), não só média. A literatura recomenda distribuições, e
   não apenas quantis, para demanda intermitente.
4. **Agregados:** previsão de quantis da receita, com sazonalidade e feriados.
5. **Coerência hierárquica (reconciliação):** cliente, serviço, profissional e negócio precisam somar.
   A previsão do negócio não pode contradizer a soma das previsões dos clientes.
6. **Mistura com o nicho (encolhimento hierárquico):** negócio novo começa com a média do nicho e se
   ajusta ao próprio dado.
7. **Calibração contínua:** toda previsão é gravada **antes** do fato e comparada **depois** (cobertura do
   intervalo, erro). Isso gera o **placar de acerto** público ("previu 40, voltaram 31").
8. **Teste de retroativo:** cada modelo roda em janela móvel no passado do próprio negócio antes de
   aparecer para o dono.

**Do previsto para a decisão:** "amanhã devem sobrar 6 vagas entre 14h e 18h" dispara o casamento
de vaga; "10 clientes de alto valor têm risco alto de sumir em 30 dias" dispara retenção; "a chance de
bater a meta é 38%" gera o plano de meta.

## 4. Como entra no CICLO (com força, sem reescrever)

- **Módulo novo em `src/core/previsao/`** (funções puras, regra 5): tipo `Distribuicao` (quantis),
  previsão de receita, retorno, ocupação, faltas, LTV.
- **Tabelas** (RLS forçada, append-only): `forecasts` (alvo, horizonte, quantis, versão do modelo, feito
  em) e `forecast_outcomes` (o que aconteceu, preenchido depois). Mesmo padrão de `cycle_predictions`.
- **Rotina diária** que gera e confere previsões (mesma disciplina do cron do Motor de Ciclo, com
  vigilância de heartbeat).
- **Telas:** "Próximos 14 dias" (novo), faixa de previsão na tela Hoje, placar de acerto.
- **Fases:**
  - F1 (2 a 3 semanas **(estimativa)**): previsões empíricas simples com intervalo (receita do mês,
    vagas, retorno por cliente a partir do ritmo que já existe), gravadas e conferidas.
  - F2: BG/NBD, sobrevivência, demanda por contagem, calibração e teste retroativo.
  - F3: prior do nicho e reconciliação hierárquica.
  - F4: efeito previsto de ações e cenários (gêmeo digital).
- **Portão:** só mostrar ao dono a previsão que passou no teste retroativo do próprio negócio; senão
  "ainda aprendendo seu ritmo".

## 5. O padrão de "pacote de vertical" (o que muda de um negócio para outro)

Todo vertical novo é um pacote com seis peças. O motor, as travas, a auditoria e a central não mudam.

| Peça | Beleza | Imobiliária |
|---|---|---|
| Ontologia | Cliente, Serviço, Vaga, Profissional | Lead, Imóvel, Proprietário, Corretor, Visita, Proposta |
| Eventos | Agendou, compareceu, faltou, pagou | Entrou, foi contatado, visitou, propôs, fechou, perdeu |
| Cadência | Ritmo de retorno | Ritmo de retorno do lead (quando volta a pesquisar, visitar) e tempo de ciclo |
| Previsões | Retorno, falta, vagas, LTV | Chance de fechar, tempo até fechar, valor esperado, risco de esfriar |
| Ações | Chamar de volta, oferecer vaga | Ligar agora, mandar imóveis parecidos, agendar visita, follow-up pós-visita |
| Métrica norte | Lucro incremental | Comissão esperada ganha e ciclo encurtado |

## 6. Exemplo de expansão: imobiliária

**O que o dono quer saber:** em quanto tempo esse lead fecha, quanto vale (comissão esperada), quando
ele volta, e quem está esfriando.

**Previsões do pacote:**
1. **Chance de fechar** por lead (pontuação do lead) e **tempo até fechar** (análise de sobrevivência,
   que já foi planejada para o retorno de cliente).
2. **Valor esperado** = chance de fechar × comissão. Soma dá o **pipeline ponderado**, isto é, a previsão
   de comissão do mês, com faixa.
3. **Quando o lead volta** (ritmo de pesquisa e visita) e **risco de esfriar** (sem resposta ou sem
   follow-up).
4. **Conversão visita → proposta** por corretor e por imóvel.
5. **Melhor canal e horário** de contato.
6. **Locação:** chance de **renovar** ou sair, e vacância prevista do imóvel.
7. **Proprietário** em risco de trocar de imobiliária.

**Benchmarks do setor (blogs, a confirmar):** lead para contato efetivo 40% a 50%; contato para visita
35% a 45%; visita para proposta 35% a 45%; proposta para fechamento 30% a 40%; **conversão fim a fim de 2%
a 4%** (a mediana de um levantamento citado é 1,53%). Os dois gargalos apontados no Brasil:
**demorar mais de 30 minutos para responder** e **falta de follow-up entre a visita e a proposta**.

**Ações do motor:** "ligue agora para este lead, 41% de chance de visita", "mande 3 imóveis parecidos com o que
ele viu", "follow-up em 2 dias para quem visitou e não propôs", "reative estes 20 leads frios".

**Ponto de partida que já existe:** a demo Lang Imóveis tem o funil `novo, em contato, visita agendada,
proposta, fechado, perdido`. É a ontologia mínima.

## 7. Outros verticais no mesmo molde (exemplos)
- **Contabilidade e consultoria:** cadência nossa (entrega mensal), risco de atraso, risco de perder
  contrato, previsão de renovação.
- **Academia e escola:** risco de evasão por queda de frequência, LTV, turma com vaga sobrando.
- **Manutenção e limpeza:** rota do dia, visita atrasada, renovação do contrato.
- **Pet e clínica:** retorno de vacina e consulta, abandono de tratamento.

Regra para abrir cada vertical: **um negócio real piloto** antes de chamar de pacote pronto.

## 8. Riscos
- **Falsa precisão:** pouco dado por negócio. Mostrar intervalo, amostra e "ainda aprendendo".
- **Previsão vira promessa:** a tela diz "provável", nunca "garantido".
- **Generalizar cedo demais:** beleza primeiro, depois um vertical por vez.
- **Complexidade de modelo antes de ter dado:** F1 (empírico com intervalo) vem antes de qualquer
  modelo estatístico pesado, e prova se a previsão acerta.
- **Privacidade:** linhas de treino sem identificação e regra de exibição do `docs/92`; advogado.

## Fontes
- Funil imobiliário e benchmarks: https://imobisoft.com.br/blog/funil-de-vendas-imobiliario e https://imobilead.me/funil-de-vendas-imobiliario/
- Métricas de vendas no setor imobiliário: https://imobiliario.wsidm.com.br/blog/metricas-de-vendas-setor-imobiliario/
- Previsão probabilística de demanda intermitente: https://arxiv.org/pdf/2304.03092
- Reconciliação de previsões hierárquicas: https://robjhyndman.com/papers/hf_review.pdf e https://arxiv.org/pdf/2103.11128
- Previsão probabilística e decisão: https://www.griddynamics.com/blog/probabilistic-forecasting-demand-prediction
