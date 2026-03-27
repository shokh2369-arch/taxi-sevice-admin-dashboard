/**
 * Resolves a human-readable label for a driver when `name` may be empty.
 * Tries common API/DB field names, then phone, then a generic fallback.
 */
export function driverDisplayName(d) {
  if (!d) return '—';
  const app = d.application ?? d.driver_application ?? d.application_data ?? d.app ?? {};

  const parts = [
    d.name,
    app.name,
    d.full_name,
    app.full_name,
    d.driver_name,
    app.driver_name,
    d.display_name,
    app.display_name,
    d.username,
    app.username,
    d.telegram_username,
    app.telegram_username,
    d.front_name,
    app.front_name,
    [d.first_name ?? app.first_name, d.last_name ?? app.last_name].filter(Boolean).join(' ').trim() || null
  ];

  for (const p of parts) {
    if (p != null && String(p).trim() !== '') {
      return String(p).trim();
    }
  }

  const phone =
    d.phone ??
    d.driver_phone ??
    d.phone_number ??
    d.application_phone ??
    app.phone ??
    app.driver_phone ??
    app.phone_number ??
    app.application_phone;
  if (phone != null && String(phone).trim() !== '') {
    return String(phone).trim();
  }

  if (d.driver_id != null) {
    return `Driver #${d.driver_id}`;
  }

  return '—';
}
