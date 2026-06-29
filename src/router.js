/**
 * router.js
 * -------------------------------------------------------------
 * Lógica de routing PURA (sin DOM ni efectos secundarios), para
 * poder reutilizarla en app.js y testearla con Vitest.
 * -------------------------------------------------------------
 */

/** Rutas válidas de la SPA. */
export const ROUTES = ['home', 'chat', 'about'];

/**
 * Convierte un pathname en el nombre de una de las vistas.
 * Rutas desconocidas, '/' y '/home' caen en 'home'.
 * @param {string} pathname
 * @returns {'home'|'chat'|'about'}
 */
export function parseRoute(pathname) {
  const clean = String(pathname || '/').replace(/\/+$/, '') || '/';
  const last = clean.split('/').pop();
  if (last === 'chat') return 'chat';
  if (last === 'about') return 'about';
  return 'home';
}

/**
 * Devuelve el path canónico (URL) para una ruta.
 * @param {string} route
 * @returns {string}
 */
export function pathForRoute(route) {
  const r = ROUTES.includes(route) ? route : 'home';
  return `/${r}`;
}
