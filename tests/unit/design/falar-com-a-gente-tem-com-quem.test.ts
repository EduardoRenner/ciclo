import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

import { canalDeContato, textoDeMudarDePlano } from '@/lib/contato'

/**
 * Três telas mandavam o assinante "falar com a gente" e o produto não oferecia com quem: nem
 * telefone, nem e-mail, nem link. Num produto sem cobrança automática, essa frase é o ÚNICO
 * caminho de receita que existe — e ela terminava em parede.
 *
 * É a mesma classe de `fee_cents`, `media.consent_id`, `tenants.plan` e `clients.referred_by`
 * (lido por todo mundo, escrito por ninguém), aplicada a uma frase em vez de a uma coluna. E é
 * silenciosa pelo mesmo motivo: nenhuma tela quebra, nenhum teste fica vermelho, o assinante só
 * desiste.
 *
 * A guarda ataca os dois lados, no padrão de `promessa-de-canal`:
 *   1. exercita a função que tem o direito de escrever a frase, nos DOIS estados do mundo;
 *   2. varre a fonte para que a frase não renasça escrita à mão numa tela que não consulta nada
 *      — que foi exatamente como `textoDoEnvioAutomatico` foi burlada em 2026-08-30.
 */

const RAIZ = 'src'
const CANONICO = join('src', 'lib', 'contato.ts')

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    else if (/\.(ts|tsx)$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

/**
 * Comentário é prosa, não é o que a pessoa lê na tela — e casar com ele já custou três falsos
 * positivos nesta base no mesmo dia. Some com bloco e linha antes de procurar, JSX incluído.
 */
// A limpeza mora em `helpers/fonte` — esta era a última das doze cópias locais da mesma regra.


const TODOS = arquivos(RAIZ)

const COM_CANAL = { whatsapp: '5551999999999', email: null }
const SEM_CANAL = { whatsapp: null, email: null }

describe('canalDeContato', () => {
  it('com WhatsApp configurado, devolve um wa.me com a mensagem já escrita', () => {
    const canal = canalDeContato('Quero subir de plano', COM_CANAL)
    expect(canal).not.toBeNull()
    expect(canal!.href).toMatch(/^https:\/\/wa\.me\/5551999999999\?text=/)
    expect(decodeURIComponent(canal!.href)).toContain('Quero subir de plano')
    expect(canal!.rotulo.length).toBeGreaterThan(0)
  })

  it('sem WhatsApp e com e-mail, cai no mailto com assunto', () => {
    const canal = canalDeContato('Dúvida de cobrança', { whatsapp: null, email: 'ola@exemplo.com.br' })
    expect(canal!.href).toBe(`mailto:ola@exemplo.com.br?subject=${encodeURIComponent('Dúvida de cobrança')}`)
  })

  it('sem nada configurado, devolve null em vez de um link quebrado', () => {
    // O ponto todo: o estado "não configurado" precisa ser DIZÍVEL. Um href vazio ou um `wa.me/`
    // sem número passaria pelo `if (canal)` das telas e desenharia um botão que não vai a lugar
    // nenhum — que é pior que a ausência dele, e é o defeito original com outra roupa.
    expect(canalDeContato('Oi', SEM_CANAL)).toBeNull()
  })

  it('número curto demais não vira canal', () => {
    expect(canalDeContato('Oi', { whatsapp: '123', email: null })).toBeNull()
  })
})

describe('textoDeMudarDePlano', () => {
  it('SEM canal, não convida para uma conversa que não tem onde acontecer', () => {
    for (const noGratis of [true, false]) {
      const texto = textoDeMudarDePlano(noGratis, false)

      /*
       * O conceito, não a redação. `[^\s]*` e não `\w*` pela lição já registrada em
       * `promessa-de-canal`: sem a flag `u`, `\w` é `[A-Za-z0-9_]` e não casa `ç`/`ã` — "conversa"
       * escaparia de qualquer padrão que dependesse de `\w` para pegar "conversação".
       */
      expect(/fal(e|ar|a)\s+com\s+a\s+gente/i.test(texto), `convidou sem canal: "${texto}"`).toBe(false)
      expect(/[ée]\s+s[óo]\s+(chamar|falar|pedir)/i.test(texto), `convidou sem canal: "${texto}"`).toBe(false)
      expect(/(nos|me)\s+chama/i.test(texto), `convidou sem canal: "${texto}"`).toBe(false)

      // E não pode virar silêncio: quem abre "Meu plano" quer saber se aquilo vira cobrança.
      expect(texto.trim().length, 'ficou sem explicação nenhuma').toBeGreaterThan(40)
      expect(/cobran[çc]a autom[áa]tica/i.test(texto), 'sumiu a resposta que a pessoa veio buscar').toBe(true)
    }
  })

  it('COM canal, a frase convida — a guarda não trava copy honesta', () => {
    expect(textoDeMudarDePlano(true, true)).toMatch(/convers/i)
    expect(textoDeMudarDePlano(false, true)).toMatch(/chamar|convers/i)
  })

  it('os quatro casos dizem coisas diferentes', () => {
    // Guarda contra o próprio detector: se alguém colapsar os ramos, as asserções acima podem
    // continuar passando com a função virada decoração.
    const textos = new Set([
      textoDeMudarDePlano(true, true),
      textoDeMudarDePlano(true, false),
      textoDeMudarDePlano(false, true),
      textoDeMudarDePlano(false, false),
    ])
    expect(textos.size).toBe(4)
  })
})

describe('nenhuma tela escreve o convite à mão', () => {
  it('o leitor enxerga a árvore de src/ — não passa por não ter olhado nada', () => {
    expect(TODOS.length).toBeGreaterThan(80)
    expect(TODOS).toContain(CANONICO)
  })

  it('quem escreve "falar com a gente" na tela consulta `canalDeContato`', () => {
    const infratores: string[] = []
    for (const arquivo of TODOS) {
      if (arquivo === CANONICO) continue
      const src = semComentarios(readFileSync(arquivo, 'utf8'))
      if (!/fal(e|ar|a)\s+com\s+a\s+gente/i.test(src)) continue
      // Casa com a CHAMADA, não com o import: `canalDeContato` solto casaria com a linha de
      // `import` de um arquivo que importou e nunca usou.
      if (!/canalDeContato\s*\(/.test(src)) infratores.push(arquivo)
    }
    expect(
      infratores,
      'a tela promete conversa sem perguntar se existe canal. Use `canalDeContato` de `@/lib/contato`.',
    ).toEqual([])
  })

  it('as quatro telas que faziam a promessa vazia agora consultam o canal', () => {
    // A de `privacidade` entrou aqui porque a varredura acima a encontrou — eu tinha achado três
    // lendo o código, e ela é justamente a mais cara: é o parágrafo dos direitos da LGPD.
    for (const tela of [
      'src/app/(public)/precos/page.tsx',
      'src/app/(public)/termos/page.tsx',
      'src/app/(public)/privacidade/page.tsx',
      'src/app/admin/config/meu-plano/page.tsx',
    ]) {
      expect(/canalDeContato\s*\(/.test(readFileSync(tela, 'utf8')), `${tela} não consulta o canal`).toBe(true)
    }
  })
})
