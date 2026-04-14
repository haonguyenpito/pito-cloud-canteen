# External Services

## 1. Sharetribe Flex

**Purpose:** Marketplace platform — stores all listings (restaurants, food, menus, orders, plans, quotations), manages users and transactions.

**Two SDK modes:**

| SDK                               | When Used                                | Auth                      |
| --------------------------------- | ---------------------------------------- | ------------------------- |
| `sharetribe-flex-sdk` (client)    | Browser + SSR — user-facing reads/writes | User token from cookie    |
| `sharetribe-flex-integration-sdk` | Server-side only — admin operations      | Integration client secret |

**Files:**

- `src/sharetribe/` — SDK factory (client SDK)
- `src/services/integrationSdk.ts` — Integration SDK instance
- `src/services/sdk.ts` — Trusted SDK helpers
- `src/services/subAccountSdk.ts` — Sub-account trusted SDK

**Config keys:**

- `NEXT_PUBLIC_SHARETRIBE_SDK_CLIENT_ID`
- `NEXT_PUBLIC_SHARETRIBE_SDK_BASE_URL`
- `SHARETRIBE_SDK_CLIENT_SECRET`
- `FLEX_INTEGRATION_CLIENT_ID`
- `FLEX_INTEGRATION_CLIENT_SECRET`

**Critical:** `bookingProcessAlias = 'sub-order-transaction-process/release-2'` in `src/configs.ts` must match the deployed Sharetribe process alias.

---

## 2. Firebase Firestore

**Purpose:** Two use cases:

1. **In-app notifications** — real-time notification feed per user
2. **Payment ledger** — tracks partner and client payment records

**Collections:**

- `FIREBASE_NOTIFICATION_COLLECTION_NAME` (env var) — notification documents
- `FIREBASE_PAYMENT_RECORD_COLLECTION_NAME` (env var) — payment records

**Notification document structure:**

```typescript
{
  userId: string;
  notificationType: string; // 30+ types (see ENotificationType enum)
  isNew: boolean;
  relatedLink: string;
  createdAt: Timestamp;
  // ...type-specific metadata
}
```

**Files:**

- `src/services/firebase.ts` — Firebase app initialization
- `src/services/notifications.ts` — Notification CRUD
- `src/services/payment.ts` — Payment record CRUD

**Config keys:** `NEXT_APP_FIREBASE_API_KEY`, `NEXT_PUBLIC_NEXT_APP_FIREBASE_PROJECT_ID`, etc.

---

## 3. AWS SES (Simple Email Service)

**Purpose:** Transactional emails (HTML templates).

**Sender name:** "PITO Cloud Canteen"

**Usage:**

- Order status notifications to companies and partners
- Participant invitation emails
- Payment confirmation emails
- Other lifecycle emails

**File:** `src/services/awsSES.ts`

Emails are sent via `emailSendingFactory` with typed `EmailTemplateTypes`.

**Config keys:** `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY`, `AWS_SES_REGION`

---

## 4. AWS EventBridge Scheduler

**Purpose:** Scheduled order automation.

**Schedules created per order:**

| Schedule Name                 | Trigger                           | Action                                                 |
| ----------------------------- | --------------------------------- | ------------------------------------------------------ |
| `sendRemindPOE{orderId}`      | `N` minutes before order deadline | Lambda sends food-picking reminder to participants     |
| Auto-start scheduler          | `startDate + deliveryHour`        | Lambda auto-transitions order to `inProgress`          |
| Auto-pick-food scheduler      | At order deadline                 | Lambda fills empty participant slots with default food |
| Send food rating notification | After delivery                    | Lambda sends review prompt                             |
| Booker picking reminder       | Configurable time before deadline | Lambda sends reminder to booker                        |

All schedules use `Asia/Ho_Chi_Minh` timezone.

**File:** `src/services/awsEventBrigdeScheduler.ts`

**Schedule expression format:** `at(yyyy-MM-ddTHH:mm:ss)` — one-time absolute timestamp in `Asia/Ho_Chi_Minh` timezone. All schedulers use Vietnam time; the UTC offset matters for auto-start accuracy.

### Lambda ARN Details

