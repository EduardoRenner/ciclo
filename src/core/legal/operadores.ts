/**
 * Os operadores do CICLO: cada empresa que recebe dado pessoal para o produto funcionar (LGPD art. 39
 * e art. 33), numa lista só (docs/86 J2). `/privacidade` lê DAQUI; o mapa em `docs/legal/operadores.md`
 * é a mesma lista com as ressalvas por extenso.
 *
 * **Por que uma constante e não prosa.** A política dizia "os servidores ficam no Brasil" e listava
 * quatro terceiros, enquanto o código falava com mais. Lista escrita à mão numa página envelhece
 * calada, e quem responde por ela é quem a publicou. Aqui a lista tem guarda
 * (`tests/unit/legal/operadores-cobrem-os-terceiros-do-codigo.test.ts`): terceiro novo no código sem
 * linha aqui reprova, linha aqui sem uso no código reprova, e a CSP do navegador tem que bater com
 * `hostsDoNavegador`.
 *
 * **O que NÃO está aqui, de propósito:** PostHog e Upstash têm variável no `.env.example` e nenhuma
 * linha de código (conferido em 03/10/2026), então não recebem dado de ninguém. O agendador (GitHub
 * Actions) só bate nas rotas de rotina e não recebe dado pessoal.
 *
 * `condicao` diz se o envio ACONTECE: `sempre` ou `se_configurado` (só com a credencial no ambiente).
 * Se um serviço `se_configurado` está ligado em produção é fato que o repositório não mostra, e o
 * Eduardo confere no painel de cada um (docs/86 J2). Enquanto não conferir, a política diz "quando
 * ligado", nunca afirma que está.
 */

export type Operador = {
  id: string
  nome: string
  /** O que faz pelo CICLO, em uma frase que a política pode repetir. */
  papel: string
  /** O que o CÓDIGO manda a ele (lido do fonte em 03/10/2026), sem enfeite. */
  dadoQueRecebe: string
  /** Onde processa, como a política vai dizer. */
  onde: string
  /** `true` quando o próprio repositório prova a região (config da região do banco e das funções). */
  ondeConfirmadoNoCodigo: boolean
  condicao: 'sempre' | 'se_configurado'
  /** Aparece na lista pública de `/privacidade`. O assistente externo (desligado) não aparece. */
  naPolitica: boolean
  /** Strings que o serviço deixa no fonte quando é usado (a guarda procura cada uma). */
  marcadores: string[]
  /** Variáveis de ambiente que o ligam; todas têm que existir em `.env.example`. */
  chavesDeAmbiente: string[]
  /** Origens que o NAVEGADOR de quem usa o painel pode chamar por causa dele (a CSP tem que casar). */
  hostsDoNavegador: string[]
  /** Hosts que o SERVIDOR chama por causa dele. */
  hostsDoServidor: string[]
}

