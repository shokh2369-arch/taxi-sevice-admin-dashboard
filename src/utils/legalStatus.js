/** @typedef {{ document_code?: string, version?: string|null, version_label?: string|null, version_display?: string, accepted_at?: string|null, source?: string|null, user_agent?: string|null, ip_address?: string|null }} LegalAcceptanceRow */

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
  if (d === 'userterm' || d === 'terms_user') return 'user_terms';
  if (d === 'driverterm' || d === 'terms_driver') return 'driver_terms';
  return d;
}

/**
 * Document identifier from DB/API (document_code, document_type, etc.)
 * @param {Record<string, unknown>} o
 */
export function pickDocumentCode(o) {
  const nested = o.document;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const d = /** @type {Record<string, unknown>} */ (nested);
    const rawNested =
      d.document_code ??
      d.documentCode ??
      d.code ??
      d.type ??
      d.document_type ??
      d.documentType;
    const n = normalizeDocumentCode(rawNested);
    if (n) return n;
  }
  const raw =
    o.document_code ??
    o.documentCode ??
    o.document_type ??
    o.documentType ??
    o.doc_type ??
    o.docType ??
    o.kind ??
    o.code;
  return normalizeDocumentCode(raw);
}

/**
 * @param {Record<string, unknown>} o
 */
export function pickVersionString(o) {
  const nested = o.document;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const d = /** @type {Record<string, unknown>} */ (nested);
    const vn =
      d.document_version ??
      d.documentVersion ??
      d.version ??
      d.doc_version ??
      d.Version;
    if (vn != null && typeof vn !== 'object' && String(vn).trim() !== '') {
      const s = String(vn).trim();
      if (s) return s;
    }
  }
  const v =
    o.document_version ??
    o.documentVersion ??
    o.doc_version ??
    o.version ??
    o.Version ??
    o.terms_version ??
    o.termsVersion;
  if (v == null || v === '' || typeof v === 'object') return null;
  const s = String(v).trim();
  return s || null;
}

/**
 * Backend-provided display string (takes precedence over numeric version).
 * @param {Record<string, unknown>} o
 */
export function pickVersionLabel(o) {
  const nested = o.document;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const d = /** @type {Record<string, unknown>} */ (nested);
    const ln = d.version_label ?? d.versionLabel ?? d.display_version ?? d.displayVersion;
    if (ln != null && String(ln).trim() !== '') return String(ln).trim();
  }
  const v =
    o.version_label ??
    o.versionLabel ??
    o.display_version ??
    o.displayVersion ??
    o.version_display ??
    o.versionDisplay;
  if (v == null || v === '') return null;
  const s = String(v).trim();
  return s || null;
}

/**
 * Display "v2" for numeric/string versions.
 * @param {unknown} v
 */
export function formatVersionCell(v) {
  if (v == null || v === '') return '—';
  const s = String(v).trim();
  if (!s) return '—';
  if (/^v\d/i.test(s)) return s;
  return `v${s}`;
}

/**
 * version_label first, else "v" + version, else em dash (dashboard/table convention).
 * @param {LegalAcceptanceRow|null|undefined} entry
 */
export function formatVersionDisplayForEntry(entry) {
  if (!entry) return '—';
  const label = entry.version_label != null ? String(entry.version_label).trim() : '';
  if (label) return label;
  return formatVersionCell(entry.version);
}

/**
 * @param {Record<string, unknown>} o
 */
export function formatVersionDisplayFromRaw(o) {
  const label = pickVersionLabel(o);
  if (label) return label;
  return formatVersionCell(pickVersionString(o));
}

/**
 * @param {Record<string, unknown>} o
 */
