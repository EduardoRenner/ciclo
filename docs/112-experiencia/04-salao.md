# 112 · 04 · O produto inteiro com cara de salão (Parte C1)

Frente C1 do `docs/111`. Data: 21/10/2026. Branch `marca/feminina-2026-10-20`.

**Ambiente usado:** código da worktree `ciclo-marca` e o banco **local** isolado `supabase_db_ciclo-marca` (Postgres em `127.0.0.1:57822`), só leitura. **Não é produção.** Nada foi alterado, nada foi commitado.

**Rótulos:** **FATO** (lido no código ou no banco local, com caminho:linha), **INFERÊNCIA** (conta junto), **HIPÓTESE** (a medir), **NÃO VERIFICADO** (precisa ser visto no navegador).

**Limite desta frente:** li o código e consultei o banco local. **Não abri as rotas no navegador.** Tudo que a pessoa VÊ está marcado como "falta ver na tela" no fim (§9). O inventário C1.1 foi confirmado linha a linha; achei mais 31 itens.

---

## 0. Resumo em uma tela

- **Quem chega pela home e toca em "Ver funcionando" cai numa barbearia** (FATO). A ordem da vitrine ainda diz "barbearia primeiro".
- **Os salões de demonstração não parecem salão.** A lash designer faz escova e corte, a cabeleireira faz extensão de cílios, e metade das clientes tem nome de homem (FATO, banco local).
- **O cadastro manda digitar "lash", e "lash" não acha nada.** A tela oferece "Seguir como Outra profissão", e essa profissão nasce **sem nenhum serviço** (FATO no banco, INFERÊNCIA no fluxo; falta ver na tela).
- **A lash que faz sobrancelha (9 de 13 no campo) só pode escolher uma profissão.** Ela recebe só o pacote de cílios.
- **Para uma cabeleireira que traz a clientela, o serviço padrão sai "Corte masculino · R$ 45 · 30 dias"** (INFERÊNCIA pela regra do código). Para a esteticista, "Peeling químico".
- **"Remoção" e "Penteado" ganham ritmo de 21 dias.** O Motor vai chamar de volta quem só tirou o cílio (FATO no banco).
- **Uma frase do assistente supõe que quem é atendido é mulher** ("Quais clientes estão sumidas"), num arquivo que a guarda afirma estar limpo (FATO). A guarda está cega para verbo no meio.
- **Mensagens que a cliente manda erram o artigo:** "pelo site da Studio Bella", "recomendo a Espaço Vitória" (FATO no código).

---

## 1. Contagem por área

| Área | Itens | Dos quais estavam no C1.1 |
| --- | --- | --- |
| A. Primeiro contato (home, demonstração, calculadora, links, termos) | 10 | 6 |
| B. Cadastro e primeiros passos | 8 | 2 |
| C. Catálogo pronto e Motor | 11 | 2 |
| D. Contas de demonstração (seeds) | 11 | 5 |
| E. Painel (telas internas) | 10 | 6 |
| F. Mensagens que chegam à cliente | 4 | 1 |
| G. Assistente | 3 | 2 |
| H. Orientação (CLAUDE.md, marketing, guarda) | 3 | 3 |
| **Total** | **60** | **27 confirmados + 1 linha corrigida; 33 novos** |

Todos os 10 itens do C1.1 **ainda estão lá**. Um tinha linha ligeiramente diferente (`demonstracao.ts`: o comentário "barbearia primeiro" está na :103 e a lista na :109-125).

---

## 2. Inventário completo

### A. Primeiro contato

| # | FATO (caminho:linha, texto atual) | Proposta (sem supor gênero) |
| --- | --- | --- |
| A1 | `src/core/tenants/demonstracao.ts:103` "barbearia primeiro, porque é onde o esforço de venda está (`docs/18` §B.2)"; `:109-125` `SLUGS_DE_VITRINE` começa por `demo-dom-estilo`, `demo-corte-fino`, `demo-navalha-de-ouro`. A premissa caiu: o `docs/108-norte` tirou a barbearia do alvo. | Vitrine nova (§5). Comentário passa a citar `docs/108`. |
| A2 | `src/app/(public)/[slug]/agendar/painel-do-dono-exemplo.tsx:46-54` `SLUGS_COM_PRINT` começa por `demo-navalha-de-ouro`; `SLUG_PADRAO = "demo-dom-estilo"` (:54). | `SLUG_PADRAO` = conta de salão; lista na ordem da vitrine. |
| A3 | `public/exemplo/`: 24 capturas, **12 de barbearia** (`demo-dom-estilo-*`, `demo-corte-fino-*`, `demo-navalha-de-ouro-*`). | Refazer as capturas das contas novas (§5.5). |
| A4 | `painel-do-dono-exemplo.tsx:33` legenda "com quanto cada um costuma deixar". | "com quanto cada pessoa costuma deixar". |
| A5 | Calculadora: `calculadora.tsx:22` "uma barbearia de cidade pequena"; `:30-32` padrão 8 · R$ 35 · 30 dias; `:47` "Pense em pelo menos um cliente que sumiu."; `:53` "quanto um cliente gasta por visita"; `:85` "O ticket médio. Exemplo: R$ 35,00."; `calculadora/page.tsx:26` "para salão e barbearia"; `src/core/aquisicao/calculadora.ts:46` "de cílios/barba (15)". | §6. |
| A6 | `src/core/aquisicao/links-da-bio.ts:38` "Seu sistema de retenção de clientes"; `:40` "pra quem tem agenda"; `links/page.tsx:27` título "Retenção de clientes para quem tem agenda"; `:55` h1 "Seu sistema de retenção de clientes". "Retenção" é jargão e "quem tem agenda" é qualquer profissão. | h1: "Quem passou do dia da manutenção, pelo nome". Título: "Agenda para quem faz unha, cílios, sobrancelha e cabelo". |
| A7 | `links-da-bio.ts:90` "Abre um negócio de exemplo, do lado de quem atende." | "Abre um salão de exemplo, com a agenda cheia, do lado de quem atende." |
| A8 | `src/app/(public)/termos/page.tsx:101-102` "barbearia, unhas, cílios, estética e profissões parecidas". | "unhas, cílios, sobrancelha, cabelo, depilação, estética e profissões parecidas". **Termos é texto jurídico: Do Vitor.** |
| A9 | `src/app/llms.txt/route.ts:40` "Sistema de gestão para quem atende com hora marcada"; `:49-51` já abre pela beleza feminina, cita barbearia, tatuagem, faxina e personal depois. | Só a :40: "Agenda e retorno de clientes para salão e beleza". Resto já está certo (F3 do `docs/109`). |
| A10 | `src/app/page.tsx:185` grupo "Também atende: Faxina e diarista, Barbearia, Tatuagem". Decidido em 20/10 (`docs/109`, comentário :178-181). | Manter. Registro só para a revisão adversarial: é a única menção a barbearia na home. |

### B. Cadastro e primeiros passos

| # | FATO | Proposta |
| --- | --- | --- |
| B1 | Ordem das profissões (`supabase/migrations/0022_professions_catalog.sql:78-101`, lida no banco local): 1 Cílios, 2 Unhas, **3 Barbearia**, 4 Sobrancelhas, 5 Depilação, 6 Estética facial e corporal, 7 Tatuagem, **8 Cabelo**. Lida em `src/app/onboarding/page.tsx:35-42` (`.order('posicao')`). | Nova ordem em §7.1. |
| B2 | A lista do cadastro mostra **as 17 de pacote aberto mais "Outra profissão"**: depois das 8 de beleza vêm Faxina e diarista (9), Eletricista (10), Encanador (11), Personal trainer (12), Psicólogo (13), Professor particular (14), Fotógrafo (15), Banho e tosa (16), Jardineiro (17), Outra profissão (99). Banco local, `professions` com `ativa = true` e `pacote = 'base'`. | Beleza no topo; as outras num grupo "Outras áreas" fechado, que abre com um toque e aparece na busca (§7.1). |
| B3 | `src/app/onboarding/formulario.tsx:125` placeholder **"Ex.: manicure, lash, sobrancelha…"**. A busca (:59-63) compara o termo com `nome` e `sinonimos`. No banco: `lashes` tem `sinonimos = {}`. **"lash" não acha nada.** A tela diz "Não achamos 'lash' na lista" e oferece "Seguir como Outra profissão" (:139-147). `outra` não é vertical legada, então o cadastro chama `apply_profession_pack` (`src/server/services/onboarding.ts:220-223`), e `profession_services` tem **0 linhas** para `outra` (banco local). | Sinônimos de salão (§7.2). A lash cai em Cílios. **INFERÊNCIA** sobre o fluxo inteiro: falta digitar "lash" na tela e ver a conta nascer vazia. |
| B4 | Uma profissão só por conta. O relatório de concorrentes (`docs/concorrentes/beleza-feminina/05-relatorio.md` §3, branch `aprimoramento/plano-2026-10-13-docs`) diz que a lash "quase sempre" faz cílios, sobrancelha, lash lifting e brow lamination (9 de 13 no campo). Quem escolhe Cílios recebe só o pacote `lashes` (6 serviços, nenhum de sobrancelha). Dona de salão de cabelo e unhas também recebe um pacote só. | EXP-S07: deixar marcar mais de um ofício, ou criar o pacote "Cílios e sobrancelha". |
| B5 | Nome "Estética facial e corporal" (`0022:93`) é longo na lista; `vocab.local = 'clínica'` para estética. | "Estética". O `local` pode continuar. Prioridade baixa. |
| B6 | `src/core/onboarding/perfil.ts:26` `SISTEMAS_ANTERIORES = ['appbarber','trinks','belasis','barbup','booksy','outro']`; rótulos em `onboarding/perfil/formulario.tsx:29-35`. Dois de barbearia na frente, nenhum de beleza feminina. | §7.3. |
| B7 | `onboarding/perfil/formulario.tsx:130,137` "Onde estão seus clientes hoje?" (masculino genérico, segunda tela de quem acabou de criar a conta). | "Onde está sua clientela hoje?" |
| B8 | `src/app/admin/config/servicos/formulario.tsx:202-207` "Como cobra": "Preço fechado, Por hora, **Taxa de visita + hora, Diária**, Sob orçamento", para qualquer profissão (fica em "Mais opções"). | Mostrar só os modelos que o eixo `cobranca` da profissão usa. Depois do piloto. |

