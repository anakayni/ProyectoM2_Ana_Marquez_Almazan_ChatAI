/**
 * tests/utils.test.js
 * Tests de las funciones puras de transformación y persistencia.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMessage, formatTime, escapeHtml,
  toGeminiContents, parseGeminiResponse,
  saveHistory, loadHistory, clearHistory, hasHistory, ROLE,
} from '../src/utils.js';

describe('createMessage', () => {
  it('crea un mensaje con role, text y timestamp', () => {
    const m = createMessage(ROLE.USER, 'hola', 1000);
    expect(m).toEqual({ role: 'user', text: 'hola', timestamp: 1000 });
  });

  it('convierte text a string aunque reciba otro tipo', () => {
    expect(createMessage(ROLE.USER, 42, 1).text).toBe('42');
  });
});

describe('formatTime', () => {
  it('formatea a HH:MM con cero a la izquierda', () => {
    const d = new Date(2024, 0, 1, 9, 5);
    expect(formatTime(d)).toBe('09:05');
  });

  it('devuelve cadena vacía con una fecha inválida', () => {
    expect(formatTime('no-es-fecha')).toBe('');
  });
});

describe('escapeHtml', () => {
  it('escapa caracteres peligrosos', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">'))
      .toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });
});

describe('toGeminiContents', () => {
  it('mapea assistant -> model y user -> user', () => {
    const out = toGeminiContents([
      { role: 'user', text: 'hola' },
      { role: 'assistant', text: 'qué tal' },
    ]);
    expect(out).toEqual([
      { role: 'user', parts: [{ text: 'hola' }] },
      { role: 'model', parts: [{ text: 'qué tal' }] },
    ]);
  });

  it('filtra mensajes sin texto o con role inválido', () => {
    const out = toGeminiContents([
      { role: 'user', text: '' },
      { role: 'system', text: 'ignored' },
      { role: 'assistant', text: 'ok' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].role).toBe('model');
  });
});

describe('parseGeminiResponse', () => {
  it('extrae el texto de la estructura de Gemini', () => {
    const data = { candidates: [{ content: { parts: [{ text: '  hola mundo  ' }] } }] };
    expect(parseGeminiResponse(data)).toBe('hola mundo');
  });

  it('lanza error si no hay texto', () => {
    expect(() => parseGeminiResponse({ candidates: [] })).toThrow();
    expect(() => parseGeminiResponse({})).toThrow();
  });
});

describe('persistencia con storage inyectable', () => {
  let store;
  beforeEach(() => {
    const data = {};
    store = {
      getItem: (k) => (k in data ? data[k] : null),
      setItem: (k, v) => { data[k] = String(v); },
      removeItem: (k) => { delete data[k]; },
    };
  });

  it('guarda y carga el historial', () => {
    const msgs = [createMessage('user', 'hey', 1)];
    saveHistory('rick', msgs, store);
    expect(loadHistory('rick', store)).toEqual(msgs);
  });

  it('hasHistory refleja si hay mensajes', () => {
    expect(hasHistory('rick', store)).toBe(false);
    saveHistory('rick', [createMessage('user', 'x', 1)], store);
    expect(hasHistory('rick', store)).toBe(true);
  });

  it('clearHistory borra el historial', () => {
    saveHistory('rick', [createMessage('user', 'x', 1)], store);
    clearHistory('rick', store);
    expect(loadHistory('rick', store)).toEqual([]);
  });

  it('loadHistory devuelve [] si el JSON está corrupto', () => {
    store.setItem('portal-chat:rick', '{no-json');
    expect(loadHistory('rick', store)).toEqual([]);
  });
});