export function pickAcceptedAt(o) {
  const v =
    o.accepted_at ??
    o.acceptedAt ??
    o.signed_at ??
    o.signedAt ??
    o.created_at ??
    o.createdAt ??
    o.accepted_at_utc ??
    o.timestamp;
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

/**
 * @param {Record<string, unknown>} o
 */
export function pickSource(o) {
  const v = o.source ?? o.user_agent ?? o.userAgent ?? o.client_source ?? o.clientSource;
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

/**
 * @param {Record<string, unknown>} o
 */
export function pickIp(o) {
  const v = o.ip_address ?? o.ipAddress ?? o.client_ip ?? o.clientIp ?? o.remote_ip ?? o.remoteIp;
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

/**
 * Row counts as "accepted" for UI if we have a timestamp OR a non-empty version (e.g. v2 rows in DB).
 * @param {LegalAcceptanceRow|null|undefined} entry
 */
export function isAcceptanceSatisfied(entry) {
  if (!entry) return false;
  if (entry.accepted_at != null && String(entry.accepted_at).trim() !== '') return true;
  if (entry.version != null && String(entry.version).trim() !== '') return true;
  if (entry.version_label != null && String(entry.version_label).trim() !== '') return true;
  return false;
}

/**
 * Normalize one API/DB row → LegalAcceptanceRow (or null if no document).
 * @param {unknown} row
 * @returns {LegalAcceptanceRow|null}
 */
export function normalizeRawAcceptanceRow(row) {
  if (!row || typeof row !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (row);
  const doc = pickDocumentCode(o);
  if (!doc) return null;
  const version = pickVersionString(o);
  const version_label = pickVersionLabel(o);
  const version_display = formatVersionDisplayFromRaw(o);
  const ua = o.user_agent ?? o.userAgent ?? o.UserAgent;
  const user_agent = ua != null && String(ua).trim() !== '' ? String(ua).trim() : null;
  return {
    document_code: doc,
    version,
    version_label,
    version_display,
    accepted_at: pickAcceptedAt(o),
    source: pickSource(o),
    user_agent,
    ip_address: pickIp(o)
  };
}

/**
 * @param {string|undefined} t
 */
function normActorType(t) {
  const s = String(t ?? '').toLowerCase();
  if (s === 'driver' || s === 'drivers') return 'driver';
  if (s === 'user' || s === 'users' || s === 'passenger' || s === 'rider' || s === 'customer') return 'user';
  return 'unknown';
}

/**
 * Infer driver vs user when actor_type missing (common with legal_acceptances keyed by user_id).
 * @param {Record<string, unknown>} o
 */
export function inferActorKind(o) {
  const t = normActorType(
    /** @type {string|undefined} */ (
      o.actor_type ??
      o.actorType ??
      o.role ??
      o.subject_type ??
      o.subjectType ??
      o.entity_type ??
      o.entityType
    )
  );
  if (t === 'driver' || t === 'user') return t;
  const uid = o.user_id ?? o.userId;
  const did = o.driver_id ?? o.driverId;
  const hasUser = uid != null && String(uid).trim() !== '';
  const hasDriver = did != null && String(did).trim() !== '';
  if (hasDriver && !hasUser) return 'driver';
  if (hasUser && !hasDriver) return 'user';
  if (hasDriver && hasUser) {
    const aid = o.actor_id ?? o.actorId;
    if (aid != null) {
      if (String(aid) === String(uid)) return 'user';
      if (String(aid) === String(did)) return 'driver';
    }
    return 'user';
  }
  return 'unknown';
}

/**
 * @param {unknown} row
 */
function actorIdFromRow(row) {
  if (!row || typeof row !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (row);
  const id = o.actor_id ?? o.actorId ?? o.user_id ?? o.userId ?? o.driver_id ?? o.driverId ?? o.id;
  if (id == null) return null;
  return id;
}

/**
 * @param {Record<string, unknown>} o
 * @param {'driver'|'user'} actorType
 * @param {string} wantId
 */
export function rowMatchesActor(o, actorType, wantId) {
  const wid = String(wantId);
  const uRaw = o.user_id ?? o.userId;
  const dRaw = o.driver_id ?? o.driverId;
  const uid = uRaw != null ? String(uRaw) : '';
  const did = dRaw != null ? String(dRaw) : '';
  const aRaw = o.actor_id ?? o.actorId;
  const aid = aRaw != null ? String(aRaw) : '';
  const oid =
    o.id != null && uRaw == null && dRaw == null && aRaw == null ? String(o.id) : '';
  const idMatch = uid === wid || did === wid || aid === wid || oid === wid;
  if (!idMatch) return false;

  const t = normActorType(/** @type {string|undefined} */ (o.actor_type ?? o.actorType ?? o.role));
  if (t === actorType) return true;
  if (t !== 'unknown') return false;

  if (actorType === 'user') {
    if (uid === wid || aid === wid || oid === wid) return true;
  }
  if (actorType === 'driver') {
    if (did === wid || aid === wid || oid === wid) return true;
  }
  return false;
}

/**
 * @param {unknown} raw
 * @returns {unknown[]}
 */
export function unwrapList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const o = /** @type {Record<string, unknown>} */ (raw);
    /** Prefer deployed API shapes: records/history before empty acceptances arrays. */
    for (const k of ['records', 'history', 'acceptances', 'items', 'rows', 'results', 'data']) {
      const v = o[k];
      if (Array.isArray(v)) return v;
    }
    const d = o.data;
    if (d && typeof d === 'object' && !Array.isArray(d)) {
      const inner = /** @type {Record<string, unknown>} */ (d);
      for (const k of ['records', 'history', 'acceptances', 'items', 'rows', 'results']) {
        const v = inner[k];
        if (Array.isArray(v)) return v;
      }
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
    for (const k of ['records', 'missing', 'items', 'data', 'rows', 'results', 'actors']) {
      const v = o[k];
      if (Array.isArray(v)) return v;
    }
    const d = o.data;
    if (d && typeof d === 'object' && !Array.isArray(d)) {
      const inner = /** @type {Record<string, unknown>} */ (d);
      for (const k of ['records', 'missing', 'items', 'rows', 'results', 'actors']) {
        const v = inner[k];
        if (Array.isArray(v)) return v;
      }
    }
  }
  return [];
}

/**
 * Flatten nested stats payloads: { data: { ... } }, { stats: { ... } }.
 * @param {unknown} raw
 */
export function unwrapStatsPayload(raw) {
  if (!raw || typeof raw !== 'object') return /** @type {Record<string, unknown>} */ ({});
  let o = /** @type {Record<string, unknown>} */ (raw);
  const merge = (/** @type {Record<string, unknown>} */ base, sub) => {
    if (sub && typeof sub === 'object' && !Array.isArray(sub)) {
      return { ...base, .../** @type {Record<string, unknown>} */ (sub) };
    }
    return base;
  };
  o = merge(o, o.data);
  o = merge(o, o.stats);
  o = merge(o, o.totals);
  o = merge(o, o.legal);
  o = merge(o, o.payload);
  o = merge(o, o.result);
  for (const k of ['counts', 'summary', 'metrics']) {
    o = merge(o, o[k]);
  }
  return o;
}

/**
 * Parse missing document list: arrays, JSON strings, comma strings, { document_code } objects.
 * @param {unknown} raw
 */
export function parseMissingDocumentsList(raw) {
  let missing = raw;
  if (typeof missing === 'string') {
    const t = missing.trim();
    if (!t) return [];
    try {
      const p = JSON.parse(t);
      missing = p;
    } catch {
      missing = t.split(/[\s,;]+/).filter(Boolean);
    }
  }
  if (!Array.isArray(missing)) return [];
  return missing
    .map((x) => {
      if (x && typeof x === 'object') {
        const ob = /** @type {Record<string, unknown>} */ (x);
        const c =
          ob.document_code ??
          ob.documentCode ??
          ob.document_type ??
          ob.documentType ??
          ob.code ??
          ob.type ??
          ob.name;
        return normalizeDocumentCode(c);
      }
      return normalizeDocumentCode(x);
    })
    .filter(Boolean);
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
    const entry = normalizeRawAcceptanceRow(o);
    if (!entry) continue;

    let type = inferActorKind(o);
    const id = actorIdFromRow(o);
    if (id == null || type === 'unknown') continue;

    const key = `${type}:${String(id)}`;
    if (!map.has(key)) map.set(key, new Map());
    const inner = map.get(key);
    const prev = inner.get(entry.document_code);
    if (!prev || compareAcceptanceRecency(entry, prev) > 0) {
      inner.set(entry.document_code, entry);
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
 * @param {string|null|undefined} v
 */
function versionRank(v) {
  if (v == null || v === '') return -1;
  const s = String(v).trim();
  const n = parseInt(s.replace(/^v/i, ''), 10);
  if (Number.isFinite(n)) return n;
  return 0;
}

/**
 * Prefer newer accepted_at; if equal/missing, prefer higher version (v2 over v1).
 * @param {LegalAcceptanceRow} a
 * @param {LegalAcceptanceRow} b
 */
function compareAcceptanceRecency(a, b) {
  const c = compareAcceptedAt(a.accepted_at, b.accepted_at);
  if (c !== 0) return c;
  return versionRank(a.version) - versionRank(b.version);
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
  const termsOk = isAcceptanceSatisfied(terms);
  const privacyOk = isAcceptanceSatisfied(privacy);
  const missingCodes = /** @type {string[]} */ ([]);
  if (!termsOk) missingCodes.push(codes.termsCode);
  if (!privacyOk) missingCodes.push(codes.privacyCode);
  const tv = terms?.version ?? null;
  const pv = privacy?.version ?? null;
  let versionLabel = '—';
  const td = formatVersionDisplayForEntry(terms);
  const pd = formatVersionDisplayForEntry(privacy);
  if (td !== '—' && pd !== '—' && td === pd) versionLabel = td;
  else if (td !== '—' || pd !== '—') {
    versionLabel = [td !== '—' ? td : null, pd !== '—' ? pd : null].filter(Boolean).join(' ');
    if (!versionLabel) versionLabel = '—';
  }
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
    if (!rowMatchesActor(o, actorType, id)) continue;
    const entry = normalizeRawAcceptanceRow(o);
    if (entry) out.push(entry);
  }
  out.sort((a, b) => compareAcceptanceRecency(b, a));
  return out;
}

/**
 * @param {unknown} raw
 */
export function normalizeLegalStats(raw) {
  const d = unwrapStatsPayload(raw);
  const num = (keys) => {
    for (const k of keys) {
      const v = d[k];
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
    }
    return null;
  };
  return {
    totalUsersAccepted: num([
      'total_users_accepted',
      'users_accepted',
      'users_accepted_total',
      'user_acceptances',
      'usersWithAllDocuments',
      'users_with_all_documents',
      'accepted_users_count',
      'totalUsersAccepted',
      'TotalUsersAccepted',
      'usersAccepted',
      'UsersAccepted',
      'user_accepted_count',
      'usersFullyCompliant'
    ]),
    totalDriversAccepted: num([
      'total_drivers_accepted',
      'drivers_accepted',
      'drivers_accepted_total',
      'driver_acceptances',
      'driversWithAllDocuments',
      'drivers_with_all_documents',
      'accepted_drivers_count',
      'totalDriversAccepted',
      'TotalDriversAccepted',
      'driversAccepted',
      'DriversAccepted',
      'driver_accepted_count',
      'driversFullyCompliant'
    ]),
    usersMissingLegal: num([
      'users_missing_legal',
      'users_missing',
      'missing_users',
      'users_without_legal',
      'users_missing_count',
      'pending_users',
      'usersMissingLegal',
      'UsersMissingLegal',
      'usersMissing',
      'missingUsersCount',
      'users_pending_legal'
    ]),
    driversMissingLegal: num([
      'drivers_missing_legal',
      'drivers_missing',
      'missing_drivers',
      'drivers_without_legal',
      'drivers_missing_count',
      'pending_drivers',
      'driversMissingLegal',
      'DriversMissingLegal',
      'driversMissing',
      'missingDriversCount',
      'drivers_pending_legal'
    ])
  };
}

/**
 * @param {unknown} row
 */
export function normalizeMissingRow(row) {
  if (!row || typeof row !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (row);
  const actorId = actorIdFromRow(o);
  let actorType = normActorType(/** @type {string|undefined} */ (o.actor_type ?? o.actorType ?? o.type ?? o.role));
  if (actorType === 'unknown') {
    actorType = inferActorKind(o);
  }
  const rawMissing =
    o.missing_documents ??
    o.missingDocuments ??
    o.missing ??
    o.documents_missing ??
    o.missing_doc_codes ??
    o.missingDocCodes ??
    o.required_documents ??
    o.gaps;
  const docs = parseMissingDocumentsList(rawMissing);
  const fallbackReason =
    o.reason != null
      ? String(o.reason)
      : o.message != null
        ? String(o.message)
        : o.detail != null
          ? String(o.detail)
          : '';
  if (actorId == null) return null;
  const rawActorLabel = o.actor_type ?? o.actorType ?? 'unknown';
  return {
    actor_id: actorId,
    actor_type: actorType === 'unknown' ? String(rawActorLabel) : actorType,
    missing_documents: docs,
    missingLabel: docs.length ? docs.join(', ') : fallbackReason || '(no document codes in response)'
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
