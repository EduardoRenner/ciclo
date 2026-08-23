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

/**
 * Apaga o banco inteiro. Chamado só no logout (auditoria de segurança, achado S9).
 *
 * A fila guarda o CORPO de cada mutação pendente — nome de cliente, telefone, dados de
 * agendamento. Num tablet de balcão, que é o caso de uso central deste produto, sair da conta
 * sem limpar isso deixaria o rascunho de uma pessoa no aparelho para a próxima. Descartar
 * mutação de outra pessoa é melhor que enviá-la na sessão seguinte, em nome de quem entrar
 * depois — por isso quem chama drena a fila ANTES, e só descarta o que sobrar.
 */
export function apagarBancoOffline(): Promise<void> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.deleteDatabase(DB_NOME)
    pedido.onsuccess = () => resolve()
    pedido.onerror = () => reject(pedido.error)
    // Outra aba com o banco aberto segura o delete indefinidamente. Sair da conta não pode
    // travar por causa disso: o `onblocked` resolve, e a limpeza acontece quando a aba fechar.
    pedido.onblocked = () => resolve()
  })
}
