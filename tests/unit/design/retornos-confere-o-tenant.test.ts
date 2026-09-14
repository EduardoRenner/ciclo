import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * `retornos` (2026-09-14) deixa o dono marcar "essa pessoa já cadastrada voltou" sem reabrir a
 * ficha — é a peça que sustenta "não precisa trocar de sistema, só de 1 minuto por semana" como
 * proposta de venda de verdade, não só discurso. `docs/DECISOES.md` 2026-09-14 tem o raciocínio
 * completo.
 *
 * O que esta guarda impede: o `clientId` que a tela manda vem do CLIENTE (a busca), então o
 * serviço PRECISA confirmar que ele pertence a este tenant antes de gravar ciclo nele — a RLS
 * barraria a escrita cruzada, mas sem a conferência explícita o upsert simplesmente não afetaria
 * linha nenhuma para o id estranho, e a tela diria "gravado" sobre um retorno que não aconteceu
 * (a mesma armadilha do UPDATE de zero linhas que não é erro).
 */
const SERVICO = 'src/server/services/quem-ja-atendo.ts'
const FORMULARIO = 'src/app/admin/clientes/ja-atendo/formulario.tsx'

describe('retornos: o clientId da busca não entra sem conferir o tenant', () => {
  const servico = semComentarios(readFileSync(SERVICO, 'utf8'))
  const formulario = semComentarios(readFileSync(FORMULARIO, 'utf8'))

  it('as leituras não voltaram vazias', () => {
    expect(servico.length).toBeGreaterThan(500)
    expect(formulario.length).toBeGreaterThan(500)
  })

  it('o serviço filtra os clientId de retornos por tenant_id antes de usar', () => {
    // `.eq('tenant_id', tenantId)` no MESMO trecho que lê `clients` para validar `retornos` —
    // casa com a chamada, não com qualquer `.eq('tenant_id'` solto no arquivo (que existem vários).
    expect(servico).toMatch(/from\('clients'\)[\s\S]{0,120}\.eq\('tenant_id',\s*tenantId\)[\s\S]{0,200}\.in\('id',\s*idsUnicos\)/)
  })

  it('idsValidos vem do RESULTADO da consulta, não é reconstruído a partir do que o cliente mandou', () => {
    // A guarda anterior só conferia que a consulta a `clients` existe em algum lugar do arquivo —
    // ela continuaria "verde" se `idsValidos` ignorasse o resultado e usasse `retornos` direto
    // (código morto de query ao lado). Esta casa com o que ALIMENTA `idsValidos` de verdade.
    expect(servico).toMatch(/idsValidos\s*=\s*new Set\(\(existentes/)
    expect(servico, 'idsValidos não pode vir direto de retornos/entrada — isso pula a validação').not.toMatch(
      /idsValidos\s*=\s*new Set\(\s*retornos/,
    )
  })

  it('linha que não bateu no filtro é descartada, não gravada mesmo assim', () => {
    expect(servico).toMatch(/idsValidos\.has\(r\.clientId\)/)
  })

  it('o formulário manda retornos de verdade para a rota', () => {
    expect(formulario).toMatch(/retornos:\s*retornos\.map/)
    expect(formulario).toMatch(/fetch\(`\/api\/v1\/clients\?q=/)
  })

  it('o detector reconhece o defeito que ele impede', () => {
    const semConferencia = "const idsValidos = new Set(retornos.map(r => r.clientId)) // sem consultar o banco"
    expect(/from\('clients'\)[\s\S]{0,120}\.eq\('tenant_id',\s*tenantId\)[\s\S]{0,200}\.in\('id',\s*idsUnicos\)/.test(semConferencia)).toBe(false)
  })
})
