import { after } from 'next/server'

/**
 * APR-218 (docs/98 B-16b, G-17): trabalho que pode terminar DEPOIS da resposta (push para a equipe),
 * sem ser perdido. `void promessa` dentro de uma função serverless é aposta: a Vercel pode congelar
 * a instância assim que a resposta sai, e o push nunca chega. `after()` do Next segura a instância
 * até a tarefa acabar. Fora de um request (testes de integração chamam o serviço direto) `after()`
 * lança — aí a tarefa roda na hora, que é o que um teste quer.
 */
export function agendarDepois(tarefa: () => Promise<unknown>): void {
  try {
    after(() => tarefa())
  } catch {
    void tarefa()
  }
}
