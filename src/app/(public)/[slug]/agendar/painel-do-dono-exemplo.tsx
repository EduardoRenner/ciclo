"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

import Chip from "@/components/ui/chip";
import FilterRow from "@/components/ui/filter-row";

/**
 * A visão de quem atende, em prints das seis contas de demonstração (`SLUGS_COM_PRINT`). Um print
 * por vitrine, porque o nome do negócio na tela tem que ser o do título da página.
 *
 * Os dados são FICTÍCIOS e foram semeados para a demonstração (`scripts/seed-demo-6-negocios.mjs`
 * e afins); a tela é a do CICLO de verdade. A legenda diz isso sem rodeio: já houve texto aqui
 * afirmando que os valores eram "exatamente o que aquela conta mostra", e não eram.
 *
 * Como refazer (manutenção esperada, a tela "Hoje" mostra a data em que foi capturada): painel em
 * tema CLARO, viewport 375x812 a 2x, corte de 1444 px de altura (tira a barra de abas do admin),
 * WebP em `public/exemplo/<slug>-<aba>.webp`. `recuperar-topo` (750x580) é o recorte do topo de
 * Recuperar, usado fora daqui.
 */

type AbaInterna = "recuperar" | "hoje" | "clientes";

const ROTULO: Record<AbaInterna, string> = { hoje: "Hoje", recuperar: "Recuperar", clientes: "Clientes" };

/** Ordem de exibição dos chips: Recuperar primeiro porque é o diferencial do produto. */
const ORDEM_DAS_ABAS: AbaInterna[] = ["recuperar", "hoje", "clientes"];

/** O que a pessoa está olhando e por que importa, uma frase por aba. */
const LEGENDA_POR_ABA: Record<AbaInterna, string> = {
  recuperar: "Quem passou da hora de voltar, pelo nome, com quanto cada um costuma deixar. É daqui que você chama de volta.",
  hoje: "O dia num relance: quem vem a seguir, quanto já entrou e o que pede atenção.",
  clientes: "Cada cliente com o histórico de visitas e o ticket médio, e quem está sumindo.",
};

/** Altura real do recorte, em pixels de 2x (1624 de viewport menos a tab bar do admin). */
const ALTURA_DO_PRINT = 1444;

/**
 * As seis vitrines de verdade. `dom-rocha` (último recurso de `SLUGS_DE_VITRINE`, só existe fora
 * de produção) cai no `?? SLUG_PADRAO` abaixo — não vale gerar print de uma conta que a própria
 * `demonstracao.ts` documenta como "não existe mais em produção".
 */
const SLUGS_COM_PRINT = [
  "demo-navalha-de-ouro",
  "demo-corte-fino",
  "demo-dom-estilo",
  "demo-studio-bella",
  "demo-salao-encanto",
  "demo-espaco-vitoria",
];
const SLUG_PADRAO = "demo-dom-estilo";

export default function PainelDoDonoExemplo({ slug }: { slug: string }) {
  const [aba, setAba] = useState<AbaInterna>("recuperar");
  const slugDoPrint = SLUGS_COM_PRINT.includes(slug) ? slug : SLUG_PADRAO;

  return (
    <div className="flex flex-col gap-4">
      <FilterRow rotulo="Trocar de tela">
        {ORDEM_DAS_ABAS.map((chave) => (
          <Chip key={chave} ligado={aba === chave} onClick={() => setAba(chave)}>
            {ROTULO[chave]}
          </Chip>
        ))}
      </FilterRow>

      <div className="overflow-hidden rounded-[var(--radius)] border border-line-2 shadow-elevado">
        <Image
          key={aba}
          src={`/exemplo/${slugDoPrint}-${aba}.webp`}
          alt={`Tela "${ROTULO[aba]}" do painel do CICLO, aberta numa conta de demonstração`}
          width={750}
          height={ALTURA_DO_PRINT}
          className="block h-auto w-full"
          // Sem `sizes`, o next/image assume 100vw e pede o balde mais largo do `deviceSizes` em
          // qualquer monitor grande — mas o container (`agendar/page.tsx`) trava em
          // `max-w-[560px] px-[18px]`, então a imagem nunca passa de ~524px de largura CSS, em
          // tela nenhuma. Mesmo achado de `selo.tsx`/`topbar.tsx` (docs/DECISOES.md 2026-09-19),
          // versão "container com teto", não "tamanho fixo pequeno".
          sizes="(min-width: 560px) 524px, calc(100vw - 36px)"
          // Sempre prioritário, não só na aba inicial: é a ÚNICA imagem montada por vez (a `key`
          // troca com a aba), então "lazy" nunca ajuda aqui — só atrasa o único conteúdo da aba
          // que a pessoa acabou de abrir, esperando um IntersectionObserver que não tem por quê
          // demorar. Medido: sem isto, trocar de aba mostrava a moldura vazia por um instante.
          priority
        />
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-corpo text-txt-2">{LEGENDA_POR_ABA[aba]}</p>
        <p className="text-label text-txt-3">
          Dados fictícios, tela real do CICLO.
          {aba === "hoje" ? " A data é a do dia em que a tela foi capturada." : ""}
        </p>
      </div>

      <Link
        href="/cadastro"
        className="inline-flex h-12 w-full items-center justify-center rounded-[var(--radius-sm)] bg-acc px-5 text-corpo font-semibold text-on-acc shadow-elevado transition duration-[var(--dur-1)] hover:brightness-110 active:scale-[.97]"
      >
        Criar minha conta
      </Link>
    </div>
  );
}