### C. Catálogo pronto e Motor

Detalhe e comparação com o mercado em §4.

| # | FATO | Efeito |
| --- | --- | --- |
| C1 | Cílios (`0002_vertical_packs.sql:35-42`): só existe **"Manutenção volume russo"**. Clássica e híbrida não têm manutenção. Não há volume brasileiro nem egípcio. | A lash de fio a fio marca manutenção como "volume russo" ou cria à mão. |
| C2 | Unhas (`0002`, bloco `nails`): sem **"Pé e mão"** (o par mais vendido), sem **alongamento em gel** (só "em fibra"), sem blindagem. Manicure com ritmo 15; manutenção de alongamento com ritmo 25. | §4. |
| C3 | Sobrancelha: brow lamination a R$ 140, acima da faixa encontrada (R$ 80 a 110, fonte fraca). | Ajuste de preço sugerido. |
| C4 | Cabelo (`0057_packs_hair_tattoo_general.sql:37-46`): **"Corte masculino" R$ 45** é o 2º item; "Penteado" com `cycle_days: 0`; escova com ritmo 15. | Corte masculino fica, mas vai para o fim da lista. |
| C5 | Depilação: sem **meia perna**; perna inteira a R$ 70, abaixo da faixa (R$ 80 a 180). | §4. |
| C6 | **Serviço sem retorno ganha ritmo 21.** `0097_servico_canonico.sql:56`: `cycle_days < 1` vira 21. Atinge Remoção (cílios e unhas), Penteado, Avaliação inicial. No banco local: `demo-esmalteria-rosa · Remoção · R$ 30 · ritmo 21`, `demo-studio-olhar · Remoção · R$ 60 · ritmo 21`. | O Motor chama de volta, em 21 dias, quem só removeu o alongamento. Infla "Dá para recuperar". O próprio comentário da 0063 registra o conserto certo (ritmo nulo) como "alvo". |
| C7 | **Ordem dos serviços:** o pacote cria tudo com `position = 0`. O painel ordena por nome (`src/server/services/servicos.ts:137`). A página pública ordena só por `position` (`src/server/services/public-booking.ts:164`), então a ordem é a física do banco. | A página da lash abre por "Aplicação volume russo · R$ 220" e mostra "Remoção" para a cliente marcar. Falta ver na tela. |
| C8 | `src/core/cycle/servico-padrao-da-base.ts:35-40` `SERVICO_DE_VOLTA` tem barbearia, cílios, sobrancelha e unhas. **Faltam cabelo, depilação e estética.** | §8. |
| C9 | Sem entrada, cai na mediana do ritmo com desempate por nome. **INFERÊNCIA pela conta:** cabelo, com ritmos [15, 21, 30, 30, 45, 60, 90, 120], tem mediana 30, e "Corte masculino" vem antes de "Hidratação" no alfabeto. **A cabeleireira que traz a clientela recebe "Corte masculino · R$ 45 · 30 dias".** Estética, com [7, 7, 21, 30, 30], tem mediana 21: sai **"Peeling químico · R$ 180"**. Depilação sai "Virilha completa · R$ 60 · 28 dias", que é aceitável. | O preço e o nome errados vão para "Dá para recuperar" e para a mensagem de "Chamar". |
| C10 | `profession_services` tem **0 serviços** para as 8 profissões de beleza (só `barber` tem 6, de `0026_catalogo_profundo.sql:20-29`, que chama a barbearia de "profunda"). Hoje não faz mal, porque beleza usa `vertical_packs` (`onboarding.ts:21-24`). | Risco: se um dia o cadastro passar a usar só `apply_profession_pack`, toda conta de beleza nasce vazia. Registrar em `docs/DECISOES.md`. |
| C11 | `professions.ciclo_padrao_dias` (0022): unhas 15, cílios 21, sobrancelha 28, depilação 21, estética 30, cabelo 30. Sobrancelha 28 diverge do pacote (21 a 25). | Alinhar com §4 quando o catálogo for revisado. |

### D. Contas de demonstração

| # | FATO | Efeito |
| --- | --- | --- |
| D1 | `scripts/seed-demo-6-negocios.mjs:75-107`: três barbearias (Navalha de Ouro, Corte Fino, Dom Estilo), donos Ricardo, Marcos, Anderson; equipe Diego e Felipe, "Barbeiro". | São 3 das 6 vitrines. |
| D2 | `:114-166`: Studio Bella e Espaço Vitória como `nails`; Salão Encanto como `aesthetics`; os três com equipe de cabelo e cílios e serviços "extras" **sem `cycle_days`**. Banco local: **Corte feminino e Escova com ritmo 21** (a coluna põe 21). | Corte feminino volta a cada 60 dias no mercado; a demonstração acusa atraso falso. |
| D3 | `:169-176` `NOMES_CLIENTES`: 28 nomes, **13 de homem** (Douglas, Fábio, Heitor, João Vitor, Luiz Otávio, Nelson, Paulo, Rafael, Thiago, Vinícius, Yuri, Bruno…). | Salão de unhas com metade de clientela masculina não existe. |
| D4 | `:253` cor do dono `#14b8a6` (turquesa antigo). | Marca nova é rosé e ameixa (`docs/109` §4). |
| D5 | **Qualquer profissional faz qualquer serviço.** `:411-417` reserva pelo índice, sem olhar o ofício. Banco local, Studio Bella: **Priscila Amaral (Cílios) fez Escova 5 vezes e Corte feminino 3**; **Renata Lopes (Cabelo) fez Extensão de cílios 5 vezes**. | Uma dona de salão nota na hora. |
| D6 | `:349` cada cliente faz **um serviço só** a vida toda; `:332` ritmo 21, 28 ou 35 para todos, seja escova, seja mechas. | A ficha não mostra o padrão real (manutenção + design no mesmo dia). |
| D7 | Tamanho: 14 a 28 clientes por negócio (banco local: 14, 18, 22, 24, 26, 28). O relatório §3 diz que agenda cheia é 50 a 70 clientes ativas em cílios, 80 a 150 em sobrancelha, 30 a 60 por manicure. | "Agenda cheia e realista" (C1 item 4) não fecha com 24 clientes para 3 profissionais. |
| D8 | `scripts/seed-tenant-teste.mjs:146,152`: Esmalteria Rosa e Studio Olhar têm a mesma dona "Marina Alves" e o mesmo segundo profissional **"Rafael Costa"**; `:207-211` 12 clientes, 5 de homem; `:326` plano "Plano Teste" (aparece na tela de planos). | São contas de teste, fora da vitrine. Servem de base, não de vitrine. |
| D9 | `scripts/seed-demo-dinheiro.mjs:140-143` revenda só de "Pomada modeladora"; `scripts/seed-demo-agenda-futura.mjs:114` pesos só para serviços de barbearia, o resto pesa 8 igual. | Na agenda futura do salão, "Remoção" sai tão frequente quanto "Manutenção". |
| D10 | `seed-demo-barbearia.mjs`, `seed-demo-crm-profundo.mjs`, `seed-demo-dom-rocha-carteira.mjs` giram em torno de `dom-rocha` (barbearia), que é o **último recurso** da vitrine (`demonstracao.ts:116-124`). Em dev, sem as `demo-*`, a home mostra a barbearia. | Trocar o último recurso por uma conta de salão. |
| D11 | Cabeçalho do seed (`:9-13`) diz que `essencial` só permite um profissional. Hoje permite 2 (`src/core/billing/planos.ts:155`). | Comentário velho. Corrigir junto. |

### E. Painel

