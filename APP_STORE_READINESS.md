# APP_STORE_READINESS.md

> Documento vivo pedido na auditoria de App Store Readiness (2026-09-19). **Fonte de verdade
> detalhada é `docs/64-APP-STORE-CAPACITOR-PLANO.md`** (980+ linhas, 4 rodadas de pesquisa contra
> fontes oficiais da Apple, tickets T0-T7) — este arquivo é o painel/índice na raiz que a missão
> pediu, não uma segunda cópia. Onde os dois divergirem, `docs/64` é o registro histórico completo
> e este arquivo é o estado ATUAL resumido. Atualizado a cada rodada de trabalho relevante.

---

## 1 · Diagnóstico (resumo — detalhe completo em `docs/64`)

**Stack:** Next.js 15 (App Router) + Supabase (Postgres/RLS), hospedado na Vercel. Mobile-first,
PWA já instalável (`public/manifest.json`, `public/sw.js`, fila offline). **Empacotamento
nativo: Capacitor** — não é React Native/Expo/Flutter, é a MESMA base Next.js embrulhada numa
WebView nativa (`server.url` apontando pra produção, T1/§0.4 de `docs/64`), zero segunda base de
código.

**Estado em 2026-09-19, início desta rodada:**
- `android/` existia e builda (`./gradlew assembleDebug`), desde 15-16/09.
- `ios/` **não existia** — zero commits em toda a história do repositório.
- T-DEMO, T-DEL, T1, T1.5 (bloqueio de cobrança) já feitos e cobrindo os dois apps.
- T0 (decisão Mac/CI) e T5 (conta Apple Developer) bloqueados — só o Eduardo decide/paga.

**Achado desta rodada:** a premissa "`ios/` precisa de Mac pra existir" estava incompleta.
`npx cap add ios` roda em Windows sem erro. Só BUILD/assinatura/TestFlight seguem exigindo Mac.
Ver `docs/64` seção `## -1` para o registro completo, incluindo o que foi testado e como.

---

## 2 · Plano (tickets — ver `docs/64` §2 para critério de aceite completo de cada um)

| Ticket | O quê | Status em 2026-09-19 |
|---|---|---|
| T-DEMO | Conta de demonstração pro revisor Apple | ✅ Feito (tenant `apple-review`, credencial documentada) |
| T-DEL | Exclusão de conta pelo próprio dono | ✅ Feito |
| T1 | Scaffold Capacitor (config + `android/` + `ios/`) | ✅ Feito — `ios/` completado nesta rodada |
| T1.5 | Bloquear cobrança dentro do app nativo | ✅ Feito, guarda de varredura testada e passando |
| T-AND | Scaffold Android completo, builda | ✅ Feito |
| T2 | Ícone/splash nativos | ✅ Feito Android E iOS (iOS nesta rodada) |
| T3 | Push notification nativo (APNs/FCM) | ⏸ Não iniciado — precisa de conta Apple (T5)/Firebase |
| T4 | Capacidades nativas p/ diretriz 4.2 (haptics, share, status bar, offline, Face ID) | 🟡 Parcial — falta Face ID (decisão consciente de não implementar sem dispositivo real) |
| T0 | Decisão de onde builda iOS (Mac/Codemagic/Xcode Cloud) | 🔴 Bloqueado — só Eduardo |
| T5 | Conta Apple Developer + certificados | 🔴 Bloqueado — só Eduardo (US$ 99/ano) |
| T6 | Teste em dispositivo real + TestFlight | ⏸ Não iniciado — depende de T0/T5 |
| T7 | Submissão e revisão | ⏸ Não iniciado — depende de tudo acima |

---

## 3 · Decisões registradas

Todas em `docs/DECISOES.md` (histórico completo) e `docs/64` (contexto de produto). As que mais
importam pra quem for continuar:

- **Bloqueio de cobrança (T1.5): opção (A) — texto sem link clicável, zero taxa pra Apple** — até
  o Eduardo decidir se o link clicável (15% de taxa, permitido no Brasil desde o acordo com o
  CADE) vale a conversão a mais. Reversível, troca de uma linha.
