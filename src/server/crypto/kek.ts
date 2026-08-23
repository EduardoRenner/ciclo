import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import { deBytea, paraBytea } from '@/server/crypto/bytea'

/**
 * Só o envelope da chave (§8: "KEK → DEK por tenant, gerada no onboarding,
 * guardada CIFRADA em tenant_keys"). O `encryptVault`/`decryptVault` que cifra
 * registro por registro com a DEK é módulo à parte, do TICKET-049 — aqui só
 * nasce e embrulha a DEK; ela não decifra nada ainda.
 */

const TAMANHO_DEK = 32 // AES-256
const TAMANHO_IV = 12 // padrão do GCM
const TAMANHO_TAG = 16

function decodificarKek(bruta: string, nome: string): Buffer {
  const chave = Buffer.from(bruta, 'base64')
  if (chave.length !== TAMANHO_DEK) {
    throw new Error(`${nome} precisa decodificar para 32 bytes; tem ${chave.length}.`)
  }
  return chave
}

/**
 * A KEK que EMBRULHA. Sempre a atual — nada novo nasce protegido pela chave velha.
 *
 * O override existe pelo mesmo motivo do `segredo?` de `token-assinado.ts`: no Vitest, arquivos
 * de teste diferentes rodam em threads que **compartilham `process.env` por referência**, então
 * um teste que troca a KEK temporariamente vaza para outro arquivo rodando em paralelo. Injetar
 * é a forma de testar rotação sem mutar ambiente global.
 */
function kek(override?: string): Buffer {
  const bruta = override ?? process.env.VAULT_KEK
  if (!bruta) throw new Error('VAULT_KEK ausente — sem ela nenhum tenant novo pode gerar cofre.')
  return decodificarKek(bruta, 'VAULT_KEK')
}

/**
 * As KEKs que ABREM, da atual para a anterior (auditoria de segurança, achado S8).
 *
 * Antes existia só a atual, e isso tornava a rotação impossível na prática: trocar `VAULT_KEK`
 * fazia o GCM falhar na autenticação de **todo** `dek_wrapped`, e nenhuma anamnese de nenhum
 * tenant voltava a abrir. O `.env.example` avisava que perder a chave é perder o cofre inteiro;
 * o que não estava dito é que **rotacionar tinha o mesmo efeito que perder**. Na prática, a
 * resposta correta a um vazamento da KEK — rotacionar — era destruir o dado, e a alternativa
 * era conviver com a chave comprometida. Nenhum time deveria ter que escolher entre as duas.
 *
 * `VAULT_KEK_PREVIOUS` é o mesmo desenho que a correção do S1 já usou para os links públicos:
 * assina com a nova, aceita as duas enquanto houver material antigo em circulação. Aqui o
 * "material antigo" é `tenant_keys.dek_wrapped`, e quem o converte é
 * `scripts/rotacionar-kek.mjs`. Depois que ele roda para todos os tenants,
 * `VAULT_KEK_PREVIOUS` pode sair do ambiente.
 */
function keksDeAbertura(override?: string[]): { chave: Buffer; nome: string }[] {
  if (override) return override.map((bruta, i) => ({ chave: decodificarKek(bruta, `kek[${i}]`), nome: `kek[${i}]` }))

  const chaves = [{ bruta: process.env.VAULT_KEK, nome: 'VAULT_KEK' }, { bruta: process.env.VAULT_KEK_PREVIOUS, nome: 'VAULT_KEK_PREVIOUS' }]
    .filter((c): c is { bruta: string; nome: string } => !!c.bruta)
    .map((c) => ({ chave: decodificarKek(c.bruta, c.nome), nome: c.nome }))

  if (chaves.length === 0) throw new Error('VAULT_KEK ausente — sem ela nenhum cofre abre.')
  return chaves
}

function versaoKek(): number {
  const v = Number(process.env.VAULT_KEK_VERSION ?? '1')
  return Number.isInteger(v) && v > 0 ? v : 1
}

/**
 * Embrulha uma DEK (nova ou já existente) pela KEK atual — pronta para
 * `tenant_keys.dek_wrapped`. `rewrapDek` é o que a rotação anual da KEK usa
 * (§8): a DEK do tenant não muda, só a chave que a protege; reaproveitar essa
 * função para os dois casos evita duas implementações do mesmo envelope.
 */
export function rewrapDek(dek: Buffer, kekOverride?: string): { wrapped: string; keyVersion: number } {
  const iv = randomBytes(TAMANHO_IV)

  const cifra = createCipheriv('aes-256-gcm', kek(kekOverride), iv)
  const ciphertext = Buffer.concat([cifra.update(dek), cifra.final()])
  const tag = cifra.getAuthTag()

  // iv || tag || ciphertext num bytea só: mais simples que três colunas, e o
  // tamanho de cada pedaço é fixo, então separar de volta não precisa de delimitador.
  return { wrapped: paraBytea(Buffer.concat([iv, tag, ciphertext])), keyVersion: versaoKek() }
}

/** Gera a DEK do tenant já cifrada pela KEK — pronta para `tenant_keys.dek_wrapped`. */
export function gerarDekCifrada(): { wrapped: string; keyVersion: number } {
  return rewrapDek(randomBytes(TAMANHO_DEK))
}

/**
 * Volta a DEK em claro, tentando a KEK atual e depois a anterior (S8).
 *
 * Ao contrário da verificação de token do S1 — que confere TODAS as chaves mesmo depois de uma
 * bater, para o tempo de resposta não revelar qual assinou — aqui sair na primeira que abre é
 * correto: isto roda no servidor, com um `dek_wrapped` que só o próprio servidor leu do banco,
 * e não há atacante do outro lado cronometrando. O que existiria de fato, se tentasse todas,
 * seria uma operação de AES a mais por chamada, sem ganho nenhum.
 */
export function abrirDekCifrada(wrapped: string, keksOverride?: string[]): Buffer {
  const bruto = deBytea(wrapped)
  const iv = bruto.subarray(0, TAMANHO_IV)
  const tag = bruto.subarray(TAMANHO_IV, TAMANHO_IV + TAMANHO_TAG)
  const ciphertext = bruto.subarray(TAMANHO_IV + TAMANHO_TAG)

  let ultimoErro: unknown
  for (const { chave } of keksDeAbertura(keksOverride)) {
    try {
      const decifra = createDecipheriv('aes-256-gcm', chave, iv)
      decifra.setAuthTag(tag)
      return Buffer.concat([decifra.update(ciphertext), decifra.final()])
    } catch (erro) {
      // Tag que não bate é o caso normal de "esta não é a chave certa" — segue para a próxima.
      ultimoErro = erro
    }
  }

  // Nenhuma abriu. A mensagem não pode entregar qual chave existe no ambiente, mas precisa
  // dizer a coisa certa para quem está de plantão: quase sempre é rotação feita sem re-embrulho.
  throw new Error(
    'Não foi possível abrir a DEK com nenhuma KEK do ambiente. Se a VAULT_KEK foi rotacionada, ' +
      'defina VAULT_KEK_PREVIOUS e rode scripts/rotacionar-kek.mjs.',
    { cause: ultimoErro },
  )
}
