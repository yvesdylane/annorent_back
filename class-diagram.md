# Annorent — Class Diagrams

> Object-level view of the domain, for the team to read and discuss. Derived from
> `database-model.md` (what is stored), which follows the team's "Real Estate Platform Schema".
> Mermaid renders natively on GitHub and in VS Code, so the diagrams live in the repo and get
> reviewed in PRs.

## How to read these

- **One overview, then one diagram per area.** Classes repeat across diagrams on purpose, so
  each stays readable on its own.
- **Classes map 1:1 to tables** in `database-model.md` (`PropertyVisit` ↔ `property_visits`).
- **`User` is one class with a `role`** (tenant, owner, admin), not a subclass per role. What a
  role may do is decided by guards and services, not by the class. **`visitor` is a fourth
  role for someone with no account**, so it has no `User` object and is never stored.
- **Only a `BusinessAccount` owns properties and subscribes.** A `User` never does. An owner
  creates business accounts, and everything else hangs off them.
- **Hotels and buildings are both `Property`**, told apart by `propertyType`. A hotel room, an
  apartment and a co-work space are all `RentableUnit`.
- Enumerations appear only where the values drive behavior. The full list is in
  `database-model.md` §4.
- Visibility: `+` public, `-` private. Methods are kept to the few that carry a business rule.
  The rules themselves live in services (§5), not in these classes.

## 1. Domain overview

```mermaid
classDiagram
  direction LR
  class User
  class BusinessAccount
  class SubscriptionPlan
  class Property
  class RentableUnit
  class Media
  class Booking
  class Agreement
  class Invoice
  class Payment
  class PaymentReceipt
  class PropertyVisit
  class Message
  class Notification

  User "1" --> "0..*" BusinessAccount : creates
  BusinessAccount "1" --> "0..*" Property : owns
  BusinessAccount "1" --> "0..*" SubscriptionPlan : subscribes
  Property "1" *-- "1..*" RentableUnit : contains
  Property "1" o-- "0..*" Media
  RentableUnit "1" o-- "0..*" Media
  User "1" --> "0..*" Booking : makes
  RentableUnit "1" --> "0..*" Booking : booked as
  Booking "1" --> "0..1" Invoice : billed by
  SubscriptionPlan "1" --> "1" Invoice : billed by
  User "1" --> "0..*" Agreement : agrees to
  RentableUnit "1" --> "0..*" Agreement : rented under
  Agreement "0..1" --> "0..1" Booking : occupies
  Agreement "1" --> "0..*" Invoice : bills
  Invoice "1" --> "0..*" Payment : settled by
  Payment "1" --> "0..1" PaymentReceipt : proven by
  User "1" --> "0..*" PropertyVisit : schedules
  Property "1" --> "0..*" PropertyVisit : receives
  User "1" --> "0..*" Message : sends
  User "1" --> "0..*" Notification : receives
```

## 2. Ownership & listings

```mermaid
classDiagram
  direction TB
  class User {
    +UUID userId
    +String name
    +String email
    +String phoneNumber
    -String passwordHash
    +UserRole role
    +VerificationStatus kycStatus
  }
  class BusinessAccount {
    +UUID accountId
    +String businessName
    +String taxInfo
    +VerificationStatus verificationStatus
  }
  class SubscriptionPlan {
    +UUID subscriptionId
    +PlanType planType
    +Decimal price
    +Date startDate
    +Date endDate
    +SubscriptionStatus status
    +UUID renewedFrom?
    +isActive() Boolean
  }
  class Property {
    +UUID propertyId
    +PropertyType propertyType
    +String name
    +String description
    +String city
    +String town
    +String area
    +Point gps
    +Boolean ownershipVerified
    +revealGpsTo(User) Boolean
  }
  class RentableUnit {
    +UUID unitId
    +String name
    +UnitType unitType
    +PricingModel pricingModel
    +Decimal priceAmount
    +Integer capacity
    +UnitStatus status
    +isAvailable(DateTime, DateTime) Boolean
    +quote(DateTime, DateTime) Decimal
  }
  class Media {
    +UUID mediaId
    +MediaType type
    +String storageKey
    +MediaStatus status
    +Integer position
    +cdnUrl() String
  }
  class PropertyVisit {
    +UUID visitId
    +DateTime scheduledTime
    +VisitStatus status
    +confirm()
    +cancel()
    +complete()
  }
  class UserRole {
    <<enumeration>>
    visitor
    tenant
    owner
    admin
  }
  class PropertyType {
    <<enumeration>>
    building
    hotel
  }
  class UnitType {
    <<enumeration>>
    guest_house
    cowork_space
    event_hall
    room
    apartment
    studio
    hotel_room
  }
  class PricingModel {
    <<enumeration>>
    hourly
    half_day
    daily
    nightly
    monthly
  }

  User --> UserRole
  Property --> PropertyType
  RentableUnit --> UnitType
  RentableUnit --> PricingModel
  User "1" --> "0..*" BusinessAccount : creates
  BusinessAccount "1" --> "0..*" Property : owns
  BusinessAccount "1" --> "0..*" SubscriptionPlan : subscribes
  Property "1" *-- "1..*" RentableUnit : contains
  Property "1" o-- "0..*" Media
  RentableUnit "1" o-- "0..*" Media
  User "1" --> "0..*" PropertyVisit : schedules
  Property "1" --> "0..*" PropertyVisit : receives
  PropertyVisit "0..*" --> "0..1" RentableUnit : may target
```

