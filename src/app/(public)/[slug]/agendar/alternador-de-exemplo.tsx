"use client";

import { useState } from "react";

/**
 * Só existe nas seis vitrines de `SLUGS_DE_VITRINE` — quem chega por `?servico=` ou por um link
 * direto de indicação nunca vê esta escolha, porque a pergunta "cliente ou dono" só faz sentido
 * para quem está avaliando o produto, não para quem já está marcando um horário de verdade.
 *
 * Os dois lados ficam MONTADOS o tempo todo (só a visibilidade alterna): trocar de aba não pode
 * perder o que a pessoa já escolheu do lado do cliente, e desmontar/remontar a `Agendar` a cada
 * troca reiniciaria a busca de disponibilidade à toa.
 */
export default function AlternadorDeExemplo({
  abaInicial = "cliente",
  visaoCliente,
  visaoDono,
}: {
  /** `?ver=dono` da home decide isso no servidor; sem o parâmetro, abre em "cliente" como sempre. */
  abaInicial?: "cliente" | "dono";
  visaoCliente: React.ReactNode;
  visaoDono: React.ReactNode;
}) {
  const [aba, setAba] = useState<"cliente" | "dono">(abaInicial);

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" className="grid grid-cols-2 gap-2 rounded-[var(--radius)] bg-surface-2 p-1">
        {(
          [
            { chave: "cliente", rotulo: "O que a cliente vê" },
            { chave: "dono", rotulo: "O que você vê" },
          ] as const
        ).map((opcao) => (
          <button
            key={opcao.chave}
            type="button"
            role="tab"
            aria-selected={aba === opcao.chave}
            onClick={() => setAba(opcao.chave)}
            className={
              "flex h-12 items-center justify-center rounded-[var(--radius-sm)] text-secundario font-semibold transition duration-[var(--dur-1)] " +
              (aba === opcao.chave ? "bg-surface text-txt shadow-elevado" : "text-txt-2 hover:text-txt")
            }
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>

      <div hidden={aba !== "cliente"}>{visaoCliente}</div>
      <div hidden={aba !== "dono"}>{visaoDono}</div>
    </div>
  );
}
