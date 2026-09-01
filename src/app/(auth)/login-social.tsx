'use client'

import { useState } from 'react'

import Button from '@/components/ui/button'
import { criarClienteDoNavegador } from '@/server/db/browser-client'

/**
 * Google e Apple, do lado de `/entrar` e de `/cadastro` — a mesma chamada cria conta na primeira
 * vez e entra nas seguintes, porque é assim que `signInWithOAuth` funciona no Supabase: não há
 * "cadastro" separado de "login" no OAuth.
 *
 * O redirecionamento cai em `/auth/callback`, que já existe (link de confirmação de e-mail e de
 * redefinição de senha passam por ali) e já faz exatamente o que o código do OAuth precisa:
 * `exchangeCodeForSession` e manda para `/onboarding`, que se autorredireciona para `/admin/hoje`
 * quando a pessoa já tem negócio. Nenhuma mudança na rota de callback foi necessária.
 *
 * `window.location.origin` e não `NEXT_PUBLIC_APP_URL`: o valor certo é o domínio de onde a pessoa
 * está clicando agora (produção, preview da Vercel, ou `localhost` em desenvolvimento) — usar a
 * env var fixa quebraria o login em qualquer ambiente que não seja a produção.
 */
export default function LoginSocial() {
  const [carregando, setCarregando] = useState<'google' | 'apple' | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function entrarCom(provider: 'google' | 'apple') {
    setErro(null)
    setCarregando(provider)
    try {
      const supabase = criarClienteDoNavegador()
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      // Só chega aqui se DEU ERRO: em caso de sucesso o navegador já saiu desta página, redirecionado
      // para o provedor — não há "sucesso" para tratar no lado de cá.
      if (error) {
        setErro('Não consegui abrir o login. Tente de novo.')
        setCarregando(null)
      }
    } catch {
      setErro('Sem conexão agora. Tente de novo.')
      setCarregando(null)
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <Button
        type="button"
        variante="secondary"
        largura="cheia"
        carregando={carregando === 'google'}
        disabled={carregando !== null && carregando !== 'google'}
        motivoDesabilitado="Aguarde o login com Apple terminar."
        onClick={() => entrarCom('google')}
      >
        <GoogleG aria-hidden className="size-5" />
        Continuar com Google
      </Button>
      <Button
        type="button"
        variante="secondary"
        largura="cheia"
        carregando={carregando === 'apple'}
        disabled={carregando !== null && carregando !== 'apple'}
        motivoDesabilitado="Aguarde o login com Google terminar."
        onClick={() => entrarCom('apple')}
      >
        <AppleLogo aria-hidden className="size-5" />
        Continuar com Apple
      </Button>
      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}

      <div className="my-1 flex items-center gap-3" aria-hidden>
        <div className="h-px flex-1 bg-line-2" />
        <span className="text-label text-txt-3">ou</span>
        <div className="h-px flex-1 bg-line-2" />
      </div>
    </div>
  )
}

/** Marca oficial do Google — as quatro cores são parte da identidade, não decoração trocável. */
function GoogleG(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.78-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.28v3.1C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.3c-.24-.72-.38-1.49-.38-2.3s.14-1.58.38-2.3v-3.1H1.28A11.96 11.96 0 0 0 0 12c0 1.94.46 3.77 1.28 5.4l4.01-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.28 6.6l4.01 3.1c.94-2.83 3.59-4.95 6.71-4.95z"
      />
    </svg>
  )
}

/** Silhueta da Apple, em `currentColor` — a marca da Apple é monocromática por convenção própria. */
function AppleLogo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M16.36 1.43c0 1.14-.42 2.2-1.24 3.05-.85.9-2.15 1.6-3.24 1.51-.14-1.1.42-2.28 1.19-3.06.87-.9 2.29-1.55 3.29-1.5zm3.02 17.03c-.55 1.27-.81 1.83-1.52 2.95-.99 1.56-2.38 3.5-4.12 3.51-1.54.02-1.94-1-4.02-.99-2.09.01-2.52 1.01-4.06.99-1.73-.02-3.05-1.77-4.04-3.32-2.77-4.28-3.06-9.31-1.35-11.99 1.21-1.9 3.13-3.02 4.93-3.02 1.83 0 2.98 1 4.49 1 1.47 0 2.36-1 4.49-1 1.6 0 3.29.87 4.5 2.38-3.96 2.17-3.31 7.83.7 9.49z" />
    </svg>
  )
}
