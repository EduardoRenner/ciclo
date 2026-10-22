import type { ModoDoCodigo } from '@/server/auth/login-por-numero'
import { AppError } from '@/server/http/errors'

/**
 * Pedir o código de acesso pelo WhatsApp (docs/119).
 *
 * **Só número já cadastrado recebe código**, e a resposta é a MESMA exista o número ou não:
 * - mesmo corpo (`{ enviado: true }`);
 * - mesmos limites, contados ANTES de olhar o cadastro (o 429 não diz nada sobre o número);
 * - falha do envio para número cadastrado também vira a resposta neutra (só o log sabe);
 * - piso de tempo: o envio pelo Twilio leva centenas de milissegundos, a consulta ao banco não.
 *   Sem o piso, o relógio contaria o que o corpo esconde.
 *
 * Nenhuma mensagem sai para número que o CICLO não conhece, e nada aqui manda mensagem que não
 * seja o código pedido pela própria pessoa.
 */
export const PISO_DE_TEMPO_MS = 1500

export type Dependencias = {
  modo: ModoDoCodigo
  limitarPorNumero: () => Promise<boolean>
  temCadastro: () => Promise<boolean>
  enviar: (canal: 'whatsapp' | 'sms') => Promise<{ ok: true } | { ok: false; motivo: string }>
  esperar: (ms: number) => Promise<void>
  agora: () => number
  registrar: (evento: string, extra?: Record<string, unknown>) => void
  janelaDoLimiteSegundos: number
}

export async function pedirCodigoDeAcesso(d: Dependencias): Promise<{ enviado: true }> {
  if (d.modo === 'desligado') throw new AppError('CODE_UNAVAILABLE')

  if (!(await d.limitarPorNumero())) throw AppError.limiteDeTaxa(d.janelaDoLimiteSegundos)

  const inicio = d.agora()
  try {
    if (await d.temCadastro()) {
      const r = await d.enviar(d.modo === 'twilio' ? 'whatsapp' : 'sms')
      if (!r.ok) d.registrar('codigo_de_acesso_nao_enviado', { motivo: r.motivo, modo: d.modo })
      else if (d.modo === 'teste') d.registrar('codigo_de_acesso_modo_teste')
    }
  } catch (e) {
    d.registrar('codigo_de_acesso_falhou', { erro: e instanceof Error ? e.message : 'desconhecido' })
  }

  const falta = PISO_DE_TEMPO_MS - (d.agora() - inicio)
  if (falta > 0) await d.esperar(falta)

  return { enviado: true }
}
