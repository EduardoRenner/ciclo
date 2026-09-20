# Backlog autônomo — CICLO

> Lista viva. Não é uma fila fixa: itens entram, saem, se fundem e mudam de prioridade conforme a
> investigação avança. `status`: `identificado` / `em-andamento` / `bloqueado-externo` / `feito` /
> `descartado` (com motivo).

---

### BL-01 · Seed de demo garante "Motor acertou 0%" — sem relação com a qualidade real do algoritmo

- **Problema:** o tenant de demonstração mostra "Motor acertou 0% das 132 previsões" em
  `/admin/recuperar`, alcançável em 1 toque a partir de "Hoje". Causa raiz: histórico do seed é
  inteiramente retroativo, sem nenhuma visita futura simulada, então nenhuma previsão pode resolver
  como acerto — ver `discoveries.md` para a investigação completa.
- **Evidência:** lido `prestacao-de-contas.ts`, `previsao.ts`, `ciclo.ts` e
  `seed-demo-6-negocios.mjs`; confirmado ao vivo em produção (login demo).
- **Impacto potencial:** médio-alto. Não afeta tenants reais (eles recebem agendamentos novos de
  verdade). Afeta a credibilidade do produto para quem explora a conta demo ou assiste a uma
  demonstração ao vivo que role até "Recuperar receita".
- **Esforço:** médio — exige tocar `scripts/seed-demo-6-negocios.mjs`, script compartilhado e já
  calibrado por 5+ rodadas anteriores, sem ambiente local pra testar antes de aplicar (Docker
  indisponível nesta sessão).
- **Risco:** alto de regressão silenciosa nos SEIS negócios de demo se mexido sem poder testar
  localmente; a aplicação real do conserto exige RODAR o script (apaga e recria os seis tenants —
  escrita destrutiva em produção, fora do que este agente decide sozinho).
- **Confiança na causa raiz:** alta (código lido de ponta a ponta, não inferido).
- **Área:** confiabilidade / demo / marketing.
- **Status:** `identificado`. Não implementado nesta rodada — ver critério acima. Próxima ação
  sugerida: Eduardo decide se vale a pena (a) ajustar o seed para simular algumas visitas de retorno
  recentes nos clientes que não estão no grupo deliberadamente atrasado, testando num ambiente com
  Docker antes de aplicar; ou (b) aceitar como limitação de demo documentada, já que o print de
  marketing atual não alcança este card.

---

### BL-02 · Guardas de varredura ainda não checadas por completude (11 de 16 candidatas)

- **Problema:** sessão anterior achou 2 guardas de varredura ("guarda cega") com lista de arquivos
  incompleta (`imagem-da-marca-diz-o-tamanho`, `recurso-pago-avisa-antes`), ambas já estendidas e
  testadas por mutação. Uma checagem rápida em outras 5 candidatas (maior contagem de `join('src'`)
  não achou o mesmo padrão — todas eram de escopo fechado, não listas abertas.
- **Evidência:** `tests/unit/design/*.test.ts`, 16 candidatas identificadas via
  `grep -L "readdirSync\|readdir(\|globSync"`, 7 checadas.
- **Impacto potencial:** baixo-médio por item (cada uma protegeria uma regressão específica, não um
  bug ativo) — mas o padrão já rendeu 2 achados reais nesta base.
- **Esforço:** baixo por item (leitura de docstring + decisão).
- **Risco:** nenhum (é investigação, não mudança de código até achar algo).
- **Confiança:** média — o padrão "toda tela X" já provou existir aqui duas vezes.
- **Área:** qualidade / dívida técnica.
- **Status:** `feito` (2026-09-20) — as 16 candidatas foram todas lidas. As 14 restantes
  (`estrelas-nao-repetem-o-svg`, `ordem-de-lista-nao-empata`, `precos-nao-repete-icone`,
  `previsto-nao-conta-pending-vencido`, `quantos-estao-sumindo-e-um-numero-so`,
  `revogar-imagem-despublica-de-verdade`, `agendar-consulta-o-profissional-escolhido`,
  `logo-do-salao-nao-e-cortado`, `agendamento-do-cliente-nao-repete-preco`,
  `cookie-de-sessao-e-httponly`, `login-nao-manda-para-fora`, `ponto-de-pedido-tem-onde-ser-definido`,
  `campanha-nao-compara-janelas-diferentes`, `telas-do-admin-tem-loading` — esta última já é
  autoatualizável via `readdirSync`, nunca precisou de extensão) são todas de escopo FECHADO — um
  defeito específico já corrigido, guardado por nome/estrutura, não uma lista aberta de "toda tela
  X" que poderia crescer sem a guarda acompanhar. Não há mais candidata a estender nesta safra. Se
  uma guarda NOVA for escrita no futuro, vale reaplicar este crivo (a lista é fechada ou vai
  crescer?) antes de considerá-la completa.

