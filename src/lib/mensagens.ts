/**
 * Substituição de variável e link de WhatsApp. Fica em `lib/` (não em `server/`) porque a tela
 * da ficha monta a prévia no navegador enquanto a pessoa escolhe o modelo — mesma função dos
 * dois lados evita a prévia mostrar uma coisa e o envio mandar outra.
 */

export type VariaveisMensagem = {
  nome?: string | null
  servico?: string | null
  data?: string | null
  hora?: string | null
  valor?: string | null
  negocio?: string | null
}

/** As chaves que o editor de modelos oferece — a tela mostra esta lista como botões. */
export const VARIAVEIS_DISPONIVEIS: { chave: keyof VariaveisMensagem; rotulo: string }[] = [
  { chave: 'nome', rotulo: 'Nome da cliente' },
  { chave: 'servico', rotulo: 'Serviço' },
  { chave: 'data', rotulo: 'Data' },
  { chave: 'hora', rotulo: 'Hora' },
  { chave: 'valor', rotulo: 'Valor' },
  { chave: 'negocio', rotulo: 'Nome do negócio' },
]

/**
 * Variáveis que só existem quando há um horário marcado. Um modelo que usa qualquer uma delas
 * não serve para disparo em lote nem para quem não tem agendamento aberto — sairia "no dia às
 * ." na cara da cliente. Quem monta a tela usa isto para esconder ou explicar, em vez de deixar
 * o buraco aparecer no texto.
 */
const VARIAVEIS_DE_AGENDAMENTO = ['data', 'hora', 'servico']

export function precisaDeAgendamento(corpo: string): boolean {
  return VARIAVEIS_DE_AGENDAMENTO.some((v) => new RegExp(`\\{\\{\\s*${v}\\s*\\}\\}`).test(corpo))
}

/**
 * Troca `{{nome}}` pelo valor. Variável sem valor vira string vazia em vez de ficar como
 * `{{nome}}` na tela: mandar a chave crua para a cliente é pior que mandar a frase sem o nome.
 * Só o primeiro nome — "Fala, Bruno!" soa como gente, "Fala, Bruno Almeida!" soa como cobrança.
 */
export function aplicarVariaveis(corpo: string, variaveis: VariaveisMensagem): string {
  return corpo.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, chave: string) => {
    const valor = variaveis[chave as keyof VariaveisMensagem]
    if (valor == null) return ''
    return chave === 'nome' ? String(valor).trim().split(/\s+/)[0]! : String(valor)
  })
}

/**
 * Link `wa.me` com o texto já escrito. É o que faz as mensagens prontas funcionarem HOJE: o
 * envio automático depende de credencial da Meta que ainda não temos, mas abrir o WhatsApp da
 * própria pessoa com a mensagem pronta não depende de nada — e é o que ela já faz na mão.
 */
export function linkWhatsApp(telefoneE164: string | null, texto: string): string | null {
  if (!telefoneE164) return null
  const numero = telefoneE164.replace(/\D/g, '')
  if (numero.length < 10) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}
