# 04 · SEGURANÇA E LGPD

Cada item é **verificável**. Marque só quando existir teste, configuração ou documento que prove.

---

### 1. Antes do primeiro cliente real (bloqueante)

#### Isolamento
- [ ] 100% das tabelas com `tenant_id` têm RLS **habilitado e forçado**
- [ ] Teste `tests/rls/isolation.test.ts` cobre todas por introspecção e roda no CI
- [ ] `service_role` só acessível dentro de `withTenant()` (regra de lint ativa)
- [ ] Views com `security_invoker = true` (sem isso a view fura o RLS)
- [ ] Todas as queries também filtram `tenant_id` na aplicação (defesa em profundidade)

#### Autenticação
- [ ] Senha ≥ 10 caracteres, checada contra vazamentos (HIBP k-anonymity)
- [ ] MFA TOTP disponível e **obrigatório** para `owner` e `finance`
- [ ] Access token 15 min, refresh rotativo com detecção de reuso
- [ ] Reautenticação (AAL2) exigida em: exportar base, trocar conta bancária, alterar comissão, abrir cofre, eliminar dados
- [ ] Lista de dispositivos com revogação remota

#### Dados
- [ ] Cofre com envelope encryption (KEK → DEK por tenant → AES-256-GCM por registro)
- [ ] KEK fora do repositório, em variável de ambiente ou KMS
- [ ] Telefone e e-mail com hash para busca; CPF cifrado quando existir
- [ ] Bucket de mídia **privado**, chave aleatória, signed URL de 5 min
- [ ] EXIF removido de toda imagem no upload
- [ ] Backup com PITR de 30 dias e **restauração testada** (com data registrada)

#### Aplicação
- [ ] Toda entrada validada por Zod na borda
- [ ] Nenhum SQL concatenado
- [ ] `Idempotency-Key` obrigatório em mutação de dinheiro e agenda
- [ ] Webhooks com HMAC + janela de replay 5 min + tabela `webhook_events`
- [ ] Rate limit por IP, conta, telefone e endpoint
- [ ] CAPTCHA invisível + honeypot no booking público, cadastro e recuperação de senha
- [ ] CSP sem `unsafe-inline` (nonce), HSTS com preload, `frame-ancestors 'none'`
- [ ] Upload validado por magic bytes, reprocessado, limite de 10 MB
- [ ] Sentry com scrubbing de PII, com teste que injeta e verifica a redação
- [ ] SAST + secret scanning + SCA no CI, com bloqueio em severidade alta
- [ ] `npm audit` / Snyk sem vulnerabilidade alta em produção

#### Auditoria
- [ ] `audit_log` append-only preenchido em toda mutação relevante
- [ ] `vault_access_log` em toda leitura do cofre, **visível para o dono**
- [ ] Exportação de base: 1×/mês, auditada, com notificação e marca d'água

---

### 2. LGPD — o que precisa existir

| Item | Status | Onde |
|---|---|---|
| Política de Privacidade publicada | ☐ | `/privacidade` |
| Termos de Uso publicados | ☐ | `/termos` |
| **DPA** (contrato de operador) disponível ao cliente | ☐ | PDF no painel |
| Papéis definidos: salão = **controlador**, CICLO = **operador** | ☐ | Contrato + material de venda |
| Encarregado (DPO) nomeado, com e-mail público | ☐ | `privacidade@ciclo.app` |
| ROPA — registro de operações de tratamento | ☐ | `docs/lgpd/ropa.md`, versionado |
| RIPD/DPIA do Cofre | ☐ | `docs/lgpd/ripd-cofre.md` |
| RIPD da IA (antes da V2) | ☐ | |
| Lista pública de suboperadores com país | ☐ | `/subprocessadores` |
| Consentimento granular: saúde / imagem / marketing, separados e revogáveis | ☐ | TICKET-051 |
| Marketing **desligado por padrão** | ☐ | `clients.marketing_opt_in = false` |
| Portal do titular (acesso, correção, portabilidade, eliminação), SLA 15 dias | ☐ | TICKET-054 |
| Política de retenção por tipo de dado, aplicada por job | ☐ | TICKET-054 |
| Runbook de incidente + comunicação à ANPD | ☐ | `docs/runbooks/incidente.md` |
| Simulado de incidente (tabletop) 2×/ano | ☐ | |

#### Retenção padrão

| Dado | Prazo | Depois |
|---|---|---|
| Anamnese e consentimento | 5 anos após o último atendimento | Eliminado |
| Foto de procedimento | 24 meses ou até revogação do consentimento | Eliminada |
| Mensagens WhatsApp | 12 meses | Eliminadas |
| Dado de marketing | 12 meses de inatividade | Opt-out automático |
| Registro financeiro (comanda, pagamento) | 5 anos (obrigação fiscal) | Mantido **sem vínculo pessoal** |
| Log de auditoria | 12 meses | Agregado |
| Cliente eliminado a pedido | 30 dias de carência | Anonimizado |

---

### 3. Modelo de ameaças resumido

| Ameaça | Controle principal | Teste que prova |
|---|---|---|
| Vazamento entre tenants | RLS forçado + filtro na aplicação | `tests/rls/isolation` |
| Vazamento de foto | Bucket privado + signed URL curta + chave aleatória | teste de expiração de URL |
| Roubo de carteira de clientes | Limite + MFA + auditoria + marca d'água + rate limit na API | teste de rate limit |
| Bot no booking público | CAPTCHA + honeypot + limite por telefone/IP | teste de flood |
| Account takeover | Senha forte + MFA + refresh rotativo + alerta de novo dispositivo | teste de reuso de refresh |
| Fraude de pagamento | Pix (irreversível) + antifraude do PSP + idempotência | teste de webhook duplicado |
| Insider (nosso time) | Impersonation consentida, com cofre bloqueado e log | revisão manual do fluxo |
| Supply chain | Lockfile, SCA bloqueante, SBOM por release | CI |
| Ransomware / perda | PITR + restauração testada mensalmente | registro do teste |
| Injeção de prompt (V2) | Delimitação, allow-list, cofre fora do contexto, confirmação humana | teste com payload adversarial |

---

### 4. Resposta a incidente (runbook curto)

1. **Detectar** — alerta do Sentry, do monitoramento ou aviso externo.
2. **Conter** — revogar chave/sessão comprometida, isolar o serviço afetado. *Não apague evidência.*
3. **Avaliar** — quais tenants, quais titulares, qual categoria de dado (sensível?).
4. **Comunicar** — ANPD e titulares em prazo razoável quando houver risco relevante. Modelo pronto em `docs/lgpd/modelo-comunicacao.md`.
5. **Corrigir** — patch + teste de regressão.
6. **Aprender** — post-mortem sem culpa em 5 dias úteis, publicado internamente.

**Contatos definidos antes de precisar:** responsável técnico de plantão, DPO, jurídico, suporte ao cliente.

---

### 5. O que NUNCA fazer

- Desabilitar RLS "só para testar" em ambiente com dado real
- Colocar dado de saúde, telefone completo ou foto em log, Sentry ou analytics
- Usar `service_role` numa rota que responde ao usuário
- Guardar número de cartão, CVV ou qualquer dado de portador
- Enviar dado de cliente para provedor de LLM sem contrato de não-treinamento
- Deletar registro de auditoria ou de movimento de estoque
- Aceitar `tenant_id` vindo do corpo da requisição
- Prometer ao cliente conformidade que não foi implementada


---

