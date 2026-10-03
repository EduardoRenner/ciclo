# Minuta dos Termos de uso v2: cláusulas novas e alteradas

> **J4 do `docs/86`. Minuta de quem NÃO é advogado, para revisão humana.** Não substitui a página
> `/termos`; é o texto que entra nela depois de aprovado. A versão em vigor hoje é `2026-10-03` (PR #143:
> §5, §6, §9). O que está aqui é o RESTANTE da v2. Cada cláusula diz **por que existe** e **o que no
> produto a sustenta**, porque contrato que promete o que o software não faz é pior que a ausência dele.
>
> `[entre colchetes]` = dado que só o Eduardo tem ou decisão que ele precisa tomar. `(?)` = ponto que vai
> para o parecer humano (`docs/legal/dossie-para-revisao.md`).

---

## 0. Quem é o fornecedor (novo, no topo da página e no §1)

**Texto:**

> O CICLO é oferecido por **[razão social]**, inscrita no CNPJ sob o nº **[00.000.000/0000-00]**, com
> sede em **[endereço completo]**. Para falar com a gente sobre estes termos, sobre cobrança ou sobre
> seus dados: **[e-mail do produto]** ou **[WhatsApp]**. O encarregado de dados é **[nome]**
> (**[e-mail]**).

**Por que:** o Decreto 7.962/2013 pede a identificação do fornecedor com nome empresarial e inscrição
(CNPJ ou CPF) em contratação a distância [confirmar]. Hoje a página diz "quem mantém o sistema" e não nomeia ninguém.
**Sustentação no produto:** as duas variáveis `NEXT_PUBLIC_CONTATO_*` (hoje ausentes em produção, auditoria 27/09, B4).

**Durante o alpha (até 10 contas, antes do CNPJ):** o texto nomeia o Eduardo como pessoa física, com aviso
de que o contrato passa para a empresa quando ela existir, e as contas do alpha são avisadas e reaceitam
(docs/87 D6). Depois do CNPJ, a versão é refeita (v2.1).

---

## 1. Aceite (novo: caixa explícita no cadastro, em vez de "o ato de contratar")

**Texto ao lado da caixa, não marcada, obrigatória:**

> Li e aceito os **Termos de uso** e a **Política de privacidade**.

**Por que:** hoje o aceite é implícito (decisão registrada em `termos/page.tsx`: "sem checkbox"). Para a
cláusula de dados (§4 abaixo) e para o reaceite de quem já tem conta, aceite com ato claro é prova melhor.
**Sustenta:** `terms_acceptances` (migration 0095) já grava documento, versão e quando. Falta a caixa e o
fluxo de reaceite (J8). `(?)` se a caixa é necessária ou se o aceite pelo ato basta; recomendo a caixa.

---

## 2. Quem é cliente de quem, e o que o CICLO faz com os dados dos seus clientes (altera o §3)

**Texto:**

> Em relação aos dados dos **seus** clientes, **você** decide o que coletar e por quê (você é o
> controlador, na linguagem da lei) e o CICLO só processa o que você mandou guardar, do jeito que você
> mandou (somos o operador). As regras desse processamento estão no **Contrato de tratamento de dados**,
> parte destes termos. Se um cliente seu pedir para ver, corrigir ou apagar o que você guardou, as
> ferramentas estão dentro do sistema (a ficha tem exportação e botão de apagar), e a gente ajuda no
> que a tela não resolver.
>
> **Crianças e adolescentes.** Se você atende menores, o cadastro é feito pelo responsável, e a
> autorização dele é sua responsabilidade.

**Por que:** a LGPD art. 39 diz que o operador segue as instruções do controlador; hoje isso é uma frase
na política (§1) e não um contrato. Barbearia atende criança, e o art. 14 trata dado de menor à parte.
**Sustenta:** exportação e eliminação já existem (`lgpd.ts`); o contrato está em `minuta-dpa.md`.

---

## 3. Uso do assistente (novo)

**Texto:**

> O assistente do CICLO roda em programa próprio do CICLO. As perguntas que você faz a ele **não são
> enviadas a nenhum serviço de inteligência artificial de terceiros**.

**Por que:** é uma promessa que o produto cumpre HOJE e que o dono quer ouvir. **Sustenta:**
`MotorDeConversa` (`server/providers/ai/motor.ts`); nenhuma rota instancia o provedor externo. **A guarda
J11 trava a promessa:** se alguém voltar a ligar IA externa, o teste reprova até a frase mudar.

---

## 4. Números do negócio, agrupados e sem nome (novo; é a cláusula da pergunta 1 do advogado)

**Texto:**

