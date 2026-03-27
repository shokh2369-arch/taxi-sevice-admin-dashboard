# Backend: Driver actions API (for "Driver actions" page)

The admin dashboard has a **Driver actions** page to show where drivers face difficulties. The frontend calls:

- **GET /admin/driver-actions**

If this endpoint does not exist (404), the page shows an empty state. No other changes are required until the backend is ready.

## Suggested response shape

Return a JSON array of objects. Each item can include:

| Field         | Type   | Description |
|---------------|--------|-------------|
| id            | number | Unique id   |
| driver_id     | number | Driver id   |
| driver_phone  | string | Optional (displayed in Driver column) |
| action_type   | string | e.g. "login_failed", "trip_error", "payment_issue" |
| type          | string | Alias for action_type |
| difficulty    | string | e.g. "error", "warning", "critical", "medium" |
| message       | string | Short description of the difficulty |
| note          | string | Alias for message |
| created_at    | string | ISO 8601 date |

Example:

```json
[
  {
    "id": 1,
    "driver_id": 41,
    "driver_phone": "998990708446",
    "action_type": "trip_error",
    "difficulty": "error",
    "message": "Trip timeout after 5 min",
    "created_at": "2026-03-15T12:00:00Z"
  }
]
```

The frontend shows driver phone (or "Driver #id") and links to the driver details page when `driver_id` is present. Driver name is not used.
