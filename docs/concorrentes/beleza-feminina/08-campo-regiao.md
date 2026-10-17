# Levantamento de campo: profissionais da região de Maravilha (16/10/2026)

O Eduardo abriu, um a um, os perfis de profissionais da beleza da região (Maravilha, Chapecó e Pinhalzinho, DDD 49) no Instagram e no WhatsApp Business, e mandou os prints.

**Este arquivo é agregado.** Nome e telefone ficam numa planilha local, **fora do repositório**, que é público: `C:/Users/Usuario/.claude/code/leads-privados/`. Ela serve à abordagem um a um do kit de campo, com a opção de não receber mais.

## O que os 16 perfis mostram (FATO, prints de 16/10/2026)

| Achado | Contagem |
| --- | --- |
| Perfis olhados | 16 profissionais, mais 3 canais (uma mentora de unhas, um congresso de lash, um concorrente) |
| Nicho principal | cílios 9 · sobrancelha 1 · unhas 2 · cabelo 1 · a confirmar 3 |
| **Fazem mais de um serviço** | pelo menos 9 de 13 com nicho conhecido: cílios + sobrancelha + lash lifting + brow lamination é o pacote comum; também unhas + cabelo, sobrancelha + cabelo e cílios + lábios |
| **Usam link de agendamento ou sistema** | **0 de 16.** Todas agendam por `wa.me`, pelo telefone na bio ou pelo direct |
| WhatsApp Business com catálogo de fotos | 6 de 16: o catálogo do WhatsApp faz o papel de vitrine e de site |
| Horário configurado no WhatsApp | 4 de 16; 3 delas "somente com hora marcada" e uma "aberta 24 horas" (sinal de que não configuram) |
| Preço público nos destaques do Instagram | 2 de 16 (ex.: extensão de cílios R$ 140, manutenção R$ 70; promoção R$ 200 e R$ 240) |
| Atende a domicílio | 1 de 16 declarado (unhas) |
| Têm página no Google | nenhuma visível nos prints: são encontradas pelo Instagram e por indicação (observação do Eduardo) |

## O que isso confirma, e o que muda

1. **O concorrente de verdade aqui é o WhatsApp.** Ninguém dos 16 usa sistema. Isso bate com o Sebrae: 82% dos pequenos negócios vendem pelo WhatsApp (`03-mercado.md`).
2. **Elas fazem vários serviços,** do mesmo nicho e de nichos vizinhos.
   - O onboarding do CICLO pede **uma** profissão. Hoje uma designer que faz cílios e sobrancelha começa com o pacote de um só e cadastra o outro à mão.
   - **Candidato a conserto barato:** escolher mais de uma especialidade no primeiro passo e juntar os pacotes (cílios + sobrancelha é o caso nº 1).
3. **"Ninguém acha elas no Google"** é uma dor que o CICLO já pode resolver.
   - A página pública do CICLO é uma página de verdade, indexável, com endereço, serviços e o botão de agendar.
   - É o "link da bio" que falta a 16 de 16, e de quebra põe a profissional no Google.
   - **Argumento de venda:** "sua página no Google e no link da bio, sem pagar site".
   - A confirmar no código: título, descrição e dados estruturados da página pública.
4. **O catálogo do WhatsApp mostra o que ela valoriza:** fotos do trabalho. A página pública do CICLO precisa de fotos dos trabalhos. Já existe a seção de fotos da página (`secoes.tsx`); conferir se ela sobe as fotos com facilidade pelo celular.

## Concorrente novo: LashLab Pro

Achado pelo Eduardo no Instagram (@lash.lab.pro), depois conferido no site `lashlabpro.com.br` em 16/10/2026 (FATO).

- **O que é:** "sistema clínico para lash designers".
  - Anamnese digital com classificação de risco automática.
  - Controle de validade do adesivo pela umidade e temperatura.
  - Análise por IA das respostas e das fotos.
  - Relatórios com assinatura eletrônica.
  - Agenda online com lembrete automático por WhatsApp.
  - Estoque, financeiro e calculadora de custo por serviço.
  - Modo offline, exportação (CSV/JSON) e app instalável.
- **Diz:** "protocolos validados" por um médico, e que "não substitui avaliação médica".
- **Preço:**

  | Plano | Preço | O que inclui |
  | --- | --- | --- |
  | Bronze | R$ 49,90/mês | agenda, cadastro, anamnese, histórico |
  | Prata | R$ 79,90/mês | estoque, relatórios, 45 análises de IA por mês |
  | Ouro | R$ 139,90/mês | financeiro, equipe, análise do adesivo, 90 análises de IA |

  Há uma oferta anual de R$ 89,90 por mês com kit físico. O teste é grátis, sem cartão, de 7 dias.
- **Como divulga:** posts que perguntam "seu app de agenda entende a sua profissão?" e "comente LAB e receba um presente no direct".

**INFERÊNCIA:**
- **O nicho de cílios já é disputado por um especialista** com discurso clínico e de segurança ocular. O CICLO não ganha dele em profundidade técnica de cílios, nem deve tentar.
- **O CICLO ganha no que ele não fala:** quem passou da manutenção e quanto vale chamar (o LashLab Pro organiza o atendimento, não traz a cliente de volta), e servir a quem faz cílios, sobrancelha, unhas e cabelo.
- **Ele confirma a anamnese com assinatura eletrônica como o básico do nicho.** O CICLO tem a anamnese com os campos de cílios, mas não a assinatura.