export const OPERADORES: readonly Operador[] = [
  {
    id: 'supabase',
    nome: 'Supabase',
    papel: 'guarda o banco de dados, o login e os arquivos (fotos)',
    dadoQueRecebe: 'todo dado que você e seus clientes cadastram, com isolamento por negócio no próprio banco',
    onde: 'Brasil (São Paulo); a empresa é dos Estados Unidos',
    ondeConfirmadoNoCodigo: true,
    condicao: 'sempre',
    naPolitica: true,
    marcadores: ['@supabase/supabase-js', '@supabase/ssr'],
    chavesDeAmbiente: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    hostsDoNavegador: [],
    hostsDoServidor: [],
  },
  {
    id: 'vercel',
    nome: 'Vercel',
    papel: 'hospeda o sistema e roda as funções que atendem cada toque',
    dadoQueRecebe: 'o que passa pelo sistema: cada pedido (com o endereço de rede de quem pediu) e as respostas',
    onde: 'funções em São Paulo; páginas públicas e arquivos estáticos podem sair de qualquer ponto da rede da empresa, que é dos Estados Unidos',
    ondeConfirmadoNoCodigo: true,
    condicao: 'sempre',
    naPolitica: true,
    marcadores: [],
    chavesDeAmbiente: [],
    hostsDoNavegador: [],
    hostsDoServidor: [],
  },
  {
    id: 'mercado_pago',
    nome: 'Mercado Pago',
    papel: 'processa a assinatura do seu plano',
    dadoQueRecebe: 'o e-mail do dono da conta, o plano escolhido e o identificador do negócio; o cartão é digitado no ambiente do Mercado Pago e nunca passa pelo CICLO',
    onde: 'Brasil',
    ondeConfirmadoNoCodigo: false,
    condicao: 'se_configurado',
    naPolitica: true,
    marcadores: ['api.mercadopago.com'],
    chavesDeAmbiente: ['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET'],
    hostsDoNavegador: [],
    hostsDoServidor: ['api.mercadopago.com'],
  },
  {
    id: 'meta_whatsapp',
    nome: 'WhatsApp Business Platform (Meta)',
    papel: 'entrega lembrete e mensagem de recuperação de cliente, quando o envio automático está ligado',
    dadoQueRecebe: 'o telefone de quem recebe e os campos do modelo de mensagem aprovado',
    onde: 'fora do Brasil (Meta, Estados Unidos e Irlanda)',
    ondeConfirmadoNoCodigo: false,
    condicao: 'se_configurado',
    naPolitica: true,
    marcadores: ['graph.facebook.com'],
    chavesDeAmbiente: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_APP_SECRET'],
    hostsDoNavegador: [],
    hostsDoServidor: ['graph.facebook.com'],
  },
  {
    id: 'resend',
    nome: 'Resend',
    papel: 'entrega e-mail do sistema (confirmação de cadastro, recuperação de senha)',
    dadoQueRecebe: 'o e-mail de quem recebe, o assunto e o texto da mensagem',
    onde: 'fora do Brasil (Estados Unidos)',
    ondeConfirmadoNoCodigo: false,
    condicao: 'se_configurado',
    naPolitica: true,
    marcadores: ['api.resend.com'],
    chavesDeAmbiente: ['RESEND_API_KEY'],
    hostsDoNavegador: [],
    hostsDoServidor: ['api.resend.com'],
  },
  {
    id: 'sentry',
    nome: 'Sentry',
    papel: 'avisa quando o sistema dá erro, para a gente consertar',
    dadoQueRecebe: 'o erro e a tela em que ocorreu, com os dados pessoais removidos antes do envio; dado de saúde nunca é enviado',
    onde: 'fora do Brasil (Alemanha ou Estados Unidos, conforme a região da conta)',
    ondeConfirmadoNoCodigo: false,
    condicao: 'se_configurado',
    naPolitica: true,
    marcadores: ['@sentry/nextjs'],
    chavesDeAmbiente: ['SENTRY_DSN', 'NEXT_PUBLIC_SENTRY_DSN'],
    hostsDoNavegador: ['*.ingest.de.sentry.io', '*.ingest.sentry.io'],
    hostsDoServidor: [],
  },
  {
    id: 'web_push',
    nome: 'Serviço de notificação do navegador',
    papel: 'entrega o aviso no aparelho de quem ativou notificação (Google, Apple ou Mozilla, conforme o navegador)',
    dadoQueRecebe: 'o endereço de entrega do aparelho e o aviso, cifrado de ponta a ponta com as chaves do aparelho',
    onde: 'fora do Brasil (conforme o navegador de quem ativou)',
    ondeConfirmadoNoCodigo: false,
    condicao: 'se_configurado',
    naPolitica: true,
    marcadores: ['web-push'],
    chavesDeAmbiente: ['VAPID_PRIVATE_KEY', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY'],
    hostsDoNavegador: [],
    hostsDoServidor: [],
  },
  {
    id: 'hcaptcha',
    nome: 'hCaptcha',
    papel: 'confere que quem agenda pela página pública é uma pessoa',
    dadoQueRecebe: 'o teste resolvido no navegador; hoje desligado, porque não há conta nem chave configurada',
    onde: 'fora do Brasil (Estados Unidos)',
    ondeConfirmadoNoCodigo: false,
    condicao: 'se_configurado',
    // Fora da política enquanto estiver sem credencial E bloqueado pela CSP do navegador (que não lista o
    // hCaptcha): hoje nenhum dado vai para ele. Quando ligar, tem que entrar na CSP e passar para `true`.
    naPolitica: false,
    marcadores: ['hcaptcha.com'],
    chavesDeAmbiente: ['HCAPTCHA_SECRET', 'NEXT_PUBLIC_HCAPTCHA_SITE_KEY'],
    hostsDoNavegador: [],
    hostsDoServidor: ['hcaptcha.com'],
  },
  {
    id: 'gemini',
    nome: 'Google Gemini',
    papel: 'seria o assistente de IA; foi substituído pelo Motor de Inteligência do próprio CICLO',
    dadoQueRecebe: 'nada: nenhuma rota instancia este provedor (conferido em 03/10/2026)',
    onde: 'fora do Brasil',
    ondeConfirmadoNoCodigo: false,
    condicao: 'se_configurado',
    naPolitica: false,
    marcadores: ['generativelanguage.googleapis.com'],
    chavesDeAmbiente: ['AI_API_KEY', 'AI_PROVIDER', 'AI_MODEL'],
    hostsDoNavegador: [],
    hostsDoServidor: ['generativelanguage.googleapis.com'],
  },
]

/** Os que a política mostra, na ordem da lista. */
export const OPERADORES_NA_POLITICA = OPERADORES.filter((o) => o.naPolitica)
