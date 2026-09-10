import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

import ciclo from "./eslint-rules/index.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "src/server/db/types.gen.ts",
      /*
        Gerado pelo `supabase start`, e é isto que ele custava: o `CLAUDE.md` manda subir o banco
        local antes do `pnpm dev`, e o `supabase start` escreve o bootstrap do edge runtime aqui.
        São 154 erros de lint em código que não é nosso — e como `pnpm verify` roda lint, seguir o
        setup documentado do projeto passava a REPROVAR o próprio portão de pré-commit.

        A CI nunca viu: `qualidade` (typecheck + lint) e `Banco e RLS` (que roda `supabase start`)
        são jobs separados, em contêineres separados. Verde lá, vermelho em toda máquina de quem
        desenvolve — a direção mais cara de um falso verde.

        Já estava no `.gitignore` desde sempre. As duas listas discordavam sobre o mesmo diretório.
      */
      "supabase/.temp/**",
    ],
  },

  // (c) nada de `any` — CLAUDE.md regra 8
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },

  // (a) service_role confinado ao wrapper — CLAUDE.md regra 2
  {
    plugins: { ciclo },
    rules: {
      "ciclo/service-client-confinado": "error",
    },
  },
  {
    // o teste de isolamento precisa da service_role para montar dois tenants, e os scripts de
    // manutenção (semear demonstração) rodam fora do app, na mão, sem sessão de usuário nenhuma
    files: ["tests/**", "scripts/**"],
    rules: {
      "ciclo/service-client-confinado": "off",
    },
  },

  // (b) core/ é regra de negócio pura — CLAUDE.md regra 5
  {
    files: ["src/core/**/*.ts", "src/core/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/server",
                "@/server/*",
                "@/app",
                "@/app/*",
                "@/components",
                "@/components/*",
                "**/server/*",
                "**/app/*",
              ],
              message:
                "core/ não importa de server/ nem de app/. É o que torna a regra de negócio testável sem banco.",
            },
            {
              group: [
                "next",
                "next/*",
                "react",
                "react-dom",
                "@supabase/*",
                "node:*",
                "fs",
                "fs/*",
                "path",
                "crypto",
                "http",
                "https",
                "net",
                "dns",
                "child_process",
              ],
              message:
                "core/ é função pura, sem I/O: nada de Next, React, Supabase ou módulo de sistema.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
