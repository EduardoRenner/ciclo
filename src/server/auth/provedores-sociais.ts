import { exigirEnv } from '@/server/db/server-client'

export const PROVEDORES_SOCIAIS = ['google', 'apple'] as const
export type ProvedorSocial = (typeof PROVEDORES_SOCIAIS)[number]

/**
 * Quais provedores de OAuth estão REALMENTE ligados no projeto Supabase.
 *
 * Existe porque estar no código não é estar no ar: ligar Google/Apple é configuração de painel
 * (client ID e secret), não migration. Quando o projeto Supabase foi trocado (02/09/2026), os dois
 * voltaram ao padrão desligado — e a tela seguiu mostrando os dois botões, que respondiam
 * `Unsupported provider: provider is not enabled` e viravam "Não consegui abrir o login. Tente de
 * novo." Um convite a tentar de novo para sempre, para uma condição que nenhuma tentativa conserta.
 *
 * Perguntar ao próprio Supabase é o que mantém a tela honesta sozinha: no instante em que alguém
 * ligar o Google no painel, o botão aparece — sem deploy, sem env var nova para esquecer de setar.
 *
 * `/auth/v1/settings` é público (só pede a chave publicável) e devolve `external.<provedor>`.
 */
export async function provedoresSociaisAtivos(): Promise<ProvedorSocial[]> {
  try {
    const resposta = await fetch(`${exigirEnv('NEXT_PUBLIC_SUPABASE_URL')}/auth/v1/settings`, {
      headers: { apikey: exigirEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') },
      // 5 minutos: ligar um provedor é raro, e a tela de login não pode pagar uma ida à rede por
      // visita. O preço do cache é o botão demorar até 5min para aparecer depois de configurado.
      next: { revalidate: 300 },
    })
    if (!resposta.ok) return []

    const { external } = (await resposta.json()) as { external?: Record<string, boolean> }
    return PROVEDORES_SOCIAIS.filter((p) => external?.[p] === true)
  } catch {
    /*
     * Falha fechada de propósito: sem resposta, escondemos os botões. Some um caminho que talvez
     * funcionasse, mas e-mail e senha continuam ali logo abaixo — enquanto o contrário (mostrar um
     * botão que estoura) tira a pessoa da tela e a devolve com um erro que ela não pode resolver.
     */
    return []
  }
}
