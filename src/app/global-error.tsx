'use client'

import { useEffect } from 'react'

/**
 * TICKET-057. Só dispara quando o próprio `layout.tsx` quebra — por isso tem o `<html>/<body>`
 * próprio, sem poder reusar nada do resto do app. `Sentry` pede este arquivo para capturar erro de
 * renderização do React que nenhum `error.tsx` de rota alcança.
 *
 * O `import()` dentro do efeito existe pelo mesmo motivo de `src/instrumentation-client.ts`: com
 * `import` no topo, `@sentry/nextjs` entra no grafo estático e volta para o chunk compartilhado de
 * toda tela — o que anularia a economia de 129 kB pelo caminho de trás. Aqui o SDK só é buscado
 * quando o app inteiro já quebrou, que é o único momento em que este arquivo roda; um round-trip a
 * mais nesse instante não custa nada. Guardado pelo DSN pela mesma razão: sem destino configurado,
 * baixar o SDK para reportar num vazio seria pagar a rede duas vezes por nada.
 *
 * ---
 *
 * **O que mudou em 2026-09-03, e por que é a mesma correção duas vezes.** Este arquivo renderizava
 * `<NextError statusCode={0} />`, a página crua do Next. O docstring do `src/app/error.tsx` descreve
 * exatamente essa tela como o defeito que ELE foi criado para consertar: *"em inglês, fundo branco,
 * sem saída — dentro de um app que é preto, em português e mobile-first"*. O conserto foi aplicado
 * nos boundaries de rota e a página crua ficou de pé um nível acima, no boundary de último recurso,
 * que é justamente onde a pessoa está mais presa.
 *
 * **Estilo em linha, e não classe do Tailwind, é obrigatório aqui.** Este componente substitui o
 * `layout.tsx` — e é o layout que importa o `globals.css`. Uma tela de último recurso que depende
 * da folha de estilo do app pode aparecer sem estilo nenhum exatamente no momento em que ela é a
 * única coisa na tela. Os valores são os tokens da casa escritos à mão, de propósito.
 *
 * As duas saídas seguem a mesma regra dos outros boundaries: `reset()` para a falha transitória, e
 * navegação de PÁGINA INTEIRA para escapar de um estado que não se recupera sozinho.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return
    void import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error))
  }, [error])

  const botao: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    padding: '0 20px',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
  }

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, backgroundColor: '#0d0c0c', color: '#f5f3f1', fontFamily: 'system-ui, sans-serif' }}>
        <main
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>O CICLO não conseguiu abrir</h1>
          <p style={{ maxWidth: '34ch', margin: 0, fontSize: 15, lineHeight: 1.5, color: '#99938c' }}>
            Foi uma falha ao carregar a tela, não nos seus dados. Nada do que você salvou foi perdido.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 12 }}>
            <button type="button" onClick={() => reset()} style={{ ...botao, backgroundColor: '#14b8a6', color: '#0d0c0c', border: 'none' }}>
              Tentar de novo
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
                Aqui `<Link>` não é só pior, é impossível de confiar: este componente substitui o
                `layout.tsx`, ou seja roda quando o runtime do app já quebrou. Navegação de página
                inteira é a única saída que não depende do que acabou de falhar. */}
            <a href="/" style={{ ...botao, backgroundColor: '#1a1918', color: '#f5f3f1', border: '1px solid #2b2927' }}>
              Ir para o início
            </a>
          </div>
        </main>
      </body>
    </html>
  )
}
