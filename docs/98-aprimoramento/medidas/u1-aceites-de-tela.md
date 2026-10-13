# Aceites de tela da Onda U1 (13/10/2026)

Build da branch `aprimoramento/onda-u1` servido na porta **3201 com `TZ=UTC`** (como na Vercel);
porta **3200** = build da `main` antiga, como controle. Banco local, seed da APR-037. Roteiros em
`medidas/*.mjs.txt` (copiar para `C:\temp\ciclo-medicao\` e rodar com `node`).

| Ticket | Roteiro | Controle (main antiga, 3200) | Branch (3201) | Aceite |
| --- | --- | --- | --- | --- |
| APR-003 corrida do dia | `apr003-corrida` (1 s de pausa, 2,5 s de atraso na consulta velha, 3 s antes de tocar o horário; compara o **dia tocado** com o dia do POST e do resumo, critério R-05) | **3 de 3** divergem (tocou qui 15, POST ia para ter 13, resumo dizia qui) | **0 de 20** | ✓ |
| APR-010 414 no Mês/Serviços | `apr010-telas` com 230 comandas sintéticas (285 em 90 dias), removidas no fim | Serviços e Mês caem em "Não consegui carregar esta tela" | as duas abrem, margem calculada (sem precisar do aviso) | ✓ |
| APR-019 hora no fuso | `apr019-html-fuso`: HTML cru (sem hidratação) de Agenda e Hoje × banco no fuso do negócio | — (o 3200 roda no fuso da máquina; a reprodução original foi no 3201 antigo) | 0 horas fora do banco; o único "19:00" é o fim do último horário na faixa "10:30–19:00" | ✓ |
| APR-021 fila ao abrir | `apr021-022-offline`, 5 rodadas: enfileira sem rede, fecha, abre com rede | reprodução original: 0 POST em 10 s | POST em **371 a 1.955 ms**, fila vazia, 5 de 5; os 5 horários no banco | ✓ |
| APR-022 fica na tela | idem | reprodução original: tela do dinossauro | URL segue `/admin/agenda/novo`, aviso "Guardado neste aparelho: {nome}, {dia}, às {hora}…", 0 `chrome-error`, 5 de 5 | ✓ |
| APR-037/039 papéis | `papeis` e `papel-x-tela` | — | profissional vê 5 de 14 horários; 75 linhas papel × tela | ✓ |

| APR-015 usar sessão | `u1-lote2` (aba Fidelidade da ficha) | — (o botão não existia) | `package_uses` 0 → 1; 0 "na comanda" na ficha | ✓ (texto ajustado para "aba Fidelidade" depois da medição) |
| APR-023 convite | `u1-lote2`: dono convida; outro navegador, conta nova, sem negócio | reprodução original: 404 | sem sessão → `/entrar?proximo=/convite/…`; depois do login volta ao convite (não ao cadastro de negócio); "Barbearia Dom Estilo te chamou para a equipe"; aceitar → `/admin/hoje`; `memberships.role = reception` | ✓ |
| APR-024 expediente | `u1-lote2` | — (só por URL) | 3 links "Expediente e folgas", 48 px, abre a tela do profissional | ✓ |
| APR-026 recuperação | `u1-lote2`: link gerado pela API de admin, aberto em navegador novo, 3 rodadas | reprodução original: "link não é mais válido" | `/nova-senha` → troca → entra com a senha nova, 3 de 3; 2º uso → `/entrar?erro=link_invalido` | ✓ |

Pendentes de tela: APR-002 (folga com rede caindo, parte `c05`) e APR-005 (409 com alternativas).
