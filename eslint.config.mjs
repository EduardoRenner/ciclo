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
       * `supabase start` escreve aqui os segredos e o runtime das Edge Functions — código
       * MINIFICADO de terceiro, que o `.gitignore` já esconde do git mas o ESLint continuava
       * varrendo. Medido em 2026-09-10, ao montar o ambiente local pela primeira vez: 154 erros
       * de `prefer-const` em nomes de uma letra, todos vindos de um `index.ts` gerado.
       *
       * O efeito é pior que o ruído: `supabase start` é o passo que o CLAUDE.md manda dar ANTES
       * do `pnpm dev`, então quem monta o ambiente do jeito documentado ganha um `pnpm verify`
       * quebrado por código que não é dele. A CI não via porque lá o `lint` roda antes do
       * `supabase start`.
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
