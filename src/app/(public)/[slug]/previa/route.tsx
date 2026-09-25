import { ImageResponse } from 'next/og'

import { perfilPublico } from '@/server/services/public-booking'

/**
 * A prévia do link de agendamento quando o negócio ainda não tem capa nem logo — `docs/82` §15.
 *
 * O link que o dono cola na bio e manda no WhatsApp é o canal de aquisição dele (e, pelo selo, o
 * do CICLO). Medido em 2026-09-23: uma conta nova, sem foto, compartilhava o link SEM imagem — o
 * WhatsApp mostrava um cartão só de texto, pequeno, fácil de passar batido. Toda conta nova está
 * nesse caso.
 *
 * Rota e não `opengraph-image.tsx` de propósito: metadado de arquivo tem prioridade sobre o
 * `generateMetadata`, então um `opengraph-image` aqui passaria por cima da capa de quem subiu uma.
 * A página só aponta para cá quando não há capa nem logo.
 *
 * A marca é a do NEGÓCIO (nome e cor dele). O CICLO aparece só no rodapé, e só enquanto o plano
 * mostra o selo — a mesma regra do rodapé da página (`perfil.mostrarSelo`).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const perfil = await perfilPublico(slug).catch(() => null)
  if (!perfil) return new Response('Não encontrado', { status: 404 })

  const imagem = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#0d0c0c',
          padding: '72px 80px',
        }}
      >
        <div style={{ display: 'flex', width: 96, height: 12, borderRadius: 999, background: perfil.accentColor.acc }} />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: perfil.name.length > 28 ? 64 : 84, color: '#f5f5f4', fontWeight: 700, lineHeight: 1.08 }}>
            {perfil.name}
          </div>
          <div style={{ fontSize: 40, color: perfil.accentColor.acc, marginTop: 28, fontWeight: 600 }}>Agende seu horário pelo link</div>
          <div style={{ fontSize: 30, color: '#a8a29e', marginTop: 14 }}>Escolha o serviço e o horário. Sem baixar aplicativo.</div>
        </div>

        <div style={{ display: 'flex', fontSize: 24, color: '#78716c' }}>{perfil.mostrarSelo ? 'Feito com CICLO' : ' '}</div>
      </div>
    ),
    { width: 1200, height: 630 },
  )

  // Nome e cor mudam raramente; o WhatsApp guarda a prévia por conta própria de qualquer jeito.
  imagem.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400')
  return imagem
}
