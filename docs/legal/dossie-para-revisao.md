# Dossiê para a pessoa que revisa

> **J12 do `docs/86`.** Para quem for validar a parte jurídica do CICLO (advogado ou advogada
> especializado em proteção de dados e contrato de software). Foi montado por quem **não é advogado**, de
> propósito para reduzir o trabalho dele: em vez de redigir do zero, **revisar e responder cinco
> perguntas**. Tudo que está marcado `[confirmar]` veio da memória de quem escreveu e **não** foi
> conferido em fonte; entra aqui como pergunta, nunca como afirmação.

## O que é o CICLO, em um parágrafo

Sistema de gestão (agenda, ficha de cliente, caixa) para quem atende com hora marcada: barbearia, unhas,
cílios, estética. O dono do negócio assina um plano mensal (R$ 49 para 1 profissional, R$ 99 até 5) e
cadastra os clientes **dele** (nome, telefone, histórico, às vezes ficha de saúde e foto). O diferencial é
calcular de quanto em quanto tempo cada cliente costuma voltar e sugerir quem chamar. O assistente de
conversa roda em programa próprio, **sem IA de terceiros**. Há **zero cliente pagante hoje**; o lançamento
é em janeiro de 2027, com um período de uso sem cobrança antes (`docs/87`).

## O que já está escrito e onde

| Documento | O que é | Estado |
|---|---|---|
| `/termos` (versão `2026-10-03`) | termos de uso, 16 itens | no ar na `main` + PR #143 (§5, §6, §9) |
| `/privacidade` (versão `2026-10-03`) | política | PR #144 (§3, §4, §5 geradas da lista de operadores) |
| `docs/legal/inventario-de-tratamento.md` | as 59 tabelas, uma linha cada, com base legal proposta | PR #144, com guarda |
| `docs/legal/operadores.md` | quem recebe dado, o que o código manda, onde processa | PR #144, com guarda |
| `docs/legal/minuta-termos-v2.md` | cláusulas novas (fornecedor, aceite, dados agrupados, reaceite, retenção) | **minuta, não está no ar** |
| `docs/legal/minuta-politica-v2.md` | base legal por finalidade, encarregado, retenção, incidente, menores | **minuta** |
| `docs/legal/minuta-dpa.md` | contrato de operador entre o negócio e o CICLO | **minuta** |

## As cinco perguntas

### P1. O operador pode gerar números agrupados e sem nome, para finalidade própria, com autorização contratual?

**Contexto.** O CICLO quer juntar números de muitos negócios (de quantos em quantos dias o cliente volta,
ocupação, faixa de preço) para dar um comparativo ("barbearias parecidas voltam a cada 28 dias") e, no
futuro, estimar o efeito de mudar preço. Os negócios são controladores dos dados dos clientes; o CICLO é
operador. **O pipeline não existe e fica desligado até a resposta.**

**Posição de quem montou:** dado de fato anonimizado sai da LGPD (art. 12), mas **o ato de anonimizar é
tratamento** e precisa de fundamento. O caminho mais defensável: autorização **expressa e específica** do
negócio no contrato (minuta DPA §2 e Termos item 4), escopo **só agregados**, sem identificador,
limiar de células, cálculo dentro do banco sem exportar linha.

**Risco que continua:** art. 39 (o operador segue instruções do controlador) e a discussão de o operador
virar controlador ao usar dado para finalidade própria. **Alternativa conservadora:** só os números do
**próprio negócio** (que ele autoriza), nunca dado de cliente final, nem agrupado; perde o comparativo.

### P2. Os números do negócio de um MEI são dado pessoal dele?

MEI é pessoa física. Faturamento, ocupação e preço do negócio dele podem ser dado pessoal. **Posição:** se
a agregação é anonimização real, é irrelevante; se não for (célula pequena, valor que identifica), é dado
pessoal. A cláusula vale igual para MEI e para pessoa jurídica; a proteção real é o limiar (P3).

### P3. O limiar é defensável?

**Proposta técnica (não jurídica):** célula só aparece com **10 negócios ou mais**, nenhum pesando mais de
**30%** do total dela, região no mínimo por UF, números arredondados. É k-anonimato com teto de
dominância. O número exato é escolha a validar.

### P4. Como tratar as contas que já existem quando a cláusula nova entrar?

**Posição:** reaceite com aviso claro (Termos §5 da minuta); até aceitar, a conta fica **fora** de qualquer
agregado (a consulta do pipeline exige aceite da versão da cláusula). As contas do pré-lançamento
(**no máximo 40**) já nascem aceitando a v2, por isso os textos vêm antes da abertura (26/10).

