/**
 * Gera e sobe as imagens de vitrine das contas de demonstração (SLUGS_DE_DEMONSTRACAO).
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-demo-imagens.mjs
 *
 * ── O que este script NÃO faz, e por quê ────────────────────────────────────────────────────
 *
 * Não inventa FOTOGRAFIA. Não existe foto do salão "Dom Estilo" porque não existe o salão, e não
 * existe retrato do "Diego Martins" porque não existe o Diego. Semear uma imagem que se apresenta
 * como foto de um lugar ou de uma pessoa reais é outra categoria de dado falso — a demonstração
 * passaria a afirmar algo sobre o mundo, não só a exercitar uma tela.
 *
 * O que ele gera são ATIVOS DE MARCA de verdade, do tipo que um negócio usa antes de ter foto
 * profissional: monograma como logo, faixa com a cor do negócio como capa, e avatar de iniciais
 * para cada profissional — que é exatamente o que todo SaaS desenha enquanto ninguém subiu nada.
 *
 * A funcionalidade demonstrada é a mesma: a imagem sobe pelo painel, vira chave no bucket e
 * aparece na página que a cliente abre. Quem quiser foto de verdade sobe pelo painel, que é o
 * ponto.
 *
 * ── Contrato ────────────────────────────────────────────────────────────────────────────────
 *
 * Espelha `src/server/services/vitrine-upload.ts`: bucket `vitrine` (público, migration 0051),
 * chave `{tenantId}/{uuid}.webp`, WebP q82, e os mesmos tamanhos por tipo. O banco guarda a
 * CHAVE, nunca a URL — a origem vive em `NEXT_PUBLIC_SUPABASE_URL` e muda de projeto para
 * projeto.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const URL_SUPABASE = process.env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY
if (!CHAVE) throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente')

const svc = createClient(URL_SUPABASE, CHAVE, { auth: { persistSession: false, autoRefreshToken: false } })
const BUCKET = 'vitrine'

/** Mesmos tamanhos de `FORMATOS` em vitrine-upload.ts. Divergir aqui daria imagem esticada. */
const FORMATOS = {
  logo: { largura: 512, altura: 512, ajuste: 'inside' },
  cover: { largura: 1600, altura: 600, ajuste: 'cover' },
  professional: { largura: 512, altura: 512, ajuste: 'cover' },
}

/** Escurece uma cor #rrggbb por um fator, para o gradiente ter profundidade sem virar cinza. */
function escurecer(hex, fator) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c * fator))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** Iniciais de "Barbearia Dom Estilo" → "DE"; de "Ana Souza" → "AS". */
function iniciais(nome) {
  const ignorar = new Set(['de', 'da', 'do', 'dos', 'das', 'e'])
  const partes = nome
    .split(/\s+/)
    .filter((p) => p.length > 1 && !ignorar.has(p.toLowerCase()))
    .filter((p) => !['Barbearia', 'Salão', 'Studio', 'Espaço'].includes(p))
  const usar = partes.length >= 2 ? partes : nome.split(/\s+/).filter((p) => p.length > 1)
  return (usar[0][0] + (usar[1]?.[0] ?? '')).toUpperCase()
}

