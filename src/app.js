/**
 * app.js
 * -------------------------------------------------------------
 * Lógica principal: routing SPA (History API), renderizado de
 * las vistas (Home, Chat, About), manejo de estado y conexión
 * con el chat. Sin frameworks: solo DOM nativo.
 * -------------------------------------------------------------
 */

import { CHARACTERS, getCharacter } from './characters.js';
import {
  ROLE, createMessage, formatTime, escapeHtml,
  saveHistory, loadHistory, clearHistory, hasHistory,
} from './utils.js';
import { requestReply, demoReply } from './chat.js';
import { parseRoute, pathForRoute } from './router.js';

/* ----------------------------- Iconos SVG ----------------------------- */
const ICONS = {
  portal: 'M12 4a8 6 0 1 0 0 12 8 6 0 0 0 0-12M12 7.5a4.5 3.2 0 1 0 0 6.4 4.5 3.2 0 0 0 0-6.4',
  home: 'M4 11l8-7 8 7M6 10v9h12v-9',
  chat: 'M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.6 8.6 0 0 1-3.8-.9L3 20.5l1.6-5.6a8.4 8.4 0 0 1-.9-3.8A8.4 8.4 0 0 1 12.2 3 8.4 8.4 0 0 1 21 11.5z',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 11v6M12 7.5h.01',
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  send: 'M12 19V6M6 12l6-6 6 6',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  trash: 'M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  check: 'M5 12l4 4 10-10',
  spark: 'M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z',
};
function icon(name, size = 20, sw = 1.8) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[name] || ''}"/></svg>`;
}

/* ----------------------------- Estado ----------------------------- */
const app = document.getElementById('app');
const ROUTES = ['home', 'chat', 'about'];

const state = {
  route: 'home',
  characterId: 'rick',
  theme: 'light',
  messages: [],
  status: 'idle',   // 'idle' | 'loading' | 'error'
  error: '',
  demoMode: false,  // true cuando el backend no está disponible
  menuOpen: false,
};

/* Preferencias persistentes (tema + último personaje). */
try {
  const prefs = JSON.parse(localStorage.getItem('portal-chat:prefs') || '{}');
  if (prefs.theme) state.theme = prefs.theme;
  if (prefs.characterId) state.characterId = prefs.characterId;
} catch (e) { /* noop */ }

function savePrefs() {
  try {
    localStorage.setItem('portal-chat:prefs', JSON.stringify({
      theme: state.theme, characterId: state.characterId,
    }));
  } catch (e) { /* noop */ }
}

function character() { return getCharacter(state.characterId); }

/* ----------------------------- Routing (History API) ----------------------------- */

/** Navega a una ruta usando pushState (sin recargar). */
function navigate(path) {
  const route = parseRoute(path);
  const url = pathForRoute(route);
  if (parseRoute(location.pathname) !== route || location.pathname === '/') {
    history.pushState({ route }, '', url);
  }
  state.route = route;
  state.menuOpen = false;
  render();
}

/** Maneja back/forward del navegador. */
window.addEventListener('popstate', () => {
  state.route = parseRoute(location.pathname);
  render();
});

/* ----------------------------- Tema ----------------------------- */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.setAttribute('content', state.theme === 'light' ? '#ffffff' : '#0b0d11');
}
function applyAccent() {
  const c = character();
  document.documentElement.style.setProperty('--accent', c.accent);
  document.documentElement.style.setProperty('--accent-rgb', c.accentRgb);
}
function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  savePrefs();
  applyTheme();
  render();
}

/* ----------------------------- Navbar ----------------------------- */
function navbarHTML() {
  const link = (route, label, ic) =>
    `<button class="nav-link ${state.route === route ? 'on' : ''}" data-nav="${route}">
      ${icon(ic, 18)}<span>${label}</span>
    </button>`;
  return `
    <header class="navbar">
      <button class="brand" data-nav="home" aria-label="Portal Chat">
        <span class="brand-mark">${icon('portal', 20, 1.6)}</span>
        <span class="brand-name">Portal&nbsp;Chat</span>
      </button>
      <nav class="nav-links" data-menu="${state.menuOpen ? 'open' : ''}">
        ${link('home', 'Inicio', 'home')}
        ${link('chat', 'Chat', 'chat')}
        ${link('about', 'Acerca de', 'info')}
      </nav>
      <div class="nav-right">
        <button class="theme-btn" data-act="theme" aria-label="Cambiar tema">
          ${icon(state.theme === 'light' ? 'moon' : 'sun', 19)}
        </button>
        <button class="menu-btn" data-act="menu" aria-label="Menú">${icon('menu', 20)}</button>
      </div>
    </header>`;
}

