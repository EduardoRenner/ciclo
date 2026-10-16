# Prompt: plano estratégico do CICLO diante do AppBarber (conviver ou superar)

Copie tudo abaixo da linha e use como pedido numa sessão nova.

---

Você vai montar o plano estratégico do CICLO diante do AppBarber, o maior sistema para barbearias do Brasil. A pergunta central tem duas respostas possíveis, e o plano precisa estudar as duas antes de recomendar:

- **Caminho A, conviver:** o CICLO entra **ao lado** do AppBarber, como a camada que ele não tem (prever quem vai sumir, trazer de volta, mostrar quanto sobrou), sem pedir que a barbearia troque de sistema.
- **Caminho B, superar:** o CICLO **substitui** o AppBarber, tirando clientes dele com um produto melhor, mais simples e mais barato.
- Um caminho C (começar por A e virar B com o tempo) também deve ser avaliado.

Só planeje. Não escreva código, não crie migration, não mude nada em produção.

## 1. Leia antes de começar (é obrigatório, e cite o que usou)

1. `docs/concorrentes/appbarber/relatorio-appbarber.html`: a pesquisa completa (empresa, preço, produto, reputação, marketing, mercado, o site página por página, comparação recurso a recurso e plano de ação inicial).
2. `docs/concorrentes/appbarber/02-ciclo-hoje.md`: planos, preços e módulos do CICLO lidos do código.
3. `CLAUDE.md` e `docs/00-BRIEFING.md` do CICLO.
4. O código, para afirmar o que o CICLO faz hoje. Em especial:
   - `src/core/billing/planos.ts` (planos e preços);
   - `src/server/services/quem-ja-atendo.ts` (cadastro "de memória" de quem já atende, pensado para quem usa outro sistema);
   - `src/core/onboarding/perfil.ts` (`SISTEMAS_ANTERIORES`, que já lista o AppBarber);
   - `src/core/loyalty/margem-do-clube.ts` (aviso de assinante no prejuízo);
   - o conversor universal de planilhas (`docs/103`, branch `conversor/esteira-universal`);
   - a página pública de agendamento (`src/app/(public)/[slug]/agendar`).
5. Os documentos de estratégia que existirem: `docs/104-founder`, `docs/105`, `docs/82` (motor de distribuição), `docs/87` e `docs/88` (custos e metas), `docs/98-aprimoramento/11` (rumo às lojas).

Se um documento citado não existir, diga que não existe e siga. Não invente o conteúdo.

## 2. Regras de evidência

- Todo número e toda afirmação levam rótulo: **FATO** (com fonte: arquivo e linha, ou URL), **INFERÊNCIA** (dedução de fatos, mostrando de quais) ou **HIPÓTESE** (a testar, com o teste proposto).
- Não invente número de mercado, de conversão nem de receita. Quando faltar, escreva a hipótese e o jeito mais barato de medir.
- O que estiver no relatório como NÃO VERIFICADO continua NÃO VERIFICADO no plano.
- Afirmação sobre o que o CICLO faz só vale se conferida no código, não na memória nem em documento antigo.

## 3. O que o plano precisa responder

### 3.1 Caminho A, conviver

1. **Qual é a proposta exata?** Por exemplo: "use o AppBarber para agendar e cobrar; use o CICLO para saber quem está sumindo e trazer de volta". Escreva em uma frase que um dono de barbearia entende.
2. **Como os dados chegam ao CICLO sem retrabalho?** O AppBarber não tem API aberta para todos (a deles exige mais de 4 profissionais, CNPJ e 6 meses de casa, e é módulo pago). Avalie, com custo e risco de cada um:
   - exportação manual (o dono pede a base no chat deles);
   - planilha periódica pelo conversor universal;
   - cadastro "de memória" (`quem-ja-atendo`);
   - lançamento rápido do atendimento no CICLO;
   - a API deles, para quem se encaixa.
   Diga qual o dono aguenta repetir toda semana.
3. **O que o CICLO precisa ter, e o que precisa NÃO ter, para conviver sem confundir** (por exemplo: esconder agenda e comanda para quem só quer a camada de recuperação). Liste as mudanças de produto.
4. **Preço e plano:** um plano só da camada de recuperação? Quanto, com que limite, e como isso conversa com Grátis, Solo e Equipe sem canibalizar.
5. **Riscos:** o AppBarber copiar a função; o dono desistir de alimentar dois sistemas; dados velhos deixarem a previsão errada; LGPD de dados importados de outro sistema.

### 3.2 Caminho B, superar

