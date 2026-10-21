-- APR-016b: a venda de pacote é lida por quem já vê o pacote.
--
-- O "Entrou" do Caixa, do Mês, da Hoje e da Ficha passa a somar as vendas de pacote (`payments` com
-- `kind = 'package'`, 0125). Só que `payments_select` abre apenas para quem vê comissão (dono e
-- financeiro): o gerente, que abre o Caixa, e a recepção e o profissional, que abrem a Hoje, veriam
-- um "Entrou" sem as vendas — e o dono, outro número para o mesmo dia.
--
-- Esta política permissiva abre SÓ as linhas de venda de pacote, para quem é membro do negócio. Não
-- expõe nada novo: o mesmo valor já está em `packages.paid_cents`, que `packages_select` mostra a
-- qualquer membro (`has_tenant`). As outras linhas de `payments` (sinal, serviço, clube) continuam
-- só de quem vê comissão.
--
-- Aditiva (amplia leitura), antes do deploy.

drop policy if exists payments_select_venda_de_pacote on public.payments;
create policy payments_select_venda_de_pacote on public.payments for select using (
  kind = 'package'
  and tenant_id = any ((select public.my_tenant_ids())::uuid[])
);