/* ----------------------------- Vista: Home ----------------------------- */
function homeHTML() {
  const c = character();
  const cards = CHARACTERS.map((ch) => {
    const active = ch.id === state.characterId;
    const saved = hasHistory(ch.id);
    return `
      <button class="char-card ${active ? 'active' : ''}" data-pick="${ch.id}"
        style="--c:${ch.accent};--c-rgb:${ch.accentRgb}">
        <span class="char-avatar"><img src="${ch.avatar}" alt="${escapeHtml(ch.name)}"
          onerror="this.style.display='none'"></span>
        <span class="char-info">
          <span class="char-name">${escapeHtml(ch.name)}</span>
          <span class="char-role">${escapeHtml(ch.role)}</span>
          <span class="char-tag">${escapeHtml(ch.tagline)}</span>
        </span>
        <span class="char-foot">
          <span class="char-franchise">${escapeHtml(ch.franchise)}</span>
          ${saved ? '<span class="char-saved">● historial guardado</span>' : ''}
          ${active ? `<span class="char-check">${icon('check', 16)} Seleccionado</span>` : '<span class="char-pick">Elegir</span>'}
        </span>
      </button>`;
  }).join('');

  return `
    <section class="view home">
      <div class="hero">
        <span class="hero-badge">${icon('spark', 14, 1.8)} POC · ComicSansCon</span>
        <h1 class="hero-title">Chatea con tu<br><span class="grad">personaje favorito</span></h1>
        <p class="hero-sub">Una Single Page Application que conversa con personajes ficticios
          usando inteligencia artificial. Elige un personaje y empieza a hablar.</p>
        <div class="hero-cta">
          <button class="btn primary" data-act="start">
            Chatear con ${escapeHtml(c.name.split(' ')[0])} ${icon('arrowRight', 18)}
          </button>
          <button class="btn ghost" data-nav="about">Conocer el proyecto</button>
        </div>
      </div>
      <div class="gallery">
        <h2 class="section-title">Elige un personaje</h2>
        <div class="char-grid">${cards}</div>
      </div>
    </section>`;
}

/* ----------------------------- Vista: Chat ----------------------------- */
function messageHTML(m, c) {
  const time = formatTime(m.timestamp);
  if (m.role === ROLE.USER) {
    return `
      <div class="msg user">
        <div class="msg-body">
          <div class="bubble">${escapeHtml(m.text)}</div>
          <div class="msg-meta"><span>${time}</span></div>
        </div>
        <div class="msg-avatar you">Tú</div>
      </div>`;
  }
  return `
    <div class="msg ai">
      <div class="msg-avatar"><img src="${c.avatar}" alt="" onerror="this.style.display='none'"></div>
      <div class="msg-body">
        <div class="msg-name">${escapeHtml(c.name)}</div>
        <div class="bubble">${escapeHtml(m.text)}</div>
        <div class="msg-meta">
          <span>${time}</span>
          <button class="copy-btn" data-copy="${encodeURIComponent(m.text)}" title="Copiar">
            ${icon('copy', 14)}<span>Copiar</span>
          </button>
        </div>
      </div>
    </div>`;
}

function typingHTML(c) {
  return `
    <div class="msg ai" id="typing-row">
      <div class="msg-avatar"><img src="${c.avatar}" alt="" onerror="this.style.display='none'"></div>
      <div class="msg-body">
        <div class="msg-name">${escapeHtml(c.name)}</div>
        <div class="bubble typing"><i></i><i></i><i></i></div>
      </div>
    </div>`;
}

