import { describe, expect, it } from 'vitest'

import { PERMISSIONS, RELATORIO_DA_EQUIPE, avaliarPermissao, exigirPermissao, type Papel } from '@/server/auth/rbac'
import { AppError } from '@/server/http/errors'

const PAPEIS: Papel[] = ['owner', 'manager', 'professional', 'reception', 'finance']

describe('tabela de permissões', () => {
  it('cobre exatamente os papéis do enum user_role', () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual([...PAPEIS].sort())
  })

  it('só o dono tem curinga total', () => {
    for (const papel of PAPEIS) {
      const temCuringa = (PERMISSIONS[papel] as readonly string[]).includes('*')
      expect(temCuringa, papel).toBe(papel === 'owner')
    }
  })
})

describe('avaliarPermissao', () => {
  it('o dono alcança tudo, inclusive o que ninguém mais alcança', () => {
    for (const acao of ['client:export', 'payment:refund', 'commission:update', 'inventado:qualquer'] as const) {
      expect(avaliarPermissao('owner', acao), acao).toBe('all')
    }
  })

  it('curinga de recurso vale para qualquer ação daquele recurso', () => {
    expect(avaliarPermissao('manager', 'appointment:create')).toBe('all')
    expect(avaliarPermissao('manager', 'client:delete')).toBe('all')
  })

  it('permissão exata não vira curinga', () => {
    // reception tem 'client:read' e 'client:create', e nada além disso.
    expect(avaliarPermissao('reception', 'client:read')).toBe('all')
    expect(avaliarPermissao('reception', 'client:create')).toBe('all')
    expect(avaliarPermissao('reception', 'client:delete')).toBeNull()
    expect(avaliarPermissao('reception', 'client:export')).toBeNull()
  })

  it('`own` concede a ação, mas com alcance restrito', () => {
    // 'own' na tabela é alcance, não verbo: o profissional mexe em agendamento,
    // só que apenas nos dele. Quem filtra é a consulta; a RLS é a rede embaixo.
    expect(avaliarPermissao('professional', 'appointment:update')).toBe('own')
    expect(avaliarPermissao('professional', 'client:read')).toBe('own')
    expect(avaliarPermissao('professional', 'vault:read')).toBe('own')
  })

  it('profissional não alcança recurso que não está na linha dele', () => {
    for (const acao of ['payment:refund', 'commission:read', 'service:create', 'report:read'] as const) {
      expect(avaliarPermissao('professional', acao), acao).toBeNull()
    }
  })

  it('finance mexe em dinheiro e não mexe em agenda', () => {
    expect(avaliarPermissao('finance', 'payment:refund')).toBe('all')
    expect(avaliarPermissao('finance', 'report:read')).toBe('all')
    expect(avaliarPermissao('finance', 'appointment:create')).toBeNull()
  })

  it('nenhum papel além do dono exporta a base de clientes', () => {
    // FAQ C35: exportar é só do dono, com MFA na hora.
    for (const papel of PAPEIS.filter((p) => p !== 'owner')) {
      expect(avaliarPermissao(papel, 'client:export'), papel).not.toBe('all')
    }
  })
})

describe('exigirPermissao', () => {
  it('devolve o alcance quando o papel pode', () => {
    expect(exigirPermissao('manager', 'client:update')).toBe('all')
    expect(exigirPermissao('professional', 'comanda:update')).toBe('own')
  })

  it('profissional em rota de dono leva 403 FORBIDDEN', () => {
    const erro = (() => {
      try {
        exigirPermissao('professional', 'commission:update')
      } catch (e) {
        return e
      }
    })()

    expect(erro).toBeInstanceOf(AppError)
    expect((erro as AppError).code).toBe('FORBIDDEN')
    expect((erro as AppError).status).toBe(403)
  })
})

/**
 * `docs/50` L-10 — a decisão de quem vê a concentração por profissional, guardada.
 *
 * A tabela de `PERMISSIONS` já produzia este resultado antes de alguém pedir: `manager` tem
 * `report:read` LITERAL, não `report:*`. A guarda existe porque a distância entre os dois é uma
 * tecla, e ampliá-la publicaria "62% do lucro veio do Rafa" para quem trabalha ao lado do Rafa.
 */
describe('report:team — de quem o lucro depende, nome por nome', () => {
  it('o dono e quem cuida do financeiro alcançam', () => {
    expect(avaliarPermissao('owner', RELATORIO_DA_EQUIPE)).toBe('all')
    expect(avaliarPermissao('finance', RELATORIO_DA_EQUIPE)).toBe('all')
  })

  it('o gerente NÃO alcança, e continua alcançando o resto do relatório', () => {
    expect(
      avaliarPermissao('manager', RELATORIO_DA_EQUIPE),
      'trocar `report:read` por `report:*` na tabela publica o ranking para quem convive com ele',
    ).toBeNull()
    expect(avaliarPermissao('manager', 'report:read'), 'o gerente perdeu o caixa junto').toBe('all')
  })

  it('quem atende e quem recebe não alcançam nenhum dos dois', () => {
    for (const papel of ['professional', 'reception'] as const) {
      expect(avaliarPermissao(papel, RELATORIO_DA_EQUIPE)).toBeNull()
      expect(avaliarPermissao(papel, 'report:read')).toBeNull()
    }
  })
})
