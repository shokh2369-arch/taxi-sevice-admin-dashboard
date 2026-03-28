/** @typedef {{ document_code?: string, version?: string|null, accepted_at?: string|null, source?: string|null, ip_address?: string|null }} LegalAcceptanceRow */

export const DRIVER_DOC_TERMS = 'driver_terms';
export const DRIVER_DOC_PRIVACY = 'privacy_policy';
export const USER_DOC_TERMS = 'user_terms';
export const USER_DOC_PRIVACY = 'privacy_policy';

/**
 * @param {unknown} raw
 */
export function normalizeDocumentCode(raw) {
  const d = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (!d) return '';
  if (d === 'privacypolicy' || d === 'privacy') return 'privacy_policy';
  return d;
}

/**
 * @param {unknown} raw
 * @returns {unknown[]}
 */
export function unwrapList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const o = /** @type {Record<string, unknown>} */ (raw);
    for (const k of ['acceptances', 'items', 'data', 'rows', 'results']) {
      const v = o[k];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

/**
 * @param {unknown} raw
 * @returns {unknown[]}
 */
export function unwrapMissingList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const o = /** @type {Record<string, unknown>} */ (raw);
    for (const k of ['missing', 'items', 'data', 'rows', 'results', 'actors']) {
      const v = o[k];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

/**
 * @param {string|undefined} t
 */
function normActorType(t) {
  const s = String(t ?? '').toLowerCase();
  if (s === 'driver' || s === 'drivers') return 'driver';
  if (s === 'user' || s === 'users' || s === 'passenger' || s === 'rider') return 'user';
  return s || 'unknown';
}

/**
 * @param {unknown} row
 */
function actorIdFromRow(row) {
  if (!row || typeof row !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (row);
  const id = o.actor_id ?? o.user_id ?? o.driver_id ?? o.id;
  if (id == null) return null;
  return id;
}

/**
 * Build map: "driver:123" | "user:45" -> document_code -> latest acceptance row
 * @param {unknown[]} rows
 * @returns {Map<string, Map<string, LegalAcceptanceRow>>}
 */
export function buildAcceptanceMap(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const o = /** @type {Record<string, unknown>} */ (row);
    const type = normActorType(/** @type {string|undefined} */ (o.actor_type ?? o.type ?? o.role));
    const id = actorIdFromRow(o);
    if (id == null || !type || type === 'unknown') continue;
    const key = `${type}:${String(id)}`;
    const doc = normalizeDocumentCode(o.document_code ?? o.documentCode ?? o.code);
    if (!doc) continue;
    const entry = {
      document_code: doc,
      version: o.version != null ? String(o.version) : null,
      accepted_at: o.accepted_at != null ? String(o.accepted_at) : o.acceptedAt != null ? String(o.acceptedAt) : null,
      source: o.source != null ? String(o.source) : null,
      ip_address: o.ip_address != null ? String(o.ip_address) : o.ipAddress != null ? String(o.ipAddress) : null
    };
    if (!map.has(key)) map.set(key, new Map());
    const inner = map.get(key);
    const prev = inner.get(doc);
    if (!prev || compareAcceptedAt(entry.accepted_at, prev.accepted_at) > 0) {
      inner.set(doc, entry);
    }
  }
  return map;
}

/**
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 */
function compareAcceptedAt(a, b) {
  const ta = a ? Date.parse(a) : 0;
  const tb = b ? Date.parse(b) : 0;
  if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
  return String(a ?? '').localeCompare(String(b ?? ''));
}

/**
 * @param {Map<string, Map<string, LegalAcceptanceRow>>|null|undefined} accMap
 * @param {'driver'|'user'} actorType
 * @param {string|number|null|undefined} actorId
 * @param {{ termsCode: string, privacyCode: string }} codes
 */
export function legalSummaryForActor(accMap, actorType, actorId, codes) {
  const id = actorId == null ? null : String(actorId);
  if (!accMap || !id) {
    return {
      termsOk: false,
      privacyOk: false,
      termsVersion: null,
      privacyVersion: null,
      versionLabel: '—',
      missingCodes: /** @type {string[]} */ ([codes.termsCode, codes.privacyCode])
    };
  }
  const key = `${actorType}:${id}`;
  const inner = accMap.get(key);
  const terms = inner?.get(codes.termsCode);
  const privacy = inner?.get(codes.privacyCode);
  const termsOk = !!terms?.accepted_at;
  const privacyOk = !!privacy?.accepted_at;
  const missingCodes = /** @type {string[]} */ ([]);
  if (!termsOk) missingCodes.push(codes.termsCode);
  if (!privacyOk) missingCodes.push(codes.privacyCode);
  const tv = terms?.version ?? null;
  const pv = privacy?.version ?? null;
  let versionLabel = '—';
  if (tv && pv && tv === pv) versionLabel = `v${tv}`;
  else if (tv || pv) versionLabel = [tv ? `T:${tv}` : null, pv ? `P:${pv}` : null].filter(Boolean).join(' ');
  return {
    termsOk,
    privacyOk,
    termsVersion: tv,
    privacyVersion: pv,
    versionLabel,
    missingCodes
  };
}

/**
 * All acceptance rows for actor (for history modal), sorted accepted_at desc
 * @param {unknown[]} rows
 * @param {'driver'|'user'} actorType
 * @param {string|number} actorId
 * @returns {LegalAcceptanceRow[]}
 */
export function acceptanceHistoryForActor(rows, actorType, actorId) {
  const id = String(actorId);
  const out = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const o = /** @type {Record<string, unknown>} */ (row);
    const type = normActorType(/** @type {string|undefined} */ (o.actor_type ?? o.type ?? o.role));
    const aid = actorIdFromRow(o);
    if (aid == null || String(aid) !== id) continue;
    if (type !== actorType) continue;
    const doc = normalizeDocumentCode(o.document_code ?? o.documentCode ?? o.code);
    if (!doc) continue;
    out.push({
      document_code: doc,
      version: o.version != null ? String(o.version) : null,
      accepted_at: o.accepted_at != null ? String(o.accepted_at) : o.acceptedAt != null ? String(o.acceptedAt) : null,
      source: o.source != null ? String(o.source) : null,
      ip_address: o.ip_address != null ? String(o.ip_address) : o.ipAddress != null ? String(o.ipAddress) : null
    });
  }
  out.sort((a, b) => compareAcceptedAt(b.accepted_at, a.accepted_at));
  return out;
}

/**
 * @param {unknown} raw
 */
export function normalizeLegalStats(raw) {
  const d = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  const num = (keys) => {
    for (const k of keys) {
      const v = d[k];
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
    }
    return null;
  };
  return {
    totalUsersAccepted: num(['total_users_accepted', 'users_accepted', 'users_accepted_total', 'user_acceptances']),
    totalDriversAccepted: num(['total_drivers_accepted', 'drivers_accepted', 'drivers_accepted_total', 'driver_acceptances']),
    usersMissingLegal: num(['users_missing_legal', 'users_missing', 'missing_users', 'users_without_legal']),
    driversMissingLegal: num(['drivers_missing_legal', 'drivers_missing', 'missing_drivers', 'drivers_without_legal'])
  };
}

/**
 * @param {unknown} row
 */
export function normalizeMissingRow(row) {
  if (!row || typeof row !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (row);
  const actorId = actorIdFromRow(o);
  const actorType = normActorType(/** @type {string|undefined} */ (o.actor_type ?? o.type ?? o.role));
  let missing = o.missing_documents ?? o.missingDocuments ?? o.missing ?? o.documents_missing;
  if (!Array.isArray(missing)) missing = [];
  const docs = missing.map((x) => String(x).trim()).filter(Boolean);
  if (actorId == null) return null;
  return {
    actor_id: actorId,
    actor_type: actorType === 'unknown' ? String(o.actor_type ?? 'unknown') : actorType,
    missing_documents: docs
  };
}

export const LEGAL_FILTER_ALL = 'all';
export const LEGAL_FILTER_ANY_MISSING = 'any';
export const LEGAL_FILTER_TERMS = 'terms';
export const LEGAL_FILTER_PRIVACY = 'privacy';

/**
 * @param {'driver'|'user'} kind
 * @param {{ missingCodes: string[] }} summary
 * @param {string} filterValue
 * @param {{ termsCode: string, privacyCode: string }} codes
 */
export function passesLegalFilter(kind, summary, filterValue, codes) {
  if (filterValue === LEGAL_FILTER_ALL) return true;
  const m = summary.missingCodes;
  if (filterValue === LEGAL_FILTER_ANY_MISSING) return m.length > 0;
  if (filterValue === LEGAL_FILTER_TERMS) return m.includes(codes.termsCode);
  if (filterValue === LEGAL_FILTER_PRIVACY) return m.includes(codes.privacyCode);
  return true;
}
