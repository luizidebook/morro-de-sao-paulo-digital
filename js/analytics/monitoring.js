// monitoring.js – Monitoramento de eventos, erros e performance

/*  O que ele cobre:
Loga todos os eventos importantes (click, performance, erros, ações do assistente, etc.).
Gera logs locais em tempo real no console.
Está pronto para integrar com serviços externos como:
Sentry: rastreamento de erros.
LogRocket: gravação da sessão do usuário.
DataDog, Firebase, etc.*/

let logBuffer = [];
let monitorInterval = null;

/**
 * Inicia o sistema de monitoramento contínuo.
 * Pode ser adaptado para Sentry, LogRocket ou outro serviço.
 */
export function trackPerformance() {
  // Exemplo básico de monitoramento de FPS e tempo de resposta
  monitorInterval = setInterval(() => {
    const memory = performance.memory || {};
    const time = performance.now();

    logEvent("performance", {
      memoryUsedMB: (memory.usedJSHeapSize || 0) / 1048576,
      loadTimeMs: Math.round(time),
    });
  }, 15000); // A cada 15 segundos
}

/**
 * Registra eventos personalizados para análise posterior.
 * @param {string} type - Tipo do evento (ex: 'click', 'erro', 'performance')
 * @param {any} data - Dados adicionais do evento
 */
export function logEvent(type, data = {}) {
  const log = {
    timestamp: new Date().toISOString(),
    type,
    data,
  };

  logBuffer.push(log);
  console.log("[LOG]", log);

  // Futuro: enviar para servidor ou serviço externo
  // sendLogToServer(log);
}

/**
 * (Opcional) Envia os logs para um servidor remoto ou serviço de monitoramento.
 * @param {object} log
 */
function sendLogToServer(log) {
  fetch("/api/logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(log),
  }).catch((err) => {
    console.warn("[LOG] Falha ao enviar log para o servidor:", err);
  });
}

/**
 * Encerra o monitoramento automático.
 */
export function stopMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}
