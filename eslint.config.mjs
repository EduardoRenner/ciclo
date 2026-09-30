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
      /*
       * T1/T-AND (docs/64-APP-STORE-CAPACITOR-PLANO.md, critério de aceite #4): `android/` e
       * `ios/` são gerados pelo `npx cap add`/`cap sync`, nunca escritos à mão, e o `next build`
       * da Vercel nunca lê nada aqui dentro. Medido ao rodar `./gradlew assembleDebug` pela
       * primeira vez: o build nativo copia o bridge JS minificado do Capacitor pra dentro de
       * `android/app/build/`, e sem esta exclusão o ESLint varria esse arquivo de terceiro
       * (16 avisos, mesma classe de ruído que `supabase/.temp/**` já resolveu acima).
       */
      "android/**",
      "ios/**",
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

  // BL-42: writeAudit precisa estar dentro do fechamento de comIdempotencia (ver eslint-rules/index.mjs).
  // "error" desde 2026-09-28: as 50 rotas de src/app/api/v1 que combinavam comIdempotencia +
  // writeAudit foram corrigidas (10 rodadas), `pnpm lint` não acusa mais nenhuma. Começou em "warn"
  // enquanto o trabalho estava em andamento — "error" agora é o passo final do BL-42: qualquer
  // rota nova (ou regressão numa já corrigida) quebra `pnpm verify` por construção, em vez de
  // depender de alguém lembrar de revisar.
  {
    files: ["src/app/api/v1/**"],
    plugins: { ciclo },
    rules: {
      "ciclo/writeaudit-dentro-do-idempotente": "error",
    },
  },

  // (c) dinheiro sempre em centavos inteiros, percentual sempre em basis points inteiros —
  // CLAUDE.md regra 3 (ver eslint-rules/index.mjs). "error" desde o nascimento: varredura de
  // 2026-09-28 não achou nenhum campo *Cents/*Bps existente que aceitasse fração, então não há
  // "warn" de transição — só regressão futura para impedir.
  {
    plugins: { ciclo },
    rules: {
      "ciclo/dinheiro-em-centavos-inteiros": "error",
    },
  },

  // (d) nunca DELETE em agendamento/movimento de estoque/auditoria — CLAUDE.md regra 11 (ver
  // eslint-rules/index.mjs). "error" desde o nascimento no CÓDIGO DO APP: varredura de 2026-09-28
  // não achou nenhuma ocorrência em src/. `tests/**`/`scripts/**` ficam de fora, mesmo escopo de
  // (a) acima: o próprio teste de RLS PRECISA chamar `.delete()` pra provar que o banco bloqueia
  // (`tests/rls/append-only-nao-se-apaga.test.ts`), testes de integração limpam fixture entre casos
  // (`resumo-hoje.test.ts`), e scripts de seed recriam dado de demonstração do zero.
  {
    plugins: { ciclo },
    rules: {
      "ciclo/sem-delete-em-tabela-append-only": "error",
    },
  },
  {
    files: ["tests/**", "scripts/**"],
    rules: {
      "ciclo/sem-delete-em-tabela-append-only": "off",
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
