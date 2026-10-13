#!/usr/bin/env bash
# Agente B · reprodução ponta a ponta do 414 em margemDosServicos (caixa.ts:273), SÓ no banco LOCAL,
# só no tenant do agente B (demo-salao-encanto). Insere N comandas fechadas sintéticas (marcadas com
# created_at = 2001-01-01), abre as telas, e APAGA as linhas sintéticas no fim.
set -u
T=320d83de-611f-48e1-9761-570863fbb10b
N=${1:-230}
PSQL="docker exec supabase_db_ciclo psql -U postgres -Atc"
$PSQL "insert into tickets (tenant_id, status, closed_at, created_at, payment_method) select '$T', 'closed', now() - (g || ' hours')::interval, '2001-01-01T00:00:00Z', 'other' from generate_series(1,$N) g" 
$PSQL "select count(*) from tickets where tenant_id='$T' and status in ('closed','paid') and closed_at > now() - interval '90 days'"
node B-repro-414-ver.mjs
for r in; do
  node -e "
    const {cookieHeader}=await import('file:///C:/Users/Usuario/.claude/code/ciclo-aprimoramento/docs/98-aprimoramento/medidas/B-lib-log.mjs');
    const r=await fetch('http://localhost:3200$r',{headers:{cookie:cookieHeader()},redirect:'manual'});
    const t=await r.text();
    const erro=/Algo deu errado|não carregou|Tentar de novo|error-boundary|NEXT_HTTP_ERROR|digest/i.exec(t);
    console.log('$r', r.status, 'bytes', t.length, 'sinal de erro:', erro?erro[0]:'nenhum');
  " --input-type=module
done
$PSQL "delete from tickets where tenant_id='$T' and created_at='2001-01-01T00:00:00Z' and payment_method='other'"
