/**
 * O botão "Abrir o Gmail" da tela de "confira seu e-mail" — `docs/82` §7.
 *
 * O cadastro do CICLO exige clicar no link de confirmação, e é nesse degrau que o cadastro
 * self-serve mais perde gente: a pessoa lê "mandamos um link", precisa sair, achar o app de e-mail,
 * achar a mensagem. Para os provedores em que isso é possível, o botão já abre a caixa de entrada
 * (no celular, o endereço web do provedor abre o próprio app). Sem busca pelo remetente: o
 * assunto e o remetente do e-mail moram no painel do Supabase, não no repo, e uma busca por palavra
 * que não está na mensagem abriria uma caixa vazia.
 *
 * Só provedores conhecidos, e só o domínio decide: provedor desconhecido devolve `null` e a tela
 * mostra só o texto de sempre — um botão que abre a caixa errada é pior que nenhum.
 */

export type CaixaDeEntrada = { nome: string; url: string }

const PROVEDORES: Array<{ dominios: string[]; nome: string; url: string }> = [
  { dominios: ['gmail.com', 'googlemail.com'], nome: 'Gmail', url: 'https://mail.google.com/mail/u/0/#inbox' },
  {
    dominios: ['hotmail.com', 'hotmail.com.br', 'outlook.com', 'outlook.com.br', 'live.com'],
    nome: 'Outlook',
    url: 'https://outlook.live.com/mail/0/',
  },
  { dominios: ['yahoo.com', 'yahoo.com.br'], nome: 'Yahoo Mail', url: 'https://mail.yahoo.com/' },
  { dominios: ['icloud.com', 'me.com', 'mac.com'], nome: 'iCloud Mail', url: 'https://www.icloud.com/mail' },
  { dominios: ['uol.com.br'], nome: 'UOL Mail', url: 'https://email.uol.com.br/' },
  { dominios: ['bol.com.br'], nome: 'BOL Mail', url: 'https://email.bol.uol.com.br/' },
]

export function caixaDeEntrada(email: string): CaixaDeEntrada | null {
  const arroba = email.lastIndexOf('@')
  if (arroba < 1) return null
  const dominio = email.slice(arroba + 1).trim().toLowerCase()
  const provedor = PROVEDORES.find((p) => p.dominios.includes(dominio))
  return provedor ? { nome: provedor.nome, url: provedor.url } : null
}