| Config Key                                                     | Lambda Purpose                                                    | When Created               | Scheduler Function                                                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------- |
| `AUTOMATIC_START_ORDER_JOB_LAMBDA_ARN`                         | Auto-start order if admin hasn't started it manually              | Order creation             | `upsertAutomaticStartOrderScheduler({orderId, startDate, deliveryHour})`        |
| `PICK_FOOD_FOR_EMPTY_MEMBER_LAMBDA_ARN`                        | Auto-assign default food for participants who missed the deadline | Order published to picking | `upsertPickFoodForEmptyMembersScheduler({orderId, deadlineDate, params})`       |
| `SEND_REMIND_PICKING_NATIVE_NOTIFICATION_TO_BOOKER_LAMBDA_ARN` | Push reminder to booker before food selection deadline            | Order published to picking | `sendRemindPickingNativeNotificationToBookerScheduler({orderId, deadlineDate})` |
| `SEND_FOOD_RATING_NOTIFICATION_LAMBDA_ARN`                     | Send food rating prompts to participants after delivery           | Sub-order marked delivered | `createFoodRatingNotificationScheduler({params, customName, timeExpression})`   |
| `LAMBDA_ARN`                                                   | Participant deadline reminder (base/legacy Lambda)                | Order creation             | `createScheduler({arn, params, customName, timeExpression})`                    |

**Offset constants (from env vars):**

- `NEXT_PUBLIC_ORDER_AUTO_START_TIME_TO_DELIVERY_TIME_OFFSET_IN_HOUR` — hours before delivery to fire auto-start
- `NEXT_PUBLIC_REMIND_PICKING_NATIVE_NOTIFICATION_TO_BOOKER_TIME_TO_DEADLINE_IN_MINUTES` — minutes before deadline to fire booker reminder
- `NEXT_PUBLIC_SEND_REMIND_PICKING_ORDER_TIME_TO_DEADLINE_IN_MINUTES` — minutes before deadline to fire participant reminder

**Other config keys:**

- `ROLE_ARN` — IAM role for EventBridge to invoke Lambdas
- `NEXT_APP_SCHEDULER_ACCESS_KEY` / `NEXT_APP_SCHEDULER_SECRET_KEY`

---

## 5. BullMQ + Redis

**Purpose:** Job queue for participant food selection — prevents race conditions when multiple users update simultaneously.

**Queue name:** `processOrder`
**Worker concurrency:** 5
**Retry:** 3 attempts, exponential backoff (2s base)
**Distributed lock:** `lock:plan:{planId}`, TTL 30s, max 100 retries

**Files:**

- `src/services/jobs/processOrder.job.ts`
- `src/services/jobs/processMemberOrder.job.ts`
- `src/services/redis.ts` — Redis client
- `src/services/queues/config.ts` — Queue configuration

**Config key:** `REDIS_URL`

See `docs/flows/food-selection-flow.md` for full details.

---

## 6. Algolia

**Purpose:** Admin-only personalization dashboard (analytics, participant behavioral segmentation).

**Indices:**

- `pcc-orders` — Order analytics
- `pcc-participants` — Participant profiles with `personaName` and `personaEmoji`
- `pcc-order-items` — Individual food order items

**Used only in:** `/admin/pcc-dashboard`, `/admin/pcc-personalization`

**Files:** `src/services/algolia.ts`, `src/services/personalization.ts`

**Config keys:** `ALGOLIA_APP_ID`, `ALGOLIA_ADMIN_API_KEY`

---

## 7. Slack Webhooks

**Purpose:** Internal operational alerts.

**Multiple channels:**

| Webhook Env Var                        | Channel Purpose                                                      |
| -------------------------------------- | -------------------------------------------------------------------- |
| `SLACK_WEBHOOK_URL`                    | Main ops — order status changes, restaurant changes, partner actions |
| `SLACK_RATING_WEBHOOK_URL`             | Reviews — participant ratings, partner replies                       |
| `SLACK_PARTNER_WEBHOOK_URL`            | Partner ops — menu submissions, approvals, rejections                |
| `SLACK_WEBHOOK_FOR_MISSING_ORDERS_URL` | Critical — food selection persistence failures                       |
| `SLACK_OPERATION_WEBHOOK_URL`          | Operations — food handover checklist events                          |

