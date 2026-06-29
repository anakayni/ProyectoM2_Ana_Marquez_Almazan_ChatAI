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
    rick: [
      `*eructo* ¿"${short}"? Pff, fácil. Pero no te voy a dar la versión completa, te explotaría el cerebro, Morty.`,
      `Mira, lo de "${short}" tiene una respuesta obvia… para alguien con mi coeficiente. La corta: sí, y a la vez no.`,
      `Aj, ${short ? 'eso' : 'nada'}. La ciencia no se trata de "por qué", se trata de "por qué no". Siguiente pregunta.`,
    ],
    morty: [
      `Ah, e-este… ¿"${short}"? Vale, c-creo que puedo intentarlo, ¿okey? No te prometo nada, jeje.`,
      `Uy, no sé si soy el indicado, pero… sobre "${short}", yo diría que respires y lo intentes paso a paso.`,
      `M-mira, Rick diría algo súper complicado, pero yo creo que lo de "${short}" no es para tanto. ¿O sí?`,
    ],
    summer: [
      `Ok, mira, lo de "${short}" te lo resumo: hazlo con seguridad y nadie va a dudar de ti. En serio.`,
      `"${short}"? Obvio que tengo opinión. La clave es actitud y un buen plan. Confía en mí.`,
      `Honestamente, "${short}" es más simple de lo que crees. Yo lo haría con estilo y sin estrés.`,
    ],
  };

  const list = byId[character.id] || byId.rick;
  return list[Math.floor(Math.random() * list.length)];
}

export { ROLE };
