/**
 * utils.js
 * -------------------------------------------------------------
 * Funciones puras y utilitarias: transformación de datos,
 * parseo de la respuesta de Gemini, formateo de fechas y
 * persistencia en localStorage.
 *
 * Todas son fáciles de testear con Vitest porque no dependen
 * del DOM. Las que usan almacenamiento reciben el `storage`
 * como parámetro inyectable (por defecto, localStorage).
 * -------------------------------------------------------------
 */

/** Roles internos usados por la app. */
export const ROLE = { USER: 'user', ASSISTANT: 'assistant' };

/** Prefijo de la clave en localStorage. */
export const STORAGE_PREFIX = 'portal-chat:';

/**
 * Crea un objeto de mensaje normalizado.
 * @param {'user'|'assistant'} role
 * @param {string} text
 * @param {number} [timestamp] epoch ms
 * @returns {{role:string, text:string, timestamp:number}}
 */
export function createMessage(role, text, timestamp = Date.now()) {
  return { role, text: String(text == null ? '' : text), timestamp };
}

/**
 * Formatea un timestamp/Date a "HH:MM" (24h, con cero a la izquierda).
 * @param {number|Date} value
 * @returns {string}
 */
export function formatTime(value = Date.now()) {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Escapa caracteres HTML para evitar inyección al renderizar texto.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/**
 * Transforma el historial interno de mensajes al formato `contents`
 * que espera la API de Gemini. Filtra roles inválidos y mapea
 * 'assistant' -> 'model'.
 * @param {Array<{role:string, text:string}>} messages
 * @returns {Array<{role:string, parts:Array<{text:string}>}>}
 */
export function toGeminiContents(messages = []) {
  return messages
    .filter((m) => m && (m.role === ROLE.USER || m.role === ROLE.ASSISTANT) && m.text)
    .map((m) => ({
      role: m.role === ROLE.ASSISTANT ? 'model' : 'user',
      parts: [{ text: String(m.text) }],
    }));
}

/**
 * Extrae el texto de la respuesta JSON de Gemini de forma segura.
 * Lanza un Error descriptivo si la estructura no es válida.
 * @param {object} data respuesta cruda de la API
 * @returns {string}
 */
export function parseGeminiResponse(data) {
  const candidate = data && data.candidates && data.candidates[0];
  const parts = candidate && candidate.content && candidate.content.parts;
  const text = parts && parts.map((p) => p.text || '').join('').trim();
  if (!text) {
    throw new Error('La API no devolvió texto en la respuesta.');
  }
  return text;
}

/* ----------------------- Persistencia (localStorage) ----------------------- */

function getStore(storage) {
  if (storage) return storage;
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

/**
 * Guarda el historial de un personaje.
 * @param {string} characterId
 * @param {Array} messages
 * @param {Storage} [storage]
 */
export function saveHistory(characterId, messages, storage) {
  const store = getStore(storage);
  if (!store) return;
  try {
    store.setItem(STORAGE_PREFIX + characterId, JSON.stringify(messages || []));
  } catch (e) {
    /* almacenamiento lleno o no disponible: lo ignoramos */
  }
}

/**
 * Carga el historial de un personaje (array vacío si no hay nada).
 * @param {string} characterId
 * @param {Storage} [storage]
 * @returns {Array}
 */
export function loadHistory(characterId, storage) {
  const store = getStore(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(STORAGE_PREFIX + characterId);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * Borra el historial de un personaje.
 * @param {string} characterId
 * @param {Storage} [storage]
 */
export function clearHistory(characterId, storage) {
  const store = getStore(storage);
  if (!store) return;
  try {
    store.removeItem(STORAGE_PREFIX + characterId);
  } catch (e) {
    /* noop */
  }
}

/**
 * Indica si existe historial guardado para un personaje.
 * @param {string} characterId
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function hasHistory(characterId, storage) {
  return loadHistory(characterId, storage).length > 0;
}
