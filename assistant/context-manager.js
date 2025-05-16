/**
 * context-manager.js
 * Gerencia o contexto da conversa do assistente para respostas inteligentes e contextuais.
 * Permite histórico, rastreamento de intenções, categorias, locais, preferências e contexto expandido.
 */

let context = {
  lastPlace: null, // Último local consultado
  lastCategory: null, // Última categoria consultada
  lastIntent: null, // Última intenção detectada ("detalhes", "fotos", "rota", etc)
  history: [], // Histórico de interações [{input, response, timestamp}]
  preferences: {}, // Preferências do usuário (ex: idioma, favoritos)
  sessionStart: Date.now(), // Timestamp do início da sessão
  lastOptions: [], // Últimas opções sugeridas ao usuário
  fallbackCount: 0, // Quantas vezes caiu na resposta padrão
  awaiting: null, // O que o assistente espera do usuário (ex: "selecionar_local")
};

// Carregar do localStorage ao iniciar
function loadContext() {
  const saved = localStorage.getItem("assistantContext");
  if (saved) {
    context = JSON.parse(saved);
  }
}
loadContext();

// Salvar sempre que atualizar
function saveContext() {
  localStorage.setItem("assistantContext", JSON.stringify(context));
}

/**
 * Retorna uma cópia do contexto atual.
 */
export function getContext() {
  return { ...context };
}

/**
 * Atualiza o contexto com novos valores.
 * @param {object} updates - Propriedades a atualizar.
 */
export function updateContext(updates) {
  Object.assign(context, updates);
  saveContext();
}

/**
 * Adiciona uma entrada ao histórico da conversa.
 * @param {object} entry - {input, response, [timestamp]}
 */
export function addToHistory(entry) {
  context.history.push({
    ...entry,
    timestamp: entry.timestamp || Date.now(),
  });
  saveContext();
}

/**
 * Limpa o contexto para uma nova sessão/conversa.
 */
export function clearContext() {
  context.lastPlace = null;
  context.lastCategory = null;
  context.lastIntent = null;
  context.history = [];
  context.preferences = {};
  context.sessionStart = Date.now();
  context.lastOptions = [];
  context.fallbackCount = 0;
  context.awaiting = null;
  saveContext();
}

/**
 * Salva uma preferência do usuário.
 * @param {string} key
 * @param {any} value
 */
export function setPreference(key, value) {
  context.preferences[key] = value;
  saveContext();
}

/**
 * Obtém uma preferência do usuário.
 * @param {string} key
 * @returns {any}
 */
export function getPreference(key) {
  return context.preferences[key];
}

/**
 * Marca que o assistente está aguardando uma resposta específica do usuário.
 * @param {string} type - Ex: "selecionar_local", "confirmar_acao"
 * @param {object} [data] - Dados adicionais do contexto de espera
 */
export function setAwaiting(type, data = {}) {
  context.awaiting = { type, ...data };
  saveContext();
}

/**
 * Limpa o estado de espera do assistente.
 */
export function clearAwaiting() {
  context.awaiting = null;
  saveContext();
}

/**
 * Retorna o estado de espera atual.
 * @returns {object|null}
 */
export function getAwaiting() {
  return context.awaiting;
}

/**
 * Incrementa o contador de respostas padrão/fallback.
 */
export function incrementFallback() {
  context.fallbackCount += 1;
  saveContext();
}

/**
 * Reseta o contador de respostas padrão/fallback.
 */
export function resetFallback() {
  context.fallbackCount = 0;
  saveContext();
}

/**
 * Salva as últimas opções sugeridas ao usuário.
 * @param {string[]} options
 */
export function setLastOptions(options) {
  context.lastOptions = Array.isArray(options) ? [...options] : [];
  saveContext();
}

/**
 * Obtém as últimas opções sugeridas.
 * @returns {string[]}
 */
export function getLastOptions() {
  return context.lastOptions;
}

/**
 * Retorna o histórico completo da conversa.
 * @returns {Array}
 */
export function getHistory() {
  return [...context.history];
}

/**
 * Retorna o último input do usuário.
 * @returns {string|null}
 */
export function getLastUserInput() {
  if (!context.history.length) return null;
  for (let i = context.history.length - 1; i >= 0; i--) {
    if (context.history[i].input) return context.history[i].input;
  }
  return null;
}

/**
 * Retorna a última resposta do assistente.
 * @returns {string|null}
 */
export function getLastAssistantResponse() {
  if (!context.history.length) return null;
  for (let i = context.history.length - 1; i >= 0; i--) {
    if (context.history[i].response) return context.history[i].response;
  }
  return null;
}

/**
 * Adiciona um local aos favoritos do usuário.
 * @param {string} placeName
 */
export function addFavorite(placeName) {
  if (!context.preferences.favorites) context.preferences.favorites = [];
  if (!context.preferences.favorites.includes(placeName))
    context.preferences.favorites.push(placeName);
  saveContext();
}

/**
 * Remove um local dos favoritos do usuário.
 * @param {string} placeName
 */
export function removeFavorite(placeName) {
  if (!context.preferences.favorites) return;
  context.preferences.favorites = context.preferences.favorites.filter(
    (fav) => fav !== placeName
  );
  saveContext();
}

/**
 * Retorna os favoritos do usuário.
 * @returns {string[]}
 */
export function getFavorites() {
  return context.preferences.favorites || [];
}
