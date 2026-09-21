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

---

### BL-16 · `processarLote`: `finish_job(done)` falhando após handler bem-sucedido reexecutava o job — FEITO

- **Problema:** o `catch` de `processarLote` tratava "handler falhou" e "handler rodou com sucesso
  mas `finish_job('done')` falhou depois" como o MESMO caso — o segundo cenário caía no mesmo
  `throw`/`catch`, marcava o job `failed`/`dead` via `decidirDesfecho`, e ele seria reexecutado na
  próxima passada, rodando de novo um handler que JÁ tinha completado com sucesso (mensagem
  duplicada, cobrança duplicada, dependendo do handler).
- **Por que importa mesmo sem handler real hoje:** `HANDLERS` (`src/app/api/cron/jobs/route.ts`)
  está vazio em produção — bug latente, não alcançável ainda. Mas o comentário do próprio arquivo
  já nomeia `send_reminders` como o próximo handler esperado, e mensagem duplicada é exatamente a
  classe de defeito que este produto trata com mais cuidado em todo outro lugar (WhatsApp,
  MercadoPago). Vale consertar ANTES do primeiro handler real chegar, não depois de um incidente.
- **Evidência:** `src/server/services/job-queue.ts`; teste novo
  (`job-queue-nao-reexecuta-apos-sucesso.test.ts`) com fake de `db.rpc` (a integração real precisa
  de Docker/Supabase local, indisponível nesta sessão) reproduziu o cenário exato: handler roda uma
  vez, `finish_job('done')` falha — o código antigo lançava `AppError('INTERNAL')` não-capturado ao
  tentar a segunda chamada de `finish_job` (com status de falha), que TAMBÉM falhava no mock.
- **Conserto:** separa o resultado do handler (sucesso/falha) da gravação do resultado. Sucesso com
  falha de gravação não vira `failed`/`dead` — loga `job_concluido_sem_registro` e deixa o job em
  `running` (vira "job parado" para a vigilância existente, desfecho seguro que pede conferência
  humana, em vez de reexecutar uma ação não-idempotente às cegas).
- **Mutação:** commitei antes, reverti para o código antigo, confirmei que o novo teste reprova
  (mostrando o `AppError` não-capturado que o código antigo produz neste cenário exato), restaurei
  via `git checkout --`, confirmado.
- **Limitação desta verificação:** só testado a nível de unidade (fake de `db.rpc`) — o teste de
  integração real (`tests/integration/job-queue.test.ts`) não pôde rodar nesta sessão (sem Docker).
  Vale rodar `pnpm test:integration` numa sessão com Supabase local antes de considerar 100%
  coberto, mesmo a lógica estando correta na revisão.

`tsc`/`eslint`/`pnpm test:unit` (291/2529) verdes.

---

### BL-17 · `enviarLembretesPendentes`: item ruim abortava o lote inteiro — FEITO (parcial, achado maior registrado)

- **Problema:** o laço de `enviarLembretesPendentes` (`src/server/services/lembretes.ts`) não
  isolava cada envio — um `await enviarComFallback(...)` solto, sem `try/catch`. Um erro num item
  (dado malformado, blip transitório de banco/provedor) abortava o lote inteiro: os lembretes
  seguintes do MESMO tick não eram sequer tentados. Mesma classe já corrigida em `recompute-cycles`/
  `segments`/`campanhas`/`stock-alerts` (todos com `try` por item) — esta rota ficou de fora da
  varredura anterior porque não tem laço por TENANT, tem laço por ENVIO.
- **Conserto:** `try/catch` por item, log estruturado (`lembrete_falhou`) e segue para o próximo —
  mesmo padrão das quatro rotas irmãs.
- **Achado maior, NÃO corrigido — registrado para decisão futura:** ao investigar, encontrei que
  `registrar()` (`server/services/mensageria.ts`) pode lançar `AppError('INTERNAL')` se o `insert`
  em `messages` falhar por qualquer motivo que não seja `23505` (duplicata) — e isso acontece
  DEPOIS de `provider.sendTemplate(...)` já ter enviado a mensagem de verdade. Como
  `identificarLembretesPendentes` decide "pendente" pela AUSÊNCIA de linha em `messages`, uma
  falha de escrita depois de um envio bem-sucedido faz o MESMO lembrete ser reenviado no próximo
  tick de 15min — mensagem duplicada para a cliente de verdade. É a mesma classe do BL-16
  (job-queue), mas mais grave: lá o efeito é reexecutar um handler interno; aqui é reenviar uma
  mensagem que a cliente final já recebeu.
- **Por que não corrigi às cegas:** consertar direito exige decidir COMO garantir atomicidade
  entre "enviar" (chamada de rede a um provedor externo) e "registrar" (escrita local) — duas
  operações que não podem ser transacionais juntas por natureza. Not é um `try/catch` a mais; é
  desenho (ex.: escrever a INTENÇÃO antes de enviar e confirmar depois, ou retry robusto só do
  `insert` com backoff antes de desistir). Implementar uma escolha errada aqui é pior que não
  implementar — mesmo raciocínio já aplicado ao achado de idempotência do `clients/import`.
- **Severidade real hoje: latente, não ao vivo.** `reminders` não está em `ROTAS_AGENDADAS`
  (`src/core/cron/agendadas.ts`) — a rota só dispara via `workflow_dispatch`, nunca sozinha em
  produção. Mas ao contrário do BL-16 (handler nenhum registrado), aqui o CÓDIGO que enviaria
  mensagem de verdade já existe e é chamado sempre que a rota roda manualmente — o risco é mais
  próximo do que parece.
- **Verificação:** só manual/leitura — `tests/integration/lembretes.test.ts` precisa de Docker/
  Supabase local (indisponível nesta sessão) para rodar de verdade, e o dependency chain de
  `enviarComFallback` (checagem de demo, rate-limiter via RPC, insert em `messages`) é grande
  demais para mockar com confiança numa sessão sem poder validar contra o schema real. `tsc`/
  `eslint`/`pnpm test:unit` (291/2529) verdes — sem regressão no caminho feliz existente.

`tsc`/`eslint`/`pnpm test:unit` (291/2529) verdes.

---

### BL-18 · `enviarParaRecuperar`: cliente com erro abortava o lote de recuperação inteiro — FEITO

- **Problema:** mesma classe do BL-17, terceira instância — `for (const item of entrada.items)`
  em `src/server/services/recuperar-receita.ts` tinha várias `throw new AppError(...)` (falha de
  leitura de `client_cycles`/`clients`/`services`) e a chamada de `enviarComFallback` sem nenhum
  `try/catch` ao redor. Um erro transitório num cliente do lote de recuperação abortava os
  seguintes — em produção manual (`POST` da tela "Recuperar receita"), um dono clicando "mandar
  para os 40" perderia o resto do lote silenciosamente no primeiro erro.
- **Achado colateral valioso:** este arquivo JÁ resolve, com muito cuidado, o problema mais difícil
  que registrei como não corrigido no BL-17 (envio real seguido de falha ao GRAVAR o carimbo
  anti-duplicata) — em vez de deixar a ambiguidade se resolver sozinha, ele conta a mensagem como
  enviada mesmo se o `update` de `last_campaign_at` não gravar nenhuma linha, loga
  `recuperar_carimbo_nao_gravou` para investigação humana, e EXPLICITAMENTE decide não mentir pro
  dono dizendo "falhou" (o que causaria reenvio manual = duplicata de verdade). Vale usar como
  referência de desenho se um dia o achado do BL-17 for resolvido.
