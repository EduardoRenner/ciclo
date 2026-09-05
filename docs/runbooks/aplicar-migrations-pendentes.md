# Runbook · aplicar as migrations pendentes em produção

**Situação em 2026-09-04.** O repositório está em `0061`. A produção
(`eqzlvthzdjnsbogymcsw`, atrás de `seuciclo.com.br`) está em **`0058`** — conferido no próprio
livro de migrations, não por sondagem de schema:

```sql
select version, name from supabase_migrations.schema_migrations order by version desc limit 3;
```

Faltam três: `0059_pricing_model_quote`, `0060_vocab_sem_genero`, `0061_pedido_de_orcamento`.
Neste projeto a aplicação em produção é manual — a CI só aplica em banco efêmero (`docs/DECISOES.md`
sobre a 0040).

## Por que isto tem ORDEM, e não é só "está pendente"

O código que CONSOME essas três já está no `main` desde o PR #67. Duas consequências, e a segunda
é a que importa:

1. **Serviço sob orçamento e pedido de orçamento estão inertes.** O código existe, o banco não tem
   `pricing_model = 'quote'` nem `status = 'requested'`, então o recurso não aparece. Sintoma
   silencioso, não quebra nada.

2. **A `0060` virou pré-requisito, não melhoria.** O vocabulário por profissão já está ligado no
   painel (`VocabularioProvider` no `admin/layout.tsx`), e ele lê `professions.vocab`. Sem a `0060`,
   nove profissões ainda guardam valor **só no masculino** — barbeiro, tatuador, fotógrafo,
   jardineiro, professor, psicólogo, técnico, aluno, tutor.

   **Hoje isso não chega em ninguém**, e foi medido: os seis tenants de produção têm
   `profession_id` nulo e `vocab_override` vazio, então `resolverVocabulario` cai no `PADRAO`
   ("cliente", "profissional"). Nenhuma palavra com gênero é renderizada.

   **Mas `onboarding.ts:92` grava `profession_id` quando a pessoa escolhe profissão no cadastro.**
   O primeiro cadastro real que escolher "barbearia" passa a ler `vocab->>'profissional' =
   'barbeiro'` — e o produto chama a barbeira de barbeiro, no rótulo "Filtrar por barbeiro" da
   agenda e no campo "Barbeiro" do orçamento. É o T8 do `docs/20` e exatamente o que a
   `copy-nao-supoe-genero` existe para impedir; aquela guarda não pega porque o valor mora em seed
   SQL, não em TypeScript.

**Conclusão: aplicar a `0060` ANTES do primeiro cadastro real com profissão.** As outras duas podem
esperar sem risco.

## O que rodar

Cada bloco é o conteúdo da migration mais o registro no livro, numa transação só. O `version` segue
o formato `YYYYMMDDHHMMSS` que as anteriores usam; ajuste para o instante em que rodar.

Pelo SQL Editor do painel do Supabase, ou por `psql` com a connection string do projeto.

### 1. `0059_pricing_model_quote`

```sql
begin;
alter table services drop constraint if exists services_pricing_model_check;
alter table services
  add constraint services_pricing_model_check
  check (pricing_model in ('fixed', 'hourly', 'visit_hourly', 'daily', 'quote'));
insert into supabase_migrations.schema_migrations (version, name)
  values ('<YYYYMMDDHHMMSS>', '0059_pricing_model_quote');
commit;
```

O `comment on column services.price_cents` da migration é documentação e pode ir junto ou ficar de
fora sem consequência.

### 2. `0060_vocab_sem_genero` — a prioritária

O arquivo tem seis `update` idempotentes (cada um filtra pelo valor antigo no `where`, então rodar
duas vezes não faz nada na segunda). Copie os seis de `supabase/migrations/0060_vocab_sem_genero.sql`
e feche com o registro no livro.

Confira depois:

```sql
select vocab->>'profissional' as prof, vocab->>'cliente' as cli, count(*)
from professions group by 1, 2 order by 1;
```

Nenhum resultado pode conter `barbeiro`, `fotógrafo`, `jardineiro`, `técnico`, `tatuador`,
`psicólogo`, `professor`, `aluno` ou `tutor`.

### 3. `0061_pedido_de_orcamento`

Copie o arquivo inteiro (ele altera `quotes` e cria um índice parcial) e feche com o registro.

## Depois de aplicar

- `/api/health` não cobre migration, então não espere sinal de lá.
- Para provar a `0059` e a `0061`: um serviço com `pricing_model = 'quote'` passa a aparecer na
  página do salão com o caminho de pedir orçamento (`/[slug]/orcamento`).
- Para provar a `0060`: a consulta de conferência acima.

## Por que não foi aplicada por aqui

A escrita de DDL em produção é barrada pelo classificador de permissões desta sessão, e contornar
não seria correto. O comando fica escrito para quem tiver a credencial.
