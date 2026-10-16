# 108 · Plano dos 60 dias (17/10 a 15/12/2026)

Reordena o trabalho pela decisão `00-decisao.md`. Substitui como **ordem de execução**:
- o `docs/concorrentes/appbarber/plano-estrategico.md`, que vira frente passiva;
- as frentes de oficina, pet e advocacia, que ficam paradas.

Esses documentos não foram apagados. Ficam como referência.

## A ordem em uma linha

**Destravar, depois 3 a 5 conhecidos, depois teste de nicho (10 + 10), depois piloto de 10 a 20, depois decidir a cobrança.**

## Fases

| Fase | Datas | Objetivo | Quem | "Pronto" quando |
| --- | --- | --- | --- | --- |
| 0 · Destravar | 17 a 25/10 | O cadastro abre para quem é de fora e o produto do ar inclui a pilha | Eduardo: SMTP, revisão da pilha (`03-guia-da-pilha.md`), canal de contato, senhas. Claude: guia da pilha, kit de campo, medir o teste de 10 minutos nos nichos e consertar o que travar | Um e-mail de fora do time cria conta em `seuciclo.com.br`; a `main` tem a pilha até onde o Eduardo aprovou; o teste de 10 minutos roda num celular de 390 px nos 4 nichos sem travar |
| 1 · Alpha | 26/10 a 01/11 | 3 a 5 conhecidos do Eduardo, dos 4 nichos, usando de verdade | Eduardo, em pessoa | Cada um trouxe 20 ou mais clientes e chamou pelo menos 1; anotações na ficha do kit |
| 2 · Teste de nicho | 02 a 15/11 | Decidir o nicho com número (`00-decisao.md` §4) | Eduardo na rua; Claude consolida as fichas | 10 de cílios ou unhas e 10 barbeiros solo testados; vencedor escrito em `docs/DECISOES.md` |
| 3 · Piloto | 16/11 a 13/12 | 10 a 20 do nicho vencedor, numa cidade | Eduardo; Claude conserta o que o piloto pedir | Medidas da seção "Métricas" toda segunda |
| 4 · Decidir | 14 e 15/12 | Ligar a cobrança, repetir noutra cidade ou rever a dor | Eduardo | Decisão escrita, com os números |

## O que entra no código (e só isto)

**Regra:** só entra no código o que impede o piloto ou o que um usuário real pediu. Cada ticket segue o padrão do CICLO: um ticket, um commit, teste que reprova antes, verificação no navegador.

| Ordem | Ticket | Entra quando | Por quê |
| --- | --- | --- | --- |
| 1 | Consertos que o teste de 10 minutos medido achar (fase 0) | Já | É o caminho exato do alvo; nada mais importa antes |
| 2 | CONV-03 · lembrete semanal por e-mail ("5 clientes passaram do tempo, R$ X") | Depois do SMTP | Sem lembrete o uso morre na semana 3 (HIPÓTESE); vale para todo nicho |
| 3 | CONV-01 · "Já voltou" na fila | Se no alpha a pessoa continuar marcando horário no caderno | Quem agenda no caderno é o mesmo caso de quem agenda no AppBarber: o CICLO não fica sabendo de quem veio |
| 4 | CONV-08 · visitas de fora no histórico do Motor | Junto com a CONV-01 | Sem ela cada "voltou" substitui a data anterior (FATO, `ciclo-de-quem-ja-atende.ts:40`) |
| 5 | A-01 · o R$ da Hoje diz quando é estimativa | Se no alpha alguém desconfiar do número | Base trazida de memória entra com "preço × chance"; um R$ inflado no dia 1 mata a confiança (`docs/104-founder/apostas.md`) |
| 6 | A-08 · "acertou 0%" não vira manchete no primeiro mês | Idem | O mesmo problema de confiança |
| — | CONV-10, CONV-11, CONV-12, JORN-01 e o resto do plano do AppBarber | Só se aparecer dono que usa outro sistema | Frente passiva |

**Nada mais.** Vale também para as apostas A-02 a A-12 e para a fila de C-0xx do `docs/105`: ficam paradas até 15/12.

## Métricas (toda segunda, em `docs/108-norte/medidas.md`)

| Medida | Como medir | Meta em 15/12 |
| --- | --- | --- |
| Contas reais ativas | Abriram a fila em 2 semanas diferentes; contas de demonstração e de teste fora | 10 a 20 |
| Ativação na semana 1 | 20 ou mais clientes trazidos **e** 1 ou mais "Chamar" | 60% |
| Uso na semana 4 | Abriram a fila na 4ª semana depois do cadastro | 50% |
| Voltaram depois de "Chamar" | Pela ficha de campo (perguntado) até a CONV-01 existir | 3 por conta por mês |
| Disposição de pagar | Pergunta direta na semana 4: "pagaria R$ 49 por isto?" | 8 sim |
| Minutos por semana | Perguntado | 5 ou menos |

**Contar sem tocar em produção do jeito errado:** a contagem agregada (quantas contas, quantos eventos) é uma consulta só de leitura que o Eduardo roda, ou autoriza, no painel do Supabase. Nada de dado de pessoa sai do banco.

## O que é do Eduardo, em ordem

1. SMTP.
2. Revisar e mesclar a pilha (`03-guia-da-pilha.md`).
3. Canal de contato.
4. Senhas das contas de revisão e de demonstração.
5. Lista de 3 a 5 conhecidos para o alpha, dos 4 nichos.
6. Escolher a cidade do teste de nicho e do piloto.
7. Advogado antes de qualquer abordagem a quem não é conhecido (regra: um a um, com opção de não receber mais, sem disparo).

## O que fica parado até 15/12

- Plano do AppBarber (exceto atender quem aparecer).
- Oficina, pet e advocacia dentro do CICLO.
- Apostas A-02 a A-12 do `docs/104`.
- Ciclos do algoritmo do `docs/105`.
- Onda F do conversor.
- WhatsApp automático e push nativo.
- O app nas lojas segue só no que já está pronto (PR #151). Não é pré-requisito do piloto: o site no celular basta.
