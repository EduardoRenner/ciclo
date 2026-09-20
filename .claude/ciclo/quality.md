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
