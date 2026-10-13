/**
 * O banco de produção está atrás do código? — a pergunta que ninguém fazia.
 *
 * Em 05/09/2026 as migrations `0059`, `0060` e `0061` estavam no `main`, com o código que depende
 * delas no ar, e nenhuma aplicada em produção. Quem pedisse orçamento pela página pública levava
 * erro (`professional_id not null` + CHECK antigo em `quotes.status`), e o `vocab` de 10 profissões
 * seguia só no masculino. Nada ficou vermelho: `typecheck`, `lint`, os 1.750 testes e o CI inteiro
 * rodam contra um Supabase LOCAL, que aplica as migrations do disco em toda execução. O local
 * estava sempre certo — e por isso nenhuma guarda podia ver o defeito.
 *
 * A causa a montante era uma promessa falsa: o `docs/05-FAQ-DEV.md` B24 dizia que uma GitHub Action
 * roda `supabase db push` antes do deploy. Ela nunca existiu. Corrigir o texto era metade; a outra
 * metade é esta, porque texto não reprova ninguém.
 *
 * **Por que a constante mora aqui e não é lida do disco:** o bundle da Vercel não carrega
 * `supabase/`, então em produção não há diretório para contar. É o mesmo motivo, e a mesma
 * armadilha, de `core/cron/agendadas.ts` — cópia sem guarda apodrece. Quem confere a cópia contra
 * o disco é `tests/unit/core/schema-esperado-bate-com-o-disco.test.ts`, nas duas direções.
 */

/**
 * Os arquivos de `supabase/migrations/`, sem `.sql`, em ordem. O teste confere contra o disco nas
 * duas direções. APR-030: a comparação era por CONTAGEM — uma migration faltando no meio somada a
 * uma aplicada à mão que o código não conhece dava o mesmo total, e o banco passava como em dia.
 */
