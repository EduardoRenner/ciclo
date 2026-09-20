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

### BL-07 · `required` do `MoneyInput` nunca disparava — produto/serviço podia salvar a R$ 0,00 — FEITO

- **Problema:** `MoneyInput` sempre renderiza texto não-vazio ("0,00"), então `required` do HTML
  nunca ativa. 3 usos afetados: preço de produto de revenda, preço principal de serviço, valor da
  hora (`visit_hourly`), meia diária. Nem cliente nem servidor bloqueavam valor zero.
- **Evidência:** lido `money-input.tsx`, os 2 formulários, e os schemas Zod correspondentes
  (`estoque.ts`, `servicos.ts`) — confirmado `min(0)`/`!= null`, nunca exigência de valor positivo.
- **Impacto potencial:** médio — produto vendido de graça em toda comanda futura, ou serviço
  reservável de graça em toda reserva, até o dono perceber (sem aviso nenhum no caminho).
- **Cuidado tomado:** não confundir com a "cortesia" documentada em `comanda.ts`, que é sobre
  override manual (`unitPriceCents`) no momento da venda, não sobre o preço padrão do catálogo —
  a trava nova é só no cadastro, a cortesia pontual continua igual.
- **Fix:** validação explícita no cliente nos dois formulários, mesmo padrão do campo "nome"
  (`nome.trim().length < 2`) já usado nos mesmos arquivos. Commit `0a53f5b0`.
- **Verificação:** `tsc`/`eslint`/`pnpm build`/`tests/unit` (290/2524) verdes.
- **Status:** `feito` (2026-09-20).

---

### BL-08 · Telefone inválido marcava cliente como "enviado" em campanha, sem abrir WhatsApp — FEITO

- **Problema:** `linkWhatsApp` devolve `null` para telefone ausente/inválido; o `onClick` do card
  marcava o cliente como enviado mesmo assim (`href="#"` não abre nada, mas o estado local não
  sabia disso). Campanha registrada incluía o cliente como alcançado sem nenhuma mensagem ter saído.
- **Fix:** card vira `div` sem toque quando `link` é `null`, com motivo visível (mesma linha do
  LTV) e `title`. Commit `fac7a35d`.
- **Achado incidental:** duas guardas de copy (`copy-nao-supoe-genero`, `copy-sem-travessao`)
  pegaram erros reais no texto que escrevi (gênero implícito, travessão) — corrigido antes de
  commitar.
- **Verificação:** `tsc`/`eslint`/`pnpm build`/`tests/unit` (290/2524) verdes.
- **Status:** `feito` (2026-09-20).

---

### BL-09 · `ficha.tsx`: "Indicar"/"Mensagem" habilitados com telefone inválido (não só ausente) — FEITO

- **Problema:** mesma classe de BL-08, causa diferente — checagem usava `!cliente.phoneE164`
  (ausência), não se `linkWhatsApp()` de fato produzia link. Telefone corrompido/curto passava,
  botão habilitava, toque abria nada, folha fechava como se tivesse funcionado.
- **Fix:** `telefoneUtilizavel` centraliza a checagem real nos dois botões. Commit `ff65d3b4`.
- **Verificação:** `tsc`/`eslint`/`pnpm build`/`tests/unit` (290/2524) verdes.
- **Status:** `feito` (2026-09-20).

---

### BL-10 · Drenagem concorrente da fila offline — FEITO (confiança média, não verificado ao vivo)

- **Problema:** `drenarFilaPendente()` alcançável por dois caminhos independentes (`online`,
  backoff), só o LAÇO de retry tinha mutex, não a drenagem em si — reconexão + retry agendado no
  mesmo instante podia mandar a mesma mutação duas vezes.
- **Confiança:** média — plausível e não testável ao vivo nesta sessão (arquivo já documenta
  dependência de browser real, sem jsdom). `Idempotency-Key` do servidor provavelmente já absorve,
  mas o cliente não deveria criar a corrida mesmo assim.
