# 112 · 01 · Diagnóstico: as 13 jornadas medidas hoje (21/10/2026)

**Onde:** worktree `ciclo-marca`, branch `marca/feminina-2026-10-20`, Supabase **local isolado** (127.0.0.1:57821), `next dev` na porta 3041, viewport 375×812 com toque emulado. Contas semeadas com `scripts/seed-demo-6-negocios.mjs`, `seed-tenant-teste.mjs` (`demo-studio-olhar`, cílios; `demo-esmalteria-rosa`, unhas com equipe), `seed-demo-agenda-futura.mjs` e `seed-demo-dinheiro.mjs`.

**Limite desta medida (ler antes):** o servidor é de **desenvolvimento**, que compila cada tela na primeira visita (medido: 5 a 16 s na primeira abertura de `/admin/recuperar`, `/admin/agenda/novo` e `/admin/caixa`). Por isso **tempo de tela não vale aqui**: conto **toques**, **dúvidas** e **erros**. Os tempos de verdade, em build de produção, estão em `06-desempenho.md`. Toque = cada toque ou campo digitado; rolagem não conta.

## Resumo

| # | Jornada | Meta (A7) | Hoje | Situação |
| --- | --- | --- | --- | --- |
| P1 | Cadastro até a primeira cliente marcada | ≤ 15 toques | **≈ 17** (9 até o painel pelo número + 8 para marcar) | fora da meta |
| P2 | Saber o que fazer hoje | 0 toques | **0** | dentro, com 2 dúvidas |
| P3 | Chamar quem passou do dia | ≤ 2 toques | **2** | dentro, com 2 defeitos |
| P4 | Marcar quem pediu pelo WhatsApp | ≤ 6 toques | **≈ 8** | fora da meta |
| P5 | Fechar o dia | ≤ 10 s | **2 toques**, mas o dia só aparece com comanda fechada | parcial |
| P6 | Dona traz uma profissional | ≤ 1 min, sem e-mail | **não dá**: o convite exige e-mail | bloqueado |
| P7 | Dona vê a agenda de todas | ≤ 2 toques | NÃO MEDIDO | — |
| C1 | Link na bio até o horário marcado | ≤ 8 toques | **7** | dentro, com 3 atritos |
| C2 | Lembrete e confirmar | 1 toque | **não chega**: nenhum link de confirmar sai hoje | bloqueado |
| C3 | Remarcar sozinha | ≤ 3 toques | **não existe** | — |
| C4 | Voltar na hora da manutenção | aviso no dia certo | **não existe do lado dela**; só a profissional chama, depois do dia | — |
| C5 | Conta pelo número e "meus lugares" | ≤ 30 s | **não existe** (L3 a L5 do `docs/110`) | — |
| C6 | Apagar a conta e baixar os dados | ≤ 1 min | **não existe** para a cliente | — |

## Profissional

### P1 · Do cadastro à primeira cliente marcada (FATO, 20/10, conta `studio-ana-teste`)
- Entrar por número: nome, WhatsApp, "Mandar código", código, "Entrar" = **5**.
- Cadastro do negócio: nome, profissão, "Colocar minha página no ar" = **3**.
- Perguntas do perfil: "Pular tudo e ir pro painel" = **1**.
- Marcar a primeira cliente (ver P4) = **≈ 8**.
- **Dúvida:** o placeholder da profissão dizia "barbeiro, diarista, personal" (já trocado na F3). O agente de salão achou que digitar "lash" **não acha Cílios** e oferece "Outra profissão", que nasce **sem nenhum serviço** (`04-salao.md`). NÃO MEDIDO no navegador.

### P2 · O que fazer hoje (FATO, `demo-studio-olhar`)
0 toques. A primeira tela traz "A seguir" (com "Chegou" e "Mensagem"), o resto do dia e "Dá para recuperar R$ 355,40 · 6 clientes".
- **Dúvida 1:** logo abaixo, "Vale a pena hoje: **5** clientes estão sumindo". São dois números para quase a mesma coisa (6 e 5).
- **Dúvida 2:** o mesmo cartão sugere "uma campanha de 'sentimos sua falta'", e a campanha automática está desligada (sem credencial da Meta, `05-avisos.md`).