- **Conserto:** `try/catch` por cliente ao redor do corpo inteiro do laço, preservando exatamente
  os `skipped.push`/`continue` já existentes para os casos legítimos (fora de janela, rate limited,
  opt-out) — só a exceção genuína (erro de banco/rede) cai no novo `catch`, contada como
  `falha_de_envio` e logada com `recuperar_cliente_falhou`.
- **Cuidado na implementação:** a primeira tentativa extraiu o corpo para uma função auxiliar, o
  que quebrava os `continue` (inválidos fora de um laço) — revertido e refeito como `try {}` inline
  dentro do próprio `for`, preservando toda a lógica original sem reescrevê-la.
- **Verificação:** `tests/integration/recuperar-receita.test.ts` precisa de Docker/Supabase local
  (indisponível nesta sessão). `tsc`/`eslint`/`pnpm test:unit` (291/2529) verdes — mudança é aditiva
  (só um `try/catch` em volta do que já existia), sem alterar nenhum caminho feliz existente.

---

### BL-19 · `resolverCliente`: corrida de criação de cliente por telefone novo não tratava `23505` — FEITO

- **Problema:** no caminho de criação de cliente (`resolverCliente`, `src/server/services/
  agendamentos.ts`), a checagem "telefone já existe?" e o `insert` que cria o registro novo não
  são atômicos. Duas requisições quase simultâneas para o MESMO telefone AINDA NÃO cadastrado
  (toque duplo, duas abas, retry de rede depois de timeout aparente — os mesmos cenários já
  discutidos para `clients/import`/`clients/[id]/media`) passam as duas pela checagem `existente`
  (nenhuma viu a outra ainda), e a SEGUNDA a chegar no `insert` esbarra em `clients_unique_phone`
  (`tenant_id, phone_e164`, migration 0001) com `23505` — que o código tratava como erro genérico
  `AppError('INTERNAL')`, derrubando um AGENDAMENTO de verdade por causa de uma corrida inofensiva
  (a cliente já existe, criada pela outra requisição no mesmo instante).
- **Por que é grave:** é o caminho de escrita mais importante do produto — toda criação de
  agendamento (público e admin) passa por aqui. E o mesmo arquivo JÁ trata a corrida análoga para
  conflito de horário (`23P01` em `criarAgendamento`, poucas linhas abaixo) — só esta ficou de
  fora, apesar de `importacao-clientes.ts` já tratar a MESMA constraint (`23505` de
  `clients_unique_phone`) corretamente há tempos. Inconsistência entre dois lugares que deviam
  seguir a mesma regra.
- **Conserto:** `23505` não gera mais `AppError('INTERNAL')` — reconsulta por `phone_hash` (a
  cliente que a OUTRA requisição acabou de criar) e devolve o id dela. Só erro genuíno de banco
  continua caindo em `INTERNAL`.
- **Verificação:** `tsc`/`eslint`/`pnpm test:unit` (291/2529) verdes — a única guarda existente
  para `resolverCliente` (`indicacao-tem-escritor.test.ts`) é um scan estático da chamada de
  `referred_by`, que este conserto não toca. `resolverCliente` não é exportada e não tem teste
  comportamental dedicado; construir um mock de `db` para reproduzir a corrida exigiria simular
  duas chamadas concorrentes contra o mesmo `insert`, mais complexo que o padrão `fakeDb` já usado
  neste projeto — verificado por leitura cuidadosa e analogia direta com o padrão já estabelecido
  (`23P01` no mesmo arquivo, `23505` em `importacao-clientes.ts`), não por teste novo.
- **Achado nesta mesma varredura:** revisão completa do pipeline de agendamento público (rota →
  `criarAgendamentoPublico` → `criarAgendamento` → `resolverCliente`) — todo o resto já trata bem
  corridas e revalidação (produto sugerido revalidado no servidor, score de risco com fallback,
  push não-bloqueante). Este era o único ponto sem a mesma disciplina.

---

### BL-20 · `registrarMovimento`/`registrarEntradaEstoque`: ler-somar-escrever perdia corrida em `stock_qty`/`avg_cost_cents` — FEITO

- **Problema:** duas cópias independentes da mesma lógica (`registrarMovimento`, usada por baixa/
  estorno de comanda; `registrarEntradaEstoque`, usada por entrada manual) liam `stock_qty`
  (a segunda também `avg_cost_cents`), calculavam o novo valor em JavaScript, e escreviam de volta
  com `.update({ stock_qty: lido + delta })` **sem nenhum filtro sobre o valor lido** — clássico
  ler-somar-escrever sem trava. Duas escritas concorrentes no MESMO produto (duas comandas
  fechando ao mesmo tempo consumindo o mesmo xampu; uma entrada manual concorrente com uma
  comanda fechando) liam o mesmo estado inicial, e a segunda escrita **sobrescrevia** a primeira
  silenciosamente — nenhuma das duas dava erro, o número só ficava errado. Em
  `registrarEntradaEstoque` o estrago era maior: `avg_cost_cents` também é calculado a partir do
  mesmo snapshot obsoleto, corrompendo o custo médio do produto, não só a contagem.
- **Achado da classe "duas cópias da mesma fórmula"** (já nomeada neste projeto): as duas funções
  tinham o mesmo defeito, de forma independente.
- **Por que não é apenas teórico:** o `stock_moves` (ledger append-only) sempre grava certo — cada
  movimento individual é correto. É o `products.stock_qty`/`avg_cost_cents` CACHEADO (o número que
  a lista/alerta de estoque de fato mostra) que diverge silenciosamente do que o ledger somaria.
- **Conserto:** CAS com retry (até 5 tentativas) em ambas — `.eq('stock_qty', valorLido)` (e, na
  segunda, também `.eq('avg_cost_cents', valorLido)`) no próprio UPDATE; se não casar (outra
  escrita venceu a corrida), relê o valor de verdade e tenta de novo, recalculando
  `avg_cost_cents` sobre o valor relido — não bastaria reenviar o mesmo número calculado antes.
  Puro código de aplicação, sem migration: uma função `UPDATE ... SET x = x + delta` atômica no
  banco seria mais direta, mas exige nova migration + `pnpm test:rls` para confiar (indisponível
  nesta sessão sem Docker).
- **Mutação verificada com rigor extra:** o teste novo (`estoque-nao-perde-corrida.test.ts`) usa um
  fake de `db` que reproduz a corrida deterministicamente (1ª leitura devolve snapshot obsoleto,
  estado de verdade do fake já é outro). Primeira tentativa: o fake falhou com um erro de forma
  (`.single is not a function`) porque o código antigo não usa `.maybeSingle()` — ajustei o fake
  para aceitar as DUAS formas de chamada (com e sem filtro de CAS) e reproduzir o UPDATE...WHERE
  real (sem filtro extra, sempre casa — é exatamente por isso que o defeito é silencioso). Com o
  fake corrigido, o código antigo reprovou com a mensagem certa: só 1 tentativa de UPDATE (devia
  ser 2), resultado final incorreto. Restaurado o código, teste voltou a passar.
- **Verificação completa:** `tsc`/`eslint`/`pnpm test:unit` (292/2530) verdes.

---

### BL-21 · `calibracao.ts` reimplementava `diasEntre`, já exportada de `prestacao-de-contas.ts` — FEITO

- **Problema:** `src/core/cycle/calibracao.ts` tinha sua própria função privada `diasEntre`, byte a
  byte idêntica à já exportada em `prestacao-de-contas.ts` — que por sua vez já tem o docstring
  explícito "Exportada desde docs/73 T3: `calibrar-probabilidade.ts` precisa da MESMA conta... Duplicar
  a fórmula é como esta base já divergiu antes". `calibrar-probabilidade.ts` importa corretamente;
  `calibracao.ts` (nome parecido, arquivo diferente, provavelmente mais antigo) ficou de fora dessa
  consolidação.