- **Fix:** `drenagemEmAndamento`, mutex na própria função. Rastreado: nenhuma mutação fica perdida,
  só adiada até o mutex liberar. Commit `5af14929`.
- **Verificação:** `tsc`/`eslint`/`pnpm build`/`tests/unit` (290/2524) verdes. Sem teste novo
  (arquivo sem cobertura automatizada por desenho).
- **Status:** `feito` (2026-09-20), pendência: confirmar ao vivo (DevTools → Network → Offline)
  numa sessão com acesso a esse tipo de teste.

---

### BL-11 · Desativar push não conferia sucesso do servidor — FEITO

- **Problema:** `desativar()` não checava `resposta.ok` do `DELETE /api/v1/push/subscriptions`
  (ao contrário de `ativar()`, que já checava). 401/403/500 não lança — passava batido, servidor
  continuava com a inscrição salva, UI dizia "desativado". Terceira instância da classe de
  "sucesso fingido" (BL-08, BL-09, agora aqui).
- **Confirmado antes de decidir:** a rota é idempotente (`DELETE ... WHERE` sem erro em 0 linhas
  afetadas), então a checagem não cria falso-positivo pro caminho normal.
- **Fix:** `if (!resposta.ok) throw` antes de `unsubscribe()`, mesma forma de `ativar()`. Commit
  `0483d2d2`.
- **Verificação:** `tsc`/`eslint`/`pnpm build`/`tests/unit` (290/2524) verdes.
- **Status:** `feito` (2026-09-20).

---

### BL-12 · Varredura completa de "fetch sem .ok" — 3 novas instâncias, todas FEITAS

- **Método:** `grep` de todo `await fetch(` em `src/**/*.tsx` (50 arquivos), comparado com
  contagem de `.ok` no mesmo arquivo. 4 candidatos, 1 falso positivo (confirmado lendo, não
  descartado por suposição), 3 reais.
- **Achados:** `recuperar.tsx` `trocarFiltro()` (falha silenciosa) e `enviar()` (falha parece
  sucesso vazio); `profissionais/lista.tsx` `desativar()` (otimista, só reverte em erro de rede);
  `editor-expediente.tsx` `removerFolga()` (pior caso — nem try/catch existia).
- **Fix:** checagem de `r.ok` + reversão de estado + toast de erro nos quatro, mesmo padrão já
  usado em `BotaoRecalcular`. Commit `b81bff89`.
- **Verificação:** `tsc`/`eslint`/`pnpm build`/`tests/unit` (290/2524) verdes.
- **Status:** `feito` (2026-09-20) para `.tsx`. Varredura de `.ts` achou mais um caso — ver BL-13.

---

### BL-13 · `limitarComUpstash` sem checar `.ok` (latente — Upstash não provisionado) — FEITO

- **Problema:** BL-12 só cobriu `.tsx`. Estendendo a `.ts`, achei `rate-limit.ts`: `incr`/`expire`
  do Upstash sem checar `.ok` — erro com JSON válido virava `contagem: undefined`, e `undefined <=
  limite` é `false`, recusando TODO tráfego em vez de cair pro Postgres (a intenção documentada
  extensivamente no arquivo, achado de segurança S4).
- **Por que latente, não ativo:** `UPSTASH_REDIS_REST_URL`/`TOKEN` não provisionados em produção
  hoje (auditoria do próprio arquivo, 23/08) — mas é o caminho "preferencial" documentado pra
  quando for provisionado.
- **Fix:** `incr` lança em falha (aciona o fallback já existente). `expire` NÃO lança — só loga —
  porque `incr` já aconteceu de verdade em Upstash; lançar contaria a mesma requisição duas vezes.
- **Testado e mutation-testado:** `limitarComUpstash` exportada só pra teste (mesmo padrão de
  `chavesEmMemoriaParaTeste`). 3 testes novos com `fetch` mockado. Reintroduzi o defeito exato e vi
  o teste reprovar (`{permitido: false, restante: NaN}`) antes de restaurar. Commit `f20cea52`.
