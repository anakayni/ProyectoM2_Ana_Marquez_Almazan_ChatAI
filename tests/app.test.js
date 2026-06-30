/**
 * tests/app.test.js
 * Tests del routing SPA (funciones puras de router.js) y de characters.js.
 */
import { describe, it, expect } from 'vitest';
import { parseRoute, pathForRoute, ROUTES } from '../src/router.js';
import { getCharacter, CHARACTERS } from '../src/characters.js';

describe('parseRoute', () => {
  it('mapea "/" y "/home" a home', () => {
    expect(parseRoute('/')).toBe('home');
    expect(parseRoute('/home')).toBe('home');
  });

  it('mapea /chat y /about correctamente', () => {
    expect(parseRoute('/chat')).toBe('chat');
    expect(parseRoute('/about')).toBe('about');
  });

  it('ignora barras finales', () => {
    expect(parseRoute('/chat/')).toBe('chat');
  });

  it('cae en home con rutas desconocidas', () => {
    expect(parseRoute('/cualquier-cosa')).toBe('home');
    expect(parseRoute('')).toBe('home');
  });
});

describe('pathForRoute', () => {
  it('genera el path canónico', () => {
    expect(pathForRoute('chat')).toBe('/chat');
    expect(pathForRoute('home')).toBe('/home');
  });

  it('cae en /home con rutas inválidas', () => {
    expect(pathForRoute('zzz')).toBe('/home');
  });

  it('todas las ROUTES generan un path válido', () => {
    ROUTES.forEach((r) => expect(pathForRoute(r)).toBe(`/${r}`));
  });
});

describe('getCharacter', () => {
  it('devuelve el personaje correcto por id', () => {
    expect(getCharacter('summer').name).toBe('Summer Smith');
  });

  it('devuelve el primer personaje si el id no existe', () => {
    expect(getCharacter('desconocido')).toBe(CHARACTERS[0]);
  });

  it('cada personaje tiene un system prompt único y no vacío', () => {
    const prompts = CHARACTERS.map((c) => c.systemPrompt);
    prompts.forEach((p) => expect(p.length).toBeGreaterThan(20));
    expect(new Set(prompts).size).toBe(CHARACTERS.length);
  });
});
