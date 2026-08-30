import Image from 'next/image'
import Link from 'next/link'

import wordmark from '../../../../public/marca/ciclo-wordmark-aqua.png'

/**
 * L-7, `docs/31-LANCAMENTO-AUDITORIA-E-PLANO.md` — o CICLO processa **dado de saúde** (anamnese,
 * `health_records`, cofre cifrado), que a LGPD trata como dado sensível (art. 5º II, art. 11), e
 * até 2026-08-30 não havia política de privacidade nenhuma.
 *
 * **Cada afirmação aqui corresponde a algo que existe no código**, e foi conferida contra ele:
 *
 *   - "cifrado com chave que não fica junto do banco" → `VAULT_KEK`, `src/server/services/vault`;
 *   - "só quem tem permissão abre, e todo acesso fica registrado" → `vault_access_log`;
 *   - "o telefone é guardado embaralhado" → `PHONE_HASH_SALT`, `phone_hash`;
 *   - "cada salão só enxerga o próprio dado" → RLS com `force row level security` em toda tabela,
 *     com teste de isolamento que quebra o build;
 *   - "dá para exportar e apagar" → `/api/v1/clients/[id]/data-export` e `.../erase`;
 *   - "quando você apaga, some da trilha também" → a eliminação alcança `audit_log` e
 *     `idempotency_keys` (achado da rodada 2 da super auditoria).
 *
 * Nada aqui descreve intenção futura. Se uma frase deixar de ser verdade no código, ela sai daqui
 * junto — política de privacidade que promete o que o sistema não faz é a pior classe de promessa
 * vazia desta base, porque a consequência é legal e não só de produto.
 */
export const metadata = {
  title: 'Política de Privacidade',
  description: 'Que dados o CICLO guarda, por quê, por quanto tempo, e o que você pode pedir a qualquer momento.',
}

const ATUALIZADO_EM = '30 de agosto de 2026'