**Master toggle:** `SLACK_WEBHOOK_ENABLED === 'true'` (can disable all Slack notifications)

**File:** `src/services/slackNotification.ts`

---

## 8. OneSignal

**Purpose:** Mobile/browser push notifications to participants and partners.

**User device ID storage:** `currentUser.privateData.oneSignalUserIds[]` (array, supports multiple devices per user)

**On logout:** Device ID is removed from the array to stop notifications to that device.

**File:** `src/services/oneSignal.ts`

---

## 9. Onwheel (Delivery Platform)

**Purpose:** Last-mile delivery tracking. Onwheel sends delivery status updates to PITO via webhook.

**Webhook endpoint:** `POST /api/webhook/onwheel`

**File:** `src/pages/api/webhook/onwheel/index.api.ts`

---

## 10. Sentry

**Purpose:** Error monitoring and performance tracking.

**Files:** `sentry.client.config.js`, `sentry.server.config.js`, `sentry.edge.config.js`

Standard Next.js Sentry integration. Test page available at `/sentry-example-page`.

---

## 11. Mixpanel

**Purpose:** User analytics and event tracking.

**Usage:** Via `Tracker` utility (wraps Mixpanel). On logout, `Tracker.removeUser()` clears the Mixpanel identity.

---

## Environment Variables Quick Reference

```bash
# Sharetribe
NEXT_PUBLIC_SHARETRIBE_SDK_CLIENT_ID=
NEXT_PUBLIC_SHARETRIBE_SDK_BASE_URL=
SHARETRIBE_SDK_CLIENT_SECRET=
FLEX_INTEGRATION_CLIENT_ID=
FLEX_INTEGRATION_CLIENT_SECRET=

# Firebase
NEXT_APP_FIREBASE_API_KEY=
NEXT_PUBLIC_NEXT_APP_FIREBASE_PROJECT_ID=
FIREBASE_PAYMENT_RECORD_COLLECTION_NAME=
FIREBASE_NOTIFICATION_COLLECTION_NAME=

# AWS SES
AWS_SES_ACCESS_KEY_ID=
AWS_SES_SECRET_ACCESS_KEY=
AWS_SES_REGION=

# AWS EventBridge
LAMBDA_ARN=
AUTOMATIC_START_ORDER_JOB_LAMBDA_ARN=
PICK_FOOD_FOR_EMPTY_MEMBER_LAMBDA_ARN=
SEND_FOOD_RATING_NOTIFICATION_LAMBDA_ARN=
SEND_REMIND_PICKING_NATIVE_NOTIFICATION_TO_BOOKER_LAMBDA_ARN=
ROLE_ARN=
NEXT_APP_SCHEDULER_ACCESS_KEY=
NEXT_APP_SCHEDULER_SECRET_KEY=
NEXT_PUBLIC_ORDER_AUTO_START_TIME_TO_DELIVERY_TIME_OFFSET_IN_HOUR=
NEXT_PUBLIC_REMIND_PICKING_NATIVE_NOTIFICATION_TO_BOOKER_TIME_TO_DEADLINE_IN_MINUTES=
NEXT_PUBLIC_SEND_REMIND_PICKING_ORDER_TIME_TO_DEADLINE_IN_MINUTES=

# Redis / BullMQ
REDIS_URL=

# Security
ENCRYPT_PASSWORD_SECRET_KEY=     # AES key for sub-account passwords — NEVER expose

# Algolia
ALGOLIA_APP_ID=
ALGOLIA_ADMIN_API_KEY=

# Slack
SLACK_WEBHOOK_URL=
SLACK_RATING_WEBHOOK_URL=
SLACK_PARTNER_WEBHOOK_URL=
SLACK_WEBHOOK_FOR_MISSING_ORDERS_URL=
SLACK_OPERATION_WEBHOOK_URL=
SLACK_WEBHOOK_ENABLED=true

# App config
NEXT_PUBLIC_CHANGE_STRUCTURE_TX_PROCESS_VERSION=   # Version gate for TX process structure changes
NEXT_PUBLIC_DISTANCE_RESTAURANT_TO_DELIVERY_ADDRESS=
```
