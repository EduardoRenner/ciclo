const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Monta o filtro `.or('coluna.eq.<id>,coluna.is.null')` conferindo que o id é mesmo um UUID.
 *
 * ## Por que validar de novo aqui (auditoria de segurança de 31/08/2026)
 *
 * `.or()` do PostgREST recebe uma **string de consulta**, não parâmetro ligado: o valor é
 * concatenado direto na gramática de filtro. Seis lugares desta base montavam
 * `` `professional_id.eq.${id},professional_id.is.null` `` com interpolação crua.
 *
 * Hoje nenhum deles é explorável — os três de `agendamentos.ts` recebem um id que o Zod já
 * validou como `z.uuid()` na borda da rota, e os outros três leem o id de uma linha do próprio
 * banco. **Mas a segurança estava inteira do lado de fora da função**: dependia de cada um dos
 * chamadores, presentes e futuros, lembrar de validar. Um `professionalId` que chegasse como
 * texto livre — de um parâmetro novo, de uma ferramenta do assistente, de um script interno —
 * viraria vírgula e ponto na gramática do filtro, e daria para pendurar condição extra numa
 * consulta que decide o que a pessoa enxerga.
 *
 * Este arquivo move a checagem para o lugar onde o valor vira sintaxe. É a mesma disciplina de
 * "nunca confie no tenant_id do corpo" do CLAUDE.md, aplicada ao id que vira string de filtro.
 *
 * Lança em vez de devolver filtro vazio de propósito: filtro vazio é `.or()` inválido ou, pior,
 * consulta sem a trava que ela deveria ter — falhar alto é o comportamento seguro.
 */
export function ouDoProfissionalOuGeral(coluna: 'professional_id', id: string): string {
  if (!UUID.test(id)) {
    throw new Error(`${coluna}: id inválido para filtro — esperado UUID, veio ${JSON.stringify(id).slice(0, 60)}`)
  }
  return `${coluna}.eq.${id},${coluna}.is.null`
}
