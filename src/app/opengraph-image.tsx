import { ImageResponse } from 'next/og'

/**
 * A prévia que aparece quando o link do CICLO é colado no WhatsApp, no Instagram ou num grupo.
 *
 * Gerada, e não um PNG em `public/`, por um motivo medido: os dois arquivos de marca que existem
 * são 1102×448 (2,46:1) e 894×950 (0,94:1), e o formato que as redes cortam é 1200×630 (1,91:1).
 * Usar qualquer um deles direto entrega o logo cortado ou espremido — que num canal de aquisição
 * boca a boca entre profissionais é pior do que não ter prévia.
 *
 * Cores cravadas de propósito: aqui não há CSS nem variável de tema, e `--acc` do `globals.css`
 * não existe neste contexto de renderização. São os mesmos valores (#0d0c0c do `themeColor` e
 * #14b8a6 do `--acc`), e a guarda em `tests/unit/design/og-usa-a-cor-da-marca.test.ts` reprova se
 * um dos dois mudar sem o outro.
 */
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'CICLO: a agenda que avisa quem parou de voltar'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#0d0c0c',
          padding: '72px 80px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 24, height: 24, borderRadius: 999, background: '#14b8a6' }} />
          <div style={{ fontSize: 40, color: '#14b8a6', letterSpacing: 6, fontWeight: 700 }}>CICLO</div>
        </div>

        <div style={{ fontSize: 74, color: '#f5f5f4', fontWeight: 700, lineHeight: 1.1, marginTop: 36 }}>
          A agenda que avisa quem parou de voltar
        </div>

        <div style={{ fontSize: 34, color: '#a8a29e', marginTop: 28, lineHeight: 1.35 }}>
          Agenda, site de agendamento e caixa para quem atende com hora marcada.
        </div>
      </div>
    ),
    size,
  )
}
