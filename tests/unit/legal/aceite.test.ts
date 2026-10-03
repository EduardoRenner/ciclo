import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { linhasDaTelaDeAceite, pendenciasDeAceite, textoDoAvisoDeVersao } from '@/core/legal/aceite'
import { RESUMO_DA_VERSAO, VERSOES_LEGAIS } from '@/core/legal/versoes'

import { semComentarios } from '../../helpers/fonte'

const ATUAIS = { termos: '2026-10-03', privacidade: '2026-10-03' } as const

describe('pendenciasDeAceite', () => {
  it('conta sem nenhum aceite deve os dois documentos', () => {
    expect(pendenciasDeAceite([], ATUAIS)).toEqual(['termos', 'privacidade'])
  })

  it('aceitou a versão em vigor dos dois: nada pendente', () => {
    const linhas = [
      { documento: 'termos', versao: '2026-10-03' },
      { documento: 'privacidade', versao: '2026-10-03' },
    ]
    expect(pendenciasDeAceite(linhas, ATUAIS)).toEqual([])
  })

  it('aceitou uma versão ANTIGA: o documento volta a ficar pendente', () => {
    const linhas = [
      { documento: 'termos', versao: '2026-09-21' },
      { documento: 'privacidade', versao: '2026-10-03' },
    ]
    expect(pendenciasDeAceite(linhas, ATUAIS)).toEqual(['termos'])
  })

  it('vale a MAIOR versão aceita: aceitar de novo uma antiga depois da nova não reabre a pendência', () => {
    const linhas = [
      { documento: 'termos', versao: '2026-10-03' },
      { documento: 'termos', versao: '2026-09-21' },
      { documento: 'privacidade', versao: '2026-10-03' },
    ]
    expect(pendenciasDeAceite(linhas, ATUAIS)).toEqual([])
  })

  it('a ordem das linhas não decide: a antiga primeiro e a nova depois também quita (nas duas ordens)', () => {
    const antigaDepoisNova = [
      { documento: 'termos', versao: '2026-09-21' },
      { documento: 'termos', versao: '2026-10-03' },
      { documento: 'privacidade', versao: '2026-10-03' },
    ]
    expect(pendenciasDeAceite(antigaDepoisNova, ATUAIS)).toEqual([])
    expect(pendenciasDeAceite([...antigaDepoisNova].reverse(), ATUAIS)).toEqual([])
    // Controle positivo: com SÓ a antiga, o documento continua pendente (o teste montou o cenário).
    expect(pendenciasDeAceite([antigaDepoisNova[0]!, antigaDepoisNova[2]!], ATUAIS)).toEqual(['termos'])
  })

  it('aceite de um documento NÃO vale para o outro', () => {
    const linhas = [{ documento: 'termos', versao: '2026-10-03' }]
    expect(pendenciasDeAceite(linhas, ATUAIS)).toEqual(['privacidade'])
  })

  it('linha de documento que não existe é ignorada, e a ordem de entrada não muda nada', () => {
    const linhas = [
      { documento: 'outra-coisa', versao: '2099-01-01' },
      { documento: 'privacidade', versao: '2026-10-03' },
      { documento: 'termos', versao: '2026-10-03' },
    ]
    expect(pendenciasDeAceite(linhas, ATUAIS)).toEqual([])
    expect(pendenciasDeAceite([...linhas].reverse(), ATUAIS)).toEqual([])
  })

  it('quando a versão em vigor SOBE, quem tinha aceitado a anterior passa a dever', () => {
    const linhas = [
      { documento: 'termos', versao: '2026-10-03' },
      { documento: 'privacidade', versao: '2026-10-03' },
    ]
    expect(pendenciasDeAceite(linhas, { termos: '2026-11-20', privacidade: '2026-10-03' })).toEqual(['termos'])
  })
})

