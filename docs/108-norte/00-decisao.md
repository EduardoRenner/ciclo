# 108 · O norte do CICLO (decisão de 16/10/2026)

**Decidido pelo Eduardo em 16/10/2026**, depois da revisão do plano contra o AppBarber (`docs/concorrentes/appbarber/`). Vale pelos próximos **60 dias, até 15/12/2026**. Revisar no fim, com os números da seção 5.

## 1. A frase

> **O CICLO mostra quem sumiu e quanto vale, e você chama pelo seu WhatsApp.**

A agenda grátis é a porta. O produto é trazer cliente de volta. Agenda virou coisa de graça no Brasil: a InfinitePay dá agenda de graça desde jan/2026 (`docs/` pesquisa de mercado de 26/08). Por isso nenhuma demonstração começa pela agenda.

## 2. Para quem, primeiro

**Profissional que trabalha sozinho, com cliente que volta, e ainda está no caderno e no WhatsApp:**
- cílios;
- sobrancelha;
- unhas;
- barbeiro solo ou de cadeira alugada.

Em casa, em sala alugada ou em cadeira de salão. Numa cidade onde o Eduardo consiga ir pessoalmente.

Por que este grupo (INFERÊNCIA, a confirmar no teste da seção 4):
- **Ciclo curto e óbvio.** Os pacotes do CICLO já trazem esses ritmos (FATO, `0002_vertical_packs.sql`): manutenção de volume russo 21 dias, esmaltação em gel 18, manicure 15, design de sobrancelha 21, barba 14, corte 21.
- **Não há sistema para derrubar:** o concorrente é o caderno.
- **A cliente final não tem app que a prenda** a outro sistema.
- **O CICLO já está pronto para eles na `main`:** pacote por profissão, "Quem você já atende" de memória, fila do Recuperar e "Chamar" pelo próprio WhatsApp. Também existem as contas de demonstração de esmalteria e de cílios (`demo-esmalteria-rosa`, `demo-studio-olhar`).

## 3. O que muda de prioridade

| Frente | Antes | Agora |
| --- | --- | --- |
| Dono de barbearia que usa o AppBarber | Alvo principal (plano v2) | **Frente passiva.** O plano continua escrito; nada dele é construído antes de o alvo da seção 2 ter 10 pessoas usando. Exceção: se aparecer um dono do AppBarber querendo testar, atende-se com o que existe |
| Barbeiro solo ou de cadeira alugada | Canal | **Alvo**, junto com cílios, sobrancelha e unhas |
| Oficina (StarkOS no CICLO), pet, advocacia | Em construção nas branches | **Parados.** O que já está pronto entra fechado (o pacote Oficina já está "fechado até a decisão", AUT-104); nada novo até 15/12 |
| Funcionalidade nova | Contínua | **Congelada**, salvo o que um usuário real do piloto pedir ou o que impede o piloto |
| Pesquisa e planos novos | Contínuos | Só o que o piloto pedir |

## 4. Como decidir o nicho com número

**Teste de 2 semanas.**
- O mesmo teste de 10 minutos, no celular da pessoa, com 10 profissionais de cílios ou unhas e com 10 barbeiros solo.
- O roteiro e a ficha de anotação estão em `02-kit-de-campo.md`.

**Vence o grupo** em que mais pessoas, na primeira semana:
1. trazem pelo menos 20 clientes;
2. chamam pelo menos 1 pelo WhatsApp.

**Empate:** cílios e unhas, pelo ciclo mais curto.

## 5. Como saber se deu certo em 15/12

| Medida | Meta |
| --- | --- |
| Profissionais reais usando (abriram a fila em 2 semanas diferentes) | 10 a 20 |
| Abrem a fila na semana 4 | Metade |
| Clientes que voltaram depois de "Chamar", por conta, por mês | 3 ou mais |
| Pessoas que dizem que pagariam R$ 49 (perguntado, porque tudo está liberado de graça) | 8, o equilíbrio do `docs/88` |

**Se der certo,** liga a cobrança e repete em outra cidade. **Se não der,** a pergunta muda de "qual nicho" para "o produto resolve uma dor que a pessoa sente", e isso se responde com as entrevistas de quem largou.

## 6. O que vem antes de tudo (só o Eduardo pode)

1. **SMTP.** Sem ele ninguém de fora cria conta (FATO: LOJA-02, `EMAIL_UNAVAILABLE`). É o bloqueio número 1.
2. **Revisar e mesclar a pilha.** São 237 commits de trabalho pronto fora do ar desde 08/10, numa cadeia só. A ordem e os riscos estão em `03-guia-da-pilha.md`.
3. **Canal de contato** (`NEXT_PUBLIC_CONTATO_*`): o "me manda que eu faço" e o socorro do piloto.
4. **Trocar as senhas** das contas de revisão e de demonstração antes de mostrar a alguém.

## 7. O que não fazer nestes 60 dias

- Mídia paga. O teto de custo por cliente é de uns R$ 100 (pesquisa de 26/08), e nenhum anúncio entrega isso.
- Disparo em massa ou WhatsApp automático.
- Abordagem a partir da vitrine do AppBarber ou de reclamação pública.
- Vertical novo.
- Funcionalidade que ninguém do piloto pediu.

## 8. Registro

Linha em `docs/DECISOES.md`: `2026-10-16 · norte do CICLO · alvo = profissional solo com cliente que volta, no caderno (cílios, sobrancelha, unhas, barbeiro solo); AppBarber vira frente passiva; funcionalidade congelada até 15/12 · a briga contra quem já está instalado é a mais cara, o equilíbrio é 8 pagantes e o produto para esse alvo já existe na main`.
