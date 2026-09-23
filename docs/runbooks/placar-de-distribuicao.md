# Placar de distribuição

> `docs/82` §13. Só leitura. Roda no SQL Editor do Supabase de produção (`eqzlvthzdjnsbogymcsw`)
> ou pelo MCP (`execute_sql`). Uma vez por semana, no mesmo dia, e o resultado vai para o
> relatório do mês.

## Quem NÃO entra na conta

Contas de demonstração, revisão de loja e resíduo de teste. Sem este filtro o placar mente: os 6
`demo-*` nasceram no mesmo segundo e têm centenas de agendamentos semeados.

```sql
-- reutilizado pelas consultas abaixo
create temporary view contas_reais as
select t.*
from tenants t
where t.deleted_at is null
  and t.slug !~ '^(demo-|apple-review|teste-|origem-e2e-)'
  and t.slug !~ '^(health|alertas-estoque|recuperar|clientes|risco|teste|pe)-[0-9a-f]{6,}$';
```

## 1 · O funil por canal

Cada linha é um canal (`origem` do link que trouxe a pessoa). `sem origem` = chegou sem link
marcado — digitou o endereço, buscou no Google, ou veio antes de 2026-09-23.

```sql
with criada as (
  select e.tenant_id,
         coalesce(e.meta->'origem'->>'canal', 'sem origem') as canal,
         e.meta->'origem'->>'ref' as ref,
         e.created_at
  from product_events e
  join contas_reais c on c.id = e.tenant_id
  where e.event_type = 'conta_criada'
),
marco as (
  select tenant_id,
         bool_or(event_type = 'base_importada')  as importou,
         bool_or(event_type = 'motor_viu_valor') as viu_valor,
         bool_or(event_type = 'recuperacao_enviada') as mandou_mensagem,
         bool_or(event_type = 'cliente_voltou')  as cliente_voltou
  from product_events
  group by tenant_id
)
select cr.canal,
       count(*)                                          as contas,
       count(*) filter (where m.importou)                as importaram_base,
       count(*) filter (where m.viu_valor)               as motor_viu_valor,
       count(*) filter (where m.mandou_mensagem)         as mandou_mensagem,
       count(*) filter (where m.cliente_voltou)          as cliente_voltou,
       count(*) filter (where c.plan <> 'gratis')        as pagantes
from criada cr
join contas_reais c on c.id = cr.tenant_id
left join marco m on m.tenant_id = cr.tenant_id
group by cr.canal
order by contas desc;
```

## 2 · Quem trouxe quem (indicação e parceiro)

`ref` é o slug do negócio que mandou o convite/selo, ou o código do parceiro. É daqui que sai a
recompensa manual (`docs/82` §11) e a comissão de parceiro (§12).

```sql
select e.meta->'origem'->>'canal' as canal,
       e.meta->'origem'->>'ref'   as quem_trouxe,
       c.slug                     as conta_nova,
       c.plan,
       e.created_at::date         as criada_em
from product_events e
join contas_reais c on c.id = e.tenant_id
where e.event_type = 'conta_criada'
  and e.meta->'origem'->>'ref' is not null
order by e.created_at desc;
```

## 3 · Tempo até o "aha"

Mediana de dias entre criar a conta e a primeira cliente voltar. Se passar de 21 dias, o
onboarding está atrasando o momento que vende.

```sql
select percentile_cont(0.5) within group (order by extract(epoch from (v.primeira - c.primeira)) / 86400) as mediana_dias
from (select tenant_id, min(created_at) primeira from product_events where event_type = 'conta_criada' group by 1) c
join (select tenant_id, min(created_at) primeira from product_events where event_type = 'cliente_voltou' group by 1) v using (tenant_id)
join contas_reais r on r.id = c.tenant_id;
```

## Como ler

- `mandou_mensagem` conta os dois caminhos: o envio pelo sistema e o "Chamar" pelo WhatsApp do
  próprio dono (este só desde 2026-09-23, `registrarChamadaManual`). É a métrica do `docs/56` §8:
  de quem cadastrou, quantos mandaram pelo menos uma mensagem.
- **Amostra pequena não é tendência.** Com menos de 10 contas num canal, o número descreve
  pessoas, não canal — leia as linhas uma a uma.
- **A pergunta é qual canal traz conta que chega a `cliente_voltou`**, não qual traz mais
  cadastro. Canal com muito cadastro e pouca volta é custo de suporte.
- A planilha de leads (`docs/82` §10) guarda o que o banco não vê: visitas, objeções, frase do
  dono. As duas fontes juntas fecham o funil; nenhuma sozinha fecha.
