import { map } from "./map-init.js"; // Instância do mapa Leaflet
import { apiKey } from "./osm-service.js";
import { showNotification } from "../ui/notifications.js";
import { updateContext } from "../assistant/assistant-context/context-manager.js";
import { clearAssistantMessages } from "../assistant/assistant-messages/assistant-messages.js";
import { appendMessage } from "../assistant/assistant-messages/assistant-messages.js";
import { formatText } from "../i18n/translatePageContent.js";

import {
  animateMapToLocalizationUser,
  updateUserMarker,
  userLocation,
  getBestEffortLocation,
} from "../navigation/user-location/user-location.js";
/**
 * Módulo de Rotas do Mapa
 * Responsável por calcular, exibir e resumir rotas no mapa.
 */

/**
 * Exibe a rota entre a localização atual do usuário e o destino.
 * Se a precisão for ruim, avisa o usuário mas permite continuar.
 */
/**
 * Obtém a localização atual do usuário com limites de precisão mais realistas.
 * Versão mais tolerante para áreas turísticas remotas.
 * @returns {Promise<{ latitude: number, longitude: number, accuracy: number }>}}
 */
export async function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalização não é suportada pelo navegador."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        console.log(
          `[getCurrentPosition] Recebido: (${latitude}, ${longitude}), precisão: ${accuracy}m`
        );

        // MODIFICAÇÃO CRÍTICA: Aceitar qualquer precisão, mas informar o usuário
        // Melhor ter uma localização aproximada do que nenhuma em áreas turísticas

        // Armazenar a localização e informar a qualidade
        userLocation = { latitude, longitude, accuracy, timestamp: Date.now() };

        // Atualizar o contexto se a função estiver disponível
        try {
          if (typeof updateContext === "function") {
            updateContext({ userLocation });
          }
        } catch (contextError) {
          console.warn(
            "[getCurrentPosition] Erro ao atualizar contexto:",
            contextError
          );
        }

        // Fornecer feedback sobre a qualidade da localização
        if (accuracy > 2000) {
          console.warn(
            `[getCurrentPosition] Localização aceita apesar da baixa precisão: ${accuracy}m`
          );
          showNotification(
            `Precisão da localização limitada (${Math.round(
              accuracy
            )}m). Os resultados podem não ser precisos.`,
            "warning"
          );
        } else if (accuracy > 500) {
          console.log(
            `[getCurrentPosition] Localização com precisão moderada: ${accuracy}m`
          );
          showNotification(
            `Localização obtida com precisão de ${Math.round(accuracy)}m.`,
            "info"
          );
        } else {
          console.log(
            `[getCurrentPosition] Localização com boa precisão: ${accuracy}m`
          );
          showNotification(
            `Localização obtida com boa precisão (${Math.round(accuracy)}m).`,
            "success"
          );
        }

        resolve(userLocation);
      },
      (error) => {
        console.error("[getCurrentPosition] Erro:", error);

        // Tratar especificamente o erro de permissão negada
        if (error.code === 1) {
          // PERMISSION_DENIED
          showNotification(
            "Permissão de localização negada. Para usar esta funcionalidade, habilite o acesso à sua localização nas configurações do navegador.",
            "error"
          );
          // Enviar mensagem específica para o assistente
          try {
            if (typeof appendMessage === "function") {
              appendMessage(
                "assistant",
                "Permissão de localização negada. Para usar esta funcionalidade, habilite o acesso à sua localização nas configurações do navegador.",
                { speakMessage: true }
              );
            }
          } catch (e) {
            console.warn("[getCurrentPosition] Erro ao exibir mensagem:", e);
          }
        } else if (error.code === 3) {
          // TIMEOUT
          showNotification(
            "O tempo para obter sua localização expirou. Verifique seu sinal GPS e tente novamente.",
            "warning"
          );
        } else {
          showNotification(
            "Erro ao obter localização: " + error.message,
            "error"
          );
        }

        reject(new Error("Erro ao obter localização: " + error.message));
      },
      {
        enableHighAccuracy: true,
        timeout: 20000, // 20 segundos
        maximumAge: 60000, // Permite usar uma localização de até 1 minuto atrás
      }
    );
  });
}
/**
 * Exibe o resumo da rota dentro do assistente virtual.
 * @param {string} locationName - Nome do destino.
 * @param {number} totalDistance - Distância total da rota (em metros).
 * @param {number} totalTime - Tempo estimado da rota (em segundos).
 */
export function showRouteSummary(locationName, totalDistance, totalTime) {
  // Seleciona a área de mensagens do assistente
  const messagesArea = document.querySelector(
    "#assistant-messages .messages-area"
  );
  if (!messagesArea) {
    console.warn(
      "[showRouteSummary] Área de mensagens do assistente não encontrada."
    );
    return;
  }

  // Remove resumos de rota antigos, se houver
  const oldSummaries = messagesArea.querySelectorAll(".route-summary");
  oldSummaries.forEach((el) => el.remove());

  // Cria o resumo da rota
  const routeSummary = document.createElement("div");
  routeSummary.className = "route-summary message assistant";
  routeSummary.innerHTML = `
      <div class="route-info">
        <h3>Rota para ${locationName}</h3>
        <p>Distância total: ${(totalDistance / 1000).toFixed(2)} km</p>
        <p>Tempo estimado: ${(totalTime / 60).toFixed(2)} minutos</p>
      </div>
    `;

  // Adiciona o resumo ao assistente
  messagesArea.appendChild(routeSummary);
}