1. **Por onde atacar**, usando as fraquezas medidas no relatório:
   - assinatura que segue cobrando depois de cancelar;
   - login e cadastro quebrados;
   - suporte lento;
   - preço escondido em módulos e créditos;
   - cliente obrigado a criar conta para agendar;
   - vitrine que mostra a barbearia concorrente;
   - termos de 2020;
   - 30 dias de teste contra o nosso plano grátis.
   Para cada uma: a promessa do CICLO, a prova que o CICLO consegue mostrar hoje e o que falta construir.
2. **O que o CICLO precisa ter para um dono trocar sem medo**, em ordem. Considere o que eles têm e nós não:
   - pagamento online e sinal por Pix, aceitando CPF;
   - clube com cobrança automática e cancelamento pelo cliente;
   - nota fiscal;
   - fila por ordem de chegada;
   - várias unidades;
   - app nas lojas.
   Para cada item: obrigatório para trocar, desejável ou dispensável, com a justificativa.
3. **A troca em si:** importar clientes, histórico, serviços e assinantes do AppBarber, migrar o clube sem cobrar em dobro, e avisar o cliente final de que o link mudou. Desenhe a "virada em um dia".
4. **O que não copiar** (vitrine com concorrente, créditos de WhatsApp, módulos sem preço, recepcionista contando como profissional) e por quê.
5. **Riscos:** a reação de preço deles (o anual sai a R$ 55,90); a força do app que o cliente já tem instalado; o custo de suporte numa migração; o CICLO crescer em largura e perder o foco no que só ele faz.

### 3.3 Caminho C, conviver primeiro e superar depois

Em que momento e com que sinais (número de barbearias, uso da camada de recuperação, pedidos de agenda e cobrança) a convivência vira substituição? Defina os gatilhos medidos.

### 3.4 Comparação e recomendação

- Uma tabela A, B e C com: custo de construir (em semanas de trabalho, estimado e rotulado), tempo até o primeiro cliente pagante, risco, tamanho do público alcançável, dependência de decisões do Eduardo (pagamento, contas, preço) e quanto cada um reforça o que só o CICLO tem.
- **Recomende um caminho**, com o motivo em até 5 linhas e o que faria mudar de ideia.

## 4. Posicionamento e mensagem

Para o caminho recomendado:

1. A frase de posicionamento (uma linha) e três mensagens de apoio, cada uma ligada a um fato do relatório.
2. A página "CICLO ou AppBarber?" (ou "Use o CICLO junto com o AppBarber", se for o caminho A): estrutura, títulos e a tabela honesta de comparação. Sem atacar a marca deles, sem número sem fonte, sem promessa de resultado que o CICLO não mede.
3. As 5 objeções mais prováveis do dono de barbearia e a resposta para cada uma.

## 5. Aquisição

Como chegar aos donos que usam o AppBarber, com custo baixo:

- busca: quem procura "alternativa ao AppBarber" e "AppBarber preço";
- Instagram e criadores do meio;
- eventos (Barber Week, Barber Day);
- indicação;
- material gratuito em troca de contato (como a websérie deles, mas com números reais);
- abordagem a barbearias que já reclamaram em público (sem expor ninguém e respeitando a LGPD).

Para cada canal: o custo, como medir e o primeiro teste em 2 semanas.

## 6. Plano de execução

1. Fases de 2 semanas, com objetivo, entregas e o critério de "pronto" de cada uma.
2. Tickets no padrão do CICLO (um ticket, um commit), com prioridade P0 a P2, dependências, tamanho (P, M, G), o arquivo provável e o teste que prova. Separe o que é código do que é decisão do Eduardo e do que é marketing.
3. Métricas de sucesso, com o valor de partida (medido ou "a medir") e a meta:
   - barbearias vindas do AppBarber;
   - tempo da importação;
   - clientes recuperados pela fila;
   - receita recuperada;
   - churn nos primeiros 60 dias.
4. O que precisa do Eduardo, em lista curta e ordenada, com o motivo de cada item.

## 7. Entrega

- Escreva em `docs/concorrentes/appbarber/plano-estrategico.md`. Português simples, frases curtas, sem jargão técnico para o que o Eduardo precisa decidir.
- Comece com um resumo de 10 linhas: o caminho recomendado, por quê, os 5 primeiros passos e as decisões pendentes.
- No fim, uma seção "O que não sabemos e como descobrir", com os testes mais baratos para cada dúvida.
- Antes de entregar, releia o plano procurando: número sem rótulo, afirmação sobre o CICLO sem conferir no código, e promessa que o produto ainda não cumpre. Corrija o que achar e diga que fez essa revisão.
