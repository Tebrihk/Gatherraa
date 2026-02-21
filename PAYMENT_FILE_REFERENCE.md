# Payment Service - File Reference Guide

## Quick Navigation

This guide helps you quickly find and understand each component of the payment processing service.

## Core Implementation Files

### Entities (Database Schemas)

```
src/payments/entities/
├── payment.entity.ts                     # Main payment records
│   ├── Tracks all payment transactions
│   ├── Supports Stripe and crypto
│   ├── Includes fraud analysis
│   └── ~230 lines
│
├── payment-refund.entity.ts              # Refund tracking
│   ├── Full and partial refunds
│   ├── Status tracking
│   └── ~110 lines
│
├── payment-webhook.entity.ts             # Webhook event log
│   ├── Stores incoming webhooks
│   ├── Signature verification
│   └── ~70 lines
│
├── payment-reconciliation.entity.ts      # Reconciliation reports
│   ├── Daily reconciliation records
│   ├── Discrepancy tracking
│   └── ~100 lines
│
├── saved-payment-method.entity.ts        # Tokenized methods
│   ├── Stripe card storage
│   ├── Crypto wallet management
│   └── ~90 lines
│
└── index.ts                              # Barrel export
```

**Total Entity Code**: ~600 lines

### Services (Business Logic)

```
src/payments/services/
├── payment.service.ts                    # Main orchestration
│   ├── Payment creation & management
│   ├── Fraud analysis integration
│   ├── Refund processing
│   ├── Analytics calculations
│   ├── Payment history queries
│   └── ~450 lines
│
├── stripe.service.ts                     # Stripe integration
│   ├── Payment intent management
│   ├── Customer handling
│   ├── Payment method tokenization
│   ├── Refund processing
│   ├── Webhook verification
│   └── ~250 lines
│
├── crypto-payment.service.ts             # Blockchain integration
│   ├── Transaction verification
│   ├── Confirmation tracking
│   ├── Multiple blockchain support
│   ├── Gas estimation
│   ├── Address validation
│   └── ~270 lines
│
├── fraud-detection.service.ts            # Fraud analysis
│   ├── Velocity checking
│   ├── Geographic analysis
│   ├── Amount anomalies
│   ├── Risk scoring
│   ├── Redis caching for velocity
│   └── ~280 lines
│
├── reconciliation.service.ts             # Daily reconciliation
│   ├── Stripe payment reconciliation
│   ├── Crypto transaction verification
│   ├── Discrepancy detection
│   ├── Daily scheduled jobs
│   └── ~280 lines
│
└── index.ts                              # Barrel export
```

**Total Service Code**: ~1,530 lines

### DTOs (Data Transfer Objects)

```
src/payments/dto/
├── payment.dto.ts                        # Payment DTOs
│   ├── CreatePaymentDto
│   ├── InitiateStripePaymentDto
│   ├── ConfirmStripePaymentDto
│   ├── InitiateCryptoPaymentDto
│   ├── VerifyCryptoPaymentDto
│   ├── CreateRefundDto
│   ├── PaymentListDto
│   ├── SavePaymentMethodDto
│   └── ~200 lines
│
└── index.ts                              # Barrel export
```

**Total DTO Code**: ~240 lines

### Controllers (REST API)

```
src/payments/controllers/
├── payment.controller.ts                 # REST endpoints
│   ├── POST /payments - Create payment
│   ├── POST /payments/stripe/initiate
│   ├── POST /payments/stripe/confirm
│   ├── POST /payments/crypto/initiate
│   ├── POST /payments/crypto/verify
│   ├── GET /payments/:id
│   ├── GET /payments/user/:userId/history
│   ├── POST /payments/:id/refund
│   ├── GET /payments/:id/refunds
│   ├── POST /payments/methods/save
│   ├── GET /payments/methods
│   ├── PUT /payments/methods/:id
│   ├── DELETE /payments/methods/:id
│   ├── GET /payments/analytics/summary
│   ├── GET /payments/reconciliation/reports
│   ├── POST /payments/reconciliation/run
│   └── ~400 lines
```

**Total Controller Code**: ~400 lines

### Webhooks

```
src/payments/webhooks/
├── payment-webhook.controller.ts         # Webhook handlers
│   ├── POST /webhooks/payments/stripe
│   ├── POST /webhooks/payments/blockchain
│   ├── POST /webhooks/payments/health
│   ├── Stripe webhook processing
│   ├── Blockchain event handling
│   ├── Signature verification
│   └── ~450 lines
```

