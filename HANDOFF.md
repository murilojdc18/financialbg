# HANDOFF — Documentação Técnica para Desenvolvedor

> Gerado em: 2026-04-16  
> Stack: React 18 + Vite 5 + TypeScript 5 + Tailwind CSS 3 + shadcn/ui + Supabase

---

## 1. Como rodar localmente

```bash
# Clonar o repositório (via GitHub sync do Lovable)
git clone <REPO_URL>
cd <PROJETO>

# Instalar dependências
npm install        # ou: bun install

# Copiar variáveis de ambiente
cp .env.example .env
# Preencher os valores no .env

# Rodar em dev
npm run dev        # http://localhost:8080

# Build de produção
npm run build

# Testes
npm run test       # vitest
```

---

## 2. Variáveis de Ambiente (`.env.example`)

```env
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
VITE_SUPABASE_PROJECT_ID=<PROJECT_REF>
```

> **Nunca** commitar a `.env` real. Apenas a anon key (publishable) é usada no client.

---

## 3. Rotas do App

### Backoffice (ADMIN) — protegidas por `ProtectedRoute` (role = admin)

| Rota | Página | Descrição |
|------|--------|-----------|
| `/` | Redirect | → `/dashboard` |
| `/dashboard` | Dashboard | Resumo financeiro, drill-down por cliente, export CSV |
| `/simulador-emprestimo` | Simulador | Simula Price/SAC com taxas e seguros |
| `/clientes` | Clientes | CRUD de clientes com CPF/CNPJ validado |
| `/operacoes` | Operações | Lista de empréstimos, filtros, criação via RPC |
| `/operacoes/:id` | Detalhes | Cronograma, parcelas, pagamento flexível, exclusão |
| `/operacoes/:id/print` | Impressão | Preview A4 para o cliente (sem dados internos) |
| `/contas-a-receber` | Contas a Receber | Visão consolidada com filtros, ordenação, summary cards |
| `/login` | Login | Email/senha |
| `/signup` | Cadastro | Cria perfil + role `client` via trigger |

### Portal do Cliente (CLIENT) — protegidas por `PortalProtectedRoute`

| Rota | Página | Descrição |
|------|--------|-----------|
| `/portal/login` | Login Portal | Acesso do cliente |
| `/portal/vincular` | Vincular | Primeiro acesso: vincula CPF/CNPJ ao usuário |
| `/portal/dashboard` | Dashboard | Resumo das operações ativas do cliente |
| `/portal/operacoes` | Operações | Lista read-only das operações |
| `/portal/operacoes/:id` | Detalhes | Cronograma read-only com encargos atualizados |

---

## 4. Modelo de Dados (tabelas principais)

### `clients`
Cadastro de clientes. `owner_id` = admin que criou. `document_normalized` = CPF/CNPJ só números (generated column). `portal_user_id` = vínculo com auth.users para acesso portal.

### `operations`
Empréstimos. Campos: `principal`, `rate_monthly`, `term_months`, `system` (PRICE|SAC), `start_date`, `fee_fixed`, `fee_insurance`, `cash_source` (B&G|PESSOAL), `status` (ATIVA|QUITADA|CANCELADA). Campos de atraso: `late_grace_days`, `late_penalty_percent` (10%), `late_interest_daily_percent` (0.5%).

### `receivables`
Parcelas. Campos: `installment_number`, `due_date`, `amount` (valor nominal), `amount_paid`, `status` (EM_ABERTO|PAGO|ATRASADO|PARCIAL|RENEGOCIADA). Encargos: `penalty_amount`, `interest_accrued`, `carried_penalty_amount`, `carried_interest_amount`. Renegociação: `renegotiated_to_receivable_id`, `renegotiated_from_receivable_id`. Soft delete: `deleted_at`, `deleted_by`, `deleted_reason`. Ajuste manual: `manual_adjustment_amount`, `is_manual_amount`.

