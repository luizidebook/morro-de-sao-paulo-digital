import { ANALYTICS_CONFIG } from "./config.js";

// analytics.js - Monitoramento anônimo de uso para melhorias

let analyticsEnabled = false;

/**
 * Inicializa o sistema de analytics com consentimento do usuário
 */
export function initAnalytics() {
  // Verifica se o usuário já deu consentimento
  const consent = localStorage.getItem("analytics_consent");

  if (consent === null) {
    // Mostra banner de consentimento
    showConsentBanner();
  } else if (consent === "true") {
    enableAnalytics();
  }
}

/**
 * Mostra banner solicitando consentimento para analytics
 */
function showConsentBanner() {
  const banner = document.createElement("div");
  banner.className = "consent-banner";
  banner.innerHTML = `
    <div class="consent-content">
      <p>Usamos cookies para melhorar sua experiência. Podemos coletar dados anônimos de uso para aprimorar o app?</p>
      <div class="consent-buttons">
        <button id="accept-consent">Aceitar</button>
        <button id="reject-consent">Recusar</button>
      </div>
    </div>
  `;

  document.body.appendChild(banner);

  // Configura eventos dos botões
  document.getElementById("accept-consent").addEventListener("click", () => {
    localStorage.setItem("analytics_consent", "true");
    enableAnalytics();
    banner.remove();
  });

  document.getElementById("reject-consent").addEventListener("click", () => {
    localStorage.setItem("analytics_consent", "false");
    banner.remove();
  });
}

/**
 * Ativa a coleta de dados analíticos básicos
 */
function enableAnalytics() {
  analyticsEnabled = true;

  // Implementação básica de rastreamento de eventos
  window.trackEvent = function (category, action, label) {
    if (!analyticsEnabled) return;

    try {
      // Log local do evento
      console.log(`[Analytics] ${category}: ${action} - ${label}`);

      const payload = {
        category,
        action,
        label,
        timestamp: new Date().toISOString(),
        session: getSessionId(),
        url: window.location.pathname,
        userAgent: navigator.userAgent,
      };

      // Validate payload before sending
      validatePayload(payload);

      // Store event locally first
      const storedEvents = JSON.parse(
        localStorage.getItem("pending_analytics") || "[]"
      );
      storedEvents.push(payload);

      // Try to send to API
      sendAnalyticsData(payload).catch((error) => {
        logAnalyticsError("Failed to send analytics", error);
        localStorage.setItem("pending_analytics", JSON.stringify(storedEvents));
      });
    } catch (error) {
      logAnalyticsError("Error in trackEvent", error);
    }
  };

  // Registra visualização de página
  trackEvent("app", "pageview", window.location.pathname);

  // Tenta reenviar eventos pendentes
  retryPendingEvents();
}

/**
 * Envia dados para a API de analytics com retry
 */
async function sendAnalyticsData(
  payload,
  retries = ANALYTICS_CONFIG.RETRY_ATTEMPTS
) {
  const API_URL =
    window.location.hostname === "localhost"
      ? ANALYTICS_CONFIG.API_URL.development
      : ANALYTICS_CONFIG.API_URL.production;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Version": ANALYTICS_CONFIG.VERSION,
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });

      if (!response.ok) {
        throw new Error(`Analytics API error: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.warn(`[Analytics] Tentativa ${i + 1}/${retries} falhou:`, error);

      // On last retry, throw error
      if (i === retries - 1) throw error;

      // Wait with exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, ANALYTICS_CONFIG.RETRY_DELAY * Math.pow(2, i))
      );
    }
  }
}

/**
 * Tenta reenviar eventos pendentes
 */
async function retryPendingEvents() {
  const pendingEvents = JSON.parse(
    localStorage.getItem("pending_analytics") || "[]"
  );
  if (pendingEvents.length === 0) return;

  console.log(
    `[Analytics] Tentando reenviar ${pendingEvents.length} eventos pendentes`
  );

  const successfulEvents = [];

  for (const event of pendingEvents) {
    try {
      await sendAnalyticsData(event);
      successfulEvents.push(event);
    } catch (error) {
      console.error("[Analytics] Falha ao reenviar evento:", error);
      break;
    }
  }

  // Remove eventos enviados com sucesso
  const remainingEvents = pendingEvents.filter(
    (event) => !successfulEvents.includes(event)
  );

  localStorage.setItem("pending_analytics", JSON.stringify(remainingEvents));
}

/**
 * Gera ou recupera ID de sessão anônimo
 */
function getSessionId() {
  let sessionId = sessionStorage.getItem("session_id");
  if (!sessionId) {
    sessionId = "session_" + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem("session_id", sessionId);
  }
  return sessionId;
}

/**
 * Logs analytics errors with proper formatting
 */
function logAnalyticsError(message, error) {
  console.error(`[Analytics Error] ${message}`, error?.message || error);
}

/**
 * Validates analytics payload
 */
function validatePayload(payload) {
  const required = ["category", "action", "label", "timestamp", "session"];
  const missing = required.filter((field) => !payload[field]);

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }

  return true;
}