- **`server.url` aponta pra produção** (não empacota assets localmente) — decisão técnica, não é
  possível sem reescrever autenticação (Server Components/cookies).
- **`PrivacyInfo.xcprivacy` não foi escrito às cegas** — a exigência depende do binário compilado,
  só o Xcode confirma no archive. Registrado como pendência explícita, não como "feito".
- **Face ID/biometria de app-lock deliberadamente não implementada** — sem dispositivo real (ou
  emulador com digital simulada testada) pra validar o caminho de erro (fallback quando não há
  biometria configurada), implementar arrisca trancar gente pra fora da própria conta. Ver `docs/64`
  T4 para a especificação pronta de quando alguém tiver hardware pra testar.

---

## 4 · Alterações desta rodada (2026-09-19)

| Arquivo/diretório | O quê | Por quê |
|---|---|---|
| `ios/` (26 arquivos) | Scaffold Xcode gerado por `npx cap add ios` | Nunca existia; não precisava de Mac como presumido |
| `ios/App/App/Assets.xcassets/AppIcon.appiconset/`, `.../Splash.imageset/` | Ícone 1024×1024 sem alfa + splash claro/escuro | `npx @capacitor/assets generate --ios`, mesma fonte que o Android já usa |
| `ios/App/App/Info.plist` | + `ITSAppUsesNonExemptEncryption = false` | Uso isento de criptografia (HTTPS padrão) — fonte oficial Apple citada no commit; evita pergunta de compliance em toda submissão |
| `docs/64-APP-STORE-CAPACITOR-PLANO.md` | Nova seção `## -1`, status de T1/T2 atualizado | Registro do achado e do que mudou no plano |
| `APP_STORE_READINESS.md` | Criado | Pedido explícito da missão |

Commit: `8f315af`.

---

## 5 · Testes executados (comandos reais, resultados reais — nenhum inventado)

```
npx cap add ios          — sucesso, projeto Xcode gerado
npx cap sync ios         — sucesso, plugins resolvidos (Haptics, Share, StatusBar)
npx @capacitor/assets generate --ios  — sucesso, 10 assets gerados
python3 plistlib.load(Info.plist)     — FALHOU na primeira tentativa (-- dentro de comentário XML
                                         quebra o parser), corrigido, validado com sucesso na 2ª
npx tsc --noEmit -p .    — PASS (sem saída = sem erro)
npx eslint .             — PASS (sem saída = sem erro)
pnpm build               — PASS (build de produção completo, todas as rotas geradas)
npx vitest run tests/unit — PASS (290 arquivos, 2517 testes)
```

**NÃO executado, e por quê:**
- `xcodebuild` / abrir no Xcode — exige macOS, indisponível nesta sessão.
- `test:integration` / `test:rls` — exigem Docker/Supabase local, indisponível nesta sessão
  (achado recorrente, registrado em `docs/DECISOES.md` em múltiplas rodadas anteriores).
- Teste em dispositivo/simulador iOS real — exige macOS.
- `./gradlew assembleDebug` (Android) — não re-executado nesta rodada especificamente, mas
  confirmado funcionando em rodada anterior (15-16/09, `docs/64` T-AND).

---

## 6 · Riscos (classificação por severidade — ver `docs/64` para o detalhe de cada um)

