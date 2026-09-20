# Qualidade — evolução autônoma do produto

> Bugs, duplicação, dívida técnica, abstrações ruins — achados de leitura de código, não de uso.

---

## 2026-09-20 · Auditoria dirigida por churn: billing/pagamento e useOptimistic, sem achado

Estratégia desta rodada: em vez de ler arquivos ao acaso, usei `git log --since="7 days ago"
--name-only` para achar os arquivos mais mexidos na última semana — hipótese: código recente teve
menos rodadas de auditoria que o resto da base (extremamente polida, confirmado repetidas vezes
nesta sessão).

**Checado:** `admin/config/meu-plano/page.tsx` (6 mudanças, tela de cobrança — maior churn +
domínio sensível), `assinar-plano.tsx`, `cancelar-assinatura.tsx` (fluxo de pagamento MP), e o
`useOptimistic` introduzido em `agenda.tsx`/`detalhe.tsx` (630b7e0f, resposta otimista nas
transições de estado do agendamento).

**Resultado:** nada. Billing trata corretamente app nativo vs. web (T1.5, guideline 3.1.1 da
Apple), idempotência presente nos dois POSTs, paridade de cliques assinar/cancelar documentada e
implementada. `useOptimistic` está com o padrão certo — `aplicarStatusOtimista` chamado DENTRO de
`iniciarTransicao` (`useTransition`), que é a condição para o React reverter sozinho em caso de
falha (sem `onAtualizado()`, a transição termina sem atualizar `resumo`, e o valor otimista some).

**Por que registrar mesmo sem achado:** confirma que a área de maior risco (pagamento) e o padrão
mais novo/arriscado (estado otimista) desta semana estão corretos — não é "não procurei", é
"procurei e está certo". Poupa a próxima sessão de reabrir a mesma suspeita.

---

## 2026-09-20 · Generalização do achado BL-07 e checagem da Central de Ações — sem novo achado

Duas checagens depois de consertar `MoneyInput`:

1. **Os outros 3 componentes de input customizados** (`input.tsx`, `phone-input.tsx`, `select.tsx`)
   não compartilham o defeito do `MoneyInput` — todos eles ficam genuinamente vazios quando o
   estado do chamador começa vazio (string `''`), então `required` nativo funciona normalmente
   neles. O defeito era específico do `MoneyInput` formatar `centavos` como texto SEMPRE ("0,00"),
   não um padrão do design system.

2. **`central-de-acoes.tsx` + `centralDeAcoes` (`crm.ts`)** — lidos de ponta a ponta (as 6 consultas
   paralelas, os 6 cards de ação, a trava de `report:read`, o card de cobrança bloqueado no app
   nativo). Sem achado; já tem histórico de bugs reais corrigidos e documentados inline (limiar de
   pontos que ignorava o prêmio configurável, "147 clientes sumindo" que contava linha em vez de
   cliente). `acoesDeCompletude` — que o próprio código cita como já tendo tido uma guarda "cega"
   (espelhava a fórmula no teste em vez de chamar a função real) — está corrigida: o teste atual
   importa e chama a função de verdade.

Sem mudança de código nesta rodada; confirma que a área investigada está correta.

---

## 2026-09-20 · Varredura de fechamento: todos os usos de `linkWhatsApp` conferidos

Depois de BL-08/BL-09, `grep -rn "linkWhatsApp(" src --include="*.tsx"` achou 7 usos no total. Os
2 já corrigidos; os outros 5 (`[slug]/orcamento/pedido.tsx`, `[slug]/secoes.tsx`, `hoje.tsx`,
mais as duas instâncias já corrigidas de `ficha.tsx`) já usam o padrão certo —
`{link ? <a href={link}>...</a> : null}`, sem fallback `#` nem efeito colateral incondicional.
Confirma que a classe de defeito está fechada nesta base, não só nos dois lugares corrigidos.