---

### BL-03 · Confirmação de payload de imagem em navegador real (pendência de `WEB_EXPERIENCE_AUDIT.md`)

- **Problema:** o conserto de `sizes` no wordmark (sessão anterior) não foi confirmado com Network
  tab de um navegador real — o navegador de teste sandboxed tem uma peculiaridade de seleção de
  `srcset` que não permite medir o download de verdade.
- **Impacto potencial:** baixo — o HTML gerado já foi conferido byte a byte como correto.
- **Esforço:** não aplicável com as ferramentas desta sessão (precisa de Chrome/Safari reais).
- **Status:** `bloqueado-externo` — precisa do Eduardo confirmar com DevTools próprio, ou de uma
  ferramenta de browser não-sandboxed numa sessão futura.

---

### BL-04 · Prévia de estrelas em `/avaliar` sem paridade de teclado — FEITO

- **Problema:** `onMouseEnter`/`onMouseLeave` davam prévia visual ao passar o mouse pelas estrelas;
  navegação por teclado (Tab) não tinha equivalente.
- **Fix:** `onFocus`/`onBlur` espelhando os handlers de mouse. Commit `e6f841dc`.
- **Verificação:** `tsc`/`eslint`/`pnpm build`/`tests/unit` (290/2524) verdes. Sem preview local
  (Docker indisponível) — mudança mecânica de baixo risco, dois handlers a mais espelhando dois já
  testados.
- **Status:** `feito` (2026-09-20).

---

### BL-05 · Aprovar/recusar orçamento apagava a tela inteira durante o envio — FEITO

- **Problema:** `aprovar()`/`recusar()` reaproveitavam `estado('carregando')` — o mesmo estado da
  carga inicial — enquanto o POST estava em voo. `telaDoOrcamento` mostrava só "Carregando
  orçamento…", apagando itens e total durante a decisão de maior custo das quatro telas públicas.
- **Fix:** estado `pendente` separado, spinner no próprio `Button` (mesmo padrão de `/avaliar`).
  Commit `f427a156`.
- **Verificação:** `tsc`/`eslint`/`pnpm build`/`tests/unit` (290/2524, incluindo o guard existente
  `orcamento-mostra-erro.test.ts`, intocado) verdes.
- **Status:** `feito` (2026-09-20).

---

### BL-06 · `ATUALIZADO_EM` (privacidade/termos) sem proteção contra ficar velho de novo — mitigado

- **Problema:** `privacidade/page.tsx` já teve exatamente este bug (data presa depois do conteúdo
  mudar, commit `e428ec1a`). `termos/page.tsx` tem a mesma constante solta, mesmo risco estrutural
  (hoje correta, mas sem proteção).
- **Por que não virou guarda automática:** o defeito é uma comparação ENTRE VERSÕES do arquivo
  (conteúdo mudou, data não), não uma propriedade de uma versão isolada — não cabe no padrão de
  guarda de varredura desta base sem introduzir fragilidade nova (dependência de git dentro do
  teste, ou uma janela temporal não-determinística).
- **Mitigação:** comentário no ponto exato da constante, nas duas páginas, contando o incidente e
  pedindo para mudar a data na mesma alteração que muda o texto. Commit `72663f46`.
- **Status:** `feito`, com ressalva — é aviso, não trava. Se um dia este projeto ganhar um passo de
  CI que compara diffs de arquivo (fora do padrão Vitest atual), vale revisitar como guarda de
  verdade.

---

## Descartadas

- **Hipótese de double-booking em `reivindicarEncaixe`** (2026-09-20) — investigada a fundo, não é
  bug real: `appointments_no_overlap` (constraint do banco) já serializa a única colisão possível
  para este fluxo. Ver `discoveries.md`.
