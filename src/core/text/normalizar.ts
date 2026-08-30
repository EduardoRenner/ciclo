/**
 * Tira acento e caixa de um texto, para busca que perdoa como a pessoa digita.
 *
 * Existe porque `ilike` do Postgres é case-insensitive mas NÃO é accent-insensitive: medido em
 * produção (30/08/2026), "Otávio" achava e **"Otavio" não achava nada** — e o mesmo para "Joao",
 * "Vinicius", "Sergio". Metade das buscas falhava, justamente na metade que a pessoa digita de
 * verdade: ninguém põe acento com pressa, no celular, com a cliente na frente.
 *
 * O par desta função mora no banco (`imutavel_sem_acento`, migration 0047), materializado na
 * coluna gerada `clients.name_busca`. Os dois lados TÊM que normalizar igual — é por isso que
 * isto é função em `core/` (pura, sem I/O, regra 5 do `CLAUDE.md`) e não `.replace()` solto na
 * camada de serviço: a guarda precisa exercitar a MESMA função que a busca usa.
 *
 * `NFD` separa a letra do acento (á → a + ́), e o range `̀-ͯ` é o bloco Unicode dos
 * diacríticos combinantes — remover só ele preserva `ç`→`c`? Não: `ç` é decomposto em `c` + `¸`
 * (cedilha, U+0327), que está no bloco. Então cobre cedilha também, que é o outro caso que
 * importa em português ("Conceicao" achar "Conceição").
 */
export function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
