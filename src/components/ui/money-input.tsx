'use client'

import Input from './input'

type Props = Omit<React.ComponentPropsWithoutRef<'input'>, 'id' | 'value' | 'onChange' | 'type'> & {
  rotulo?: string
  ajuda?: string
  erro?: string
  /** Valor em centavos — a única forma que o resto do sistema aceita (regra 3 do CLAUDE.md). */
  centavos: number
  aoMudar: (centavos: number) => void
  className?: string
}

/**
 * `MoneyInput` de `03-DESIGN-SYSTEM §4` — obrigatório desde o começo e nunca
 * feito; até aqui cada tela pedia reais em texto e convertia na mão.
 *
 * Digita-se **só dígito**, e o valor entra pela direita: `3` → 0,03; `35` →
 * 0,35; `3590` → 35,90. É como o teclado de valor de banco funciona, e elimina
 * de uma vez a dúvida de vírgula/ponto e o estado intermediário inválido — não
 * existe "35," pela metade, o estado é sempre um inteiro de centavos.
 */
export default function MoneyInput({ rotulo = 'Valor', centavos, aoMudar, ...props }: Props) {
  const texto = (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <Input
      {...props}
      rotulo={rotulo}
      type="text"
      inputMode="numeric"
      prefixo="R$"
      value={texto}
      onChange={(e) => {
        const digitos = e.target.value.replace(/\D/g, '').slice(0, 11)
        aoMudar(digitos === '' ? 0 : Number(digitos))
      }}
      classNameCampo="tabular"
    />
  )
}