- **Por que vale consertar mesmo sem bug hoje:** as duas implementações são idênticas AGORA — não é
  um bug de comportamento, é o próprio risco que a "duas cópias da mesma fórmula" nomeia: se alguém
  corrigir um caso de borda numa cópia, a outra mantém o comportamento antigo em silêncio, e cada
  teste isolado continua verde porque nenhum dos dois testa contra o outro.
- **Conserto:** removida a `diasEntre` privada de `calibracao.ts`; importa a de `prestacao-de-contas.ts`.
  Sem risco de import circular (nenhum dos dois arquivos importava nada antes).
- **Verificação:** `tsc`/`eslint`/`pnpm test:unit` (292/2530) verdes — comportamento idêntico
  confirmado pelos testes existentes de `calibracao.ts` continuando a passar.

---

### BL-22 · `mediana` triplicada em compute.ts/prestacao-de-contas.ts/calibracao.ts — FEITO

- **Problema:** mesma classe do BL-21, achada na mesma varredura — a função `mediana` (ordena e
  pega o valor central, com média dos dois centrais em lista par) existia em TRÊS lugares
  (`compute.ts`, `prestacao-de-contas.ts`, `calibracao.ts`), byte a byte idênticas nas três.
- **Conserto:** exportada de `compute.ts` (o arquivo mais fundamental do módulo, já fonte de
  `estadoPorAtraso` para os outros dois); `prestacao-de-contas.ts` e `calibracao.ts` importam em
  vez de reimplementar. Sem risco de import circular — `compute.ts` não importa nada dos outros
  dois (só `Temporal`), e a cadeia final é `compute.ts` ← `prestacao-de-contas.ts` ← `calibracao.ts`,
  um DAG limpo.
- **Verificação:** `tsc`/`eslint`/`pnpm test:unit` (292/2530) verdes — comportamento idêntico
  confirmado pelos testes existentes das três funções continuando a passar sem alteração.

---

### BL-23 · `voltas()` duplicada em regua-do-servico.ts/ritmo-do-cliente.ts — FEITO

- **Problema:** mesma classe do BL-21/BL-22, achada varrendo `src/core` inteiro por nomes de função
  repetidos — `voltas(quantas: number): string` (pluralização "1 volta"/"N voltas") idêntica nos
  dois arquivos. Menor severidade que `mediana`/`diasEntre` (é só texto, não conta dinheiro nem
  data), mas o mesmo risco: um ajuste de copy (este projeto se cobra muito sobre consistência de
  texto — gênero, tom) feito num lugar só diverge do outro em silêncio.
- **Conserto:** exportada de `regua-do-servico.ts`; `ritmo-do-cliente.ts` importa. Sem risco de
  import circular (nenhum dos dois importava o outro).
- **De carona:** conferido se `dias(quantos)`, a função vizinha em `ritmo-do-cliente.ts`, também
  estava duplicada em algum lugar — não estava, ficou como está.
- **Verificação:** `tsc`/`eslint`/`pnpm test:unit` (292/2530) verdes.

---

### BL-24 · `weekdayPg` quadruplicada — a maior duplicação achada nesta varredura — FEITO

- **Problema:** mesma classe do BL-21/22/23 — `weekdayPg(dia: Temporal.PlainDate)` (converte
  `dayOfWeek` de `Temporal` para a convenção `0=domingo…6=sábado` que `business_hours.weekday`
  usa) existia em QUATRO arquivos: `agendamentos.ts`, `public-booking.ts`, `ociosidade.ts` (com um
  cast extra para o tipo `Weekday`) e `core/recurrence/gerar-ocorrencias.ts`. Cada cópia tinha um
  comentário citando as OUTRAS pelo nome ("mesma convenção de agendamentos.ts") — o padrão já
  reconhecia a duplicação havia tempo, só nunca virou import de verdade.
- **Conserto:** exportada de `core/tempo/dia.ts`, ao lado de `diaDaSemanaNoFuso` (que resolve a
  mesma pergunta a partir de `Date`+fuso em vez de `PlainDate` já resolvido — os dois cobrem
  entradas diferentes da mesma convenção, cada um mantido separado). Os quatro arquivos agora
  importam em vez de reimplementar. Em `ociosidade.ts`, o cast `as Weekday` saiu — o único uso é
  numa comparação `!==`, onde `number` compara direto com o literal union sem cast.
- **Verificação:** `tsc`/`eslint`/`pnpm test:unit` (292/2530) verdes.

**As quatro consolidações desta rodada (BL-21 a BL-24) fecham a varredura de "mesma fórmula
duplicada" iniciada ao investigar `resolverCliente` — de `src/core` e `src/server` inteiros, só
essas quatro funções tinham cópias idênticas.**

---

### BL-25 · `mesCorrente` divergente entre ferramentas.ts e respostas-rapidas.ts — FEITO

- **Problema:** variante do BL-21/22/23/24, achada checando os últimos candidatos da varredura —
  `mesCorrente(timezone)` existia em `server/assistente/ferramentas.ts` (via `Intl.DateTimeFormat`
  + `.replace('/', '-')`) e `respostas-rapidas.ts` (via `Temporal` direto). Mesmo nome, mesmo
  propósito, **implementações DIFERENTES** — pior que os achados anteriores (que eram cópias
  idênticas, ainda não divergidas): aqui já eram duas fórmulas independentes desde o início,
  concordando hoje por sorte de entrada, não por garantia.
- **Descartados como falsos positivos na mesma varredura:** `paraColunas` (3 arquivos) e
  `traduzirErro` (2-3 arquivos) — mesmo NOME, mas corpos genuinamente diferentes por entidade
  (campos de cliente vs. profissional vs. serviço; mensagem de "telefone" vs. "nome do serviço").
  É o mesmo PADRÃO arquitetural repetido por design, não a mesma fórmula duplicada.
- **Conserto:** `mesAtual` exportada de `core/tempo/dia.ts` (relógio injetável, mesmo padrão de
  `diaNoFuso`), usando a via `Temporal` (mais direta que `Intl.DateTimeFormat` + substituição de
  string). Os dois arquivos agora importam.
- **Verificação:** `tsc`/`eslint`/`pnpm test:unit` (292/2530) verdes — testado manualmente com
  `node -e` que as duas fórmulas concordam para a data de hoje antes de escolher qual manter.

---

### BL-26 · `horaLocal` triplicada em agenda.tsx/hoje.tsx/agendar.tsx — FEITO

- **Problema:** mesma varredura, ampliada para `src/app` (não só `src/core`/`src/server`) —
  `horaLocal` formatando `HH:MM` existia em três telas. `admin/agenda/agenda.tsx` e
  `admin/hoje/hoje.tsx` eram idênticas (sem `timezone`, correto: são telas internas, o fuso do
  navegador da profissional já é o do salão). `[slug]/agendar/agendar.tsx` tinha assinatura
  diferente (com `timezone` explícito) — correto também: é a página PÚBLICA, vista de qualquer
  fuso, e o certo é mostrar no fuso do SALÃO, não no de quem está olhando.
- **Conserto:** consolidada em `lib/formato.ts` — o arquivo que já é o destino estabelecido para
  esta classe de achado (`dinheiro`/`formatarTelefone` já tinham o mesmo histórico, documentado
  nos próprios comentários do arquivo). `timezone` virou parâmetro opcional: omitido, usa o fuso
  do runtime (cobre as duas telas internas); explícito, cobre a pública.
