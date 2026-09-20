/**
 * IP de quem chamou, para as chaves do limitador (auditoria de segurança, achado S6).
 *
 * A versão anterior lia o **primeiro** elemento de `X-Forwarded-For`. Esse é justamente o valor
 * que o cliente controla quando o proxy *acrescenta* o IP real ao final: trocar o header a cada
 * requisição daria um balde novo no limitador toda vez, e todo limite por IP do projeto viraria
 * enfeite. Atrás de exatamente um proxy confiável, o valor certo é o mais à **direita**.
 *
 * A ordem aqui é da fonte mais confiável para a menos:
 *
 * 1. `x-vercel-forwarded-for` — carimbado pela borda da Vercel, documentado como não forjável;
 * 2. `x-real-ip` — também posto pela infraestrutura, não pelo cliente;
 * 3. o **último** elemento de `x-forwarded-for` — em cadeia com um proxy, é o que ele anexou;
 * 4. `sem-ip`, um balde único — mais restritivo, nunca mais permissivo.
 *
 * O login não depende disto: quem limita tentativa de senha é o próprio Supabase Auth, do lado
 * dele (a rota só traduz o 429). Isto aqui protege o agendamento público e o teto global.
 */
export function ipDe(req: Request): string {
  return ipConfiavelOuNulo(req) ?? 'sem-ip'
}

/**
 * A mesma cadeia de confiança de {@link ipDe}, mas devolvendo `null` em vez de `'sem-ip'`.
 *
 * Existe separada porque as trilhas de auditoria e acesso (`audit_log.ip`, `anamnesis_access_log`,
 * etc.) gravam em coluna `inet` **nullable** — `'sem-ip'` não é sintaxe válida de `inet`, e cairia
 * silenciosamente no `catch` que essas trilhas têm justamente para não derrubar a operação que
 * originou o registro. `null` é o valor correto para "não deu para saber o IP" nessas colunas.
 */
export function ipConfiavelOuNulo(req: Request): string | null {
  const daBorda = req.headers.get('x-vercel-forwarded-for')?.trim()
  if (daBorda) return daBorda

  const real = req.headers.get('x-real-ip')?.trim()
  if (real) return real

  const encadeado = req.headers.get('x-forwarded-for')
  if (encadeado) {
    const partes = encadeado.split(',').map((p) => p.trim()).filter(Boolean)
    const ultimo = partes[partes.length - 1]
    if (ultimo) return ultimo
  }

  return null
}
