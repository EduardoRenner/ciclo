# Descobertas — CICLO (evolução autônoma do produto)

> Achados investigados com evidência, não suposição. Cada entrada diz o que foi observado, como foi
> confirmado, e o que (se algo) ainda falta para agir.

---

## 2026-09-20 · "Motor acertou 0%" é garantido pela estrutura dos dados de demo, não pelo algoritmo

**Onde:** `/admin/recuperar` (tela "Recuperar receita"), card de prestação de contas
(`src/app/admin/recuperar/prestacao.tsx` + teaser em `src/app/admin/hoje/prestacao-teaser.tsx`), a
um toque da tela "Hoje" — a mais visitada do painel.

**O que se vê ao vivo** (login `dono-demo-dom-estilo@ciclo.app`, senha do
`scripts/seed-demo-6-negocios.mjs`, 2026-09-20): *"O Motor acertou 0% das 132 previsões já
conferidas."*

**Por que isso chamou atenção.** `prestacao-de-contas.ts` já é uma peça cuidadosamente projetada
contra viés de sobrevivência (conta "não voltou" como ERRO, não ignora) e já tem piso de amostra
(`MINIMO_PARA_AFIRMAR = 8`) — 132 está bem acima disso. Um algoritmo determinístico rodando contra
histórico com cadência REGULAR por cliente (o que o seed constrói deliberadamente, `__cadencia` por
cliente) não deveria errar 132 de 132 por acaso — mesmo um algoritmo ruim acertaria algumas.

**Causa raiz, confirmada lendo o código (não suposição):**
1. `registrarPrevisoes` (`src/server/services/ciclo.ts` L154-227) roda UMA vez por combinação
   (cliente, serviço), usando o histórico COMPLETO — registra UMA previsão para "o que vem depois
   da última visita conhecida".
2. `resolverPrevisoes` (`src/server/services/previsao.ts` L90-138) só marca uma previsão como
   resolvida-com-acerto se existir uma visita **estritamente depois** de `last_visit_on` no mesmo
   par (cliente, serviço).
3. O seed (`scripts/seed-demo-6-negocios.mjs` L320-345) gera histórico inteiramente **retroativo**
   (`status: 'done'`, datas no passado) numa única rodada — não há NENHUMA visita depois da mais
   recente de cada cliente, porque nada é inserido depois do seed rodar.
4. Resultado: toda previsão registrada para este tenant está estruturalmente condenada a nunca
   resolver como acerto. Depois de `JANELA_DE_ESPERA_DIAS` (30 dias) sem uma visita que não pode
   existir, `prestacaoDeContas` conta cada uma como `naoVoltou` — um erro garantido, não medido.

**Isto é um bug de PRODUTO ou de DEMO?** De demo. Um tenant real e ativo recebe agendamentos novos
continuamente (bookings de verdade), então `resolverPrevisoes` tem chance real de encontrar a
"volta" e resolver a previsão como acerto. O seed é que constrói uma base congelada, sem nada
acontecendo depois — a métrica mede exatamente essa ausência de atividade futura, não a qualidade
do algoritmo.

**Risco real, mesmo sendo "só" demo:**
- A tela `/admin/recuperar` é alcançável em UM toque a partir de "Hoje" (confirmado ao vivo). Quem
  explora a conta demo — cliente em potencial, ou a própria equipe numa demonstração ao vivo — pode
  cair nesse número e ler "o diferencial do produto não funciona".
- **Verificado, e é a parte boa:** o print de marketing atual (`public/exemplo/demo-dom-estilo-hoje.webp`,
  usado em `painel-do-dono-exemplo.tsx` na home) corta ANTES de chegar neste card — a captura pára em
  "48 clientes perto do prêmio". O risco de marketing não está realizado hoje, mas fica um toque de
  distância de qualquer refeitura do print que role a página um pouco mais fundo.

**Por que não consertei agora.** O conserto certo é o seed simular ALGUMAS visitas de retorno
recentes para os clientes que NÃO estão no grupo deliberadamente atrasado (a variável `i % 4 === 0`
já reserva 1 em 4 para ficar atrasado de propósito — os outros 3 em 4 deveriam poder "acertar").
Mas `scripts/seed-demo-6-negocios.mjs` é compartilhado pelos SEIS negócios de demo, e os valores que
ele produz já foram calibrados em pelo menos 5 rodadas anteriores (ver docstring de
`painel-do-dono-exemplo.tsx`) para bater com números citados noutras partes do produto (ex.: "R$
1.840" da home). Mexer no laço de geração de agendamentos sem conseguir rodar localmente (Docker
indisponível nesta sessão — sem como testar contra um banco de verdade antes de aplicar em produção)
arrisca descalibrar os seis negócios ao mesmo tempo, um erro caro de reverter (o script apaga e
recria os seis a cada execução). Rodar o seed é sempre escrita em produção — exige autorização
explícita, não é decisão que este agente toma sozinho.

**Status:** documentado, não corrigido. Ver `autonomous-backlog.md` para o item de acompanhamento.

---

## 2026-09-20 · Botão nativo não responde a Enter/Espaço neste navegador de teste — descartado como limite da ferramenta

Durante a mesma exploração, testar o seletor de serviço de `/{slug}/agendar` via teclado (Tab até o
botão, depois Enter) não mudava o estado (`aria-pressed` continuava `false`). Antes de reportar como
bug de acessibilidade, testei um `<button onclick=...>` criado do zero via `javascript_exec` numa
página NEUTRA (`example.com`, sem nenhum código do CICLO) — o mesmo comando de teclado (`Return`) não
disparou o clique nele também. Como um `<button>` nativo recebe Enter/Espaço por padrão do browser,
sem handler nenhum de JS precisar tratar isso, e o botão de teste falhou da mesma forma, a conclusão
é que a ferramenta de automação de teclado deste ambiente (`computer key`) não está disparando o
evento nativo de ativação — não é um defeito do código do CICLO. Não virou item de backlog: é uma
limitação conhecida da ferramenta de teste, registrada aqui para a próxima sessão não repetir a
investigação do zero.
