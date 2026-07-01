/**
 * chatEngine.js
 * -------------------------------------------------------------
 * Orquesta la conversación con los proveedores de IA (Gemini y,
 * como respaldo, Groq/Llama). Módulo PURO: recibe `fetchImpl` y
 * `env` inyectables para poder testearlo sin red real, y para
 * que la Serverless Function (`api/chat.js`) sea un wrapper fino.
 *
 * También acota el consumo de tokens: recorta el historial a las
 * últimas N entradas y trunca mensajes individuales muy largos,
 * para que una conversación extensa no vuelva cada request cada
 * vez más cara.
 * -------------------------------------------------------------
 */

import { getCharacter } from './characters.js';
import { toGeminiContents, parseGeminiResponse } from './utils.js';

/** Cuántos mensajes de historial (usuario + asistente) se envían como contexto. */
export const MAX_HISTORY_MESSAGES = 10;

/** Tope de caracteres por mensaje individual antes de enviarlo al modelo. */
export const MAX_MESSAGE_CHARS = 800;

/** Tope de tokens de salida por respuesta, para ambos proveedores. */
export const MAX_OUTPUT_TOKENS = 200;

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

/**
 * Recorta el historial a los últimos `maxMessages` y trunca el texto
 * de cada mensaje a `MAX_MESSAGE_CHARS` para acotar tokens de entrada.
 * @param {Array<{role:string,text:string}>} messages
 * @param {number} [maxMessages]
 * @returns {Array<{role:string,text:string}>}
 */
export function trimMessages(messages = [], maxMessages = MAX_HISTORY_MESSAGES) {
  return messages.slice(-maxMessages).map((m) => {
    const text = typeof m.text === 'string' && m.text.length > MAX_MESSAGE_CHARS
      ? m.text.slice(0, MAX_MESSAGE_CHARS)
      : m.text;
    return { ...m, text };
  });
}

/**
 * Transforma el historial al formato `messages` de la API de Groq
 * (compatible con OpenAI), anteponiendo el system prompt del personaje.
 * @param {Array<{role:string,text:string}>} messages
 * @param {string} systemPrompt
 * @returns {Array<{role:string, content:string}>}
 */
export function toGroqMessages(messages = [], systemPrompt) {
  const chat = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.text)
    .map((m) => ({ role: m.role, content: String(m.text) }));
  return [{ role: 'system', content: systemPrompt }, ...chat];
}

function providerError(message, { status, detail, cause } = {}) {
  const err = new Error(message);
  if (status) err.status = status;
  if (detail) err.detail = detail;
  if (cause) err.cause = cause;
  return err;
}

/**
 * Llama a Gemini y devuelve el texto de respuesta.
 * @throws {Error} si la respuesta HTTP no es OK o no trae texto
 */
export async function callGemini({ apiKey, model = DEFAULT_GEMINI_MODEL, character, messages, fetchImpl }) {
  const body = {
    systemInstruction: { parts: [{ text: character.systemPrompt }] },
    contents: toGeminiContents(messages),
    generationConfig: { temperature: 0.9, topP: 0.95, maxOutputTokens: MAX_OUTPUT_TOKENS },
  };
  const url = `${GEMINI_URL}/${model}:generateContent?key=${apiKey}`;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw providerError('Error al comunicarse con Gemini.', { status: res.status, detail });
  }
  const data = await res.json();
  return parseGeminiResponse(data);
}

/**
 * Llama a Groq (Llama) y devuelve el texto de respuesta.
 * @throws {Error} si la respuesta HTTP no es OK o no trae texto
 */
export async function callGroq({ apiKey, model = DEFAULT_GROQ_MODEL, character, messages, fetchImpl }) {
  const body = {
    model,
    messages: toGroqMessages(messages, character.systemPrompt),
    temperature: 0.9,
    max_tokens: MAX_OUTPUT_TOKENS,
  };
  const res = await fetchImpl(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw providerError('Error al comunicarse con Groq.', { status: res.status, detail });
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw providerError('Groq no devolvió texto en la respuesta.');
  return text;
}

/**
 * Obtiene la respuesta del personaje: intenta Gemini primero y, si
 * falla (error de red, cuota excedida, etc.), usa Groq como respaldo.
 *
 * @param {object} opts
 * @param {Array<{role:string,text:string}>} opts.messages historial completo (sin recortar)
 * @param {string} opts.characterId
 * @param {object} [opts.env] variables de entorno (por defecto, `process.env`)
 * @param {Function} [opts.fetchImpl] inyectable para tests
 * @returns {Promise<{reply:string, provider:'gemini'|'groq', characterId:string}>}
 */
export async function getReply({ messages, characterId, env = process.env, fetchImpl = fetch }) {
  const character = getCharacter(characterId);
  const trimmed = trimMessages(messages);

  const geminiKey = env.GEMINI_API_KEY;
  const groqKey = env.GROQ_API_KEY;

  if (!geminiKey && !groqKey) {
    throw providerError(
      'El servidor no tiene configurada ninguna API key (GEMINI_API_KEY / GROQ_API_KEY).',
      { status: 500 },
    );
  }

  let lastErr;

  if (geminiKey) {
    try {
      const reply = await callGemini({
        apiKey: geminiKey,
        model: env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
        character,
        messages: trimmed,
        fetchImpl,
      });
      return { reply, provider: 'gemini', characterId: character.id };
    } catch (err) {
      lastErr = err;
    }
  }

  if (groqKey) {
    try {
      const reply = await callGroq({
        apiKey: groqKey,
        model: env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
        character,
        messages: trimmed,
        fetchImpl,
      });
      return { reply, provider: 'groq', characterId: character.id };
    } catch (err) {
      lastErr = err;
    }
  }

  throw providerError('No se pudo obtener respuesta de ningún proveedor de IA.', {
    status: 502,
    cause: lastErr,
  });
}
