'use strict';
/* =========================================================
   Ритм — планер жизни
   Рутина · Список дел · Планер на день · Планер на неделю
   Данные шифруются и хранятся в localStorage браузера.
   ========================================================= */

/* ---------------- утилиты ---------------- */
const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pad2 = n => String(n).padStart(2, '0');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtNum = n => Math.round(Number(n) || 0).toLocaleString('ru-RU');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const toMin   = t => { const [a, b] = String(t || '0:0').split(':').map(Number); return (a || 0) * 60 + (b || 0); };
const toHHMM  = m => { m = ((m % 1440) + 1440) % 1440; return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60); };
const fmtDur  = m => { if (m < 60) return m + ' мин'; const h = Math.floor(m / 60), r = m % 60; return r ? `${h} ч ${r} мин` : `${h} ч`; };
const fmtDurS = m => m < 60 ? `${m} мин` : (m % 60 ? `${Math.floor(m / 60)} ч ${m % 60}` : `${Math.floor(m / 60)} ч`);
const nowMin  = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

const WD_LONG   = ['понедельник','вторник','среда','четверг','пятница','суббота','воскресенье'];
const WD_SHORT  = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const WD_LETTER = ['П','В','С','Ч','П','С','В'];
const MONTH_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTH_NOM = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];

const dateKey  = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays  = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const wdIdx    = d => (d.getDay() + 6) % 7;           // 0 = понедельник
const todayKey = () => dateKey(new Date());
const startOfWeek = d => addDays(d, -wdIdx(d));

function isoWeekNum(d) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() + 3 - wdIdx(t));
  const w1 = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t - w1) / 864e5 - 3 + wdIdx(w1)) / 7);
}
function weekKeyOf(d) {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() - wdIdx(t) + 3);              // год ISO-недели = год четверга
  return `${t.getFullYear()}-W${pad2(isoWeekNum(d))}`;
}
function mondayOfWeekKey(wk) {
  const [y, w] = wk.split('-W').map(Number);
  return addDays(startOfWeek(new Date(y, 0, 4)), (w - 1) * 7);
}
const fmtDateLong  = d => `${WD_LONG[wdIdx(d)]}, ${d.getDate()} ${MONTH_GEN[d.getMonth()]}`;
const fmtDateShort = d => `${d.getDate()} ${MONTH_GEN[d.getMonth()]}`;
function fmtWeekRange(ws) {
  const we = addDays(ws, 6);
  const y = ws.getFullYear() === we.getFullYear() ? ` ${ws.getFullYear()}` : '';
  if (ws.getMonth() === we.getMonth())
    return `${ws.getDate()}–${we.getDate()} ${MONTH_GEN[ws.getMonth()]}${y}`;
  return `${ws.getDate()} ${MONTH_GEN[ws.getMonth()]} — ${we.getDate()} ${MONTH_NOM[we.getMonth()].toLowerCase()}${y}`;
}
function relDayLabel(key) {
  const t = new Date();
  if (key === dateKey(t)) return 'сегодня';
  if (key === dateKey(addDays(t, -1))) return 'вчера';
  if (key === dateKey(addDays(t, 1))) return 'завтра';
  return fmtDateShort(parseKey(key));
}

/* ---------------- справочники ---------------- */
const CATS = {
  health:  { name: 'Здоровье и спорт', emoji: '◇' },
  work:    { name: 'Работа и карьера', emoji: '▢' },
  study:   { name: 'Учёба и развитие', emoji: '▤' },
  home:    { name: 'Дом и уют',        emoji: '⌂' },
  money:   { name: 'Финансы',          emoji: '◉' },
  fun:     { name: 'Хобби и радость',  emoji: '✳' },
  people:  { name: 'Семья и друзья',   emoji: '○' },
  errands: { name: 'Разное',           emoji: '⋯' },
};
const PRIO = { 1: 'низкий', 2: 'средний', 3: 'высокий' };
const RCOLORS = ['sun', 'terracotta', 'sage', 'sky', 'plum', 'teal'];
const COLOR_NAMES = { sun: 'терракота', terracotta: 'кирпич', sage: 'графит', sky: 'дым', plum: 'уголь', teal: 'пепел' };
const EMOJIS = ['◌','○','△','◇','□','✳','✧','☾','☼','⌁','✦','·','≡','⌂','▤','▢','◉','⋯','↗','✓'];
const MOODS = {
  1: { emoji: '🍋', label: 'тяжело' },
  2: { emoji: '😩', label: 'устало' },
  3: { emoji: '😑', label: 'ровно' },
  4: { emoji: '😊', label: 'хорошо' },
  5: { emoji: '😁', label: 'отлично' },
};
const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];
const DAY_START = 6 * 60, DAY_END = 23 * 60; // таймлайн 06:00–23:00
const DAY_MIN = DAY_END - DAY_START, TL_PAD = 38, TL_MIN = 320, TL_MAX = 982;
let PPM = 1, TL_H = DAY_MIN; // масштаб подбирается под высоту окна: весь день без прокрутки
let TL_SIDE = 0;              // высота, при которой план дня дотягивается до низа боковой колонки
const TL_SIDE_MAX = 1600;
function syncDayScale() {
  const vh = (typeof window !== 'undefined' && window.innerHeight) || 900;
  const box = clamp(vh - 430, 360, 1020);
  TL_H = clamp(box - TL_PAD, TL_MIN, TL_MAX);
  if (TL_SIDE) TL_H = Math.max(TL_H, TL_SIDE); // растягиваем до итогов дня, если колонка справа выше
  PPM = TL_H / DAY_MIN;
}
// После раскладки подгоняем высоту плана дня под боковую колонку, чтобы снизу не оставалось пустоты
function fitTimelineToSide() {
  if (ui.view !== 'today' || !unlocked || !state) return;
  const card = $('.tl-card'), scroll = $('#tlScroll'), side = $('.today-side');
  if (!card || !scroll || !side || !side.offsetHeight) return;
  if (Math.abs(side.offsetTop - card.offsetTop) > 40) { // одна колонка (узкий экран) — не подгоняем
    if (TL_SIDE) { TL_SIDE = 0; syncDayScale(); scroll.outerHTML = timelineHTML(ui.dayAnchor); positionNowLine(); }
    return;
  }
  const chrome = card.offsetHeight - scroll.offsetHeight; // шапка карточки и рамки
  const want = clamp(side.offsetHeight - chrome - TL_PAD, 0, TL_SIDE_MAX);
  if (Math.abs(want - TL_SIDE) < 2) return;
  TL_SIDE = want;
  const prev = TL_H;
  syncDayScale();
  if (Math.abs(TL_H - prev) < 2) return;
  scroll.outerHTML = timelineHTML(ui.dayAnchor);
  positionNowLine();
}
let sideObserver = null;
function observeSide() {
  if (typeof ResizeObserver === 'undefined') return;
  const side = $('.today-side');
  if (!side) return;
  if (sideObserver) sideObserver.disconnect();
  sideObserver = new ResizeObserver(() => fitTimelineToSide());
  sideObserver.observe(side);
}

const ICON = {
  check:  '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
  plus:   '<svg viewBox="0 0 24 24" class="ic"><path d="M12 5v14M5 12h14"/></svg>',
  left:   '<svg viewBox="0 0 24 24" class="ic"><path d="m15 18-6-6 6-6"/></svg>',
  right:  '<svg viewBox="0 0 24 24" class="ic"><path d="m9 18 6-6-6-6"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" class="ic"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash:  '<svg viewBox="0 0 24 24" class="ic"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
  cal:    '<svg viewBox="0 0 24 24" class="ic"><rect x="3" y="4.5" width="18" height="16.5" rx="2.4"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M12 12.5v5M9.5 15h5"/></svg>',
  x:      '<svg viewBox="0 0 24 24" class="ic"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  search: '<svg viewBox="0 0 24 24" class="ic"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  upload: '<svg viewBox="0 0 24 24" class="ic"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 8 5-5 5 5M12 3v12"/></svg>',
  download:'<svg viewBox="0 0 24 24" class="ic"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></svg>',
  lock:   '<svg viewBox="0 0 24 24" class="ic"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2"/></svg>',
  shield: '<svg viewBox="0 0 24 24" class="ic"><path d="M12 2.8 20 6v6c0 5-3.5 8.2-8 9.2-4.5-1-8-4.2-8-9.2V6Z"/><path d="M9 12.2l2 2 4-4"/></svg>',
  apple:  '<svg viewBox="0 0 24 24" class="ic"><path d="M12 7.2c-1.7-1.9-4.4-2-6 .1-1.8 2.4-1 6.4 1 9.4 1.2 1.8 2.3 2.9 3.4 2.7 1-.2 1.6-.8 3.1-.8s2.1.6 3.1.8c1.1.2 2.2-.9 3.4-2.7 2-3 2.8-7 1-9.4-1.6-2.1-4.3-2-6-.1"/><path d="M12 7.2c0-2 1-3.6 3-4.2"/></svg>',
  steps:  '<svg viewBox="0 0 24 24" class="ic"><path d="M4 18c2.2-5.6 4-3.3 6-8.2 1.7-4.2 4 .2 6-3.8 1.2-2.4 2.7-.4 4 2.2"/><path d="M4 21h16"/></svg>',
  weight: '<svg viewBox="0 0 24 24" class="ic"><rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M8 9h8M12 9v5M9.5 14h5"/></svg>',
  water:  '<svg viewBox="0 0 24 24" class="ic"><path d="M12 3.2s6 6.2 6 10.1A6 6 0 0 1 6 13.3C6 9.4 12 3.2 12 3.2Z"/><path d="M9.5 14.2c.3 1.4 1.3 2.3 2.7 2.5"/></svg>',
  sync:   '<svg viewBox="0 0 24 24" class="ic"><path d="M20 11a8 8 0 0 0-14.3-4.6L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.6L20 16"/><path d="M20 20v-4h-4"/></svg>',
  help:   '<svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.7v.4M12 17h.01"/></svg>',
  grip:   '<svg viewBox="0 0 24 24"><path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"/></svg>',
};

/* ---------------- состояние ---------------- */
/* ---------------- состояние и защищённое хранилище ---------------- */
const VAULT_KEY = 'ritm.vault.v2';
const LEGACY_KEY = 'ritm.planner.v1';
const FAIL_KEY = 'ritm.auth.fails.v2';
const UNTIL_KEY = 'ritm.auth.until.v2';
const PBKDF2_ITER = 600000;
const SESSION_KEY = 'ritm.session.v2';

let state = null;                 // расшифрованные данные живут только в памяти
let vault = null;                 // только шифртекст и параметры KDF
let cryptoKey = null;
let unlocked = false;
let authBusy = false;
let saveTimer = null;
let saveChain = Promise.resolve();
let pendingRoutineMove = null;
let dayNoteTimer = null;

const ui = {
  view: 'today',
  dayAnchor: todayKey(),
  weekAnchor: todayKey(),
  monthAnchor: todayKey(),
  routineDay: wdIdx(new Date()),
  tq: '', tcat: 'all', tstatus: 'all',
  needScroll: true,
};

/* все события приложения игнорируются, пока планер заблокирован */
const LOCK_GUARD_EVENTS = ['click','submit','change','input','keydown','dragstart','dragover','drop','dragend'];
LOCK_GUARD_EVENTS.forEach(type => document.addEventListener(type, e => {
  if (unlocked) return;
  const t = e.target;
  if (t && t.closest && (t.closest('#lockScreen') || t.closest('#modalRoot'))) return;
  const mr = $('#modalRoot');
  if (mr && mr.innerHTML.trim()) return;
  e.preventDefault();
  e.stopImmediatePropagation();
}, true));

function supportsCrypto() {
  return !!(window.crypto && window.crypto.subtle && window.crypto.getRandomValues &&
            window.TextEncoder && window.TextDecoder && window.btoa && window.atob);
}
function storageOK() {
  try { const k = '__ritm_probe__'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; }
  catch (e) { return false; }
}
function bytesToB64(u8) {
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64ToBytes(str) {
  const bin = atob(str);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function ctEqual(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
async function deriveMaterial(password, salt, iterations) {
  const km = await window.crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await window.crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: clamp(+iterations || PBKDF2_ITER, 100000, 2000000) }, km, 512));
  const key = await window.crypto.subtle.importKey('raw', bits.slice(0, 32), { name: 'AES-GCM' }, true, ['encrypt','decrypt']);
  const verifier = new Uint8Array(await window.crypto.subtle.digest('SHA-256', bits.slice(32)));
  return { key, verifier, bits };
}
async function materialFromBits(bits) {
  const key = await window.crypto.subtle.importKey('raw', bits.slice(0, 32), { name: 'AES-GCM' }, true, ['encrypt','decrypt']);
  const verifier = new Uint8Array(await window.crypto.subtle.digest('SHA-256', bits.slice(32)));
  return { key, verifier, bits };
}
function saveSessionMaterial(bits) {
  try { sessionStorage.setItem(SESSION_KEY, bytesToB64(new Uint8Array(bits))); } catch (e) {}
}
function clearSessionMaterial() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
}
async function restoreSessionMaterial() {
  let raw = null;
  try { raw = sessionStorage.getItem(SESSION_KEY); } catch (e) { return false; }
  if (!raw) return false;
  try {
    const bits = b64ToBytes(raw);
    if (bits.length !== 64) throw new Error('bad-session');
    const mat = await materialFromBits(bits);
    const rec = readVault();
    if (!rec || !ctEqual(mat.verifier, b64ToBytes(rec.verifier))) throw new Error('stale-session');
    const data = await decryptVault(rec, mat.key);
    vault = rec; cryptoKey = mat.key; state = normalizeState(data);
    afterUnlock();
    return true;
  } catch (e) {
    clearSessionMaterial();
    return false;
  }
}
async function makeVaultRecord(data, key, salt, iterations, verifier) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data))));
  return {
    v: 2, alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', iterations,
    salt: bytesToB64(salt), verifier: bytesToB64(verifier), iv: bytesToB64(iv),
    data: bytesToB64(cipher), updatedAt: Date.now(),
  };
}
async function decryptVault(rec, key) {
  const plain = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(rec.iv) }, key, b64ToBytes(rec.data));
  return JSON.parse(new TextDecoder().decode(plain));
}
async function decryptWithPassword(rec, password) {
  const salt = b64ToBytes(rec.salt);
  const mat = await deriveMaterial(password, salt, rec.iterations);
  if (!ctEqual(mat.verifier, b64ToBytes(rec.verifier))) throw new Error('bad-password');
  const data = await decryptVault(rec, mat.key);
  return { data, key: mat.key, bits: mat.bits };
}
function readVault() {
  let raw = null;
  try { raw = localStorage.getItem(VAULT_KEY); } catch (e) { return null; }
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && v.v === 2 && v.data && v.iv && v.salt && v.verifier && v.iterations) return v;
  } catch (e) {}
  throw new Error('corrupt-vault');
}
function hasLegacy() {
  try { return !!localStorage.getItem(LEGACY_KEY); } catch (e) { return false; }
}
function readLegacyState() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.routines) && Array.isArray(s.tasks)) return normalizeState(s);
    }
  } catch (e) {}
  return seedState();
}
function normalizeState(s) {
  const out = (s && typeof s === 'object') ? s : {};
  out.routines = Array.isArray(out.routines) ? out.routines : [];
  out.tasks = Array.isArray(out.tasks) ? out.tasks : [];
  out.log = (out.log && typeof out.log === 'object') ? out.log : {};
  out.meta = (out.meta && typeof out.meta === 'object') ? out.meta : {};
  out.routineOverrides = (out.routineOverrides && typeof out.routineOverrides === 'object') ? out.routineOverrides : {};
  out.health = (out.health && typeof out.health === 'object') ? out.health : {};
  out.dayNotes = (out.dayNotes && typeof out.dayNotes === 'object') ? out.dayNotes : {};
  out.mood = (out.mood && typeof out.mood === 'object') ? out.mood : {};
  const st = (out.settings && typeof out.settings === 'object') ? out.settings : {};
  out.settings = {
    waterGoal: clamp(+st.waterGoal || 3000, 250, 10000),
    glassMl: [200,250,300,500].includes(+st.glassMl) ? +st.glassMl : 250,
  };
  for (const r of out.routines) {
    if (!Array.isArray(r.days) || r.days.length !== 7) r.days = [1,1,1,1,1,1,1];
    if (!Array.isArray(r.times) || r.times.length !== 7 || r.times.some(t => !/^\d{1,2}:\d{2}$/.test(t || ''))) r.times = null;
    if (!RCOLORS.includes(r.color)) r.color = 'sun';
    if (!r.emoji) r.emoji = '○';
  }
  return out;
}
async function createVault(password, data) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const mat = await deriveMaterial(password, salt, PBKDF2_ITER);
  const normalized = normalizeState(data);
  const rec = await makeVaultRecord(normalized, mat.key, salt, PBKDF2_ITER, mat.verifier);
  localStorage.setItem(VAULT_KEY, JSON.stringify(rec));
  try { localStorage.removeItem(LEGACY_KEY); } catch (e) {}
  vault = rec; cryptoKey = mat.key; state = normalized;
  saveSessionMaterial(mat.bits);
}
async function changeVaultPassword(oldPass, newPass) {
  await flushSave();
  const rec = vault || readVault();
  const { data } = await decryptWithPassword(rec, oldPass);
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const mat = await deriveMaterial(newPass, salt, PBKDF2_ITER);
  const normalized = normalizeState(data);
  const newRec = await makeVaultRecord(normalized, mat.key, salt, PBKDF2_ITER, mat.verifier);
  localStorage.setItem(VAULT_KEY, JSON.stringify(newRec));
  vault = newRec; cryptoKey = mat.key; state = normalized;
  saveSessionMaterial(mat.bits);
}
function save() {
  if (!unlocked || !cryptoKey || !state) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    flushSave().catch(err => { console.error(err); toast('Не удалось сохранить зашифрованные данные'); });
  }, 120);
}
async function flushSave() {
  clearTimeout(saveTimer);
  if (!cryptoKey || !state || !vault) return;
  saveChain = saveChain.catch(() => {}).then(async () => {
    if (!cryptoKey || !state || !vault) return;
    const snapshot = JSON.stringify(state);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const cipher = new Uint8Array(await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, cryptoKey, new TextEncoder().encode(snapshot)));
    const rec = { ...vault, iv: bytesToB64(iv), data: bytesToB64(cipher), updatedAt: Date.now() };
    localStorage.setItem(VAULT_KEY, JSON.stringify(rec));
    vault = rec;
  });
  await saveChain;
}