export const MIGRATIONS_DO_CODIGO: readonly string[] = [
  '0001_initial',
  '0002_vertical_packs',
  '0003_pack_idempotency',
  '0004_lock_down_helper_functions',
  '0005_tenant_rls_report',
  '0006_profile_on_signup',
  '0007_membership_invites',
  '0008_tolerate_missing_vertical_pack',
  '0009_job_queue_claim',
  '0010_client_segments',
  '0011_health_records_upsert',
  '0012_tickets_closed_at_index',
  '0013_media_bucket',
  '0014_cron_heartbeats',
  '0015_push_subscriptions',
  '0016_push_subscriptions_rls',
  '0017_crm',
  '0018_carteira_resumo',
  '0019_crm_profundo',
  '0020_crm_inovacoes',
  '0021_indices_fk_orfas',
  '0022_professions_catalog',
  '0023_tenant_eixos',
  '0024_appointment_address',
  '0025_tenant_modules',
  '0026_catalogo_profundo',
  '0027_appointment_series',
  '0028_quotes',
  '0029_pricing_model',
  '0030_plan_tier_neutro',
  '0031_profession_onboarding',
  '0032_profiles_fk_auth_users',
  '0033_cor_do_site_por_tenant',
  '0034_debito_carteira_atomico',
  '0035_rate_limit_compartilhado',
  '0036_can_see_appointment_sem_oraculo',
  '0037_reivindicar_job_travado',
  '0038_grants_base_postgrest',
  '0039_grants_funcoes_service_role',
  '0040_planos_essencial_equipe',
  '0041_modules_catalogo',
  '0042_rls_initplan_e_indices_fk',
  '0043_modulo_assistente',
  '0044_memberships_write_sem_select_duplicado',
  '0045_uma_comanda_por_atendimento',
  '0046_redigir_trilha_do_cliente',
  '0047_busca_de_cliente_sem_acento',
  '0048_aniversariante_no_fuso_do_salao',
  '0049_novos_do_mes_no_fuso_do_salao',
  '0050_marcar_orfaos_de_teste_na_trilha',
  '0051_bucket_da_vitrine',
  '0052_foto_de_servico_e_profissional',
  '0053_portfolio_photos',
  '0054_messages_campaign_id',
  '0055_search_path_imutavel_sem_acento',
  '0056_portfolio_photos_fk_indices',
  '0057_packs_hair_tattoo_general',
  '0058_view_clientes_a_recuperar',
  '0059_pricing_model_quote',
  '0060_vocab_sem_genero',
  '0061_pedido_de_orcamento',
  '0062_ledger_de_migrations',
  '0063_ciclo_sem_ciclo_nao_e_um_dia',
  '0064_registro_de_previsao',
  '0065_ciclo_observado',
  '0066_taxa_de_pagamento',
  '0067_lucro_em_risco',
  '0068_indices_fk_de_previsao',
  '0069_o_pack_nao_inventa_custo',
  '0070_lacuna_do_material_congela',
  '0071_serie_mensal_de_lucro',
  '0072_custo_fixo_da_hora',
  '0073_ticket_nao_vaza_entre_profissionais',
  '0074_tenant_keys_so_leitura',
  '0075_as_irmas_da_0073',
  '0076_relatorio_rls_ve_a_base_inteira',
  '0077_cofre_por_coluna',
  '0078_profissao_generica',
  '0079_movimento_de_estoque_nao_cai_junto',
  '0080_historico_nao_se_apaga_pelo_postgrest',
  '0081_rls_capacidade_morta_lote_1',
  '0082_rls_capacidade_morta_lote_2',
  '0083_carteira_e_livro_razao_de_dinheiro',
  '0084_dado_de_saude_e_consentimento_nao_se_apagam',
  '0085_dez_tabelas_param_de_aceitar_delete',
  '0086_delete_segue_o_papel_que_a_rota_exige',
  '0087_pg_cron_como_segunda_rede_do_motor',
  '0088_product_events',
  '0089_resumo_central_de_acoes_em_uma_ida',
  '0090_keep_alive_sem_custo',
  '0091_produto_sugerido_do_servico',
  '0092_ritmo_na_lista_de_recuperar',
  '0093_servico_arquivado_sai_das_telas_de_dinheiro',
  '0094_resolver_previsoes_em_lote',
  '0095_aceite_versionado_dos_termos',
  '0096_ultima_visita_informada_ao_meio_dia',
  '0097_servico_canonico',
  '0098_experimentos_do_dono',
  '0099_link_de_volta_mede_clique_e_agendamento',
  '0100_nota_do_cliente',
  '0102_pacote_advocacia',
  '0103_modulos_do_pacote',
  '0104_legal_pessoas_e_estrutura',
  '0105_legal_casos',
  '0106_legal_checklists',
  '0107_legal_documentos',
  '0108_legal_reunioes_do_caso',
  '0109_legal_intimacoes_e_prazos',
  '0110_legal_rascunho_so_quem_assina_aprova',
  '0111_legal_trilha_do_caso_sigiloso',
  '0112_legal_intimacao_decidir',
  '0113_legal_captura_grava_o_formato_do_nucleo',
  '0114_legal_prazo_confirmacao_so_advocacia',
  '0115_legal_privilegios_minimos',
  '0116_legal_membros_sem_segundo_fator',
  '0117_privilegio_minimo',
  '0121_quem_sumiu_uma_regra',
  '0122_fechar_comanda_numa_transacao',
  '0123_rls_agendamento_uma_vez_por_consulta',
  '0124_rls_comanda_uma_vez_por_consulta',
  '0125_venda_de_pacote_no_caixa',
  '0126_venda_de_pacote_visivel_como_o_pacote',
  '0127_comanda_fechada_congelada',
  '0128_lotes_de_importacao',
  '0129_desfazer_lote_de_importacao',
]

/** Quantos arquivos existem em `supabase/migrations/`. */
export const MIGRATIONS_ESPERADAS = MIGRATIONS_DO_CODIGO.length

/** O nome (sem `.sql`) do arquivo de maior número. */
export const ULTIMA_MIGRATION = MIGRATIONS_DO_CODIGO[MIGRATIONS_DO_CODIGO.length - 1]!

export type EstadoDoSchema = {
  ok: boolean
  detail?: string
}

