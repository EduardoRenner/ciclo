# 108 · O teste de 10 minutos, medido no navegador (16/10/2026)

O roteiro do `02-kit-de-campo.md`, feito por uma máquina e não por uma pessoa:
- celular de **390 px**;
- uma conta nova por nicho;
- contra a branch de integração (`integracao/norte-2026-10-16`, PR #152) num Supabase local isolado, só com as migrations da branch e sem seed de demonstração.

O roteiro está em `medidas/teste-10-minutos.mjs`, o resultado bruto em `medidas/teste-10-minutos-resultado.json` e as capturas em `medidas/capturas/`.

**O que ele mede:**
1. entrar;
2. primeiros passos (nome, profissão, endereço);
3. as perguntas ("na minha cabeça ou num caderno", "só eu");
4. trazer 20 pessoas de memória, colando duas listas: 10 de "uns 15 dias" e 10 de "um mês";
5. ver o cartão do Motor;
6. abrir Recuperar e conferir "Dá para recuperar", o serviço da fila e o link do WhatsApp em "Chamar".

## Resultado depois do conserto

| Nicho | Tempo de máquina | Passaram da hora | Dá para recuperar | Serviço na fila e na mensagem | Lucro na tela | Chamar abre o WhatsApp |
| --- | --- | --- | --- | --- | --- | --- |
| Cílios | 13,6 s | 10 | R$ 1.200,00 | Manutenção volume russo | não | sim |
| Sobrancelhas | 12,1 s | 10 | R$ 450,00 | Design simples | não | sim |
| Unhas | 12,8 s | 20 | R$ 900,00 | Manicure simples | não | sim |
| Barbearia | 12,2 s | 10 | R$ 450,00 | Corte | não | sim |

**Em nenhuma tela houve rolagem lateral a 390 px.** "Oficina mecânica" não aparece na lista de profissões; o pacote segue fechado, como manda a decisão. O tempo de uma pessoa digitando é bem maior que o da máquina; o teste de campo mede esse.

## O que a medida achou

1. **O serviço errado vinha marcado em 3 dos 4 nichos do alvo.**
   - **O defeito:** numa conta nova, a regra pegava o serviço de ritmo mediano, com desempate pelo nome.
     - Cílios saía "Aplicação clássica" (R$ 150, a primeira vez da cliente).
     - Sobrancelha saía "Retoque de micro" (R$ 200, 30 dias).
     - Unhas saía "Banho de gel".
   - **O efeito:** em cílios, "Dá para recuperar" dava **R$ 1.500,00** em vez de R$ 1.200,00, e a mensagem dizia "seu último horário de aplicação clássica" a quem faz manutenção.
   - **O conserto:** commit `283fa7a2`, no PR #152. Sem histórico, vem marcado o serviço que a clientela repete, reconhecido pela `canonical_key` (renomear não quebra). Pacote fora da lista segue na mediana. Mutação: tirar a manutenção de cílios da lista reprova o teste.
2. **A importação nova nascia com o primeiro serviço do alfabeto.** A esteira do conversor usava `servicos[0]`, o que dá "Barba · 14 dias" na barbearia, exatamente o defeito que o `docs/82` §7 já tinha consertado na outra tela. Agora usa a mesma regra, com uma guarda que reprova se voltar.
3. **Endereço repetido trava sem sugerir saída.** Com um nome comum ("Esmalteria"), a tela diz "Esse endereço já está em uso. Escolha outro." A frase é clara, mas a pessoa tem de inventar outro endereço. **Não consertei:** fica para o teste de campo dizer se isso trava alguém, como manda o congelamento.
4. **Unhas: as 20 pessoas entram como atrasadas.** "Uns 15 dias" bate exatamente com o ritmo de 15 dias da manicure. O Motor marca "na hora de voltar", e o cartão soma isso em "atrasadas para voltar". A conta está certa; a palavra "atrasadas" para quem está no dia exato é discutível. Anotado para o campo.

## O que esta medida não prova

- **Uma pessoa real, no celular dela, digitando.** É isso que o kit de campo mede.
- **O cadastro com confirmação por e-mail.** O teste cria a conta pelo painel do Supabase local, porque não há SMTP. O cadastro de verdade depende do item 1 do Eduardo.
- **A produção.** Tudo aqui é local.
