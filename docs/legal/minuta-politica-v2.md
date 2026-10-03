# Minuta da Política de privacidade v2: seções novas e alteradas

> **J5 do `docs/86`. Minuta de quem NÃO é advogado, para revisão humana.** A versão em vigor é a de
> `2026-10-03` (PR #144: §3, §4 e §5 passam a ler a lista de operadores). O que está aqui é o que falta
> para a v2. Cada trecho diz **o que no produto o sustenta** e **o que ainda não sustenta**.
> `[entre colchetes]` = dado do Eduardo. `(?)` = ponto para o parecer humano.

---

## §1 · Quem é responsável pelo quê (altera: nomeia o responsável e o encarregado)

> **Quem é o CICLO.** **[razão social]**, CNPJ **[...]**, **[endereço]**. **Encarregado de dados:**
> **[nome]**, **[e-mail]**. É por aqui que você exerce os direitos da seção 7.

**Sustenta:** as variáveis `NEXT_PUBLIC_CONTATO_*` (ausentes em produção hoje). `(?)` se o CICLO precisa de
encarregado formal ou se a dispensa para agente de pequeno porte (Res. CD/ANPD 2/2022 [confirmar]) se
aplica; **o canal para o titular existe de qualquer jeito.**

---

## §2 · O que a gente guarda (altera: três acréscimos)

> **Crianças e adolescentes.** Se o seu negócio atende menores, o cadastro é feito pelo responsável e a
> autorização dele é sua (você decide o que coleta). O CICLO não pede dado de menor por conta própria.
>
> **O que a gente NÃO guarda.** Número de cartão (o pagamento é no ambiente do Mercado Pago). Nenhum dado
> seu ou dos seus clientes vai para serviço de inteligência artificial de terceiros.
>
> **Foto.** Foto de antes e depois só entra com o consentimento do cliente registrado, fica em
> armazenamento privado e é acessada por link temporário.

**Sustenta:** `consents` (consentimento de imagem), bucket privado com URL assinada (`media`), nenhuma rota
instancia IA externa (guarda J11).

---

## §3 · Por que a gente guarda (altera: base legal por finalidade, em linguagem simples)

> | Para quê | Com base em |
> |---|---|
> | Sua conta, sua agenda, a página de agendamento, o caixa | o contrato que você fez com a gente |
> | Cobrar a assinatura | o contrato, e a obrigação de guardar o registro fiscal |
> | Calcular quando cada cliente costuma voltar e sugerir quem chamar | o contrato (é o que o produto faz) |
> | Registrar quem abriu uma ficha de saúde, e quem fez o quê | o nosso interesse legítimo em manter o sistema seguro, e a obrigação de proteger dado sensível |
> | Medir como o produto é usado (sem texto de cliente) | o nosso interesse legítimo em melhorar o serviço |
> | Dado de saúde que você registra sobre um cliente | **consentimento específico do cliente**, que **você** coleta e o sistema registra |
> | Números agrupados e sem nome de muitos negócios (item 4 dos Termos) | a autorização que você dá nos Termos |

**Por que a tabela:** a política atual diz só "para executar o contrato". A LGPD pede a base de cada
finalidade (art. 7 e 9). **Fonte:** `docs/legal/inventario-de-tratamento.md`, coluna "Base legal".
`(?)` **toda a coluna é proposta minha.** Em especial: dado de saúde de cliente de salão com
consentimento do titular (art. 11, I), e não "tutela da saúde" (art. 11, II, f), porque o salão não é
profissional de saúde.

---

## §4 · Como a gente protege (altera: a lista de medidas sai do código)

> - **Cada negócio só enxerga o próprio dado.** O isolamento é feito no banco, em toda tabela, e um teste
>   automático impede o sistema de subir se alguma tabela nova ficar de fora.
> - **Dado de saúde fica cifrado** (AES-256), com uma chave por negócio guardada separada do banco. Só quem
>   tem permissão abre, e todo acesso fica registrado.
> - **Telefone de cliente é guardado também de forma embaralhada**, para a busca funcionar sem espalhar o
>   número.
> - **Exportar a base inteira e apagar a conta exigem verificação em duas etapas.**
> - **Registro de erro e análise nunca recebem dado de saúde**, e os dados pessoais são removidos antes do
>   envio.
> - Tudo trafega por conexão cifrada.

**Sustenta (conferido):** `server/crypto/kek.ts` (`aes-256-gcm`, DEK por negócio embrulhada por KEK) ·
`tenant_keys` · `vault_access_log` · `phone_hash` com sal · RLS forçada com `tests/rls/isolation.test.ts` ·
`redigirEventoSentry` · MFA em exclusão de conta. **Conferido** em 03/10/2026: `exigirAal2()` está nas rotas de exportar a base (`clients/export`) e de excluir a conta (`account`).


---

## §6 · Por quanto tempo (altera: concreto)

> | O quê | Por quanto tempo |
> |---|---|
> | Sua conta, enquanto ela existir | enquanto existir |
> | Conta cancelada ou pausada | **[90] dias** guardada e exportável; depois, eliminada, com aviso **[30] e [7] dias** antes |
> | Um cliente que você apaga | some na hora, inclusive da trilha interna |
> | Registro de acesso ao sistema | **6 meses** [confirmar: Marco Civil, art. 15] |
> | Cobrança e nota fiscal | **5 anos** [confirmar com o contador] |
> | Cópia de segurança | até **[7] dias** além da eliminação |
>
> Registros de agendamento, caixa e estoque não são apagados com a pessoa, porque são o histórico do
> negócio, mas passam a não identificar mais ninguém.

**Sustenta hoje:** apagar cliente (`eliminarCliente`, alcança `audit_log` e `idempotency_keys`, 0046).
**NÃO sustenta ainda:** a eliminação da conta depois de 90 dias (portão C9), os avisos por e-mail (C6) e o
registro de acesso por 6 meses (`[conferir]` a retenção de log da Vercel, que no plano Hobby é de 1 hora).
**Pendência real do inventário:** `job_queue.payload` e `webhook_events.payload` podem carregar telefone e
texto e **não** são alcançados pela eliminação. Até corrigir, a frase "inclusive da trilha interna" precisa
de ressalva ou de conserto.

---

## §7 · Seus direitos (altera: quem é o titular)

> **Se você é cliente de um negócio que usa o CICLO** (e não é quem contratou o CICLO), quem decide o que
> foi guardado sobre você é esse negócio. Peça a ele: ele tem as ferramentas para te mostrar, corrigir e
> apagar o que guardou. Se ele não responder, escreva para **[e-mail do encarregado]** e a gente encaminha.

**Por que:** hoje a política fala só com o profissional. A cliente do salão é a maior parte dos titulares.
**Sustenta:** exportação e eliminação por ficha existem; o encaminhamento é trabalho manual (`[conferir]`
que o canal chega a alguém).

---

## §8 · Se algo vazar (altera: prazos e papéis)

> Se acontecer um incidente de segurança que possa trazer risco para você ou para os seus clientes, o
> CICLO **avisa o seu negócio em até 24 horas** depois de saber, dizendo o que aconteceu, o que foi
> afetado e o que estamos fazendo. O seu negócio, como responsável pelos dados dos clientes dele, comunica
> a ANPD e as pessoas afetadas em até **3 dias úteis** (Res. CD/ANPD 15/2024); a gente ajuda com o que
> for preciso. Para os dados que o CICLO controla (os seus), a comunicação à ANPD é nossa.

**Fonte do prazo:** Res. CD/ANPD nº 15/2024, 3 dias úteis para ANPD e titular (conferido em 03/10/2026).
**Sustenta:** `docs/runbooks/incidente.md` existe, mas **não fala de ANPD nem de prazo** (J9). As 24 h são
compromisso novo: precisa de quem receba o alerta e de um caminho para avisar o negócio.

---

## Seção nova · Decisão automatizada (LGPD art. 20)

> O CICLO calcula uma nota de prioridade para sugerir **quem chamar primeiro**. Ela só ordena uma lista: **quem decide chamar, e o que dizer, é você.** Nenhum cliente é bloqueado, cobrado ou
> tratado de forma diferente por causa dela.

**Sustenta:** `client_scores` e a fila de chamadas (docs/95). **A frase só é verdade enquanto a nota não
agir sozinha:** ela entra numa guarda quando o autopilot (sem aprovação) for discutido (`docs/84`, F0).
