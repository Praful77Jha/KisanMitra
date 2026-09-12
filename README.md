# KisanMitra

**Farm-to-market decision support for Indian farmers — marketplace, deals, prices, transport, and a multilingual voice assistant in one mobile app.**

KisanMitra is a React Native (Expo) mobile app backed by a Node.js/Express + Prisma/MySQL REST API. It helps small and marginal farmers **sell crops**, **find buyers' requirements**, **compare seller offers**, **decide where to sell (smart recommendation)**, **check market prices**, **arrange transport**, and manage the **order → logistics → chat → review** lifecycle — all in **English, Hindi, Marathi and Lambadi**, with an on-device **voice assistant** that understands natural commands in three languages.

> **Target audience:** Smart India Hackathon (SIH) demo and future team members onboarding onto the codebase.

---

## 1. Project Overview

| | |
|---|---|
| **Project name** | KisanMitra |
| **One-liner** | A multilingual, voice-first mobile marketplace that helps farmers compare crop deals, post requirements, arrange transport, and sell smarter. |
| **Problem** | Indian farmers lack transparent price discovery and bargaining power: they sell to local aggregators without knowing fair market rates, cannot easily compare buyer offers, struggle to find reliable transport, and rarely get decision support in their own language. |
| **Target users** | Farmers (sellers & buyers), traders/APMC players, local buyers, and transporters — on Android phones, in Hindi, Marathi and Lambadi speaking regions. |
| **Core value proposition** | A single app that combines a **crop marketplace**, **buyer requirements**, **offer comparison**, **market-price awareness**, **smart selling recommendations**, **transporter ecosystem** and **voice control in three languages** — so a farmer can act on a decision, not just read data. |

---

## 2. User Roles

The application supports **3 roles**:

| Role | Description |
|---|---|
| **Farmer** | Posts crop listings, creates buyer requirements, compares offers, places orders, arranges transport, rates counterparties |
| **Buyer** | Posts buyer requirements, compares seller offers, places orders, arranges transport, rates counterparties |
| **Transporter** | Creates a profile, views available transport requests, sends quotes, receives accepted jobs, updates job status, completes deliveries, receives ratings |

The role is stored on the `User` model and is used for **role-based route protection** on transport endpoints (e.g. only transporters can create quotes; only farmers/buyers can create transport requests). Order and marketplace operations use **resource-level ownership checks** regardless of role.

---

## 3. Key Features

### Authentication & Registration
- Phone + password **registration and login** (`LoginScreen`, `RegisterScreen`).
- JWT-based sessions with **automatic session restore** and **auto-logout on 401** (`AuthContext`, `apiClient`).
- Role selection during registration (Farmer / Buyer / Transporter).

### Farmer & Buyer Marketplace
- Browse crop listings (`MarketplaceScreen`, `HomeScreen`, `ProductDetailsScreen`).
- Public product catalog `GET /api/products`; authenticated create listing.
- Seller identity always comes from the JWT, never the request body.

### Product Search & Categories
- Category filtering and keyword search on the marketplace (`MarketplaceScreen`).
- Filtered results update instantly in the UI.

### Sell / Post Crop
- Post a crop for sale with name/category/grade/quantity/price/location and an optional photo (`SellCropScreen`).
- **"You cannot make an offer on your own product"** guard (backend `offersController`).
- **Crop image upload**: pick a photo from gallery → base64 upload → validated (magic bytes, ≤ 3 MB, JPG/PNG/WEBP) → stored on backend disk → `imageUrl` on the product (`uploadsController`).

### Buyer Requirements
- Post a buying requirement (crop, quantity, max price, location) (`PostRequirementScreen`, `MyRequirementsScreen`).
- Browse other users' active requirements (`AvailableNeedsScreen`) and delete your own with order-guards.

### Offers
- Sellers make offers on a **product** or against a **buyer's requirement** (`MakeOfferScreen`, `OffersScreen`).
- Offers per product and per requirement; server enforces ownership and self-offer rules.

### Compare Deals
- Side-by-side offer table per product/requirement (`CompareDealsScreen`).
- **Ownership-aware Select**: a valid offer can only be ordered by the buyer who owns the linked requirement — otherwise an explanatory notice is shown instantly (`offerActions.resolveOfferSelectAction`).

### Confirm Order & Orders
- Place orders server-side: totals, fees, timeline and payment state are derived on the backend, never from the client.
- Order lifecycle statuses, cancellation, detail view (`OrdersScreen`, `OrderDetailsScreen`, `OrderSuccessScreen`).

### Ratings & Reviews
- Rate the counterparty on a **Delivered** order; review is restricted to the two order parties, editable only by the author (`MyRatingsScreen`).

### Price & Insights
- Aggregated **price insights** from recorded orders (avg/min/max/latest + trend, product filterable), public (`PriceInsightsScreen`).
- **Market Comparison** against 10 curated MSAMB (Maharashtra State Agricultural Marketing Board) reference rows (`MarketComparisonScreen`).
- **Smart Selling / recommendation**: ranks options by **total amount** (incl. transport & other costs) using farmer distance/vehicle logic (`SmartRecommendationScreen`).

### Notifications
- In-app notifications for offers/orders/reviews/chat/transport, scoped per user, with unread counts (`NotificationsScreen`).

### Chat (REST-based, persisted)
- Persistent per-order buyer-seller messaging; only the two parties can read/send (`ChatScreen`).
- Messages are stored in the database and fetched on screen load (REST, not WebSocket).

### Payments (mock)
- Order payment state machine `pending → paid / failed / cancelled` with a clearly-labelled mock gateway (`PaymentScreen`, `PaymentResultScreen`).

### Profile & Location
- Profile view, logout, language selection, role display, and a **State → District → Village** location picker persisted via `PATCH /api/users/me` (`ProfileScreen`, `LocationPickerModal`).

### Transporter Ecosystem
Full transport management system covering the complete lifecycle:

**Farmer / Buyer flow:**
Create Transport Request → Receive Transporter Quotes → Compare Quotes → Accept Transporter → Transport Job → Monitor Status → Rate Transporter

**Transporter flow:**
Register → Create Profile → View Available Requests → Send Quote → Receive Accepted Job → Update Job Status → Complete Job → Receive Ratings

