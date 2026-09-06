/**
 * A folha nativa de compartilhamento rejeita a promessa em dois casos que não têm nada a ver um
 * com o outro, e o componente tratava os dois igual.
 *
 * **Cancelar** é o caminho normal: a pessoa abriu a folha, mudou de ideia, fechou. Não há nada a
 * avisar — mostrar erro aí seria culpar alguém por desistir. O navegador sinaliza isso com
 * `AbortError`.
 *
 * **Falhar** é outra coisa: contexto sem HTTPS, permissão negada, `navigator.share` presente mas
 * inoperante no aparelho. Aí a pessoa apertou o botão e merece o resultado por outro caminho — a
 * área de transferência, que já existe como plano B.
 *
 * `catch { return }` tratava os dois como cancelamento, e o efeito era um botão morto: quem
 * caísse no segundo caso apertava e não acontecia nada, sem erro, sem link, sem explicação. É a
 * forma de falha silenciosa que o `docs/21-AUDITORIA-FALHA-SILENCIOSA.md` cataloga como "catch que
 * descarta" — a mais difícil de ver em produção, porque não deixa rastro nenhum.
 *
 * Isto vive em `core/` e não no componente porque o ambiente de teste deste projeto é `node`, sem
 * DOM: a decisão precisa ser uma função pura para poder ser testada de verdade (regra 5 do
 * `CLAUDE.md`). O componente fica só com o efeito.
 */
export function ehCancelamentoDoUsuario(erro: unknown): boolean {
  /*
   * A checagem é pelo NOME, não por `instanceof DOMException`: Safari e alguns WebViews rejeitam
   * com um objeto que não é `DOMException`, e `instanceof` daria falso para um cancelamento
   * legítimo — o que faria a folha cancelada cair na área de transferência e anunciar "link
   * copiado" para quem acabou de desistir.
   */
  return typeof erro === 'object' && erro !== null && 'name' in erro && (erro as { name?: unknown }).name === 'AbortError'
}