- **Verificação:** `tsc`/`eslint`/`pnpm build`/`tests/unit` (290/2527) verdes.
- **Status:** `feito` (2026-09-20). Varredura de "fetch sem `.ok`" agora completa em `.tsx` E `.ts`.

---

### BL-14 · `apagarBancoOffline()` falhando era 100% silencioso — FEITO

- **Problema:** `.catch(() => undefined)` em `sair.tsx`/`excluir-conta/formulario.tsx` descartava
  sem rastro uma falha da limpeza de segurança S9 (PII de mutações pendentes num tablet
  compartilhado).
- **Método:** varredura de `.catch(() => {})`/`.catch(() => undefined)`/`catch {}` em toda a base
  (~20 ocorrências), cada uma verificada individualmente — só esta tinha dado sensível em jogo.
- **Fix:** `console.warn` estruturado nos dois lugares, mesmo padrão de `upstash_indisponivel`.
  Commit `2f586143`.
- **Verificação:** `tsc`/`eslint`/`pnpm build`/`tests/unit` (290/2527) verdes.
- **Status:** `feito` (2026-09-20).

---

## Descartadas

- **Hipótese de double-booking em `reivindicarEncaixe`** (2026-09-20) — investigada a fundo, não é
  bug real: `appointments_no_overlap` (constraint do banco) já serializa a única colisão possível
  para este fluxo. Ver `discoveries.md`.

---

### BL-15 · `verificarCaptcha`: status de erro do provedor virava "reprovação normal", sem aviso — FEITO

- **Problema:** o arquivo já tinha sido corrigido uma vez (auditoria 2026-08-28) para não engolir em
  silêncio uma indisponibilidade da hCaptcha — mas só no caminho de EXCEÇÃO (`fetch` rejeita:
  timeout, DNS, rede caída). `fetch` não lança em status HTTP de erro: um 5xx com corpo JSON válido
  passava direto pelo `try`, `success` saía `undefined` (falsy), e a função devolvia `false` pelo
  mesmo caminho de "o provedor respondeu e reprovou o token" — sem cair no `catch`, sem logar
  `hcaptcha_indisponivel`. Uma indisponibilidade prolongada do provedor que responde 500 COM corpo
  em vez de derrubar a conexão bloquearia agendamento público de verdade, calada — exatamente a
  classe de defeito que este mesmo arquivo já se cobrou de consertar, só que reaberta por um caminho
  que a correção anterior não cobria.
- **Evidência:** `src/server/services/captcha.ts`; teste novo (`captcha-nao-falha-em-silencio.test.ts`,
  5º caso) reproduziu com `fetch` mockado devolvendo `new Response(JSON.stringify({message:'...'}),
  {status:503})` — falhou mostrando `expected undefined to be true` antes do conserto.
- **Conserto:** `if (!r.ok) throw new Error(...)` logo após o fetch, antes de ler o JSON — empurra
  este caso para o `catch` já existente, que já faz a coisa certa (loga `hcaptcha_indisponivel` e
  deixa passar).
- **Mutação:** commitei antes, reintroduzi o defeito (removi o `if (!r.ok) throw`), vi o novo teste
  reprovar mostrando exatamente `expected undefined to be true`, restaurei via `git checkout --`.
- **Como achei:** varredura heurística "arquivos com `await fetch` e menos `.ok` que fetches" —
  mesma técnica de BL-12/13, reaplicada num tick de manutenção sem PR/CI pendente para investigar.
  Os outros dois candidatos (`api-client.ts`, `assistente-flutuante.tsx`) eram falsos positivos: o
  primeiro classifica por `status` numérico direto (`classificarResposta`, já testado e correto), o
  segundo tem outro fetch que legitimamente não precisa de `.ok` (verificado antes de descartar).

`tsc`/`eslint`/`pnpm test:unit` (290/2528) verdes.