const svgLogo = (letras, cor) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${cor}"/><stop offset="1" stop-color="${escurecer(cor, 0.62)}"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="116" fill="url(#g)"/>
  <circle cx="256" cy="256" r="170" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="10"/>
  <text x="256" y="256" font-family="Georgia,serif" font-size="196" font-weight="700"
        fill="#ffffff" text-anchor="middle" dominant-baseline="central">${letras}</text>
</svg>`

/* A capa é a faixa do topo da página do salão. Fica atrás de um véu escuro no produto, então
   contraste alto aqui viraria ruído — o desenho é sóbrio de propósito. */
const svgCapa = (nome, cor) => `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${escurecer(cor, 0.85)}"/>
      <stop offset="0.55" stop-color="${escurecer(cor, 0.45)}"/>
      <stop offset="1" stop-color="${escurecer(cor, 0.24)}"/>
    </linearGradient>
    <pattern id="p" width="90" height="90" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
      <line x1="0" y1="0" x2="0" y2="90" stroke="#ffffff" stroke-opacity="0.05" stroke-width="18"/>
    </pattern>
  </defs>
  <rect width="1600" height="600" fill="url(#g)"/>
  <rect width="1600" height="600" fill="url(#p)"/>
  <circle cx="1310" cy="140" r="230" fill="#ffffff" fill-opacity="0.05"/>
  <circle cx="250" cy="520" r="170" fill="#ffffff" fill-opacity="0.04"/>
  <text x="800" y="318" font-family="Georgia,serif" font-size="82" font-weight="700"
        fill="#ffffff" fill-opacity="0.93" text-anchor="middle">${nome}</text>
</svg>`

const svgAvatar = (letras, cor) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0.7" y2="1">
    <stop offset="0" stop-color="${cor}"/><stop offset="1" stop-color="${escurecer(cor, 0.55)}"/>
  </linearGradient></defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <text x="256" y="268" font-family="Helvetica,Arial,sans-serif" font-size="216" font-weight="600"
        fill="#ffffff" fill-opacity="0.94" text-anchor="middle" dominant-baseline="central">${letras}</text>
</svg>`

async function subir(tenantId, tipo, svg) {
  const f = FORMATOS[tipo]
  const buffer = await sharp(Buffer.from(svg))
    .resize(f.largura, f.altura, { fit: f.ajuste, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer()
  const key = `${tenantId}/${randomUUID()}.webp`
  const { error } = await svc.storage.from(BUCKET).upload(key, buffer, {
    contentType: 'image/webp',
    cacheControl: '31536000',
  })
  if (error) throw new Error(`upload ${tipo}: ${error.message}`)
  return { key, bytes: buffer.length }
}

const PALETA_PROF = ['#3f6f5b', '#8c5a3c', '#4a5d8a', '#7d5aa6', '#a8556b', '#2f7a70', '#9a6b2f', '#5c6b8a']

/*
 * Diz em ALTO E BOM SOM contra qual projeto vai escrever. O `.env.local` desta base já apontou
 * para um projeto abandonado enquanto a produção era outro — um seed que grava em silêncio no
 * lugar errado é o tipo de erro que só aparece quando alguém procura o dado e não acha.
 */
console.log(`escrevendo em ${new URL(URL_SUPABASE).host}`)

// Alvo: `SLUGS_DE_DEMONSTRACAO` de `src/core/tenants/demonstracao.ts` (mantido em sincronia pela
// guarda `tests/unit/design/seed-imagens-cobre-demos.test.ts`). Aceita slugs por argumento para
// rodar só um: `node scripts/seed-demo-imagens.mjs dom-rocha`.
const SLUGS_DE_DEMONSTRACAO = [
  'dom-rocha',
  'ruivo-barber',
  'teste-essencial',
  'teste-equipe',
  'teste-avancado',
  'lang-barber',
  'lang-unhas',
  'demo-navalha-de-ouro',
  'demo-corte-fino',
  'demo-dom-estilo',
  'demo-studio-bella',
  'demo-salao-encanto',
  'demo-espaco-vitoria',
]
const alvo = process.argv.slice(2).length > 0 ? process.argv.slice(2) : SLUGS_DE_DEMONSTRACAO
const { data: tenants, error: erroTenants } = await svc
  .from('tenants')
  .select('id, name, slug, settings')
  .in('slug', alvo)
  .order('created_at')
if (erroTenants) throw erroTenants
if (!tenants.length) throw new Error(`nenhum tenant de demonstração encontrado para: ${alvo.join(', ')}`)

for (const t of tenants) {
  const cor = t.settings?.site?.accent ?? '#8a7a5c'
  const letras = iniciais(t.name)

  const logo = await subir(t.id, 'logo', svgLogo(letras, cor))
  const capa = await subir(t.id, 'cover', svgCapa(t.name, cor))

  // Merge por namespace: trocar `settings` inteiro apagaria tagline, sobre, cor e config de agenda.
  const site = { ...(t.settings?.site ?? {}), logoKey: logo.key, coverKey: capa.key }
  const { error } = await svc
    .from('tenants')
    .update({ settings: { ...(t.settings ?? {}), site } })
    .eq('id', t.id)
  if (error) throw error

  const { data: profs, error: erroProfs } = await svc
    .from('professionals')
    .select('id, display_name')
    .eq('tenant_id', t.id)
    .eq('active', true)
    .order('created_at')
  if (erroProfs) throw erroProfs

  let n = 0
  for (const [i, p] of profs.entries()) {
    const foto = await subir(t.id, 'professional', svgAvatar(iniciais(p.display_name), PALETA_PROF[i % PALETA_PROF.length]))
    const { error: e } = await svc.from('professionals').update({ photo_key: foto.key }).eq('id', p.id).eq('tenant_id', t.id)
    if (e) throw e
    n++
  }

  console.log(`${t.slug}: logo ${(logo.bytes / 1024).toFixed(0)}KB, capa ${(capa.bytes / 1024).toFixed(0)}KB, ${n} avatares`)
}

console.log('pronto')
