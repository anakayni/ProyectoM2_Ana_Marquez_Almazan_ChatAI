/**
 * tests/chatEngine.test.js
 * Tests del motor de chat: recorte de historial/mensajes y
 * orquestación Gemini -> Groq (fallback) con fetch inyectado.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  trimMessages,
  toGroqMessages,
  getReply,
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGE_CHARS,
} from '../src/chatEngine.js';

describe('trimMessages', () => {
  it('conserva todos los mensajes si son menos que el máximo', () => {
    const msgs = [{ role: 'user', text: 'hola' }, { role: 'assistant', text: 'hey' }];
    expect(trimMessages(msgs, 10)).toEqual(msgs);
  });

  it('recorta al historial a los últimos N mensajes', () => {
    const msgs = Array.from({ length: 20 }, (_, i) => ({ role: 'user', text: `m${i}` }));
    const out = trimMessages(msgs, 4);
    expect(out).toHaveLength(4);
    expect(out.map((m) => m.text)).toEqual(['m16', 'm17', 'm18', 'm19']);
  });

  it('trunca mensajes individuales muy largos', () => {
    const long = 'x'.repeat(MAX_MESSAGE_CHARS + 500);
    const out = trimMessages([{ role: 'user', text: long }]);
    expect(out[0].text.length).toBe(MAX_MESSAGE_CHARS);
  });

  it('usa MAX_HISTORY_MESSAGES como valor por defecto', () => {
    const msgs = Array.from({ length: MAX_HISTORY_MESSAGES + 10 }, (_, i) => ({ role: 'user', text: `m${i}` }));
    expect(trimMessages(msgs)).toHaveLength(MAX_HISTORY_MESSAGES);
  });
});

describe('toGroqMessages', () => {
  it('antepone el system prompt y mapea roles', () => {
    const out = toGroqMessages(
      [{ role: 'user', text: 'hola' }, { role: 'assistant', text: 'qué tal' }],
      'Sos Harry Potter.',
    );
    expect(out[0]).toEqual({ role: 'system', content: 'Sos Harry Potter.' });
    expect(out[1]).toEqual({ role: 'user', content: 'hola' });
    expect(out[2]).toEqual({ role: 'assistant', content: 'qué tal' });
  });

  it('filtra mensajes sin texto o con role inválido', () => {
    const out = toGroqMessages(
      [{ role: 'user', text: '' }, { role: 'system', text: 'ignored' }, { role: 'assistant', text: 'ok' }],
      'prompt',
    );
    expect(out).toHaveLength(2); // system prompt + 1 mensaje válido
  });
});

describe('getReply', () => {
  const messages = [{ role: 'user', text: 'hola' }];
  const env = { GEMINI_API_KEY: 'gemini-key', GROQ_API_KEY: 'groq-key' };

  it('devuelve la respuesta de Gemini cuando responde OK', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'Hola, soy Harry' }] } }] }),
    });
    const result = await getReply({ messages, characterId: 'harry', env, fetchImpl });
    expect(result).toEqual({ reply: 'Hola, soy Harry', provider: 'gemini', characterId: 'harry' });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][0]).toContain('generativelanguage.googleapis.com');
  });

  it('usa Groq como fallback si Gemini falla', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'quota exceeded' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Hola, soy Harry (Groq)' } }] }),
      });
    const result = await getReply({ messages, characterId: 'harry', env, fetchImpl });
    expect(result).toEqual({ reply: 'Hola, soy Harry (Groq)', provider: 'groq', characterId: 'harry' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][0]).toContain('api.groq.com');
    const groqBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(groqBody.model).toBe('llama-3.3-70b-versatile');
    expect(groqBody.max_tokens).toBeGreaterThan(0);
  });

  it('lanza error si ambos proveedores fallan', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    await expect(getReply({ messages, characterId: 'harry', env, fetchImpl })).rejects.toThrow();
  });

  it('lanza error de configuración si no hay ninguna API key', async () => {
    const fetchImpl = vi.fn();
    await expect(
      getReply({ messages, characterId: 'harry', env: {}, fetchImpl }),
    ).rejects.toThrow(/API key/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('usa solo Groq si no hay GEMINI_API_KEY configurada', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'solo groq' } }] }),
    });
    const result = await getReply({ messages, characterId: 'harry', env: { GROQ_API_KEY: 'groq-key' }, fetchImpl });
    expect(result.provider).toBe('groq');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
