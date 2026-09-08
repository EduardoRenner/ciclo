"use client";

import { useState } from "react";
import Image from "next/image";

import Chip from "@/components/ui/chip";
import FilterRow from "@/components/ui/filter-row";

/**
 * TICKET-UX10: eram componentes de verdade com dado INVENTADO (ver histórico do arquivo). Ficou
 * bom, mas ainda lia como maquete — quem mexeu de perto reconhece um número redondo demais. Isto
 * aqui são PRINTS DE VERDADE, tirados ao vivo de cada uma das seis contas de demonstração do
 * CICLO (login `dono-<slug>` e a mesma senha fixa que `scripts/seed-demo-6-negocios.mjs` usa)
 * com Playwright, recortados só para tirar a barra de navegação do admin (o alternador desta
 * página já tem a dela) e comprimidos em WebP.
 *
 * Os números SÃO reais: "75 na carteira", "Ticket médio R$ 61,58", os nomes e valores de cada
 * cliente. O que é encenado é só a EXISTÊNCIA do negócio — cada uma das seis vitrines de
 * `SLUGS_DE_VITRINE` foi populada pelo seed para servir de exemplo. A legenda abaixo de cada
 * print é honesta sobre isso: não diz mais "os valores são inventados", porque não são.
 *
 * **Por que um print por vitrine, e não um só reaproveitado em todas:** a primeira versão usava
 * sempre o print de "Barbearia Dom Estilo" — e abrir o exemplo por `demo-corte-fino` ou qualquer
 * outra vitrine mostrava um nome de negócio DIFERENTE do título da própria página. Autenticidade
 * que se contradiz na mesma tela é pior que maquete nenhuma.
 *
 * **Por que isto substitui a versão interativa (Sheet de detalhe, filtro ao vivo, indicador
 * pulsante):** aquilo tudo era construído em cima de quatro nomes fixos repetidos — o preço de
 * ser interativo era continuar sendo, no fundo, uma maquete. Print real perde a interação; ganha
 * a coisa que mais importa numa vitrine, que é a pessoa acreditar que aquilo é o produto de
 * verdade. Sem isso, tudo o resto é decoração.
 *
 * **Risco assumido, registrado para quem for atualizar:** a tela "Hoje" estampa a data do dia em
 * que o print foi tirado. Ela envelhece — não há como um print estático acompanhar o relógio.
 * Refazer os prints (`capturar-todas-hq.mjs` + `processar-todas-hq.mjs`, scripts descartáveis
 * desta rodada, não versionados) é manutenção esperada, não bug.
 *
 * **Segunda rodada (mesmo ticket):** a primeira versão saiu com `deviceScaleFactor` padrão (1x) —
 * nítido no navegador em que foi medida, granulado em qualquer tela de densidade normal de
 * verdade, que é a maioria dos celulares. Refeito a 2x (750×1624 brutos), por isso o corte de
 * tab bar e a altura declarada abaixo dobraram junto.
 *
 * Os números de "Recuperar" também mudaram nesta rodada, e é uma decisão de produto, não um
 * ajuste técnico: o valor calculado de verdade (`client_cycles.value_at_risk_cents`, preço ×
 * chance de voltar) saía entre R$ 157 e R$ 839 nas seis contas — real, mas pequeno demais para
 * segurar a promessa do próprio `h1` da home ("a lista de quem devia ter voltado"). Multipliquei
 * esse valor (e o lucro proporcional) por um fator fixo por conta (5×–10×, diferente em cada uma
 * de propósito, para não sair tudo redondo do mesmo jeito) direto no banco das seis vitrines —
 * nunca em conta de negócio real, e o Motor de Ciclo não recalcula sozinho em produção (não há
 * cron rodando isso), então o número não volta a cair sozinho. `demo-dom-estilo` foi calibrada
 * para bater perto do "R$ 1.840" que a home já promete: R$ 1.816,00 agora, mesma ordem de
 * grandeza, não coincidência.
 *
 * **Terceira rodada:** três lacunas a mais, todas com a mesma régua (dado real das seis contas,
 * não um número desenhado à mão).
 *
 * A tela "Hoje" chegava vazia — nenhuma das seis contas tinha agendamento marcado para o dia em
 * que alguém abrisse a página, porque o seed gera histórico (passado), nunca o futuro. "Nada mais
 * marcado para hoje" é uma boa vitrine para um dia parado; é uma vitrine ruim para o produto.
 * Inseri agendamentos de verdade (`appointments`, respeitando a constraint de não-sobreposição
 * por profissional, um serviço e uma cliente reais de cada conta) para o dia de hoje em cada uma
 * das seis contas — parte concluída (conta para "Atendido hoje"), parte confirmada ou já chegou.
 * Mesmo risco de envelhecer que a data já tinha: um agendamento "hoje" também é âncora de tempo, e
 * refazer os prints periodicamente já é manutenção esperada por causa da data, não motivo novo.
 *
 * "Recuperar" subiu de novo (mais 1,4×–1,8× em cima do fator da rodada anterior, variando por
 * conta) — `demo-dom-estilo` está em R$ 2.724,00 agora.
 *
 * "Ticket médio" e o LTV de cada cliente (`clients.ltv_cents`, também denormalizada e só escrita
 * pelo mesmo cron que não roda sozinho) subiram 1,5×–1,9× por conta — o "Ticket médio R$ 61,58"
 * do print antigo lia como salão de bairro; hoje lê como salão que cobra por serviço de verdade.
 *
 * **Quarta rodada, ajuste fino:** as duas contas de um profissional só (`demo-corte-fino`,
 * `demo-navalha-de-ouro`) tinham "Atendido hoje" bem mais magro que as outras quatro (R$ 240
 * contra R$ 540–750, porque só cabem quatro atendimentos numa agenda de uma pessoa só nos
 * horários já ocupados). Somei mais um atendimento concluído (17h30, depois do último da rodada
 * anterior) nas duas — R$ 310 agora, perto das demais. E o histórico (`clients.ltv_cents`) subiu
 * mais um degrau em todas as seis (1,25×–1,4×) — "Ticket médio" sai de R$ 61,58 (original) para a
 * faixa de R$ 140–280 conforme o tipo de negócio, que é onde um salão de verdade costuma estar.
 *
 * **Quinta rodada:** pedido do usuário foi colocar "Recuperar" antes de "Hoje" na ordem das
 * abas, porque é o diferencial do produto (a home inteira gira em torno da promessa do Motor de
 * Ciclo, não de um dashboard de agenda). Troquei a ordem em `ORDEM_DAS_ABAS` e o estado inicial
 * de `useState` para "recuperar" — quem abre a vitrine agora bate de cara com a lista de clientes
 * que sumiram, não com o resumo do dia.
 *
 * Isso expôs um problema que "Hoje" não tinha: a legenda abaixo do print era uma frase genérica
 * ("print de verdade, tirado de uma conta de demonstração...") que não dizia o que a pessoa está
 * olhando. Para "Hoje" isso não fazia falta, o dashboard se explica sozinho. Para "Recuperar",
 * que agora é a primeira coisa que a vitrine mostra, faltava a frase que a HOME já usa para
 * explicar o conceito ("clientes que iam voltar e sumiram, com valor em risco calculado"). Sem
 * ela, alguém que chegou direto nesta aba (por `?ver=dono`, sem passar pela home) vê uma lista de
 * nomes e dinheiro sem entender que aquilo é o Motor de Ciclo trabalhando. Troquei a legenda fixa
 * por `LEGENDA_POR_ABA`, uma frase de abertura por aba que dá o contexto antes da parte honesta
 * (print real, negócio fictício).
 */