### P5. A limitação de responsabilidade (§9) vale para MEI que é consumidor?

O texto limita a "o que você pagou nos últimos 12 meses", com a ressalva "só para o que a lei permite".
Antes, para o plano gratuito, dizia "zero". **Foi tirado** (PR #143), porque cláusula que limita a zero
pode ser tida por abusiva (CDC art. 51 [confirmar]). **Perguntas:** o MEI é consumidor para o CDC
(arrependimento de 7 dias, foro do domicílio)? A redação atual aguenta?

## Perguntas menores (uma linha cada)

- **Encarregado:** o CICLO precisa de encarregado formal ou a dispensa para agente de pequeno porte
  (Res. CD/ANPD 2/2022 [confirmar]) se aplica? O canal para o titular existe de qualquer jeito.
- **Dado de saúde:** a base proposta é consentimento específico do titular (art. 11, I), coletado pelo
  negócio. Está certo para negócio que **não** é profissional de saúde? Precisa de RIPD (art. 38)?
- **Transferência internacional:** Meta, Resend, Sentry e o serviço de push processam fora do Brasil. O
  que precisa estar no contrato com cada um (cláusulas-padrão da ANPD, Res. 19/2024), e o que precisa estar
  na política?
- **Retenção:** 90 dias de pausa, 7 dias de cópia, 6 meses de log de acesso (Marco Civil art. 15), 5 anos
  de dado fiscal. Estão razoáveis?
- **Menores:** o cadastro é feito pelo responsável. A política e o contrato bastam, ou é preciso algo a
  mais do negócio?
- **Decisão automatizada (art. 20):** uma nota de prioridade ordena quem o dono deve chamar. Ele decide. Há
  o que acrescentar?
- **Marca:** busca de anterioridade e registro de **CICLO** no INPI (classes 9, 35, 42). Não é texto legal,
  é o risco jurídico mais caro do lançamento.

## O que o CICLO FAZ hoje, com prova (para o revisor conferir, não confiar)

| Afirmação | Onde conferir |
|---|---|
| dado de saúde cifrado com AES-256-GCM, chave por negócio | `src/server/crypto/kek.ts`, `tenant_keys` |
| isolamento por negócio no banco, com teste que impede subir sem ele | `tests/rls/isolation.test.ts` |
| apagar cliente apaga também da trilha interna | `src/server/services/lgpd.ts`, migration 0046 |
| exportar a base e excluir a conta exigem duas etapas | `exigirAal2()` em `clients/export` e `account` |
| o navegador só fala com o CICLO, o banco e (se ligado) o Sentry | CSP em `src/middleware.ts`, guarda dos operadores |
| nenhuma IA de terceiros recebe dado | `MotorDeConversa`; nenhuma rota instancia o provedor externo |
| consentimento de imagem e de saúde registrado | `consents` |

## O que o CICLO ainda NÃO faz e os textos prometem (ou prometerão)

Para o revisor saber onde a minuta está à frente do produto. Todos têm dono e data em `docs/87`:

1. A **pausa** não trava toda criação, só parte (portão C5).
2. O **aviso por e-mail** 30 e 7 dias antes da eliminação não existe (C6).
3. Quem **assina e cancela** cai no plano Grátis legado, não na pausa (C7).
4. A **eliminação** da conta depois de 90 dias não existe (C9).
5. `job_queue.payload` e `webhook_events.payload` podem guardar telefone e texto sem limpeza nem redação
   na eliminação do cliente.
6. O **pipeline de números agrupados** não existe.

## O que quem montou não sabe

Se a Vercel e a Supabase de produção estão em plano pago, em que região, com backup; se o Mercado Pago, o
WhatsApp, o Resend e o Sentry estão ligados em produção; quem além do Eduardo tem acesso ao banco; se
existe CNPJ; qual o texto dos contratos de proteção de dados de cada fornecedor. Está tudo em
`docs/legal/operadores.md` na seção "O que só o Eduardo vê".

## O que se pede à pessoa que revisa

1. Responder P1 a P5, mesmo que seja "precisa mudar assim".
2. Marcar nas três minutas o que não pode ir ao ar como está.
3. Dizer se o aceite por **caixa** é necessário ou se o aceite pelo ato basta.
4. Orçar a revisão **de preço fixo**. Tudo acima está pronto para ler, e não há nada para redigir do zero.