**Total Webhook Code**: ~450 lines

### Module Definition

```
src/payments/
└── payments.module.ts                    # Payment module
    ├── Imports all entities
    ├── Registers all services
    ├── Registers all controllers
    └── ~30 lines
```

### App Integration

```
src/app.module.ts                        # Updated to import PaymentsModule
                                         # ~1 line added for import
                                         # ~1 line added to imports array
```

## Testing

```
test/payments.integration.spec.ts         # Integration tests
├── Payment creation tests
├── Fraud detection tests
├── Crypto verification tests
├── Refund processing tests
├── Webhook handling tests
├── Payment history tests
├── Analytics tests
├── Saved payment methods tests
├── Edge case tests
└── ~650 lines
```

## Documentation

```
📄 Documentation Files:

1. PAYMENT_IMPLEMENTATION_SUMMARY.md      # This file
   ├── Complete overview
   ├── All features explained
   ├── Architecture diagrams (mental model)
   ├── Configuration instructions
   └── ~600 lines

2. PAYMENT_SETUP_GUIDE.md                 # Quick start
   ├── Installation steps
   ├── Configuration
   ├── Quick testing
   ├── Troubleshooting
   └── ~400 lines

3. docs/PAYMENT_IMPLEMENTATION.md         # Detailed guide
   ├── Architecture overview
   ├── Features walkthrough
   ├── API documentation
   ├── Integration examples
   ├── Performance notes
   ├── Security features
   └── ~800 lines

4. .env.payments.example                  # Configuration template
   ├── All environment variables
   ├── Detailed comments
   ├── Example values
   └── ~200 lines
```

## Configuration Files

```
app/backend/
├── package.json                          # Updated with new dependencies
│   ├── @nestjs/websockets
│   ├── stripe
│   ├── ethers
│   ├── web3
│   ├── crypto-js
│   └── maxmind
│
├── .env.payments.example                 # Configuration template
│   ├── Stripe credentials
│   ├── Blockchain RPC URLs
│   ├── Contract addresses
│   ├── Fraud detection settings
│   └── ~200 lines
│
└── src/app.module.ts                    # Updated module imports
    └── Added: import { PaymentsModule }
```

## File Organization by Feature

### Fiat Payments (Stripe)
- **Service**: `src/payments/services/stripe.service.ts`
- **Controller**: `src/payments/controllers/payment.controller.ts` (methods: initiateStripePayment, confirmStripePayment)
- **Webhook**: `src/payments/webhooks/payment-webhook.controller.ts` (method: handleStripeWebhook)
- **Entity**: `src/payments/entities/payment.entity.ts` (fields: stripePaymentIntentId, stripeChargeId)

### Crypto Payments
- **Service**: `src/payments/services/crypto-payment.service.ts`
- **Controller**: `src/payments/controllers/payment.controller.ts` (methods: initiateCryptoPayment, verifyCryptoPayment)
- **Webhook**: `src/payments/webhooks/payment-webhook.controller.ts` (method: handleBlockchainWebhook)
- **Entity**: `src/payments/entities/payment.entity.ts` (fields: transactionHash, blockConfirmations)

### Fraud Detection
- **Service**: `src/payments/services/fraud-detection.service.ts`
- **Integration**: Called from `src/payments/services/payment.service.ts` in createPayment()
- **Storage**: Results in `src/payments/entities/payment.entity.ts` (field: fraudAnalysis)

### Refund Processing
- **Entity**: `src/payments/entities/payment-refund.entity.ts`
- **Service**: `src/payments/services/payment.service.ts` (method: refundPayment)
- **Validation**: Checks in `src/payments/services/payment.service.ts`
- **Webhook**: Tracking in `src/payments/webhooks/payment-webhook.controller.ts` (method: handleChargeRefunded)

### Webhook Handling
- **Controller**: `src/payments/webhooks/payment-webhook.controller.ts`
- **Entity**: `src/payments/entities/payment-webhook.entity.ts`
- **Signature Verification**: Stripe service + custom logic
- **Idempotency**: Entry in PaymentWebhook.externalId (unique constraint)