/* ---------------- пароль: политика и интерфейс входа ---------------- */
function passwordPolicy(pw) {
  pw = String(pw || '');
  const classes = [/[a-zа-яё]/, /[A-ZА-ЯЁ]/, /\d/, /[^A-Za-zА-Яа-яЁё0-9]/].filter(re => re.test(pw)).length;
  const common = /password|qwerty|123456|letmein|admin|пароль/i.test(pw) || /(.)\1{3,}/.test(pw);
  let score = 0;
  if (pw.length >= 12) score++;
  if (pw.length >= 16) score++;
  if (pw.length >= 20) score++;
  score += Math.max(0, classes - 2);
  if (!common) score++;
  score = clamp(score, 0, 5);
  const longPass = pw.length >= 20 && score >= 4 && !common;
  const ok = !common && score >= 4 && pw.length >= 12 && (classes >= 3 || longPass);
  let reason = '';
  if (pw.length < 12) reason = 'Минимум 12 символов; лучше — длинная фраза.';
  else if (common) reason = 'Слишком простой или повторяющийся пароль.';
  else if (classes < 3 && !longPass) reason = 'Добавьте заглавные буквы, цифры или знаки — либо сделайте фразу длиннее 20 символов.';
  else if (score < 4) reason = 'Пароль пока недостаточно устойчив.';
  return {
    score, ok, reason,
    label: score <= 2 ? 'Ненадёжно' : score === 3 ? 'Приемлемо' : score === 4 ? 'Надёжно' : 'Очень надёжно',
    level: score >= 4 ? 'strong' : 'weak',
  };
}
function updateStrength(input) {
  const form = input.closest('form') || document;
  const fill = $('.strength-fill', form), text = $('.strength-text', form);
  const p = passwordPolicy(input.value || '');
  if (fill) { fill.style.width = (input.value ? p.score * 20 : 0) + '%'; fill.dataset.level = input.value ? p.level : 'weak'; }
  if (text) text.textContent = input.value ? (p.reason ? `${p.label} · ${p.reason}` : p.label) : 'Начните вводить пароль';
}
function authDelayLeft() {
  try { return Math.max(0, (+localStorage.getItem(UNTIL_KEY) || 0) - Date.now()); } catch (e) { return 0; }
}
function registerAuthFail() {
  try {
    let n = (+localStorage.getItem(FAIL_KEY) || 0) + 1;
    if (n >= 5) { localStorage.setItem(UNTIL_KEY, String(Date.now() + 30000)); localStorage.setItem(FAIL_KEY, '0'); }
    else localStorage.setItem(FAIL_KEY, String(n));
  } catch (e) {}
}
function clearAuthFails() {
  try { localStorage.removeItem(FAIL_KEY); localStorage.removeItem(UNTIL_KEY); } catch (e) {}
}
function setAuthBusy(text) {
  const busy = $('#lockBusy');
  if (busy) { busy.textContent = text || ''; busy.hidden = !text; }
  const setup = $('#setupForm'), unlock = $('#unlockForm');
  if (setup) setup.classList.toggle('busy', !!text);
  if (unlock) unlock.classList.toggle('busy', !!text);
  const ls = $('#lockScreen');
  if (ls) ls.setAttribute('aria-busy', text ? 'true' : 'false');
}
function showSetupError(msg) {
  const el = $('#setupError');
  if (el) { el.textContent = msg; el.hidden = false; }
}
function showUnlockError(msg) {
  const el = $('#unlockError');
  if (el) { el.textContent = msg; el.hidden = false; }
}
function showSetup(message = '') {
  const setup = $('#setupForm'), unlock = $('#unlockForm');
  setup.hidden = false; unlock.hidden = true;
  setup.reset();
  $('#setupError').hidden = true;
  $('#lockBusy').hidden = true;
  $('#lockScreen').classList.remove('fatal');
  $('#lockMessage').textContent = message || 'Задайте пароль: все записи будут храниться только в зашифрованном виде.';
  $('#setupLegacyNote').textContent = hasLegacy()
    ? 'Найдены прежние записи планера — после создания пароля они будут зашифрованы, а открытая старая копия удалена.'
    : 'Все записи планера будут зашифрованы. Пароль не сохраняется: без него данные восстановить нельзя.';
  updateStrength($('#setupPass'));
  setTimeout(() => $('#setupPass') && $('#setupPass').focus(), 60);
}
function showUnlock(message = '') {
  const setup = $('#setupForm'), unlock = $('#unlockForm');
  setup.hidden = true; unlock.hidden = false;
  unlock.reset();
  $('#unlockError').hidden = true;
  $('#lockBusy').hidden = true;
  $('#lockScreen').classList.remove('fatal');
  $('#lockMessage').textContent = message || 'Введите пароль, чтобы расшифровать планер.';
  setTimeout(() => $('#unlockPass') && $('#unlockPass').focus(), 60);
}
function showFatal(message) {
  $('#setupForm').hidden = true; $('#unlockForm').hidden = true; $('#lockBusy').hidden = true;
  $('#lockScreen').hidden = false;
  $('#lockScreen').classList.add('fatal');
  $('#lockMessage').textContent = message;
}
function clearUnlockedDOM() {
  $$('.view').forEach(v => { v.hidden = true; v.innerHTML = ''; });
  const ms = $('#miniStats'); if (ms) ms.innerHTML = '';
  const t = $('#toast'); if (t) { t.classList.remove('show'); t.textContent = ''; }
  try { closeModal(); } catch (e) {}
  try { closePopover(); } catch (e) {}
}
function afterUnlock(message = '') {
  unlocked = true;
  try { localStorage.removeItem(LEGACY_KEY); } catch (e) {}
  clearAuthFails();
  document.body.classList.remove('locked');
  $('#lockScreen').hidden = true;
  const app = $('#app');
  app.inert = false;
  app.removeAttribute('aria-hidden');
  render();
  if (state.meta && state.meta.firstRun) {
    state.meta.firstRun = false;
    save();
    setTimeout(() => toast('Добро пожаловать в «Ритм». Здесь есть пример данных — меняйте всё под себя.'), 500);
  }
  if (message) toast(message);
}
async function lock(reason = 'Планер заблокирован') {
  if (!unlocked) return;
  unlocked = false;
  try { await flushSave(); } catch (e) { console.error(e); }
  state = null; cryptoKey = null; pendingRoutineMove = null;
  clearUnlockedDOM();
  const app = $('#app');
  app.inert = true;
  app.setAttribute('aria-hidden', 'true');
  document.body.classList.add('locked');
  $('#lockScreen').hidden = false;
  showUnlock(reason + '. Введите пароль, чтобы продолжить.');
  clearSessionMaterial();
}
async function onSetup(e) {
  e.preventDefault();
  if (authBusy) return;
  const pass = $('#setupPass').value, pass2 = $('#setupPass2').value;
  const policy = passwordPolicy(pass);
  if (!policy.ok) return showSetupError(policy.reason || 'Пароль недостаточно надёжный.');
  if (pass !== pass2) return showSetupError('Пароли не совпадают.');
  if (!$('#setupAck').checked) return showSetupError('Подтвердите, что понимаете: забытый пароль не восстанавливается.');
  authBusy = true; setAuthBusy('Создаём ключ и шифруем данные…');
  try {
    await createVault(pass, readLegacyState());
    afterUnlock('Планер зашифрован. Добро пожаловать.');
  } catch (err) {
    console.error(err);
    showSetupError('Не удалось создать защищённое хранилище: ' + (err && err.message ? err.message : err));
  } finally { authBusy = false; setAuthBusy(''); }
}
async function onUnlock(e) {
  e.preventDefault();
  if (authBusy) return;
  const left = authDelayLeft();
  if (left > 0) return showUnlockError(`Слишком много попыток. Повторите через ${Math.ceil(left / 1000)} с.`);
  const pass = $('#unlockPass').value;
  authBusy = true; setAuthBusy('Проверяем пароль и расшифровываем…');
  try {
    const rec = vault || readVault();
    if (!rec) throw new Error('no-vault');
    const { data, key, bits } = await decryptWithPassword(rec, pass);
    state = normalizeState(data); cryptoKey = key; vault = rec;
    saveSessionMaterial(bits);
    afterUnlock('С возвращением.');
  } catch (err) {
    if (err && err.message === 'bad-password') {
      registerAuthFail();
      const d = authDelayLeft();
      showUnlockError(d > 0 ? `Неверный пароль. Следующая попытка через ${Math.ceil(d / 1000)} с.` : 'Неверный пароль. Проверьте раскладку и попробуйте ещё раз.');
    } else {
      showUnlockError('Не удалось открыть хранилище. Убедитесь, что сайт открыт через HTTPS или localhost.');
    }
  } finally { authBusy = false; setAuthBusy(''); }
}
async function initAuth() {
  if (!supportsCrypto()) {
    showFatal('Для шифрования нужен Web Crypto API. Откройте сайт по HTTPS или через localhost в современном браузере.');
    return;
  }
  if (!storageOK()) {
    showFatal('Локальное хранилище браузера недоступно. Разрешите его для этого сайта, иначе планер не сможет сохранять данные.');
    return;
  }
  try { vault = readVault(); }
  catch (e) {
    vault = null;
    showFatal('Зашифрованное хранилище повреждено. Восстановите данные из резервной копии или удалите хранилище и начните заново.');
    return;
  }
  if (vault) {
    setAuthBusy('Восстанавливаем сессию этой вкладки…');
    const restored = await restoreSessionMaterial();
    setAuthBusy('');
    if (!restored) showUnlock('Введите пароль, чтобы расшифровать планер.');
  } else showSetup(hasLegacy()
    ? 'Найдены прежние открытые записи. Задайте пароль — они будут зашифрованы, а старая копия удалена.'
    : 'Задайте пароль: все записи будут храниться только в зашифрованном виде.');
}

function seedState() {
  const t = new Date();
  const tk = dateKey(t), tm = dateKey(addDays(t, 1));
  const y1 = dateKey(addDays(t, -1)), y2 = dateKey(addDays(t, -2));
  const wk = weekKeyOf(t);
  const daily = [1,1,1,1,1,1,1], workdays = [1,1,1,1,1,0,0];
  const R = (title, emoji, time, dur, color, days) =>
    ({ id: uid(), title, emoji, time, dur, color, days, times: null });
  const routines = [
    R('Подъём, вода, растяжка',      '◌', '07:00', 30,  'sun',        daily),
    R('Завтрак без телефона',        '○', '07:30', 30,  'terracotta', daily),
    R('Работа: фокус-блок',          '▢', '09:00', 180, 'sky',        workdays),
    R('Обед и прогулка',             '◇', '13:00', 60,  'sage',       daily),
    R('Работа: встречи и задачи',    '▤', '14:00', 180, 'sky',        workdays),
    R('Тренировка',                  '✳', '18:00', 60,  'plum',       [0,0,1,0,0,1,0]),
    R('Ужин с семьёй',               '⌂', '19:30', 60,  'terracotta', daily),
    R('Чтение перед сном',           '☾', '22:00', 30,  'teal',       daily),
  ];
  const T = (title, cat, prio, dur, extra = {}) =>
    ({ id: uid(), title, notes: '', cat, prio, dur, done: false, date: null, week: null, startTime: null, createdAt: Date.now(), ...extra });
  const tasks = [
    T('Английский: серия с субтитрами + 10 слов', 'study', 3, 45, { date: tk, startTime: '21:00', notes: 'Продолжить курс B2' }),
    T('Позвонить маме',                          'people', 3, 30, { date: tk }),
    T('Записаться к стоматологу',                'health', 2, 30, { date: tm }),
    T('Составить бюджет на месяц',               'money', 2, 60, { week: wk }),
    T('Выбрать подарок другу на день рождения',  'people', 2, 45, { week: wk }),
    T('Пробежать первые 5 км',                   'health', 2, 60, { date: y1, done: true, doneDate: y1 }),
    T('Обновить сайт-портфолио',                 'work', 3, 120, { notes: 'Добавить 3 новых кейса, заменить фото' }),
    T('Пройти полный чекап организма',           'health', 3, 180, { notes: 'Анализы, терапевт, окулист' }),
    T('Оформить загранпаспорт',                  'errands', 3, 120),
    T('Финансовый план на год',                  'money', 2, 90, { notes: 'Цели по накоплениям и крупным покупкам' }),
    T('Выучить 3 песни на гитаре',               'fun', 1, 45),
    T('Разобрать шкаф и отдать лишнее',          'home', 1, 90),
    T('Прочитать «Атомные привычки»',            'study', 1, 30, { notes: 'По 20 страниц в день — уже в рутине чтения' }),
    T('Спланировать поездку на выходные',        'people', 2, 60),
    T('Цифровая уборка: почта, фото, подписки',  'errands', 1, 60),
    T('Начать вести дневник питания',            'health', 1, 15),
  ];
  const nm = nowMin();
  const log = {};
  log[y2] = { r: Object.fromEntries(routines.map(r => [r.id, true])) };
  log[y1] = { r: Object.fromEntries(routines.map(r => [r.id, true])) };
  log[tk] = { r: Object.fromEntries(routines.filter(r => toMin(r.time) < nm).map(r => [r.id, true])) };
  return {
    routines, tasks, log,
    routineOverrides: {},
    health: {},
    dayNotes: {},
    mood: {},
    settings: { waterGoal: 3000, glassMl: 250 },
    meta: { firstRun: true, createdAt: Date.now() },
  };
}