/**
 * Compara o que o banco diz ter aplicado com o que este código espera.
 *
 * As duas direções não valem o mesmo, e é por isso que só uma fica vermelha:
 *
 * - **Banco ATRÁS do código** é o caso que já custou caro: o código chama coluna, CHECK ou função
 *   que não existe, e o erro aparece para a cliente final, não para quem publicou. Fica `ok:
 *   false`, o `/api/health` devolve 503 e o job `vigia` do `cron.yml` fica vermelho no e-mail.
 * - **Banco À FRENTE do código** é a ordem normal de uma publicação segura (migration aditiva
 *   primeiro, deploy depois) e é o estado esperado durante a janela entre as duas. Marcar isso como
 *   falha ensinaria a fazer na ordem perigosa, e ainda transformaria toda publicação em alarme —
 *   o que `core/cron/agendadas.ts` proíbe por já ter custado dois dias de silêncio.
 */
/**
 * O livro de migrations guarda o nome em DOIS formatos, e a diferença é quem aplicou.
 *
 * O CLI da Supabase (`supabase db push`, `supabase start`, `db reset`) parte o arquivo em duas
 * colunas: `version` recebe o prefixo numérico e `name` recebe só o resto — `0080_historico_...`
 * vira `name = 'historico_...'`. Quem aplica À MÃO pelo SQL Editor escreve o `insert` inteiro, e
 * ali o costume desta casa foi gravar o nome completo, COM prefixo (`docs/runbooks/aplicar-
 * migrations-pendentes.md`).
 *
 * Produção nasceu do segundo jeito e por isso a comparação funcionava. Medido em 2026-09-10 num
 * Supabase local recém-criado pelo CLI, com as 80 migrations aplicadas: `/api/health` respondia
 * **503 dizendo "banco ATRÁS do código: falta a 0080"**, porque `includes` procurava
 * `0080_historico_...` numa lista que só tinha `historico_...`.
 *
 * O estrago não é local: no primeiro `supabase db push` em produção, a migration nova entra SEM
 * prefixo, `ULTIMA_MIGRATION` deixa de casar, e o `/api/health` vira 503 logo depois de uma
 * publicação CORRETA — com o job `vigia` do `cron.yml` vermelho e o banco em dia.
 *
 * Comparar sem o prefixo aceita os dois formatos e não perde poder: o prefixo é ordenação, o nome
 * é a identidade, e dois arquivos nunca compartilham o nome.
 */
function semPrefixo(nome: string): string {
  return nome.replace(/^\d+_/, '')
}

export function compararSchema(aplicadas: readonly string[]): EstadoDoSchema {
  /*
   * Por NOME, nas duas direções (APR-030). Faltando = o código espera e o banco não tem: é o caso
   * que já custou caro, e o texto cita os nomes, não um número. Sobrando = o banco tem e o código
   * não conhece: é a ordem segura de publicar (migration antes do deploy) e fica verde, mas
   * nomeada — sobra que não some depois do deploy é migration aplicada à mão fora do repositório.
   */
  const noBanco = new Set(aplicadas.map(semPrefixo))
  const doCodigo = new Set(MIGRATIONS_DO_CODIGO.map(semPrefixo))
  const faltando = MIGRATIONS_DO_CODIGO.filter((nome) => !noBanco.has(semPrefixo(nome)))
  const sobrando = aplicadas.filter((nome) => !doCodigo.has(semPrefixo(nome)))

  if (faltando.length > 0) {
    const citadas = faltando.slice(0, 5).join(', ') + (faltando.length > 5 ? ` e mais ${faltando.length - 5}` : '')
    return {
      ok: false,
      detail: `banco ATRÁS do código: falta${faltando.length > 1 ? 'm' : ''} ${citadas} (${aplicadas.length} aplicadas, ${MIGRATIONS_ESPERADAS} esperadas). O código no ar depende delas. Aplicar com \`supabase db push\` — não existe Action que faça isso sozinha.`,
    }
  }

  if (sobrando.length > 0) {
    return {
      ok: true,
      detail: `banco à frente do código: ${sobrando.slice(0, 5).join(', ')}${sobrando.length > 5 ? ` e mais ${sobrando.length - 5}` : ''} aplicada(s) e ainda não conhecida(s) por este código. É a ordem segura de publicar (migration antes do deploy); vira problema só se o deploy não vier.`,
    }
  }

  return { ok: true }
}