### Payment Reconciliation
- **Service**: `src/payments/services/reconciliation.service.ts`
- **Entity**: `src/payments/entities/payment-reconciliation.entity.ts`
- **Scheduled Jobs**: Daily cron jobs in service
- **API**: Endpoint in `src/payments/controllers/payment.controller.ts`

### Saved Payment Methods
- **Entity**: `src/payments/entities/saved-payment-method.entity.ts`
- **Service**: Methods in `src/payments/services/payment.service.ts`
- **Controller**: Endpoints in `src/payments/controllers/payment.controller.ts`
- **Integration**: Stripe API calls in `src/payments/services/stripe.service.ts`

## Code Statistics

| Component | Files | Lines | Purpose |
|-----------|-------|-------|---------|
| Entities | 5 | 600 | Database schemas |
| Services | 5 | 1,530 | Business logic |
| DTOs | 2 | 240 | Data validation |
| Controllers | 1 | 400 | REST API |
| Webhooks | 1 | 450 | Event handling |
| Module | 1 | 30 | NestJS module |
| Tests | 1 | 650 | Integration tests |
| Docs | 4 | 2,000 | Documentation |
| **Total** | **20** | **5,900** | **Complete payment system** |

## How to Use This Guide

### I want to understand the architecture
→ Read: `PAYMENT_IMPLEMENTATION_SUMMARY.md`

### I want to integrate payments into my module
→ Read: `docs/PAYMENT_IMPLEMENTATION.md` → Integration Examples section

### I want to set up the payment service
→ Read: `PAYMENT_SETUP_GUIDE.md`

### I want to understand the REST API
→ Read: `docs/PAYMENT_IMPLEMENTATION.md` → API Endpoints section

### I want to implement a feature
→ Find service file → Review tests → Check DTOs

### I want to debug an issue
→ Check service logic → Review entity definitions → Check tests

### I want to see example usage
→ Check integration tests in `test/payments.integration.spec.ts`

### I need environment configuration
→ Copy `.env.payments.example` to `.env`

## Key Class Locations Quick Reference

```typescript
// Entities
Payment              // src/payments/entities/payment.entity.ts
PaymentRefund        // src/payments/entities/payment-refund.entity.ts
PaymentWebhook       // src/payments/entities/payment-webhook.entity.ts
PaymentReconciliation // src/payments/entities/payment-reconciliation.entity.ts
SavedPaymentMethod   // src/payments/entities/saved-payment-method.entity.ts

// Services
PaymentService       // src/payments/services/payment.service.ts
StripeService        // src/payments/services/stripe.service.ts
CryptoPaymentService // src/payments/services/crypto-payment.service.ts
FraudDetectionService // src/payments/services/fraud-detection.service.ts
ReconciliationService // src/payments/services/reconciliation.service.ts

// Controllers
PaymentController    // src/payments/controllers/payment.controller.ts
PaymentWebhookController // src/payments/webhooks/payment-webhook.controller.ts

// Module
PaymentsModule       // src/payments/payments.module.ts
```

## Dependencies Added

Located in: `app/backend/package.json`

```json
{
  "dependencies": {
    "stripe": "^16.9.0",
    "ethers": "^6.10.0",
    "web3": "^4.11.1",
    "crypto-js": "^4.2.1",
    "maxmind": "^4.3.0"
  }
}
```

## File Size Reference

For understanding relative complexity:
- Small (~100-200 lines): DTOs, basic services
- Medium (~300-400 lines): Controllers, webhook handlers
- Large (~450-500 lines): Main services with multiple methods
- Very Large (~1,500+ lines): Orchestration service combining multiple flows

## Common Tasks & File References

| Task | Primary File | Secondary Files |
|------|-------------|-----------------|
| Add new payment type | payment.entity.ts | payment.service.ts |
| Handle new webhook | payment-webhook.controller.ts | payment.entity.ts |
| Add fraud detection rule | fraud-detection.service.ts | payment.service.ts |
| Support new blockchain | crypto-payment.service.ts | payment.controller.ts |
| Add analytics metric | payment.service.ts | payment-reconciliation.entity.ts |
| Add new API endpoint | payment.controller.ts | payment.service.ts |
| Modify database schema | (entity).entity.ts | payments.module.ts |
| Update payment status | payment.service.ts | payment-webhook.controller.ts |

---

**Last Updated**: February 2026
**Version**: 1.0.0
**Status**: Production Ready ✅
