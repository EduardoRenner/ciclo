/**
 * Monta o endereço público de uma imagem de vitrine (logo, capa) a partir da chave guardada em
 * `settings.site`.
 *
 * Existe pelo mesmo motivo de `urlDoInstagram`: endereço montado em mais de um lugar diverge. Aqui
 * o risco é maior, porque são DOIS pedaços que precisam concordar — a origem do Supabase e o nome
 * do bucket —, e um erro em qualquer um deles não dá erro: dá imagem quebrada, que é o defeito que
 * ninguém vê no teste e todo mundo vê na página.
 *
 * O banco guarda a CHAVE (`{tenantId}/{uuid}.webp`), nunca a URL inteira. A origem vive em
 * `NEXT_PUBLIC_SUPABASE_URL` e muda de projeto para projeto — gravar a URL completa faria toda
 * imagem apontar para o projeto antigo depois de qualquer restauração de banco em outro lugar,
 * inclusive nos forks desta base.
 *
 * Fica em `core/` (puro, sem I/O) e NÃO importa nada de `server/`: a página pública do salão lê
 * isto, e um caminho de import daqui até `media-upload.ts` arrastaria os 19,2 MB do `sharp` para o
 * pacote da rota — ver `tests/unit/server/sharp-so-onde-precisa.test.ts`.
 */

/** O bucket público criado na migration 0051. Privado é o `media`, que guarda foto de cliente. */
const BUCKET = 'vitrine'

/**
 * `null` quando não há imagem — a tela decide o que desenhar no lugar. Devolver string vazia faria
 * um `<img src="">` que o navegador resolve como "recarregue a página atual", baixando o HTML
 * inteiro de novo como se fosse imagem.
 */
export function urlDaVitrine(chave: string | null | undefined): string | null {
  if (!chave) return null

  const origem = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!origem) return null

  return `${origem.replace(/\/+$/, '')}/storage/v1/object/public/${BUCKET}/${chave}`
}