### P3 · Chamar quem passou do dia (FATO)
2 toques: "Ver quem sumiu" e o botão do WhatsApp, que abre `wa.me` com o texto pronto e o link de volta assinado.
- **Defeito (Onda 0):** o Hoje diz **R$ 355,40** a recuperar, e o Recuperar diz **R$ 800,00** para as mesmas 6 clientes. É o mesmo número calculado em dois lugares (memória `duas-copias-da-mesma-formula`).
- **Defeito:** a mensagem chama a Isadora para "aplicação volume russo". Quem volta faz **manutenção**. Bate com o `SERVICO_DE_VOLTA` sem as regras certas (`04-salao.md`).

### P4 · Marcar quem pediu pelo WhatsApp (FATO)
≈ 8 toques: "Marcar", nome, telefone, serviço, dia, horário, salvar.
- **O campo "Cliente" não sugere quem já é cliente:** digitar "Isad" não mostra a Isadora. É preciso redigitar nome e telefone de quem já está na base.
- **O autopreenchimento puxa os dados da própria profissional** (`autocomplete="name"`, achado K do `medidas/copy-e-acessibilidade.md`).
- O serviço vem marcado na **aplicação**, não na manutenção.

### P5 · Fechar o dia (FATO)
2 toques (Menu e Caixa). O mês aparece claro ("Entrou R$ 688,00 · Sobrou R$ 569,60"), mas o dia diz "Nenhuma comanda fechada hoje", com três atendimentos confirmados no Hoje. Para a autônoma, fechar o dia é fechar comanda por comanda.
- **Conferir:** o menu desta conta mostra Time, Estoque e Campanhas. Ela veio da semente, não do cadastro, então o enxugamento do `docs/108` não se aplicou. Medir numa conta criada pelo cadastro.

### P6 · Trazer uma profissional (FATO por código, `medidas/copy-e-acessibilidade.md` K-01)
O convite exige e-mail. Quem entra pelo número fica com e-mail vazio, e a tela do convite diz "Você entrou como ." e devolve a pessoa a `/entrar`, que abre no número: um círculo. **Bloqueado** até o convite por WhatsApp (L2 do `docs/110`).

## Cliente

### C1 · Do link ao horário marcado (FATO, `demo-studio-olhar`)
7 toques: "Agendar horário", serviço, dia, horário, nome, telefone, "Pedir este horário". A tela de sucesso é honesta ("a confirmação vem de quem vai te atender") e já tem "Adicionar à minha agenda".
- **Atrito 1:** o serviço que vem marcado é a **aplicação (R$ 220)**. Quem volta precisa trocar para a manutenção.
- **Atrito 2:** depois de escolher o horário, nome e telefone ficam **abaixo da dobra**, enquanto o botão fixo "Pedir este horário" aparece travado. A cliente vê o botão travado sem ver o que falta.
- **Atrito 3:** "Tanto faz" caiu no profissional homem que a semente pôs num estúdio de cílios (`04-salao.md`: contas de demonstração com ofício e gênero trocados).
- O campo "Onde vai ser (opcional)" aparece num estúdio de cílios. Conferir se vem de um módulo de atendimento em domicílio ligado na semente.

### C2 a C6
- **C2:** o link de confirmar só é montado pelo lembrete automático, que está fora do agendador (FATO, `05-avisos.md`, `medidas/copy-e-acessibilidade.md`). Nenhuma mensagem pronta leva o link. Hoje a cliente **não tem como confirmar em 1 toque**.
- **C3:** não existe remarcar. O link manda de volta ao agendamento, como um pedido novo (`docs/110` §1).
- **C4:** o Motor sabe o ritmo de cada cliente, mas só a profissional age, e só **depois** do dia. Nenhum aviso sai para a cliente antes (`05-avisos.md`, EXP-A12).
- **C5, C6:** a área da cliente não existe (L3 a L5 do `docs/110`). O melhor concorrente também não tem C6 público (`medidas/concorrentes.md`).

## Comparação com os concorrentes (resumo de `medidas/concorrentes.md`)

| Jornada | Melhor concorrente | O que ele faz |
| --- | --- | --- |
| C1 | GlossGenius, Gendo | sem conta e sem app; o CICLO empata (7 toques, sem conta) |
| C2 | Agendiva | WhatsApp 24 h antes, confirma em 1 toque, a agenda mostra quem confirmou |
| C3 | Fresha | remarcar pelo próprio agendamento, cerca de 4 toques |
| C4 | Gendo | marca a próxima manutenção ao fechar a conta; usa prazo fixo, não o ritmo de cada cliente |
| P3 | Gendo, Belasis | relatório 30/60/90 dias; Belasis prepara o texto, como o CICLO |
| P6 | nenhum | todos exigem e-mail; ninguém entra pelo número |