function chatHTML() {
  const c = character();
  const empty = state.messages.length === 0;

  const body = empty
    ? `<div class="chat-empty">
         <div class="chat-empty-avatar"><img src="${c.avatar}" alt="" onerror="this.style.display='none'"></div>
         <h2>${escapeHtml(c.greeting)}</h2>
         <div class="suggest-list">
           ${c.suggestions.map((s) => `<button class="suggest" data-send="${escapeHtml(s)}">${icon('spark', 15, 1.8)} ${escapeHtml(s)}</button>`).join('')}
         </div>
       </div>`
    : state.messages.map((m) => messageHTML(m, c)).join('') +
      (state.status === 'loading' ? typingHTML(c) : '');

  const errorBar = state.status === 'error'
    ? `<div class="error-bar" role="alert">${icon('info', 16)} ${escapeHtml(state.error)}
        <button class="retry" data-act="retry">Reintentar</button></div>`
    : '';

  const demoBanner = state.demoMode
    ? `<div class="demo-banner">Modo demo (sin backend): respuestas simuladas.
        Con <code>vercel dev</code> y tu API key se usa Gemini real.</div>`
    : '';

  return `
    <section class="view chat">
      <div class="chat-head" style="--accent:${c.accent};--accent-rgb:${c.accentRgb}">
        <div class="chat-head-l">
          <div class="chat-head-avatar"><img src="${c.avatar}" alt="" onerror="this.style.display='none'"><span class="live"></span></div>
          <div>
            <div class="chat-head-name">${escapeHtml(c.name)}</div>
            <div class="chat-head-role">${escapeHtml(c.role)} · en línea</div>
          </div>
        </div>
        <div class="chat-head-r">
          <button class="chip-btn" data-nav="home">${icon('back', 16)}<span>Cambiar</span></button>
          <button class="chip-btn danger" data-act="clear" ${empty && !hasHistory(c.id) ? 'disabled' : ''}>
            ${icon('trash', 16)}<span>Borrar</span>
          </button>
        </div>
      </div>
      ${demoBanner}
      <div class="chat-scroll" id="chat-scroll">
        <div class="thread">${body}</div>
      </div>
      ${errorBar}
      <div class="composer">
        <textarea id="chat-input" rows="1" placeholder="Escribe un mensaje a ${escapeHtml(c.name.split(' ')[0])}…"
          ${state.status === 'loading' ? 'disabled' : ''}></textarea>
        <button class="send" data-act="send" aria-label="Enviar" ${state.status === 'loading' ? 'disabled' : ''}>
          ${icon('send', 20, 2)}
        </button>
      </div>
    </section>`;
}

/* ----------------------------- Vista: About ----------------------------- */
function aboutHTML() {
  const items = CHARACTERS.map((c) =>
    `<li><b style="color:${c.accent}">${escapeHtml(c.name)}</b> — ${escapeHtml(c.role)} (${escapeHtml(c.franchise)})</li>`).join('');
  return `
    <section class="view about">
      <div class="about-card">
        <h1>Acerca del proyecto</h1>
        <p><b>Portal Chat</b> es una prueba de concepto (POC) de <b>ComicSansCon</b>: una
          Single Page Application donde los usuarios conversan con personajes ficticios
          mediante inteligencia artificial.</p>

        <h2>El personaje</h2>
        <p>Puedes chatear con tres personajes del universo de <i>Rick and Morty</i>, cada uno
          con su propia personalidad definida mediante un <i>system prompt</i> único:</p>
        <ul class="about-list">${items}</ul>

        <h2>¿Cómo está hecho?</h2>
        <ul class="about-list">
          <li><b>Vanilla JS</b>: sin frameworks, solo HTML, CSS y JavaScript.</li>
          <li><b>Routing SPA</b> con la History API (Inicio, Chat, Acerca de) y soporte de back/forward.</li>
          <li><b>Diseño mobile-first</b> responsive con media queries (móvil, tablet y escritorio).</li>
          <li><b>Google Gemini</b> integrado de forma segura mediante una <b>Vercel Serverless Function</b>
            que actúa como proxy: la API key vive solo en el servidor.</li>
          <li><b>Historial</b> de conversación mantenido en la sesión y persistido en <code>localStorage</code>.</li>
          <li><b>Tests unitarios</b> con Vitest sobre las funciones de transformación y parseo.</li>
        </ul>

        <div class="about-cta">
          <button class="btn primary" data-act="start">Empezar a chatear ${icon('arrowRight', 18)}</button>
        </div>
      </div>
    </section>`;
}

/* ----------------------------- Render ----------------------------- */
function render() {
  applyTheme();
  applyAccent();
  let view = '';
  if (state.route === 'chat') view = chatHTML();
  else if (state.route === 'about') view = aboutHTML();
  else view = homeHTML();

  app.innerHTML = navbarHTML() + `<main class="content">${view}</main>`;

  // Tras renderizar el chat: autoscroll + foco + autosize del textarea.
  if (state.route === 'chat') {
    const scroll = document.getElementById('chat-scroll');
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
    const input = document.getElementById('chat-input');
    if (input && state.status !== 'loading') {
      input.focus();
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 140) + 'px';
      });
    }
  }
}