> A property and a subscription each belong to exactly one `BusinessAccount` (`account_id`,
> NOT NULL). A `User` never owns or subscribes. Only a user with role `owner` can create a
> business account.
>
> `visitor` is in the `UserRole` enum because guards resolve every unauthenticated request to
> it, but no `User` object or `users` row ever has that role. A visitor can browse and search
> only. Booking, messaging, visits and payments need an account.

## 3. Booking & payment

```mermaid
classDiagram
  direction LR
  class User {
    +UUID userId
    +UserRole role
  }
  class RentableUnit {
    +UUID unitId
    +Decimal priceAmount
    +PricingModel pricingModel
    +UnitStatus status
  }
  class Booking {
    +UUID bookingId
    +BookingType bookingType
    +DateTime startTime
    +DateTime endTime
    +BookingStatus status
    +DateTime expiresAt?
    +cancel()
    +complete()
  }
  class Invoice {
    +UUID invoiceId
    +Decimal amount
    +InvoiceStatus status
    +DateTime issuedAt
    +DateTime dueAt
    +DateTime paidAt?
    +Date periodStart?
    +Date periodEnd?
    +markPaid()
    +markPaidOffline()
    +cancel()
  }
  class Payment {
    +UUID paymentId
    +Decimal amount
    +Decimal platformCommission
    +Decimal ownerPayout
    +PaymentMethod paymentMethod
    +String providerReference
    +PaymentStatus status
    +Decimal refundAmount
    +DateTime refundedAt
    +String refundReason
    +DateTime paidOutAt?
    +succeed()
    +fail()
    +refund()
  }
  class PaymentReceipt {
    +UUID receiptId
    +Json transactionDetails
    -String signatureHash
    +DateTime issuedAt
    +verify() Boolean
  }
  class SubscriptionPlan {
    +UUID subscriptionId
    +Decimal price
    +SubscriptionStatus status
  }
  class Agreement {
    +UUID agreementId
    +Decimal agreedAmount
    +BillingInterval billingInterval?
    +Date startDate
    +Date endDate?
    +AgreementStatus status
    +DateTime acceptedAt?
    +accept()
    +cancel()
    +generateNextInvoice() Invoice
  }
  class BillingInterval {
    <<enumeration>>
    daily
    monthly
    yearly
  }
  class AgreementStatus {
    <<enumeration>>
    proposed
    active
    ended
    cancelled
  }
  class BookingStatus {
    <<enumeration>>
    pending
    active
    cancelled
    completed
  }
  class InvoiceStatus {
    <<enumeration>>
    pending
    paid
    paid_offline
    cancelled
  }
  class BookingType {
    <<enumeration>>
    reservation
    rental_booking
  }
  class PaymentStatus {
    <<enumeration>>
    pending
    successful
    failed
    refunded
  }

  User "1" --> "0..*" Booking : makes
  RentableUnit "1" --> "0..*" Booking : booked as
  Booking "1" --> "0..1" Invoice : billed by
  SubscriptionPlan "1" --> "1" Invoice : billed by
  User "1" --> "0..*" Agreement : agrees to
  RentableUnit "1" --> "0..*" Agreement : rented under
  Agreement "0..1" --> "0..1" Booking : occupies
  Agreement "1" --> "0..*" Invoice : bills
  Invoice "1" --> "0..*" Payment : settled by
  Payment "1" --> "0..1" PaymentReceipt : proven by
  Booking --> BookingType
  Booking --> BookingStatus
  Invoice --> InvoiceStatus
  Agreement --> BillingInterval
  Agreement --> AgreementStatus
  Payment --> PaymentStatus
```

