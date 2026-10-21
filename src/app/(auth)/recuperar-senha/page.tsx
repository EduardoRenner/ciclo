import Link from 'next/link'
import { redirect } from 'next/navigation'

import Selo from '@/components/shell/selo'
import TelaPublica from '@/components/shell/tela-publica'
import { linkWhatsApp } from '@/lib/mensagens'
import { sessaoAtual } from '@/server/auth/session'

export const metadata = { title: "Recuperar senha" }

/**
 * docs/114 L-03 (decisão do Vitor, 21/10: "não vamos usar email nunca"). Esta tela mandava um link por
 * e-mail. Sem e-mail, o caminho certo é o código pelo WhatsApp, e ele depende da Meta, que ainda não
 * está ligada. Até lá a tela diz a verdade: a senha nova é feita com ajuda da equipe, pelo WhatsApp do
 * CICLO (`WHATSAPP_SUPORTE`, número com DDI e DDD). Sem o número configurado, não aparece botão que
 * não leva a lugar nenhum. A rota `/api/v1/auth/password/forgot` continua, para quem tem e-mail.
 */
export default async function PaginaRecuperarSenha() {
  const sessao = await sessaoAtual()
  if (sessao) redirect('/admin/hoje')

  const suporte = linkWhatsApp(
    process.env.WHATSAPP_SUPORTE ?? null,
    'Oi! Esqueci a senha do CICLO. Pode me ajudar a criar uma nova? Meu WhatsApp da conta é este.',
  )

  return (
    <TelaPublica>
      <Selo />
      <div className="flex max-w-sm flex-col gap-2 text-center">
        <h1 className="text-titulo font-bold">Esqueceu a senha?</h1>
        <p className="text-corpo text-txt-2">
          Por enquanto, a senha nova é criada com a ajuda da equipe do CICLO. Mande uma mensagem do mesmo WhatsApp da sua conta.
        </p>
      </div>
      {suporte ? (
        <a
          href={suporte}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-12 w-full max-w-sm items-center justify-center rounded-[var(--radius-sm)] bg-acc px-5 text-corpo font-semibold text-on-acc shadow-elevado transition active:scale-[.97]"
        >
          Falar com a equipe no WhatsApp
        </a>
      ) : null}
      <Link href="/entrar?porta=profissional" className="mx-auto flex h-12 items-center px-3 text-secundario font-semibold text-acc-2">
        Voltar para entrar
      </Link>
    </TelaPublica>
  )
}
