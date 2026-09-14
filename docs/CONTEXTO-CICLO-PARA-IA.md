# CICLO — resumo de contexto (pra colar em qualquer IA)

## O que é

CICLO é um SaaS de gestão para **qualquer profissional que tem agenda e clientes que voltam** —
não só o nicho de beleza (barbearia, salão, unhas, estética, depilação), mas também faxineira,
eletricista, personal trainer, dentista e afins. Web app mobile-first, em português do Brasil,
multi-tenant (cada negócio tem sua própria conta isolada).

**O produto central não é a agenda — é o Motor de Ciclo.** O sistema aprende de quanto em quanto
tempo cada cliente costuma voltar, detecta quem já passou do tempo e sumiu, e ajuda o dono a
trazer essa pessoa de volta. A agenda existe para sustentar isso, não o contrário.

## O diferencial (a frase que resume tudo)

> **Nos concorrentes, o cliente é da plataforma e o salão aluga o acesso. No CICLO, o cliente é do
> salão.**

Os líderes do nicho (AppBarber, BestBarbers, Fresha, Booksy) têm um app próprio que o cliente
final baixa — e esse app mostra pro cliente uma **lista dos concorrentes** do salão, porque é
assim que o app do concorrente ganha valor de rede. Alguns ainda cobram comissão (a Fresha cobra
20% em todo cliente novo vindo do marketplace deles).

O CICLO não tem app do cliente, não tem marketplace, não cobra comissão por agendamento. O cliente
agenda direto pelo link do próprio negócio (`seudominio.com/nome-do-salao`), sem baixar nada, sem
criar conta, e **sem nunca ver a concorrência**. É assinatura mensal fixa, ponto.

Isso não é decisão de marketing — é arquitetura: construir um marketplace destruiria exatamente o
que faz o CICLO diferente, então está vetado de propósito.

## Prova de ROI que nenhum concorrente pesquisado tem

O CICLO calcula e mostra, em reais, **quanto dinheiro o Motor de Ciclo trouxe de volta este mês**
— não é "quantos agendamentos", é atribuição de receita de verdade a partir de clientes que
tinham sumido e voltaram por causa do lembrete automático.

## Funcionalidades (o que já está pronto e em produção)

- **Agenda** — criar, remarcar, cancelar, detecção de conflito, recorrência
- **Página de agendamento pública** — o cliente marca sozinho, sem app, sem conta, sem ver
  concorrente nenhum
- **Motor de Ciclo** — previsão de retorno por cliente + tela "Recuperar receita" com campanha de
  reativação
- **CRM / ficha do cliente** — histórico, notas, tags, importação em massa por CSV
- **Comanda e caixa** — abrir atendimento, adicionar serviço/produto, desconto, fechar com
  Pix/cartão/dinheiro
- **Produtos de revenda** — cadastro com margem, venda direto na comanda (xampu, óleo etc., não
  só o que é usado no atendimento)
- **Estoque** — alerta de reposição, custo médio
- **Orçamento** — criação e aprovação por link, sem precisar de conversa
- **Fidelidade / clube de assinatura** — pontos, prêmio configurável, plano recorrente pro
  cliente final
- **Campanhas e lembretes por WhatsApp** — hoje via link manual (o dono aperta um botão e o
  WhatsApp já abre com a mensagem pronta); o envio 100% automático já está codificado, só falta a
  conta comercial da Meta ser habilitada
- **Sinal via Pix** na reserva — reduz no-show em 60-80%
- **Relatório de lucro** — sobrou de verdade por atendimento (desconta custo de material, taxa de
  maquininha, custo fixo rateado), não só "faturou X"
- **Equipe e comissão** — agenda por profissional, comissão calculada
- **Indicação** — o cliente final indica outro cliente (B2C) e o dono indica outro dono (B2B)
- **Anamnese e ficha de saúde com cofre criptografado** — pra quem atende saúde/estética invasiva
- **Assistente de IA** — responde perguntas rápidas sobre o próprio negócio dentro do painel

## Planos e preço

| Plano | Preço/mês | Quem é |
|---|---|---|
| Grátis | R$ 0 | 1 profissional, até 50 clientes, sem envio em lote |
| Essencial | R$ 49 | 1 profissional, clientes ilimitados, comanda, campanhas |
| Equipe | R$ 99 | até 5 profissionais, comissão, relatórios, fidelidade |
| Avançado | R$ 179 | ilimitado, estoque, anamnese/cofre, recorrência avançada |

Comparado à concorrência: AppBarber cobra R$ 79,90-219,90, Trinks R$ 76-110, Fresha/Booksy cobram
mensalidade **+ comissão por cliente novo**. O CICLO já é o mais barato **e** sem comissão nenhuma
— mas o preço baixo não é o argumento principal, é só consequência de não ter os custos que um
marketplace tem.

## Stack técnica (se a conversa for técnica)

Next.js 15 + Supabase (Postgres com isolamento por linha entre negócios, RLS), hospedado na
Vercel, banco na região São Paulo. pt-BR de ponta a ponta, mobile-first.

## Estado atual (setembro/2026)

Produto tecnicamente pronto e testado. O que falta pra vender é majoritariamente fora do código:

- Conta ativa no Mercado Pago (o botão de assinatura automática já existe no produto, só falta a
  credencial real)
- CNPJ
- Confirmar domínio próprio
- Revisão jurídica dos termos de uso / política de privacidade (LGPD)
- Decidir canal de suporte
- Conta comercial do WhatsApp (Meta) — opcional pro lançamento; o link manual já funciona hoje

Zero clientes pagantes até agora — só contas de demonstração.

## Público-alvo pra pensar estratégia de venda

Primário: barbearias, salões de beleza, estúdios de unha/cílios/sobrancelha, esteticistas —
donos que já sentem o problema de "cliente some e eu não sei quem chamar de volta".

Secundário, ainda pouco explorado: qualquer profissional com agenda + cliente recorrente fora de
beleza (faxineira, eletricista, personal trainer, dentista) — o produto já suporta, mas a
comunicação/posicionamento ainda fala majoritariamente com o público de beleza.
