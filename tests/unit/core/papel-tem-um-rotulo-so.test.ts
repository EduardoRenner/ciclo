import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ROTULO_DO_PAPEL, rotuloDoPapel } from '@/core/auth/rotulo-do-papel'
import { PERMISSIONS } from '@/server/auth/rbac'

/**
 * O mapa papel → nome em português morava dentro de `admin/config/profissionais/lista.tsx`. Quando
 * a tela de Configurações passou a dizer "Dono em Barbearia Dom Estilo", o caminho fácil era
 * copiar as cinco linhas — e duas cópias da mesma tabela divergem com as duas suítes verdes, que
 * é um defeito já pago nesta base.
 *
 * A tabela agora mora em `core/auth/rotulo-do-papel.ts`. Ela NÃO pode importar o tipo `Papel`
 * (`core/` não importa de `server/`, regra 5), então as chaves são literais — e é justamente por
 * isso que esta guarda existe: sem ela, um papel novo no `rbac` nasceria sem rótulo, e a tela
 * mostraria "Membro" para alguém que tem um nome.
 */

describe('papel tem um rótulo, e um só', () => {
  it('todo papel do rbac tem rótulo', () => {
    const semRotulo = Object.keys(PERMISSIONS).filter((p) => !(p in ROTULO_DO_PAPEL))
    expect(
      semRotulo,
      'papel novo no `rbac` sem entrada em `ROTULO_DO_PAPEL`: a tela vai chamá-lo de "Membro".',
    ).toEqual([])
  })

  it('e todo rótulo corresponde a um papel que existe', () => {
    // A direção oposta, e ela importa: rótulo órfão é papel que foi removido do produto e ficou
    // aparecendo num `<select>` de convite, oferecendo um papel que o servidor vai recusar.
    const orfaos = Object.keys(ROTULO_DO_PAPEL).filter((p) => !(p in PERMISSIONS))
    expect(orfaos, 'rótulo de papel que não existe mais no `rbac`').toEqual([])
  })

  it('o piso: as duas listas não estão vazias', () => {
    // Sem isto, duas listas vazias passariam nas duas afirmações acima.
    expect(Object.keys(PERMISSIONS).length).toBeGreaterThan(3)
    expect(Object.keys(ROTULO_DO_PAPEL).length).toBe(Object.keys(PERMISSIONS).length)
    expect(ROTULO_DO_PAPEL.owner).toBe('Dono')
  })

  it('papel desconhecido não vira `undefined` na tela', () => {
    expect(rotuloDoPapel('papel_que_nao_existe')).toBe('Membro')
    expect(rotuloDoPapel('reception')).toBe('Recepção')
  })
})

/**
 * A outra metade: garantir que a cópia não volte. Uma tela que redeclare o mapa localmente passa
 * em tudo acima — o teste importa do core, não do arquivo que renderiza.
 */
describe('nenhuma tela redeclara o mapa de papéis', () => {
  const CANONICO = join('src', 'core', 'auth', 'rotulo-do-papel.ts')

  function arquivos(dir: string): string[] {
    const achados: string[] = []
    for (const e of readdirSync(dir)) {
      const caminho = join(dir, e)
      if (statSync(caminho).isDirectory()) achados.push(...arquivos(caminho))
      else if (/\.(ts|tsx)$/.test(e)) achados.push(caminho)
    }
    return achados
  }

  const TODOS = arquivos('src')

  it('a varredura enxerga a árvore — não passa por não ter olhado nada', () => {
    expect(TODOS.length).toBeGreaterThan(80)
    // `CANONICO` vem de `join`, então já é o separador da plataforma: nada de regex de barra,
    // que é onde o heredoc come o escape e a guarda passa a comparar outra coisa.
    expect(TODOS).toContain(CANONICO)
  })

  it("só o arquivo canônico escreve `owner: 'Dono'`", () => {
    // Casa com o PAR chave→valor, não com a palavra "Dono" (que aparece em copy por outro motivo).
    const redeclaram = TODOS.filter(
      (a) => a !== CANONICO && /owner\s*:\s*'Dono'/.test(readFileSync(a, 'utf8')),
    )
    expect(
      redeclaram,
      'esta tela redeclarou o mapa de papéis. Importe `ROTULO_DO_PAPEL` de `@/core/auth/rotulo-do-papel`.',
    ).toEqual([])
  })
})