/* ---------------- трекеры: вода, настроение, итоги дня ---------------- */
function healthOn(key) {
  const h = (state.health && state.health[key]) || {};
  const src = (h.sources && typeof h.sources === 'object') ? h.sources : {};
  return {
    water: Math.max(0, Math.round(+h.water || 0)),
    source: src.water || null,
    updatedAt: h.updatedAt || null,
  };
}
function ensureHealth(key) {
  if (!state.health) state.health = {};
  if (!state.health[key]) state.health[key] = { water: 0, sources: {}, updatedAt: null };
  const h = state.health[key];
  h.sources = h.sources || {};
  return h;
}
function adjustWater(key, delta) {
  const h = ensureHealth(key);
  h.water = Math.max(0, (+h.water || 0) + (+delta || 0));
  h.sources.water = 'manual';
  h.updatedAt = Date.now();
  save(); render();
}
function setWaterGlasses(key, glasses) {
  const h = ensureHealth(key), g = state.settings.glassMl;
  let target = Math.max(0, (+glasses || 0)) * g;
  if (Math.abs((+h.water || 0) - target) < 1) target = Math.max(0, target - g);
  h.water = target;
  h.sources.water = 'manual';
  h.updatedAt = Date.now();
  save(); render();
}
function moodOn(key) {
  const m = (state.mood && state.mood[key]) || {};
  const v = +m.value;
  return { value: MOODS[v] ? v : null, note: String(m.note || ''), updatedAt: m.updatedAt || null };
}
function setMood(key, value) {
  const v = +value;
  const cur = moodOn(key);
  if (!state.mood) state.mood = {};
  state.mood[key] = { value: MOODS[v] ? v : null, note: cur.note, updatedAt: Date.now() };
  save(); render();
}
function setMoodNote(key, note) {
  const cur = moodOn(key);
  if (!state.mood) state.mood = {};
  state.mood[key] = { value: cur.value, note: String(note || '').slice(0, 240), updatedAt: Date.now() };
  save();
}
function dayNoteOn(key) {
  const n = (state.dayNotes && state.dayNotes[key]) || {};
  return { text: String(n.text || ''), updatedAt: n.updatedAt || null };
}
function setDayNote(key, text) {
  if (!state.dayNotes) state.dayNotes = {};
  state.dayNotes[key] = { text: String(text || ''), updatedAt: Date.now() };
  save();
}
function buildDaySummaryDraft(key) {
  const d = parseKey(key);
  const rs = routinesOn(key).filter(r => routineDone(key, r.id));
  const ts = tasksOn(key).filter(t => t.done);
  const mood = moodOn(key);
  const free = freeSlotsOn(key).reduce((s, x) => s + (x.end - x.start), 0);
  const routineNames = rs.map(r => r.title).join(', ');
  const taskNames = ts.map(t => t.title).join(', ');
  const moodText = mood.value ? `«${MOODS[mood.value].emoji} ${MOODS[mood.value].label}»` : null;

  const routineSentence = rs.length
    ? `В привычном ритме прошли ${routineNames}.`
    : 'Рутина пока осталась без отметок, день ещё собирается.';
  const taskSentence = ts.length
    ? `Из дел удалось довести до конца ${taskNames}.`
    : 'Крупных дел закрыть пока не удалось, зато день не рассыпался на спешку.';
  const moodSentence = moodText
    ? `Настроение я отметил как ${moodText}${mood.note ? ` — ${mood.note}` : ''}.`
    : 'Настроение пока не отмечено, и эту строку можно дописать вечером.';
  const freeSentence = free > 0
    ? `Между делом оставалось около ${fmtDur(free)} свободного времени, которое можно было потратить на паузу.`
    : 'Плотный день почти не оставил свободных пауз.';

  return [
    `Сегодня — ${fmtDateLong(d)}. День сложился так. ${routineSentence} ${taskSentence} ${moodSentence} ${freeSentence}`,
    '',
    'Лучше всего сегодня получилось … . Завтра я хочу попробовать … .',
  ].join('\n');
}

/* ---------------- исключения и время рутины ---------------- */
function routineOverride(key, rid) {
  const map = state.routineOverrides && state.routineOverrides[key];
  return map ? (map[rid] || null) : null;
}
function activeDayList(r) {
  return [0,1,2,3,4,5,6].filter(i => r.days && r.days[i]);
}
function repeatLabel(r) {
  const a = activeDayList(r);
  if (a.length === 7) return 'каждый день';
  if (a.length === 5 && a.every(i => i < 5)) return 'по будням';
  if (a.length === 2 && a[0] === 5 && a[1] === 6) return 'по выходным';
  return a.length ? a.map(i => WD_SHORT[i]).join(' · ') : 'без повтора';
}
function routineTimeByIdx(r, i) {
  return (r.times && r.times[i]) || r.time;
}
function routineTime(r, key) {
  const ov = routineOverride(key, r.id);
  if (ov && ov.time) return ov.time;
  return routineTimeByIdx(r, wdIdx(parseKey(key)));
}
function currentTimesArray(r) {
  return [0,1,2,3,4,5,6].map(i => routineTimeByIdx(r, i));
}
function simplifyTimes(r) {
  if (r.times && r.times.every(t => t === r.time)) r.times = null;
}
function routineTimeSummary(r) {
  if (!r.times) return `${r.time}–${toHHMM(toMin(r.time) + r.dur)} · ${fmtDur(r.dur)}`;
  const custom = r.times.some((t, i) => r.days[i] && t !== r.time);
  if (!custom) return `${r.time}–${toHHMM(toMin(r.time) + r.dur)} · ${fmtDur(r.dur)}`;
  return `разное время по дням · ${fmtDur(r.dur)}`;
}
function routineTimeTitle(r) {
  return [0,1,2,3,4,5,6].map(i => `${WD_SHORT[i]} ${routineTimeByIdx(r, i)}`).join(' · ');
}
function ensureOverride(key, rid) {
  if (!state.routineOverrides) state.routineOverrides = {};
  if (!state.routineOverrides[key]) state.routineOverrides[key] = {};
  if (!state.routineOverrides[key][rid]) state.routineOverrides[key][rid] = {};
  return state.routineOverrides[key][rid];
}
function pruneOverride(key, rid) {
  const map = state.routineOverrides && state.routineOverrides[key];
  if (!map) return;
  if (map[rid] && !Object.keys(map[rid]).length) delete map[rid];
  if (!Object.keys(map).length) delete state.routineOverrides[key];
}
function weekdayOfKey(k) {
  try { return wdIdx(parseKey(k)); } catch (e) { return -1; }
}
function clearTimeOverrides(rid, weekdays = null) {
  for (const k of Object.keys(state.routineOverrides || {})) {
    if (weekdays && !weekdays.has(weekdayOfKey(k))) continue;
    const map = state.routineOverrides[k];
    if (!map || !map[rid]) continue;
    delete map[rid].time;
    pruneOverride(k, rid);
  }
}
function clearDayOverrides(rid, weekdays = null, removeTime = false) {
  for (const k of Object.keys(state.routineOverrides || {})) {
    if (weekdays && !weekdays.has(weekdayOfKey(k))) continue;
    const map = state.routineOverrides[k];
    if (!map || !map[rid]) continue;
    delete map[rid].add;
    delete map[rid].skip;
    if (removeTime) delete map[rid].time;
    pruneOverride(k, rid);
  }
}
function pruneRoutineOverrides(rid) {
  for (const k of Object.keys(state.routineOverrides || {})) {
    const map = state.routineOverrides[k];
    if (map && map[rid]) { delete map[rid]; pruneOverride(k, rid); }
  }
}

/* ---------------- производные данные ---------------- */
const findTask = id => state.tasks.find(t => t.id === id);
const findRoutine = id => state.routines.find(r => r.id === id);