| # | FATO | Proposta |
| --- | --- | --- |
| E1 | `src/app/admin/config/mensagens/editor.tsx:18-22` prévia com "Bruno Almeida", "Corte + barba", "R$ 70,00". | "Fernanda Lima", "Manutenção de cílios", "R$ 120,00". Nome de mulher no exemplo **não** fere a guarda (é nome próprio, não artigo). |
| E2 | `admin/config/planos/editor.tsx:112` "Corte ilimitado"; `planos/fidelidade-config.tsx:116` "Corte grátis"; `admin/clientes/[id]/fidelidade.tsx:296` "Corte de hoje, resgate de brinde...". | "2 manutenções por mês"; "Design de sobrancelha grátis"; "Manutenção de hoje, resgate de brinde...". |
| E3 | `admin/clientes/ja-atendo/formulario.tsx:317` "Marcos - 49 99999-0001 / Rafael / Dona Alzira" (2 de 3 homens, no passo de trazer a clientela). | "Fernanda - 49 99999-0001 / Bia da academia / Dona Alzira". |
| E4 | `src/lib/preferencias.ts:11-16` campos de barbearia (máquina, navalha, cerveja); `admin/clientes/nova/page.tsx:21` e `admin/clientes/[id]/page.tsx:89` caem em `'barber'` quando a vertical é nula. | Fallback para o padrão neutro (`PADRAO`, :54), não para barbearia. Baixa: toda conta tem vertical. |
| E5 | Ícone de tesoura (`Scissors`) em `components/shell/topbar.tsx:27`, `admin/config/page.tsx:35`, `config/servicos/lista.tsx:127`, `hoje/central-de-acoes.tsx:36-37`, `clientes/[id]/ficha.tsx:548,662`. | Baixa. Tesoura lê "cabelo". Trocar por um ícone de lista de preços ou de brilho só se a Fase de marca quiser. |
| E6 | "Cadeira": `src/core/comanda/completude-do-lucro.ts:75` "quantas cadeiras tem. **Quem atende em casa responde zero.**" Mas o campo recusa zero: `src/server/services/custo-fixo.ts:21` `min(1, 'Pelo menos uma.')` e `config/custo-fixo/editor.tsx:135` `min={1}`. Também `sobra-explicada.ts:105` e `src/core/inteligencia/falar.ts:146` "a hora de cadeira". | Lash, depilação e estética usam **maca**. Trocar por "posto de atendimento" (o editor já diz "Postos de atendimento", :131). O "responde zero" deve virar "Quem atende em casa responde zero no aluguel" (**INFERÊNCIA** sobre o que a frase quis dizer). |
| E7 | **"Peça ao dono se precisar."** em `admin/caixa/page.tsx:64`, `comissao/page.tsx:40`, `estoque/page.tsx:42`, `experimentos/page.tsx:36`, `mes/page.tsx:56`; `comissao/page.tsx:83` "Peça ao dono para te vincular"; `config/profissionais/lista.tsx:353` "é o dono do…"; `agenda/novo/page.tsx:27` "Quem marca é o dono, a gerência, a recepção ou o profissional." | Quem lê é a profissional da equipe, num salão que quase sempre tem dona. "Peça a quem cuida do salão." O convite já resolve assim: `convite/[token]/page.tsx:14` "dona ou dono". |
| E8 | `src/core/crm/nota-do-cliente.ts:71-76` perfis "Novo", "Atrasado", "Sumido". | "Primeira vez", "Passou do dia", "Sumiu". "Fiel", "Regular" e "Costuma faltar" já são neutros. |
| E9 | `src/core/billing/convite-do-ciclo.ts:61` "nós dois ganhamos um mês"; `:64,75` "um colega", "colega de ofício". | "a gente ganha um mês"; "alguém do ramo". |
| E10 | Masculino genérico "o/um/do cliente", "seus clientes": **80 linhas** com texto visível em `src/app`, `src/components`, `src/core`, `src/server` (grep, inclui telas de advocacia). Exemplos: calculadora :47, :53; `nova/formulario.tsx:156` "Só marque se o cliente disse que pode."; `:167` "Digite o nome do cliente primeiro."; `config/planos/page.tsx:66` "Como o cliente ganha pontos". | Troca por construção neutra ("quem", "a pessoa", "a clientela", `vocabulario.cliente`). Em lote, tela por tela, só nas telas de beleza. |

### F. Mensagens que chegam à cliente

| # | FATO | Proposta |
| --- | --- | --- |
| F1 | `src/server/services/mensagens-prontas.ts:45` "Essa semana **o** {{servico}} está saindo por {{valor}}." Sai "o Manutenção", "o Escova", "o Esmaltação em gel". | "Essa semana, {{servico}} está saindo por {{valor}}." Atenção: o modelo é semeado na primeira leitura e vira linha do tenant (comentário :20-27), então o conserto só vale para conta nova. Conta que já abriu a tela fica com o texto antigo. |
| F2 | **Artigo feminino colado ao nome do negócio.** `[slug]/agendar/agendar.tsx:621` "Acabei de marcar um horário pelo site **da** ${nomeDoSalao}"; `[slug]/orcamento/pedido.tsx:32` idem; `[slug]/secoes.tsx:53` "Vim pelo site **da** ${perfil.name}"; `avaliar/[token]/avaliar.tsx:128` "Super recomendo **a** ${negocioNome}". Nome de salão costuma ser masculino: Studio, Espaço, Salão, Ateliê. | "pelo site de ${nome}" ou "pelo seu site". O `convite-do-ciclo.ts:55-57` já resolveu o mesmo defeito ("do meu negócio, X"). |
| F3 | `src/lib/mensagens.ts:136` "Faz um tempinho desde seu último horário de ${servico}". Com o catálogo atual sai "seu último horário de manutenção volume russo"; `src/server/services/recuperar-receita.ts:290` igual. | Prioridade baixa e da frente de avisos (C2): o texto natural do salão é "já está na hora da sua manutenção". |
| F4 | Modelo "Sumiu, chamar de volta" (`mensagens-prontas.ts:41`) não fala de manutenção. | Mesma observação de F3. |

### G. Assistente

| # | FATO | Proposta |
| --- | --- | --- |
| G1 | `src/server/services/assistente.ts:32` "um painel de gestão para quem atende com hora marcada"; `:47` "Quem usa o CICLO vai de manicure e barbeiro a eletricista, personal, psicólogo e faxineira". Nas regras de estilo (`:39-43`) quem usa o painel é "ele" ("Se ele precisar, ele pergunta"). | "para salão e profissionais da beleza, e quem mais atende com hora marcada". Trocar "ele" por "a pessoa". |
| G2 | `src/core/inteligencia/planejar.ts:212` "e se eu subir **o corte** para R$ 55?". O resto do arquivo já usa salão ("marca a Joana amanhã às 15h pra escova", :256). | "e se eu subir a manutenção para R$ 130?" |
| G3 | **`src/components/shell/assistente-flutuante.tsx:49` pergunta pronta "Quais clientes estão **sumidas** há mais de 60 dias?"**. Supõe que quem é atendido é mulher. O arquivo está em `JA_CONSERTADOS` (`tests/unit/design/copy-nao-supoe-genero.test.ts:531`), e o padrão da guarda (`:404`) exige `sumidas` colado em "clientes". Com "estão" no meio, a guarda não vê. | "Quem sumiu há mais de 60 dias?" (o rótulo da :49 já diz isso). Estender o padrão para aceitar até dois verbos no meio e **ver reprovar** com esta frase. |

### H. Orientação

| # | FATO | Classe |
| --- | --- | --- |
| H1 | `CLAUDE.md` (topo): "qualquer profissional que tem agenda… não só beleza (barbearia, unhas, estética), mas também faxineira, eletricista, personal trainer". Orienta toda sessão futura. | **Do Vitor.** |
| H2 | `docs/marketing/roteiro-lancamento-instagram.md:28` "barbeiro, manicure, personal, faxineira". | Recomendado (doc de divulgação). |
| H3 | A guarda `copy-nao-supoe-genero` (`:395` em diante) proíbe "a cliente". Recomendo **manter** (`docs/109` §5). | Mudar a guarda é **Do Vitor**. |

---

## 3. O que a varredura NÃO achou (para não procurar de novo)

- Telas de entrada (`src/app/(auth)/*`): nenhum exemplo de barbearia nem de profissão. Só o placeholder de telefone.
- Automações (`src/core/automacoes`): nomes e descrições neutros.
- Home (`src/app/page.tsx`), prévia do link (`opengraph-image.tsx:44`) e `/precos`: já falam de unha, cílios, sobrancelha e cabelo (F3 do `docs/109`).
- Página de agendamento: "Qualquer um" já virou neutro (`agendar.tsx:906`).
- Dados estruturados (`src/core/seo/dados-estruturados.ts:49-55`): `NailSalon`, `BeautySalon`, `HairSalon` certos.
- Importador (`src/core/ingestao/`): sinônimos de barbeiro existem, mas ninguém os vê. Fora do escopo.

---

## 4. Catálogo pronto contra o mercado de 2026

**Fontes de mercado.** Não existe tabela nacional. As melhores são:
- a pesquisa do **Mercado Mineiro com 45 salões de BH, publicada pelo Diário do Comércio** (out/2025 e jun/2026): https://diariodocomercio.com.br/?p=592317 e https://diariodocomercio.com.br/?p=530609;
- as matérias "quanto custa" da **Catraca Livre** de 2026 (média, sem metodologia publicada).

O resto é fraco (anúncio no Booksy e no Fresha, média do GetNinjas, guia do FreelaSemCrise, blog de farmácia). Duração do atendimento quase nunca aparece na fonte: quando não aparece, marquei **INF.**

