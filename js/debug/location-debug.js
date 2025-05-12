import {
  getLocationSystemReport,
  getLocationSystemState,
} from "../navigation/navigationUserLocation/enhanced-location-manager.js";

import {
  getCurrentOrPredictedPosition,
  evaluatePredictionAccuracy,
  detectTurnTrend,
} from "../navigation/navigationUserLocation/movement-predictor.js";

let debugPanel;
let isDebugEnabled = false;

/**
 * Inicializa o painel de debug de localização
 */
export function initLocationDebugPanel() {
  // Criar painel de debug
  debugPanel = document.createElement("div");
  debugPanel.id = "location-debug-panel";
  debugPanel.className = "debug-panel";
  debugPanel.style.display = "none";

  // Adicionar ao DOM
  document.body.appendChild(debugPanel);

  // Adicionar tecla de atalho (Ctrl+Shift+D)
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey && e.shiftKey && e.key === "D") {
      toggleDebugPanel();
    }
  });
}

/**
 * Alterna a visibilidade do painel de debug
 */
function toggleDebugPanel() {
  isDebugEnabled = !isDebugEnabled;

  if (isDebugEnabled) {
    debugPanel.style.display = "block";
    startDebugUpdates();
  } else {
    debugPanel.style.display = "none";
    stopDebugUpdates();
  }
}

let updateInterval;

/**
 * Inicia atualizações periódicas do painel de debug
 */
function startDebugUpdates() {
  // Atualização inicial
  updateDebugPanel();

  // Configurar atualizações periódicas
  updateInterval = setInterval(updateDebugPanel, 1000);
}

/**
 * Interrompe atualizações do painel de debug
 */
function stopDebugUpdates() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
}

/**
 * Atualiza o conteúdo do painel de debug
 */
function updateDebugPanel() {
  if (!isDebugEnabled || !debugPanel) return;

  // Obter relatórios
  const systemState = getLocationSystemState();
  const predictedPosition = getCurrentOrPredictedPosition(1000);
  const turnTrend = detectTurnTrend();

  // Formatar HTML
  let html = `
    <h3>Sistema de Localização</h3>
    <table>
      <tr>
        <td>Estado:</td>
        <td>${systemState.signalQuality || "desconhecido"}</td>
      </tr>
      <tr>
        <td>Precisão:</td>
        <td>${
          systemState.currentLocation
            ? systemState.currentLocation.accuracy.toFixed(1) + "m"
            : "N/A"
        }</td>
      </tr>
      <tr>
        <td>Movimento:</td>
        <td>${
          systemState.isMoving
            ? systemState.movementPattern +
              " (" +
              (systemState.currentSpeed * 3.6).toFixed(1) +
              " km/h)"
            : "parado"
        }</td>
      </tr>
      <tr>
        <td>Estratégia:</td>
        <td>${systemState.strategy || "padrão"}</td>
      </tr>
    </table>
    
    <h3>Predição</h3>
    <table>
      <tr>
        <td>Disponível:</td>
        <td>${predictedPosition ? "Sim" : "Não"}</td>
      </tr>`;

  if (predictedPosition && predictedPosition.confidence) {
    html += `
      <tr>
        <td>Confiança:</td>
        <td>${(predictedPosition.confidence * 100).toFixed(0)}%</td>
      </tr>`;
  }

  if (turnTrend) {
    html += `
      <tr>
        <td>Curva:</td>
        <td>${turnTrend.direction === "left" ? "← Esquerda" : "→ Direita"} (${(
      turnTrend.intensity * 100
    ).toFixed(0)}%)</td>
      </tr>`;
  }

  html += `</table>`;

  // Atualizar painel
  debugPanel.innerHTML = html;
}

// Inicializar automaticamente em ambiente de desenvolvimento
if (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
) {
  document.addEventListener("DOMContentLoaded", initLocationDebugPanel);
}
