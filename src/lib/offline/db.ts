import type { Mutacao } from '@/core/offline/queue'

/**
 * TICKET-055. Adaptador fino sobre IndexedDB — só o `store 'mutations'` que
 * `§4.2` pede. Sem `idb` nem outra dependência: é pouca superfície de API
 * (get/put/delete) e o projeto já prefere primitivos próprios (token
 * assinado, fila de jobs) a puxar biblioteca para pouca coisa.
 *
 * **Limite de verificação**: IndexedDB não existe em Node/Vitest (ambiente
 * `node` deste projeto, sem jsdom) — este arquivo não tem teste automatizado,
 * mesmo padrão já registrado em `docs/DECISOES.md` para as telas sob `(app)/`
 * que exigem sessão de browser de verdade. A lógica que dá para testar sem
 * browser (ordem/retry/conflito) está isolada em `src/core/offline/queue.ts`.
 */

const DB_NOME = 'ciclo-offline'
const DB_VERSAO = 1
const STORE = 'mutations'

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(DB_NOME, DB_VERSAO)
    pedido.onupgradeneeded = () => {
      if (!pedido.result.objectStoreNames.contains(STORE)) {
        pedido.result.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    pedido.onsuccess = () => resolve(pedido.result)
    pedido.onerror = () => reject(pedido.error)
  })
}

async function transacao<T>(modo: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrirBanco()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, modo)
    const pedido = fn(tx.objectStore(STORE))
    pedido.onsuccess = () => resolve(pedido.result)
    pedido.onerror = () => reject(pedido.error)
  })
}

export async function salvarMutacao(mutacao: Mutacao): Promise<void> {
  await transacao('readwrite', (store) => store.put(mutacao))
}

export async function listarMutacoes(): Promise<Mutacao[]> {
  return transacao('readonly', (store) => store.getAll() as IDBRequest<Mutacao[]>)
}

export async function removerMutacao(id: string): Promise<void> {
  await transacao('readwrite', (store) => store.delete(id))
}