describe('textoDoAvisoDeVersao', () => {
  it('sem pendência, não há aviso', () => {
    expect(textoDoAvisoDeVersao([])).toBeNull()
  })

  it('diz qual documento mudou, e que a conta continua funcionando', () => {
    expect(textoDoAvisoDeVersao(['termos'])).toBe('Atualizamos os Termos de uso. Leia e aceite quando puder: sua conta continua funcionando normalmente.')
    expect(textoDoAvisoDeVersao(['privacidade'])).toBe('Atualizamos a Política de privacidade. Leia e aceite quando puder: sua conta continua funcionando normalmente.')
    expect(textoDoAvisoDeVersao(['termos', 'privacidade'])).toBe(
      'Atualizamos os Termos de uso e a Política de privacidade. Leia e aceite quando puder: sua conta continua funcionando normalmente.',
    )
  })

  it('não ameaça nem apressa', () => {
    for (const p of [['termos'], ['privacidade'], ['termos', 'privacidade']] as const) {
      const t = textoDoAvisoDeVersao(p)!
      expect(t).not.toMatch(/[—–]/)
      expect(t).not.toMatch(/prazo|bloquead|suspens|perde|urgente|imediatamente/i)
    }
  })
})

describe('o resumo do que mudou existe para cada versão em vigor', () => {
  it('toda versão em vigor tem um resumo de verdade (trocar a data sem escrever o que mudou reprova)', () => {
    for (const [doc, versao] of Object.entries(VERSOES_LEGAIS)) {
      const resumo = RESUMO_DA_VERSAO[doc as keyof typeof VERSOES_LEGAIS][versao]
      expect(resumo, `${doc} ${versao}: falta o resumo em RESUMO_DA_VERSAO. O dono seria convidado a aceitar sem saber o que mudou.`).toBeDefined()
      expect(resumo!.length, `${doc} ${versao}: resumo curto demais para dizer o que mudou`).toBeGreaterThan(40)
      expect(resumo).not.toMatch(/[—–]/)
    }
  })

  it('a tela de aceite mostra o resumo da versão em vigor, não o de outra', () => {
    const linhas = linhasDaTelaDeAceite(['termos'])
    expect(linhas.map((l) => l.documento)).toEqual(['termos', 'privacidade'])
    for (const l of linhas) {
      expect(l.versao).toBe(VERSOES_LEGAIS[l.documento])
      expect(l.resumo).toBe(RESUMO_DA_VERSAO[l.documento][l.versao])
    }
    expect(linhas.find((l) => l.documento === 'termos')!.pendente).toBe(true)
    expect(linhas.find((l) => l.documento === 'privacidade')!.pendente).toBe(false)
  })
})

describe('o reaceite está ligado do jeito que a promessa exige', () => {
  const ROTA = semComentarios(readFileSync('src/app/api/v1/legal/accept/route.ts', 'utf8'))
  const HOJE = semComentarios(readFileSync('src/app/admin/hoje/page.tsx', 'utf8'))
  const SERVICO = semComentarios(readFileSync('src/server/services/aceite-legal.ts', 'utf8'))

  it('só o dono aceita pelo negócio, e a versão nunca vem do navegador', () => {
    expect(ROTA).toMatch(/exigirPermissao\(ctx\.papel, 'tenant:update'\)/)
    // Sem corpo: se a rota lesse a versão do pedido, dava para gravar aceite de texto que ninguém viu.
    expect(ROTA).not.toMatch(/lerCorpo|req\.json\(/)
  })

  it('o aceite grava como reaceite, da versão EM VIGOR, só do que falta', () => {
    expect(SERVICO).toMatch(/via: 'reaceite'/)
    expect(SERVICO).toMatch(/versao: VERSOES_LEGAIS\[documento\]/)
    expect(SERVICO).toMatch(/if \(pendentes\.length === 0\) return \{ aceitos: \[\] \}/)
  })

  it('o aviso no Hoje consulta SÓ para quem pode aceitar, dentro do Promise.all, com catch que registra', () => {
    expect(HOJE).toMatch(/avaliarPermissao\(ctx\.papel, 'tenant:update'\)\s*\?\s*aceitesPendentes\(db, ctx\.tenantId\)\.catch/)
    expect(HOJE).toMatch(/event: 'aceite_pendente_indisponivel'/)
    expect(HOJE).toMatch(/textoDoAvisoDeVersao\(aceitePendente\)/)
    // O aceite pendente é o ÚLTIMO elemento do Promise.all e o último da desestruturação.
    expect(HOJE).toMatch(/prestacaoDeContas, aceitePendente\] = await Promise\.all/)
  })
})
