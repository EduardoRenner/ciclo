# 118 · Lista de publicação do lançamento (21/10/2026)

Pedido do Vitor: "subir quando fechar". Quem publica é o Vitor com a sessão da marca; o loop só preparou e conferiu. Nada aqui foi feito em produção.

**O que sobe:** branch `marca/feminina-2026-10-20`, com F3 (logo final), EXP-S01 parte 2 (prints), RET-01 (Recuperar com a mensagem do negócio), L-02 (Sou profissional / Sou cliente), L-03 (número + senha, sem e-mail) e L-04 + AGD-01 (agendar a partir de amanhã, já confirmado). Cada um tem a linha dele em `docs/112-experiencia/_progresso.md`.

---

## 1. Como a branch chega na main

- A branch está **327 commits à frente** de `origin/main` e a main é ancestral dela (nada na main que a branch não tenha): o merge é avanço rápido, sem conflito.
- O PR #155 (rascunho) está parado em `1caeaacb`. Tudo depois disso é local.
- **O PR #155 é empilhado:** a base dele é `produto/foco-beleza-2026-10-16`, não a `main` (conferido com `gh pr view 155`, 21/10). Merge assim cai na branch de baixo e **não chega na produção**. Antes do merge, trocar a base do PR para `main` (botão "Edit" ao lado do título) ou abrir um PR novo direto para a `main`. A `main` é ancestral desta branch, então a troca não cria conflito; o PR passa a mostrar também os commits da `produto/foco-beleza-2026-10-16`, que vão juntos.
- Passos (Vitor):
  1. empurrar a branch;
  2. trocar a base do PR #155 para `main`, tirar do rascunho e esperar a CI;
  3. abrir a prévia da Vercel **no celular** e fazer as jornadas da seção 5;
  4. aplicar as migrations **pré-deploy** (seção 2) na produção;
  5. merge na main (deploy);
  6. aplicar as migrations **pós-deploy**;
  7. configurar o Supabase e a Vercel (seções 3 e 4) e conferir de novo (seção 5).

> A Vercel bloqueia deploy de commit cujo autor não é do time: os commits estão como Vitor (`inovacoesstark@gmail.com`).

## 2. Migrations

Produção está na **0118** (lido pela sessão da marca no livro de migrations, só leitura). Faltam da **0121 à 0146**. Os números 0101, 0119 e 0120 não existem no repositório: a 0101 virou 0102 (renomeada) e as outras duas nunca existiram. O buraco é esperado.

### Antes do deploy (aditivas, na ordem numérica)

0121, 0122, 0123, 0124, 0125, 0126, 0128, 0129, 0130, 0131, 0132, 0133, 0134, 0136, 0137, 0138, 0140, 0141, 0142, 0143, 0144, 0145, 0146.

- **Precisam estar no banco antes do código novo:** 0134 e 0138 (o código grava ciclo e previsão com `onConflict` que inclui `subject_id`), 0142 (perfil de quem entra pelo número) e 0143 (convite pelo WhatsApp, que agora é obrigatório na tela).
- 0123 e 0124 reescrevem políticas de leitura de agendamento e comanda (mesma regra, consulta mais leve): rodar `test:rls` antes e depois na prévia, como o arquivo pede.
- **Mexem em dado existente:** 0144 e 0145 (sinônimos e ordem das profissões; podem rodar duas vezes), 0146 (catálogo de salão; **não pode rodar duas vezes**, acrescentaria os serviços de novo nos pacotes), 0140 (pacote da oficina; o `drop constraint` sem `if exists` falha se rodar duas vezes).

### Depois do deploy (restritivas)

| Migration | O que tira | Por que depois |
|---|---|---|
| 0127 | Comanda fechada congelada; `revoke delete on tickets`; item só sai de comanda aberta | o código antigo ainda apaga comanda |
| 0135 | Troca a chave primária de `client_cycles` (passa a ter o sujeito) | o código antigo grava com a chave de 3 colunas; reescreve a tabela com trava: **rodar fora do horário do job do Motor** |
| 0139 | Tira a chave única antiga de `cycle_predictions` | o código antigo grava a previsão com a chave antiga |

### Como aplicar fora de ordem

`supabase db push` aplica na ordem e não pula número. Dois jeitos:

- rodar cada arquivo pelo SQL Editor do projeto de produção, na ordem acima, e depois registrar no histórico com `supabase migration repair --status applied <número>` para cada um; ou
- aplicar as aditivas até a 0126 com o `db push`, e daí em diante uma a uma pelo SQL Editor (a 0127 é a primeira restritiva).

Depois do passo 6, o histórico de produção tem de listar da 0121 à 0146.

## 3. Supabase de produção (painel)

O cadastro passou a ser com número + senha, sem e-mail (L-03). Sem estes ajustes o cadastro **não abre a conta**: a rota recusa, a tela mostra erro e o log da Vercel registra `signup_numero_sem_sessao`.

1. **Authentication > Providers > Phone:** ligar, com cadastro permitido.
2. **"Confirm phone" (confirmação de telefone): DESLIGADO.** O código pelo WhatsApp depende da Meta, que não está ligada. Volta a ligar quando a Meta estiver no ar (`docs/runbooks/meta-para-leigos.md`).
3. Se o painel exigir um provedor de SMS para ligar o Phone, conferir na tela qual a exigência antes de escolher; o cadastro sem confirmação não manda SMS nenhum. **Não testado** fora do Supabase local: conferir na prévia.
4. **Authentication > URL Configuration:** Site URL com o domínio de produção, não `localhost` (o painel volta para localhost quando a configuração não vai junto da migração).
5. E-mail continua existindo só para contas antigas (entram digitando o e-mail no campo do WhatsApp).

## 4. Vercel (Production)

| Variável | Valor | Para quê |
|---|---|---|
| `WHATSAPP_SUPORTE` | `+5549999691700` (número do Vitor, com o 9) | botão "Falar com a equipe no WhatsApp" em `/recuperar-senha`; sem ela a tela mostra só o texto |
| `NEXT_PUBLIC_APP_URL` | o domínio de produção | conferir que não está `localhost:3000` (M5 do F1) |

Não são variáveis: `CICLO_COBRANCA` (constante no código, desligada), `ENTRAR_COM_CODIGO` (constante, desligada). As variáveis da Meta (`WHATSAPP_PHONE_NUMBER_ID` etc.) só entram quando a Meta for ligada.

Depois de mexer em variável, novo deploy.

## 5. O que conferir (prévia e depois produção), no celular

**Profissional**
- `/entrar` pergunta "Como você usa o CICLO?"; "Sou profissional" mostra WhatsApp + senha.
- Cadastro: nome, WhatsApp e senha → cai no onboarding (se cair em erro, é a seção 3).
- Sair e entrar com o número e a senha; senha errada diz "WhatsApp ou senha não conferem".
- Conta antiga: entrar digitando o e-mail no campo do WhatsApp.
- `/recuperar-senha` com o botão do WhatsApp da equipe.
- Configurações > Negócio: "Aceitar horário para hoje pelo link" desligado por padrão.
- Recuperar: com o "Sumiu, chamar de volta" editado em Mensagens, o botão do WhatsApp abre com o texto editado.
- Logo final no cabeçalho (preta no claro, branca no escuro), favicon e ícone na tela de início.

**Cliente** (link de um salão com WhatsApp cadastrado)
- O trilho de dias começa amanhã; "Para hoje, chame no WhatsApp" abre com a mensagem pronta.
- Marcar → "Horário marcado · Já está na agenda de {salão}"; na agenda da profissional o horário aparece **confirmado**.
- O link colado no WhatsApp mostra a prévia com a imagem nova (`/`, `/links`, `/calculadora`).

**Logs da Vercel:** nenhum `signup_numero_sem_sessao` nem `signup_recusado` nas primeiras horas.

## 6. Riscos e pendências do Vitor

- **Número sem verificação:** dá para cadastrar o número de outra pessoa até a Meta voltar (decisão registrada em `docs/DECISOES.md`, 21/10).
- **Cadastro com número repetido** diz que o número já tem conta (não há como esconder com o número sendo o login).
- **Cor de destaque:** o app segue o rosé e ameixa do docs/109; ao lado do azul e rosa da logo pode destoar. Decidir se o destaque vira o azul.
- **Contas de demonstração antigas** (Studio Bella, Espaço Vitória) têm cliente homem em serviço feminino no seed; apagar ou não é do Vitor. A da Carol não tem vaga nos dois primeiros dias (M1 do F1).
- **Meta:** com ela ligada, voltam a verificação do número, o código pelo WhatsApp, o "esqueci a senha" sozinho e os lembretes automáticos.