- **Verificação:** `tsc`/`eslint`/`pnpm test:unit` (292/2530) verdes. Sem verificação visual em
  navegador — é refatoração pura (código movido, sem mudança de lógica), e o servidor de dev
  precisa de Supabase local (Docker indisponível nesta sessão).

**Seis consolidações nesta rodada (BL-21 a BL-26).** A varredura por nome de função repetido
cobriu `src/core`, `src/server` e `src/app` inteiros — sem mais candidatos remanescentes com corpo
idêntico ou propósito divergente encontrado.

---

### BL-27 · regex `UUID` quintuplicada em 5 arquivos, um deles security-critical — FEITO

- **Problema:** varredura ampliada para CONSTANTES (não só funções) — `const UUID = /.../i` (o
  mesmo regex de UUID v4) existia, byte a byte idêntico, em CINCO arquivos:
  `core/assistente/acoes.ts`, `server/auth/tenant.ts`, `server/db/filtro.ts`,
  `server/db/with-tenant.ts`, `server/http/idempotency.ts`. Nenhum importava dos outros.
- **Por que importa mais que as consolidações anteriores:** `server/db/filtro.ts` é o arquivo da
  auditoria de segurança de 31/08/2026 que existe especificamente para impedir injeção na
  gramática de filtro do PostgREST — o UUID regex ali é a última trava antes de um valor virar
  string de consulta. Ter cinco cópias independentes desse regex específico é o pior lugar para
  esta classe de risco: uma correção de segurança num deles (ex.: aceitar também UUID v7) não
  alcançaria os outros quatro.
- **Conserto:** exportado de `core/text/uuid.ts` (novo arquivo pequeno, mesmo padrão de
  `core/text/normalizar.ts` — que por sua vez já documenta um "duas cópias da mesma regra"
  anterior, `onboarding/formulario.tsx` tinha copiado `normalizar`). Fica em `core/` porque um dos
  cinco chamadores (`acoes.ts`) também é `core/` — regra 5 do CLAUDE.md impede `core/` importar de
  `server/`, então o inverso (server importando de core) é o único caminho possível.
- **Verificação:** `tsc`/`eslint`/`pnpm test:unit` (292/2530) verdes.

**Sétima consolidação da rodada (BL-21 a BL-27)** — a primeira sobre uma CONSTANTE em vez de uma
função, achada ampliando a varredura para `const [A-Z_]+ =`.

---

### BL-28 · continuação do BL-27 — o mesmo regex `UUID` estava em MAIS 36 arquivos, não só 5 — FEITO

- **Problema:** o BL-27 corrigiu 5 ocorrências, mas parou aí sem medir o total — uma varredura mais
  ampla (`grep -rohE "= /[^/]{15,}/[a-z]*" src | sort | uniq -c`) mostrou **37 ocorrências** do
  mesmo regex de UUID no total. As 32 que faltavam eram quase todas rotas de API sob
  `src/app/api/v1/**/[id]/**/route.ts` — cada handler de rota dinâmica (`arrive`, `complete`,
  `confirm`, `no-show`, `cancel`, `close`, `route.ts` da entidade, etc.) redefinia `const UUID =
  /^[0-9a-f]{8}-.../i` localmente para validar o parâmetro de URL antes de chamar o serviço, mais
  uma em `admin/config/servicos/[id]/ficha/page.tsx`. 36 arquivos ao todo (contando o de teste já
  corrigido manualmente antes desta rodada).
