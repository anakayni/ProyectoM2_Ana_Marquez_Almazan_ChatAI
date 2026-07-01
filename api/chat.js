/**
 * api/chat.js
 * -------------------------------------------------------------
 * Vercel Serverless Function que actúa como PROXY SEGURO entre
 * el frontend y los proveedores de IA (Gemini, con Groq/Llama
 * como respaldo si Gemini falla). Las API keys NUNCA llegan al
 * frontend: viven solo en el servidor, en GEMINI_API_KEY y
 * GROQ_API_KEY. Toda la lógica de orquestación y de límites de
 * tokens vive en ../src/chatEngine.js para poder testearla.
 *
 * Flujo:
 *   frontend  --POST {messages, characterId}-->  esta función
 *   esta función  -->  chatEngine.getReply()  -->  Gemini o Groq
 * -------------------------------------------------------------
 */

import { getReply } from '../src/chatEngine.js';

export default async function handler(req, res) {
  // Solo aceptamos POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido. Usa POST.' });
    return;
  }

  try {
    const { messages = [], characterId = 'harry' } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Faltan los mensajes de la conversación.' });
      return;
    }

    const result = await getReply({ messages, characterId });
    res.status(200).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor.', detail: err.detail });
  }
}
