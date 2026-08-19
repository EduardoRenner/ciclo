'use client'

import { mascaraTelefone } from '@/lib/formato'

import Input from './input'

type Props = Omit<React.ComponentPropsWithoutRef<'input'>, 'id' | 'value' | 'onChange' | 'type'> & {
  rotulo?: string
  ajuda?: string
  erro?: string
  valor: string
  aoMudar: (valor: string) => void
  className?: string
}

/**
 * `PhoneInput` de `03-DESIGN-SYSTEM §4` — que era obrigatório e nunca existiu.
 * Máscara brasileira aplicada a cada tecla, teclado numérico, e `autoComplete`
 * ligado (sem ele o celular não oferece o número salvo — no agendamento público
 * isso é atrito puro em cima da conversão).
 *
 * A validação de verdade (DDD que existe, E.164) é do servidor,
 * `src/server/services/telefone.ts`: máscara é conforto, não regra. Um número
 * colado com +55 ou com espaços continua chegando lá inteiro.
 */
export default function PhoneInput({ rotulo = 'Telefone', valor, aoMudar, ...props }: Props) {
  return (
    <Input
      {...props}
      rotulo={rotulo}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder="(11) 98765-4321"
      value={valor}
      onChange={(e) => aoMudar(mascaraTelefone(e.target.value))}
      classNameCampo="tabular"
    />
  )
}
