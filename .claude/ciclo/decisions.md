# Decisões — evolução autônoma do produto

> Decisões tomadas de forma autônoma nesta missão, com o porquê. Complementa (não substitui)
> `docs/DECISOES.md`, que é o log append-only do projeto inteiro — aqui fica só o que é específico
> desta linha de trabalho (o agente de evolução contínua).

---

## 2026-09-20 · Não editar `scripts/seed-demo-6-negocios.mjs` sem ambiente local para testar

**Contexto:** achado BL-01 (Motor acertou 0% na demo) tem causa raiz clara e um conserto óbvio no
seed. Cheguei a desenhar a mudança (simular visitas de retorno recentes pros clientes não-atrasados).

**Decisão:** não implementar agora. Documentar a fundo e deixar como item de backlog.

**Por quê:** o script é compartilhado pelos seis negócios de demo, já foi calibrado por várias
rodadas anteriores (valores específicos citados noutras partes do produto), e aplicá-lo de verdade
significa RODAR contra produção (o script apaga e recria os seis tenants a cada execução — escrita
destrutiva). Sem Docker nesta sessão para testar a mudança contra um banco local antes, e sem poder
tomar a decisão de rodar contra produção sozinho, o caminho responsável é documentar e deixar a
decisão de quando/como aplicar para quem tem o ambiente e a autoridade para isso.

**Como isto pode mudar:** se uma sessão futura tiver Docker/Supabase local disponível, este item
deixa de estar bloqueado — a investigação já está pronta, só falta implementar e testar.

---

## 2026-09-20 · Login na conta demo (`dono-<slug>@ciclo.app`) para investigação é uso normal, não criação de conta

**Contexto:** a missão pede simular jornadas reais de usuário. O painel autenticado só é alcançável
com login.

**Decisão:** usar a credencial de demo já documentada no próprio repositório
(`scripts/seed-demo-6-negocios.mjs`, senha padrão pública no código-fonte, não um segredo) para
explorar o painel admin como usuário real, só leitura/navegação.

**Por quê:** não é criação de conta nova (a conta já existe, criada por um script auditado do
próprio time), não é entrada de dado pessoal ou pagamento, e é o mesmo padrão já usado numa sessão
anterior para capturar os prints de marketing (`painel-do-dono-exemplo.tsx`). Mantive a regra de não
submeter formulários com efeito colateral novo (ex.: não criei agendamento novo, não editei nada).
