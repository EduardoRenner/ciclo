# 101 · Anexo 06 · Amostra de impacto: escritório-modelo, roteiro, modo seguro, kit

> A amostra é entrega de primeira classe: uma demo fraca mata a tese; uma demo que mente mata a
> confiança. Nada aqui usa dado real. O repositório é público: tudo que entra nele é fictício e
> passa pelo teste de sanidade (anexo 05 §8).

## 1. O que a amostra precisa provar em 2 minutos

Que uma pessoa do escritório abre o app e, sem explicação, entende: (a) tem uma intimação que teria passado batido e o prazo interno
já está marcado; (b) tem um cliente travando um prazo por falta de documento, e a cobrança está pronta; (c) a estrutura da família
mostra quem controla o quê, e aponta um erro que estava escondido. O resto é profundidade.

## 2. O escritório-modelo

### 2.1 Identidade fictícia

Slug `demo-alvorada-advocacia`, nome "Alvorada Advocacia (exemplo)". Entra em `SLUGS_DE_DEMONSTRACAO` (`demonstracao.ts:56-70`) e
nasce com `tenants.is_demo = true`. Equipe fictícia: 1 direção, 2 advocacia (uma com OAB fictícia `00000/SC`, inválida de propósito),
1 estágio, 1 secretaria. E-mails `@ciclo.app`, senha de seed por variável (`SEED_SENHA`, padrão do `seed-demo-6-negocios.mjs:49`).

### 2.2 Volume

**[HIPÓTESE]** 30 contas (famílias e titulares), 4 famílias com holding (2 a 3 níveis, com participação cruzada), 70 pessoas, 14
empresas (3 externas), 55 casos em estados variados (12 holding, 10 inventário, 8 planejamento, 6 divórcio/partilha, 9 contrato/societário,
10 contencioso diversos), 300 pendências em estados variados (vencidas, quase completas, devolvidas em rodada 2), 120 documentos
(PDFs gerados com texto "exemplo"), 90 intimações nos últimos 90 dias, 60 prazos (fatais com interno, contratuais, audiências), 25 reuniões.

### 2.3 Realismo medido, não suposto

