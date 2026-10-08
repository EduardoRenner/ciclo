/**
 * A chave que abre o pacote Advocacia para contas novas (docs/101 §6.6, T0.6).
 *
 * Desligada. Enquanto estiver assim, a linha `advocacia` existe no catálogo (0102) mas o cadastro
 * não a oferece e o servidor recusa quem tentar pela API: o pacote só é alcançado pelo
 * escritório-modelo, criado por script. Ligar é decisão do Eduardo, depois do checklist "pode entrar
 * dado real" (docs/101 anexo 02 §7) inteiro verde e da revisão jurídica do adendo.
 *
 * Arquivo próprio, com uma constante só, pelo mesmo motivo de `core/billing/acesso-aberto.ts`: o
 * teste troca o valor com `vi.mock('@/core/pacotes/advocacia-aberta', () => ({ ADVOCACIA_ABERTA: true }))`
 * sem mexer em mais nada.
 */
export const ADVOCACIA_ABERTA = false