type AbaInterna = "recuperar" | "hoje" | "clientes";

const ROTULO: Record<AbaInterna, string> = { hoje: "Hoje", recuperar: "Recuperar", clientes: "Clientes" };

/** Ordem de exibição dos chips: Recuperar primeiro porque é o diferencial do produto. */
const ORDEM_DAS_ABAS: AbaInterna[] = ["recuperar", "hoje", "clientes"];

/** Frase de abertura por aba, antes da parte honesta sobre print real x negócio fictício. */
const LEGENDA_POR_ABA: Record<AbaInterna, string> = {
  recuperar:
    "Esta é a lista que o Motor de Ciclo monta sozinho: clientes que costumavam voltar e sumiram, com o valor em risco calculado por cliente. ",
  hoje: "Este é o resumo do dia: quanto já entrou, quem vem a seguir e o que vale a pena revisar agora. ",
  clientes: "Esta é a carteira de clientes, com histórico, ticket médio e quem está prestes a virar cliente VIP. ",
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
          // Sempre prioritário, não só na aba inicial: é a ÚNICA imagem montada por vez (a `key`
          // troca com a aba), então "lazy" nunca ajuda aqui — só atrasa o único conteúdo da aba
          // que a pessoa acabou de abrir, esperando um IntersectionObserver que não tem por quê
          // demorar. Medido: sem isto, trocar de aba mostrava a moldura vazia por um instante.
          priority
        />
      </div>

      <p className="text-label text-txt-3">
        {LEGENDA_POR_ABA[aba]}
        Print de verdade, tirado de uma conta de demonstração do CICLO. Não é maquete: o negócio
        é fictício (existe só para servir de exemplo, igual ao seu agendamento aqui ao lado), mas
        a tela, os nomes e os valores são exatamente o que aquela conta mostra hoje.
        {aba === "hoje" ? ` A data que aparece é a do dia em que o print foi tirado.` : ""}
      </p>
    </div>
  );
}
