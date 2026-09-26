# Loop de melhoria do CICLO

Você é o mantenedor do CICLO (repositório `C:\Users\Usuario\.claude\code\ciclo`). Faça UMA rodada de melhoria por iteração e emende a próxima sem esperar.

## Antes de começar (só na 1ª rodada)
- Leia CLAUDE.md, docs/00-BRIEFING.md e o fim de docs/82-MOTOR-DE-DISTRIBUICAO.md (§16, linhas das rodadas).
- Crie a branch local `melhoria/loop-<data>` a partir da main atualizada. Nas rodadas seguintes, continue nela.

## Cada rodada
1. **Escolha o alvo (um só).** Prioridade: (a) defeito que o cliente do salão VÊ ou que custa dinheiro dele; (b) fluxo que perde conversão (cadastro, calculadora, /links, ativação, primeira cliente recuperada); (c) tela lenta ou que quebra a 375 px; (d) guarda de teste cega; (e) copy que promete o que o produto não faz. Não repita alvo já tratado nas rodadas do docs/82.
2. **Meça antes de consertar.** Reproduza no navegador (dev server, porta 3015, login de demo por cookie) ou no banco local. Leitura de código não prova toque, overflow nem lentidão. Se a hipótese cair na medição, registre "descartada" e passe ao próximo alvo.
3. **Conserte o mínimo.** Regra de negócio em src/core, dinheiro em centavos, RLS sempre, nada de `any`, copy PT-BR sem travessão e sem supor gênero.
4. **Prove.** Teste novo para o caminho feliz e um de erro. Toda guarda que varre código: commite antes de mutar, reintroduza o defeito, confirme que a mutação foi aplicada (CRLF!) e veja a guarda reprovar. Depois `pnpm test:unit`; a cada 3 rodadas, `pnpm verify`.
5. **Registre.** Uma linha na tabela de rodadas do docs/82 (o que mediu, o que mudou, o que NÃO está no ar). Um commit por rodada, em português: `fix(area): o que (rodada N)`.
6. **Emende** a próxima rodada sem parar.

## Limites duros
- Só commits locais. NÃO faça push, PR, merge nem deploy: o Eduardo autoriza isso por pedido.
- NÃO toque em produção, Supabase remoto, Vercel, Meta/WhatsApp, chaves ou segredos. Banco só o local (127.0.0.1:54321).
- Nunca deletar agendamento, estoque ou auditoria. Migration nova: só aditiva, com RLS + teste de isolamento.
- Não invente número, depoimento nem promessa de canal. Dado de demonstração é fictício e pode ser inflado; dado de produção, nunca.
- Não use agente em background.

## Pare quando
`pnpm verify` falhar por algo que você não consegue consertar; faltar decisão que só o Eduardo pode tomar (preço, jurídico, conta de terceiro); ou 3 rodadas seguidas não acharem defeito medido. Ao parar, liste o que ficou pendente e o que precisa dele.

## Estado do loop
(atualize ao fim de cada rodada: rodada atual, último alvo, pendências)
- Rodada 1 (feita): overflow 320 px descartado; acento da vitrine [slug] consertado (docs/82 linha 36).
- Rodada 2 (feita): calculadora mostrava exemplo como se fosse número da pessoa; rótulo corrigido (linha 37).
- Próximo: /cadastro e /links a 375 px em claro; depois telas de dentro do fluxo de agendamento com cor escolhida; depois auditar copy de erros públicos.