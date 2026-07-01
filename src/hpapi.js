/**
 * hpapi.js
 * -------------------------------------------------------------
 * Capa de datos de la HP API (https://hp-api.onrender.com).
 * Trae la imagen y los datos reales de cada personaje (Harry,
 * Hermione y Ron).
 *
 * Separa responsabilidades:
 *   - fetchAllCharacters: hace la petición (fetching).
 *   - parseCharacter / findCharacter: transforman el JSON (puras, testeables).
 *
 * La API es pública y sin API key.
 * -------------------------------------------------------------
 */

/** Endpoint que devuelve todos los personajes. */
export const HP_ENDPOINT = 'https://hp-api.onrender.com/api/characters';

/**
 * Transforma un personaje crudo de la HP API en un objeto simple.
 * Función PURA: sin red ni DOM.
 * @param {object} raw
 * @returns {{name:string,image:string,house:string,patronus:string,actor:string,species:string,alive:boolean}}
 */
export function parseCharacter(raw) {
  raw = raw || {};
  return {
    name: raw.name || '',
    image: raw.image || '',
    house: raw.house || '',
    patronus: raw.patronus || '',
    actor: raw.actor || '',
    species: raw.species || '',
    alive: !!raw.alive,
  };
}

/**
 * Busca un personaje por su nombre exacto (sin distinguir mayúsculas)
 * dentro de una lista y lo devuelve ya transformado.
 * Función PURA.
 * @param {Array} list lista cruda de la API
 * @param {string} name nombre exacto (ej. "Harry Potter")
 * @returns {object|null}
 */
export function findCharacter(list, name) {
  if (!Array.isArray(list)) return null;
  const target = String(name || '').toLowerCase();
  const raw = list.find((c) => String(c.name || '').toLowerCase() === target);
  return raw ? parseCharacter(raw) : null;
}

/**
 * Descarga la lista completa de personajes de la HP API.
 * `fetchImpl` y `endpoint` son inyectables para test.
 * @param {{fetchImpl?:Function, endpoint?:string}} [opts]
 * @returns {Promise<Array>}
 * @throws {Error} si la petición falla
 */
export async function fetchAllCharacters(opts = {}) {
  const fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  const endpoint = opts.endpoint || HP_ENDPOINT;
  if (!fetchImpl) throw new Error('fetch no está disponible en este entorno.');

  const res = await fetchImpl(endpoint);
  if (!res.ok) {
    const err = new Error(`HP API respondió ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('La HP API no devolvió una lista de personajes.');
  return data;
}