### `payments`
Ledger de pagamentos. Alocação granular: `alloc_principal`, `alloc_contract_interest`, `alloc_late_interest`, `alloc_penalty`. Descontos: `discount_*`. Soft-void: `is_voided`, `void_reason`, `voided_at`, `voided_by`.

### `profiles`
Metadados do usuário. `client_id` liga ao cliente (para portal). Criado automaticamente via trigger `handle_new_user`.

### `user_roles`
RBAC. Enum `app_role`: `admin` | `client`. Uma linha por (user_id, role).

### Resumo RLS

Todas as tabelas usam RLS **RESTRICTIVE** (require `auth.uid() IS NOT NULL`).

- **ADMIN**: `owner_id = auth.uid() AND has_role(uid, 'admin')` — vê/edita apenas seus dados.
- **CLIENT**: `client_id = get_my_client_id() AND has_role(uid, 'client')` — read-only nos próprios dados.
- `has_role()` é `SECURITY DEFINER` para evitar recursão RLS.
- `profiles` e `user_roles` são gerenciados pelo sistema (INSERT/UPDATE bloqueados para usuários).

---

## 5. Regras de Negócio Principais

### Criação de operação
- RPC `create_operation_with_receivables` (transacional): cria operação + todas as parcelas atomicamente.
- Sistemas: **PRICE** (parcela fixa) e **SAC** (amortização constante).
- Taxas fixas (`fee_fixed`) e seguro (`fee_insurance`) somados ao principal.

### Pagamento Flexível (`useFlexiblePaymentV2`)
- Admin define alocação manual: quanto vai para Multa, Mora, Juros Contratual, Principal.
- Validação: `sum(alocação) == valor_recebido` (com tolerância `isZeroMoney < 0.01`).
- Descontos/isenções negociadas por componente.
- **Quitação**: se `remainingTotal ≈ 0` → status `PAGO`, **não** cria nova parcela.
- **Postergação**: se remainingTotal > 0 → cria parcela N+1, shifta parcelas futuras +1 mês.
- **Pagou só juros**: reemite parcela completa (amortização + juros contratual) como N+1.
- Ajuste manual opcional no valor da nova parcela (`manual_adjustment_amount`).

### Encargos de Atraso
- **Multa**: 10% sobre o principal, aplicada uma vez após carência (`late_grace_days`).
- **Mora**: 0,5% ao dia (juros simples) sobre o principal, a partir do vencimento + carência.
- **Juros contratual**: calculado pelo cronograma Price/SAC original via `installment_number`.
- Discriminação: Juros da Operação (contratual) vs Mora (atraso) são separados em `alloc_contract_interest` e `alloc_late_interest`.

### Prioridade de Alocação
- Pagamento: Multa → Mora → Juros Contratual → Principal.
- Postergação: Principal → Juros → Multa/Mora (inverso).

### Exclusão de Parcela
- **Sem pagamentos**: hard delete + renumeração das seguintes.
- **Com pagamentos**: soft delete (`deleted_at`) para auditoria.
- Listagens filtram `deleted_at IS NULL`.

### Exclusão de Operação
- **Sem pagamentos**: hard delete de operação + receivables.
- **Com pagamentos**: soft cancel (`status = CANCELADA`).

### Correção de Pagamento
- Soft-void: marca `is_voided = true`, registra motivo/data/quem.
- Recalcula saldo da parcela.

---

## 6. Problemas Conhecidos / Débitos Técnicos

| # | Problema | Arquivo(s) | Severidade |
|---|----------|------------|------------|
| 1 | `useFlexiblePaymentV2.ts` tem 419 linhas — candidato a refatoração | `src/hooks/useFlexiblePaymentV2.ts` | P2 |
| 2 | Tabelas `produtos_tray` e `documents` são legado/não usadas pelo app financeiro | DB | P3 |
| 3 | `profiles.role` é redundante com `user_roles.role` — mantido por compatibilidade do trigger | `profiles` table | P3 |
| 4 | Shift de parcelas futuras (N+1) faz updates sequenciais — pode ser lento com muitas parcelas | `useFlexiblePaymentV2.ts` L273-298 | P2 |
| 5 | Sem testes automatizados para regras de negócio (apenas `example.test.ts` placeholder) | `src/test/` | P1 |
| 6 | `FlexiblePaymentDialog.tsx` é complexo — considerar split em sub-componentes | `src/components/receivables/` | P2 |

