# Backend: Payments `total_price` (Total Price column)

Reference for the backend implementation that adds optional `total_price` to the admin payments API. The admin frontend already supports this; no frontend changes needed.

---

## 1. Migration `016_payments_trip_id.sql`

Adds nullable `trip_id TEXT` to `payments` to link commission rows to trips.

## 2. Model `internal/models/payment.go`

- **TripID** `*string` – stored in DB, not in JSON (`json:"-"`).
- **TotalPrice** `*int64` – not stored (`db:"-"`), only in JSON as `total_price`; set from JOIN in ListPayments.

## 3. Repository `internal/repositories/payment_repository.go`

- **InsertPayment** – inserts `trip_id` when `p.TripID != nil` and non-empty.
- **ListPayments** – `LEFT JOIN trips t ON p.trip_id = t.id`, selects `t.fare_amount`, scans into `sql.NullInt64` and sets `p.TotalPrice` when valid. Filtering/sorting unchanged (still by `p.driver_id`, `p.created_at`).

## 4. Trip service `internal/services/trip_service.go`

Commission INSERT now includes `trip_id` and passes `tripID` so new commission rows are linked to the finished trip.

---

## Resulting API

- **GET /admin/payments** and **GET /admin/payments?driver_id=<id>** return the same list; each payment object can include **`total_price`** (number) when the payment has a linked trip (e.g. commission with `trip_id`).
- For deposits, adjustments, or old commission rows without `trip_id`, `total_price` is omitted (nil).
- Existing fields (`id`, `driver_id`, `amount`, `type`, `note`, `created_at`) are unchanged.

---

## Summary

- New commission payments are stored with `trip_id`, so the admin payments API can return `total_price` (trip `fare_amount`) for them.
- Existing payments (and any without `trip_id`) have no `total_price` in the response (field omitted).
- GET /admin/payments and GET /admin/payments?driver_id=<id> are unchanged in filtering, sorting, and existing fields; only the optional **`total_price`** field was added.

**Deploy:** Run the new migration (016) so `payments.trip_id` exists before deploying.

---

## Frontend compatibility

The admin dashboard (this repo) already:

- Shows a **Total Price** column in the payments table (driver detail + payments page).
- Reads `total_price` (or `totalPrice`) from each payment; also supports `starting_fee` + `fare_price` or `total_fare` if the backend ever sends those.
- Displays "—" when `total_price` is missing (e.g. deposits or old rows without `trip_id`).

No frontend changes required when the backend adds `total_price`.