function routinesOn(key) {
  const i = wdIdx(parseKey(key));
  return state.routines.filter(r => {
    const ov = routineOverride(key, r.id);
    if (ov && ov.skip) return false;
    return (r.days && r.days[i]) || (ov && ov.add);
  }).slice().sort((a, b) => toMin(routineTime(a, key)) - toMin(routineTime(b, key)));
}
function blocksOn(key) {
  const out = [];
  for (const r of routinesOn(key)) {
    const s = toMin(routineTime(r, key));
    out.push({ kind: 'routine', id: r.id, start: s, end: s + r.dur, r });
  }
  for (const t of state.tasks) {
    if (t.date === key && t.startTime) {
      const s = toMin(t.startTime);
      out.push({ kind: 'task', id: t.id, start: s, end: s + t.dur, t });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}
function freeSlotsOn(key) {
  const busy = blocksOn(key)
    .map(b => [Math.max(b.start, DAY_START), Math.min(b.end, DAY_END)])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [s, e] of busy) {
    if (merged.length && s <= merged[merged.length - 1][1])
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
    else merged.push([s, e]);
  }
  const slots = [];
  let cur = DAY_START;
  for (const [s, e] of merged) {
    if (s - cur >= 15) slots.push({ start: cur, end: s });
    cur = Math.max(cur, e);
  }
  if (DAY_END - cur >= 15) slots.push({ start: cur, end: DAY_END });
  return slots;
}
const tasksOn = key => state.tasks.filter(t => t.date === key);
const weekPoolFor = wk => state.tasks.filter(t => !t.date && t.week === wk && !t.done);
const backlogTasks = () => state.tasks.filter(t => !t.done && !t.date && !t.week);

function routineDone(key, id) {
  return !!(state.log[key] && state.log[key].r && state.log[key].r[id]);
}
function dayHasChecks(key) {
  const l = state.log[key];
  return !!(l && l.r && Object.values(l.r).some(Boolean));
}
function streak() {
  let n = 0;
  const d = new Date();
  if (!dayHasChecks(dateKey(d))) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 500; i++) {
    if (dayHasChecks(dateKey(d))) { n++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return n;
}
function sortTasks(a, b) {
  if (!!a.done !== !!b.done) return a.done ? 1 : -1;
  if (!!a.startTime !== !!b.startTime) return a.startTime ? -1 : 1;
  if (a.startTime && b.startTime) return toMin(a.startTime) - toMin(b.startTime);
  if (b.prio !== a.prio) return b.prio - a.prio;
  return (b.createdAt || 0) - (a.createdAt || 0);
}

/* ---------------- маленькие HTML-хелперы ---------------- */
function checkHTML(done, action, id, key) {
  return `<button class="check ${done ? 'on' : ''}" data-action="${action}" data-id="${id}"${key ? ` data-key="${key}"` : ''} aria-label="Отметить выполнение">${ICON.check}</button>`;
}
function prioBadge(p) {
  return `<span class="badge prio-${p}">${PRIO[p] || PRIO[2]}</span>`;
}
function schedBadge(t) {
  if (t.done) return `<span class="badge sched-done">✓ сделано${t.doneDate ? ' · ' + relDayLabel(t.doneDate) : ''}</span>`;
  if (t.date) return `<span class="badge sched-day">${relDayLabel(t.date)}${t.startTime ? ', ' + t.startTime : ''}</span>`;
  if (t.week) {
    const cur = weekKeyOf(new Date());
    let label = 'неделя ' + t.week.slice(5);
    if (t.week === cur) label = 'эта неделя';
    else if (t.week === weekKeyOf(addDays(new Date(), 7))) label = 'след. неделя';
    return `<span class="badge sched-week">${label}</span>`;
  }
  return `<span class="badge">в списке</span>`;
}
function taskCardHTML(t, { compact = false } = {}) {
  const c = CATS[t.cat] || CATS.errands;
  const key = t.date || todayKey();
  return `<div class="tcard draggable-task cat-${t.cat} ${t.done ? 'done' : ''} ${compact ? 'compact' : ''}" draggable="true" data-task="${t.id}">
    ${checkHTML(t.done, 'toggle-task', t.id, key)}
    <div class="tcard-body" data-action="task-menu" data-id="${t.id}">
      <div class="tcard-title">${esc(t.title)}</div>
      <div class="tcard-meta">
        <span>${c.emoji} ${c.name}</span><span class="sep">·</span><span>${fmtDurS(t.dur)}</span>${t.startTime ? `<span class="sep">·</span><span>${t.startTime}</span>` : ''}${t.prio === 3 ? `<span class="sep">·</span><span class="prio-high">важное</span>` : ''}
      </div>
    </div>
  </div>`;
}

/* ================= VIEW: СЕГОДНЯ ================= */
function ringHTML(pct, done, total, label, color) {
  const R = 26, C = 2 * Math.PI * R;
  return `<div class="ring" title="${label}: ${done} из ${total}">
    <svg viewBox="0 0 64 64">
      <circle class="ring-bg" cx="32" cy="32" r="${R}"/>
      <circle class="ring-fg" cx="32" cy="32" r="${R}" style="stroke:${color};stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${(C * (1 - pct)).toFixed(1)}"/>
    </svg>
    <div class="ring-center">${done}/${total}</div>
    <div class="ring-label">${label}</div>
  </div>`;
}

function timelineHTML(key) {
  const blocks = blocksOn(key);
  const slots = freeSlotsOn(key);
  let gutter = '', lines = '';
  const lineStep = PPM >= 0.55 ? 30 : 60; // при сильном сжатии оставляем только часовые линии
  for (let m = DAY_START; m <= DAY_END; m += lineStep) {
    const top = (m - DAY_START) * PPM;
    if (m % 60 === 0) {
      gutter += `<div class="tl-hour" style="top:${top}px">${toHHMM(m)}</div>`;
      lines  += `<div class="tl-line" style="top:${top}px"></div>`;
    } else {
      lines  += `<div class="tl-line half" style="top:${top}px"></div>`;
    }
  }
  let inner = '';
  for (const s of slots) {
    const top = (s.start - DAY_START) * PPM, h = (s.end - s.start) * PPM;
    const slotCompact = h < 44 ? 'compact' : '';
    inner += `<div class="slot drop-slot ${slotCompact}" style="top:${top}px;height:${h}px" data-action="slot-click" data-key="${key}" data-start="${s.start}" data-end="${s.end}">
      <div class="slot-in">
        <span class="slot-label">свободно · ${fmtDur(s.end - s.start)}</span>
        <span class="slot-add">+ заполнить делом</span>
      </div>
    </div>`;
  }
  for (const b of blocks) {
    const bs = Math.max(b.start, DAY_START), be = Math.min(b.end, DAY_END);
    if (be <= bs) continue;
    const top = (bs - DAY_START) * PPM, h = (be - bs) * PPM;
    const compact = h < 52 ? 'compact' : '';
    if (b.kind === 'routine') {
      const r = b.r, done = routineDone(key, r.id);
      inner += `<div class="block routine draggable-routine color-${r.color || 'sun'} ${done ? 'done' : ''} ${compact}" draggable="true" data-routine="${r.id}" data-key="${key}" style="top:${top}px;height:${h}px" data-action="edit-routine" data-id="${r.id}" title="Перетащите, чтобы изменить время; нажмите — чтобы изменить рутину">
        <button class="block-check ${done ? 'on' : ''}" data-action="toggle-routine" data-id="${r.id}" data-key="${key}" aria-label="Отметить">${ICON.check}</button>
        <span class="block-grip" data-action="noop" aria-hidden="true">${ICON.grip}</span>
        <div class="block-text">
          <div class="block-title">${r.emoji || '•'} ${esc(r.title)}</div>
          <div class="block-sub">${routineTime(r, key)}–${toHHMM(toMin(routineTime(r, key)) + r.dur)} · ${fmtDurS(r.dur)} · ${repeatLabel(r)}</div>
        </div>
      </div>`;
    } else {
      const t = b.t, c = CATS[t.cat] || CATS.errands;
      inner += `<div class="block task draggable-task cat-${t.cat} ${t.done ? 'done' : ''} ${compact}" draggable="true" data-task="${t.id}" style="top:${top}px;height:${h}px">
        <button class="block-check ${t.done ? 'on' : ''}" data-action="toggle-task" data-id="${t.id}" data-key="${key}" aria-label="Отметить">${ICON.check}</button>
        <div class="block-text" data-action="task-menu" data-id="${t.id}">
          <div class="block-title">${c.emoji} ${esc(t.title)}</div>
          <div class="block-sub">${toHHMM(b.start)}–${toHHMM(b.end)} · ${fmtDurS(t.dur)}${t.startTime ? '' : ''}</div>
        </div>
      </div>`;
    }
  }
  const isToday = key === todayKey();
  inner += `<div class="now-line" id="nowLine" ${isToday ? '' : 'hidden'}><span class="now-dot"></span><span class="now-time" id="nowTime"></span></div>`;
  const fit = PPM < 0.75 ? ' fit' : '';
  return `<div class="tl-scroll" id="tlScroll" style="height:${TL_H + TL_PAD}px"><div class="tl-body routine-drop-body${fit}" data-key="${key}" style="height:${TL_H}px">${gutter}${lines}${inner}</div></div>`;
}

function healthStripHTML(key) {
  const d = parseKey(key);
  const h = healthOn(key);
  const st = state.settings;
  const waterPct = clamp(h.water / st.waterGoal, 0, 1);
  const glassCount = clamp(Math.ceil(st.waterGoal / st.glassMl), 1, 16);
  const filled = Math.min(glassCount, Math.floor(h.water / st.glassMl));
  const glasses = Array.from({ length: glassCount }, (_, i) =>
    `<button class="water-glass ${i < filled ? 'on' : ''}" data-action="water-set" data-glasses="${i + 1}" data-key="${key}" title="${(i + 1) * st.glassMl} мл" aria-label="${(i + 1) * st.glassMl} мл"></button>`).join('');
  const mood = moodOn(key);
  const moodBtns = Object.entries(MOODS).map(([v, m]) =>
    `<button class="mood-btn ${mood.value === +v ? 'on' : ''}" data-action="mood-set" data-value="${v}" data-key="${key}" title="${m.label}" aria-label="${m.emoji} ${m.label}">
       <span class="mood-emoji" aria-hidden="true">${m.emoji}</span><small>${m.label}</small>
     </button>`).join('');
  const moodValue = mood.value ? `<span class="mood-emoji" aria-hidden="true">${MOODS[mood.value].emoji}</span>` : '—';

  return `<section class="health-strip" aria-label="Трекеры дня">
    <div class="health-head">
      <div>
        <div class="eyebrow">Трекеры · ${fmtDateShort(d)}</div>
        <h2>Вода и состояние</h2>
      </div>
      <div class="health-actions">
        <button class="btn ghost sm" data-action="water-settings" data-key="${key}">${ICON.pencil} Цель и стакан</button>
      </div>
    </div>
    <div class="health-grid">
      <article class="health-card water-card">
        <div class="health-card-head">
          <span class="health-icon">${ICON.water}</span><span class="health-label">Вода</span>
          <button class="icon-btn" data-action="water-edit" data-key="${key}" aria-label="Изменить воду">${ICON.pencil}</button>
        </div>
        <div class="health-value">${(h.water / 1000).toFixed(1)} <small>/ ${(st.waterGoal / 1000).toFixed(1)} л</small></div>
        <div class="health-progress"><span style="width:${(waterPct * 100).toFixed(1)}%"></span></div>
        <div class="water-glasses">${glasses}</div>
        <div class="water-actions">
          <button class="btn ghost sm" data-action="water-add" data-ml="-${st.glassMl}" data-key="${key}">− ${st.glassMl} мл</button>
          <button class="btn soft sm" data-action="water-add" data-ml="${st.glassMl}" data-key="${key}">+ ${st.glassMl} мл</button>
        </div>
        <div class="health-note">${glassCount} стаканов по ${st.glassMl} мл · цель ${(st.waterGoal / 1000).toFixed(1)} л</div>
      </article>
      <article class="health-card mood-card">
        <div class="health-card-head">
          <span class="health-icon">${ICON.help}</span><span class="health-label">Настроение</span>
        </div>
        <div class="health-value">${moodValue} <small>${mood.value ? MOODS[mood.value].label : 'не отмечено'}</small></div>
        <div class="mood-row">${moodBtns}</div>
        <input class="input mood-note" data-mood-note data-key="${key}" maxlength="240" value="${esc(mood.note)}" placeholder="Одна строка про состояние…">
        <div class="health-note">Оценка и заметка сохраняются автоматически</div>
      </article>
    </div>
  </section>`;
}

function daySummaryHTML(key) {
  const n = dayNoteOn(key);
  return `<section class="card day-note-card" aria-label="Итоги дня">
    <div class="card-head">
      <h3>Итоги дня</h3>
      <span class="hint">сохраняется автоматически</span>
    </div>
    <div class="day-note-body">
      <textarea class="input day-note-textarea" data-day-note data-key="${key}" placeholder="Что сделано, что понравилось, что перенести на завтра…">${esc(n.text)}</textarea>
      <div class="day-note-actions">
        <button class="btn soft sm" data-action="day-note-draft" data-key="${key}">Собрать рассказ о дне</button>
        <button class="btn ghost sm" data-action="day-note-clear" data-key="${key}">Очистить</button>
        <span class="day-note-saved">${n.updatedAt ? 'сохранено' : 'пока пусто'}</span>
      </div>
    </div>
  </section>`;
}

function monthDates(anchorKey) {
  const d = parseKey(anchorKey), y = d.getFullYear(), m = d.getMonth();
  const last = new Date(y, m + 1, 0);
  const out = [];
  for (let day = 1; day <= last.getDate(); day++) out.push(new Date(y, m, day));
  return out;
}
function monthHTML() {
  const anchor = parseKey(ui.monthAnchor);
  const y = anchor.getFullYear(), m = anchor.getMonth();
  const title = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(y, m, 1));
  const days = monthDates(ui.monthAnchor);
  const st = state.settings;
  const rows = days.map(date => {
    const key = dateKey(date);
    const h = healthOn(key), mo = moodOn(key);
    const isToday = key === todayKey();
    const goal = h.water >= st.waterGoal;
    const pct = clamp(h.water / st.waterGoal, 0, 1) * 100;
    const moodLabel = mo.value ? `${MOODS[mo.value].emoji} ${MOODS[mo.value].label}` : '—';
    return `<tr class="${isToday ? 'is-today' : ''}">
      <td>${date.getDate()} ${WD_SHORT[wdIdx(date)]}${isToday ? ' · сегодня' : ''}</td>
      <td>${moodLabel}</td>
      <td>${mo.note ? esc(mo.note) : '<span class="muted">—</span>'}</td>
      <td>${(h.water / 1000).toFixed(1)} л</td>
      <td>${Math.floor(h.water / st.glassMl)}</td>
      <td><div class="month-bar"><span style="width:${pct.toFixed(1)}%"></span></div><span class="muted">${goal ? 'норма' : Math.round(pct) + '%'}</span></td>
    </tr>`;
  }).join('');
  const moodVals = days.map(date => moodOn(dateKey(date)).value).filter(Boolean);
  const avgMood = moodVals.length ? (moodVals.reduce((a, b) => a + b, 0) / moodVals.length).toFixed(1) : '—';
  const totalWater = days.reduce((sum, date) => sum + healthOn(dateKey(date)).water, 0);
  const waterDays = days.filter(date => healthOn(dateKey(date)).water > 0).length;
  const avgWater = waterDays ? (totalWater / waterDays / 1000).toFixed(1) : '0.0';
  const goalDays = days.filter(date => healthOn(dateKey(date)).water >= st.waterGoal).length;
  const last = new Date(y, m + 1, 0);
  const closed = last < parseKey(todayKey());
  const status = closed ? 'Итог месяца' : 'Сводка формируется';

  return `<div class="page-head">
    <div>
      <h1 class="page-title">Месяц</h1>
      <div class="page-sub">${title} · <b>${status}</b> — настроение и вода по дням</div>
    </div>
    <div class="head-actions">
      <div class="date-nav">
        <button class="btn icon ghost" data-action="month-prev" aria-label="Прошлый месяц">${ICON.left}</button>
        <button class="btn ghost sm" data-action="month-today" style="border:none;box-shadow:none">этот месяц</button>
        <button class="btn icon ghost" data-action="month-next" aria-label="Следующий месяц">${ICON.right}</button>
      </div>
    </div>
  </div>

  <div class="month-stats">
    <div class="month-stat"><span>Дней с настроением</span><b>${moodVals.length} / ${days.length}</b></div>
    <div class="month-stat"><span>Среднее настроение</span><b>${avgMood} / 5</b></div>
    <div class="month-stat"><span>Вода за месяц</span><b>${(totalWater / 1000).toFixed(1)} л</b></div>
    <div class="month-stat"><span>Средняя вода</span><b>${avgWater} л/день</b></div>
    <div class="month-stat"><span>Дней с нормой</span><b>${goalDays}</b></div>
  </div>

  <div class="card month-card">
    <div class="card-head">
      <h3>Сводная таблица трекеров</h3>
      <span class="hint">доступна в любой день · после последнего дня месяца считается итоговой</span>
    </div>
    <div class="month-table-wrap">
      <table class="month-table">
        <thead><tr><th>Дата</th><th>Настроение</th><th>Заметка</th><th>Вода</th><th>Стаканы</th><th>Цель ${(st.waterGoal / 1000).toFixed(1)} л</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function todayHTML() {
  const key = ui.dayAnchor;
  const d = parseKey(key);
  const isToday = key === todayKey();
  const rs = routinesOn(key);
  const ts = tasksOn(key);
  const rDone = rs.filter(r => routineDone(key, r.id)).length;
  const tDone = ts.filter(t => t.done).length;
  const freeMin = freeSlotsOn(key).reduce((s, x) => s + (x.end - x.start), 0);

  const untimed = ts.filter(t => !t.startTime).sort(sortTasks);
  const wk = weekKeyOf(d);
  const pool = weekPoolFor(wk).sort(sortTasks);
  const backlog = backlogTasks().sort(sortTasks).slice(0, 4);

  const head = `<div class="page-head">
    <div>
      <h1 class="page-title">${isToday ? 'Сегодня' : relDayLabel(key).replace(/^./, ch => ch.toUpperCase())}</h1>
      <div class="page-sub">${fmtDateLong(d)}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}${isToday ? '' : ' · <b>не сегодня</b>'}</div>
    </div>
    <div class="head-actions">
      <div class="date-nav">
        <button class="btn icon ghost" data-action="day-prev" aria-label="Предыдущий день">${ICON.left}</button>
        <div class="date-nav-label page-sub" style="margin:0">${isToday ? 'сегодня' : fmtDateShort(d) + ', ' + WD_SHORT[wdIdx(d)]}</div>
        <button class="btn icon ghost" data-action="day-next" aria-label="Следующий день">${ICON.right}</button>
      </div>
      ${isToday ? '' : `<button class="btn ghost" data-action="day-today">На сегодня</button>`}
      <button class="btn primary" data-action="add-task" data-date="${key}">${ICON.plus} Дело на день</button>
    </div>
  </div>`;

  const stats = `<div class="today-stats">
    <div class="rings">
      ${ringHTML(rs.length ? rDone / rs.length : 0, rDone, rs.length, 'рутина', 'var(--ink-2)')}
      ${ringHTML(ts.length ? tDone / ts.length : 0, tDone, ts.length, 'дела', 'var(--accent)')}
    </div>
    <div class="free-chip"><b>${fmtDur(freeMin)}</b><span>свободно</span></div>
  </div>`;

  return `${head}
  <div style="display:flex;justify-content:flex-end;margin:-8px 0 14px">${stats}</div>
  ${healthStripHTML(key)}
  <div class="today-grid">
    <div class="card tl-card">
      <div class="card-head">
        <h3>План дня</h3>
        <span class="hint">весь день 06:00–23:00 без прокрутки · перетаскивайте дела и рутину, спрашиваем про остальные дни</span>
      </div>
      ${timelineHTML(key)}
    </div>
    <aside class="today-side">
      <div class="card tray">
        <div class="tray-head">
          <h3>Дела на ${isToday ? 'сегодня' : 'день'}</h3>
          <span class="hint">без времени</span>
        </div>
        <div class="tray-list">
          ${untimed.map(t => taskCardHTML(t)).join('') || '<div class="tray-empty">Пока пусто — перетащите дело сюда из колонок справа или нажмите «+»</div>'}
        </div>
        <div class="quick-add">
          <input class="input quick-input" data-scope="today" placeholder="Быстро добавить дело…" maxlength="90">
          <button class="btn primary sm" data-action="quick-add" data-scope="today">${ICON.plus}</button>
        </div>
      </div>

      <div class="card tray">
        <div class="tray-head">
          <h3>Дела недели</h3>
          <span class="hint">${fmtWeekRange(mondayOfWeekKey(wk))}</span>
        </div>
        <div class="tray-list">
          ${pool.map(t => taskCardHTML(t)).join('') || '<div class="tray-empty">На эту неделю из списка ничего не запланировано</div>'}
        </div>
        <div class="quick-add">
          <input class="input quick-input" data-scope="week" placeholder="Дело на неделю…" maxlength="90">
          <button class="btn soft sm" data-action="quick-add" data-scope="week">${ICON.plus}</button>
        </div>
      </div>

      <div class="card tray">
        <div class="tray-head">
          <h3>Из большого списка</h3>
          <span class="hint">высокий приоритет</span>
        </div>
        <div style="margin-top:6px">
          ${backlog.map(t => {
            const c = CATS[t.cat] || CATS.errands;
            return `<div class="backlog-item">
              <div class="bl-main" data-action="task-menu" data-id="${t.id}">
                <div class="bl-title">${c.emoji} ${esc(t.title)}</div>
                <div class="bl-meta">${fmtDurS(t.dur)} · ${PRIO[t.prio]} приоритет</div>
              </div>
              <div class="bl-btns">
                <button class="btn soft sm" data-action="sched" data-id="${t.id}" data-to="day" data-key="${key}" title="Запланировать на этот день">в день</button>
                <button class="btn ghost sm" data-action="sched" data-id="${t.id}" data-to="week" title="В план на неделю">в неделю</button>
              </div>
            </div>`;
          }).join('') || '<div class="tray-empty">Список пуст — добавьте долгоиграющие дела</div>'}
        </div>
        <a class="tray-link" href="#" data-action="nav" data-view="tasks">весь список дел →</a>
      </div>
    </aside>
  </div>
  ${daySummaryHTML(key)}`;
}

/* ================= VIEW: НЕДЕЛЯ ================= */
function weekHTML() {
  const ws = startOfWeek(parseKey(ui.weekAnchor));
  const wk = weekKeyOf(ws);
  const isCur = wk === weekKeyOf(new Date());
  const pool = weekPoolFor(wk).sort(sortTasks);

  let cols = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i), key = dateKey(d);
    const rs = routinesOn(key);
    const ts = tasksOn(key).sort(sortTasks);
    const rDone = rs.filter(r => routineDone(key, r.id)).length;
    const isT = key === todayKey();
    cols += `<div class="day-col ${isT ? 'today' : ''}" data-key="${key}">
      <div class="col-head">
        <span class="col-wd">${WD_SHORT[i]}</span>
        <span class="col-dnum">${d.getDate()}</span>
        ${rs.length ? `<span class="col-prog" title="рутина выполнена">${rDone}/${rs.length}</span>` : ''}
      </div>
      <div class="col-body drop-day" data-key="${key}">
        <div class="col-sec-title">Рутина</div>
        ${rs.map(r => {
          const done = routineDone(key, r.id);
          return `<div class="rchip draggable-routine color-${r.color || 'sun'} ${done ? 'done' : ''}" draggable="true" data-routine="${r.id}" data-key="${key}" data-from-day="${i}" title="Перетащите на другой день, чтобы изменить повтор">
            <button class="rchip-check ${done ? 'on' : ''}" data-action="toggle-routine" data-id="${r.id}" data-key="${key}" aria-label="Отметить">${ICON.check}</button>
            <span class="rchip-grip" data-action="noop" aria-hidden="true">${ICON.grip}</span>
            <span class="rchip-time">${routineTime(r, key)}</span>
            <span class="rchip-title">${r.emoji || ''} ${esc(r.title)}</span>
          </div>`;
        }).join('') || '<div class="col-empty">нет рутины</div>'}
        <div class="col-sec-title" style="margin-top:6px">Дела · ${ts.filter(t => !t.done).length}</div>
        <div class="col-tasks">
          ${ts.map(t => taskCardHTML(t, { compact: true })).join('') || '<div class="col-empty">пока нет дел</div>'}
        </div>
        <div class="col-drop-hint">+ бросьте дело или рутину на этот день</div>
      </div>
    </div>`;
  }

  return `<div class="page-head">
    <div>
      <h1 class="page-title">Неделя</h1>
      <div class="page-sub">${fmtWeekRange(ws)}${isCur ? ' · <b>текущая</b>' : ''} — рутина по дням и дела из списка</div>
    </div>
    <div class="head-actions">
      <div class="date-nav">
        <button class="btn icon ghost" data-action="week-prev" aria-label="Прошлая неделя">${ICON.left}</button>
        <button class="btn ghost sm" data-action="week-today" style="border:none;box-shadow:none">эта неделя</button>
        <button class="btn icon ghost" data-action="week-next" aria-label="Следующая неделя">${ICON.right}</button>
      </div>
      <button class="btn primary" data-action="add-task" data-week="${wk}">${ICON.plus} Дело на неделю</button>
    </div>
  </div>

  <div class="card pool-card">
    <div class="pool-head">
      <h3>Задачи недели без конкретного дня</h3>
      <span class="hint">дела — на день ниже; рутину — на другой день, чтобы спросить про повтор</span>
      <div class="pool-add">
        <input class="input quick-input" data-scope="week" placeholder="Новое дело на неделю…" maxlength="90">
        <button class="btn soft sm" data-action="quick-add" data-scope="week">${ICON.plus}</button>
      </div>
    </div>
    <div class="pool-chips drop-pool" data-week="${wk}">
      ${pool.map(t => {
        const c = CATS[t.cat] || CATS.errands;
        return `<div class="chip draggable-task cat-${t.cat}" draggable="true" data-task="${t.id}" data-action="task-menu" data-id="${t.id}">
          <span>${c.emoji}</span><span class="chip-title">${esc(t.title)}</span><span class="chip-dur">${fmtDurS(t.dur)}</span>
        </div>`;
      }).join('') || '<div class="pool-empty">Пусто. Отметьте дело «на неделю» в списке дел — оно появится здесь, и его можно будет раскидать по дням.</div>'}
    </div>
  </div>

  <div class="week-wrap"><div class="week-grid">${cols}</div></div>`;
}

/* ================= VIEW: РУТИНА ================= */
function rhythmBarHTML(dayIdx) {
  const rs = state.routines.filter(r => r.days && r.days[dayIdx])
    .slice().sort((a, b) => toMin(routineTimeByIdx(a, dayIdx)) - toMin(routineTimeByIdx(b, dayIdx)));
  let segs = '', cur = 0;
  const pushGap = (s, e) => {
    if (e - s < 10) return;
    const label = e - s >= 70 ? `<span>свободно ${fmtDurS(e - s)}</span>` : '';
    segs += `<div class="rseg gap" style="left:${s / 1440 * 100}%;width:${(e - s) / 1440 * 100}%">${label}</div>`;
  };
  for (const r of rs) {
    const rtime = routineTimeByIdx(r, dayIdx);
    const s = toMin(rtime), e = Math.min(s + r.dur, 1440);
    pushGap(cur, s);
    const w = (e - s) / 1440 * 100;
    const wide = w > 7.5, mid = w > 4;
    segs += `<div class="rseg busy color-${r.color || 'sun'}" style="left:${s / 1440 * 100}%;width:${w}%;background:var(--c)" title="${esc(r.title)} · ${rtime}–${toHHMM(s + r.dur)}">
      <span class="rseg-e">${r.emoji || ''}</span>${mid ? `<span class="rseg-t">${rtime}</span>` : ''}${wide ? `<span class="rseg-n">${esc(r.title)}</span>` : ''}
    </div>`;
    cur = Math.max(cur, e);
  }
  pushGap(cur, 1440);
  const ruler = [0, 3, 6, 9, 12, 15, 18, 21, 24].map(h => `<span>${pad2(h)}:00</span>`).join('');
  // итоги в активном окне дня 06:00–23:00
  const busyIn = rs.reduce((s, r) => {
    const rs0 = toMin(routineTimeByIdx(r, dayIdx));
    const a = Math.max(rs0, DAY_START), b = Math.min(rs0 + r.dur, DAY_END);
    return s + Math.max(0, b - a);
  }, 0);
  const totals = `<div class="rhythm-totals">
    <div class="rt"><span class="dot" style="background:var(--accent)"></span>Рутина: <b>${fmtDur(busyIn)}</b></div>
    <div class="rt"><span class="dot" style="background:var(--accent-softer)"></span>Свободно (06–23): <b>${fmtDur(Math.max(0, DAY_END - DAY_START - busyIn))}</b></div>
    <div class="rt"><span class="dot" style="background:var(--ink-2)"></span>Повторов в день: <b>${rs.length}</b></div>
  </div>`;
  return { segs, ruler, totals };
}

function routinesHTML() {
  const di = ui.routineDay;
  const { segs, ruler, totals } = rhythmBarHTML(di);
  const sorted = state.routines.slice().sort((a, b) => toMin(a.time) - toMin(b.time));
  return `<div class="page-head">
    <div>
      <h1 class="page-title">Рутина</h1>
      <div class="page-sub">Каркас дня, который повторяется сам — <b>перетащите карточку на день недели, чтобы изменить повтор</b></div>
    </div>
    <div class="head-actions">
      <button class="btn primary" data-action="add-routine">${ICON.plus} Добавить рутину</button>
    </div>
  </div>

  <div class="card rhythm-card">
    <div class="rhythm-top">
      <h3>Ритм дня</h3>
      <div class="daytabs">
        ${[0,1,2,3,4,5,6].map(i => `<button class="daytab drop-weekday ${i === di ? 'active' : ''}" data-action="rday" data-i="${i}" data-drop-weekday="${i}">${WD_SHORT[i]}</button>`).join('')}
      </div>
    </div>
    <div class="rhythm-bar">${segs}</div>
    <div class="ruler">${ruler}</div>
    ${totals}
  </div>

  <div class="routine-grid">
    ${sorted.map(r => `<div class="card rcard draggable-routine-card color-${r.color || 'sun'}" draggable="true" data-routine="${r.id}" data-from-day="${di}" title="Перетащите на день недели выше, чтобы изменить повтор">
      <div class="rcard-top">
        <span class="rcard-emoji">${r.emoji || '•'}</span>
        <div class="rcard-info">
          <div class="rcard-title">${esc(r.title)}</div>
          <div class="rcard-time" title="${esc(routineTimeTitle(r))}">${routineTimeSummary(r)}</div>
        </div>
        <span class="rcard-grip" data-action="noop" aria-hidden="true">${ICON.grip}</span>
        <div class="rcard-actions">
          <button class="icon-btn" data-action="edit-routine" data-id="${r.id}" aria-label="Изменить">${ICON.pencil}</button>
          <button class="icon-btn danger" data-action="del-routine" data-id="${r.id}" aria-label="Удалить">${ICON.trash}</button>
        </div>
      </div>
      <div class="wdots">
        ${[0,1,2,3,4,5,6].map(i => `<span class="wdot ${r.days && r.days[i] ? 'on' : ''}" title="${WD_LONG[i]}">${WD_LETTER[i]}</span>`).join('')}
      </div>
    </div>`).join('') || `<div class="card tasks-empty" style="grid-column:1/-1"><div class="big">◌</div><p>Рутины пока нет. Добавьте первое повторяющееся дело — например, «Завтрак» или «Зарядка».</p></div>`}
  </div>`;
}

/* ================= VIEW: СПИСОК ДЕЛ ================= */
function filteredTasks() {
  const q = ui.tq.trim().toLowerCase();
  return state.tasks.filter(t => {
    if (q && !(t.title.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q))) return false;
    if (ui.tcat !== 'all' && t.cat !== ui.tcat) return false;
    if (ui.tstatus === 'active'  && (t.done || t.date || t.week)) return false;
    if (ui.tstatus === 'planned' && (t.done || (!t.date && !t.week))) return false;
    if (ui.tstatus === 'done'    && !t.done) return false;
    return true;
  }).sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    if (!!a.date !== !!b.date) return a.date ? -1 : 1;
    if (a.date && b.date) return a.date.localeCompare(b.date) || toMin(a.startTime || '99:99') - toMin(b.startTime || '99:99');
    if (!!a.week !== !!b.week) return a.week ? -1 : 1;
    return sortTasks(a, b);
  });
}
function taskRowsHTML() {
  const list = filteredTasks();
  if (!list.length)
    return `<div class="card tasks-empty"><div class="big">▤</div><p>Ничего не найдено. Измените фильтр или добавьте новое дело.</p></div>`;
  return list.map(t => {
    const c = CATS[t.cat] || CATS.errands;
    return `<div class="card task-row cat-${t.cat} ${t.done ? 'done' : ''}">
      ${checkHTML(t.done, 'toggle-task', t.id, t.date || todayKey())}
      <span class="row-cat" title="${c.name}">${c.emoji}</span>
      <div class="row-main" data-action="task-menu" data-id="${t.id}">
        <div class="row-title">${esc(t.title)}</div>
        ${t.notes ? `<div class="row-notes">${esc(t.notes)}</div>` : ''}
      </div>
      <div class="row-badges">
        ${prioBadge(t.prio)}
        <span class="badge">⏱ ${fmtDurS(t.dur)}</span>
      </div>
      <div class="row-badges">${schedBadge(t)}</div>
      <div class="row-actions">
        <button class="icon-btn" data-action="sched-menu" data-id="${t.id}" aria-label="Запланировать" title="Перенести в планер">${ICON.cal}</button>
        <button class="icon-btn" data-action="edit-task" data-id="${t.id}" aria-label="Изменить">${ICON.pencil}</button>
        <button class="icon-btn danger" data-action="del-task" data-id="${t.id}" aria-label="Удалить">${ICON.trash}</button>
      </div>
    </div>`;
  }).join('');
}
function tasksHTML() {
  const total = state.tasks.length;
  const planned = state.tasks.filter(t => !t.done && (t.date || t.week)).length;
  const done = state.tasks.filter(t => t.done).length;
  return `<div class="page-head">
    <div>
      <h1 class="page-title">Список дел</h1>
      <div class="page-sub">Большой список долгоиграющих дел — переносите их в планер на день или неделю</div>
    </div>
    <div class="head-actions">
      <button class="btn primary" data-action="add-task">${ICON.plus} Новое дело</button>
    </div>
  </div>

  <div class="tasks-toolbar">
    <div class="search-wrap">${ICON.search}<input class="input" id="taskSearch" type="search" placeholder="Поиск по делам и заметкам…" value="${esc(ui.tq)}"></div>
    <div class="seg">
      ${[['all','Все'],['active','В списке'],['planned','В планере'],['done','Сделано']].map(([v, l]) =>
        `<button class="seg-btn ${ui.tstatus === v ? 'active' : ''}" data-action="tstatus" data-s="${v}">${l}</button>`).join('')}
    </div>
    <div class="task-stats">всего <b>${total}</b> · в планере <b>${planned}</b> · сделано <b>${done}</b></div>
  </div>

  <div class="cat-filters">
    <button class="catf ${ui.tcat === 'all' ? 'active' : ''}" data-action="tcat" data-cat="all">Все сферы</button>
    ${Object.entries(CATS).map(([k, c]) =>
      `<button class="catf cat-${k} ${ui.tcat === k ? 'active' : ''}" data-action="tcat" data-cat="${k}">${c.emoji} ${c.name}</button>`).join('')}
  </div>

  <div id="taskList">${taskRowsHTML()}</div>`;
}

/* ================= поповеры ================= */
let popEl = null, popAnchor = null;
const ANCHOR_ACTIONS = new Set(['task-menu', 'slot-click', 'sched-menu']);

function openPopover(anchorEl, html) {
  closePopover();
  popAnchor = anchorEl;
  popEl = document.createElement('div');
  popEl.className = 'popover';
  popEl.innerHTML = html;
  document.body.appendChild(popEl);
  positionPopover();
  requestAnimationFrame(() => popEl && popEl.classList.add('show'));
}
/* поповер в точке клика (для высоких зон вроде слотов таймлайна) */
function openPopoverAt(x, y, html) {
  const fake = document.createElement('div');
  fake.className = 'pop-anchor-fake';
  fake.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:2px;height:2px;pointer-events:none;`;
  document.body.appendChild(fake);
  openPopover(fake, html);
}
function positionPopover() {
  if (!popEl || !popAnchor) return;
  const r = popAnchor.getBoundingClientRect();
  const w = popEl.offsetWidth, h = popEl.offsetHeight;
  let left = clamp(r.left + r.width / 2 - w / 2, 10, window.innerWidth - w - 10);
  let top = r.bottom + 7;
  if (top + h > window.innerHeight - 10) top = Math.max(10, r.top - h - 7);
  popEl.style.left = left + 'px';
  popEl.style.top = top + 'px';
}
function closePopover() {
  if (popEl) { popEl.remove(); popEl = null; }
  if (popAnchor && popAnchor.classList && popAnchor.classList.contains('pop-anchor-fake')) popAnchor.remove();
  popAnchor = null;
}

