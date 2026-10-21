# 112 · 08 · Revisão adversarial do próprio plano

O `docs/111` B4 pede que esta revisão **mude alguma coisa**. Ela mudou quatro.

## O que esta revisão mudou

1. **O login por número deixava a pessoa presa (J08).** O plano tratava a L1 como pronta. A revisão de copy mostrou que, sem a Meta, `/entrar` abria numa porta que sempre falhava. Corrigido no PR antes de qualquer outra coisa (`0a5e2b8b`).
2. **"Menos toques" na P4 tirava uma conferência.** A primeira versão do EXP-J02 marcava a cliente pelo nome sem mostrar o telefone. Com duas "Ana" na base, isso marca a pessoa errada. O ticket agora mostra o telefone (final) na sugestão.
3. **O número do Recuperar não pode ser "consertado" escolhendo um lado (J01).** Os dois valores podem estar certos para perguntas diferentes (preço cheio x o que sobra). O ticket passou a pedir a decisão de qual é a verdade antes de unificar.
4. **Aviso de volta antes do dia (A12) sem as três regras da Fresha mandaria aviso para quem já tem horário marcado** ou acabou de faltar. As regras entraram no ticket.

## Pergunta por pergunta

| Pergunta (B4) | Resposta |
| --- | --- |
| Qual proposta piora outra jornada? | A12 pode aumentar mensagem e fazer a cliente silenciar o salão. Limite por semana por cliente e opt-out em 1 toque (A08) vêm antes. J03 pode marcar o serviço errado para quem quer outro; o "Trocar" fica a um toque |
| Qual meta melhora se o produto piorar? | "Avisos enviados" e "taxa de abertura" (trocadas por volta atribuída, A15). "Menos toques" na P4 (ver mudança 2). "0 toques na P2" se o Hoje esconder informação: a meta é "saber o que fazer", não "não tocar" |
| O que depende de canal que não existe? | A09, A10 automático, A12 automático, C2 por lembrete. Tudo tem a versão "pelo WhatsApp dela, com um toque" que liga hoje |
| O que a autônoma de celular simples e internet ruim não usaria? | O recálculo do Motor que leva minutos (Onda 3) e telas que compilam devagar. Só a frente D, medida em build de produção, responde. Fica como risco aberto |
| O que deixa a cliente presa ou a profissional com vergonha? | Cancelar sem avisar a profissional (A03); lista de espera que diz que avisou (A04); "o Manutenção" e "da Studio Bella" nas mensagens (S10, K05); a cliente sem jeito de parar de receber mensagem (A08) |
| O que ainda tem cara de barbearia e ninguém abriu? | A demonstração (S01), as contas de exemplo com ofício e gênero trocados (S02), o serviço de volta do cabelo (S08). Vistos no código e, na C1, no navegador ("Tanto faz" caiu num homem no estúdio de cílios) |

## O que esta auditoria NÃO provou
- Tempo de verdade de qualquer tela (servidor de desenvolvimento).
- P7 (agenda de todas) e o menu de uma conta criada pelo cadastro.
- Qualquer coisa em aparelho real ou com a Meta ligada.