| Profissão · serviço | CICLO hoje (preço · min · ritmo) | Mercado 2026 | Fonte | Leitura |
| --- | --- | --- | --- | --- |
| **Cílios** · Aplicação clássica (fio a fio) | R$ 150 · 90 · 21 | R$ 150 a 400 nas capitais; anúncios de bairro mais baixos | [Catraca, fev/2026](https://catracalivre.com.br/noticias/quanto-custa-o-alongamento-de-cilios-valores-de-fio-a-fio-e-volume-russo/) | Ok (ponta de baixo). Duração ok (1h a 2h, [Tua Saúde](https://www.tuasaude.com/extensao-de-cilios/)). |
| Cílios · Volume russo | R$ 220 · 150 · 21 | R$ 150 (anúncio) a 400 | Catraca; Booksy Guarulhos (fraca) | Ok. |
| Cílios · **Manutenção** | R$ 120 · 90 · 21 (só "volume russo") | 50 a 70% da aplicação; retorno 15 a 30 dias | Catraca; [Tua Saúde](https://www.tuasaude.com/extensao-de-cilios/); relatório §3: 15 a 21 | Preço e ritmo ok. **Falta manutenção para clássica e híbrida.** |
| Cílios · Lash lifting | R$ 150 · 60 · 45 | R$ 80 a 160 · retorno 45 a 60 | Booksy e Fresha SP (resumo de busca, fraca); [Vitat](https://vitat.com.br/lash-lifting/) | Ok, ponta de cima. |
| Cílios · Remoção | R$ 60 · 30 · **21 (vira 21 por padrão)** | sem retorno | — | **Defeito C6.** |
| **Sobrancelha** · Design simples | R$ 45 · 30 · 21 | INF. R$ 30 a 60 | Sebrae SP ~2020 (antigo) | Ok. |
| Sobrancelha · Design com henna | R$ 70 · 50 · 25 | R$ 50 a 120 · 35 a 50 min | [FreelaSemCrise](https://freelasemcrise.com.br/quanto-cobrar/design-sobrancelhas); relatório §3 | Ok. Ritmo pode ser 21. |
| Sobrancelha · Brow lamination | R$ 140 · 60 · 45 | R$ 80 a 110 (fraca) | anúncios Booksy Guarulhos | **Acima.** Sugerir R$ 110. |
| Sobrancelha · Micropigmentação | R$ 600 · 180 · 365 | R$ 400 a 1.800; retoque em 30 a 60 dias, em geral incluído | [Catraca](https://catracalivre.com.br/saude-bem-estar/quanto-custa-fazer-micropigmentacao-de-sobrancelha/) | Ok. |
| **Unhas** · Manicure simples (mão) | R$ 45 · 45 · 15 | R$ 30 a 50 (BH média R$ 34, out/2025); semanal | [Diário do Comércio](https://diariodocomercio.com.br/?p=530609); [Catraca](https://catracalivre.com.br/noticias/quanto-custa-fazer-as-unhas-em-esmalteria-toda-semana-durante-um-ano-inteiro/) | Preço ok. Ritmo: mercado vai de 7 a 15. Sugerir **14**. |
| Unhas · **Pé e mão** | **não existe** | R$ 65 a 100 (BH média R$ 65,52, jun/2026) | [Diário do Comércio](https://diariodocomercio.com.br/?p=592317) | **Falta o par mais vendido.** R$ 75 · 90 min · 14. |
| Unhas · Esmaltação em gel | R$ 90 · 90 · 18 | ~R$ 100 · INF. 60 min · INF. 15 a 21 | GetNinjas Campinas (fraca) | Preço ok. Duração alta: sugerir 60. |
| Unhas · Alongamento | "em fibra" R$ 180 · 150 · 25 | gel R$ 100 a 180; fibra R$ 100 a 300 | GetNinjas; Revista Oeste (só resumo) | **Falta "Alongamento em gel"**, o mais pedido (INF.). |
| Unhas · Manutenção do alongamento | R$ 130 · 120 · 25 | ~R$ 130 (gel), R$ 90 a 180 (fibra) · INF. 15 a 21 | idem; relatório §3: "gel 15 a 25" | Preço ok. Sugerir ritmo **21**. |
| Unhas · Blindagem | não existe | INF. R$ 60 a 120 · dura ~20 dias | [Elle](https://elle.com.br/beleza/blindagem-de-unhas-pros-e-contras-da-tecnica) | Incluir (opcional). |
| **Cabelo** · Corte feminino | R$ 80 · 60 · 60 | R$ 40 a 468, média R$ 136 (BH); guia MEI R$ 60 a 150 | [Diário do Comércio](https://diariodocomercio.com.br/?p=592317); [FreelaSemCrise](https://freelasemcrise.com.br/blog/quanto-cobrar-cabeleireiro-mei-2026) | Ok para interior. |
| Cabelo · Corte masculino | R$ 45 · 30 · 30 (**2º da lista**) | — | — | Manter no fim da lista. |
| Cabelo · Escova | R$ 60 · 45 · 15 | R$ 30 a 135, média R$ 72,87 | Diário do Comércio | Ok. |
| Cabelo · Coloração / raiz | R$ 180 · 120 · 45 | média R$ 136 (BH); INF. raiz a cada 30 a 45 dias | Diário do Comércio | Ok. |
| Cabelo · Mechas | R$ 350 · 240 · 90 | R$ 150 a 1.500+; longo R$ 200 a 600 | [Tupi FM, jan/2026](https://tupi.fm/?p=2252929) | Ok. |
| Cabelo · Progressiva | R$ 250 · 180 · 120 | R$ 110 a 380, média R$ 232,90; mínimo 90 dias entre químicas | Diário do Comércio; [Portal Insights](https://portalinsights.com.br/perguntas-frequentes/qual-o-tempo-ideal-para-retocar-a-progressiva) | Ok. |
| Cabelo · Hidratação | R$ 90 · 60 · 30 | média R$ 140,28 | Diário do Comércio | Ok (interior). |
| Cabelo · Penteado | R$ 120 · 60 · **21 (vira 21)** | sem retorno | — | **Defeito C6.** |
| **Depilação** · Perna inteira | R$ 70 · 45 · 30 | R$ 80 a 180 | [FreelaSemCrise](https://freelasemcrise.com.br/quanto-cobrar/depilacao) | **Abaixo.** Sugerir R$ 90. |
| Depilação · Meia perna | **não existe** | INF. R$ 40 a 70 | GetNinjas (fraca) | **Incluir:** R$ 50 · 30 · 28. |
| Depilação · Virilha completa | R$ 60 · 30 · 28 | INF. R$ 40 a 90 | idem | Ok. |
| Depilação · Axila / Buço | R$ 25 · 15 · 25 / R$ 18 · 10 · 21 | INF. axila R$ 20 a 40 | idem | Ok. Ritmo da cera: fontes dizem 15 a 20 dias ([Drogasil](https://www.drogasil.com.br/blog/beleza/corpo/depilacao-com-lamina)), fraca. Manter 21 a 30 até medir. |
| **Estética** · Limpeza de pele | R$ 150 · 90 · 30 | capital R$ 120 a 250; interior R$ 80 a 180; 30 a 60 dias | [Catraca 2026](https://catracalivre.com.br/saude-bem-estar/quanto-custa-cuidar-da-pele-com-limpeza-profissional-em-2026/) | Ok. |
| Estética · Drenagem linfática | R$ 120 · 60 · 7 | R$ 80 a 250 por sessão; vendida em pacote de 5 a 10 | [Catraca, mar/2026](https://catracalivre.com.br/noticias/quanto-custa-em-media-uma-sessao-de-drenagem-em-2026/) | Ok. |
| Estética · Massagem modeladora | R$ 130 · 60 · 7 | R$ 100 a 165 (fraca) | Cronoshare (sem data) | Ok. |

**Leitura geral (INFERÊNCIA):** os **preços** do catálogo estão dentro da faixa, quase sempre na ponta do interior. Isso combina com o público (68% atendem em casa). O problema não é preço. É **o que falta** (pé e mão, alongamento em gel, manutenção de fio a fio, meia perna), **a ordem** (sem `position`) e **ritmo onde não há retorno** (remoção, penteado).

---

## 5. Contas de demonstração, redesenhadas

### 5.1 Quais contas

**Padrão de trabalho provisório (não é decisão do Vitor):** os nomes abaixo são fictícios e trocáveis. Nome de negócio é **Do Vitor**.

| # | Conta (slug) | Quem é | Plano | Ofício e equipe | Clientes ativas | Por que ela |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Carol Menezes Cílios e Sobrancelha** (`demo-carol-cilios`) | autônoma, sala própria | Essencial (1 profissional) | Carol: cílios e sobrancelha | **70** (45 de cílios, 25 só de sobrancelha) | É o público nº 1 do `docs/108` e o caso "faz mais de um serviço" do relatório §3. |
| 2 | **Esmalteria Rosa Chá** (`demo-esmalteria-rosa-cha`) | dona e duas manicures | Equipe | Patrícia Lima (dona, nail designer), Daiane Souza e Kelly Ramos (manicures) | **120** (cerca de 40 por manicure) | Mostra equipe, comissão e agenda de todas. |
| 3 | **Salão Encanto** (`demo-salao-encanto`, mesmo slug, conteúdo novo) | dona e quatro profissionais, com recepção | Avançado | Vanessa Prado (dona, colorista), Thiago Reis (cabelo), Juliana Castro e Bruna Siqueira (unhas), Tatiane Moreira (sobrancelha e depilação) | **220** | Dona de salão com cabelo e unhas. Um homem na equipe mantém o produto aberto (`docs/109` §5) e testa as telas sem supor gênero. |
| 4 | **Ana Paula Unhas** (`demo-ana-paula-unhas`) | manicure que vai à casa da cliente | Grátis (teto 50) | Ana Paula | **45** | Cobre o degrau grátis e quem atende em casa. |

**As três barbearias saem da vitrine.** Recomendo manter as contas no banco, mas fora da vitrine, porque a barbearia continua aceita no cadastro. Apagar ou não é **Do Vitor**.

### 5.2 Serviços, preços e ritmos de cada conta

Do pacote revisado (§4). Cada profissional só faz o que é do seu ofício (`professional_services`, a tabela já existe no banco local).

- **Carol:** Manutenção de cílios R$ 120 · 90 min · 21 d; Aplicação fio a fio R$ 160 · 120 · 21; Volume brasileiro R$ 180 · 150 · 21; Lash lifting R$ 140 · 60 · 45; Design com henna R$ 65 · 45 · 21; Design simples R$ 45 · 30 · 21; Brow lamination R$ 110 · 60 · 45; Remoção R$ 50 · 30 · sem ritmo.
- **Esmalteria:** Pé e mão R$ 75 · 90 · 14; Mão R$ 40 · 45 · 14; Pé R$ 45 · 45 · 14; Esmaltação em gel R$ 95 · 60 · 18; Alongamento em gel R$ 170 · 150 · 21; Manutenção do alongamento R$ 120 · 120 · 21; Blindagem R$ 80 · 60 · 20; Remoção R$ 30 · 30 · sem ritmo.
- **Salão Encanto:** cabelo (Corte feminino R$ 110 · 60 · 60; Escova R$ 70 · 45 · 15; Coloração/raiz R$ 190 · 120 · 40; Mechas R$ 420 · 240 · 90; Progressiva R$ 260 · 180 · 120; Hidratação R$ 110 · 60 · 30; Corte masculino R$ 55 · 30 · 30, no fim da lista); unhas (as da esmalteria); sobrancelha e depilação (Design com henna R$ 65; Buço R$ 20; Virilha R$ 60; Meia perna R$ 50).
- **Ana Paula:** Pé e mão R$ 65 · 90 · 14; Mão R$ 35 · 45 · 14; Esmaltação em gel R$ 80 · 60 · 18; taxa de deslocamento no próprio preço (sem campo novo).

### 5.3 Clientes e agendamentos realistas (a regra, não o número solto)

Lição da casa (`seed-parece-certo-e-absurdo-no-agregado`, `seed-volume-sai-do-historico`): o volume tem de **sair do ritmo**, não ser digitado.

- **Agendamentos por semana = soma de 7 ÷ ritmo de cada cliente ativa.** Conta da Carol (INFERÊNCIA): 45 × 7/21 + 25 × 7/21 ≈ 23 visitas por semana, mais 2 aplicações novas, ≈ 5 por dia em 5 dias. São ≈ 32 h de 50 h abertas: **65% de ocupação**. O faturamento sai ≈ R$ 11 mil por mês, plausível para lash de capital.
- **O seed imprime a ocupação de cada profissional e para com erro fora de 40% a 85%.** Assim o "absurdo no agregado" reprova antes de virar captura.
- **Mistura de estados do Motor** igual à do `seed-tenant-teste.mjs:220` (perdida, na hora, atrasada, em risco, em dia), com **15% a 20%** de clientes que passaram do dia. Recuperar abre com 10 a 15 nomes na conta da Carol.
- **Faltas** de 8% a 11% (o seed atual usa 11%, `:73`).
- **Uma cliente faz mais de um serviço:** 40% das clientes de cílios fazem design no mesmo dia (relatório §3).
- **Nomes:** cerca de 90% de mulher e 10% de homem, que existe em unha e sobrancelha. Nenhum nome de pessoa real.
- **Cor do perfil da dona** com o rosé da marca (`#d4949f` ou `#8c4766`, `docs/109` §4), não `#14b8a6`.
- **Revenda** no `seed-demo-dinheiro`: óleo de cutícula, sérum de cílios, esmalte, em vez de pomada.
- **Agenda futura** (`seed-demo-agenda-futura.mjs:114`): pesos por serviço de salão (manutenção e pé e mão pesam mais; remoção pesa pouco).

### 5.4 Ordem da vitrine (`src/core/tenants/demonstracao.ts`)

`SLUGS_DE_VITRINE` proposto, na ordem:
1. `demo-carol-cilios` (autônoma: o público maior)
2. `demo-salao-encanto` (dona de salão)
3. `demo-esmalteria-rosa-cha`
4. `demo-ana-paula-unhas`
5. último recurso de dev: uma conta de salão no lugar de `dom-rocha`.

**Recomendado, com alternativa descartada:** um botão só na home ("Ver funcionando") que abre a autônoma, e dentro da demonstração um seletor "Sozinha / Salão com equipe". Descartei dois botões na home porque somam decisão antes do primeiro toque. "Sozinha" supõe gênero: o rótulo tem de ser **"Só eu atendo" / "Salão com equipe"**, como já faz o `perfil/formulario.tsx` ("Só eu").

### 5.5 Capturas em `public/exemplo/`

- 4 contas × 4 telas (`hoje`, `clientes`, `recuperar`, `recuperar-topo`) = **16 arquivos**, na receita do cabeçalho de `painel-do-dono-exemplo.tsx:18-21` (tema claro, 375×812 a 2×, corte 1444 px).
- Retirar as 12 de barbearia do `SLUGS_COM_PRINT` (`:46-53`) e trocar `SLUG_PADRAO` (`:54`).

### 5.6 Guardas que precisam acompanhar

| Guarda | O que muda | Mutação que ela tem de pegar |
| --- | --- | --- |
| `tests/unit/design/vitrine-da-home-nao-e-literal.test.ts` | Continua valendo. **Acrescentar:** "a primeira vitrine é de beleza feminina". Para isso, `SLUGS_DE_VITRINE` vira lista de `{ slug, oficio }`. | Pôr `demo-dom-estilo` em primeiro → reprova. |
| `tests/unit/design/seed-imagens-cobre-demos.test.ts` | O array de `scripts/seed-demo-imagens.mjs:143-162` recebe os slugs novos (tem de ser igual a `SLUGS_DE_DEMONSTRACAO`). | Esquecer um slug novo → reprova (já pega). |
| `tests/unit/design/prints-do-exemplo-sao-claros.test.ts:14,28-29` | `SLUGS` e a contagem fixa de 24 arquivos mudam para as contas novas (16). | Faltar uma captura → reprova (já pega). |
| `agenda-futura-so-demonstracao.test.ts`, `seed-dinheiro-so-demonstracao.test.ts` | As listas dos scripts acompanham `SLUGS_DE_DEMONSTRACAO`. | Já pegam a divergência. |
| `seed-demo-nao-deixa-hash-nulo.test.ts`, `seed-que-grava-telefone-grava-hash.test.ts` | O seed novo grava `phone_hash`. | Já pegam. |
| **Nova:** `seed-de-vitrine-e-coerente` | Lê a configuração do seed: cada profissional só tem serviço do seu ofício; nenhum "extra" sem ritmo; nenhum serviço sem retorno com ritmo. | Dar "Escova" para a profissional de cílios → reprova. |

---

## 6. Calculadora

**Padrão proposto (Recomendado):** 8 pessoas · **R$ 120 por manutenção** · **21 dias**. É a manutenção de cílios do pacote e do relatório §3.

**A conta** (`calcularParado`, `src/core/aquisicao/calculadora.ts:50-67`, refeita à mão): 12.000 × 365 ÷ 21 = 208.571 centavos, arredonda para R$ 2.086 por pessoa por ano. Vezes 8 = **R$ 16.688 por ano, R$ 1.391 por mês**. Hoje (8 · R$ 35 · 30) dá R$ 426 por pessoa, R$ 3.408 por ano e R$ 284 por mês.

**Risco (INFERÊNCIA):** o número sobe 4,9 vezes. Pode parecer exagero para a manicure de R$ 40. Dois cuidados:
- os chips de ritmo levam o exemplo junto, para cada uma achar o seu;
- o texto do resultado já diz "só com essas pessoas".

| Onde | Hoje (FATO) | Proposta |
| --- | --- | --- |
| `calculadora.tsx:30-32` | 8 · 3500 · 30 | 8 · 12000 · 21 |
| `:22` comentário | "uma barbearia de cidade pequena" | "uma lash designer com manutenção a cada 21 dias" |
| `:73` rótulo | "Quantos clientes que vinham sempre pararam de vir?" | "Quantas pessoas que vinham sempre pararam de vir? Conte quem você lembra." |
| `:47`, `:53` | "um cliente" | "Pense em pelo menos uma pessoa que sumiu." / "Digite quanto cada pessoa paga, mais ou menos." |
| `:84-85` ajuda | "O ticket médio. Exemplo: R$ 35,00." | "Quanto custa a manutenção ou o serviço de sempre. Exemplo: R$ 120,00." (sem "ticket médio", que é jargão) |
| unidade (`:134`) | "por visita" | **"por manutenção"** (palavra dela, `docs/109` §5). A tela tem uma unidade só; "manutenção" serve para cílios, unha em gel, sobrancelha e raiz. |
| `:93` legenda | "De quanto em quanto tempo a clientela fiel volta?" | Manter. |
| chips (`calculadora.ts:47`) | `[15, 21, 30, 45, 60]`, comentário "de cílios/barba (15)" | `[14, 21, 30, 45, 60]` com a dica embaixo de cada um: 14 "pé e mão", 21 "cílios", 30 "sobrancelha, depilação", 45 "raiz", 60 "corte". A guarda dos limites (`LIMITES.retornoDias.min = 7`) continua. |
| `calculadora/page.tsx:26` | "para salão e barbearia" | "para quem faz unha, cílios, sobrancelha e cabelo" |

**Guarda:** o teste de unidade da calculadora fixa o resultado do exemplo (R$ 1.391 por mês). Mutação: voltar para R$ 35 → reprova.

---

## 7. Cadastro: ordem, busca e sistemas

### 7.1 Ordem das profissões (`professions.posicao`)

**Decidido** que o feminino entra pela ordem, com unhas, cílios e sobrancelha primeiro (`docs/109` §5). A home já usa esta ordem (`page.tsx:184`).

| posicao | Profissão | Hoje |
| --- | --- | --- |
| 1 | Unhas | 2 |
| 2 | Cílios | 1 |
| 3 | Sobrancelhas | 4 |
| 4 | Cabelo | **8** |
| 5 | Depilação | 5 |
| 6 | Estética | 6 |
| 7 | Barbearia | **3** |
| 8 | Tatuagem | 7 |
| 9 em diante | as outras, como hoje | 9 a 17 |
| 99 | Outra profissão | 99 |

**Recomendado:** na tela, as seis de beleza aparecem abertas; as outras ficam num grupo "Outras áreas" que abre com um toque e sempre aparecem na busca. Migration só de dados (`update professions set posicao`), aditiva, pode ir antes do código.

### 7.2 Sinônimos que faltam (busca do cadastro)

FATO no banco local: Cílios e Depilação não têm sinônimo nenhum.

| Profissão | Acrescentar |
| --- | --- |
| Cílios | lash, lash designer, extensão de cílios, alongamento de cílios, lash lifting, cilios |
| Unhas | nail, nail designer, esmalteria, unha em gel, alongamento de unhas, pedicure |
| Sobrancelhas | designer de sobrancelha, brow, henna, micropigmentação, sobrancelha |
| Cabelo | salão de beleza, colorista, escova, cabelereira (grafia comum), trancista |
| Depilação | depiladora, cera, depilação a laser |
| Estética | limpeza de pele, drenagem, massagem, estética facial |

**Guarda nova:** função pura em `src/core` que recebe a lista e o termo. O teste confere que "lash", "nail", "esmalteria", "depiladora" e "cabelereira" acham uma profissão de beleza. **Mutação:** tirar "lash" dos sinônimos → reprova.

### 7.3 "Qual sistema você usa?" (`src/core/onboarding/perfil.ts:26`)

**Proposta (Recomendado):** Trinks, Booksy, Avec (antigo Salão VIP / Beauty Date), Gendo, Fresha, AgendaPro, Agendiva, Outro. **AppBarber e BarbUp no fim**, antes de "Outro", porque a barbearia continua aceita.

Fontes: [Gendo](https://gendo.com.br), [Avec na App Store](https://apps.apple.com/br/app/avec/id1394288142), [Agendiva no Capterra](https://www.capterra.com/p/10046816/Agendiva/). Fresha tem salões no Brasil (anúncios em BH e SP). **Simples Agenda:** o `docs/109` §2 mediu o site em 20/10 (FATO lá), mas a busca desta frente não achou o produto. Por isso fica fora até alguém conferir (NÃO VERIFICADO). **Belasis:** sem fonte nova; mantenho a decisão de 28/09 (está na lista hoje).

Não há restrição no banco (`appbarber` não aparece em nenhuma migration), então trocar a ordem não quebra resposta antiga. A métrica "quantas contas vêm de outro sistema" continua.

---

## 8. `SERVICO_DE_VOLTA` e o efeito no Motor

`src/core/cycle/servico-padrao-da-base.ts:35-40` escolhe o serviço que vem marcado quando a pessoa traz a clientela ("Quem você já atende" e a importação). **O ritmo desse serviço decide quem da base já passou da hora. O preço dele é o R$ de "Dá para recuperar". O nome dele vai na mensagem de "Chamar".**

| Pacote | Hoje | Proposta | Por quê |
| --- | --- | --- | --- |
| barber | `pack:barber:Corte` (1º) | manter, no fim do conjunto | ordem do código não muda nada, mas lê como prioridade |
| lashes | Manutenção volume russo | "Manutenção de cílios" (nome novo do pacote, que serve para todas as técnicas) | C1 |
| brows | Design simples | "Design com henna" | mais vendido no relatório §3 (INFERÊNCIA) |
| nails | Manicure simples | **"Pé e mão"** (quando existir no pacote) | o par mais vendido (Diário do Comércio) |
| **hair** | **nenhum → "Corte masculino · R$ 45 · 30 d"** (C9) | "Coloração / retoque de raiz" (R$ 180, 45 d) **ou** "Escova" | **Do Vitor**: raiz é o retorno mais previsível do cabelo; escova é o mais frequente. Recomendo raiz: ritmo mais estável erra menos. |
| **waxing** | nenhum → "Virilha completa · 28 d" (pela mediana) | `pack:waxing:Virilha completa` explícito | a mediana acerta hoje por sorte; amarrar evita mudar se o pacote mudar |
| **aesthetics** | **nenhum → "Peeling químico · R$ 180 · 21 d"** (C9) | `pack:aesthetics:Limpeza de pele profunda` | limpeza de pele é o retorno mensal; peeling é protocolo em série |

**Efeito medido no Motor: NÃO VERIFICADO.** O efeito de C9 é INFERÊNCIA pela regra. Prova no navegador: conta nova de Cabelo, abrir `/admin/clientes/ja-atendo` e ver qual serviço vem marcado.

**Guarda:** o teste de `servico-padrao-da-base` passa a exigir uma entrada para **cada** pacote de beleza (`lashes`, `brows`, `nails`, `hair`, `waxing`, `aesthetics`) e confere que a chave existe no pacote (lendo o SQL, como já faz a parte de vocabulário da guarda de gênero, `copy-nao-supoe-genero.test.ts:296-352`). **Mutação:** apagar a entrada de `hair` → reprova; renomear o serviço no pacote sem mudar a chave → reprova.

**Ligado a C6:** enquanto "Remoção" e "Penteado" tiverem ritmo 21, a mediana do cabelo inclui um 21 que não existe. Tirar o ritmo desses serviços muda a mediana. O EXP-S09 e o EXP-S10 têm de ir juntos, e o teste tem de cobrir os dois.

---

## 9. NÃO VERIFICADO: o que precisa ser visto no navegador

Na régua do A6 (375×812, toque emulado), com a conta semeada no banco local:

1. Home → "Ver funcionando": cai mesmo em `demo-dom-estilo` (Barbearia Dom Estilo)? Qual print aparece?
2. `/links` → "Ver funcionando, sem cadastro": mesmo destino?
3. `/onboarding`: digitar **"lash"**, ver a frase "Não achamos", tocar "Seguir como Outra profissão" e **contar os serviços da conta criada** (esperado: zero). É o achado de maior risco desta frente.
4. `/onboarding`: a lista mostra Eletricista, Encanador e Psicólogo logo abaixo da beleza? Quanto rola até "Cabelo"?
5. `/admin/clientes/ja-atendo` numa conta nova de **Cabelo** e numa de **Estética**: qual serviço vem marcado? (esperado: Corte masculino; Peeling químico).
6. Página pública de uma conta nova de Cílios: em que ordem vêm os serviços? "Remoção" aparece para marcar?
7. `/calculadora`: o resultado com o padrão novo cabe a 375 px sem quebrar o número (R$ 16.688)?
8. Studio Bella logada como dona: a agenda mostra a profissional de cílios fazendo escova?
9. Mensagem pronta "Promoção da semana" com um serviço de nome feminino: aparece "o Manutenção"?
10. Botão de WhatsApp da página pública de "Studio Bella": o texto sai "pelo site da Studio Bella"?
11. Assistente: o chip "Quem sumiu há mais de 60 dias?" manda "Quais clientes estão sumidas" e isso aparece na conversa?
12. Prévia de `/admin/config/mensagens`: "Bruno Almeida, Corte + barba".

---

## 10. Tickets (formato B2 do `docs/111`)

Onda 1 do B3 ("cara de salão"), salvo indicação. Ordem por impacto em quem chega.

```
EXP-S01 · A demonstração abre num salão de beleza
Frente: salão
Lado: profissional
Jornada: P1 (primeiro contato), vitrine da home e do /links
Classe: Decidido (docs/108-norte tirou a barbearia do alvo; docs/111 C1 item 4). Nomes das contas: Do Vitor (padrão provisório em §5.1)
Quando: antes do lançamento
Hoje (FATO): SLUGS_DE_VITRINE começa por demo-dom-estilo (demonstracao.ts:109-112); SLUG_PADRAO = demo-dom-estilo (painel-do-dono-exemplo.tsx:54); 12 de 24 capturas são de barbearia. Falta ver na tela (§9 itens 1 e 2)
Depois (meta): 0 barbearias no caminho "Ver funcionando"; a 1ª tela mostra uma autônoma de cílios e sobrancelha com ≥ 5 horários no dia e ≥ 10 nomes em Recuperar
O que muda: src/core/tenants/demonstracao.ts (lista e comentário), painel-do-dono-exemplo.tsx (SLUGS_COM_PRINT, SLUG_PADRAO, legenda "cada pessoa"), public/exemplo/ (16 capturas novas), alternador "Só eu atendo / Salão com equipe"
Aceite medido: abrir a home a 375 px, tocar "Ver funcionando" e contar: nome do negócio de beleza, 0 menções a barba ou corte masculino na 1ª tela, nas 4 contas da vitrine
Guarda: vitrine-da-home-nao-e-literal ganha "a primeira vitrine é de beleza feminina" (SLUGS_DE_VITRINE vira {slug, oficio}). Mutação: pôr demo-dom-estilo em 1º → reprova. prints-do-exemplo-sao-claros com SLUGS e contagem novos
Risco: a vitrine resolve "o primeiro que existe no banco"; se o seed novo não rodar em produção, cai na próxima da lista (ainda pode ser barbearia). Medir: requisição em produção ao /{slug} de cada vitrine antes de publicar (producao-atras-do-codigo)
Tamanho: M (depende do EXP-S02)
```

```
EXP-S02 · Seed novo das contas de salão, com volume que sai do ritmo
Frente: salão
Lado: os dois
Jornada: P2, P3, P5, P7 (demonstração), C1 (página pública de exemplo)
Classe: Recomendado (alternativa descartada: só corrigir os nomes no seed atual, que deixa a profissional de cílios fazendo escova)
Quando: antes do lançamento
Hoje (FATO): seed-demo-6-negocios.mjs com 3 barbearias; salões com vertical errada; 13 de 28 nomes de homem (:169-176); Priscila (Cílios) fez Escova 5x e Renata (Cabelo) fez Extensão de cílios 5x (banco local); Corte feminino e Escova com ritmo 21; 14 a 28 clientes por negócio
Depois (meta): 4 contas (§5.1); cada profissional só faz o próprio ofício; ocupação de 40% a 85% por profissional, impressa pelo seed; 15% a 20% das clientes passaram do dia; ~90% nomes de mulher
O que muda: scripts/seed-demo-salao.mjs (novo, substitui a parte de salão do seed de 6); seed-demo-dinheiro.mjs (revenda de salão); seed-demo-agenda-futura.mjs (pesos de salão); seed-demo-imagens.mjs e demonstracao.ts (slugs novos); cor rosé
Aceite medido: rodar no banco local isolado; consulta "serviços por profissional" sem nenhum cruzamento de ofício; ocupação impressa dentro da faixa; Recuperar da Carol com 10 a 15 nomes
Guarda: nova seed-de-vitrine-e-coerente (mutação: dar Escova para a profissional de cílios → reprova; extra sem cycle_days → reprova). seed-imagens-cobre-demos, seed-dinheiro-so-demonstracao, agenda-futura-so-demonstracao, seed-demo-nao-deixa-hash-nulo continuam
Risco: seed apaga e recria por slug; slug igual a negócio real seria destruído. Medir: a trava de "só Supabase local" (:46) fica, e o slug novo entra em SLUGS_DE_DEMONSTRACAO antes de rodar
Tamanho: G
```

```
EXP-S03 · O cadastro acha "lash", "nail", "esmalteria", "depiladora"
Frente: salão
Lado: profissional
Jornada: P1
Classe: Recomendado
Quando: antes do lançamento (Onda 0 se o §9 item 3 confirmar a conta vazia: deixa alguém sem serviço nenhum)
Hoje (FATO): placeholder "Ex.: manicure, lash, sobrancelha…" (onboarding/formulario.tsx:125); lashes e waxing com sinonimos = {} no banco local; "outra" sem nenhum serviço em profession_services
Depois (meta): os 6 termos do §7.2 acham a profissão certa em 1 toque; 0 contas de beleza nascem como "Outra profissão" por causa da busca
O que muda: migration de dados (sinônimos); a busca sai do componente para uma função pura em src/core
Aceite medido: digitar cada termo do §7.2 a 375 px e ver a profissão certa em 1º lugar
Guarda: teste da função de busca (mutação: tirar "lash" → reprova)
Risco: sinônimo largo demais casa profissão errada ("massagem" achando fisioterapia, se um dia existir). Medir: o teste confere também que cada termo acha UMA profissão
Tamanho: P
```

```
EXP-S04 · Profissões de beleza primeiro, o resto em "Outras áreas"
Frente: salão
Lado: profissional
Jornada: P1
Classe: Decidido (ordem, docs/109 §5); Recomendado (agrupar o resto)
Quando: antes do lançamento
Hoje (FATO): Barbearia em 3º, Cabelo em 8º; Faxina, Eletricista, Encanador, Personal, Psicólogo, Professor, Fotógrafo, Banho e tosa e Jardineiro na mesma lista (banco local)
Depois (meta): a ordem de §7.1; as 6 de beleza visíveis sem rolar a 375 px; as outras a 1 toque
O que muda: migration de dados (posicao); onboarding/formulario.tsx (grupo "Outras áreas"); "Estética facial e corporal" vira "Estética"
Aceite medido: captura a 375 px mostrando as 6 sem rolagem; contar toques até Barbearia (≤ 2)
Guarda: teste que lê a migration e confere que as 6 de beleza têm posicao 1 a 6 (mutação: Barbearia em 3 → reprova)
Risco: quem é barbeiro leva 1 toque a mais. Aceitável pelo docs/108
Tamanho: P
```

```
EXP-S05 · Calculadora com números e palavra de salão
Frente: salão
Lado: profissional
Jornada: primeiro contato (calculadora e links da bio)
Classe: Recomendado
Quando: antes do lançamento
Hoje (FATO): padrão 8 · R$ 35 · 30 dias, "por visita", "ticket médio", "para salão e barbearia", "um cliente"
Depois (meta): padrão 8 · R$ 120 · 21; "por manutenção"; chips com exemplo de serviço; 0 masculino genérico
O que muda: calculadora.tsx, calculadora/page.tsx, src/core/aquisicao/calculadora.ts (§6)
Aceite medido: resultado do exemplo = R$ 1.391 por mês e R$ 16.688 por ano na tela, sem quebrar a 375 px
Guarda: teste do resultado do exemplo (mutação: voltar para R$ 35 → reprova)
Risco: número grande demais para a manicure parece exagero. Medir no teste de campo do docs/108: alguém troca os números? (a tela já distingue "exemplo" de "seus números")
Tamanho: P
```

```
EXP-S06 · Catálogo pronto de salão revisado
Frente: salão
Lado: os dois
Jornada: P1 (conta nova), C1 (página pública)
Classe: Recomendado (preços sugeridos são ponto de partida, a pessoa ajusta)
Quando: antes do lançamento
Hoje (FATO): §4; faltam Pé e mão, Alongamento em gel, manutenção de fio a fio, Meia perna; Corte masculino em 2º; position 0 em tudo
Depois (meta): os itens do §4 incluídos; position definida (o serviço de volta primeiro, remoção por último); preços ajustados (lamination R$ 110, perna inteira R$ 90)
O que muda: migration nova que atualiza vertical_packs e apply_vertical_pack (grava position). Só vale para conta nova; conta existente não muda
Aceite medido: criar conta de Unhas no banco local e ver Pé e mão em 1º na página pública
Guarda: teste que lê o pacote e confere que cada pacote de beleza tem o seu serviço de volta e position crescente
Risco: canonical_key é o nome no pacote (0097): renomear "Manutenção volume russo" quebra o vínculo das contas antigas com o agregado. Medir: manter o nome antigo como item e só ACRESCENTAR os novos, ou migrar a chave junto
Tamanho: M
```

```
EXP-S07 · Mais de um ofício no cadastro (cílios + sobrancelha; cabelo + unhas)
Frente: salão
Lado: profissional
Jornada: P1, P6
Classe: Recomendado (alternativa: só um pacote "Cílios e sobrancelha", que resolve a autônoma e não resolve o salão)
Quando: antes do lançamento para cílios + sobrancelha; depois do piloto para o salão
Hoje (FATO): uma profissão por conta; quem escolhe Cílios recebe 6 serviços, nenhum de sobrancelha
Depois (meta): a lash recebe cílios e sobrancelha no 1º minuto, sem cadastrar serviço à mão
O que muda: onboarding/formulario.tsx (seleção múltipla nas 6 de beleza), onboarding.ts (aplica mais de um pacote), apply_vertical_pack (sem duplicar produto)
Aceite medido: P1 cronometrado com uma lash: serviços de sobrancelha presentes, 0 toques extras em Serviços
Guarda: teste de onboarding com dois pacotes (mutação: aplicar só o primeiro → reprova)
Risco: o 3º campo do cadastro vira lista de marcar e a promessa "Três respostas" (onboarding/page.tsx:63) continua verdadeira só se continuar um campo. Medir: tempo do P1 antes e depois
Tamanho: M
```

```
EXP-S08 · O serviço de volta certo para cabelo, depilação e estética
Frente: salão
Lado: profissional
Jornada: P1, P3
Classe: Recomendado (a escolha de cabelo entre raiz e escova é Do Vitor; padrão provisório: raiz)
Quando: antes do lançamento
Hoje (FATO): SERVICO_DE_VOLTA sem hair, waxing, aesthetics; INFERÊNCIA: cabelo sai "Corte masculino · R$ 45 · 30 d", estética "Peeling químico · R$ 180"
Depois (meta): cada pacote de beleza com o serviço de §8
O que muda: src/core/cycle/servico-padrao-da-base.ts
Aceite medido: conta nova de Cabelo e de Estética no banco local, /admin/clientes/ja-atendo com o serviço certo marcado (§9 item 5)
Guarda: §8 (mutação: apagar hair → reprova)
Risco: casar com nome do pacote; se o EXP-S06 renomear, a chave tem de mudar junto. O teste cruzado do §8 pega
Tamanho: P
```

```
EXP-S09 · Serviço sem retorno não entra no Motor
Frente: salão
Lado: os dois
Jornada: P3, C4
Classe: Recomendado (o conserto certo já está registrado como "alvo" na 0063)
Quando: serve ao piloto
Hoje (FATO): Remoção, Penteado e Avaliação com ritmo 21 (0097:56; banco local)
Depois (meta): 0 pessoas em Recuperar por causa de remoção ou penteado
O que muda: services.cycle_days aceita nulo; Motor pula serviço sem ritmo; apply_vertical_pack grava nulo
Aceite medido: cliente com só uma Remoção no histórico não aparece em Recuperar depois de 30 dias (banco local)
Guarda: teste do Motor (mutação: voltar o 0 para 21 → reprova)
Risco: muda coluna, tipo gerado e 5 leitores (0063). Migration aditiva antes do código
Tamanho: M
```

```
EXP-S10 · Mensagens que a cliente manda e recebe sem erro de artigo
Frente: salão
Lado: cliente
Jornada: C1, C2, C4
Classe: Recomendado
Quando: antes do lançamento
Hoje (FATO): "o {{servico}}" (mensagens-prontas.ts:45); "pelo site da ${nome}" (agendar.tsx:621, pedido.tsx:32, secoes.tsx:53); "recomendo a ${nome}" (avaliar.tsx:128)
Depois (meta): 0 artigo colado a variável em texto que vai para o WhatsApp
O que muda: os 5 arquivos
Aceite medido: §9 itens 9 e 10, com "Studio Bella" e "Manutenção de cílios"
Guarda: varredura dos textos de WhatsApp contra artigo (o/a/da/do) imediatamente antes de "${" ou "{{". Mutação: reintroduzir "o {{servico}}" → reprova
Risco: o modelo já semeado na conta não muda (mensagens-prontas.ts:20-27). Medir quantas contas já abriram a tela antes de prometer que consertou
Tamanho: P
```

```
EXP-S11 · Exemplos do painel de salão
Frente: salão
Lado: profissional
Jornada: P3, P4
Classe: Recomendado
Quando: antes do lançamento
Hoje (FATO): E1, E2, E3, G2 (Bruno Almeida / Corte + barba; Corte ilimitado; Corte grátis; Marcos e Rafael; "o corte para R$ 55")
Depois (meta): 0 exemplos de barba ou corte masculino nas telas do painel
O que muda: editor.tsx de mensagens, planos/editor.tsx, fidelidade-config.tsx, clientes/[id]/fidelidade.tsx, ja-atendo/formulario.tsx, planejar.ts, preferencias.ts (fallback neutro)
Aceite medido: abrir as 5 telas e conferir os textos
Guarda: lista de palavras proibidas em placeholder e exemplo (barba, navalha, corte masculino) nas telas do painel. Mutação: voltar "Corte + barba" → reprova
Risco: baixo
Tamanho: P
```

```
EXP-S12 · Masculino genérico vira neutro nas telas de beleza
Frente: salão
Lado: os dois
Jornada: P2, P3, P6, P7
Classe: Recomendado (neutro passa na guarda; feminino exige mudar a guarda, Do Vitor)
Quando: antes do lançamento para "Peça ao dono", perfis e onboarding/perfil; depois do piloto para as ~80 linhas
Hoje (FATO): E7, E8, E9, B7, E10
Depois (meta): 0 "dono", "Novo/Atrasado/Sumido", "nós dois", "seus clientes" nas telas que a profissional da equipe e a autônoma veem
O que muda: as telas de E7, nota-do-cliente.ts, convite-do-ciclo.ts, onboarding/perfil/formulario.tsx, depois o resto em lote
Aceite medido: logar como profissional da equipe e abrir caixa, comissão, estoque e mês
Guarda: estender copy-nao-supoe-genero para "Peça ao dono" (mutação: reintroduzir → reprova)
Risco: frase neutra mais longa quebra linha a 375 px. Medir cada tela trocada
Tamanho: M
```

```
EXP-S13 · Guarda de gênero cega para verbo no meio
Frente: salão
Lado: os dois
Jornada: P3 (assistente)
Classe: Recomendado
Quando: antes do lançamento
Hoje (FATO): "Quais clientes estão sumidas há mais de 60 dias?" (assistente-flutuante.tsx:49), arquivo em JA_CONSERTADOS (:531)
Depois (meta): a frase neutra; o padrão pega "clientes + até 2 palavras + adjetivo feminino"
O que muda: assistente-flutuante.tsx:49; copy-nao-supoe-genero.test.ts:404
Aceite medido: rodar a guarda com a frase antiga e ver REPROVAR, antes de consertar a frase
Guarda: é a própria. Mutação obrigatória: "clientes estão sumidas" e "clientes que estão atrasadas"
Risco: padrão largo acusa coisa certa ("clientes estão marcadas para amanhã" é sobre pessoa e está errado também; "contas estão pagas" não casa). Conferir que a linha de base não cresce
Tamanho: P
```

```
EXP-S14 · "Qual sistema você usa?" com os sistemas da beleza
Frente: salão
Lado: profissional
Jornada: P1
Classe: Recomendado
Quando: antes do lançamento
Hoje (FATO): AppBarber, Trinks, Belasis, BarbUp, Booksy, Outro (perfil.ts:26)
Depois (meta): §7.3
O que muda: perfil.ts, perfil/formulario.tsx, a página vindo-de-outro-sistema se citar algum nome
Aceite medido: a 375 px, a lista cabe sem rolar ou rola com a beleza em cima
Guarda: teste que a ordem começa por sistemas de beleza (mutação: AppBarber em 1º → reprova)
Risco: chave nova sem tradução no relatório de origem. Conferir quem lê a resposta
Tamanho: P
```

```
EXP-S15 · "Cadeira" vira "posto", e a frase do "responde zero" fecha com o campo
Frente: salão
Lado: profissional
Jornada: P5
Classe: Recomendado
Quando: depois do piloto
Hoje (FATO): completude-do-lucro.ts:75 "Quem atende em casa responde zero" e o campo recusa zero (custo-fixo.ts:21); "hora de cadeira" em falar.ts:146 e sobra-explicada.ts:105
Depois (meta): "posto de atendimento" ou "maca ou cadeira"; a frase diz que o zero é no aluguel
O que muda: os 3 arquivos
Aceite medido: autônoma em casa preenche o custo fixo sem erro (§9 não cobre: medir no P5)
Guarda: teste que a ajuda não manda responder um valor que o esquema recusa
Risco: baixo
Tamanho: P
```

```
EXP-S16 · Termos, links da bio, assistente e roteiro falando de salão
Frente: salão
Lado: os dois
Jornada: primeiro contato
Classe: Do Vitor (termos é texto jurídico); Recomendado (links, assistente, roteiro)
Quando: antes do lançamento
Hoje (FATO): A6, A7, A8, A9 (:40), G1, H2
Depois (meta): §2
O que muda: termos/page.tsx, links-da-bio.ts, links/page.tsx, llms.txt/route.ts:40, assistente.ts:32,47 e o "ele", docs/marketing/roteiro-lancamento-instagram.md
Aceite medido: ler as páginas a 375 px
Guarda: a do prompt do assistente já existe (copy-nao-supoe-genero.test.ts:269); acrescentar que o prompt não fala do usuário como "ele"
Risco: mudar termos exige data de versão e aviso, se a casa já trata isso
Tamanho: P
```

```
EXP-S17 · CLAUDE.md com o público de hoje
Frente: salão
Lado: os dois
Jornada: todas (orienta toda sessão)
Classe: Do Vitor
Quando: antes do lançamento
Hoje (FATO): CLAUDE.md "qualquer profissional… não só beleza (barbearia…), faxineira, eletricista"
Depois (meta): "salão e beleza feminina primeiro (docs/108, docs/109); a barbearia e as outras profissões continuam aceitas"
O que muda: CLAUDE.md
Aceite medido: n/a (texto)
Guarda: nenhuma
Risco: sessão futura propor coisa para eletricista no lugar de salão. É o risco que a troca resolve
Tamanho: P
```

```
EXP-S18 · Opções de cobrança de visita e diária só para quem usa
Frente: salão
Lado: profissional
Jornada: P1
Classe: Recomendado
Quando: depois do piloto
Hoje (FATO): servicos/formulario.tsx:202-207 oferece "Taxa de visita + hora" e "Diária" a salão
Depois (meta): beleza vê "Preço fechado" e "Sob orçamento"
O que muda: formulario.tsx, lendo o eixo cobranca da profissão
Aceite medido: abrir "Mais opções" numa conta de Unhas
Guarda: teste do filtro (mutação: mostrar Diária para nails → reprova)
Risco: quem cobra por hora em estética perde a opção. Manter "Por hora" para estética
Tamanho: P
```

---

## 11. Para a revisão adversarial (B4)

- **EXP-S05 pode piorar o primeiro contato da manicure:** R$ 1.391 por mês com padrão de cílios pode soar como "não é para mim". Por isso os chips têm exemplo por ofício.
- **EXP-S06 pode quebrar o agregado:** renomear item do pacote quebra a `canonical_key` (`0097`). A saída mais segura é acrescentar itens, não renomear.
- **EXP-S01 depende de produção:** a vitrine resolve no banco. Código no ar sem o seed novo no ar cai na próxima da lista. Na ordem nova, a próxima ainda pode ser uma barbearia se as contas antigas ficarem.
- **Ainda com cara de barbearia e ninguém abriu para ver:** a ficha da cliente de uma conta `general` usa o padrão neutro, mas qualquer conta com `vertical` nula vê máquina, navalha e cerveja (E4). Não achei caminho no código que crie conta com vertical nula. NÃO VERIFICADO.

## Fontes usadas

- `docs/111` (Parte C1 e C1.1), `docs/109-marca-feminina/00-pesquisa.md` §2 e §5, `docs/concorrentes/beleza-feminina/05-relatorio.md` §3 (branch `aprimoramento/plano-2026-10-13-docs`).
- Migrations `0002`, `0022`, `0026`, `0031`, `0057`, `0060`, `0063`, `0069`, `0078`, `0097`; banco local `supabase_db_ciclo-marca` (tabelas `professions`, `profession_services`, `vertical_packs`, `tenants`, `services`, `professionals`, `appointments`).
- Mercado: links na tabela do §4 (pesquisa feita em 21/10/2026). Fontes fracas estão marcadas.