> **Flow.** Creating a booking also creates its invoice, in one transaction. A payment can only
> exist against an invoice. When a payment succeeds, the invoice becomes `paid` and the receipt
> is issued, again in one transaction. A `reservation` is a booking of a hotel unit, a
> `rental_booking` a booking of a building unit.
>
> **Holds.** A booking made in the app starts `pending` with an `expiresAt` and blocks the unit like an
> `active` one. Paying the invoice makes it `active`. A job cancels expired unpaid bookings and their invoices.
>
> **Agreements.** An owner proposes an `Agreement` (negotiated price, start date, optional daily, monthly or
> yearly repeat). When the tenant accepts, its booking is created and invoices are generated one per period.
> The tenant can pay in the app, or the owner marks the invoice `paid_offline`.

## 4. Messaging & notifications

```mermaid
classDiagram
  direction LR
  class User {
    +UUID userId
    +String name
  }
  class Message {
    +UUID messageId
    +String content
    +DateTime sentAt
    +UUID bookingId?
  }
  class Notification {
    +UUID notificationId
    +String type
    +Json payload
    +Boolean isRead
    +markRead()
  }
  class Property {
    +UUID propertyId
    +String name
  }

  User "1" --> "0..*" Message : sends
  User "1" --> "0..*" Message : receives
  Message "0..*" --> "0..1" Property : about
  User "1" --> "0..*" Notification : receives
```

> A conversation is not a stored object. It is the messages between two users, grouped by the
> query. Live delivery goes through the realtime service (WebSocket).

## 5. Backend layers (NestJS)

How the classes above are used. Controllers do HTTP only, services own the rules, repositories
are the only code that writes SQL (raw `pg`, no ORM). External systems sit behind **ports**
(interfaces), so a provider can be swapped without touching services.

### 5.1 Service dependencies

```mermaid
classDiagram
  direction LR
  class AuthService
  class UserService
  class BusinessAccountService
  class PropertyService
  class MediaService
  class SubscriptionService
  class BookingService
  class AgreementService
  class InvoiceService
  class PaymentService
  class ReceiptService
  class VisitService
  class MessageService
  class NotificationService
  class SearchService
  class MapService
  class PaymentGateway {
    <<interface>>
    +charge()
    +verifyWebhook()
    +refund()
  }
  class AggregatorGateway
  class MapsProvider {
    <<interface>>
    +geocode()
    +directions()
  }
  class ObjectStorage {
    <<interface>>
    +signedUploadUrl()
    +signedReadUrl()
  }

  PropertyService ..> SubscriptionService : active subscription
  PropertyService ..> MediaService
  BookingService ..> PropertyService : unit and availability
  BookingService ..> InvoiceService : creates invoice
  BookingService ..> NotificationService
  AgreementService ..> BookingService : opens booking on acceptance
  AgreementService ..> InvoiceService : one invoice per period
  AgreementService ..> NotificationService
  SubscriptionService ..> InvoiceService : creates invoice
  PaymentService ..> InvoiceService : marks paid
  PaymentService ..> ReceiptService : issues
  PaymentService ..> NotificationService
  PaymentService ..> PaymentGateway
  PaymentGateway <|.. AggregatorGateway
  VisitService ..> NotificationService
  MessageService ..> NotificationService
  SearchService ..> PropertyService
  SearchService ..> MapService
  MapService ..> MapsProvider
  MediaService ..> ObjectStorage
```

### 5.2 Layering, worked example

The same shape repeats for every module.

```mermaid
classDiagram
  direction LR
  class BookingController {
    <<controller>>
    +create(dto)
    +cancel(id)
  }
  class BookingService {
    <<service>>
    +createBooking(dto)
    +cancelBooking(id)
  }
  class BookingRepository {
    <<repository>>
    +insertIfFree(client, data)
    +findById(id)
    +updateStatus(client, id, status)
  }
  class InvoiceService {
    <<service>>
  }
  class Database {
    <<PostgreSQL + PostGIS>>
    +BEGIN
    +COMMIT
    +ROLLBACK
  }

  BookingController --> BookingService : validated DTO
  BookingService --> BookingRepository : inside one transaction
  BookingService --> InvoiceService : same transaction
  BookingRepository --> Database : parameterized SQL
```

> `createBooking` opens one transaction, calls `insertIfFree` (the `EXCLUDE` constraint rejects
> an overlap), creates the invoice, and commits or rolls back both together.

## 6. Keeping this current

- Changing an entity updates `database-model.md` **and** the matching diagram here, in the
  same PR.
- A new service dependency updates §5.1. A circular arrow there is a design bug.
- Class names here are the names used in code (`PropertyVisit`, `RentableUnit`). Do not invent
  synonyms in TypeScript.
