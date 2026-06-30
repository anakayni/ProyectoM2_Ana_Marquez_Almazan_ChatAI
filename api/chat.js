/**
 * api/chat.js
 * -------------------------------------------------------------
 * Vercel Serverless Function que actúa como PROXY SEGURO entre
 * el frontend y la API de Google Gemini.
 *
 * El frontend NUNCA ve la API key: vive solo en el servidor,
 * en la variable de entorno GEMINI_API_KEY.
 *
 * Flujo:
 *   frontend  --POST {messages, characterId}-->  esta función
 *   esta función  --POST (con API key)-->  Gemini
 *   Gemini  --respuesta-->  esta función  --{reply}-->  frontend
 * -------------------------------------------------------------
 */

import { getCharacter } from '../src/characters.js';
import { toGeminiContents, parseGeminiResponse } from '../src/utils.js';

export default async function handler(req, res) {
  // Solo aceptamos POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido. Usa POST.' });
    return;
  }

  try {
    const { messages = [], characterId = 'rick' } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Faltan los mensajes de la conversación.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'El servidor no tiene configurada GEMINI_API_KEY.' });
      return;
    }

    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const character = getCharacter(characterId);

    // Construimos el cuerpo para Gemini: system prompt + todo el historial.
    const body = {
      systemInstruction: { parts: [{ text: character.systemPrompt }] },
      contents: toGeminiContents(messages),
      generationConfig: {
        temperature: 0.9,
        topP: 0.95,
        maxOutputTokens: 220,
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!geminiRes.ok) {
      const detail = await geminiRes.text().catch(() => '');
      res.status(502).json({ error: 'Error al comunicarse con Gemini.', detail });
      return;
    }

    const data = await geminiRes.json();
    const reply = parseGeminiResponse(data);

    res.status(200).json({ reply, characterId: character.id });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error interno del servidor.' });
  }
}