/* ----------------------------- Acciones del chat ----------------------------- */
function loadConversation() {
  state.messages = loadHistory(state.characterId);
}

function pickCharacter(id) {
  state.characterId = id;
  savePrefs();
  loadConversation();
  applyAccent();
  render();
}

async function send(text) {
  const value = String(text || '').trim();
  if (!value || state.status === 'loading') return;

  const c = character();
  state.messages.push(createMessage(ROLE.USER, value));
  state.status = 'loading';
  state.error = '';
  render();

  try {
    const reply = await requestReply(state.messages, c);
    state.messages.push(createMessage(ROLE.ASSISTANT, reply));
    state.status = 'idle';
    state.demoMode = false;
    saveHistory(c.id, state.messages);
    render();
  } catch (err) {
    // Si el backend no existe (404) o no hay red, activamos el modo demo
    // para que el POC siga siendo mostrable. En Vercel con la key esto no ocurre.
    if (err.status === 404 || err.status === 405 || /failed to fetch|networkerror|fetch/i.test(err.message)) {
      state.demoMode = true;
      const reply = demoReply(c, value);
      state.messages.push(createMessage(ROLE.ASSISTANT, reply));
      state.status = 'idle';
      saveHistory(c.id, state.messages);
      render();
    } else {
      state.status = 'error';
      state.error = err.message || 'No se pudo obtener respuesta. Inténtalo de nuevo.';
      render();
    }
  }
}

function retry() {
  // Reintenta con el último mensaje del usuario.
  let lastUser = '';
  for (let i = state.messages.length - 1; i >= 0; i--) {
    if (state.messages[i].role === ROLE.USER) { lastUser = state.messages[i].text; break; }
  }
  state.status = 'idle';
  render();
  if (lastUser) {
    // quitamos el último user para no duplicarlo
    for (let i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].role === ROLE.USER) { state.messages.splice(i, 1); break; }
    }
    send(lastUser);
  }
}

function clearConversation() {
  const c = character();
  state.messages = [];
  state.status = 'idle';
  state.error = '';
  clearHistory(c.id);
  render();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) { /* el navegador puede bloquearlo en algunos contextos */ }
}

/* ----------------------------- Delegación de eventos ----------------------------- */
document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]');
  if (nav) { navigate(nav.getAttribute('data-nav')); return; }

  const pick = e.target.closest('[data-pick]');
  if (pick) { pickCharacter(pick.getAttribute('data-pick')); return; }

  const sendBtn = e.target.closest('[data-send]');
  if (sendBtn) { navigate('chat'); send(sendBtn.getAttribute('data-send')); return; }

  const copyBtn = e.target.closest('[data-copy]');
  if (copyBtn) {
    copyText(decodeURIComponent(copyBtn.getAttribute('data-copy')));
    const lbl = copyBtn.querySelector('span');
    if (lbl) { const o = lbl.textContent; lbl.textContent = '¡Copiado!'; setTimeout(() => { lbl.textContent = o; }, 1200); }
    return;
  }

  const act = e.target.closest('[data-act]');
  if (!act) return;
  const a = act.getAttribute('data-act');
  if (a === 'theme') toggleTheme();
  else if (a === 'menu') { state.menuOpen = !state.menuOpen; render(); }
  else if (a === 'start') { navigate('chat'); }
  else if (a === 'send') {
    const input = document.getElementById('chat-input');
    if (input) { const v = input.value; input.value = ''; send(v); }
  }
  else if (a === 'clear') clearConversation();
  else if (a === 'retry') retry();
});

// Enter para enviar (Shift+Enter = nueva línea)
document.addEventListener('keydown', (e) => {
  if (e.target && e.target.id === 'chat-input' && e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const v = e.target.value;
    e.target.value = '';
    send(v);
  }
});

/* ----------------------------- Init ----------------------------- */
function init() {
  state.route = parseRoute(location.pathname);
  loadConversation();
  // Aseguramos una entrada en el history con la ruta actual.
  history.replaceState({ route: state.route }, '', pathForRoute(state.route));
  render();
}

init();
