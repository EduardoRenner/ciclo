# 113 · Prompt da próxima fase do CICLO (21/10/2026)

Releia este arquivo, o `docs/111-PROMPT-EXPERIENCIA-DOIS-PUBLICOS.md`, o `docs/112-experiencia/07-tickets.md` e o `docs/112-experiencia/_progresso.md` se o contexto for resumido.

## Onde estamos (medido, 21/10 às 7h40 de Brasília; atualizado às 7h55 pela sessão do loop)

- Worktree `ciclo-marca`, branch `marca/feminina-2026-10-20` (PR #155 em rascunho, vai até `1caeaacb`). **Nada empurrado:** os commits da noite e da manhã estão só no local.
- **Onda 0 (urgente): feita**, com uma parte aberta: EXP-A08 parte 2 (a cliente sair sozinha e separar as chaves de lembrete e marketing).
- **Onda 1 (cara de salão): S01 parte 1, S02, S03, S04, S05, S06, S14 e S16 feitos** (S16 sem o texto dos termos, que é do Vitor; `fec63157`). Falta: S01 parte 2 (regerar os prints de `public/exemplo/`), S11 e S12 (exemplos e masculino genérico no painel), S10 e K05 (mensagens sem erro de artigo), A07 (prévia das mensagens com cara de salão).
- Achados da noite consertados: cookie de estabelecimento velho derrubava o painel; o Motor mostrava "acertou 0%".
- Suíte no último commit medido (`fec63157`): 4.542 unitários, 361 isolamento, integração 685/688 (os 3 por tempo sob carga, passando sozinhos). **O build de produção (`next build`, parte do `pnpm verify`) não rodou nas rodadas da noite**: cada rodada rodou `tsc`, lint e as três suítes. Rodar o build ao fim da Onda 1, e antes de qualquer medida da Onda 3.
- Migrations novas só no banco local: **0142 e 0143 sobem ANTES do código** em produção; 0144, 0145 e 0146 são só dados.

## O que falta (em ordem)

1. **Fechar a Onda 1:** S11/S12, S10/K05, A07, S01 parte 2.
2. **Onda 2 · todo dia:** J03, J06, S08 e S09 (serviço de volta certo; "Remoção" fora do Motor e da marcação online), K03/A10, A05, A11, K04, K08. Junto: o cartão "5 clientes estão sumindo" (Hoje) contar igual ao "6 clientes para chamar".
3. **Onda 3 · leve e rápido:** D01 a D10 e K09, com a medida em build de produção antes e depois (LCP ≤ 2,5 s; Hoje ≤ 18 idas ao banco; Recuperar sem o polyfill de Temporal; Fraunces ≤ 55 kB). E o recálculo do Motor (177 a 312 s no banco local): medir sem os negócios de teste, e fazer a suíte de integração apagar o que cria.
4. **Ondas 4, 5 e 6** na ordem do `07-tickets.md` (A12 com as três regras da Fresha; A09 antes de qualquer lembrete ligado).
5. **Revisão das duas jornadas** (profissional e cliente) a 375 px, ao fim de cada onda, abrindo ticket do que estiver quebrado.

## Do Vitor (o loop não faz; faz o padrão atrás de chave, anota e pula)

- Texto da política de privacidade (a Meta "entrega lembrete") e dos termos de uso (`termos/page.tsx:101-102`, "barbearia, unhas, cílios…").
- Trocar o nome do perfil no Instagram para o sugerido em `links-da-bio.ts` ("CICLO | Agenda de beleza").
- Lembrete nasce no nível 1 ou no 3 do dial; fidelidade e o selo "Ativa" com o programa desligado.
- Nomes das contas de demonstração; apagar ou não as barbearias e os salões antigos; Encanto com 577 clientes.
- Serviço de volta de cabelo, depilação e estética (S06/S08).
- Empurrar o PR, publicar, configurar a Meta, J04, ordem de publicação das migrations.

## Como trabalhar (não muda)

- Um ticket por rodada, um commit por ticket, mensagem em português com o código do ticket.
- Teste antes e visto reprovando; guarda nova vista reprovando com o defeito de volta (CLAUDE.md, "Teste-guarda"); `pnpm verify` antes do commit; o que a pessoa vê, visto no navegador a 375 px.
- Falha por tempo sob carga: rodar o arquivo sozinho antes de concluir que é carga, e anotar.
- **Nunca:** empurrar, deploy, produção, criar conta real, mandar mensagem a pessoas.
- Registro de cada rodada no `_progresso.md` do docs/112.
