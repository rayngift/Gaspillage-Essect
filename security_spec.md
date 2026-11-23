# CampusSave ESSECT — Firestore Security Specification

## 1. Data Invariants
1. **Authentication Gate**: Unauthenticated users CANNOT read, list, or write `offers`, `shops`, `orders`, `users`, or `admins`.
2. **Identity Integrity**: Every user profile `users/{userId}` must have `uid == userId == request.auth.uid`. Non-admins cannot self-assign `role: 'admin'` or `role: 'merchant'` during creation or update.
3. **PII Isolation**: User documents contain `email` and are strictly readable only by the document owner (`request.auth.uid == userId`) or a verified admin.
4. **Shop Validation Gate**: Only an admin can transition a `shops/{shopId}` document to `status: 'approved'`. Merchants creating a shop must set `status: 'pending'` and `ownerId == request.auth.uid`.
5. **Offer Referential Integrity**: An `offers/{offerId}` document can only be created for an existing, `approved` shop, and `merchantId` must match the parent shop's `ownerId`.
6. **Atomic Stock Decrement**: Creating an `orders/{orderId}` document must atomically decrement `offers/{offerId}.quantityAvailable` by the exact `quantity` ordered (`getAfter(...)`).
7. **Terminal Order Locking**: Once an order reaches `status: 'picked_up'` or `'cancelled'`, it cannot be mutated again (except by admin). Only the order's `merchantId` (or admin) can validate pickup (`'paid' -> 'picked_up'`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Offer List**: Anonymous request `list /offers` -> `PERMISSION_DENIED`.
2. **Unauthenticated Shop Read**: Anonymous request `get /shops/buvette_essect` -> `PERMISSION_DENIED`.
3. **Self-Assigned Admin Role**: Student `create /users/{uid}` with `role: 'admin'` -> `PERMISSION_DENIED`.
4. **Role Escalation Update**: Student `update /users/{uid}` changing `role` from `'student'` to `'merchant'` -> `PERMISSION_DENIED`.
5. **PII Cross-Read**: Student A `get /users/{studentB_uid}` -> `PERMISSION_DENIED`.
6. **Ghost Field Shadow Write**: Merchant `create /offers/{id}` with extra field `isFeatured: true` -> `PERMISSION_DENIED`.
7. **Unverified Email Spoof**: User with `email: 'rayen19.chaaouri@gmail.com'` and `email_verified: false` attempting admin write -> `PERMISSION_DENIED`.
8. **Self-Approve Shop**: Merchant `create /shops/{id}` with `status: 'approved'` -> `PERMISSION_DENIED`.
9. **Orphan Offer**: Merchant `create /offers/{id}` referencing non-existent `shopId: 'fake_shop'` -> `PERMISSION_DENIED`.
10. **Free Order Without Stock Decrement**: Student `create /orders/{id}` without atomically decrementing `offers/{offerId}.quantityAvailable` -> `PERMISSION_DENIED`.
11. **Student Self-Validating QR Pickup**: Student `update /orders/{id}` changing `status` to `'picked_up'` -> `PERMISSION_DENIED`.
12. **ID Poisoning**: User `create /orders/{2000_char_id}` -> `PERMISSION_DENIED`.