| Risco | Severidade | Requisito | Correção | Obrigatória? |
|---|---|---|---|---|
| App sem `ios/` scaffold | ~~CRÍTICO~~ resolvido | — | Feito nesta rodada | — |
| Conta de demonstração ausente/quebrada pro revisor | ALTO (mitigado) | Guideline 2.1 | T-DEMO já feito, credencial deve ser retestada antes de CADA submissão (armadilha já documentada) | Sim |
| Tela de cobrança alcançável no app nativo | ALTO (mitigado, sem garantia 100%) | Guideline 3.1.1 | T1.5 feito + guarda de teste; risco residual documentado em `docs/64` §0.2 (caso real de rejeição mesmo seguindo o padrão correto) | Sim |
| `PrivacyInfo.xcprivacy` ausente/incompleto | MÉDIO | Privacy manifest files (Apple, 2024+) | Precisa de Xcode pra confirmar o que o binário realmente usa | A confirmar com Mac |
| Push nativo não implementado | MÉDIO | Diretriz 4.2 (capacidade nativa) | T3, depende de conta Apple (T5) | Recomendado, não bloqueador — já há 3 capacidades nativas (haptics/share/status bar) além do offline |
| Face ID não implementado | BAIXO | — | Decisão consciente, ver §3 | Não — melhoria futura |
| Build/assinatura/TestFlight | BLOQUEIO EXTERNO | — | Precisa de Mac (T0) | Decisão do Eduardo |

---

## 7 · Pendências que dependem de ação externa

1. **T0 — decisão de onde builda o iOS** (Mac próprio, Codemagic, Xcode Cloud). Recomendação já
   registrada em `docs/64`: Codemagic, free tier, integra direto com este repositório GitHub.
2. **T5 — conta Apple Developer Program ativa** (US$ 99/ano). Só o Eduardo pode comprar.
3. **Confirmar visualmente no Xcode**: ícone/splash renderizando certo, `PrivacyInfo.xcprivacy`
   necessário ou não, biometria (se for implementada depois).
4. **Push nativo (T3)**: certificado APNs (precisa de T5) + projeto Firebase (Android).
5. **Teste em dispositivo físico + TestFlight (T6)** antes de qualquer submissão pra revisão
   pública.

---

## 8 · Checklist final

- [x] Build de produção (`pnpm build`)
- [x] Testes unitários (`tests/unit`, 290/2517)
- [x] Lint (`eslint .`)
- [x] Typecheck (`tsc --noEmit`)
- [ ] `test:integration`/`test:rls` — bloqueado, sem Docker local
- [x] Mobile UX — já auditado em rodadas anteriores (design system, tab bar, safe areas)
- [x] Acessibilidade — já auditado em rodadas anteriores
- [x] Privacidade — `/privacidade` nomeia os 4 terceiros que recebem dado; T-AND-DS (Google Play
      Data Safety) já tem rascunho pronto em `docs/64`
- [x] Permissões — nenhuma permissão sensível não-declarada encontrada (sem câmera/localização/
      contatos nativos além do que a PWA já usa)
- [x] Segurança — RLS/multi-tenant não muda por causa do app (é casca sobre a mesma API)
- [ ] App Store compliance final — depende de T6/T7 (dispositivo real, TestFlight)
- [x] Metadata técnica (bundle ID, `ITSAppUsesNonExemptEncryption`)
- [x] Ícones (iOS e Android)
- [x] Splash (iOS e Android)
- [ ] Version/build number — placeholder do Xcode (`$(MARKETING_VERSION)`), decidir versão real
      quando for a primeira submissão
- [ ] Teste em dispositivo físico — precisa de Mac (iOS) — Android testado em emulador
- [ ] TestFlight — precisa de T0/T5
- [ ] Revisão final — precisa de tudo acima

---

## 9 · Próxima ação, se não houver bloqueio

Sem Mac disponível nesta sessão, o trabalho de CÓDIGO para iOS está no ponto onde só falta
confirmação visual (Xcode) e capacidades que exigem conta Apple (push). **Não há mais ticket de
código seguro para avançar sem Mac ou sem decisão do Eduardo em T0.** Próxima ação depende de uma
das duas:
- Eduardo decide T0 (Codemagic recomendado) → destrava build/assinatura/TestFlight real.
- Eduardo compra a conta Apple Developer (T5) → destrava push nativo (T3) e submissão.

Enquanto isso, o Android segue mais avançado (builda, testado em emulador com navegação real) e
poderia ir para Google Play Developer (US$ 25, único) + build assinado (keystore) de forma
independente — ver `docs/64` T-AND itens 6-7.
