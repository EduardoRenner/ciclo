/** Literal hex de bytea que o PostgREST espera (`\x` + hex) — é como o schema grava binário. */
export function paraBytea(buf: Buffer): string {
  return `\\x${buf.toString('hex')}`
}

export function deBytea(literal: string): Buffer {
  return Buffer.from(literal.replace(/^\\x/, ''), 'hex')
}
