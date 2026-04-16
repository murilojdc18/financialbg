# Testes E2E — Playwright

## Pré-requisitos

1. Instalar dependências: `npm install`
2. Instalar browser: `npx playwright install chromium`
3. Copiar `.env.test.example` para `.env.test` e preencher credenciais de teste

## Como rodar

```bash
# App rodando em localhost:5173
npm run dev

# Em outro terminal:
npm run test:e2e
```

## Relatório

```bash
npm run test:e2e:report
```

O relatório HTML é gerado em `playwright-report/`.

## Configuração

- Cada teste repete **3 vezes** (`repeatEach: 3`)
- 1 retry automático em caso de falha
- Screenshots e vídeos salvos apenas em falhas
- Trace capturado no primeiro retry

## Cenários cobertos

| # | Cenário | Arquivo |
|---|---------|---------|
| 1 | Login ADMIN | `e2e/01-login-admin.spec.ts` |
| 2 | Contas a Receber (filtros/ordenação) | `e2e/02-contas-a-receber.spec.ts` |
| 3 | Detalhe de Operação | `e2e/03-operacao-detalhes.spec.ts` |
| 4 | Modal de Pagamento (anti tela branca) | `e2e/04-payment-modal.spec.ts` |
| 5 | Quitação sem criar parcela nova | `e2e/05-full-payment-no-new-installment.spec.ts` |
| 6 | Print Preview | `e2e/06-print-preview.spec.ts` |

## Monitoramento de erros

Todos os testes coletam automaticamente:
- `pageerror` (erros JS não tratados)
- `console.error`
- Respostas HTTP >= 400

Se houver `pageerror`, o teste falha com mensagem clara.