function taskMenuHTML(t) {
  const c = CATS[t.cat] || CATS.errands;
  const scheduled = t.date || t.week || t.startTime;
  return `<div class="pop-head">
    <span class="pop-emoji">${c.emoji}</span>
    <div style="min-width:0">
      <div class="pop-title">${esc(t.title)}</div>
      <div class="pop-sub">${c.name} · ${fmtDur(t.dur)} · ${PRIO[t.prio]} приоритет</div>
    </div>
  </div>
  <button class="pop-item" data-action="toggle-task" data-id="${t.id}" data-key="${t.date || todayKey()}">
    <span class="pi-emoji">${t.done ? '↶' : '✓'}</span><span class="pi-title">${t.done ? 'Вернуть в работу' : 'Отметить выполненным'}</span>
  </button>
  <div class="pop-sep"></div>
  <div class="pop-group-title">Перенести в планер</div>
  <button class="pop-item" data-action="sched" data-id="${t.id}" data-to="day"><span class="pi-emoji">→</span><span class="pi-title">На сегодня</span></button>
  <button class="pop-item" data-action="sched" data-id="${t.id}" data-to="tomorrow"><span class="pi-emoji">○</span><span class="pi-title">На завтра</span></button>
  <button class="pop-item" data-action="sched" data-id="${t.id}" data-to="pick"><span class="pi-emoji">▦</span><span class="pi-title">Выбрать день и время…</span></button>
  ${t.startTime ? `<button class="pop-item" data-action="sched" data-id="${t.id}" data-to="untime"><span class="pi-emoji">⏱</span><span class="pi-title">Убрать время — вернуть в лоток дня</span></button>` : ''}
  <button class="pop-item" data-action="sched" data-id="${t.id}" data-to="week"><span class="pi-emoji">▦</span><span class="pi-title">На эту неделю</span></button>
  <button class="pop-item" data-action="sched" data-id="${t.id}" data-to="nextweek"><span class="pi-emoji">▦</span><span class="pi-title">На следующую неделю</span></button>
  ${scheduled ? `<button class="pop-item" data-action="sched" data-id="${t.id}" data-to="clear"><span class="pi-emoji">×</span><span class="pi-title">Убрать из планера (в список)</span></button>` : ''}
  <div class="pop-sep"></div>
  <button class="pop-item" data-action="edit-task" data-id="${t.id}"><span class="pi-emoji">✎</span><span class="pi-title">Изменить дело</span></button>
  <button class="pop-item danger" data-action="del-task" data-id="${t.id}"><span class="pi-emoji">×</span><span class="pi-title">Удалить навсегда</span></button>`;
}

function schedMenuHTML(t) {
  return `<div class="pop-head"><div style="min-width:0">
      <div class="pop-title">Куда перенести?</div>
      <div class="pop-sub">${esc(t.title)}</div>
    </div></div>
  <button class="pop-item" data-action="sched" data-id="${t.id}" data-to="day"><span class="pi-emoji">→</span><span class="pi-title">На сегодня</span></button>
  <button class="pop-item" data-action="sched" data-id="${t.id}" data-to="tomorrow"><span class="pi-emoji">○</span><span class="pi-title">На завтра</span></button>
  <button class="pop-item" data-action="sched" data-id="${t.id}" data-to="pick"><span class="pi-emoji">▦</span><span class="pi-title">Выбрать день и время…</span></button>
  <button class="pop-item" data-action="sched" data-id="${t.id}" data-to="week"><span class="pi-emoji">▦</span><span class="pi-title">На эту неделю</span></button>
  <button class="pop-item" data-action="sched" data-id="${t.id}" data-to="nextweek"><span class="pi-emoji">▦</span><span class="pi-title">На следующую неделю</span></button>
  ${t.date || t.week || t.startTime ? `<button class="pop-item" data-action="sched" data-id="${t.id}" data-to="clear"><span class="pi-emoji">×</span><span class="pi-title">Убрать из планера</span></button>` : ''}`;
}

function slotPopoverHTML(key, start, end) {
  const len = end - start;
  const wk = weekKeyOf(parseKey(key));
  const items = [
    ...state.tasks.filter(t => !t.done && t.date === key && !t.startTime).map(t => ({ t, src: 'день' })),
    ...weekPoolFor(wk).map(t => ({ t, src: 'неделя' })),
    ...backlogTasks().sort((a, b) => b.prio - a.prio).map(t => ({ t, src: 'список' })),
  ].sort((a, b) => (b.t.dur <= len) - (a.t.dur <= len) || b.t.prio - a.t.prio).slice(0, 9);

  return `<div class="pop-head"><div style="min-width:0">
      <div class="pop-title">Свободное окно ${toHHMM(start)}–${toHHMM(end)}</div>
      <div class="pop-sub">${fmtDur(len)} — чем заполнить?</div>
    </div></div>
  ${items.length ? items.map(({ t, src }) => {
    const c = CATS[t.cat] || CATS.errands;
    const fit = t.dur <= len;
    return `<button class="pop-item ${fit ? 'fit' : ''}" data-action="place" data-id="${t.id}" data-key="${key}" data-start="${start}">
      <span class="pi-emoji">${c.emoji}</span>
      <span class="pi-title">${esc(t.title)}</span>
      <span class="pi-dur">${fmtDurS(t.dur)}${fit ? '' : ' !'}</span>
      <span class="pi-src">${src}</span>
    </button>`;
  }).join('') : '<div class="pop-empty">Сводных дел нет — создайте новое прямо в это окно</div>'}
  <div class="pop-sep"></div>
  <button class="pop-item accent" data-action="new-task-at" data-key="${key}" data-start="${start}" data-len="${len}">${ICON.plus.replace('class="ic"', 'class="ic" style="stroke-width:2.4"')}<span class="pi-title">Новое дело в это окно</span></button>`;
}

