/**
 * tests/chat.test.js
 * Tests del módulo de chat: requestReply (con fetch mockeado) y demoReply.
 */
import { describe, it, expect, vi } from 'vitest';
import { requestReply, demoReply } from '../src/chat.js';

const character = { id: 'harry', name: 'Harry Potter' };

describe('requestReply', () => {
  it('devuelve el texto cuando la respuesta es 200 OK', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'Wubba lubba dub dub' }),
    });
    const reply = await requestReply(
      [{ role: 'user', text: 'hola' }],
      character,
      { fetchImpl },
    );
    expect(reply).toBe('Wubba lubba dub dub');
    expect(fetchImpl).toHaveBeenCalledOnce();
    // verifica que envía characterId y messages en el body
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.characterId).toBe('harry');
    expect(body.messages).toHaveLength(1);
  });

  it('lanza error con el mensaje del backend cuando no es OK', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Falta la API key' }),
    });
    await expect(
      requestReply([{ role: 'user', text: 'hi' }], character, { fetchImpl }),
    ).rejects.toThrow('Falta la API key');
  });

  it('lanza error si la respuesta OK no trae reply', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    await expect(
      requestReply([{ role: 'user', text: 'hi' }], character, { fetchImpl }),
    ).rejects.toThrow();
  });
});

describe('demoReply', () => {
  it('devuelve una cadena no vacía en personaje', () => {
    const r = demoReply(character, '¿cómo funciona el portal?');
    expect(typeof r).toBe('string');
    expect(r.length).toBeGreaterThan(0);
  });

  it('funciona aunque el personaje sea desconocido (usa fallback)', () => {
    const r = demoReply({ id: 'nadie', name: 'X' }, 'hola');
    expect(typeof r).toBe('string');
    expect(r.length).toBeGreaterThan(0);
  });
});
