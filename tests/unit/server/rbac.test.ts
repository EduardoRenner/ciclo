import { describe, expect, it } from 'vitest'

import { avaliarPermissao, exigirPermissao, PERMISSIONS, type Papel } from '@/server/auth/rbac'
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