- **Por que era pior do que parecia:** BL-27 já tinha nomeado `filtro.ts` como o caso mais sensível
  (regex de UUID é a trava contra injeção na gramática `.or()` do PostgREST) — mas o MESMO regex
  reimplementado 32+ vezes a mais, todas fazendo a mesma checagem de borda ("este `id` da URL é um
  UUID de verdade?"), é a superfície de divergência que a consolidação do BL-27 deveria ter fechado
  por completo e não fechou.
- **Método:** confirmado com `grep -c` que cada um dos 36 arquivos tinha EXATAMENTE UMA ocorrência,
  no formato idêntico byte a byte — seguro para automatizar. Script de uso único
  (`consolidar-uuid.mjs`, não versionado, scratchpad) removeu a linha `const UUID = ...` e inseriu
  `import { UUID } from '@/core/text/uuid'` após o último import de cada arquivo.
- **Armadilha achada rodando o script:** 17 dos 35 arquivos processados na primeira passada ficaram
  com a constante local **e** o import novo ao mesmo tempo — o `replace` do script buscava a linha
  terminada em `\n`, mas esses 17 arquivos usam terminador `\r\n` (mistura de finais de linha já
  conhecida deste projeto). Corrigido com uma segunda passada usando regex tolerante a `\r?\n`.
  Confirmado por `grep` que nenhum arquivo sob `src/` (fora `core/text/uuid.ts`, a fonte) ainda
  define o regex localmente.
- **Verificação:** `tsc`/`eslint`/`pnpm test:unit` (292/2530) verdes nos 36 arquivos consolidados.

**A consolidação real do UUID (BL-27 + BL-28) alcança agora 41 arquivos importando de uma fonte só**
— a maior duplicação de constante encontrada nesta base até aqui, e a que mais valia a pena por
tocar validação de entrada em toda rota de API com parâmetro `[id]`.

---

### BL-29 · `audit/write.ts` gravava IP forjável na trilha — a própria pessoa auditada podia mentir sobre o IP — FEITO

- **Problema:** achado ampliando a varredura de "duas cópias da mesma fórmula" (BL-21–28) para
  funções com o mesmo NOME em `src/server` inteiro. `server/http/ip.ts` tem um `ipDe` reescrito
  pela auditoria de segurança de 2026-08-23 (achado S6) especificamente porque a versão antiga lia
  o **primeiro** elemento de `X-Forwarded-For` — valor que quem chama CONTROLA quando um proxy
  confiável está no caminho (ele anexa o IP real ao FIM, não ao início). `server/audit/write.ts`
  tinha sua própria cópia de `ipDe`, com exatamente essa lógica antiga e vulnerável, nunca
  atualizada quando `http/ip.ts` foi corrigido.
- **Por que é mais grave que os achados anteriores desta classe:** o `ipDe` de `audit/write.ts` não
  é só usado internamente por `writeAudit` (a trilha de TODA mutação relevante, regra 9 do
  CLAUDE.md) — é importado diretamente por quatro rotas para os eventos mais sensíveis do produto:
  abertura de ficha do cofre de saúde (`clients/[id]/vault`), consentimentos LGPD, exportação de
  dado pessoal (`data-export`) e geração de URL assinada de mídia. Em todos os quatro, alguém
  fazendo o próprio acesso auditado podia forjar o IP que ficaria gravado como "quem acessou de
  onde" — o cenário exato que uma investigação de vazamento de dado de saúde precisaria confiar.
- **Por que os dois `ipDe` não podiam simplesmente virar um só:** `http/ip.ts` devolve `string`
  (fallback `'sem-ip'`, pensado para virar chave de balde no limitador); `audit/write.ts` devolve
  `string | null` porque `audit_log.ip` — e as colunas equivalentes em `vault`/`consentimentos`/
  `lgpd`/`media`, todas `inet` — são nullable, e `'sem-ip'` não é sintaxe válida de `inet` (teria
  quebrado TODA gravação de trilha sem IP, silenciosamente, pelo próprio `catch` que a função tem
  para não derrubar a operação).
- **Conserto:** extraída `ipConfiavelOuNulo()` em `http/ip.ts` — mesma cadeia de prioridade
  (`x-vercel-forwarded-for` → `x-real-ip` → último de `x-forwarded-for` → `null`), devolvendo
  `null` em vez de `'sem-ip'`. `ipDe` de `http/ip.ts` virou `ipConfiavelOuNulo(req) ?? 'sem-ip'`
  (comportamento inalterado, mesmos 7 testes de `ip.test.ts` continuam verdes sem tocar). `ipDe` de
  `audit/write.ts` virou um repasse direto para `ipConfiavelOuNulo`.
- **Teste existente afirmava o bug como correto:** `audit.test.ts` tinha
  `'pega o IP da pessoa, não o do proxy'` esperando o PRIMEIRO elemento de XFF — a mesma crença
  errada que a auditoria S6 já tinha desmentido para o limitador, nunca propagada para este teste.
  Reescrito para esperar o ÚLTIMO elemento (o confiável), com um segundo caso novo cobrindo que
  ausência de header grava `null`, não `'sem-ip'`.
- **Mutação verificada:** commitei o conserto, reintroduzi a lógica antiga em `audit/write.ts`, o
  teste reescrito reprovou mostrando exatamente `expected '201.10.0.7' to be '10.0.0.2'` (o forjável
  contra o confiável), restaurei via `git checkout --`, confirmado 7/7 verdes de novo.
- **De carona, mesma varredura por nome repetido:** `profissionalDoTenant` (assinatura idêntica,
  corpo byte a byte idêntico) estava triplicada em `agendamentos.ts`/`orcamentos.ts`/
  `recorrencia.ts` — consolidada na primeira (já era a fonte de `resolverCliente`/
  `profissionalDoTenant` para as outras duas, sem risco de import circular). `servicoDoTenant`
  (2 cópias) foi CONFERIDO e descartado como falso positivo — mesmo nome, `select` de colunas
  genuinamente diferente por necessidade de cada chamador (`recorrencia.ts` não usa depósito/buffer
  de agendamento). `cancelarAssinatura` (2 cópias, `assinatura-mp.ts`/`fidelidade.ts`) não foi
  tocado nesta rodada — toca cobrança/assinatura, fora do que este agente decide sozinho sem
  aprovação explícita (mesmo critério da missão de crescimento).
- **Verificação completa:** `tsc`/`eslint`/`pnpm test:unit` (292/2531) verdes.

---

### BL-30 · `MINIMO_PARA_AFIRMAR` e o teto do assistente, duplicados COM comentário apontando um pro outro — FEITO

- **Problema (parte 1):** `MINIMO_PARA_AFIRMAR = 8` existia em `core/cycle/prestacao-de-contas.ts`
  e `core/risk/precisao-do-score.ts`, cada um com um comentário citando o OUTRO pelo nome ("Mesmo
  piso de MINIMO_PARA_AFIRMAR") — mesmo padrão do BL-24 (`weekdayPg`): a duplicação já era
  reconhecida em texto, só nunca virou import de verdade. É o piso estatístico mínimo abaixo do
  qual o produto se recusa a afirmar um percentual (precisão do Motor de Ciclo e precisão do score
  de risco de falta) — os dois usam a MESMA regra de "amostra pequena demais para significar
  algo", cada um com seu próprio número solto.
- **Problema (parte 2, achado na mesma varredura de constantes repetidas):** `LIMITE_POR_TENANT_DIA`
  e `LIMITE_POR_USUARIO_HORA` (teto de uso do assistente de IA) duplicados entre
  `api/v1/assistant/route.ts` e `api/v1/assistant/rapido/route.ts` — com o MESMO valor, a MESMA
  chave de balde no limitador (`assistant:tenant:<id>`/`assistant:usuario:<id>`, ou seja, as duas
  rotas já somam no mesmo balde por desenho) e, de novo, um comentário num apontando pro outro
  ("Mesmo teto do `/api/v1/assistant` principal").
- **Por que consertar mesmo sem bug ativo:** exatamente o argumento do BL-21 — as duas cópias são
  idênticas HOJE. O risco é o de sempre: ajustar o teto do assistente (ou o piso estatístico) num
  lugar só, no futuro, sem lembrar do comentário que aponta pra cópia.
- **Conserto:** `MINIMO_PARA_AFIRMAR` exportado de `prestacao-de-contas.ts` (a direção que o
  próprio comentário de `precisao-do-score.ts` já indicava); dois testes que importavam a
  constante de `precisao-do-score.ts` (`tests/unit/core/precisao-do-score.test.ts`,
  `tests/integration/risco.test.ts`) atualizados para importar da fonte nova. `LIMITE_POR_TENANT_DIA`/
  `LIMITE_POR_USUARIO_HORA` movidos para `server/assistente/limites-de-uso.ts` (novo arquivo
  pequeno, mesmo padrão de `core/text/uuid.ts` do BL-27 — não havia módulo compartilhado natural
  entre as duas rotas antes disso); as duas rotas importam.
- **Verificação:** `tsc`/`eslint`/`pnpm test:unit` (292/2531) verdes.
- **Descartados nesta mesma varredura de constantes:** `ESTADOS_VALIDOS`, `RESPOSTA_HONEYPOT`,
  `TIMEOUT_MS`, `TAMANHO_MAXIMO`, `VALIDADE_HORAS` — mesmo nome, valores/propósitos genuinamente
  diferentes por chamador (confirmado lendo cada um, não por suposição). `ACENTO_PADRAO` e
  `VERTICAIS_LEGADAS` têm sobreposição parcial mas formatos diferentes (string vs. objeto; `Set`
  plano vs. `Set` tipado por enum do banco) — mais baixo valor/mais risco de tocar do que os dois
  consertados, deixados como estão (mesmo critério do BL-02 para `TAMANHO_IV`/`TAMANHO_PAGINA`).
  `cancelarAssinatura` (BL-29) segue fora de escopo — toca cobrança.

---

### BL-31 · Ficha do cliente: `role="tablist"` sem `role="tabpanel"` correspondente — FEITO

- **Problema:** as quatro seções da ficha do cliente (Resumo/Histórico/Fidelidade/Ficha) usam
  `<Segmented>` — um `role="tablist"`/`role="tab"` de verdade, com `aria-selected` e navegação por
  setas, construído especificamente para resolver a mesma armadilha do CLAUDE.md ("trocar conteúdo
  sem trocar de rota e não avisar"). Mas o conteúdo de cada aba (`{aba === 'resumo' ? <div
  className="mt-4">...} `) era um `<div>` comum, sem `role="tabpanel"`. Metade do padrão WAI-ARIA de
  Tabs estava implementada — a lista de abas se anuncia certo, mas o PAINEL que troca de conteúdo a
  cada clique não se identifica pra tecnologia assistiva como a região que acabou de mudar.
- **Por que é o mesmo risco que o CLAUDE.md já nomeia, por um caminho diferente:** a armadilha do
  CLAUDE.md fala de filtro/busca sem estrutura semântica nenhuma (remédio: `aria-live`). Aqui a
  estrutura semântica CERTA já existia (tabs de verdade, não filtro solto) — só ficou pela metade.
  O remédio certo para tabs incompletas é `role="tabpanel"`, não `aria-live` (duas fontes de
  anúncio concorrentes causariam o oposto do que a armadilha original tenta evitar).
- **Conserto:** `role="tabpanel"`, `id` estável e `aria-label` (nome da própria aba) nos quatro
  `<div>` de conteúdo; `tabIndex={0}` para o foco por teclado alcançar o painel depois da tablist,
  prática padrão do WAI-ARIA APG para tabpanel.
- **Escopo deliberadamente NÃO ampliado:** `aria-controls`/`aria-labelledby` cruzando tab↔painel
  exigiria plumbing de IDs pela `Segmented` (componente compartilhado, também usado pelo seletor de
  tema em `seletor-de-tema.tsx` — um controle de escolha única com efeito imediato, não uma troca
  de painel, onde `aria-controls` apontando pra um painel inexistente seria pior que omitir).
  `role="tabpanel"` sozinho já resolve o anúncio de mudança de região, que era a lacuna real.
- **Verificação:** `tsc`/`eslint`/`pnpm test:unit` (292/2531) verdes. Sem verificação visual em
  navegador — Docker indisponível nesta sessão (confirmado: `docker ps` falha), e a mudança é
  aditiva (só atributos ARIA/id/tabIndex em `<div>`s já existentes, sem tocar lógica de estado ou
  classe visual) — mudança de baixo risco pela natureza, não por falta de tentativa de verificar.

---

### BL-32 · Mesmo `tablist` sem `tabpanel` (BL-31), mais duas instâncias — FEITO

- **Problema:** ampliando a varredura de `role="tablist"` para o restante de `src` (BL-31 cobriu
  só a ficha do cliente), achei o MESMO padrão incompleto em mais dois lugares, cada um reimplementando
  o widget de tabs à mão (nenhum dos dois usa o `<Segmented>` compartilhado):
  - `admin/comanda/[id]/comanda.tsx` — alternador "Serviço"/"Produto" ao adicionar item na comanda.
    Os dois painéis eram `<label>` envolvendo um `<select>` — não dava pra pôr `role="tabpanel"`
    direto no `<label>` (um elemento com papel nativo de rótulo ganhando um `role` de painel é
    semântica conflitante), então cada painel ganhou um `<div>` novo por fora do `<label>`.
  - `(public)/[slug]/agendar/alternador-de-exemplo.tsx` — alternador "O que quem agenda vê"/"O que
    você vê" nas seis vitrines de demonstração pública. Painéis já eram `<div hidden={...}>`
    (os dois montados o tempo todo, só a visibilidade alterna — decisão documentada no próprio
    arquivo para não perder estado nem re-disparar busca de disponibilidade) — só faltava o
    `role="tabpanel"`.
- **Conserto:** mesmo padrão do BL-31 nos dois — `role="tabpanel"`, `id` estável, `aria-label` com
  o nome da própria aba, `tabIndex={0}`.
- **Verificação:** `tsc`/`eslint`/`pnpm test:unit` (292/2531) verdes. Mesma ressalva do BL-31 —
  Docker indisponível, mudança aditiva de baixo risco.
- **Escopo fechado:** com estes dois + a ficha do cliente (BL-31), toda ocorrência de
  `role="tablist"` em `src` (fora de `Segmented`, que já está correto) agora tem `tabpanel`
  correspondente. `grep -rl 'role="tablist"' src` confirma: só as 3 já corrigidas + `segmented.tsx`
  (o componente-fonte, que não declara painel nenhum — cada consumidor declara o seu).

---

### BL-33 · Foto de serviço/profissional: backend pronto desde a 0052, sem escritor na UI — identificado, NÃO implementado

- **Problema:** `fazerUploadDaEntidade` (`server/services/vitrine-upload.ts`) e a rota
  `POST /api/v1/tenant/vitrine/entidade` fazem upload de foto de serviço/profissional
  (reencode WebP, redimensiona, remove EXIF, troca a chave antiga só depois da nova estar
  gravada, guarda contra `UPDATE` de zero linhas) — código completo e bem escrito. A página
  pública (`(public)/[slug]/secoes.tsx`) já lê e EXIBE `s.imageUrl`/`p.photoUrl` condicionalmente.
  Mas **não existe nenhum `<input type="file">` em lugar nenhum do painel para service/professional**
  — varrido `grep -rln 'type="file"' src/app/admin`: só client (`fotos.tsx`), CSV
  (`importador.tsx`) e logo/capa do negócio (`imagens.tsx`). Nenhum dos formulários de
  `servicos/formulario.tsx`/`profissionais/formulario.tsx` tem campo de foto.
- **Por que é exatamente a classe que este projeto já nomeou:** a própria migration 0052
  (`supabase/migrations/0052_foto_de_servico_e_profissional.sql`) diz, sobre a coluna QUE ELA
  MESMA criava: *"é a mesma classe de `fee_cents`, `media.consent_id`, `clients.referred_by` e
  `tenants.plan` — coluna que todo mundo lê e ninguém escreve."* A 0052 resolveu o problema até a
  CAMADA DE DADOS (chave em vez de URL, bucket certo, renomeou `avatar_url` → `photo_key` para
  dizer a verdade) e construiu o serviço de upload — mas o escritor nunca chegou na UI, então a
  coluna continua 100% vazia hoje, só que um andar mais alto: não falta mais o mecanismo, falta o
  botão.
- **Confirmado, não suposto:** os dois `<img alt="">` que a varredura de acessibilidade desta
  sessão (BL-31/32) já tinha lido em `secoes.tsx` (linhas 245/322) são precisamente este branch —
  hoje sempre cai no `else` (sem imagem), para todo tenant, porque `imageUrl`/`photoUrl` nunca tem
  como nascer preenchido.
- **Por que não implementei a UI autonomamente:** diferente das consolidações e consertos desta
  sessão (mudança cirúrgica em código já existente, poucas linhas, comportamento óbvio), isto é
  construir uma tela nova — campo de upload + preview + estado de erro em DOIS formulários
  existentes. Mesmo de baixo risco (sem dinheiro, sem segurança, só aditivo, com
  `imagens.tsx`/`CampoDeImagem` como referência pronta pra adaptar), é decisão de escopo de
  produto ("vale a pena agora?"), não um bug a corrigir — mesmo critério que manteve o BL-01
  como `identificado` em vez de `feito` nesta mesma sessão.
- **Esforço estimado para quem pegar:** baixo-médio. `CampoDeImagem` de `imagens.tsx` já resolve
  90% do padrão (FormData, toast de erro, `window.location.reload()`); a adaptação para entidade
  precisa só trocar o endpoint (`/api/v1/tenant/vitrine/entidade` com `tipo`+`id` no FormData em
  vez de só `tipo`) e decidir ONDE cada formulário mostra o campo.
- **Status:** `identificado` (2026-09-20). Decisão de produto pendente com o Eduardo: vale
  priorizar a UI de foto de serviço/profissional agora (o próprio 0052 cita Fresha/Booksy como
  referência de mercado que já tem isso)?

---

### BL-34 · `MotivoPulado` duplicado entre `resumo-do-envio.ts` e `recuperar-receita.ts` — FEITO

- **Método:** `ts-prune` (varredura de exportações nunca importadas) apontou `MotivoPulado`
  (`core/ciclo/resumo-do-envio.ts`) como não usada por ninguém — mas ela EXISTE, só que
  `server/services/recuperar-receita.ts` tinha sua PRÓPRIA redeclaração local, `type MotivoPulado
  = 'opt_out' | 'rate_limited' | 'fora_de_janela' | 'falha_de_envio'`, byte a byte idêntica.
- **Por que não era só coincidência de nome:** os dois arquivos têm docstrings quase parafraseando
  um ao outro sobre a MESMA lição — "motivo errado é pior que motivo nenhum" — e os dois citam
  nominalmente `cartao-de-confirmacao-em-branco` como o defeito irmão que este tipo existe para
  evitar. É o mesmo conceito, descoberto/nomeado duas vezes, nunca ligado por import.
- **Conserto:** `recuperar-receita.ts` importa `MotivoPulado` de `core/ciclo/resumo-do-envio.ts`
  (direção correta pela regra 5 do CLAUDE.md — `server/` importando de `core/`) em vez de
  redeclarar. Docstring local mantida (explica um ângulo complementar: por que são QUATRO motivos,
  não dois) — só a declaração do tipo virou import.
- **Achado incidental do mesmo `ts-prune`:** `EntradaFechamentoComanda` (`comanda.ts`) é um type
  alias exportado e nunca importado — mas não é duplicação, é só um export desnecessário (baixo
  valor de mexer, sem risco de divergência associado). Deixado como está.
- **Verificação:** `tsc`/`eslint`/`pnpm test:unit` (292/2531) verdes.

---

### BL-35 · `atribuicao.ts`: cálculo de "quem não gera venda avulsa" duplicado em duas funções — FEITO

- **Método:** `jscpd` (detector de código copiado por CONTEÚDO, não por nome — diferente de todas
  as varreduras anteriores desta sessão, que comparavam identificadores) apontou um clone de 29
  linhas dentro do próprio `atribuicao.ts`: `receitaAtribuidaAoCiclo` e `receitaPorCampanha` cada
  uma buscava `client_subscriptions`/`packages` e construía os mesmos dois `Set` (assinante ativo
  do clube; combinação cliente+serviço com sessão de pacote sobrando) — com comentário numa delas
  dizendo literalmente "Mesmo motivo de `receitaAtribuidaAoCiclo`, acima" em vez de importar.
- **Por que importa (dinheiro, não só estilo):** as duas funções alimentam números que o dono vê
  na tela de campanhas — "o CICLO trouxe R$X este mês" e o total por campanha — e a regra "quem
  não gera venda avulsa" já teve um mecanismo NOVO chegar depois do primeiro (pacote com sessão
  sobrando, `docs/DECISOES.md` 2026-09-18, "achado seguinte" ao de assinatura). Se um QUARTO
  mecanismo chegar, hoje precisaria de duas edições sincronizadas manualmente; divergência aqui
  significa um cartão de campanha contando como receita nova uma visita que outro cartão já sabe
  que não é.
- **Conserto:** extraída `elegibilidadeDeVendaAvulsa(db, tenantId, hoje)` — as duas buscas mais a
  construção dos dois `Set`s. Chamada como um braço a mais do `Promise.all` de cada função
  (não um `await` isolado antes dele), para não transformar duas buscas que rodavam em paralelo
  com `messages`/`appointments` em uma cadeia serial — mesmo grau de paralelismo de antes.
- **Verificação:** `tsc`/`eslint`/`pnpm test:unit` (292/2531) verdes. Sem teste de integração
  específico rodado (`tests/integration/atribuicao.test.ts` precisa de Docker/Supabase local,
  indisponível nesta sessão) — mudança é extração mecânica, comportamento idêntico linha a linha,
  revisada manualmente contra o código original antes de commitar.

---

### BL-36 · Mais dois clones do `jscpd`: `janelaDoMes` (caixa.ts) e `cancelarAgendamento` reimplementando `transicaoSimples` — FEITO

- **`caixa.ts`:** `resumoMensal` e `taxaPorFormaDoMes` tinham a mesma sequência byte a byte —
  parsear `month` (`AAAA-MM`), validar, e computar `inicio`/`fim` em instante UTC no fuso do
  tenant. Extraída `janelaDoMes(timezone, month)`, privada ao arquivo (a duplicação não passava
  da fronteira deste módulo, então não virou `core/`).
- **`agendamentos.ts`:** achado mais valioso dos dois. `cancelarAgendamento` reimplementava, linha
  a linha, o MESMO update CAS (`.eq('status', atual.status)`) que `transicaoSimples` — a função
  logo abaixo dela no mesmo arquivo, que já existe justamente para isto e já recebe
  `camposExtra: Record<string, unknown>` para os campos específicos de cada transição
  (`confirmarAgendamento`/`marcarChegada` já a usam). `cancelarAgendamento` nunca tinha sido
  migrada para o padrão comum.
- **Por que a segunda importa mais que a primeira:** `transicaoSimples` tem o comentário extenso
  sobre POR QUE o CAS no próprio `UPDATE` existe — a corrida "concluir" num aparelho e "faltou" no
  outro simultaneamente. `cancelarAgendamento` já tinha essa proteção (o `.eq('status', ...)`
  estava lá, correto) — mas se algum dia alguém precisasse ENDURECER essa proteção (outro campo na
  cláusula, um retry, um log), corrigiria `transicaoSimples` e a cópia em `cancelarAgendamento`
  continuaria com o comportamento antigo, sem ninguém perceber. Agora `cancelarAgendamento` é
  `return transicaoSimples(db, tenantId, id, 'canceled', { canceled_at, canceled_by, cancel_reason })`.
- **Verificação:** `tsc`/`eslint`/`pnpm test:unit` (292/2531) verdes, revisão manual linha a linha
  confirmando comportamento idêntico antes de commitar (`buscarAgendamento`+`exigirTransicao`
  dentro de `transicaoSimples` são exatamente as mesmas chamadas que `cancelarAgendamento` fazia
  antes de inline).
- **Descartados na mesma varredura `jscpd`:** `clientes.ts`/`segmentos.ts` (paginação por cursor —
  boilerplate genérico do Supabase, não regra de negócio, baixo valor/risco de generalizar
  tipagem); `profissionais.ts`/`servicos.ts` (mesmo padrão de `profissionalDoTenant`/
  `servicoDoTenant` — "arquivar por entidade" com nome de tabela e mensagem diferentes por
  propósito; genericizar quebraria a inferência de tipo do supabase-js sobre nome de coluna, o
  mesmo trade-off que `vitrine-upload.ts` já documenta explicitamente).

---

## Missão de onboarding/ativação/retenção (pedido direto do Eduardo, 2026-09-20)

> Mudança de missão: da caça a bugs/refatoração para investigar e melhorar a jornada de
> onboarding → ativação → retenção → conversão. Achados registrados aqui seguem o mesmo formato
> BL-N; achados de pesquisa pura (sem código) ficam também espelhados em `growth-opportunities.md`
> quando se conectam a uma oportunidade já registrada lá.

### BL-37 · `/admin/clientes/ja-atendo` — alcançável só na janela estrita de "conta 100% virgem", não depois — FEITO, achado original corrigido

- **CORREÇÃO sobre a primeira versão desta entrada:** eu tinha escrito "zero links em lugar
  nenhum do painel", baseado em `grep -rn "ja-atendo" src/app` — que só varre `src/app`. A conta
  estava errada: `server/services/crm.ts` (`PRIMEIROS_PASSOS`, dentro de `centralDeAcoes`) **já
  linka `ja-atendo`** desde 2026-09-11, com a MESMA razão que eu tinha acabado de redescobrir
  sozinho ("planilha é a minoria... a ordem segue a proporção do público"). Achado real, mas menor
  e mais preciso do que a versão original dizia — registrando a correção em vez de deixar a
  reivindicação inflada no histórico (a mesma disciplina de "medir, não estimar" que este projeto
  já se cobra em outros achados).
- **O que É verdade, confirmado lendo `centralDeAcoes` até o fim:** o card "Traga quem você já
  atende" (→ `ja-atendo`) só aparece quando `clientes.count === 0 && agendamentos.count === 0` —
  a condição exata de "conta 100% virgem" (linha 666 de `crm.ts`). No instante em que QUALQUER
  cliente ou agendamento existe (inclusive um cliente de teste cadastrado por engano, ou o
  primeiro agendamento marcado antes de importar o resto da base), essa condição vira falsa PARA
  SEMPRE — `PRIMEIROS_PASSOS` nunca mais aparece na Central de Ações daquele tenant, mesmo que a
  pessoa ainda não tenha trazido o resto da clientela antiga. Fora dessa janela estreita, o link
  que eu adicionei em `clientes/lista.tsx` (estado vazio da LISTA de clientes, independente de
  haver agendamento) é hoje o único caminho de descoberta — genuinamente novo, não redundante com
  o que já existia.
- **Por que a versão corrigida ainda é um achado válido, só mais estreito:** `docs/46` continua
  valendo (2-3 meses de espera sem dado histórico) e o `growth-opportunities.md` GO-4 continua
  parcialmente aberto — a alavanca "aumentar a taxa de quem usa `ja-atendo`" tinha DUAS lacunas,
  não uma: a janela de "conta virgem" é frágil (qualquer ação antes de importar a fecha), e fora
  dela não havia caminho nenhum até este commit. O conserto em `clientes/lista.tsx` (mantido,
  verificado) resolve especificamente a segunda lacuna.
- **Verificação:** `tsc`/`eslint`/`pnpm test:unit` (292/2531) verdes (já reportado ao pushar).

---

### BL-38 · Cadastro: confirmação de e-mail era beco sem saída — sem reenvio, sem lembrar o e-mail — FEITO

- **Problema:** `POST /api/v1/auth/signup` usa `db.auth.signUp()` do Supabase, que por padrão
  exige clicar num link de confirmação por e-mail antes de a sessão existir — um GATE forte antes
  de a pessoa conseguir ver qualquer coisa do produto, logo depois de já ter dado nome, e-mail,
  telefone e senha. A tela de espera (`cadastro/formulario.tsx`) dizia só "Mandamos um link...
  Abra a mensagem e clique nele" e parava aí: sem reenviar, sem lembrar QUAL e-mail foi usado
  (se a pessoa digitou errado, não tinha como saber pra corrigir), sem mencionar spam. Quem não
  recebesse a mensagem (digitou errado, provedor filtrou, demorou) só tinha a opção de recarregar
  a página e recomeçar o cadastro inteiro.
- **Por que este achado ficou de fora do escopo "trocar":** desligar a confirmação de e-mail por
  completo é decisão de conta no painel do Supabase (Authentication → Email), fora do código —
  mesma categoria do login social já registrado (`ciclo-login-social-bloqueado-supabase`, memória
  do projeto). Não é algo que este agente decide ou implementa sozinho. O que ERA implementável
  sem essa decisão: melhorar a experiência de quem já está esperando o e-mail.
- **Conserto:**
  - `POST /api/v1/auth/signup/resend` (novo) — reenvia via `db.auth.resend({ type: 'signup',
    email })`, com a MESMA disciplina de dois baldes de `auth/password/forgot` (por IP via
    `limitarRotaPublica`, por e-mail com hash via `limitador`) — um script batendo aqui queimaria
    a cota de confirmação do PROJETO INTEIRO no Supabase, o mesmo risco já documentado naquela
    rota (auditoria de 31/08/2026). `EsquemaEsqueciSenha` reaproveitado (mesmo formato `{ email
    }`) em vez de duplicar o schema.
  - `cadastro/formulario.tsx` — guarda o e-mail usado em estado, mostra-o na tela de espera,
    acrescenta "Confira também a caixa de spam" e um botão "Reenviar e-mail" com seu próprio
    `carregando`, usando `useToast` para o resultado (mesmo padrão de feedback do resto do app).
  - **Achado pela própria guarda do projeto:** `tests/unit/design/escrita-passa-por-idempotencia.
    test.ts` reprovou a rota nova por não estar na lista de isentas de `Idempotency-Key` nem usar
    `comIdempotencia` — corretamente, é a mesma regra que já cobre `auth/signup`/`auth/password/
    forgot`. Adicionada à lista `ISENTAS` com o motivo exato: "sem tenant; reenviar de novo só
    manda o mesmo link, e o balde por e-mail é a trava" — mesma razão de `password/forgot`.
    Observei o teste reprovar ANTES do ajuste e passar DEPOIS, satisfazendo a disciplina de
    teste-guarda do CLAUDE.md organicamente (não precisei mutar de propósito).
- **Verificação:** `tsc`/`eslint`/`pnpm test:unit` (292/2531) verdes.

---

### BL-39 · `base_importada` (G-05b) implementado nas duas portas de entrada da base antiga — FEITO

- **Contexto (achado maior que o código em si):** investigando `executarOnboarding`, achei
  `registrarEvento(svc, tenant.id, 'conta_criada', ...)` — e isso revelou `product_events`
  (migration `0088`, `docs/60` G-05a), uma tabela de instrumentação de funil HOMEGROWN que
  `funnel.md` (pesquisa desta mesma sessão, fase anterior) não tinha creditado — aquele documento
  conferiu corretamente que não há SDK de analytics de TERCEIRO (PostHog/GA/etc.), mas não achou
  este mecanismo próprio. Confirmado por leitura: DOIS eventos já gravam em produção —
  `conta_criada` (fim do onboarding) e `motor_viu_valor` (primeira vez que `/admin/hoje` mostra
  atribuição do Motor — o AHA MOMENT desta missão). `docs/DECISOES.md` (2026-09-16, "Banco de
  produção em dia") confirma que a migration `0088` está aplicada em produção — a preocupação que
  o próprio `docs/60` registrava ("ainda não aplicada") já foi resolvida antes desta missão.
  Detalhe registrado em `growth-opportunities.md` GO-0.
- **Conserto/extensão:** dos quatro eventos G-05b represados (`base_importada`,
  `recuperacao_enviada`, `cliente_voltou`, `onboarding_ok`), implementado o que mais responde
  diretamente à hipótese do GO-4 ("quem usa `ja-atendo`/`importar` ativa o Motor mais rápido —
  precisa medir"): `base_importada`, nas DUAS portas de entrada da base antiga —
  `clients/ja-atendo/route.ts` (só quando `cadastrados > 0`, não dispara na manutenção semanal de
  "retornos" nem em envio vazio) e `clients/import/route.ts` (CSV, só quando `imported > 0`) —
  `meta: { via: 'ja_atendo' | 'csv', ... }` distingue qual porta foi usada, sem misturar os dois
  em um evento genérico.
- **`registrarPrimeiraOcorrencia`, não `registrarEvento`:** marco de UMA vez por tenant — o
  primeiro lote de verdade, não toda vez que a tela é usada depois.
- **`await`, não fire-and-forget:** ao contrário do `motor_viu_valor` em `/admin/hoje` (que usa
  `after()` do Next.js por estar no caminho crítico de renderização da tela mais aberta do
  produto), estas duas rotas não têm a mesma pressão de latência — e uma função serverless pode
  encerrar assim que a resposta sai, deixando uma promise solta sem terminar de escrever. Mesmo
  padrão de `conta_criada` (também `await`).
- **RLS conferida antes de implementar, não suposta:** `product_events_insert` (migration 0088)
  permite `insert` para quem `has_tenant(tenant_id)` — o client de SESSÃO do usuário (`db`, não
  `svc`/service_role) já grava sem problema, diferente de `conta_criada` que precisa de
  service_role por rodar ANTES de existir membership.
- **Efeito colateral seguro de idempotência:** as duas rotas retentam via `Idempotency-Key`
  (`ja-atendo` com `comIdempotencia`, `import` na lista `ISENTAS` por ser multipart) — numa
  repetição, o código depois do envelope roda de novo e chama `registrarPrimeiraOcorrencia` de
  novo, mas a própria função já é seguro-para-repetir (confere ocorrência prévia antes de
  inserir), então não duplica o evento.
- **Verificação:** `tsc`/`eslint`/`pnpm test:unit` (292/2531) verdes. Sem verificação ao vivo em
  produção (não é este agente que decide isso) — o efeito só é observável quando alguém consultar
  `product_events` depois do deploy.
