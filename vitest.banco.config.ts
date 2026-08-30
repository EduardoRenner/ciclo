import { fileURLToPath } from 'node:url'

import { defineConfig, mergeConfig } from 'vitest/config'

import base from './vitest.config'

/**
 * A configuração das suítes que ABREM O BANCO (`tests/integration` e `tests/rls`). A única
 * diferença para a base é o `setupFiles`, que recusa rodar contra um Supabase que não seja o
 * local — ver `tests/setup/so-banco-local.ts` para o porquê.
 *
 * Mora num arquivo separado, e não na `vitest.config.ts`, porque `tests/unit` não abre banco
 * nenhum e não deve pagar por essa checagem nem carregar `.env.local`.
 */
export default mergeConfig(
  base,
  defineConfig({
    test: { setupFiles: [fileURLToPath(new URL('./tests/setup/so-banco-local.ts', import.meta.url))] },
  }),
)