Os parâmetros vêm de observação pública **agregada** (`11` §8.1): cerca de 400 comunicações em 3 meses para uma OAB, 78% TJSC,
pico de 15 em um dia, 31 dias com publicação em 3 meses, só ~26% com "prazo de N" literal no texto, tipos "Intimação" 88%, "Lista de
distribuição" 7%, "Ata" 5%. Entram **só os agregados**: nenhum texto, nome de parte, número de processo ou órgão real. Os textos das
intimações fictícias são frases-modelo ("Fica a parte intimada, por sua advocacia, para se manifestar no prazo de 15 (quinze) dias
sobre o documento juntado. Exemplo fictício.") variadas por tribunal e tipo, com `siglaTribunal` em (TJSC, TRT12, TJSP, TRF4) e
órgão "Vara X (exemplo)".

### 2.4 Gerar por linha do tempo, derivar o agregado

O gerador (`scripts/seed-demo-escritorio.mjs`) **não fixa taxas**: cria uma linha do tempo de 18 meses e caminha dia a dia:
- abertura de casos a cada N dias úteis (N sorteado em 4..9), cada um com o modelo de checklist do tipo e datas relativas;
- a cada pendência, uma "resposta do cliente" sorteada numa distribuição com cauda (mediana 9 dias, 15% nunca respondem no período);
- intimações por dia útil (Poisson com média 1,3, pico forçado de 15 num dia), ~26% com "prazo de N";
- decisão de triagem no mesmo dia útil em 75% dos casos, no dia seguinte em 20%, nunca em 5% (ficam em "Exige direção");
- prazos derivados das intimações com "prazo de N" (`calcularPrazo` puro, com os feriados nacionais do seed e um feriado municipal
  fictício), confirmados em 90%, corrigidos em 10% (divergência);
- atos societários nas 4 holdings ao longo do tempo (constituição, cessão, doação com usufruto), e **uma inconsistência plantada**
  (soma 110% numa empresa, por um ato "esquecido");
- reuniões semanais com clientes diferentes.
Os agregados são **lidos do banco depois** e conferidos pelo teste de sanidade (anexo 05 §8). Mesmas lições do CICLO: seed respeita
constraints (sem sobreposição, `seed-demo-6-negocios.mjs:294-318`), grava `phone_hash` (`:35-43`), e nunca inventa proporção que
a tela depois mostre como verdade.

### 2.5 Reaproveitamento

- Do LUBI: a Família Ventura (`src/demo/data.ts:1-60`) vira a família 1 (nomes trocados para não coincidir com a demo do LUBI),
  a intimação de exemplo (`intimacoes-dados.ts:1-40`) vira o molde dos textos.
- Do CICLO: `seed-demo-6-negocios.mjs` (estrutura do script, limpeza por slug, dono + membership, expediente).

## 3. Oito cenários de efeito, em ordem

| # | Cenário | Tela | O que a pessoa vê | Por que impacta |
|---|---|---|---|---|
| 1 | A intimação que teria passado | Hoje | item "Intimação nova · TJSC · vinculada ao caso X", disponibilizada ontem, prazo interno já calculado "fazer até sex 22/10 · fatal ter 26/10" | é o medo número 1 do escritório sem software |
| 2 | Cobrar em um toque | Cliente 360 → Pendências | "Matrícula do imóvel · 12 dias de atraso · trava prazo" → [Cobrar] abre o WhatsApp com texto pronto e sem dado do caso | resolve a dor que a Dra. Katiane relatou |
| 3 | Quem controla de verdade | Estrutura | Antônio tem 60% direto da holding e 60% efetivo da operacional; e a soma de uma empresa está em 110% (selo vermelho) | mostra o que planilha e Word escondem |
| 4 | E se | Simulador | mover 10% de Antônio para Marina muda a efetiva de cada pessoa; rodapé `precisa_revisao` | conversa de planejamento ao vivo, sem prometer resultado |
| 5 | Linha do tempo única | Cliente 360 → Linha do tempo | quem fez o quê, quando, inclusive "documento aberto por Secretaria" | fim de caçar em planilha e WhatsApp |
| 6 | Retroteste | Hoje → faixa "Simulação" | "Nos últimos 90 dias este painel teria capturado 90 intimações e antecipado 23 prazos" (calculado do seed, rotulado simulação) | número que vem do próprio dado, não de slogan |
| 7 | Antes e depois | Pendências → "Quanto tempo isto custa" | premissas editáveis (minutos por cobrança, cobranças por semana) → horas/mês; nunca número fixo | respeita a inteligência de quem olha |
| 8 | Mapa de pendências por pessoa | Hoje → filtro Equipe | quem segura o quê, sem ranking de pessoa | direção vê gargalo sem expor ninguém |

## 4. Modo demonstração seguro

- **Faixa** em toda tela do tenant demo: frase 40 do anexo 04 ("Dados fictícios de demonstração. Nenhuma pessoa, empresa ou processo
  aqui existe."), não dispensável, `role="status"`.
- **Reiniciar cenário**: botão em Configurações do tenant demo que chama `POST v1/demo/reset` (rota `fora` da pausa; só funciona em
  tenant `is_demo` e só com `DEMO_RESET_HABILITADO = true`), que reexecuta o gerador. Fora da demo, 404.
- **Impossível misturar**: (a) `tenants.is_demo` é lido no servidor por `enviarComFallback` (já pula demo pela lista,
  `demonstracao.ts:25-27`), pelo sitemap e pelo robots; (b) a rota de onboarding recusa criar conta Advocacia real com
  `ADVOCACIA_ABERTA = false` (T0.6); (c) não existe rota que mude `is_demo` de `true` para `false` (coluna só escrita por migration e
  seed; política sem UPDATE para `authenticated`); (d) eventos de produto de tenant demo levam `demo: true` e o relatório os exclui;
  (e) `audit_log` do tenant demo é apagado no reset (é o único lugar onde a trilha pode ser apagada, e só porque é demo).
- **Ligado por variável**: `NEXT_PUBLIC_DEMO_SLUG` aponta o slug que a landing oferece em "Ver um escritório de exemplo";
  ausente, nenhum link aparece. Em produção, o tenant demo existe mas só é alcançado por quem tem o link ou faz login nele.
- **Testes**: integração `demo-nao-mistura.test.ts`: mensagem para cliente do tenant demo não é enviada (contagem em `messages` = 0);
  `UPDATE tenants set is_demo = false` por `authenticated` → 0 linhas; onboarding `advocacia` com chave desligada → recusado;
  `POST v1/demo/reset` em tenant real → 404; sitemap não contém o slug demo. Mutação: tirar o `if (is_demo)` da mensageria → teste reprova.

## 5. Roteiro de demonstração

### 5.1 Versão de 5 a 7 minutos (falada, tela a tela)

1. **Abertura (30 s)**: "Isto é um escritório fictício. Vou mostrar o que acontece de manhã quando a pessoa abre." Abrir Hoje.
2. **Hoje (90 s)**: apontar a intimação de ontem já vinculada; abrir a triagem; ler a memória de cálculo em voz alta; mostrar que a
   data **vem vazia** porque a regra ainda não foi confirmada pela direção ("o sistema sugere e explica; quem confirma é a pessoa");
   confirmar; mostrar o prazo interno 2 dias antes.
3. **Pendências (60 s)**: abrir o centro; "Família Ventura (exemplo), 3 pendências, uma trava prazo"; tocar em Cobrar; mostrar o texto
   pronto sem dado do caso; "nada sai sozinho".
4. **Cliente 360 (60 s)**: topo "Próximo passo"; seções; linha do tempo com "documento aberto por".
5. **Estrutura (90 s)**: grafo; participação efetiva; a soma em 110% em vermelho ("isto estava numa planilha há dois anos"); simulador
   "e se" com o rodapé de revisão.
6. **Retroteste (30 s)**: a faixa "simulação"; "esse número vem do próprio dado, não de slogan".
7. **Fechamento (60 s)**: perguntas: "qual destes você usaria amanhã?", "o que faria você não usar?", "quanto pagaria por mês para o
   escritório inteiro?", "quem mais precisa disso?".

**O que dizer**: "sugestão", "a pessoa confirma", "fictício", "o escritório é dono dos dados", "nada é enviado sozinho".
**O que não dizer**: "especialista", "garante", "calcula o prazo" (sem "sugere"), "inteligência artificial", qualquer promessa de
resultado ou de redução de custo em número fixo, nome de concorrente.

### 5.2 Versão de 2 minutos (vídeo)

Hoje com a intimação (20 s) → triagem com memória e data vazia → confirmar (30 s) → Pendências → Cobrar → texto pronto (30 s) →
Estrutura com o 110% (30 s) → legenda final: "Dados fictícios. O sistema sugere, a pessoa decide." (10 s). Sem narração de ganho.

### 5.3 Perguntas que coletam sinal

Depois da demo, as mesmas quatro do fechamento, anotadas em `docs/entrevistas/<data>-<iniciais>.md` (sem nome completo), com a
frase exata e se houve compromisso por escrito. Sinal forte: pedir para usar com dado real, perguntar preço antes de ser perguntado,
indicar alguém. Sinal fraco: "interessante", "bonito".

## 6. Amostra viva (OAB real): análise e recomendação

**Ideia**: a pessoa digita a própria OAB e vê, na hora, o que o DJEN publicou para ela nos últimos 90 dias.

| Dimensão | Análise |
|---|---|
| Fonte | API pública, sem login, filtra por OAB (`11` §0, medido em 06/10). O dado é público por definição (diário oficial). |
| LGPD | As comunicações trazem **nome de partes** (`destinatarios`) e, no texto, dados do processo. Exibir sem conta e sem aceite é tratamento de dado de terceiros sem base clara para o CICLO (o escritório tem base; o CICLO, antes do contrato, não). |
| Abuso | Qualquer pessoa digita a OAB de outra: o dado é público, mas a agregação por nós, com busca fácil, muda o risco e expõe o CICLO. |
| Provimento 205/2021 | Mostrar "veja o que você perdeu" na landing pode ser lido como captação por mensagem de medo; a cautela é do escritório, não do CICLO, mas respinga. |
| Técnica | Teto de ~200 únicas por consulta (`11` §8.1) obriga consulta dia a dia: 90 dias = 90 chamadas por OAB. Rate limit do DJEN desconhecido. |

**Recomendação: não fazer agora.** A prova viva acontece no produto, no primeiro dia de uso real: a pessoa cadastra a OAB **depois** de
criar a conta e aceitar o adendo, e a captura começa (com os 90 dias de catch-up, que é o retroteste de verdade).

**Se o Eduardo insistir, o desenho de menor risco**: (a) só **contagens** (por tribunal e por dia), nunca texto nem nome; (b) sem gravar
nada (resposta efêmera, sem `legal_intimations`); (c) rate limit por IP e por OAB (3/dia); (d) exige e-mail confirmado antes
(fricção deliberada); (e) texto da tela revisado pelo advogado; (f) registro em `docs/DECISOES.md`. Mesmo assim, fica fora do MVP.

## 7. Kit de amostra para o Eduardo

| Peça | Conteúdo | Marcação |
|---|---|---|
| Link da demo | `https://<app>/<slug-demo>` com login de visitante somente leitura (conta `visitante@` com papel `reception`, MFA ativa, senha trocada a cada demo) **[DECISÃO PENDENTE: login de visitante ou vídeo]** | |
| Roteiro falado | §5.1, impresso em uma página | |
| Vídeo de 2 min | §5.2 | sem narração de ganho |
| One-pager | o que é, para quem, como funciona (sugere, pessoa decide), segurança em 5 linhas (isolamento, segundo fator, trilha, cofre, nada apagado), o que não é (não é gestão processual completa, não envia nada sozinho, não é IA) | `precisa_revisao` (publicidade) |
| FAQ de objeções | "E se vazar?" (isolamento testado por introspecção e matriz; segundo fator; trilha de quem abriu o quê; resposta a incidente); "Já uso Astrea" (não substitui; organiza o patrimonial e o que falta do cliente; pode conviver); "Quem calcula o prazo?" (a pessoa; o sistema sugere e mostra a conta); "E o sigilo?" (caso sigiloso só para a equipe dele; nada vai para IA); "Onde ficam os dados?" (Supabase São Paulo, `docs/00-BRIEFING.md:81`; o escritório exporta e elimina quando quiser) | respostas honestas; números só os medidos |
| O que mostrar a cada perfil | contencioso: Hoje e triagem; patrimonial: Estrutura, Pendências; direção: filtro "Exige direção", trilha; secretaria: Pendências e Cobrar | |
| Pedido ao Dr. Miguel (texto) | "Para o cálculo de prazo ficar pré-preenchido com segurança, precisamos de 50 intimações reais, anonimizadas (sem nome de parte), com a data do prazo que você calculou à mão, cobrindo cível, trabalhista, juizado, recesso e feriado municipal. Até lá o sistema mostra a conta e pede a data. Também precisamos do número e UF da OAB de cada pessoa da advocacia da equipe." | |
