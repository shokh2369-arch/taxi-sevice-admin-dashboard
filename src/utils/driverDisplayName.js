/**
 * Resolves a human-readable label for a driver when `name` may be empty.
 * Tries common API/DB field names, then phone, then a generic fallback.
 */
export function driverDisplayName(d) {
  if (!d) return '—';

  const parts = [
    d.name,
    d.full_name,
    d.driver_name,
    d.display_name,
    d.username,
    d.telegram_username,
    [d.first_name, d.last_name].filter(Boolean).join(' ').trim() || null
  ];

  for (const p of parts) {
    if (p != null && String(p).trim() !== '') {
      return String(p).trim();
    }
  }

  if (d.phone != null && String(d.phone).trim() !== '') {
    return String(d.phone).trim();
  }

  if (d.driver_id != null) {
    return `Driver #${d.driver_id}`;
  }

  return '—';
}
