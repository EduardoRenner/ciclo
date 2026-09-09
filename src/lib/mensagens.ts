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
  /** I-5, `docs/30-INDICACAO-PLANO.md` §6.2c: o convite assinado desta cliente, pronto pra colar. */
  link?: string | null
}

/** As chaves que o editor de modelos oferece — a tela mostra esta lista como botões. */
export const VARIAVEIS_DISPONIVEIS: { chave: keyof VariaveisMensagem; rotulo: string }[] = [
  { chave: 'nome', rotulo: 'Nome de quem é atendido' },
  { chave: 'servico', rotulo: 'Serviço' },
  { chave: 'data', rotulo: 'Data' },
  { chave: 'hora', rotulo: 'Hora' },
  { chave: 'valor', rotulo: 'Valor' },
  { chave: 'negocio', rotulo: 'Nome do negócio' },
  { chave: 'link', rotulo: 'Link de indicação' },
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

/**
 * `wa.me` SEM telefone — abre o seletor de contato do próprio WhatsApp de quem está mandando.
 * Para o convite de indicação (I-3, `docs/30-INDICACAO-PLANO.md`): quem indica escolhe a amiga
 * na hora, não tem como o CICLO já saber o telefone dela.
 */
export function linkWhatsAppCompartilhar(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`
}

export type SaidaDeContato = {
  canal: 'whatsapp' | 'telefone'
  href: string
  rotulo: string
}

/**
 * Por onde a cliente fala com o salão quando quer cutucar — a saída das telas de sucesso.
 *
 * Existe como função, e não como dois ternários dentro do JSX, porque **dois dos três estados não
 * aparecem com os dados de hoje**: os seis tenants em produção têm WhatsApp preenchido, então o
 * caminho do `tel:` e o do "nenhum canal" nunca renderizam sem alguém forçá-los. É a mesma
 * armadilha das estrelas do `docs/42` §2 — a primeira versão daquele conserto quebrou justamente o
 * estado que os dados não produziam, com typecheck, lint e a suíte inteira verdes.
 *
 * **WhatsApp na frente do telefone, e não é preferência:** o formulário público pede "Seu telefone
 * (WhatsApp)", ou seja, a pessoa acabou de declarar que é por lá que ela fala. Oferecer ligação a
 * quem escreveu o número como WhatsApp é ignorar a resposta que ela deu duas telas atrás.
 *
 * Nada aqui é promessa de canal: quem manda a mensagem é a pessoa, no aplicativo dela.
 */
export function saidaDeContato(
  whatsapp: string | null,
  telefone: string | null,
  nomeDoSalao: string,
  texto: string,
): SaidaDeContato | null {
  const zap = linkWhatsApp(whatsapp, texto)
  if (zap) return { canal: 'whatsapp', href: zap, rotulo: 'Falar no WhatsApp' }
  if (telefone) return { canal: 'telefone', href: `tel:${telefone}`, rotulo: `Ligar para ${nomeDoSalao}` }
  return null
}