/* ================= модалки ================= */
function openModal(html) {
  closeModal();
  const root = $('#modalRoot');
  root.innerHTML = `<div class="overlay"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const f = $('.modal input:not([type=radio]):not([type=checkbox]),.modal textarea', root);
  if (f) setTimeout(() => f.focus(), 40);
}
function closeModal() { $('#modalRoot').innerHTML = ''; pendingRoutineMove = null; }

function weekOptionsHTML(sel) {
  let out = '';
  const now = new Date();
  for (let i = 0; i < 4; i++) {
    const ws = startOfWeek(addDays(now, i * 7));
    const k = weekKeyOf(ws);
    const label = (i === 0 ? 'Эта неделя' : i === 1 ? 'Следующая' : `Через ${i} нед.`) + ' · ' + fmtWeekRange(ws);
    out += `<option value="${k}" ${sel === k ? 'selected' : ''}>${label}</option>`;
  }
  if (sel && !out.includes(`value="${sel}"`))
    out += `<option value="${sel}" selected>Неделя ${sel.slice(5)}</option>`;
  return out;
}

function openTaskModal(id = null, preset = {}) {
  const t = id ? findTask(id) : null;
  const v = {
    title: t ? t.title : '',
    notes: t ? (t.notes || '') : '',
    cat: t ? t.cat : (preset.cat || 'study'),
    prio: t ? t.prio : (preset.prio || 2),
    dur: t ? t.dur : (preset.dur || 60),
    date: t ? (t.date || '') : (preset.date || ''),
    time: t ? (t.startTime || '') : (preset.time || ''),
    week: t ? (t.week || '') : (preset.week || ''),
  };
  const schedMode = v.date ? 'day' : (v.week ? 'week' : 'none');
  openModal(`<form id="taskForm" data-edit="${t ? t.id : ''}">
    <div class="modal-head">
      <h3>${t ? 'Изменить дело' : 'Новое дело'}</h3>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Закрыть">${ICON.x}</button>
    </div>
    <div class="modal-body">
      <div class="field">
        <label for="tf-title">Что нужно сделать</label>
        <input class="input" id="tf-title" name="title" required maxlength="90" placeholder="Например: обновить сайт-портфолио" value="${esc(v.title)}">
      </div>
      <div class="field">
        <label for="tf-notes">Заметки <span class="muted">— детали, ссылки, следующие шаги</span></label>
        <textarea class="input" id="tf-notes" name="notes" rows="2" maxlength="500" placeholder="Необязательно">${esc(v.notes)}</textarea>
      </div>
      <div class="field">
        <label>Сфера жизни</label>
        <div class="chip-picker">
          ${Object.entries(CATS).map(([k, c]) => `<label class="pick cat-${k} ${v.cat === k ? 'active' : ''}"><input type="radio" name="cat" value="${k}" ${v.cat === k ? 'checked' : ''}><span>${c.emoji} ${c.name}</span></label>`).join('')}
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Приоритет</label>
          <div class="chip-picker prio-seg">
            ${[1, 2, 3].map(p => `<label class="pick p${p} ${v.prio === p ? 'active' : ''}"><input type="radio" name="prio" value="${p}" ${v.prio === p ? 'checked' : ''}><span>${PRIO[p]}</span></label>`).join('')}
          </div>
        </div>
        <div class="field">
          <label for="tf-dur">Сколько займёт</label>
          <select class="input" id="tf-dur" name="dur">
            ${DURATIONS.map(dd => `<option value="${dd}" ${v.dur === dd ? 'selected' : ''}>${fmtDur(dd)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field">
        <label>Когда сделать <span class="muted">— перенос в планер</span></label>
        <div class="sched-picker">
          <label class="radio-line ${schedMode === 'none' ? 'on' : ''}"><input type="radio" name="sched" value="none" ${schedMode === 'none' ? 'checked' : ''}> Пока просто в списке</label>
          <label class="radio-line ${schedMode === 'day' ? 'on' : ''}"><input type="radio" name="sched" value="day" ${schedMode === 'day' ? 'checked' : ''}>
            Конкретный день
            <input type="date" class="input sm" name="date" value="${v.date || todayKey()}">
            <input type="time" class="input sm" name="time" value="${v.time}" step="900" title="Время (необязательно)">
          </label>
          <label class="radio-line ${schedMode === 'week' ? 'on' : ''}"><input type="radio" name="sched" value="week" ${schedMode === 'week' ? 'checked' : ''}>
            На неделю, без дня
            <select class="input sm" name="week">${weekOptionsHTML(v.week)}</select>
          </label>
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn ghost" data-action="close-modal">Отмена</button>
      <span class="spacer"></span>
      <button type="submit" class="btn primary">${t ? 'Сохранить' : 'Добавить дело'}</button>
    </div>
  </form>`);
}

function openRoutineModal(id = null) {
  const r = id ? findRoutine(id) : null;
  const v = {
    title: r ? r.title : '',
    emoji: r ? r.emoji : '◌',
    time: r ? r.time : '08:00',
    dur: r ? r.dur : 30,
    color: r ? r.color : 'sun',
    days: r ? r.days.slice() : [1,1,1,1,1,1,1],
  };
  openModal(`<form id="routineForm" data-edit="${r ? r.id : ''}">
    <div class="modal-head">
      <h3>${r ? 'Изменить рутину' : 'Новая рутина'}</h3>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Закрыть">${ICON.x}</button>
    </div>
    <div class="modal-body">
      <div class="field">
        <label for="rf-title">Что повторяется</label>
        <input class="input" id="rf-title" name="title" required maxlength="60" placeholder="Например: утренняя зарядка" value="${esc(v.title)}">
      </div>
      <div class="field">
        <label>Иконка</label>
        <div class="emoji-picker">
          ${EMOJIS.map(e => `<button type="button" class="emoji-opt ${v.emoji === e ? 'active' : ''}" data-emoji="${e}">${e}</button>`).join('')}
        </div>
        <input type="hidden" name="emoji" value="${v.emoji}">
      </div>
      <div class="field-row">
        <div class="field">
          <label for="rf-time">Время начала</label>
          <input class="input" id="rf-time" type="time" name="time" value="${v.time}" step="300" required>
        </div>
        <div class="field">
          <label for="rf-dur">Длительность</label>
          <select class="input" id="rf-dur" name="dur">
            ${DURATIONS.map(dd => `<option value="${dd}" ${v.dur === dd ? 'selected' : ''}>${fmtDur(dd)}</option>`).join('')}
          </select>
        </div>
      </div>
      ${r && r.times && r.times.some((t, i) => r.days[i] && t !== r.time) ? `<div class="hint-inline">Для этой рутины задано разное время по дням. Смена основного времени здесь сбросит индивидуальное расписание.</div>` : ''}
      <div class="field">
        <label>Цвет</label>
        <div class="swatches">
          ${RCOLORS.map(c => `<button type="button" class="swatch color-${c} ${v.color === c ? 'active' : ''}" data-color="${c}" title="${COLOR_NAMES[c]}" aria-label="Цвет ${COLOR_NAMES[c]}"></button>`).join('')}
        </div>
        <input type="hidden" name="color" value="${v.color}">
      </div>
      <div class="field">
        <label>Дни повторения</label>
        <div class="day-toggles">
          ${[0,1,2,3,4,5,6].map(i => `<label class="day-toggle"><input type="checkbox" name="days" value="${i}" ${v.days[i] ? 'checked' : ''}><span>${WD_SHORT[i]}</span></label>`).join('')}
        </div>
        <div class="presets">
          <button type="button" class="btn ghost sm" data-action="days-preset" data-p="all">Каждый день</button>
          <button type="button" class="btn ghost sm" data-action="days-preset" data-p="work">Будни</button>
          <button type="button" class="btn ghost sm" data-action="days-preset" data-p="weekend">Выходные</button>
        </div>
      </div>
    </div>
    <div class="modal-foot">
      ${r ? `<button type="button" class="btn ghost danger-text" data-action="del-routine" data-id="${r.id}">Удалить</button>` : ''}
      <span class="spacer"></span>
      <button type="button" class="btn ghost" data-action="close-modal">Отмена</button>
      <button type="submit" class="btn primary">${r ? 'Сохранить' : 'Добавить рутину'}</button>
    </div>
  </form>`);
}

/* ================= новые модалки ================= */
function openSetupHelpModal() {
  openModal(`<div class="modal-head"><h3>Надёжный пароль</h3>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Закрыть">${ICON.x}</button></div>
    <div class="modal-body">
      <p class="hint-inline" style="font-size:13px;line-height:1.6">Пароль должен быть не короче 12 символов, не содержать простых шаблонов вроде «123456» или «qwerty» и набрать не менее 4 из 5 баллов устойчивости. Длинная фраза из 20+ символов принимается даже без всех классов символов.</p>
      <div class="move-summary">Пароль не сохраняется и не отправляется на сервер. Он нужен только чтобы вывести ключ шифрования. Если пароль забыт, данные можно только удалить и начать заново.</div>
    </div>
    <div class="modal-foot"><span class="spacer"></span><button type="button" class="btn primary" data-action="close-modal">Понятно</button></div>`);
}

function openPasswordModal() {
  if (!unlocked) return;
  openModal(`<form id="passwordForm">
    <div class="modal-head"><h3>Сменить пароль</h3>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Закрыть">${ICON.x}</button></div>
    <div class="modal-body">
      <p class="hint-inline" style="font-size:12.5px;line-height:1.55">Данные будут перешифрованы новым ключом. Старый пароль перестанет работать.</p>
      <div class="field"><label for="oldPass">Текущий пароль</label><input class="input" id="oldPass" name="oldPass" type="password" autocomplete="current-password" required></div>
      <div class="field"><label for="newPass">Новый пароль</label><input class="input js-password" id="newPass" name="newPass" type="password" autocomplete="new-password" minlength="12" required></div>
      <div class="strength"><span class="strength-fill"></span></div>
      <div class="strength-text">Начните вводить пароль</div>
      <div class="field"><label for="newPass2">Повторите новый пароль</label><input class="input" id="newPass2" name="newPass2" type="password" autocomplete="new-password" required></div>
      <label class="lock-check"><input type="checkbox" data-toggle-pass="oldPass,newPass,newPass2"> Показать пароли</label>
      <div id="passError" class="lock-error" hidden></div>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn ghost" data-action="close-modal">Отмена</button><span class="spacer"></span>
      <button type="submit" class="btn primary">Перешифровать</button>
    </div>
  </form>`);
}

function openWaterModal(key) {
  const h = healthOn(key), st = state.settings;
  openModal(`<form id="waterForm" data-key="${key}">
    <div class="modal-head"><h3>Вода и цель</h3>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Закрыть">${ICON.x}</button></div>
    <div class="modal-body">
      <div class="eyebrow">${fmtDateLong(parseKey(key))}</div>
      <div class="field"><label for="wf-water">Выпито сегодня, мл</label><input class="input" id="wf-water" name="water" type="number" min="0" step="50" value="${h.water}"></div>
      <div class="pop-sep"></div>
      <div class="field"><label for="wf-goal">Цель по воде, мл</label><input class="input" id="wf-goal" name="waterGoal" type="number" min="250" step="250" value="${st.waterGoal}"></div>
      <div class="field"><label for="wf-glass">Объём одного стакана</label>
        <select class="input" id="wf-glass" name="glassMl">${[200,250,300,500].map(v => `<option value="${v}" ${st.glassMl === v ? 'selected' : ''}>${v} мл</option>`).join('')}</select>
      </div>
      <p class="hint-inline">Цель по умолчанию — 3 л. Число стаканов пересчитается автоматически.</p>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn ghost" data-action="close-modal">Отмена</button><span class="spacer"></span>
      <button type="submit" class="btn primary">Сохранить</button>
    </div>
  </form>`);
  setTimeout(() => { const el = $('[name="water"]', $('#modalRoot')); if (el) el.focus(); }, 60);
}

function scopeRadio(group, value, title, desc, checked = false) {
  return `<label class="scope-option ${checked ? 'on' : ''}">
    <input type="radio" name="${group}" value="${value}" ${checked ? 'checked' : ''}>
    <span><strong>${title}</strong><small>${desc}</small></span>
  </label>`;
}
function openRoutineTimeMoveDialog(rid, key, newTime) {
  const r = findRoutine(rid); if (!r) return;
  const oldTime = routineTime(r, key);
  if (oldTime === newTime) { toast('Время рутины не изменилось'); return; }
  const d = parseKey(key), di = wdIdx(d), active = activeDayList(r);
  openModal(`<form id="routineScopeForm">
    <div class="modal-head"><h3>Перенести рутину</h3>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Закрыть">${ICON.x}</button></div>
    <div class="modal-body">
      <div class="move-summary">«${esc(r.title)}» · <b>${oldTime} → ${newTime}</b><br>${fmtDateLong(d)} · ${repeatLabel(r)}</div>
      <div class="scope-options">
        ${scopeRadio('scope','once','Только этот день', 'Разовое исключение: другие дни и недели останутся как были.', true)}
        ${r.days[di] ? scopeRadio('scope','weekday',`Все ${WD_LONG[di]}`, 'Изменить время только по этому дню недели — на всех неделях.') : ''}
        ${scopeRadio('scope','all','Все дни повтора', `Обновить ${repeatLabel(r)} и сбросить разовые исключения по времени.`)}
        ${active.length > 1 ? scopeRadio('scope','select','Выбрать дни…', 'Отметьте дни недели, на которые распространить новое время.') : ''}
      </div>
      ${active.length > 1 ? `<div class="scope-days" hidden>${active.map(i => `<label class="day-toggle"><input type="checkbox" name="day" value="${i}" ${i === di ? 'checked' : ''}><span>${WD_SHORT[i]}</span></label>`).join('')}</div>` : ''}
    </div>
    <div class="modal-foot">
      <button type="button" class="btn ghost" data-action="close-modal">Отмена</button><span class="spacer"></span>
      <button type="submit" class="btn primary">Применить</button>
    </div>
  </form>`);
  pendingRoutineMove = { type: 'time', rid, key, oldTime, newTime, di, active };
}
function openRoutineDayMoveDialog(rid, fromKey, toKey) {
  const r = findRoutine(rid); if (!r || fromKey === toKey) return;
  const fromD = parseKey(fromKey), toD = parseKey(toKey);
  const fromDi = wdIdx(fromD), toDi = wdIdx(toD), same = fromDi === toDi;
  const time = routineTime(r, fromKey);
  openModal(`<form id="routineDayScopeForm">
    <div class="modal-head"><h3>Изменить день рутины</h3>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Закрыть">${ICON.x}</button></div>
    <div class="modal-body">
      <div class="move-summary">«${esc(r.title)}» · ${time}<br><b>${fmtDateShort(fromD)} → ${fmtDateShort(toD)}</b> · ${WD_LONG[fromDi]} → ${WD_LONG[toDi]}</div>
      <div class="scope-options">
        ${scopeRadio('dayScope','once',`Только ${fmtDateShort(toD)}`, 'Разово перенести: убрать с исходной даты и поставить на выбранную.', true)}
        ${!same ? scopeRadio('dayScope','recurring',`Каждую неделю: ${WD_LONG[fromDi]} → ${WD_LONG[toDi]}`, 'Изменить повтор: убрать прежний день недели и добавить новый.') : ''}
        ${!same ? scopeRadio('dayScope','add',`Добавить ${WD_LONG[toDi]} к повтору`, 'Оставить прежний день и добавить ещё один день недели.') : ''}
        ${same ? scopeRadio('dayScope','addOnce',`Просто добавить ${fmtDateShort(toD)}`, 'Не убирать рутину с исходной даты, а сделать дополнительное появление.') : ''}
      </div>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn ghost" data-action="close-modal">Отмена</button><span class="spacer"></span>
      <button type="submit" class="btn primary">Применить</button>
    </div>
  </form>`);
  pendingRoutineMove = { type: 'day', rid, fromKey, toKey, fromDi, toDi, same, time };
}
function openRoutineWeekdayMoveDialog(rid, fromDi, toDi) {
  const r = findRoutine(rid); if (!r || fromDi === toDi) { toast('Рутина уже относится к этому дню недели'); return; }
  openModal(`<form id="routineWeekdayScopeForm">
    <div class="modal-head"><h3>Дни повторения</h3>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Закрыть">${ICON.x}</button></div>
    <div class="modal-body">
      <div class="move-summary">«${esc(r.title)}» · <b>${WD_LONG[fromDi]} → ${WD_LONG[toDi]}</b><br>Сейчас: ${repeatLabel(r)}</div>
      <div class="scope-options">
        ${scopeRadio('weekScope','add',`Добавить ${WD_LONG[toDi]}`, `Оставить ${WD_LONG[fromDi]} и добавить ещё один день повтора.`, true)}
        ${scopeRadio('weekScope','move',`Перенести повтор`, `Убрать ${WD_LONG[fromDi]} из расписания и повторять по ${WD_LONG[toDi]}.`)}
      </div>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn ghost" data-action="close-modal">Отмена</button><span class="spacer"></span>
      <button type="submit" class="btn primary">Применить</button>
    </div>
  </form>`);
  pendingRoutineMove = { type: 'weekday', rid, fromDi, toDi };
}

/* ================= тост ================= */
let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ================= действия ================= */
function toggleRoutine(key, id) {
  const l = state.log[key] || (state.log[key] = { r: {} });
  l.r = l.r || {};
  l.r[id] = !l.r[id];
  save(); render();
}
function toggleTask(id, key) {
  const t = findTask(id); if (!t) return;
  t.done = !t.done;
  t.doneDate = t.done ? (key || t.date || todayKey()) : null;
  save(); render();
}
function scheduleTask(id, to, keyHint) {
  const t = findTask(id); if (!t) return;
  if (to === 'pick') { closePopover(); openPickModal(t); return; }
  if (to === 'day')           { t.date = keyHint || todayKey(); t.week = null; }
  else if (to === 'tomorrow') { t.date = dateKey(addDays(new Date(), 1)); t.week = null; }
  else if (to === 'week')     { t.week = weekKeyOf(new Date()); t.date = null; t.startTime = null; }
  else if (to === 'nextweek') { t.week = weekKeyOf(addDays(new Date(), 7)); t.date = null; t.startTime = null; }
  else if (to === 'untime')   { t.startTime = null; }
  else if (to === 'clear')    { t.date = null; t.week = null; t.startTime = null; }
  t.done = false;
  save(); render();
  if (to === 'untime') { toast(`«${t.title}» — время убрано, дело в лотке дня`); return; }
  const label = to === 'clear' ? 'снова в списке дел'
    : to === 'day' ? relDayLabel(t.date)
    : to === 'tomorrow' ? 'завтра'
    : to === 'week' ? 'на эту неделю'
    : 'на следующую неделю';
  toast(to === 'clear' ? `«${t.title}» — ${label}` : `«${t.title}» → ${label}`);
}
function openPickModal(t) {
  openModal(`<form id="pickForm" data-edit="${t.id}">
    <div class="modal-head"><h3>Перенести в планер</h3>
      <button type="button" class="icon-btn" data-action="close-modal" aria-label="Закрыть">${ICON.x}</button></div>
    <div class="modal-body">
      <div class="pop-sub" style="font-size:13px;margin-bottom:4px">${esc(t.title)} · ${fmtDur(t.dur)}</div>
      <div class="field-row">
        <div class="field"><label for="pf-date">День</label><input class="input" id="pf-date" type="date" name="date" value="${t.date || todayKey()}" required></div>
        <div class="field"><label for="pf-time">Время <span class="muted">— необязательно</span></label><input class="input" id="pf-time" type="time" name="time" step="900" value="${t.startTime || ''}"></div>
      </div>
      <div class="hint-inline" style="margin-top:-4px">Совет: посмотрите свободные окна в разделе «Сегодня» — они подписаны длительностью.</div>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn ghost" data-action="close-modal">Отмена</button>
      <span class="spacer"></span>
      <button type="submit" class="btn primary">Перенести</button>
    </div>
  </form>`);
}
function placeTask(id, key, start) {
  const t = findTask(id); if (!t) return;
  t.date = key; t.startTime = toHHMM(start); t.week = null; t.done = false;
  save(); render();
  toast(`«${t.title}» → ${relDayLabel(key)}, ${t.startTime}`);
}
function quickAdd(scope, input) {
  const title = (input.value || '').trim();
  if (!title) { input.focus(); return; }
  const t = { id: uid(), title, notes: '', cat: 'errands', prio: 2, dur: 60, done: false, date: null, week: null, startTime: null, createdAt: Date.now() };
  if (scope === 'week') t.week = ui.view === 'week' ? weekKeyOf(startOfWeek(parseKey(ui.weekAnchor))) : weekKeyOf(parseKey(ui.dayAnchor));
  else t.date = ui.dayAnchor;
  state.tasks.unshift(t);
  input.value = '';
  save(); render();
  toast(scope === 'week' ? `«${title}» — в плане на неделю` : `«${title}» — в плане на день`);
  const again = $(`.quick-input[data-scope="${scope}"]`);
  if (again) again.focus();
}
function deleteTask(id) {
  const t = findTask(id); if (!t) return;
  if (!confirm(`Удалить дело «${t.title}» навсегда?`)) return;
  state.tasks = state.tasks.filter(x => x.id !== id);
  closeModal(); closePopover(); save(); render();
  toast('Дело удалено');
}
function deleteRoutine(id) {
  const r = findRoutine(id); if (!r) return;
  if (!confirm(`Удалить рутину «${r.title}»? Она исчезнет из всех планов.`)) return;
  state.routines = state.routines.filter(x => x.id !== id);
  pruneRoutineOverrides(id);
  closeModal(); save(); render();
  toast('Рутина удалена');
}

/* ================= drag & drop ================= */
const drag = { id: null, kind: null, fromKey: null, fromDay: null };
function timeFromRoutineDrop(e, zone, rid) {
  const body = zone.closest('.tl-body') || zone;
  const rect = body.getBoundingClientRect();
  let m = DAY_START + Math.round((e.clientY - rect.top) / PPM / 15) * 15;
  const r = findRoutine(rid);
  const dur = r ? (+r.dur || 30) : 30;
  return toHHMM(clamp(m, DAY_START, DAY_END - dur));
}
document.addEventListener('dragstart', e => {
  const rel = e.target.closest('.draggable-routine');
  const card = e.target.closest('.draggable-routine-card');
  const task = e.target.closest('.draggable-task');
  let el = null, payload = '';
  if (rel) {
    el = rel;
    drag.id = rel.dataset.routine;
    drag.kind = 'routine';
    drag.fromKey = rel.dataset.key || null;
    drag.fromDay = rel.dataset.fromDay != null ? +rel.dataset.fromDay : null;
    payload = JSON.stringify({ kind: 'routine', id: drag.id });
  } else if (card) {
    el = card;
    drag.id = card.dataset.routine;
    drag.kind = 'routine-card';
    drag.fromDay = +card.dataset.fromDay;
    drag.fromKey = null;
    payload = JSON.stringify({ kind: 'routine-card', id: drag.id });
  } else if (task) {
    el = task;
    drag.id = task.dataset.task;
    drag.kind = 'task';
    drag.fromKey = null; drag.fromDay = null;
    payload = JSON.stringify({ kind: 'task', id: drag.id });
  } else return;
  el.classList.add('dragging');
  try { e.dataTransfer.setData('text/plain', payload); } catch (err) {}
  try { e.dataTransfer.effectAllowed = 'move'; } catch (err) {}
});
document.addEventListener('dragend', () => {
  $$('.dragging').forEach(x => x.classList.remove('dragging'));
  $$('.drop-over').forEach(x => x.classList.remove('drop-over'));
  drag.id = null; drag.kind = null; drag.fromKey = null; drag.fromDay = null;
});
function highlightDrop(zone, e) {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  if (!zone.classList.contains('drop-over')) {
    $$('.drop-over').forEach(x => x.classList.remove('drop-over'));
    zone.classList.add('drop-over');
  }
}
document.addEventListener('dragover', e => {
  if (!drag.id) return;
  if (drag.kind === 'routine') {
    if (e.target.closest('.drop-weekday') || e.target.closest('.drop-pool')) return;
    const zone = e.target.closest('.drop-slot,.drop-day,.tl-body');
    if (zone) highlightDrop(zone, e);
  } else if (drag.kind === 'routine-card') {
    const zone = e.target.closest('.drop-weekday');
    if (zone) highlightDrop(zone, e);
  } else {
    const zone = e.target.closest('.drop-slot,.drop-day,.drop-pool');
    if (zone) highlightDrop(zone, e);
  }
});
document.addEventListener('dragleave', e => {
  const zone = e.target.closest('.drop-slot,.drop-day,.drop-pool,.tl-body,.drop-weekday');
  if (zone && e.relatedTarget && !zone.contains(e.relatedTarget)) zone.classList.remove('drop-over');
});
document.addEventListener('drop', e => {
  const zone = e.target.closest('.drop-slot,.drop-day,.drop-pool,.tl-body,.drop-weekday');
  if (!zone) return;
  e.preventDefault();
  zone.classList.remove('drop-over');
  const id = drag.id, kind = drag.kind, fromKey = drag.fromKey, fromDay = drag.fromDay;
  drag.id = null; drag.kind = null; drag.fromKey = null; drag.fromDay = null;

  if (kind === 'routine' && id) {
    if (zone.classList.contains('drop-day')) {
      const col = zone.closest('.day-col');
      const key = zone.dataset.key || (col && col.dataset.key);
      if (key && fromKey) openRoutineDayMoveDialog(id, fromKey, key);
    } else if (zone.classList.contains('drop-slot') || zone.classList.contains('tl-body')) {
      const body = zone.closest('.tl-body') || zone;
      const key = zone.dataset.key || body.dataset.key || ui.dayAnchor;
      openRoutineTimeMoveDialog(id, key, timeFromRoutineDrop(e, zone, id));
    }
    return;
  }
  if (kind === 'routine-card' && id) {
    if (zone.classList.contains('drop-weekday'))
      openRoutineWeekdayMoveDialog(id, fromDay, +(zone.dataset.i || zone.dataset.dropWeekday));
    return;
  }
  if (kind !== 'task') return;
  if (!zone.classList.contains('drop-slot') && !zone.classList.contains('drop-day') && !zone.classList.contains('drop-pool')) return;

  let tid = id;
  if (!tid && e.dataTransfer) {
    try {
      const raw = e.dataTransfer.getData('text/plain');
      if (raw) { try { tid = JSON.parse(raw).id; } catch (err) { tid = raw; } }
    } catch (err) {}
  }
  const t = tid && findTask(tid);
  if (!t || t.done) return;

  if (zone.classList.contains('drop-slot')) {
    const key = zone.dataset.key;
    const start = +zone.dataset.start, end = +zone.dataset.end;
    const rect = zone.getBoundingClientRect();
    const off = clamp(e.clientY - rect.top, 0, Math.max(0, rect.height - 1));
    let m = start + Math.round(off / PPM / 15) * 15;
    m = clamp(m, start, Math.max(start, end - 15));
    const old = t.date === key && t.startTime === toHHMM(m);
    t.date = key; t.startTime = toHHMM(m); t.week = null;
    save(); render();
    if (!old) toast(`«${t.title}» → ${relDayLabel(key)}, ${t.startTime}`);
  } else if (zone.classList.contains('drop-day')) {
    const col = zone.closest('.day-col');
    const key = zone.dataset.key || (col && col.dataset.key);
    if (!key) return;
    const moved = t.date !== key;
    t.date = key; t.week = null;
    if (moved) t.startTime = null;
    ui.weekAnchor = key;
    save(); render();
    if (moved) toast(`«${t.title}» → ${relDayLabel(key)}`);
  } else if (zone.classList.contains('drop-pool')) {
    const had = !!t.date;
    t.week = zone.dataset.week; t.date = null; t.startTime = null;
    save(); render();
    if (had) toast(`«${t.title}» — снова в пуле недели, без дня`);
  }
});

/* ================= клики (делегирование) ================= */
document.addEventListener('click', e => {
  const inPop = popEl && popEl.contains(e.target);
  const el = e.target.closest('[data-action]');
  const action = el ? el.dataset.action : null;

  // закрытие поповера
  if (popEl && !inPop && !(action && ANCHOR_ACTIONS.has(action))) { closePopover(); }
  if (!el) return;
  if (ANCHOR_ACTIONS.has(action)) closePopover();

  switch (action) {
    case 'nav':
      if (el.tagName === 'A') e.preventDefault();
      ui.view = el.dataset.view;
      if (ui.view === 'today') ui.needScroll = true;
      closePopover(); render();
      $('.main').scrollTop = 0;
      break;

    case 'day-prev':  ui.dayAnchor = dateKey(addDays(parseKey(ui.dayAnchor), -1)); ui.needScroll = true; render(); break;
    case 'day-next':  ui.dayAnchor = dateKey(addDays(parseKey(ui.dayAnchor), 1));  ui.needScroll = true; render(); break;
    case 'day-today': ui.dayAnchor = todayKey(); ui.needScroll = true; render(); break;

    case 'week-prev':  ui.weekAnchor = dateKey(addDays(startOfWeek(parseKey(ui.weekAnchor)), -7)); render(); break;
    case 'week-next':  ui.weekAnchor = dateKey(addDays(startOfWeek(parseKey(ui.weekAnchor)), 7));  render(); break;
    case 'week-today': ui.weekAnchor = todayKey(); render(); break;

    case 'rday': ui.routineDay = +el.dataset.i; render(); break;

    case 'toggle-routine': toggleRoutine(el.dataset.key, el.dataset.id); break;
    case 'toggle-task':    toggleTask(el.dataset.id, el.dataset.key); break;

    case 'task-menu': {
      const t = findTask(el.dataset.id);
      if (t) openPopoverAt(e.clientX, e.clientY, taskMenuHTML(t));
      break;
    }
    case 'sched-menu': {
      const t = findTask(el.dataset.id);
      if (t) openPopoverAt(e.clientX, e.clientY, schedMenuHTML(t));
      break;
    }
    case 'slot-click':
      openPopoverAt(e.clientX, e.clientY, slotPopoverHTML(el.dataset.key, +el.dataset.start, +el.dataset.end));
      break;

    case 'place':
      placeTask(el.dataset.id, el.dataset.key, +el.dataset.start);
      closePopover();
      break;
    case 'new-task-at': {
      closePopover();
      const len = +el.dataset.len || 60;
      const dur = DURATIONS.slice().reverse().find(dd => dd <= len) || 15;
      openTaskModal(null, { date: el.dataset.key, time: toHHMM(+el.dataset.start), dur });
      break;
    }
    case 'sched':
      scheduleTask(el.dataset.id, el.dataset.to, el.dataset.key);
      closePopover();
      break;

    case 'edit-task':  closePopover(); openTaskModal(el.dataset.id); break;
    case 'del-task':   deleteTask(el.dataset.id); break;
    case 'add-task':   openTaskModal(null, { date: el.dataset.date || '', week: el.dataset.week || '' }); break;
    case 'edit-routine':  closePopover(); openRoutineModal(el.dataset.id); break;
    case 'add-routine':   openRoutineModal(); break;
    case 'del-routine':   deleteRoutine(el.dataset.id); break;

    case 'quick-add': {
      const scope = el.dataset.scope;
      const input = $(`.quick-input[data-scope="${scope}"]`, el.closest('.tray,.pool-head') || document);
      if (input) quickAdd(scope, input);
      break;
    }

    case 'tcat':    ui.tcat = el.dataset.cat; render(); break;
    case 'tstatus': ui.tstatus = el.dataset.s; render(); break;

    case 'days-preset': {
      const p = el.dataset.p;
      const boxes = $$('#routineForm input[name="days"]');
      boxes.forEach(b => {
        const i = +b.value;
        b.checked = p === 'all' ? true : p === 'work' ? i < 5 : i >= 5;
      });
      break;
    }
    case 'noop': break;
    case 'water-edit': openWaterModal(el.dataset.key || ui.dayAnchor); break;
    case 'water-settings': openWaterModal(el.dataset.key || ui.dayAnchor); break;
    case 'water-add': adjustWater(el.dataset.key || ui.dayAnchor, +el.dataset.ml); break;
    case 'water-set': setWaterGlasses(el.dataset.key || ui.dayAnchor, +el.dataset.glasses); break;
    case 'mood-set': setMood(el.dataset.key || ui.dayAnchor, el.dataset.value); break;
    case 'day-note-draft': {
      const key = el.dataset.key || ui.dayAnchor;
      const ta = $(`[data-day-note][data-key="${key}"]`);
      if (ta) { ta.value = buildDaySummaryDraft(key); setDayNote(key, ta.value); toast('Рассказ о дне собран'); }
      break;
    }
    case 'day-note-clear': {
      const key = el.dataset.key || ui.dayAnchor;
      const ta = $(`[data-day-note][data-key="${key}"]`);
      if (ta) { ta.value = ''; setDayNote(key, ''); toast('Итоги очищены'); }
      break;
    }
    case 'month-prev': {
      const d = parseKey(ui.monthAnchor);
      ui.monthAnchor = dateKey(new Date(d.getFullYear(), d.getMonth() - 1, 1));
      render();
      break;
    }
    case 'month-next': {
      const d = parseKey(ui.monthAnchor);
      ui.monthAnchor = dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 1));
      render();
      break;
    }
    case 'month-today': {
      const d = new Date();
      ui.monthAnchor = dateKey(new Date(d.getFullYear(), d.getMonth(), 1));
      render();
      break;
    }
    case 'close-modal': closeModal(); break;
  }
});

