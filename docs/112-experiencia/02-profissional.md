# 112 · 02 · Propostas para a profissional (autônoma, dona e equipe)

Base: `01-diagnostico.md` (jornadas P1 a P7 medidas), `05-avisos.md`, `04-salao.md`, `medidas/copy-e-acessibilidade.md` e `medidas/concorrentes.md`. Os tickets citados estão em `07-tickets.md`.

## As 5 mudanças que mais rendem para ela

| # | Mudança | Jornada | Hoje (FATO) | Depois (meta) | Tickets |
| --- | --- | --- | --- | --- | --- |
| 1 | **Um número só de "dá para recuperar"**, e a mensagem chamando para a manutenção certa | P2, P3 | R$ 355,40 no Hoje, R$ 800,00 no Recuperar, para as mesmas 6 clientes; chama para "aplicação" | o mesmo número nas duas telas, com guarda; a mensagem chama para o serviço de volta | EXP-J01, EXP-S08, EXP-S09 |
| 2 | **Marcar quem já é cliente sem redigitar** | P4 | ≈ 8 toques; o campo não sugere ninguém e puxa o nome da própria profissional | ≤ 5 toques: digita 3 letras, toca na cliente, o serviço de volta dela já vem marcado | EXP-J02, EXP-K08 |
| 3 | **"Lembrar amanhã" e "voltar antes do dia" pelo WhatsApp dela** | P3, C2, C4 | só se age depois do dia; nenhum link de confirmar sai | um cartão no Hoje abre o WhatsApp dela com o link de confirmar; o Motor sugere chamar 2 dias antes do dia de cada cliente | EXP-A10, EXP-A12, EXP-K03 |
| 4 | **A equipe entra pelo número, por WhatsApp** | P6 | bloqueado: o convite exige e-mail e quem entrou pelo número fica em círculo | convite por link no WhatsApp, aceite com o número, ≤ 1 min | EXP-K01 (L2 do `docs/110`) |
| 5 | **O primeiro dia com cara de salão** | P1 | ≈ 17 toques; "lash" não acha Cílios; "Outra profissão" nasce sem serviço | ≤ 12 toques; "lash", "nail", "esmalteria" acham; cílios + sobrancelha juntos; catálogo de salão revisado | EXP-S03, EXP-S04, EXP-S06, EXP-S07, EXP-J03 |

## Por perfil

### Autônoma
- **Menos tela.** Time, Estoque e Campanhas não aparecem para quem trabalha sozinha (conferir numa conta criada pelo cadastro; na conta semeada aparecem, `01-diagnostico.md` P5).
- **O dia fechado sem comanda.** Para a autônoma, "Chegou" e "Concluído" na agenda já deveriam somar no caixa do dia. Hoje ela vê "Nenhuma comanda fechada hoje" com 3 atendimentos confirmados (EXP-J04).
- **Avisos numa tela só.** Automações, Notificações e Mensagens viram "Avisos", e o dial passa a valer de verdade (EXP-A01, EXP-A13).

### Dona de salão
- **Agenda de todas, lado a lado no desktop e uma por vez no celular** (P7, NÃO MEDIDO nesta rodada: medir na `demo-esmalteria-rosa` antes de abrir o ticket).
- **Push só para quem precisa.** Hoje todo aparelho do salão recebe o nome da cliente de qualquer profissional, inclusive quem tem visão restrita (EXP-A06, **Onda 0**).
- **Desativar profissional com confirmação e volta** (EXP-K14).

### Profissional da equipe
- Entra pelo número (EXP-K01) e vê só a própria agenda (`restrict_professional_view`, já existe).
- Recebe push só do que é dela (EXP-A06).

## O que não fazer (e por quê)
- **Não pôr pop-up na cara de quem está com a cliente na cadeira.** As regras de aviso dentro do app estão em EXP-A14: no máximo um por sessão, nunca sobre o botão que ela ia tocar.
- **Não ligar envio automático antes do agendador de 15 minutos e da credencial** (EXP-A09). Até lá, tudo sai pelo WhatsApp dela, com um toque.
- **Não medir sucesso por "mensagens enviadas".** O cartão "voltaram pelo seu Chamar" usa a conta honesta (EXP-A15).
