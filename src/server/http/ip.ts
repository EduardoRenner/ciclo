/** Primeiro IP do `X-Forwarded-For`; os seguintes são proxy. Sem header, cai num balde único — mais restritivo, não mais permissivo. */
export function ipDe(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'sem-ip'
}
