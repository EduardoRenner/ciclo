# O CICLO hoje, para a profissional da beleza (lido do código em 16/10/2026)

Base da comparação com os concorrentes. Branches conferidas:
- `integracao/norte-2026-10-16` (PR #152: a pilha inteira que vai para a `main`);
- `modelo/cadastro-e-preco-2026-10-16` (PR #153: preço novo e cadastro sem e-mail).

**A produção (`main`) está atrás das duas, até a revisão do Eduardo.**

## Preço

| | Hoje na `main` | Com o PR #153 |
| --- | --- | --- |
| Entrada | Solo, R$ 49, 1 profissional | **Essencial, R$ 39, até 2 profissionais** |
| Equipe | R$ 99, até 5 | **R$ 79, até 6** |
| Teste | tudo liberado como cortesia (`ACESSO_ABERTO`) | igual; o teste de 30 dias (M2) entra no lançamento de 11/01/2027 |
| Taxa por serviço ou comissão | nenhuma | nenhuma |

## O que existe (FATO, arquivo de origem)

| Recurso | Onde está | Observação para a beleza |
| --- | --- | --- |
| Agenda sem marcar duas no mesmo horário | módulo `agenda`, constraint `appointments_no_overlap` | sempre ligado |
| **Motor de Ciclo:** quem passou da hora de voltar, com valor e "Chamar pelo WhatsApp" | `cycle_engine`, `src/app/admin/recuperar/` | ritmos do pacote: manutenção de cílios 21 dias, gel 18, manicure 15, design de sobrancelha 21 (`0002_vertical_packs.sql`). Desde o PR #152, sem a linha de lucro |
| Serviço de volta marcado ao trazer a clientela | `servicoPadraoDaBase`, PR #152 | cílios vem com a manutenção, não com a aplicação (medido em 16/10) |
| Página pública de agendamento **sem conta para a cliente** | `src/app/(public)/[slug]/agendar` | só a página do negócio, sem vitrine de concorrente |
| **Sinal** mostrado na página pública | `deposit_bps` e `agendar.tsx` | pacote de cílios já nasce com sinal de 30%. Mostra e combina, não cobra (sem provedor de pagamento) |
| **Anamnese com campos de cílios** (reação à cola, cirurgia ocular, gestante) | `health_records`, campos do pacote `lashes` | dado de saúde cifrado, com trilha de quem acessou |
| Fotos por cliente | `src/app/admin/clientes/[id]/fotos.tsx` | conferir se serve como antes e depois |
| Lembrete e confirmação | módulo `reminders`, `api/cron/reminders` | **o envio automático por WhatsApp depende da credencial da Meta, que não está em produção**; hoje o caminho é o WhatsApp da própria profissional |
| Pacotes, clube de assinatura, fidelidade, campanhas, estoque, comissão, caixa | módulos `club`, `loyalty`, `campaigns`, `stock`, `team`, `register` | tudo incluído nas duas faixas |
| Importar a clientela: de memória, colando lista, planilha (Excel/CSV), contatos, conversa do WhatsApp, PDF, **print de tela** | `ja-atendo`; esteira do conversor (no PR #152) | mostra o dinheiro parado antes de gravar e deixa desfazer em 7 dias |
| Exportar tudo | `api/v1/clients/export`; `api/v1/account/export` (conversor) | exige verificação em duas etapas (ver CONV-05) |
| App nas lojas | PR #151, dentro do #152 | ainda não publicado |
| Cadastro sem depender de e-mail | PR #153 | falta desligar a confirmação no Supabase de produção |

## O que não existe (para a beleza)

- **Cobrança de sinal de verdade:** link de pagamento, baixa automática e devolução. Hoje só mostra.
- **WhatsApp automático com número próprio:** depende da Meta.
- **"Ficou devendo" (fiado):** não existe registro de quem deve.
- **Atender na casa da cliente:** o eixo "onde" é gravado por profissão, mas nenhuma tela o lê; manicure e cílios não oferecem "vou até você".
- **App da cliente com a marca do negócio:** não é objetivo; a cliente usa a página.
- **Nota fiscal.**
