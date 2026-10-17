/**
 * CNV-018 · Copia o leitor de texto de imagem (tesseract.js 7, Apache-2.0) e o português (`por`, MIT)
 * para `public/ocr/`, de onde o navegador os baixa no PRÓPRIO domínio — nada de CDN de terceiros
 * (privacidade, `docs/97` §7) e a CSP `worker-src 'self'` aceita o worker.
 *
 * Roda antes do `dev` e do `build` (package.json). A pasta é gerada, não versionada (.gitignore).
 * Só as variantes LSTM do motor (`createWorker('por', 1)` usa o LSTM): ~3,9 MB cada, o navegador
 * baixa UMA, a que o aparelho suporta.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const destino = join(process.cwd(), 'public', 'ocr')
mkdirSync(destino, { recursive: true })

const raizDoTesseract = dirname(require.resolve('tesseract.js/package.json'))
const raizDoMotor = dirname(require.resolve('tesseract.js-core/package.json', { paths: [raizDoTesseract] }))
const raizDoIdioma = dirname(require.resolve('@tesseract.js-data/por/package.json'))

const copias = [
  [join(raizDoTesseract, 'dist', 'worker.min.js'), 'worker.min.js'],
  [join(raizDoMotor, 'tesseract-core-lstm.wasm.js'), 'tesseract-core-lstm.wasm.js'],
  [join(raizDoMotor, 'tesseract-core-simd-lstm.wasm.js'), 'tesseract-core-simd-lstm.wasm.js'],
  [join(raizDoMotor, 'tesseract-core-relaxedsimd-lstm.wasm.js'), 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  [join(raizDoIdioma, '4.0.0_best_int', 'por.traineddata.gz'), 'por.traineddata.gz'],
]

for (const [origem, nome] of copias) {
  if (!existsSync(origem)) {
    console.error(`copiar-ocr: não achei ${origem}. Rode pnpm install.`)
    process.exit(1)
  }
  copyFileSync(origem, join(destino, nome))
}
console.log(`copiar-ocr: ${copias.length} arquivos em public/ocr`)