> **O que o CICLO faz com números, e o que nunca faz.** Para melhorar o serviço e para mostrar a você
> como o seu negócio se compara com outros parecidos, o CICLO pode juntar números de muitos negócios
> (por exemplo, de quantos em quantos dias o cliente costuma voltar numa barbearia) e mostrar só o
> resultado agrupado.
>
> Para isso valem cinco promessas:
>
> 1. **Nunca vendemos nem cedemos esses números** a ninguém, agrupados ou não.
> 2. **Nunca mostramos cliente seu a outro negócio**, nem o contrário. O que se mostra é número
>    agrupado, nunca uma pessoa.
> 3. **Nunca entra** nome, telefone, e-mail, endereço, documento, texto escrito por você sobre um
>    cliente, nem qualquer dado de saúde. Só entram contagens e medidas sem identificação.
> 4. **Um número agrupado só existe com pelo menos [10] negócios** na mesma comparação, e nenhum
>    negócio pesa mais de **[30]%** do total dela. Abaixo disso, ele não aparece.
> 5. **Você leva tudo embora quando quiser.** O botão de exportar a base inteira de clientes está
>    dentro do sistema.
>
> **[Alternativa para a pergunta 5 do parecer: Você pode pedir para o seu negócio ficar de fora desses
> números, a qualquer momento, em Config.]**

**Por que:** é o que dá ao CICLO o direito de construir o comparativo e o simulador de preço (docs/84
§2.4). Sem a cláusula, o dado agregado seria uso de operador para finalidade própria (LGPD art. 39).
**Sustenta no produto: NADA ainda.** O pipeline agregado **não existe e fica desligado** até o parecer.
A cláusula pode entrar antes (o custo de pedir reaceite de ≤ 40 contas depois é pequeno, docs/87 E3), mas
as cinco promessas só são verdade no dia em que o pipeline respeitar cada uma, e isso será provado por
guarda antes de ele ligar.

`(?)` **P1** o operador pode anonimizar para finalidade própria com esta autorização expressa? **P2** os
números de um MEI são dado pessoal dele? **P3** o limiar `[10]` e `[30]%` é defensável? Veja o dossiê.

---

## 5. Mudança destes termos (altera o §13)

**Texto atual:** "Continuar usando depois disso significa que você concorda com a versão nova."

**Texto novo:**

> Se estes termos mudarem, a data no topo muda junto, e a gente avisa **dentro do sistema e por
> e-mail**, com pelo menos **30 dias** de antecedência quando a mudança for importante (preço, o que
> fazemos com os seus dados, ou algo que tire um direito seu). Mudança pequena (correção de texto, nome
> de tela) vale ao ser publicada. Para mudança importante, o sistema pede o seu **aceite** da versão
> nova, e até você aceitar a conta continua funcionando com o que valia antes.

**Por que:** uso continuado como aceite é fraco para cláusula nova, e a v2 tem uma. **Sustenta:** a
coluna `terms_acceptances.via = 'reaceite'` existe (0095), mas **nenhum código grava reaceite** (J8).
**Atenção:** "a conta continua funcionando com o que valia antes" tem uma consequência de produto: o que
for novo (a cláusula de números agrupados) só vale para quem aceitou. O pipeline lê só contas com aceite
da versão da cláusula (J8), e a consulta é escrita antes de o pipeline existir.

---

## 6. Retenção depois que a conta acaba (altera o §6, novo parágrafo)

**Texto:**

> **Depois que a conta acaba.** Se você cancelar ou a conta ficar pausada (item 5), seus dados ficam
> guardados e exportáveis por **[90] dias**. Antes de esse prazo acabar, a gente avisa **[30] e [7]
> dias** antes. Passado o prazo, a conta e os dados dela são eliminados. Cópias de segurança podem
> guardar o dado por até **[7] dias** além disso. Registros que a lei manda guardar (cobrança, nota
> fiscal) ficam pelo prazo legal.

**Sustenta:** a pausa de 90 dias está no código (`PRELANCAMENTO.diasDePausa`); **os avisos por e-mail e o
job de eliminação NÃO existem** (portões C6 e C9 do `docs/87`). Esta cláusula não pode ficar ao ar antes
de eles existirem, ou promete o que o produto não faz.

---

## O que NÃO muda (e por quê vale dizer)

§9 (responsabilidade): já perdeu a frase do plano gratuito no PR #143 e continua com a ressalva "só para o
que a lei permite" `(?)`. §15 (foro): fica o domicílio do assinante, como manda o CDC `(?)` se o MEI é
consumidor. §2 a §4 e §7 a §12: sem alteração.
