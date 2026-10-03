# Minuta do Contrato de tratamento de dados (DPA)

> **J6 do `docs/86`. Minuta de quem NÃO é advogado, para revisão humana.** É o anexo dos Termos de uso
> entre o **negócio** (controlador) e o **CICLO** (operador), LGPD art. 39. Hoje a relação é uma frase
> na Política (§1). Cada cláusula diz **o que a sustenta no código**. `[colchetes]` = dado do Eduardo;
> `(?)` = ponto para o parecer humano.
>
> Publicado como `/termos/tratamento-de-dados`, aceito junto com os Termos (mesmo aceite, mesma versão).

---

## 1. Objeto e quem é quem

O CICLO trata, **em nome do negócio**, os dados pessoais que o negócio cadastra sobre os seus clientes e
a sua equipe, para entregar o serviço contratado. O **negócio** é o controlador; o **CICLO** é o operador.
Para os dados do próprio titular da conta (cadastro, cobrança, uso do painel), o CICLO é controlador
(Política de privacidade, §1).

## 2. O que o CICLO faz, e só isso

O CICLO trata os dados **para a finalidade do serviço e pelas instruções do negócio**, que são: o que o
negócio cadastra, edita, exporta e apaga pelo sistema, e o que escolhe ligar ou desligar em Config. O
CICLO não usa esses dados para outra finalidade, **com uma exceção, dada aqui de forma expressa:** o
tratamento para gerar **números agrupados e sem nome** descrito nos Termos de uso (item 4), que o negócio
autoriza ao aceitar os Termos. `(?)` **P1: é a pergunta central do parecer.**

## 3. Quais dados, de quem

As categorias de dado e de titular estão em **[link para um resumo do inventário de tratamento]**. Em
resumo: nome, telefone, e-mail, aniversário, histórico de atendimento, preferências e observações dos
clientes; ficha de saúde (**dado sensível**, cifrado), foto (com consentimento) e dados de pagamento
**sem número de cartão**. Podem existir **dados de menores** (a autorização é do responsável, e é do
negócio).

## 4. Confidencialidade

Quem trabalha no CICLO e acessa dado de clientes do negócio só o faz para dar suporte ou resolver defeito,
com dever de sigilo. O acesso ao dado de saúde fica registrado (`vault_access_log`).
**`[conferir]`** quem, hoje, tem acesso de administrador ao banco de produção (o Eduardo?) e se existe um
compromisso de sigilo escrito; a cláusula promete "dever de sigilo" e precisa de lastro.

## 5. Segurança

Medidas que existem hoje, conferidas no código (03/10/2026):

- isolamento por negócio **no banco**, em toda tabela, com teste que impede o sistema de subir se uma
  tabela nova ficar de fora (`tests/rls/isolation.test.ts`);
- dado de saúde **cifrado com AES-256-GCM**, com chave por negócio guardada separada do banco
  (`server/crypto/kek.ts`, `tenant_keys`);
- telefone de cliente guardado também em forma embaralhada para busca (`phone_hash`);
- trilha de quem fez o quê e de quem abriu uma ficha de saúde (`audit_log`, `vault_access_log`);
- verificação em duas etapas para apagar a conta e para ações sensíveis;
- conexão cifrada, política de segurança de conteúdo e cabeçalhos de proteção (`middleware.ts`);
- registro de erro sem dado pessoal e sem dado de saúde (`redigirEventoSentry`).

**`[conferir]` antes de assinar embaixo:** backup do banco (depende do plano contratado: o plano gratuito
da Supabase não faz; o pago guarda 7 dias) e retenção de log (a Vercel guarda 1 hora no plano Hobby).

## 6. Quem mais recebe os dados (suboperadores)

A lista, com o que cada um recebe e onde processa, é a da Política de privacidade (seção 3), gerada de
`core/legal/operadores.ts`. O CICLO **avisa o negócio com [30] dias de antecedência** antes de incluir um
suboperador novo, e o negócio pode se opor encerrando a conta sem multa. Quando um suboperador processa
dado fora do Brasil, isso é transferência internacional (LGPD art. 33), amparada em **[cláusulas-padrão da
ANPD, Res. 19/2024, ou na base que o parecer indicar]** `(?)`.

## 7. Direitos dos clientes do negócio

O CICLO ajuda o negócio a atender pedidos dos titulares: **ver** (exportação da ficha), **corrigir** (a
ficha é editável), **apagar** (botão que elimina o dado, inclusive da trilha interna) e **levar a base
inteira embora** (exportação em planilha). Se um titular escrever direto ao CICLO, a gente encaminha ao
negócio em até **[5] dias úteis**.

## 8. Incidente de segurança

Se o CICLO souber de um incidente que afete dados do negócio, **avisa o negócio em até 24 horas**, com o
que aconteceu, o que foi afetado e o que está sendo feito. A comunicação à ANPD e aos titulares, para os
dados que o negócio controla, é do negócio, em **3 dias úteis** (Res. CD/ANPD 15/2024), e o CICLO ajuda.
**Sustenta hoje:** só o runbook `docs/runbooks/incidente.md`, que ainda não fala de ANPD nem de prazo
(J9). A cláusula das 24 h é compromisso novo: precisa de quem receba o alerta.

## 9. Fim do contrato

Ao fim da conta, o CICLO **devolve** os dados (exportação) e depois os **elimina**, no prazo da Política
(**[90] dias** de pausa, com aviso **[30] e [7] dias** antes), salvo o que a lei manda guardar.
**NÃO sustenta ainda:** o job de eliminação e os avisos (portões C6 e C9 do `docs/87`).

## 10. Auditoria

O negócio pode pedir ao CICLO, uma vez por ano, as informações necessárias para demonstrar o
cumprimento deste contrato. Auditoria presencial: só por acordo prévio `(?)`.

## 11. Responsabilidade

Segue a cláusula de responsabilidade dos Termos (item 9), dentro do que a lei permite `(?)`: **P5 do
parecer.** O negócio responde pela autorização dos titulares que cadastra (item 11 dos Termos).
