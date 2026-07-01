/**
 * chat.js
 * -------------------------------------------------------------
 * Lógica específica del chat: comunicación con la Serverless
 * Function y respuesta de respaldo (modo demo) cuando no hay
 * backend disponible (por ejemplo, abriendo el HTML estático
 * sin `vercel dev`).
 * -------------------------------------------------------------
 */

import { ROLE } from './utils.js';

/** Endpoint de la serverless function. */
export const CHAT_ENDPOINT = '/api/chat';

/**
 * Envía el historial al backend y devuelve la respuesta del personaje.
 * Es inyectable (`fetchImpl`, `endpoint`) para poder testearla con mocks.
 *
 * @param {Array<{role:string,text:string}>} messages historial completo
 * @param {{id:string}} character personaje activo
 * @param {{fetchImpl?:Function, endpoint?:string}} [opts]
 * @returns {Promise<string>} texto de la respuesta
 * @throws {Error} si la petición falla o la respuesta es inválida
 */
export async function requestReply(messages, character, opts = {}) {
  const fetchImpl = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  const endpoint = opts.endpoint || CHAT_ENDPOINT;
  if (!fetchImpl) throw new Error('fetch no está disponible en este entorno.');

  const res = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, characterId: character.id }),
  });

  if (!res.ok) {
    // Intentamos leer el mensaje de error del backend.
    let msg = `Error ${res.status}`;
    try {
      const data = await res.json();
      if (data && data.error) msg = data.error;
    } catch (e) { /* respuesta no-JSON */ }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  if (!data || !data.reply) throw new Error('La respuesta del servidor no tiene contenido.');
  return data.reply;
}

/**
 * Respuesta de respaldo "en personaje" para cuando no hay backend
 * (modo demo del POC). NO usa IA: son plantillas simples basadas
 * en el último mensaje del usuario.
 *
 * @param {{id:string, name:string}} character
 * @param {string} userText
 * @returns {string}
 */
export function demoReply(character, userText) {
  const text = String(userText || '').trim();
  const short = text.length > 60 ? text.slice(0, 57) + '…' : text;

  const byId = {
    harry: [
      `Sobre "${short}"… mira, no siempre tengo la respuesta, pero lo enfrentamos juntos. Como en Hogwarts.`,
      `"${short}", ¿eh? A veces solo hay que ser valiente y dar el paso. Yo te cubro las espaldas.`,
      `Vale, "${short}". Ron y Hermione dirían cosas distintas… pero yo creo que confíes en ti. Funciona.`,
    ],
    hermione: [
      `Según lo que he leído, "${short}" se resuelve mejor con un plan y algo de lógica. Te ayudo a ordenarlo.`,
      `"${short}"? Honestamente, es cuestión de estudiarlo bien. Vamos por partes y verás que tiene sentido.`,
      `Mira, sobre "${short}": la respuesta suele estar si buscas en el sitio correcto. Empecemos por lo básico.`,
    ],
    ron: [
      `¡Madre mía, "${short}"! Vale, tranquilo… seguro no es tan grave. ¿Lo hablamos con calma? Y quizá un sándwich.`,
      `"${short}", ¿eh? ¡Brillante! Bueno, más o menos. Yo te digo lo que haría, aunque Hermione lo diría mejor.`,
      `Eh, "${short}"… a mí también me pondría nervioso, pero eres más capaz de lo que crees. ¡En serio!`,
    ],
  };

  const list = byId[character.id] || byId.harry;
  return list[Math.floor(Math.random() * list.length)];
}

export { ROLE };