/* клик по оверлею закрывает модалку */
document.addEventListener('mousedown', e => {
  if (e.target.classList && e.target.classList.contains('overlay')) closeModal();
});

/* ================= change / input / submit / keys ================= */
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches && t.matches('.pick input')) {
    const group = t.closest('.chip-picker');
    if (group) $$('.pick', group).forEach(p => p.classList.toggle('active', p.contains(t)));
  }
  if (t.matches && t.matches('input[name="sched"]')) {
    $$('.radio-line').forEach(l => l.classList.toggle('on', l.contains(t) && t.checked));
  }
  if (t.matches && t.matches('[data-toggle-pass]')) {
    const ids = String(t.dataset.togglePass || '').split(',').map(x => x.trim()).filter(Boolean);
    ids.forEach(id => { const inp = document.getElementById(id); if (inp) inp.type = t.checked ? 'text' : 'password'; });
  }
  if (t.matches && t.matches('.scope-option input')) {
    const form = t.closest('form');
    if (form) $$('.scope-option', form).forEach(o => o.classList.toggle('on', o.contains(t)));
  }
  if (t.matches && t.matches('input[name="scope"]')) {
    const form = t.closest('form');
    const days = form && $('.scope-days', form);
    if (days) days.hidden = t.value !== 'select';
  }
  if (t.matches && t.matches('[data-mood-note]')) setMoodNote(t.dataset.key, t.value);
  if (t.matches && t.matches('[data-day-note]')) setDayNote(t.dataset.key, t.value);
  if (t.id === 'importFile') importJSON(t);
});
document.addEventListener('click', e => {
  const em = e.target.closest('.emoji-opt');
  if (em) {
    $$('.emoji-opt').forEach(x => x.classList.remove('active'));
    em.classList.add('active');
    const hid = $('input[name="emoji"]'); if (hid) hid.value = em.dataset.emoji;
    return;
  }
  const sw = e.target.closest('.swatch');
  if (sw) {
    $$('.swatch').forEach(x => x.classList.remove('active'));
    sw.classList.add('active');
    const hid = $('input[name="color"]'); if (hid) hid.value = sw.dataset.color;
  }
});
document.addEventListener('input', e => {
  if (e.target.matches && e.target.matches('.js-password')) updateStrength(e.target);
  if (e.target.matches && e.target.matches('[data-day-note]')) {
    clearTimeout(dayNoteTimer);
    const key = e.target.dataset.key, val = e.target.value;
    dayNoteTimer = setTimeout(() => setDayNote(key, val), 400);
  }
  if (e.target.matches && e.target.matches('[data-mood-note]')) setMoodNote(e.target.dataset.key, e.target.value);
  if (e.target.id === 'taskSearch') {
    ui.tq = e.target.value;
    const list = $('#taskList');
    if (list) list.innerHTML = taskRowsHTML();
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('quick-input')) {
    e.preventDefault();
    const scope = e.target.dataset.scope;
    quickAdd(scope, e.target);
    return;
  }
  if (e.key === 'Escape') {
    if (popEl) { closePopover(); return; }
    if ($('#modalRoot').innerHTML) closeModal();
  }
});
document.addEventListener('submit', e => {
  const f = e.target;
  if (f.id === 'setupForm') { e.preventDefault(); onSetup(e); }
  else if (f.id === 'unlockForm') { e.preventDefault(); onUnlock(e); }
  else if (f.id === 'passwordForm') { e.preventDefault(); submitPasswordForm(f); }
  else if (f.id === 'waterForm') { e.preventDefault(); submitWaterForm(f); }
  else if (f.id === 'routineScopeForm') { e.preventDefault(); submitRoutineScopeForm(f); }
  else if (f.id === 'routineDayScopeForm') { e.preventDefault(); submitRoutineDayScopeForm(f); }
  else if (f.id === 'routineWeekdayScopeForm') { e.preventDefault(); submitRoutineWeekdayScopeForm(f); }
  else if (f.id === 'taskForm') { e.preventDefault(); submitTaskForm(f); }
  else if (f.id === 'routineForm') { e.preventDefault(); submitRoutineForm(f); }
  else if (f.id === 'pickForm') { e.preventDefault(); submitPickForm(f); }
});