See [Section 10: Transporter System](#10-transporter-system) for full details.

### Multilingual UI
Four UI languages with persisted choice: **English, Hindi, Marathi, Lambadi**.
See [Section 11: Multilingual Support](#11-multilingual-support) for details.

### Voice Assistant
On-device speech recognition in English, Hindi and Marathi that parses commands into intents and auto-navigates.
See [Section 12: Voice Assistant](#12-voice-assistant) for details.

---

## 4. Technology Stack

| Layer | Technology | Version(s) declared |
|---|---|---|
| Frontend framework | React (Expo SDK 54 managed app) | `react 19.1.0` |
| Mobile framework | React Native | `0.81.5` |
| Navigation | React Navigation (native-stack + bottom-tabs) | `@react-navigation/native 7.3.x`, `native-stack 7.18.x`, `bottom-tabs 7.18.x` |
| HTTP client | Native `fetch` with `AbortController` timeout (axios is declared but unused in source) | — |
| Backend runtime | Node.js | — |
| Backend framework | Express + CORS + dotenv | `express ^4.21.2`, `cors ^2.8.5`, `dotenv ^16.4.5` |
| Database | MySQL (local `kisanmitra` via `DATABASE_URL`) | — |
| ORM | Prisma | `@prisma/client ^6.19.3`, `prisma ^6.19.3` |
| Authentication | JWT (`jsonwebtoken`) + bcrypt password hashing | `jsonwebtoken ^9.0.3`, `bcryptjs ^3.0.3` |
| Voice recognition | `expo-speech-recognition` | `3.1.3` |
| Image picker / upload | `expo-image-picker` + custom base64/magic-byte upload endpoint | `~17.0.11` |
| Persistence (app) | `@react-native-async-storage/async-storage` | `2.2.0` |
| Icons / UI | `@expo/vector-icons` (Ionicons), custom theme | `^15.0.2` |
| Testing | `node:test` (Node built-in test runner) + `node:assert` | — |
| Build / deployment | Expo Application Services (EAS) — dev & preview APK profiles | EAS CLI `>= 23.2.0` |
| Dev-only helpers | `nodemon` (backend watch), `expo-dev-client` | `nodemon ^3.1.9`, `expo-dev-client ~6.0.21` |

> No architecture being documented here is assumed — every item above is present in `package.json`/`app.json`/`eas.json` or the source tree.

---

## 5. System Architecture

```
  Mobile App (React Native + Expo)
        |   REST/JSON over HTTP (fetch, Bearer token)
        v
  REST API (Express)        — routes -> controllers -> services  [backend/src]
        |
        v
  Node.js + Express         — routing, controllers, validation and business rules
        |
        v
  Prisma ORM                — schema-driven database client (schema.prisma)
        |
        v
  MySQL                     — single local database "kisanmitra"
```

- **Frontend (`frontend/`)** — Expo-managed React Native app. Auth session and language are persisted in AsyncStorage; every API call goes through `apiClient` (10-second timeout, friendly error translation, 401 → session-expiry event).
- **Backend (`backend/`)** — Express app mounting feature routers under `/api`. Controllers enforce business/ownership/role rules; services hold DB logic on the Prisma client.
- **Dual-mode backend** — a `USE_DATABASE=true` flag switches controllers between the MySQL/Prisma path and the legacy in-memory arrays (used by most tests and fallback). With `USE_DATABASE` unset/false the app runs without a database.
- **Static uploads** — `backend/uploads/` is created on boot and served read-only at `/api/uploads`.

---

## 6. Authentication & Role-Based Authorization

Current implementation (`backend/src/utils/jwt.js`, `middlewares/auth.js`, `controllers/authController.js`; frontend `AuthContext.js`, `services/authService.js`, `apiClient.js`):

1. **Register** — `POST /api/auth/register` with `{ name, phone, password, role }`. Duplicate phone → `409`. `bcryptjs` hashes the password before it is stored (`passwordHash`). The role defaults to `FARMER` if not specified.
2. **Login** — `POST /api/auth/login` verifies the phone/hash pair, then signs a **JWT** (`jsonwebtoken`, payload `{ id, phone }`, expiry from `JWT_EXPIRES_IN`, default `7d`).
3. **Token storage (frontend)** — the token is saved to AsyncStorage under key `kisanmitra.auth.token`.
4. **Authorization header** — every authenticated request sends `Authorization: Bearer <token>` (added by `apiClient.buildHeaders`).
5. **Backend verification** — `verifyToken` middleware checks the `Bearer` prefix, verifies the JWT, and sets `req.user = { id, phone }`.
6. **Role-based transport routes** — transport endpoints use role guards: only `TRANSPORTER` can create quotes and manage profiles; only `FARMER`/`BUYER` can create transport requests, accept/reject quotes, and review jobs.
7. **Resource-level ownership** — order, requirement, review, and chat operations use per-resource ownership checks regardless of role.
8. **Session restore / expiry** — on app launch `GET /api/auth/me` validates the stored token. A `401` anywhere (except `/auth/login|register`) fires `emitSessionExpired()`, which clears the session and returns to the auth flow.

> **Honest boundaries:** no refresh tokens, no rate limiting, no HTTPS configuration. JWT secret comes from the environment (`JWT_SECRET`). `.env` files are git-ignored and must never be committed; only `.env.example` (with placeholder values) belongs in the repository. Historically the project may have had a `.env` tracked by Git — if you cloned an old history, treat any previously exposed `JWT_SECRET`/database credentials as compromised and rotate them.

---

## 7. Database Architecture (`backend/prisma/schema.prisma`)

**15 models.** The schema includes the original marketplace models plus the transport ecosystem.

```
User
 ├── Product              (sellerUserId,          onDelete: SetNull)
 ├── Requirement          (userId,                onDelete: SetNull)
 ├── Order                (userId,                onDelete: SetNull)
 ├── Review               (reviewerId / reviewedUserId, onDelete: Cascade)
 ├── Notification         (userId,                onDelete: Cascade)
 ├── ChatMessage          (senderId,              onDelete: Cascade)
 ├── TransporterProfile   (userId,    unique,     onDelete: Cascade)
 ├── TransportRequest     (userId,    as requester,onDelete: SetNull)
 ├── TransportOffer       (transporterId,         onDelete: Cascade)
 ├── TransportJob         (transporterId,         onDelete: Cascade)
 ├── TransportReview      (reviewerId / transporterId, onDelete: Cascade)

Product     --< Offer              (productId,     onDelete: Cascade)
Requirement --< Offer              (requirementId, onDelete: Cascade)
Offer       --< Order              (offerId,       onDelete: SetNull)
Requirement --< Order              (requirementId, onDelete: SetNull)
Order       --< Review             (orderId,       onDelete: Cascade)
Order       --< Logistics          (orderId,       onDelete: Cascade, unique 1:1)
Order       --< ChatMessage        (orderId,       onDelete: Cascade)
Order       --< TransportRequest   (orderId,       onDelete: SetNull)
Order       --< TransportJob       (orderId,       onDelete: SetNull)

TransportRequest --< TransportOffer   (transportRequestId, onDelete: Cascade)
TransportRequest --< TransportJob     (transportRequestId, onDelete: Cascade)
TransportOffer   --< TransportJob     (transportOfferId,   onDelete: Cascade, unique 1:1)
TransportJob     --< TransportReview  (jobId,              onDelete: Cascade)

MarketPrice — no foreign keys (reference data)
```

### Core Marketplace Models

| Model | Key fields | Relationships |
|---|---|---|
| `User` | `id`, `name`, `phone` (unique), `passwordHash`, `role` (FARMER/BUYER/TRANSPORTER), `location` | products, requirements, orders, reviews, notifications, chat, transport entities |
| `Product` | `id`, `name`, `category`, `quantity`, `unit`, `pricePerQuintal`, `sellerUserId`, `imageUrl` | seller→User, offers |
| `Requirement` | `id`, `userId`, `cropName`, `quantity`, `maxPricePerQuintal`, `location`, `status` | user, offers, orders |
| `Offer` | `id`, `requirementId?`, `productId?`, `sellerUserId`, `offeredPricePerQuintal`, `shortlisted` | requirement, product, orders |
| `Order` | `id`, `userId?`, `offerId?`, `requirementId?`, `productName`, totals, `status`, `paymentState` | user, requirement, offer, reviews, logistics, chat, transport |
| `Review` | `id`, `orderId`, `reviewerId`, `reviewedUserId`, `rating`, `comment` | order, reviewer, reviewedUser |
| `Logistics` | `id`, `orderId` (unique), `status` | order (1:1) |
| `ChatMessage` | `id`, `orderId`, `senderId`, `body` | order, sender |
| `Notification` | `id`, `userId`, `type`, `title`, `body`, `read` | user |
| `MarketPrice` | `id`, `cropName`, `marketName`, `pricePerQtl`, `referenceDate`, `source` | — (reference data) |

### Transport Models

| Model | Key fields | Relationships |
|---|---|---|
| `TransporterProfile` | `id`, `userId` (unique), `vehicleTypes`, `baseLocation`, `description`, `avgRating` | user (1:1) |
| `TransportRequest` | `id`, `userId`, `cropName`, `quantity`, `pickupLocation`, `dropLocation`, `requiredBy`, `vehicleType`, `status`, `orderId?` | requester→User, order, offers, jobs |
| `TransportOffer` | `id`, `transportRequestId`, `transporterId`, `quotedAmount`, `vehicleType`, `distanceKm`, `status` | transportRequest, transporter→User, job |
| `TransportJob` | `id`, `transportRequestId`, `transportOfferId` (unique), `transporterId`, `orderId?`, `status` | transportRequest, transportOffer, transporter→User, order, reviews |
| `TransportReview` | `id`, `jobId`, `reviewerId`, `transporterId`, `rating`, `comment` | job, reviewer→User, transporter→User |

> Asymmetric `onDelete`: orders keep data (parent `SetNull`), while offers/products/reviews/notifications/chat/transport entities cascade.

---

## 8. API Architecture

All routes mount under the `/api` prefix in `server.js`. Routes marked with a lock require `Authorization: Bearer <token>`.

### Health
| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/api/health` | Liveness check | — |

### Authentication (`auth.js`)
| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Create user (phone unique, bcrypt hash, role) | — |
| POST | `/api/auth/login` | Verify credentials, return JWT + safe user | — |
| GET | `/api/auth/me` | Return current user from token | Lock |

### Products & Marketplace (`products.js`)
| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/api/products` | List marketplace listings (public) | — |
| GET | `/api/products/:id` | Product detail | — |
| GET | `/api/products/:productId/offers` | Offers on a product | — |
| POST | `/api/products` | Create listing (seller from token) | Lock |

### Requirements (`requirements.js`)
| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/api/requirements` | My requirements | Lock |
| GET | `/api/requirements/available` | Other users' active requirements | Lock |
| GET | `/api/requirements/:id` | Requirement detail (owner only) | Lock |
| GET | `/api/requirements/:id/offers` | Offers on a requirement (owner only) | Lock |
| POST | `/api/requirements` | Create requirement | Lock |
| DELETE | `/api/requirements/:id` | Delete own requirement (order-guard) | Lock |

### Offers (`offers.js`)
| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| POST | `/api/offers` | Create offer (product- or requirement-linked) | Lock |
| GET | `/api/offers/:id` | Offer detail | Lock |

### Orders, Reviews & Payments (`orders.js`)
| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/api/orders` | My orders | Lock |
| GET | `/api/orders/:id` | Order detail (party only) | Lock |
| POST | `/api/orders` | Place order (totals derived server-side) | Lock |
| POST | `/api/orders/:id/cancel` | Cancel an Order-Confirmed order | Lock |
| POST | `/api/orders/:orderId/reviews` | Review a delivered order (party only) | Lock |
| GET | `/api/orders/:orderId/reviews` | Reviews for an order | Lock |
| PUT | `/api/orders/:orderId/reviews/:reviewId` | Edit own review | Lock |
| DELETE | `/api/orders/:orderId/reviews/:reviewId` | Delete own review | Lock |
| GET | `/api/orders/:orderId/payment` | Payment state (either party) | Lock |
| POST | `/api/orders/:orderId/payment/initiate` | Start payment (buyer only) | Lock |
| POST | `/api/orders/:orderId/payment/confirm` | Confirm payment (buyer only, mock gateway) | Lock |
| POST | `/api/orders/:orderId/payment/cancel` | Cancel payment (buyer only) | Lock |

### Logistics (`logistics.js`)
| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| POST | `/api/logistics/estimate` | Public freight estimate | — |
| POST | `/api/logistics` | Init logistics for order (buyer) | Lock |
| GET | `/api/logistics/:orderId` | Logistics state (party only) | Lock |
| PUT | `/api/logistics/:orderId` | Advance status (buyer only) | Lock |

### Transport Requests (`transportRequests.js`)
| Method | Endpoint | Purpose | Auth / Roles |
|---|---|---|---|
| GET | `/api/transport-requests` | List my transport requests | Lock (Farmer/Buyer) |
| GET | `/api/transport-requests/available` | Available requests for transporters | Lock (Transporter) |
| POST | `/api/transport-requests` | Create transport request | Lock (Farmer/Buyer) |
| GET | `/api/transport-requests/:id` | Request detail | Lock |
| DELETE | `/api/transport-requests/:id` | Delete own request | Lock (Farmer/Buyer) |
| GET | `/api/transport-requests/:id/quotes` | Quotes for a request | Lock (Farmer/Buyer) |
| POST | `/api/transport-requests/:id/quotes` | Submit a quote | Lock (Transporter) |

### Transport Quotes (`transportQuotes.js`)
| Method | Endpoint | Purpose | Auth / Roles |
|---|---|---|---|
| PUT | `/api/transport-quotes/:id/accept` | Accept a quote | Lock (Farmer/Buyer) |
| PUT | `/api/transport-quotes/:id/reject` | Reject a quote | Lock (Farmer/Buyer) |

### Transport Jobs (`transportJobs.js`)
| Method | Endpoint | Purpose | Auth / Roles |
|---|---|---|---|
| GET | `/api/transport-jobs` | My active transport jobs | Lock |
| GET | `/api/transport-jobs/history` | Completed/cancelled job history | Lock |
| GET | `/api/transport-jobs/:id` | Job detail | Lock |
| PUT | `/api/transport-jobs/:id/status` | Update job lifecycle status | Lock (Transporter) |
| POST | `/api/transport-jobs/:id/review` | Rate the transporter | Lock (Farmer/Buyer) |

### Transporter Profile (`transporter.js`)
| Method | Endpoint | Purpose | Auth / Roles |
|---|---|---|---|
| POST | `/api/transporter/profile` | Create transporter profile | Lock (Transporter) |
| GET | `/api/transporter/profile/me` | Get my profile | Lock (Transporter) |
| PATCH | `/api/transporter/profile/me` | Update my profile | Lock (Transporter) |

### Public Transporter Info (`transporters.js`)
| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/api/transporters/:userId/reviews` | Transporter's reviews + average | Lock |

### Price & Market
| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/api/price-insights` | Order-based price stats (public, aggregated) | — |
| GET | `/api/market-prices` | MSAMB reference prices, optional `?crop=` | — |

### Users (`users.js`)
| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/api/users/:userId/reviews` | User's received reviews + average | Lock |
| PATCH | `/api/users/me` | Update signed-in user's location | Lock |

### Notifications & Chat
| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| GET | `/api/notifications` | My notifications | Lock |
| GET | `/api/notifications/unread-count` | Unread count | Lock |
| PUT | `/api/notifications/read` | Mark single/all read | Lock |
| GET | `/api/chat/orders/:orderId/messages` | Conversation for an order (parties only) | Lock |
| POST | `/api/chat/orders/:orderId/messages` | Send message (parties only) | Lock |

### Uploads (`uploads.js`)
| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| POST | `/api/upload` | Base64 image upload → `{ url: "/uploads/..." }` | — (payload is validated) |
| GET | `/api/uploads/*` | Serve uploaded crop photos (static) | — |

> Every controller was inspected; no endpoints exist beyond this list (unknown paths → 404 `Route not found`).

---

## 9. Frontend Structure

```
frontend/
├── App.js                     # SafeArea + Language + Auth providers, NavigationContainer
├── index.js
├── app.json / eas.json        # Expo & EAS config
├── assets/                    # app icon, splash + product images
├── src/
│   ├── config.js              # API base URL resolution (EXPO_PUBLIC_API_BASE_URL or default)
│   ├── theme/                 # colors, typography, spacing, buttons
│   ├── constants/             # locations (State/District/Village) picker data, transport status constants
│   ├── data/mockData.js       # legacy in-memory sample data (fallbacks)
│   ├── navigation/
│   │   ├── RootNavigator.js   # Auth-gated: Splash | Main | Auth
│   │   ├── AuthNavigator.js   # Login / Register
│   │   ├── MainNavigator.js   # 5 tabs + 30 stacked screens
│   │   └── navigationRef.js   # imperative navigation (used by Voice)
│   ├── context/AuthContext.js # session state, login/register/logout, 401 handler
│   ├── screens/               # 38 screen files (see breakdown below)
│   ├── components/            # Header, PrimaryButton, EmptyState, ProductCard,
│   │                          #   SearchBar, InputField, Badge, LocationPickerModal,
│   │                          #   TransportJobCard, VoiceAssistantButton, ...
│   ├── services/              # apiClient (fetch+timeout+401), auth, product, review,
│   │                          #   notification, logistics, chat, payment, priceInsights,
│   │                          #   marketPrice, voice, transport, tokenStorage, authEvents
│   ├── utils/                 # voiceIntent (intent parser), offerActions, statusLabels,
│   │                          #   logistics, insights, calculation, formatting,
│   │                          #   transportStatus, transportRole, transportValidation,
│   │                          #   transportQuotes, offerActions
│   └── i18n/                  # en.js / hi.js / mr.js / lmn.js dictionaries + LanguageProvider
└── test/                      # 9 test files (108 tests)
```

**Navigation map:** 5 bottom tabs — **Home, Marketplace, Sell/Post, Orders, Profile** — plus a native-stack of 30 detail flows including: `ProductDetails`, `MyRequirements`, `SellCrop`, `RequirementOffers`, `ConfirmOrder`, `OrderSuccess`, `Payment`, `PaymentResult`, `OrderDetails`, `Chat`, `CompareDeals`, `Logistics`, `PriceInsights`, `MarketComparison`, `SmartRecommendation`, `MakeOffer`, `AvailableNeeds`, `Notifications`, `MyRatings`, `TransportRequestForm`, `MyTransportRequests`, `TransportRequestDetails`, `TransportQuoteComparison`, `TransportJob`, `TransporterProfile`, `AvailableTransportRequests`, `SendTransportQuote`, `MyTransportJobs`, `CompletedJobs`, `TransporterReviews`.

**API client** (`apiClient.js`): 10s `AbortController` timeout; maps timeouts/network failures to friendly messages; any 401 (outside auth endpoints) emits a global session-expiry event handled by `AuthContext`.

---

## 10. Transporter System

### Overview

KisanMitra includes a full transporter ecosystem that connects farmers/buyers who need crops transported with local transporters. The system covers profile management, quote negotiation, and a controlled job lifecycle.

### Three-Role Model

```
Farmer / Buyer                          Transporter
=====================                   =====================
Create Transport Request                Create Profile
     |                                      |
     v                                      v
Receive Transporter Quotes              View Available Requests
     |                                      |
     v                                      v
Compare Quotes                          Send Quote
     |                                      |
     v                                      v
Accept Transporter                      Receive Accepted Job
     |                                      |
     v                                      v
Transport Job Created                   Update Job Status
     |                                      |
     v                                      v
Monitor Job Status                      Complete Delivery
     |                                      |
     v                                      v
Rate Transporter                        Receive Ratings
```

### Transport Job Lifecycle

A controlled **state machine** prevents invalid transitions:

```
BOOKED
  → DRIVER_ASSIGNED
    → PICKUP_STARTED
      → PICKED_UP
        → IN_TRANSIT
          → DELIVERED  (terminal)
```

**Cancellation** is allowed from any non-terminal state:

```
BOOKED → CANCELLED
DRIVER_ASSIGNED → CANCELLED
PICKUP_STARTED → CANCELLED
PICKED_UP → CANCELLED
IN_TRANSIT → CANCELLED
```

### Transport Status Machines

| Entity | Statuses |
|---|---|
| TransportRequest | `OPEN` → `IN_PROGRESS` → `COMPLETED` (+ `CANCELLED`) |
| TransportOffer | `SUBMITTED` → `ACCEPTED` / `REJECTED` |
| TransportJob | `BOOKED` → `DRIVER_ASSIGNED` → `PICKUP_STARTED` → `PICKED_UP` → `IN_TRANSIT` → `DELIVERED` (+ `CANCELLED`) |

### Order ↔ Transport Integration

Transport requests may optionally reference an Order via the `orderId` field on `TransportRequest`. This links transport directly to a purchase, enabling the buyer to arrange delivery for a confirmed order. This integration is optional — transport requests can exist independently.

### Transport Data Model

The transport system introduces 5 new entities on top of the existing marketplace models:

- **TransporterProfile** — vehicle types, base location, description, aggregate rating (1:1 with User)
- **TransportRequest** — crop, quantity, pickup/drop locations, vehicle preference, requester (1:N with User, optional link to Order)
- **TransportOffer** — quoted amount, vehicle type, distance, notes (N:1 with TransportRequest, N:1 with Transporter)
- **TransportJob** — lifecycle status, linked request/offer/order (1:1 with TransportOffer)
- **TransportReview** — rating (1-5), comment, reviewer (unique per job per reviewer)

### Transport Architecture

```
React Native (screens, services)
        |   REST/JSON over HTTP
        v
Express REST API (transport* routes)
        |
        v
Controllers (role-based auth + ownership checks)
        |
        v
Transport Service (Prisma data access)
        |
        v
Prisma ORM → MySQL
```

- **Role-based authorization** protects all transport endpoints. No transport API is public.
- **Ownership checks** ensure users can only manage their own requests, jobs, and reviews.
- The state machine is enforced both on the backend (controllers) and frontend (`transportStatus.js`).

---

## 11. Multilingual Support

- **Four complete dictionaries:** `en.js`, `hi.js`, `mr.js`, `lmn.js` under `src/i18n/` — **846 keys each, parity-checked (0 missing/extra)**.
- **Lambadi (`lmn`)** — uses Devanagari script. Verified: 846/846 keys, 838 translated values, 0 genuinely untranslated English strings, 0 interpolation mismatches, EN/HI/MR/LMN key parity passes. The remaining values identical to English are intentionally language-neutral (phone numbers, star symbols, numeric placeholders).
- **Provider (`i18n/index.js`):** a `LanguageProvider` loads the saved language from AsyncStorage (`kisanmitra.language`), exposes `useTranslation()`/`t(key, params)`, supports `{{param}}` interpolation, and falls back to the English key.
- **Legacy migration:** the old Punjabi `pa` choice is mapped to `hi` so stored preferences never break.
- **Fixed vocabularies** (`utils/statusLabels.js`): backend order statuses, categories and known crop names map to i18n keys — only known fixed backend values are translated.
- **Free-text policy:** user-entered values (e.g. a crop name "Wheat") are returned as stored, never fake-translated (a missing key falls back to the raw value).
- The app UI and error messages all render through the same dictionary.

---

## 12. Voice Assistant

- **Library:** `expo-speech-recognition` 3.1.3 (platform speech service — Android Google quicksearchbox is configured, plus iOS availability).
- **Languages / locales:** English `en-IN`, Hindi `hi-IN`, Marathi `mr-IN` — mapped from the app language.
- **Lambadi voice recognition is NOT implemented.** When Lambadi is selected, voice recognition silently falls back to English (`en-IN`).
- **Intent handling (`voiceIntent.js`):** pure, import-free parser. Keyword + crop-alias matching across all three scripts/devanagari. Outputs a canonical `{ intent, crop, quantity }`.
  - Intents: `MARKET_PRICE`, `SELL_CROP`, `SMART_SELLING`, `MARKETPLACE`, `ORDERS`, `PROFILE`, `UNKNOWN`.
  - Crop aliases: Onion, Soybean, Tur, Wheat, Maize (EN + Hindi + Marathi forms; number words handled; ambiguous/unsupported quantities are not invented → `null`).
- **Interaction flow (`VoiceAssistantButton` on Home):** tap mic → availability check → permission request → listening with animated pulse/equaliser + live interim transcript → on first final result the command is parsed and the app briefly shows "Opening <screen>..." then auto-navigates (1400 ms).
- **Lifecycle (`voiceService.js`):** one-shot recognition (`continuous: false`); the first final transcript wins; the natural platform `end` event closes the session; explicit Stop/Done; a 15-second safety timeout recovers without auto-stopping on partial results; a `result`/`end`/`error` listener teardown contract; stale sessions are destroyed before reuse.
- **Errors:** platform codes are mapped to friendly per-language messages (`noSpeech`, `permission`, `network`, `timeout`, `unknownCommand`, ...) with Retry/Close UI.
- **Permissions:** Android `RECORD_AUDIO`; iOS `NSSpeechRecognitionUsageDescription` + `NSMicrophoneUsageDescription` (in `app.json`).

> **Honest boundary:** this is rule-based keyword intents + navigation, not an LLM or conversational AI. It performs specific commands reliably and fails gracefully with "I didn't catch that".

---

## 13. Image Upload

1. **Frontend picker:** `expo-image-picker` gallery pick in `SellCropScreen` → the base64 (or data-URL) payload is sent to `POST /api/upload` via `productService.uploadImage`.
2. **Backend endpoint:** `controllers/uploadsController.js`:
   - Payload validation — base64 regex shape check (400).
   - File size limit — ≤ 3 MB (413 beyond).
   - Type detection by magic bytes, not the filename — JPEG (`FF D8 FF`), PNG signature, or WEBP (`RIFF…WEBP`) (400 otherwise).
   - Extension cross-check — if the client supplies a filename extension it must match the sniffed type (`jpeg`/`jpg` accepted equivalently).
   - Server-side filename — `crop-<timestamp>-<random>.ext`; the client name is never used as a path (no traversal).
3. **Storage:** files are written to `backend/uploads/` on local disk — not in MySQL — and served statically at `GET /api/uploads/<file>` (Express `static`, directory auto-created at boot).
4. **Database:** the returned `{ url: "/uploads/<file>" }` is stored as `Product.imageUrl`; the frontend `productService.attachImage` turns it into an absolute display URI.
5. **API surface:** the upload endpoint is unauthenticated by design, but validated aggressively; the image-URL field accepted by product creation is regex-restricted to `/uploads/<safe>`.

---

## 14. Project Folder Structure

```
KisanMitra/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # data model (15 models)
│   │   ├── seed.js                # demo data (idempotent) + MSAMB rows
│   │   └── migrations/            # migrations (auth, reviews, notifications,
│   │                              #   logistics, payments, market price, chat,
│   │                              #   product image-url, transport feature)
│   ├── src/
│   │   ├── server.js              # Express bootstrap, /api routing
│   │   ├── config/                # config.js (+USE_DATABASE flag), prisma.js
│   │   ├── middlewares/auth.js    # JWT verifyToken
│   │   ├── routes/                # auth, products, requirements, offers, orders,
│   │   │                          #   logistics, priceInsights, marketPrices,
│   │   │                          #   users, notifications, chat, uploads,
│   │   │                          #   transportRequests, transportQuotes,
│   │   │                          #   transportJobs, transporter, transporters
│   │   ├── controllers/           # business/ownership/role rules per feature
│   │   │                          #   including transportJobsController,
│   │   │                          #   transportOffersController,
│   │   │                          #   transportRequestsController,
│   │   │                          #   transporterController, uploadsController
│   │   ├── services/              # Prisma data access + pure logic
│   │   │                          #   including transportService
│   │   └── utils/                 # jwt.js, transportStates.js
│   ├── uploads/                   # uploaded crop photos (local disk, git-ignored content)
│   ├── test/                      # 18 node:test suites (320 tests)
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── App.js                     # providers + navigation container
    ├── app.json / eas.json        # Expo SDK 54 / EAS build profiles
    ├── assets/                    # icons, splash, product images
    ├── src/
    │   ├── config.js              # API URL resolution
    │   ├── navigation/            # Root/Auth/Main navigators + ref
    │   ├── context/               # AuthContext
    │   ├── screens/               # 38 screens (marketplace + transport)
    │   ├── components/            # reusable UI incl. TransportJobCard, VoiceAssistantButton
    │   ├── services/              # apiClient + feature services + transportService
    │   ├── utils/                 # voiceIntent, offerActions, statusLabels,
    │   │                          #   transportStatus, transportRole, transportValidation
    │   ├── constants/             # location picker data, transport status constants
    │   ├── i18n/                  # en, hi, mr, lmn dictionaries + provider
    │   └── theme/                 # design tokens
    ├── test/                      # 9 test suites (108 tests)
    └── package.json
```

---

## 15. Environment Setup

**Prerequisites:** Node.js >= 20, npm, a local MySQL server, an Android device/emulator, and optionally the EAS CLI (`npx eas-cli`).

### Backend (`backend/`)
```powershell
cd backend
Copy-Item .env.example .env     # then edit the values (see below)
npm install
npx prisma migrate deploy       # apply existing migrations to the database
npx prisma db seed              # OPTIONAL: original demo data (see below before doing this)
npm start                       # == node src/server.js  -> http://localhost:5000
```

`backend/.env` variables (use placeholders, never commit real credentials):
```
PORT=5000
DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/kisanmitra
USE_DATABASE=true
JWT_SECRET=change-me-to-a-long-random-secret
```

> Use the actual `.env.example` values as a template — never commit real credentials. The backend also supports an in-memory mode by removing/`false`-ing `USE_DATABASE` (useful without MySQL).

### Frontend (`frontend/`)
```powershell
cd frontend
npm install
npx expo start -c               # clear Metro cache and start the dev server
# or for a specific platform:  npm run android
```

The app reads the API URL from `EXPO_PUBLIC_API_BASE_URL` (in `frontend/.env.local`, which is git-ignored). Without it, a local default is used.

### LAN / Physical Device Development

A physical Android phone cannot reach `localhost` on your PC — it needs the PC's LAN IP:

```ini
# frontend/.env.local (git-ignored)
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAPTOP_IP:5000/api
```

- Find your IP (e.g. `ipconfig` → IPv4 Address) and substitute `YOUR_LAPTOP_IP`.
- **Android emulator:** use `http://10.0.2.2:5000/api` (host loopback).
- Network plain-HTTP to the dev backend is allowed by the app config (`expo-build-properties` → `usesCleartextTraffic: true`).
- For standalone EAS builds, `EXPO_PUBLIC_*` variables are inlined at build time from the EAS environment — the phone's runtime env file is irrelevant for an installed APK.

### Database Schema Changes

Edit `backend/prisma/schema.prisma`, then:
```powershell
npx prisma migrate dev --name <migration>   # local dev
npx prisma migrate deploy                   # target environment
```

---

## 16. Testing

> **Verified snapshot.** These numbers reflect the latest verified test run. Future code changes may alter these counts — re-run to confirm.

| Suite | Command | Result |
|---|---|---|
| Backend (`backend/`) | `npm test` | **320 / 320 pass** |
| Frontend (`frontend/`) | `npm test` | **108 / 108 pass** |
| Transport HTTP E2E | `transportFeature.test.js` | **77 / 77 pass** |
| Transport Request Validation (in-memory) | `transportRequestValidation.test.js` | **18 / 18 pass** |
| Transport Request Validation (DB-mocked) | `transportRequestValidation.db.test.js` | **13 / 13 pass** |
| i18n Parity | `i18nParity.test.js` | **3 / 3 pass** (EN/HI/MR/LMN key parity) |

### Backend Test Categories (18 files)

| Test file | Tests |
|---|---|
| `transportFeature.test.js` | 77 — Transporter profiles, requests, quotes, jobs, state machine, reviews |
| `apiClient.errorHandling.test.js` | 23 |
| `security.test.js` | 24 |
| `logistics.test.js` | 21 |
| `payments.test.js` | 21 |
| `transportRequestValidation.test.js` | 18 — Unit/vehicle/required-date/quantity 400s (in-memory path) |
| `reviews.test.js` | 13 |
| `transportRequestValidation.db.test.js` | 13 — Same validations on the DB path (mocked) |
| `priceInsights.test.js` | 12 |
| `recommendation.test.js` | 12 |
| `notifications.test.js` | 11 |
| `auth.test.js` | 10 |
| `chat.test.js` | 10 |
| `offerRequirementOrderFeatures.test.js` | 10 |
| `transportQuoteRoutes.test.js` | 10 |
| `sellCropFeature.test.js` | 7 |
| `transportQuoteRoutes.db.test.js` | 7 |
| `uploads.test.js` | 7 |
| `demoSeedIntegrity.test.js` | 5 |
| `usersUpdateLocation.test.js` | 4 |
| `auditRegression.db.test.js` | 3 |
| `auditRegression.inmemory.test.js` | 2 |

The DB-path tests use mocked persistence so no live MySQL is required.

### Frontend Test Categories (9 files)

| Test file | Tests |
|---|---|
| `voiceIntent.test.js` | 37 — Intent parsing, EN/HI/MR matrices, number words, ambiguity |
| `compareBestSelling.test.js` | 16 — Best-selling recommendation math incl. quantity/distance unit conversion |
| `transportService.test.js` | 15 — Transport service HTTP calls |
| `transportValidation.test.js` | 13 — Transport request/quote/profile validation |
| `transportStatus.test.js` | 7 — Job lifecycle transitions, badge tones, timeline |
| `offerActions.test.js` | 6 — Ownership-aware offer select |
| `transportRole.test.js` | 6 — Role normalization, transporter detection |
| `transportQuotes.test.js` | 5 — Quote sorting, best-offer marking |
| `i18nParity.test.js` | 3 — Key parity across EN/HI/MR/LMN |

### Build / Export Verification

`npx expo export --platform android --clear` succeeded (Hermes bytecode bundle ~3.7 MB in `frontend/dist/`); final EAS preview Android APKs were built and distributed for device testing.

> No CI/CD pipeline, no device-farm E2E harness — demo APK verification has been done manually.

---

## 17. Current Database / Demo State

> The marketplace listings were intentionally cleaned at one point. New listings since then are test-created through the app, not seeds.

The repository does not ship or imply a fixed production or demo dataset. The MySQL database is a local development database whose contents change constantly during testing and demo preparation.

- The marketplace was intentionally cleaned at one point (seed product listings and product-linked offers removed). Everything afterwards is whatever a manual test session created most recently through the app.
- **Do NOT re-seed the database** unless explicitly required. `prisma/seed.js` is idempotent — it wipes `order → offer → requirement → product → marketPrice` in reverse-FK order, recreating the original demo products/requirements/offers/orders, and upserts the MSAMB market-price rows. Running it destroys current data by design.

---

## 18. Build & Deployment

**EAS profiles (`frontend/eas.json`):**

| Profile | Purpose | Output |
|---|---|---|
| `development` | Development client (`developmentClient: true`) | internal APK |
| `preview` | Internal testing build | **APK** |
| `production` | Release (Auto-increment app version) | store-ready |

**Android signing** uses EAS remote credentials (keystore from the Expo account).

```powershell
cd frontend
npx eas-cli build --platform android --profile preview --non-interactive
```

**Current EAS configuration:**

| Field | Value |
|---|---|
| EAS account owner | `john12321` |
| EAS project ID | `3fc4e50d-2755-4fac-8e17-3cd6916a2310` |
| Android package | `com.kisanmitra.app` |
| Expo SDK | 54 |
| app.json owner | `john12321` |

`app.json` highlights: name **KisanMitra**, slug `kisanmitra`, SDK 54, Android package `com.kisanmitra.app`, adaptive icon + splash (Expo splash-screen plugin), `RECORD_AUDIO` permission, iOS speech/mic permission strings, `expo-speech-recognition` and `expo-build-properties` plugins.

> No CI/CD, no store submission has been performed. The final preview build was submitted for real-device testing.

---

## 19. Implemented vs Future Scope

### Implemented (working in the current codebase)
- Phone registration/login + persisted JWT sessions with role selection (Farmer/Buyer/Transporter)
- Marketplace browsing + authenticated crop listing (with photo)
- Product search and category filtering
- Buyer requirements (post, list, delete, available-to-others)
- Offers on products & requirements (self-offer guard, ownership checks)
- Deal comparison with ownership-aware select and instant UX feedback
- Server-derived order creation, cancellation, lifecycle statuses
- Price insights (order-derived) + MSAMB market comparison + smart selling recommendation
- Ratings & reviews (order-party scoped, author-only edit/delete)
- In-app notifications (offer/order/review/chat/transport), unread count
- Logistics estimate + order logistics lifecycle (buyer-updated)
- Persistent per-order chat (party-scoped, REST)
- Mock payment state machine (`pending → paid/failed/cancelled`)
- Voice assistant (3 languages, keyword intents, auto-navigation)
- Image upload with magic-byte validation & static serving
- English / Hindi / Marathi / Lambadi localization (846-key parity) + legacy `pa→hi`
- Location picker (State → District → Village) persisted via PATCH `/users/me`
- **Transporter ecosystem:** profiles, transport requests, quote submission & comparison, quote acceptance, job lifecycle (state-machine controlled), transporter ratings/reviews, order ↔ transport integration

### Not implemented (verified against the code)
- **Real online payment flow** — only a labelled mock gateway (`PAYMENT_GATEWAY=mock`) exists
- **Live GPS tracking** — transport is a manual status lifecycle, no maps/geo-tracking
- **Realtime chat** — chat is persisted REST (request/response), not WebSocket/realtime
- **Push notifications** — notifications are in-app only (no FCM/APNs)
- **ML price prediction** — price insights are statistical aggregates of recorded orders; no ML
- **Live APMC/government API integration** — market prices are curated MSAMB reference rows (seeded), not a live feed
- **KYC / seller verification** — a `verified` flag exists on products/offers but there is no verification workflow
- **Lambadi voice recognition** — voice falls back to English when Lambadi UI is selected
- **HTTPS deployment, rate limiting, refresh tokens**
- Any iOS store / Play Store submission

---

## 20. Known Limitations

1. **Curated market data** — Market Comparison uses 10 seeded MSAMB rows (`referenceDate` 2026-09-03), not a live price API.
2. **Mock payments** — payment execute is a simulated gateway; real gateways (Razorpay/Stripe) are intended but not wired.
3. **LAN dev backend** — physical devices talk to the laptop over the local network; the app and backend are not cloud-hosted.
4. **No realtime layer** — chat and notifications are REST/request-based (poll on screen load), not pushed.
5. **Local disk uploads** — images live on the backend machine (`backend/uploads/`), no object storage; the upload endpoint itself is unauthenticated (mitigated by 3 MB + magic-byte + extension validation, but lacks a token requirement).
6. **Demo data lifecycle** — seed.js actively wipes orders/offers/requirements/products when it runs; re-running it destroys live data (by design, but worth a warning).
7. **DB users are local test accounts** — the current database holds only development/test identities; there is no production data or KYC-grade identity.
8. **Order totals platform fee** is a hardcoded constant (`PLATFORM_FEE = 50`) mirrored on the frontend (`MOCK_PLATFORM_FEE`), with no backend endpoint exposing it.
9. **Transport status is manual** — job lifecycle updates are transporter-initiated; no GPS/real-time location verification.
10. **Lambadi voice fallback** — Lambadi UI is fully translated but voice recognition falls back to English.

---

## 21. SIH Demo Flow (all steps work today)

```
 1. Register ..................  Create an account (phone + password, choose role)
 2. Login .....................  JWT session persists
 3. Sell a Crop ...............  Post a listing with optional photo (Marketplace)
 4. Browse Marketplace ........  See listings with prices & seller ratings
 5. Post a Requirement ........  "I want 80 quintal Red Onion at <= Rs. 1600/qtl"
 6. (2nd account) Make Offer ..  Seller responds on your requirement
 7. Compare Deals .............  Side-by-side offers (prices, transport, distance)
 8. Select a valid offer ......  Only a requirement you own can be ordered
 9. Place the Order ...........  Server-derived totals + confirmation screen
10. Arrange Transport .........  Create transport request, receive & compare quotes
11. Accept Transporter ........  Transport job created with lifecycle tracking
12. Monitor Transport .........  BOOKED → IN_TRANSIT → DELIVERED
13. Logistics .................  Order logistics lifecycle (buyer-updated)
14. Chat ......................  Message the counterparty on that order
15. Rate the Delivery .........  Review on a Delivered order
16. Transporter Rating ........  Rate the transporter on a completed job
17. Price & Insights ..........  Check market prices & where-to-sell recommendations
18. Voice shortcut ............  "pyaj ka bhav batao" → Market Comparison opens
```

> **Recommended demo tip:** run three accounts (buyer, seller, transporter) and use the voice assistant mid-demo to showcase the multilingual differentiator. The transport flow can be demoed end-to-end with the transporter account.

---

## 22. Judge-Friendly Technical Summary

- **Why React Native (Expo SDK 54)?** One cross-platform mobile codebase ships to Android fast (the target audience uses Android), and Expo gives instant LAN testing plus one-command EAS preview APKs — ideal for a hackathon demo cycle.
- **Why Node.js + Express?** A small, unopinionated runtime where the entire API layer — routes, controllers, middlewares — is plain JavaScript shared with the team, and the in-memory test mode (`USE_DATABASE=false`) keeps development dependency-free.
- **Why MySQL?** Relational integrity matters here: orders, offers, requirements, reviews, and transport entities all reference each other, and foreign keys with explicit CASCADE/SET NULL rules enforce that safely.
- **Why Prisma?** It generates the database client from `schema.prisma`, so queries, relationships and onDelete rules are schema-driven instead of hand-written SQL, and migrations are versioned and reproducible (`prisma migrate`).
- **Why JWT?** Stateless authentication is sufficient for a phone API: the client stores one signed token, the backend validates it per request via middleware, and 401 → automatic session-expiry returns the user to login — no session store required.
- **Why a state machine for transport?** Transport jobs involve multiple parties and status transitions. A controlled state machine prevents invalid transitions (e.g. jumping from BOOKED to DELIVERED) and ensures both the transporter and buyer see consistent, predictable lifecycle updates.

---

## 23. Security Notes

**What is implemented (verified):**
- JWT bearer authentication with `jsonwebtoken`; `verifyToken` middleware on all protected routes (`req.user` = `{ id, phone }`).
- bcrypt password hashing (`bcryptjs`); plaintext passwords are never returned or stored.
- Server-side ownership & party checks — order creation requires the buyer to own the requirement and the offer to belong to it; reviews/logistics/chat are restricted to the order's two parties; delete orders guard against linked orders; "no offers on your own product/requirement" rules.
- Role-based route protection on transport endpoints (transporter-only vs farmer/buyer-only).
- Upload validation — base64 shape, 3 MB size cap, magic-byte type sniffing (JPG/PNG/WEBP), extension cross-check, server-generated filenames; product image URLs are regex-restricted to `/uploads/<safe>`.
- Server-derived money fields — order totals, platform fee and payment amounts always come from the backend, never the client.
- No data leaks — `toSafeUser` strips `passwordHash`; price-insights are aggregates; the global error handler logs details server-side but returns a generic `500`; notifications are scoped to the JWT user.

**What is NOT implemented (honest boundaries):** HTTPS/TLS configuration, rate limiting, strict CORS policy (`cors()` allow-all), refresh tokens, OTP, KYC, outbound push infrastructure, and auth on the upload endpoint itself. Plan these before any production launch.

**Known environment security note:** the repository's `.gitignore` now correctly excludes `.env` files, and no `.env` is currently tracked. However, `.env` may have been committed in older Git history. If deploying from an old clone, rotate all secrets (`JWT_SECRET`, database credentials) before any public exposure. Only `.env.example` (with placeholder values) should be in the repository.

---

## 24. Development Workflow

- **Git** — incremental changes, verified with tests and checks before stable commits; never commit secrets (`backend/uploads/`, `.env`, `.env.local` stay out of the tree — see Security Notes above).
- **Testing gate** — run `npm test` in both `backend/` and `frontend/` before significant changes (latest verified snapshot: 320 backend + 108 frontend); tests use `node:test`, so no extra runner is needed.
- **Schema changes** — edit `schema.prisma` → `npx prisma migrate dev --name <migration>` (creates `backend/prisma/migrations/...`); never hand-edit migration SQL.
- **Backend dev** — `USE_DATABASE=true` + `npm run dev` (nodemon watch); the flag also enables the same code to run in-memory for quick experiments or broken DB situations.
- **Frontend dev** — `npx expo start -c` on the LAN; iterate against `http://YOUR_LAPTOP_IP:5000/api`.
- **Build verification** — `npx expo export --platform android` (JS bundle smoke-check) → `eas build --profile preview` for an installable APK.
- **Demo data** — only via `npx prisma db seed` (destructive by design; see above before running).
- **Final commit/push** — deferred until after real-device APK verification is complete.

---

## 25. Current Status

**Working today:** The complete farm-commerce loop — auth, marketplace & crop selling, requirements, offers, ownership-aware deal comparison, server-derived orders, logistics lifecycle, party-scoped chat & reviews, notifications, price insights + market comparison + smart recommendation (with quantity & distance unit selectors), image uploads, and the 3-language voice assistant — plus the full transporter ecosystem: profiles, transport requests, quote negotiation, job lifecycle with state-machine control, and transporter ratings/reviews. Four-language UI (EN/HI/MR/Lambadi), building as an EAS Android APK. Backend and frontend automated test suites are maintained and currently verified passing (latest verified snapshot: 320 backend + 108 frontend tests).

**What remains before production:** Real payment gateway, realtime chat/push, live market-price feeds, Lambadi voice recognition, KYC/verification, HTTPS/rate-limiting/hardening, and cloud hosting (replacing the LAN dev backend).

---

## 26. License / Credits

Built for the **Smart India Hackathon (SIH)**. No specific open-source license has been declared yet.

---

## 27. Transport Bug-Fix, Validation & Unit Selectors (session 2026-09-12)

Fixes applied after real-device APK testing found two server-side 500s and a missing selector on the Smart Recommendation screen.

### 27.1 Bug: "New Transport Request" and "Send Transport Offer" returned 500

**Symptom:** POST `/api/transport-requests` and POST `/api/transport-requests/:id/quotes` returned `500 Internal Server Error` on the physical-device APK build.

**Root cause (verified, not guessed):**
- The Prisma migration `20260911100000_add_transport_negotiation_fields` had **never been applied** to the local MySQL database.
- The runtime Prisma client in node_modules was **generated before** those fields existed, so it was stale and rejected the new shapes.
- Bisect confirmed the trigger: sending `expectedBudget` (in an object with the new fields) produced `PrismaClientValidationError: Unknown argument 'userId'` — Prisma's misleading first-field-of-the-object error. The same-process direct client call succeeded; the service failed, isolating a stale-client vs unapplied-migration cause.

**Fix commands (run in `backend/`):**

```powershell
npx prisma migrate deploy    # applied migration 20260911100000_add_transport_negotiation_fields (13/13)
# kill all running `node src/server.js` processes (they lock the Prisma engine DLL on Windows)
npx prisma generate          # regenerated @prisma/client (v6.19.3)
npm start                    # restart the server on :5000
```

**Verification:** full HTTP regression on `http://localhost:5000` — farmer login 200, `POST /transport-requests` 201, `POST /transporter/profile` 201, `POST /transport-requests/:id/quotes` 201 (including an alternate `quintal`/future-date payload).

### 27.2 Validation hardening (Issue: replace generic errors with actionable messages)

`backend/src/utils/transportStates.js` now exports canonical vocabularies:
- `QUANTITY_UNITS = ['kg', 'quintal', 'tonne', 'sack']`
- `VEHICLE_TYPES = ['Tractor-Trolley', 'Mini Truck', 'Truck', 'Tempo', 'Container']`
- `normalizeUnit(unit)` — case-insensitive → canonical lowercase (so `'Tonne'` still validates).

`transportRequestsController.createRequest` (both DB and in-memory paths) now returns **400** with:
| Case | Message |
|---|---|
| Unknown/case-normalized-failure unit | `Please select a valid quantity unit.` |
| Unknown vehicle type | `Please select a valid vehicle type.` |
| `requiredBy` malformed or before today | `Required date must be today or a future date.` |
| Non-positive/NaN quantity | `Enter a valid positive quantity.` |

`transportOffersController.createQuote` (both paths) now returns **400** with:
| Case | Message |
|---|---|
| Transporter has no profile | `Please select a vehicle from your transporter profile.` |
| Request already closed/accepted | `This transport request is no longer accepting offers.` |
| Derived profile vehicle not in whitelist | `Please select a valid vehicle type.` |

The quote vehicle is **server-derived from the transporter's profile** — client-supplied `vehicleType` is ignored (verified live: profile `Mini Truck` + client `Truck` → stored `Mini Truck`).

### 27.3 Smart Recommendation: quantity & distance unit selectors (Issue 2)

`frontend/src/utils/logistics.js`:
- `QUANTITY_UNIT_OPTIONS` (kg / quintal / tonne / sack) and `DISTANCE_UNIT_OPTIONS` (km / mi).
- Conversion factors: `QUANTITY_TO_QUINTAL = { kg: 0.01, quintal: 1, tonne: 10, sack: 0.4 }` (1 sack = 40 kg), `DISTANCE_TO_KM = { km: 1, mi: 1.60934 }`.
- `computeRecommendations` accepts `quantityUnit` / `distanceUnit` (defaults quintal/km — backward compatible; no unit means factor 1), and every option carries `.quantityUnit` so the UI can re-display totals in the chosen unit.

`frontend/src/screens/SmartRecommendationScreen.js`:
- New unit chip selectors after the quantity and distance inputs (`unitRow` / `unitChip` styles).
- Result cards show totals converted back to the chosen unit (`quantityFromQuintal`) using short i18n unit labels.

i18n: new keys `quantityUnitKg/Quintal/Tonne/Sack`, `quantityUnitShortKg/Quintal/Tonne/Sack`, `distanceUnitKm`, `distanceUnitMi`, and `estimatedTotalFor` now interpolates `{{unit}}` — added to **en, hi, mr, lmn** (parity re-verified by `i18nParity.test.js`).

### 27.4 Tests added

- `backend/test/transportRequestValidation.test.js` (18, in-memory path) — all 400 messages, case-normalized units, today/future dates, single-vehicle profile quotes.
- `backend/test/transportRequestValidation.db.test.js` (13, DB path) — same messages over mocked `transportService` / `userService` / `notificationService`.
- `frontend/test/compareBestSelling.test.js` — new unit-conversion cases (90 kg / 90 quintals / 1 tonne / 90 sacks; 80 km vs 80 mi transport cost; displayed unit; defaults; invalid/empty).

**Final verification:** backend `npm test` **320/320**, frontend `npm test` **108/108**, `npx expo export --platform android --clear` succeeded, `git diff --check` clean, live HTTP smoke on `:5000` confirmed every new 400 message + the 201 happy path.
