# Achados de UX/UI — evolução autônoma do produto

> Observações de uso real (navegador, jornadas completas), não leitura de código. Ver
> `discoveries.md` para achados que exigiram investigação de código; aqui é o que se vê usando.

---

## 2026-09-20 · Painel "Hoje" (mobile, conta demo) — boa primeira impressão

Login como `dono-demo-dom-estilo@ciclo.app`, viewport 375×812 (mobile).

**Positivo, vale registrar para não re-auditar depois:**
- Hierarquia clara: saudação → valor a recuperar em destaque → cartões de ação priorizados
  ("Vale a pena hoje") com contagem + explicação + CTA, nunca só um número solto.
- Botão de ação flutuante (assistente IA, ícone de estrela) não compete com a tab bar — fica acima
  dela, canto inferior direito, sem sobrepor os itens da barra.
- Estado "Nada mais para hoje" tem DUAS saídas (Novo agendamento / Compartilhar link), não é uma
  tela morta.
- Cartão "Estoque" só aparece quando há produto no ponto de recompra — não polui quando não há
  nada a fazer.

**A investigar (não é bug confirmado, é hipótese a validar):** o cartão "O Motor acertou X% dos
retornos previstos" fica no fim da rolagem de "Hoje", sem contexto — quem não sabe o que "acertar"
significa aqui vê só um número. Levou a abrir `/admin/recuperar` para entender (o que revelou o
achado de `discoveries.md`, BL-01). Possível melhoria de copy: o teaser poderia dizer "sobre quê" em
uma linha, mesmo resumido — mas isso é secundário ao achado de fundo (o número em si está
estruturalmente garantido a ser ruim nesta conta específica).