function submitTaskForm(f) {
  const fd = new FormData(f);
  const title = String(fd.get('title') || '').trim();
  if (!title) return;
  const sched = fd.get('sched');
  const data = {
    title,
    notes: String(fd.get('notes') || '').trim(),
    cat: fd.get('cat') || 'errands',
    prio: +fd.get('prio') || 2,
    dur: +fd.get('dur') || 60,
  };
  if (sched === 'day') {
    data.date = fd.get('date') || todayKey();
    data.startTime = fd.get('time') || null;
    data.week = null;
  } else if (sched === 'week') {
    data.week = fd.get('week') || weekKeyOf(new Date());
    data.date = null; data.startTime = null;
  } else {
    data.date = null; data.week = null; data.startTime = null;
  }
  const editId = f.dataset.edit;
  if (editId) {
    const t = findTask(editId);
    if (t) {
      const rescheduled = data.date !== t.date || data.startTime !== t.startTime || data.week !== t.week;
      Object.assign(t, data);
      if (rescheduled) { t.done = false; t.doneDate = null; }
    }
    toast('Изменения сохранены');
  } else {
    state.tasks.unshift({ id: uid(), done: false, doneDate: null, createdAt: Date.now(), ...data });
    toast(data.date ? `«${title}» — в плане на ${relDayLabel(data.date)}` : data.week ? `«${title}» — в плане на неделю` : `«${title}» — добавлено в список`);
  }
  closeModal(); save(); render();
}

function submitRoutineForm(f) {
  const fd = new FormData(f);
  const title = String(fd.get('title') || '').trim();
  if (!title) return;
  const days = [0,0,0,0,0,0,0];
  fd.getAll('days').forEach(v => days[+v] = 1);
  if (!days.some(Boolean)) { toast('Выберите хотя бы один день повторения'); return; }
  const data = {
    title,
    emoji: fd.get('emoji') || '•',
    time: fd.get('time') || '08:00',
    dur: +fd.get('dur') || 30,
    color: fd.get('color') || 'sun',
    days,
  };
  const editId = f.dataset.edit;
  if (editId) {
    const r = findRoutine(editId);
    if (r) {
      const oldTime = r.time;
      Object.assign(r, data);
      if (oldTime !== data.time) r.times = null;
    }
    toast('Рутина обновлена');
  } else {
    state.routines.push({ id: uid(), ...data });
    toast(`Рутина «${title}» добавлена — ${data.time}, ${fmtDur(data.dur)}`);
  }
  closeModal(); save(); render();
}

function submitPickForm(f) {
  const fd = new FormData(f);
  const t = findTask(f.dataset.edit);
  if (!t) return closeModal();
  t.date = fd.get('date') || todayKey();
  t.startTime = fd.get('time') || null;
  t.week = null; t.done = false;
  closeModal(); save(); render();
  toast(`«${t.title}» → ${relDayLabel(t.date)}${t.startTime ? ', ' + t.startTime : ''}`);
}

async function submitPasswordForm(f) {
  const err = $('#passError', f);
  const fd = new FormData(f);
  const oldPass = String(fd.get('oldPass') || '');
  const newPass = String(fd.get('newPass') || '');
  const newPass2 = String(fd.get('newPass2') || '');
  const policy = passwordPolicy(newPass);
  const showErr = msg => { err.textContent = msg; err.hidden = false; };
  if (!policy.ok) return showErr(policy.reason || 'Новый пароль недостаточно надёжный.');
  if (newPass !== newPass2) return showErr('Новые пароли не совпадают.');
  const btn = f.querySelector('[type="submit"]');
  if (btn) btn.disabled = true;
  try {
    await changeVaultPassword(oldPass, newPass);
    closeModal(); toast('Пароль изменён, данные перешифрованы');
  } catch (e) {
    console.error(e);
    showErr(e && e.message === 'bad-password' ? 'Текущий пароль неверен.' : 'Не удалось перешифровать данные.');
  } finally { if (btn) btn.disabled = false; }
}
function submitWaterForm(f) {
  const key = f.dataset.key, h = ensureHealth(key), prev = healthOn(key);
  const fd = new FormData(f);
  const water = Math.max(0, Math.round(+fd.get('water') || 0));
  if (water !== prev.water) {
    h.water = water;
    h.sources.water = 'manual';
    h.updatedAt = Date.now();
  }
  state.settings.waterGoal = clamp(+fd.get('waterGoal') || 3000, 250, 10000);
  state.settings.glassMl = [200,250,300,500].includes(+fd.get('glassMl')) ? +fd.get('glassMl') : 250;
  closeModal(); save(); render();
  toast('Вода и цель обновлены');
}
function submitRoutineScopeForm(f) {
  const p = pendingRoutineMove;
  if (!p || p.type !== 'time') return closeModal();
  const fd = new FormData(f), scope = fd.get('scope'), r = findRoutine(p.rid);
  if (!r) return closeModal();
  let label = '';
  if (scope === 'once') {
    const ov = ensureOverride(p.key, p.rid);
    ov.time = p.newTime;
    delete ov.skip;
    if (!r.days[p.di]) ov.add = true; else delete ov.add;
    if (r.days[p.di] && p.newTime === routineTimeByIdx(r, p.di) && !ov.add) {
      delete ov.time; pruneOverride(p.key, p.rid);
    }
    label = 'только этот день';
  } else if (scope === 'weekday') {
    const times = currentTimesArray(r); times[p.di] = p.newTime; r.times = times; simplifyTimes(r);
    const set = new Set([p.di]);
    clearTimeOverrides(p.rid, set); clearDayOverrides(p.rid, set);
    label = `все ${WD_LONG[p.di]}`;
  } else if (scope === 'all') {
    r.time = p.newTime; r.times = null;
    clearTimeOverrides(p.rid, null); clearDayOverrides(p.rid, null);
    label = 'все дни повтора';
  } else if (scope === 'select') {
    const selected = new Set(fd.getAll('day').map(Number));
    if (!selected.size) { toast('Выберите хотя бы один день недели'); return; }
    const times = currentTimesArray(r);
    for (const i of selected) times[i] = p.newTime;
    r.times = times; simplifyTimes(r);
    clearTimeOverrides(p.rid, selected); clearDayOverrides(p.rid, selected);
    label = 'выбранные дни: ' + [...selected].sort().map(i => WD_SHORT[i]).join(' · ');
  } else return;
  closeModal(); save(); render();
  toast(`Рутина «${r.title}» → ${p.newTime} · ${label}`);
}
function submitRoutineDayScopeForm(f) {
  const p = pendingRoutineMove;
  if (!p || p.type !== 'day') return closeModal();
  const fd = new FormData(f), scope = fd.get('dayScope'), r = findRoutine(p.rid);
  if (!r) return closeModal();
  let label = '';
  if (scope === 'once' || scope === 'addOnce') {
    if (scope === 'once') {
      const ovFrom = ensureOverride(p.fromKey, p.rid);
      ovFrom.skip = true; delete ovFrom.add;
    }
    const ovTo = ensureOverride(p.toKey, p.rid);
    delete ovTo.skip;
    if (!r.days[p.toDi]) ovTo.add = true; else delete ovTo.add;
    ovTo.time = p.time;
    if (r.days[p.toDi] && p.time === routineTimeByIdx(r, p.toDi)) delete ovTo.time;
    pruneOverride(p.toKey, p.rid);
    label = scope === 'once' ? 'разово' : 'дополнительно на эту дату';
  } else if (scope === 'recurring') {
    r.days[p.fromDi] = 0; r.days[p.toDi] = 1;
    if (r.times) { const times = currentTimesArray(r); times[p.toDi] = times[p.fromDi] || r.time; times[p.fromDi] = r.time; r.times = times; simplifyTimes(r); }
    clearDayOverrides(p.rid, new Set([p.fromDi, p.toDi]), true);
    label = `каждую неделю: ${WD_LONG[p.toDi]}`;
  } else if (scope === 'add') {
    r.days[p.toDi] = 1;
    if (r.times) { const times = currentTimesArray(r); times[p.toDi] = times[p.fromDi] || r.time; r.times = times; simplifyTimes(r); }
    clearDayOverrides(p.rid, new Set([p.toDi]), true);
    label = `добавлен ${WD_LONG[p.toDi]}`;
  } else return;
  closeModal(); save(); render();
  toast(`Рутина «${r.title}» · ${label}`);
}
function submitRoutineWeekdayScopeForm(f) {
  const p = pendingRoutineMove;
  if (!p || p.type !== 'weekday') return closeModal();
  const fd = new FormData(f), scope = fd.get('weekScope'), r = findRoutine(p.rid);
  if (!r) return closeModal();
  let label = '';
  if (scope === 'add') {
    r.days[p.toDi] = 1;
    if (r.times) { const times = currentTimesArray(r); times[p.toDi] = times[p.fromDi] || r.time; r.times = times; simplifyTimes(r); }
    clearDayOverrides(p.rid, new Set([p.toDi]), true);
    label = `добавлен ${WD_LONG[p.toDi]}`;
  } else if (scope === 'move') {
    r.days[p.fromDi] = 0; r.days[p.toDi] = 1;
    if (r.times) { const times = currentTimesArray(r); times[p.toDi] = times[p.fromDi] || r.time; times[p.fromDi] = r.time; r.times = times; simplifyTimes(r); }
    clearDayOverrides(p.rid, new Set([p.fromDi, p.toDi]), true);
    label = `повтор перенесён на ${WD_LONG[p.toDi]}`;
  } else return;
  closeModal(); save(); render();
  toast(`Рутина «${r.title}» · ${label}`);
}

/* ================= экспорт / импорт / сброс ================= */
$('#exportBtn').addEventListener('click', () => {
  if (!unlocked || !state) return;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ritm-planner-${todayKey()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Резервная копия скачана. Это открытый JSON — храните её в надёжном месте');
});
$('#importBtn').addEventListener('click', () => { if (unlocked) $('#importFile').click(); });
function importJSON(input) {
  if (!unlocked || !state) return;
  const f = input.files && input.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const s = JSON.parse(rd.result);
      if (s && s.v === 2 && s.data) throw new Error('encrypted-vault');
      if (!s || !Array.isArray(s.routines) || !Array.isArray(s.tasks)) throw new Error('bad');
      state = normalizeState(s); state.meta.firstRun = false;
      save(); render();
      toast('Данные импортированы и зашифрованы текущим паролем');
    } catch (err) {
      toast('Не удалось прочитать файл — нужен обычный JSON-экспорт «Ритма»');
    }
  };
  rd.readAsText(f);
  input.value = '';
}
$('#resetBtn').addEventListener('click', () => {
  if (!unlocked || !state) return;
  if (!confirm('Сбросить все данные и вернуть демонстрационный пример? Ваши записи будут удалены.')) return;
  state = seedState();
  state.meta.firstRun = false;
  ui.dayAnchor = todayKey(); ui.weekAnchor = todayKey(); ui.needScroll = true;
  ui.tq = ''; ui.tcat = 'all'; ui.tstatus = 'all';
  save(); render();
  toast('Демонстрационные данные восстановлены');
});

/* ================= рендер ================= */
function updateSideStats() {
  const el = $('#miniStats');
  if (!el) return;
  const wk = weekKeyOf(new Date());
  const active = state.tasks.filter(t => !t.done).length;
  const onWeek = state.tasks.filter(t => !t.done && (t.week === wk || (t.date && weekKeyOf(parseKey(t.date)) === wk))).length;
  const water = healthOn(todayKey()).water;
  const mood = moodOn(todayKey());
  const moodStat = mood.value ? `${MOODS[mood.value].emoji} ${MOODS[mood.value].label}` : '—';
  el.innerHTML = `
    <div class="stat-row"><span>Серия рутины</span><b>${streak()} дн.</b></div>
    <div class="stat-row"><span>Активных дел</span><b>${active}</b></div>
    <div class="stat-row"><span>На этой неделе</span><b>${onWeek}</b></div>
    <div class="stat-row"><span>Вода сегодня</span><b>${(water / 1000).toFixed(1)} л</b></div>
    <div class="stat-row"><span>Настроение</span><b>${moodStat}</b></div>`;
}
function positionNowLine() {
  const line = $('#nowLine');
  if (!line) return;
  if (ui.view !== 'today' || ui.dayAnchor !== todayKey()) { line.hidden = true; return; }
  const m = nowMin();
  if (m < DAY_START || m > DAY_END) { line.hidden = true; return; }
  line.hidden = false;
  line.style.top = ((m - DAY_START) * PPM) + 'px';
  const nt = $('#nowTime');
  if (nt) nt.textContent = toHHMM(m);
}
function render() {
  if (!unlocked || !state) return;
  const views = { today: '#view-today', week: '#view-week', routines: '#view-routines', tasks: '#view-tasks', month: '#view-month' };
  syncDayScale();

  $$('.view').forEach(v => { v.hidden = true; });
  const host = $(views[ui.view]);
  host.hidden = false;
  host.innerHTML =
    ui.view === 'today'    ? todayHTML() :
    ui.view === 'week'     ? weekHTML() :
    ui.view === 'routines' ? routinesHTML() :
    ui.view === 'month'    ? monthHTML() :
    tasksHTML();

  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === ui.view));
  updateSideStats();

  if (ui.view === 'today') {
    positionNowLine();
    fitTimelineToSide();
    observeSide();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fitTimelineToSide);
  } else if (sideObserver) { sideObserver.disconnect(); sideObserver = null; }
  if (popEl && popAnchor && document.contains(popAnchor)) positionPopover();
  else if (popEl) closePopover();
}

/* ================= старт ================= */
setInterval(positionNowLine, 30000);
window.addEventListener('resize', () => { if (popEl) positionPopover(); if (unlocked && state && ui.view === 'today') { syncDayScale(); render(); } });
/* Сессия живёт, пока открыта вкладка. Никакой автоблокировки по времени:
   ключ лежит в sessionStorage и браузер удаляет его только при закрытии вкладки. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden && unlocked) flushSave().catch(err => console.error(err));
});
window.addEventListener('pagehide', () => {
  if (unlocked) flushSave().catch(err => console.error(err));
});
window.addEventListener('beforeunload', () => {
  if (unlocked) flushSave().catch(err => console.error(err));
});

$('#setupHelpBtn').addEventListener('click', openSetupHelpModal);
$('#lockBtn').addEventListener('click', () => { if (unlocked) lock('Планер заблокирован'); });
$('#changePassBtn').addEventListener('click', openPasswordModal);

initAuth().catch(err => { console.error(err); showFatal('Не удалось восстановить сессию. Введите пароль заново.'); });
