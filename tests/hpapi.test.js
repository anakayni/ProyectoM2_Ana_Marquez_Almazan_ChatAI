/**
 * tests/hpapi.test.js
 * Tests de la capa de datos de la HP API: parseo/búsqueda puros y fetch mockeado.
 */
import { describe, it, expect, vi } from 'vitest';
import { parseCharacter, findCharacter, fetchAllCharacters } from '../src/hpapi.js';

const SAMPLE = [
  { name: 'Harry Potter', image: 'https://img/harry.jpg', house: 'Gryffindor', patronus: 'stag', actor: 'Daniel Radcliffe', species: 'human', alive: true },
  { name: 'Draco Malfoy', image: 'https://img/draco.jpg', house: 'Slytherin', patronus: '', actor: 'Tom Felton', species: 'human', alive: true },
];

describe('parseCharacter', () => {
  it('extrae los campos relevantes', () => {
    expect(parseCharacter(SAMPLE[0])).toEqual({
      name: 'Harry Potter', image: 'https://img/harry.jpg', house: 'Gryffindor',
      patronus: 'stag', actor: 'Daniel Radcliffe', species: 'human', alive: true,
    });
  });

  it('rellena con valores por defecto si faltan campos', () => {
    const p = parseCharacter({ name: 'X' });
    expect(p.image).toBe('');
    expect(p.alive).toBe(false);
  });
});

describe('findCharacter', () => {
  it('encuentra por nombre exacto sin distinguir mayúsculas', () => {
    expect(findCharacter(SAMPLE, 'harry potter').house).toBe('Gryffindor');
  });

  it('devuelve null si no está en la lista', () => {
    expect(findCharacter(SAMPLE, 'Ron Weasley')).toBeNull();
  });

  it('devuelve null si la lista no es válida', () => {
    expect(findCharacter(null, 'Harry Potter')).toBeNull();
  });
});

describe('fetchAllCharacters', () => {
  it('devuelve la lista cuando la respuesta es OK', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => SAMPLE });
    const list = await fetchAllCharacters({ fetchImpl, endpoint: 'https://api/x' });
    expect(list).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledWith('https://api/x');
  });

  it('lanza error si la respuesta no es OK', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    await expect(fetchAllCharacters({ fetchImpl })).rejects.toThrow();
  });

  it('lanza error si la respuesta no es una lista', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nope: true }) });
    await expect(fetchAllCharacters({ fetchImpl })).rejects.toThrow();
  });
});