---

## 7. Checklist de Testes Manuais

### ADMIN

| # | Caso | Rota | Resultado Esperado |
|---|------|------|--------------------|
| 1 | Login como admin → redireciona para `/dashboard` | `/login` | Dashboard carrega com cards |
| 2 | Criar cliente com CPF válido | `/clientes` | Cliente aparece na lista |
| 3 | Criar operação PRICE 12x via simulador | `/operacoes` | Operação criada com 12 parcelas |
| 4 | Pagar parcela integral (total devido) | `/operacoes/:id` | Status `PAGO`, **nenhuma** parcela nova |
| 5 | Pagar parcela parcial + postergar saldo | `/operacoes/:id` | Original `PAGO`, nova parcela N+1 criada |
| 6 | Pagar só juros → reemitir parcela completa | `/operacoes/:id` | Nova parcela com valor = amortização + juros |
| 7 | Excluir parcela sem pagamentos | `/operacoes/:id` | Hard delete, numeração ajustada |
| 8 | Excluir parcela com pagamentos | `/operacoes/:id` | Soft delete, some da lista |
| 9 | Exportar CSV no dashboard | `/dashboard` | Download com dados corretos |
| 10 | Preview de impressão A4 | `/operacoes/:id/print` | Layout limpo, sem dados internos |

### PORTAL (CLIENT)

| # | Caso | Rota | Resultado Esperado |
|---|------|------|--------------------|
| 11 | Login como client sem vínculo → vincular | `/portal/login` → `/portal/vincular` | Formulário de CPF/CNPJ |
| 12 | Login como client vinculado → dashboard | `/portal/login` → `/portal/dashboard` | Resumo de operações |
| 13 | Ver detalhes de operação (read-only) | `/portal/operacoes/:id` | Cronograma com encargos atualizados |
| 14 | Tentar acessar rota admin como client | `/dashboard` | Redirecionado para portal |
| 15 | Tentar acessar portal como admin | `/portal/dashboard` | Redirecionado para backoffice |

---

## 8. Arquitetura de Arquivos (resumo)

```
src/
├── components/
│   ├── auth/          # ProtectedRoute
│   ├── clients/       # CRUD clientes
│   ├── dashboard/     # Cards, filtros, export
│   ├── layout/        # AppLayout, Sidebar, Header
│   ├── operations/    # Tabela de parcelas, filtros
│   ├── portal/        # Layout e guard do portal
│   ├── receivables/   # Pagamento flexível, exclusão, histórico
│   ├── simulator/     # Formulário e resultado de simulação
│   └── ui/            # shadcn components
├── contexts/          # AuthContext
├── hooks/             # Queries e mutations (React Query + Supabase)
├── lib/               # Cálculos financeiros (loan, late-fee, money)
├── pages/             # Páginas do app
├── types/             # TypeScript types (database, client, operation)
└── integrations/      # Supabase client + types (auto-generated)
supabase/
├── functions/         # Edge functions (claim-client)
└── migrations/        # SQL migrations
```

---

## 9. Como Exportar o Projeto

1. **GitHub Sync (recomendado)**: No editor Lovable, vá em **Connectors → GitHub → Connect project**. O código sincroniza automaticamente. Clone o repo normalmente.

2. **Download ZIP**: Conecte ao GitHub primeiro, depois no GitHub clique **Code → Download ZIP**.

> O banco de dados (Supabase) é externo. Para exportar dados: **Cloud → Database → Tables → Export**.