export default function Privacidade() {
  return (
    <main className="mx-auto min-h-dvh max-w-[720px] px-[var(--gutter)] pb-16">
      <header className="flex items-center justify-between py-5">
        <Link href="/" aria-label="CICLO — início">
          <Image src={wordmark} alt="CICLO" className="h-7 w-auto" />
        </Link>
        <Link
          href="/entrar"
          className="flex h-12 items-center px-1 text-corpo font-semibold text-acc-2 transition active:scale-[.97]"
        >
          Entrar
        </Link>
      </header>

      <h1 className="mt-6 text-titulo font-bold">Política de Privacidade</h1>
      <p className="mt-1 text-secundario text-txt-3">Atualizado em {ATUALIZADO_EM}</p>

      <div className="mt-8 flex flex-col gap-7 text-corpo text-txt-2 [&_h2]:text-corpo [&_h2]:font-semibold [&_h2]:text-txt [&_p]:mt-2 [&_li]:mt-1.5">
        <section>
          <h2>Em uma frase</h2>
          <p>
            A gente guarda o que precisa para o sistema funcionar para você, cada salão só enxerga
            o próprio dado, dado de saúde fica cifrado, e você pode levar tudo embora ou apagar
            quando quiser.
          </p>
        </section>

        <section>
          <h2>1. Quem é responsável pelo quê</h2>
          <p>
            Existem duas relações diferentes aqui, e vale separar:
          </p>
          <ul className="mt-2 list-disc pl-5">
            <li>
              <strong className="font-semibold text-txt">Sobre você, profissional:</strong> quem
              decide o que guardar é o CICLO. Somos o controlador dos seus dados de cadastro.
            </li>
            <li>
              <strong className="font-semibold text-txt">Sobre os seus clientes:</strong> quem
              decide o que guardar é você. Você é o controlador, e o CICLO é apenas o operador —
              a gente só processa o que você mandou guardar, do jeito que você mandou.
            </li>
          </ul>
          <p>
            Na prática isso significa que a autorização das pessoas que você cadastra é sua
            responsabilidade, e a segurança de como isso é guardado é nossa.
          </p>
        </section>

        <section>
          <h2>2. O que a gente guarda</h2>
          <ul className="mt-2 list-disc pl-5">
            <li>
              <strong className="font-semibold text-txt">Do seu negócio:</strong> nome, e-mail,
              telefone, nome do estabelecimento, serviços, preços, horário de funcionamento e
              profissionais.
            </li>
            <li>
              <strong className="font-semibold text-txt">Dos seus clientes:</strong> o que você
              cadastrar — em geral nome, telefone, aniversário, histórico de atendimento,
              preferências e observações.
            </li>
            <li>
              <strong className="font-semibold text-txt">Dado de saúde, quando você usa a ficha de anamnese:</strong>{' '}
              alergia, condição de saúde e o que mais você anotar ali. É dado sensível pela LGPD e
              recebe tratamento diferente — ver o item 4.
            </li>
            <li>
              <strong className="font-semibold text-txt">De uso:</strong> registros técnicos de
              acesso e erro, para manter o sistema no ar e investigar problema.
            </li>
          </ul>
          <p>
            A gente <strong className="font-semibold text-txt">não</strong> pede nem guarda dado de
            cartão de crédito.
          </p>
        </section>

        <section>
          <h2>3. Por que a gente guarda</h2>
          <p>
            Para executar o contrato que você fez com a gente: manter sua agenda, calcular o ciclo
            de retorno de cada cliente, montar sua página pública de agendamento, fechar seu caixa
            e dar suporte quando algo dá errado. Também guardamos o mínimo necessário para cumprir
            obrigação legal e para defender direitos, se for preciso.
          </p>
          <p>
            A gente não vende sua base, não cede para terceiro e não usa seus dados nem os dos seus
            clientes para anunciar nada a ninguém.
          </p>
        </section>

        <section>
          <h2>4. Como a gente protege</h2>
          <ul className="mt-2 list-disc pl-5">
            <li>
              <strong className="font-semibold text-txt">Cada salão só enxerga o próprio dado.</strong>{' '}
              O isolamento é feito no banco, não só na tela, e existe um teste automático que
              impede o sistema de subir se alguma tabela nova ficar de fora.
            </li>
            <li>
              <strong className="font-semibold text-txt">Dado de saúde fica cifrado</strong>, com a
              chave guardada separada do banco. Só quem tem permissão abre, e{' '}
              <strong className="font-semibold text-txt">todo acesso fica registrado</strong> — dá
              para saber quem abriu a ficha de quem, e quando.
            </li>
            <li>
              <strong className="font-semibold text-txt">Telefone de cliente é guardado também de
              forma embaralhada</strong>, para que a busca funcione sem espalhar o número.
            </li>
            <li>Tudo trafega por conexão cifrada, e os servidores ficam no Brasil.</li>
            <li>Dado de saúde nunca vai para registro de erro nem para ferramenta de análise.</li>
          </ul>
        </section>

        <section>
          <h2>5. Com quem a gente compartilha</h2>
          <p>
            Só com quem é necessário para o serviço existir, e cada um vê apenas o que precisa:
            a empresa que hospeda o sistema, a que hospeda o banco de dados, e — quando você usa
            envio de mensagem ou e-mail — o serviço que entrega essa mensagem.
          </p>
          <p>
            Podemos compartilhar também se a lei ou uma ordem judicial exigir. Fora isso, ninguém
            mais.
          </p>
        </section>

        <section>
          <h2>6. Por quanto tempo</h2>
          <p>
            Enquanto sua conta existir. Quando você apaga um cliente, os dados pessoais dele são
            eliminados —{' '}
            <strong className="font-semibold text-txt">inclusive de dentro dos registros internos</strong>{' '}
            de auditoria, e não só da ficha visível.
          </p>
          <p>
            Alguns registros de movimentação (agendamento, caixa, estoque) não são apagados, porque
            são o histórico do seu negócio — mas passam a não identificar mais a pessoa.
          </p>
        </section>

        <section>
          <h2>7. Seus direitos, e onde clicar</h2>
          <p>Pela LGPD você pode, a qualquer momento:</p>
          <ul className="mt-2 list-disc pl-5">
            <li>saber quais dados a gente tem;</li>
            <li>corrigir o que estiver errado;</li>
            <li>pedir uma cópia — cada ficha de cliente tem exportação dentro do sistema;</li>
            <li>pedir a eliminação — cada ficha tem o botão de apagar, e ele apaga de verdade;</li>
            <li>revogar uma autorização que tenha dado;</li>
            <li>saber com quem a gente compartilhou.</li>
          </ul>
          <p>
            Para os seus próprios dados de cadastro, ou para qualquer pedido que a tela não
            resolva, fale com a gente pelo canal em que você contratou. A gente responde e cumpre.
          </p>
        </section>

        <section>
          <h2>8. Se algo vazar</h2>
          <p>
            Se acontecer um incidente que possa trazer risco para você ou para seus clientes, a
            gente avisa você e a Autoridade Nacional de Proteção de Dados, dizendo o que aconteceu,
            o que foi afetado e o que estamos fazendo.
          </p>
        </section>

        <section>
          <h2>9. Mudanças</h2>
          <p>
            Se esta política mudar, a data no topo muda junto e a gente avisa dentro do sistema.
          </p>
        </section>
      </div>

      <footer className="pt-10 text-center text-label text-txt-3">
        <Link href="/termos" className="toque-48 font-semibold text-txt-2 underline underline-offset-2">
          Termos de uso
        </Link>
        <span className="mx-2" aria-hidden>
          ·
        </span>
        <Link href="/precos" className="toque-48 font-semibold text-txt-2 underline underline-offset-2">
          Preços
        </Link>
      </footer>
    </main>
  )
}
