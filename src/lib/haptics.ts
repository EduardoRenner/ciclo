'use client'

import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

/**
 * T4 (docs/64 §0.4): capacidade nativa genuína e barata — reforça fisicamente uma ação que já
 * mudou na tela (o toque otimista da agenda, feature H desta mesma sessão). Fora do app nativo,
 * `Capacitor.isNativePlatform()` é `false` e a função não faz nada — nunca lança, nunca atrasa a
 * ação real, que já aconteceu na tela antes de o vibrar sequer começar.
 */
export async function vibrarConfirmacao(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    // Aparelho sem suporte a haptics, ou permissão recusada — nunca é motivo pra travar a ação.
  }
}
