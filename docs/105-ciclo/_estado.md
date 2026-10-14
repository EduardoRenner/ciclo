# 105 · Estado do ciclo infinito

Uma linha por ciclo: `C-NNN · objetivo · número antes → depois · nota (cliente/segredo/engenharia) · próximo`.
Primeira coisa a ler depois de um resumo de contexto. O laço e as regras estão em `docs/105-PROMPT-MESTRE-CICLO-INFINITO.md`.

## Escolhas em vigor

- **Primeira expansão de vertical:** automotivo (oficina) — prova o relógio que não é só tempo (km + tempo). Fonte de domínio: StarkOS.
- **Segunda expansão ("a outra coisa"):** pet, por padrão de trabalho (dois relógios, mesmo perfil de comprador, nenhum código ainda). Trocar se o Eduardo apontar outra.
- **Trilha permanente:** o algoritmo (Motor de Ciclo) em pelo menos 1 de cada 3 ciclos.

## Ciclos

- C-001 · Dar régua ao Motor (backtest com origem móvel) + Motor v2 · "padrão errado": erro mediano 44 d → 5 d, acerto ±7 0% → 66%; outros 4 cenários iguais · 7/8/8 · próximo: C-002 = relógio múltiplo (tempo + km) com o carro como caso de teste; seed e integração do C-001 quando o Docker voltar
- C-002 · Relógio múltiplo (tempo ou km, o que vencer primeiro) · erro mediano do lembrete, sintético: aplicativo 290 d → 8 d, 25 mil/ano 216 → 16, médio 78 → 30; beleza idêntica · 8/9/8 · próximo: C-003 = expansão automotiva degrau (a) diagnóstico (o que da plataforma serve, o que falta; StarkOS como fonte), depois MOT-006/007
- C-003 · Diagnóstico da expansão (oficina e pet) · o buraco é o SUJEITO (quem volta é o animal/carro): perda de um animal vista 0% (série única) → 100% (por sujeito); mapa serve/falta escrito · 7/9/8 · próximo: C-004 = EXP-001 o sujeito no banco (migration aditiva, RLS, isolamento), com revisão adversarial própria; algoritmo volta no C-005 (A-09 regularidade ou A-10 deriva)
- (14/10, pedido do Eduardo) **Execução pausada** para o plano mestre automotivo: `docs/106-automotivo/00-PLANO-MESTRE.md` (por que, experiência, dado — marca/modelo/ano via FIPE, catálogo de itens com 3 relógios, planos em 3 camadas com fonte —, Motor por item, negócio, riscos, 7 fases / ~35 tickets AUT-xxx, decisões). Próximo C-NNN só depois que o Eduardo olhar o plano; a fundação (Fases 1–3) segue pelo padrão de trabalho se ele mandar seguir.
- C-004 · Fundação pura do automotivo (106 Fases 2–3 sem banco): 29 itens, 7 perfis, herança de camadas, vencimento por 3 relógios + severo + perguntar · 0 → 29 itens com relógio · 6/8/8 · próximo: C-005 = algoritmo: agrupar itens em visitas (AUT-303) + placar automotivo por item (perfis × itens, item crítico vencido = 0); banco (AUT-101..105) quando o Docker voltar
- C-005 · Agrupar a manutenção em visitas (AUT-303) · 2 anos sintéticos: médio 17 → 4 visitas, aplicativo 72 → 10, crítico vencido 0 · 7/8/8 · próximo: C-006 = banco do automotivo se o Docker voltar; senão A-10 (deriva)
- C-006 · Motor v3: os 2 intervalos mais recentes pesam o dobro (A-10) · deriva: acerto na semana 85% → 92%, nenhum cenário pior (varredura de 4 pesos) · 6/8/8 · próximo: C-007 = banco do automotivo se o Docker voltar; senão a mensagem que diz o relógio (A-12, serviço como software)
- C-007 · Mensagem que diz o relógio (A-12, serviço como software): km que faltam, meses desde a troca, "vale conferir" sem histórico; sem número inventado nem promessa de canal · frases conferíveis 0 → 3 de 3 · 7/7/8 · próximo: C-008 = banco do automotivo se o Docker voltar; senão A-09 (regularidade)
- C-008 · Faixa de incerteza do próprio cliente (A-09): MAD + tendência dos intervalos do Motor · cobertura 44–100% (±7 fixa) → 77–90%; regular ±3 d, errático 44% → 78% · 6/8/8 · próximo: C-009 = banco do automotivo se o Docker voltar; senão a faixa no Recuperar receita (Motor v4)
- C-009 · Preço de cada lembrete (Motor v4 candidato, estado pela faixa com alfa 0,5) · lembrete desnecessário 24/86/31/45/40% → 6/34/19/20/16%, notar quem sumiu +1 a +8 d; corrige afirmação do C-008 · 7/8/8 · próximo: C-010 = banco do automotivo se o Docker voltar; senão pet (core puro)
- C-010 · Expansão pet: protocolo de saúde (série do filhote, reforço anual, vermífugo por risco, antipulgas por produto, perguntar sem registro) + aproveitar o banho · saúde lembrada 0 → 100%; no banho quinzenal 69% sai no balcão sem mensagem · 7/8/7 · próximo: C-011 = banco do automotivo se o Docker voltar; senão viés da deriva
- C-011 · Motor v4: 2 intervalos que concordam fora da régua do padrão provam o ritmo; tendência robusta testada e rejeitada (piora pulo/errático) · padrão errado acerto 66% → 79%, nenhum outro cenário muda · 6/8/8 · próximo: C-012 = banco do automotivo se o Docker voltar; senão mensagem do pet
- C-012 · Mensagem do pet: aproveitar o banho marcado, vacina só oferecida por quem aplica, carteirinha sem registro, sem gênero · mensagens de saúde/ano no tutor quinzenal 14,7 → 4,1 · 7/7/8 · próximo: C-013 = banco do automotivo se o Docker voltar; senão dano vivo
