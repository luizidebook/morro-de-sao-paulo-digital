import { showNotification } from "../../utils/notifications.js";
import { showRoute } from "../../map/mapManager.js";
import {
  getContext,
  updateContext,
} from "../../assistant/assistant-context/context-manager.js";
import {
  appendMessage,
  messages,
} from "../../assistant/assistant-messages/assistant-messages.js";

import { isValidCoordinate } from "../navigationUtils/distanceCalculator.js";
import { apiKey } from "../../map/mapManager.js";
import { map } from "../../map/map-controls.js";
import { navigationState } from "../navigationState/navigationStateManager.js";
import { calculateDistance } from "../navigationUtils/distanceCalculator.js";
import {
  recalculationInProgress,
  isRecalculationInProgress, // Opcionalmente, pode importar a função também
} from "../navigationInstructions/routeProcessor.js";
import {
  checkDestinationArrival,
  updateRealTimeNavigation,
  shouldRecalculateRoute,
  notifyDeviation,
  recalculateRoute,
} from "../navigationController/navigationController.js";
import { setMapRotation } from "../navigationController/navigationControls.js";
export let userLocation = {};
export let trackingActive = false;
export let watchId = null;
export let userMarker;
export let positionWatcherId = null; // ID do watchPosition para monitoramento contínuo
export let userAccuracyCircle;

// Verificar se os estilos CSS estão presentes e injetá-los se necessário
function ensureNavigationStyles() {
  if (!document.getElementById("navigation-marker-styles")) {
    const style = document.createElement("style");
    style.id = "navigation-marker-styles";
    style.textContent = `
      .user-marker-container {
        width: 24px !important;
        height: 24px !important;
      }
      
      .user-location-arrow {
        position: relative;
        width: 16px;
        height: 16px;
        background-color: #e53e3e;  /* Vermelho */
        border-radius: 50%;
        box-shadow: 0 0 0 2px white;
        display: flex;
        justify-content: center;
        align-items: center;
        transform-origin: center;
        transition: transform 0.3s ease;
      }
      
      .arrow-head {
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-bottom: 12px solid white;
        position: absolute;
        top: -6px;
      }
      
      .user-location-pulse {
        position: absolute;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background-color: rgba(229, 62, 62, 0.3);  /* Vermelho transparente */
        animation: pulse 2s infinite;
        pointer-events: none;
      }
      
      @keyframes pulse {
        0% { transform: scale(0.5); opacity: 1; }
        100% { transform: scale(2); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
    console.log("[user-location] Estilos de navegação injetados");
  }
}

// Modificar o início do arquivo para garantir disponibilidade global das funções críticas
(function initializeGlobalNavigationFunctions() {
  // Definir função globalmente para outros módulos usarem
  window.updateUserMarker = updateUserMarker;
  window.createUserMarker = createUserMarker;
  window.createAccuracyCircle = createAccuracyCircle;
  window.calculateBearing = calculateBearing;
})();

/**
 * Obtém a localização atual do usuário uma única vez e inicia o tracking contínuo.
 * Sempre orienta o usuário sobre o que está acontecendo.
 * Versão melhorada com maior tolerância a precisão e melhor feedback.
 */
export async function getCurrentPosition(
  options = {
    enableHighAccuracy: true,
    timeout: 20000, // Aumentado para 20 segundos
    maximumAge: 5000,
    minAccuracy: 3000, // Novo: aceita precisão de até 3km
  }
) {
  appendMessage("assistant", messages.userLocation.locating(), {
    speakMessage: true,
  });

  if (!("geolocation" in navigator)) {
    appendMessage("assistant", messages.userLocation.permissionNeeded(), {
      speakMessage: true,
    });
    return null;
  }

  try {
    // Adiciona indicador visual de carregamento
    const loadingIndicator = document.createElement("div");
    loadingIndicator.className = "location-loading-indicator";
    loadingIndicator.innerHTML =
      '<i class="fas fa-location-arrow fa-spin"></i> Obtendo localização...';
    document.body.appendChild(loadingIndicator);

    // Inicia o relógio para medição de tempo de resposta
    const startTime = Date.now();

    const position = await new Promise((resolve, reject) => {
      const geolocationTimeout = setTimeout(() => {
        reject(new Error("Tempo de espera para localização excedido."));
      }, options.timeout);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(geolocationTimeout);
          resolve(pos);
        },
        (err) => {
          clearTimeout(geolocationTimeout);
          reject(err);
        },
        {
          enableHighAccuracy: options.enableHighAccuracy,
          timeout: options.timeout * 0.9, // 90% do timeout para garantir que nosso próprio timeout dispare primeiro
          maximumAge: options.maximumAge,
        }
      );
    });

    // Remove o indicador visual
    if (document.body.contains(loadingIndicator)) {
      document.body.removeChild(loadingIndicator);
    }

    const { latitude, longitude, accuracy } = position.coords;
    const elapsedTime = Date.now() - startTime;
    markLocationAsShared();

    // Log mais detalhado para fins de diagnóstico
    console.log(
      `[getCurrentPosition] Localização obtida em ${elapsedTime}ms:`,
      {
        lat: latitude,
        lon: longitude,
        accuracy: accuracy,
        timestamp: new Date().toISOString(),
      }
    );

    // Atualizar objeto de localização e contexto
    userLocation = {
      latitude,
      longitude,
      accuracy,
      timestamp: Date.now(),
      responseTime: elapsedTime,
    };
    updateContext({ userLocation });

    // Feedback visual mais preciso com base na qualidade da localização
    let qualityMessage = "";
    let messageType = "success";

    if (accuracy <= 100) {
      qualityMessage = `Localização obtida com excelente precisão (${Math.round(
        accuracy
      )}m)!`;
    } else if (accuracy <= 500) {
      qualityMessage = `Localização obtida com boa precisão (${Math.round(
        accuracy
      )}m).`;
    } else if (accuracy <= 1500) {
      qualityMessage = `Localização obtida com precisão moderada (${Math.round(
        accuracy
      )}m).`;
      messageType = "info";
    } else {
      qualityMessage = `Localização obtida com precisão limitada (${Math.round(
        accuracy
      )}m). Os resultados podem não ser exatos.`;
      messageType = "warning";
    }

    appendMessage("assistant", qualityMessage, { speakMessage: true });
    showNotification(qualityMessage, messageType);

    // Inicia o rastreamento contínuo
    startUserTracking();

    // Opcional: centraliza o mapa na localização do usuário
    try {
      if (typeof animateMapToLocalizationUser === "function") {
        animateMapToLocalizationUser(latitude, longitude);
      }

      if (typeof updateUserMarker === "function") {
        updateUserMarker(latitude, longitude, 0, accuracy);
      }
    } catch (mapError) {
      console.warn("[getCurrentPosition] Erro ao centralizar mapa:", mapError);
    }

    // Verificar se há uma rota pendente para processar automaticamente
    try {
      const ctx = typeof getContext === "function" ? getContext() : {};
      if (ctx && ctx.pendingRoute && typeof showRoute === "function") {
        // Pequeno atraso para permitir que a interface atualize primeiro
        setTimeout(() => {
          showRoute(ctx.pendingRoute);
        }, 500);
      }
    } catch (contextError) {
      console.warn(
        "[getCurrentPosition] Erro ao processar contexto:",
        contextError
      );
    }

    return userLocation;
  } catch (error) {
    console.error("[getCurrentPosition] Erro:", error);

    // Remove o indicador visual se ainda existir
    const loadingIndicator = document.querySelector(
      ".location-loading-indicator"
    );
    if (loadingIndicator) {
      document.body.removeChild(loadingIndicator);
    }

    // Mensagem personalizada com base no tipo de erro
    let message = messages.userLocation.error();
    let additionalMessage = "";

    if (error.code === 1) {
      // PERMISSION_DENIED
      message = messages.userLocation.permissionDenied();
      additionalMessage =
        "Para usar esta funcionalidade, você precisa permitir o acesso à sua localização nas configurações do navegador.";
    } else if (error.code === 2) {
      // POSITION_UNAVAILABLE
      additionalMessage =
        "O GPS não conseguiu determinar sua localização. Tente em um local com melhor sinal de GPS.";
    } else if (error.code === 3) {
      // TIMEOUT
      additionalMessage =
        "Tempo esgotado para obter localização. Tente novamente em um local com melhor sinal de GPS.";
    }

    appendMessage("assistant", message, { speakMessage: true });

    if (additionalMessage) {
      appendMessage("assistant", additionalMessage, { speakMessage: true });
    }

    appendMessage(
      "assistant",
      "Tente ir para um local aberto ou próximo de uma rua e clique novamente em 'Como chegar'.",
      { speakMessage: true }
    );

    showNotification("Não foi possível obter sua localização", "error");
    updateContext({ userLocation: null });
    return null;
  }
}

export function startPositionTracking() {
  // Limpar watch position anterior se existir
  if (positionWatcherId !== null) {
    navigator.geolocation.clearWatch(positionWatcherId);
  }

  // Inicializar userLocation com valores padrão se não existir
  if (!window.userLocation) {
    window.userLocation = {
      latitude: null,
      longitude: null,
      accuracy: 1000,
      heading: 0,
      speed: 0,
      timestamp: Date.now(),
    };
    userLocation = { ...window.userLocation };
  }

  // Criar um sistema de retry com tempos diferentes
  const setupWatchPosition = (attempt = 0) => {
    const options = {
      enableHighAccuracy: attempt < 2, // Reduzir precisão após 2 tentativas
      timeout: Math.min(20000, 10000 + attempt * 5000), // Aumentar timeout gradualmente
      maximumAge: attempt > 1 ? 10000 : 3000, // Permitir posições mais antigas nas tentativas posteriores
    };

    try {
      console.log(
        `[startPositionTracking] Tentativa ${attempt + 1} com opções:`,
        options
      );

      positionWatcherId = navigator.geolocation.watchPosition(
        // Callback de sucesso
        (position) => {
          const { latitude, longitude, accuracy, heading, speed } =
            position.coords;

          // Atualizar dados do usuário
          const userPos = {
            latitude,
            longitude,
            accuracy,
            heading: heading || 0,
            speed: speed || 0,
            timestamp: Date.now(),
          };

          // Armazenar para uso em caso de falha futura
          window.lastValidPosition = { ...userPos };

          // Atualizar o objeto global userLocation
          window.userLocation = { ...userPos };
          userLocation = { ...userPos };

          // MODIFICAÇÃO: Atualizar o marcador do usuário considerando modo de navegação
          if (window.navigationState && window.navigationState.isActive) {
            if (window.lastRoutePoints && window.lastRoutePoints.length > 0) {
              updateUserMarkerDirection(
                { latitude, longitude, accuracy },
                window.lastRoutePoints
              );
            } else if (
              window.navigationState.instructions &&
              window.navigationState.instructions.length > 0
            ) {
              const instructions = window.navigationState.instructions;
              const currentIndex = window.navigationState.currentStepIndex || 0;
              const segmentDirection = getSegmentDirection(
                currentIndex,
                instructions
              );

              if (segmentDirection !== null) {
                updateUserMarker(
                  latitude,
                  longitude,
                  segmentDirection,
                  accuracy
                );
              } else if (
                window.navigationState.calculatedBearing !== undefined
              ) {
                updateUserMarker(
                  latitude,
                  longitude,
                  window.navigationState.calculatedBearing,
                  accuracy
                );
              } else {
                // Fallback sem rotação
                updateUserMarker(latitude, longitude, null, accuracy);
              }
            } else {
              const currentMarker = window.userMarker;
              const currentHeading =
                currentMarker && currentMarker.options
                  ? currentMarker.options.rotationAngle
                  : 0;
              updateUserMarker(latitude, longitude, currentHeading, accuracy);
            }

            // Navegação ativa - verificar chegada e atualizar em tempo real
            if (typeof checkDestinationArrival === "function") {
              checkDestinationArrival(latitude, longitude);
            }

            if (typeof updateRealTimeNavigation === "function") {
              updateRealTimeNavigation(userPos);
            }

            // Verificar desvio da rota
            if (
              typeof shouldRecalculateRoute === "function" &&
              shouldRecalculateRoute(latitude, longitude)
            ) {
              if (!window.recalculationInProgress) {
                if (typeof notifyDeviation === "function") {
                  notifyDeviation(true);
                }

                if (typeof recalculateRoute === "function") {
                  recalculateRoute(
                    {
                      latitude,
                      longitude,
                      accuracy,
                    },
                    {
                      showNotifications: true,
                      forceRecalculation: false,
                    }
                  );
                }
              }
            }
          } else {
            // Sem navegação ativa - usar heading normal
            updateUserMarker(latitude, longitude, heading, accuracy);

            // Atualiza rotação do mapa se necessário
            if (
              heading !== null &&
              heading !== undefined &&
              window.navigationState &&
              window.navigationState.isRotationEnabled
            ) {
              if (typeof setMapRotation === "function") {
                setMapRotation(heading);
              }
            }
          }
        },

        // Callback de erro
        (error) => {
          console.warn(
            `[startPositionTracking] Erro na tentativa ${attempt + 1}:`,
            error
          );

          // Notificar apenas no primeiro erro
          if (attempt === 0) {
            const errorMessages = {
              1: "Permissão de localização negada. Verifique as configurações do navegador.",
              2: "Sua localização não está disponível no momento.",
              3: "Tempo esgotado ao obter sua localização.",
            };

            const message =
              errorMessages[error.code] || "Erro ao obter sua localização.";

            if (typeof showNotification === "function") {
              showNotification(message, "warning");
            }
          }

          // Tentar usar a última posição conhecida
          if (window.lastValidPosition) {
            console.log(
              "[startPositionTracking] Usando última posição conhecida como fallback"
            );
            updateUserMarker(
              window.lastValidPosition.latitude,
              window.lastValidPosition.longitude,
              window.lastValidPosition.heading,
              window.lastValidPosition.accuracy
            );
          }

          // Tentar novamente com diferentes opções
          if (attempt < 3) {
            setTimeout(() => {
              if (positionWatcherId) {
                navigator.geolocation.clearWatch(positionWatcherId);
              }
              setupWatchPosition(attempt + 1);
            }, 2000);
          } else {
            console.error(
              "[startPositionTracking] Falha após múltiplas tentativas"
            );
          }
        },
        options
      );

      console.log(
        `[startPositionTracking] Monitoramento iniciado (tentativa ${
          attempt + 1
        })`
      );
    } catch (error) {
      console.error(
        "[startPositionTracking] Erro ao configurar watchPosition:",
        error
      );
    }
  };

  // Iniciar o sistema de tentativas
  setupWatchPosition();

  // Registrar estado
  trackingActive = true;
  return positionWatcherId;
}

/**
 * Ativa o rastreamento contínuo do usuário.
 */
export function startUserTracking() {
  trackingActive = true;
  startPositionTracking();
}
/**
 * Para o rastreamento contínuo da posição do usuário.
 * Esta função cancela o watchPosition atual e limpa recursos associados.
 * @returns {boolean} - Se o rastreamento foi parado com sucesso
 */
export function stopPositionTracking() {
  console.log("[user-location] Parando rastreamento de posição");

  try {
    // Limpar o watchId atual se existir
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
      console.log("[user-location] Watch de posição cancelado");
    }

    // Atualizar estado de rastreamento
    trackingActive = false;

    // Atualizar contexto se a função existir
    try {
      if (typeof updateContext === "function") {
        updateContext({ isTrackingActive: false });
      }
    } catch (contextError) {
      console.warn(
        "[stopPositionTracking] Erro ao atualizar contexto:",
        contextError
      );
    }

    // Opcional: Mostrar notificação
    if (typeof showNotification === "function") {
      showNotification("Rastreamento de posição desativado", "info");
    }

    return true;
  } catch (error) {
    console.error("[user-location] Erro ao parar rastreamento:", error);
    return false;
  }
}
/**
 * Atualiza a visualização do mapa com a localização do usuário.
 */
export function updateMapWithUserLocation(zoomLevel = 18) {
  if (!userLocation || !map) {
    showNotification("Localização ou mapa indisponível.", "warning");
    return;
  }
  map.setView([userLocation.latitude, userLocation.longitude], zoomLevel);
}

/**
 * Detecta movimento brusco do dispositivo.
 */
export function detectMotion() {
  if ("DeviceMotionEvent" in window) {
    window.addEventListener("devicemotion", (event) => {
      const acc = event.acceleration;
      if (acc.x > 5 || acc.y > 5 || acc.z > 5) {
        showNotification("Movimento brusco detectado!", "info");
      }
    });
  }
}

/**
 * Solicita permissão de GPS e rastreia a posição do usuário em tempo real.
 * Se não conseguir localização, orienta o usuário e tenta novamente.
 */
/**
 * Solicita permissão de GPS e rastreia a posição do usuário em tempo real.
 * Versão melhorada com suporte a fallback e feedback visual.
 */
export async function requestAndTrackUserLocation(
  onSuccess = null,
  onError = null,
  options = {}
) {
  const opts = {
    desiredAccuracy: options.desiredAccuracy || 3000, // 3km é aceitável para turismo
    fallbackAccuracy: options.fallbackAccuracy || 5000, // 5km se necessário
    timeout: options.timeout || 30000, // 30 segundos
    showNotifications: options.showNotifications !== false,
    centerMap: options.centerMap !== false,
    maxRetries: options.maxRetries || 2,
  };

  appendMessage("assistant", messages.userLocation.locating(), {
    speakMessage: true,
  });

  let location = null;
  let attempts = 0;

  while (attempts < opts.maxRetries + 1 && !location) {
    try {
      if (attempts > 0) {
        appendMessage(
          "assistant",
          `Tentando novamente obter sua localização (${attempts}/${opts.maxRetries})...`,
          { speakMessage: true }
        );
      }

      location = await getCurrentPosition({
        enableHighAccuracy: true,
        timeout: opts.timeout / (attempts + 1), // Reduz o timeout a cada tentativa
        maximumAge: 0,
        minAccuracy: opts.desiredAccuracy * (attempts + 1), // Aumenta a tolerância a cada tentativa
      });

      if (location) break;
    } catch (e) {
      console.warn(
        `[requestAndTrackUserLocation] Tentativa ${attempts + 1} falhou:`,
        e
      );
    }

    attempts++;
  }

  if (!location) {
    appendMessage(
      "assistant",
      "Não consegui sua localização após várias tentativas. Por favor, verifique se o GPS está ativado e tente novamente.",
      { speakMessage: true }
    );

    if (typeof onError === "function") {
      onError(
        new Error(
          "Não foi possível obter localização após múltiplas tentativas"
        )
      );
    }

    updateContext({ userLocation: null });
    return null;
  }

  // Iniciar rastreamento contínuo
  startUserTracking();

  // Se houver rota pendente, traça automaticamente
  try {
    const ctx = typeof getContext === "function" ? getContext() : {};
    if (ctx.pendingRoute && typeof showRoute === "function") {
      appendMessage(
        "assistant",
        messages.navigation.creating(ctx.pendingRoute.name),
        { speakMessage: true }
      );

      if (typeof onSuccess === "function") {
        onSuccess(location);
      }

      await showRoute(ctx.pendingRoute);

      if (typeof updateContext === "function") {
        updateContext({ pendingRoute: null });
      }
    } else if (typeof onSuccess === "function") {
      onSuccess(location);
    }
  } catch (e) {
    console.error("[requestAndTrackUserLocation] Erro:", e);

    appendMessage("assistant", messages.navigation.routeNotFound(), {
      speakMessage: true,
    });

    if (typeof onError === "function") {
      onError(e);
    }
  }

  return location;
}

/**
 * Fallback para navegação por sensores se o GPS falhar.
 */
export function fallbackToSensorNavigation() {
  appendMessage(
    "assistant",
    "Não foi possível obter sua localização via GPS. Tentando navegação por sensores do dispositivo.",
    { speakMessage: true }
  );
  // Aqui você pode implementar lógica alternativa, como usar aproximação por Wi-Fi, IP, etc.
}

/**
 * Centraliza o mapa na localização do usuário e atualiza o marcador.
 * @param {Object} [customMap] - Instância do mapa (opcional, padrão: global)
 */
export function setupGeolocation(customMap) {
  const targetMap = customMap || map;
  if (!navigator.geolocation) {
    alert("Seu navegador não suporta geolocalização.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      userLocation = { latitude, longitude };

      console.log(
        `[setupGeolocation] Localização do usuário atualizada: (${latitude}, ${longitude})`
      );

      // Centraliza o mapa na localização do usuário
      if (targetMap) {
        targetMap.flyTo([latitude, longitude], 14);
      }

      animateMapToLocalizationUser(latitude, longitude);

      // Atualiza o marcador do usuário
      if (typeof updateUserMarker === "function") {
        updateUserMarker(
          latitude,
          longitude,
          position.coords.heading || 0,
          position.coords.accuracy || 15
        );
      }
    },
    (error) => {
      console.error("[setupGeolocation] Erro ao obter localização:", error);
      alert("Não foi possível acessar sua localização.");
    }
  );
}

/**
 * Verifica se o usuário já compartilhou localização anteriormente
 * @returns {boolean} true se o usuário já compartilhou, false caso contrário
 */
export function hasSharedLocation() {
  // Verificar no localStorage
  const hasShared = localStorage.getItem("location-permission-granted");
  // Verificar se temos dados de localização atual
  const hasCurrentLocation =
    userLocation && userLocation.latitude && userLocation.longitude;

  return hasShared === "true" || hasCurrentLocation;
}

/**
 * Registra que o usuário compartilhou sua localização
 */
export function markLocationAsShared() {
  localStorage.setItem("location-permission-granted", "true");
  console.log(
    "[markLocationAsShared] Permissão de localização registrada no localStorage"
  );

  // Atualizar contexto se a função existir
  try {
    if (typeof updateContext === "function") {
      updateContext({ hasSharedLocation: true });
    }
  } catch (e) {
    console.warn("[markLocationAsShared] Erro ao atualizar contexto:", e);
  }
}

/**
 * Obtém a melhor localização possível dentro do tempo especificado.
 * Versão otimizada e com cache.
 * @param {number} maxWaitMs - Tempo máximo de espera
 * @param {number} desiredAccuracy - Precisão desejada em metros
 * @returns {Promise<{ latitude, longitude, accuracy }>}}
 */
export function getBestEffortLocation(
  maxWaitMs = 15000, // Reduzido para 15 segundos
  desiredAccuracy = 200 // Mais permissivo: 200m
) {
  // Verificar cache recente (últimos 60 segundos)
  if (
    userLocation &&
    userLocation.timestamp &&
    Date.now() - userLocation.timestamp < 60000
  ) {
    console.log(
      "[getBestEffortLocation] Usando localização em cache:",
      userLocation
    );
    return Promise.resolve(userLocation);
  }

  return new Promise((resolve, reject) => {
    let bestLocation = null;
    let bestAccuracy = Infinity;
    let finished = false;
    let watchId = null;
    let timeoutTriggered = false;

    // Aceitar qualquer localização após 5 segundos, mesmo que não atinja a precisão desejada
    const fallbackTimer = setTimeout(() => {
      timeoutTriggered = true;
      if (!finished && bestLocation) {
        console.log(
          "[getBestEffortLocation] Aceitando melhor localização disponível após timeout parcial"
        );
        finish(true);
      }
    }, Math.min(5000, maxWaitMs * 0.6));

    function finish(acceptAnyAccuracy = false) {
      if (finished) return;
      finished = true;

      clearTimeout(fallbackTimer);

      if (watchId !== null) navigator.geolocation.clearWatch(watchId);

      if (window.precisionCircle && map)
        map.removeLayer(window.precisionCircle);

      if (bestLocation) {
        // Adicionar timestamp
        bestLocation.timestamp = Date.now();

        if (acceptAnyAccuracy || bestLocation.accuracy <= desiredAccuracy) {
          showNotification(
            `Localização obtida com precisão de ${Math.round(
              bestLocation.accuracy
            )}m.`,
            bestLocation.accuracy <= desiredAccuracy ? "success" : "warning"
          );

          // Registrar que o usuário compartilhou localização
          localStorage.setItem("location-permission-granted", "true");

          resolve(bestLocation);
        } else {
          showNotification(
            `Localização obtida, mas com precisão limitada (${Math.round(
              bestLocation.accuracy
            )}m).`,
            "warning"
          );
          resolve(bestLocation); // Aceitar mesmo com precisão ruim
        }
      } else {
        showNotification("Não foi possível obter sua localização.", "error");
        reject(new Error("Não foi possível obter localização."));
      }
    }

    // Usar getCurrentPosition primeiro para uma resposta mais rápida
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (finished) return;

        const { latitude, longitude, accuracy } = position.coords;
        console.log(
          `[getBestEffortLocation] Posição inicial: (${latitude}, ${longitude}), precisão: ${accuracy}m`
        );

        bestLocation = { latitude, longitude, accuracy };

        if (accuracy <= desiredAccuracy) {
          finish();
        }
      },
      (error) => {
        console.warn(
          "[getBestEffortLocation] Erro em getCurrentPosition:",
          error
        );
        // Continua para watchPosition como fallback
      },
      {
        enableHighAccuracy: true,
        timeout: maxWaitMs * 0.5,
        maximumAge: 5000, // Permite usar posições mais antigas para resposta rápida
      }
    );

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        console.log(
          `[getBestEffortLocation] Recebido: (${latitude}, ${longitude}), precisão: ${accuracy}m`
        );

        if (accuracy < bestAccuracy) {
          bestAccuracy = accuracy;
          bestLocation = { latitude, longitude, accuracy };

          // Mostra círculo de precisão no mapa
          if (map) {
            if (window.precisionCircle) map.removeLayer(window.precisionCircle);
            window.precisionCircle = L.circle([latitude, longitude], {
              radius: accuracy,
              color: "#3b82f6",
              fillColor: "#3b82f6",
              fillOpacity: 0.15,
            }).addTo(map);
            map.setView([latitude, longitude], 16);
          }
        }

        // Aceita quando atingir a precisão desejada
        if (accuracy <= desiredAccuracy) {
          finish();
        }
        // Se timeout parcial já ocorreu, aceita qualquer melhoria
        else if (timeoutTriggered && accuracy < bestAccuracy * 0.8) {
          finish(true); // Aceita melhoria significativa mesmo sem atingir a precisão ideal
        }
      },
      (error) => {
        console.error(
          "[getBestEffortLocation] Erro ao obter localização:",
          error
        );

        if (bestLocation) {
          finish(true); // Usa a melhor localização disponível em caso de erro
        } else {
          finish(); // Vai rejeitar a promise
        }
      },
      {
        enableHighAccuracy: true,
        timeout: maxWaitMs,
        maximumAge: 0,
      }
    );

    // Timeout final
    setTimeout(() => {
      if (!finished) {
        console.log(
          `[getBestEffortLocation] Timeout final após ${maxWaitMs}ms`
        );
        finish(true); // Aceita qualquer precisão no timeout final
      }
    }, maxWaitMs);
  });
}

/**
 * Rastreia a localização do usuário em tempo real até atingir a precisão desejada.
 * Retorna um objeto Promise com método stop() para cancelar o rastreamento.
 * @param {number} desiredAccuracy - Precisão desejada em metros
 * @param {number} fallbackAccuracy - Precisão aceitável caso desired não seja atingida
 * @param {number} maxWaitMs - Tempo máximo de rastreamento
 * @param {function} onUpdate - Callback para cada atualização de localização
 * @returns {Promise<{ latitude, longitude, accuracy }>} (com .stop())
 */
export function getPreciseLocationRealtime(
  desiredAccuracy = 20,
  fallbackAccuracy = 200,
  maxWaitMs = 60000,
  onUpdate = null
) {
  let bestLocation = null;
  let bestAccuracy = Infinity;
  let finished = false;
  let watchId = null;
  let timeoutId = null;

  showNotification(
    "Obtendo sua localização precisa... Aguarde e, se possível, vá para um local aberto.",
    "info"
  );

  function finish(acceptFallback = false) {
    if (finished) return;
    finished = true;
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    if (timeoutId) clearTimeout(timeoutId);
    if (window.precisionCircle && map) map.removeLayer(window.precisionCircle);
    if (
      bestLocation &&
      (acceptFallback || bestLocation.accuracy <= desiredAccuracy)
    ) {
      showNotification(
        `Localização obtida com precisão de ${Math.round(
          bestLocation.accuracy
        )}m.`,
        bestLocation.accuracy <= desiredAccuracy ? "success" : "warning"
      );
      resolveFn(bestLocation);
    } else {
      showNotification(
        "Não foi possível obter sua localização precisa.",
        "error"
      );
      rejectFn(new Error("Não foi possível obter localização precisa."));
    }
  }

  let resolveFn, rejectFn;
  const promise = new Promise((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (accuracy < bestAccuracy) {
          bestAccuracy = accuracy;
          bestLocation = { latitude, longitude, accuracy };
          if (typeof onUpdate === "function") onUpdate(bestLocation);
          // Mostra círculo de precisão no mapa
          if (map) {
            if (window.precisionCircle) map.removeLayer(window.precisionCircle);
            window.precisionCircle = L.circle([latitude, longitude], {
              radius: accuracy,
              color: "#3b82f6",
              fillColor: "#3b82f6",
              fillOpacity: 0.15,
            }).addTo(map);
            map.setView([latitude, longitude], 16);
          }
        }
        if (accuracy <= desiredAccuracy) {
          finish();
        }
      },
      (error) => {
        console.error(
          "[getPreciseLocationRealtime] Erro ao obter localização:",
          error
        );
        finish();
      },
      {
        enableHighAccuracy: true,
        timeout: maxWaitMs,
        maximumAge: 0,
      }
    );

    timeoutId = setTimeout(() => {
      // Aceita fallbackAccuracy se não atingiu a desejada
      if (bestLocation && bestLocation.accuracy <= fallbackAccuracy) {
        finish(true);
      } else {
        finish();
      }
    }, maxWaitMs);
  });

  // Permite cancelar o rastreamento manualmente
  promise.stop = () => {
    finished = true;
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    if (timeoutId) clearTimeout(timeoutId);
    if (window.precisionCircle && map) map.removeLayer(window.precisionCircle);
  };

  return promise;
}

/**
 * Centraliza o mapa na localização do usuário, exibindo o usuário próximo ao topo da tela.
 * @param {number} targetLat - Latitude do usuário.
 * @param {number} targetLon - Longitude do usuário.
 * @param {number} [offsetPercent=0.2] - Percentual do deslocamento do topo (ex: 0.2 = 20% do topo).
 */
export function animateMapToLocalizationUser(
  targetLat,
  targetLon,
  offsetPercent = -0.3
) {
  if (!map) return;
  const animationDuration = 1000; // duração em milissegundos
  const startCenter = map.getCenter();
  const startLat = startCenter.lat;
  const startLon = startCenter.lng;
  const startTime = performance.now();

  // Calcula o deslocamento em pixels para o topo
  const mapHeight = map.getSize().y;
  const offsetY = mapHeight * offsetPercent;

  function animateFrame(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / animationDuration, 1); // Progresso de 0 a 1

    // Interpolação linear entre a posição atual e a posição alvo
    const interpolatedLat = startLat + (targetLat - startLat) * progress;
    const interpolatedLon = startLon + (targetLon - startLon) * progress;

    // Aplica o offset para exibir o usuário próximo ao topo
    const projected = map.project(
      [interpolatedLat, interpolatedLon],
      map.getZoom()
    );
    const targetPoint = projected.subtract([0, offsetY]);
    const targetLatLng = map.unproject(targetPoint, map.getZoom());

    // Atualiza a vista do mapa sem animação nativa
    map.setView(targetLatLng, map.getZoom(), { animate: false });

    if (progress < 1) {
      requestAnimationFrame(animateFrame);
    }
  }
  requestAnimationFrame(animateFrame);
}

// Dentro da função updateUserMarker

/**
 * Atualiza ou cria o marcador do usuário
 */
//
export function updateUserMarker(lat, lon, heading = 0, accuracy = 15) {
  if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) {
    console.error("[updateUserMarker] Invalid coordinates:", lat, lon);
    return false;
  }

  try {
    // Create marker if it doesn't exist
    if (!window.userMarker) {
      return createUserMarker(lat, lon, heading, accuracy);
    }

    // Update marker position
    window.userMarker.setLatLng([lat, lon]);

    // VERIFICA se estamos em modo de navegação
    const isNavigating =
      window.navigationState && window.navigationState.isActive;

    // Se estamos navegando e a direção não foi explicitamente definida pela função updateUserMarkerDirection,
    // não atualizar a rotação (manter a última usada)
    if (isNavigating && heading === window.userLocation?.heading) {
      // Manter a direção anterior (foi chamado com o heading do dispositivo)
      console.log(
        "[updateUserMarker] Em navegação - mantendo direção para próximo passo"
      );
      return true;
    }

    // Apply rotation if heading is valid
    if (typeof heading === "number" && !isNaN(heading)) {
      // Determinar se é uma mudança significativa de direção
      const currentHeading = window.userMarker.options.rotationAngle || 0;
      const headingDiff = Math.abs(
        ((heading - currentHeading + 180) % 360) - 180
      );

      // Se a mudança for significativa, aplicar transição
      if (headingDiff > 20) {
        // Adicionar classe de transição para animação suave
        if (window.userMarker._icon) {
          window.userMarker._icon.classList.add("direction-transition");

          // Remover classe após a animação
          setTimeout(() => {
            if (window.userMarker && window.userMarker._icon) {
              window.userMarker._icon.classList.remove("direction-transition");
            }
          }, 600); // Duração da animação + um pouco
        }
      }

      // Aplicar rotação usando plugin ou CSS
      if (typeof window.userMarker.setRotationAngle === "function") {
        window.userMarker.setRotationAngle(heading);
      } else {
        // Fallback para CSS quando o plugin não estiver disponível
        try {
          const markerElement = window.userMarker._icon;
          if (markerElement) {
            markerElement.style.transformOrigin = "center center";
            markerElement.style.transform = `rotate(${heading}deg)`;
          }
        } catch (error) {
          console.error(
            "[updateUserMarker] Error applying CSS rotation:",
            error
          );
        }
      }
    }

    // Update accuracy circle
    if (window.userAccuracyCircle) {
      window.userAccuracyCircle.setLatLng([lat, lon]);
      window.userAccuracyCircle.setRadius(accuracy);
    }

    return true;
  } catch (error) {
    console.error("[updateUserMarker] Error:", error);
    return false;
  }
}
/**
 * Cria um marcador para a localização do usuário em formato de seta vermelha
 * com rotação baseada na direção de movimento e um popup informativo
 *
 * @param {number} lat - Latitude do usuário
 * @param {number} lon - Longitude do usuário
 * @param {number} heading - Direção em graus (0-359)
 * @param {number} accuracy - Precisão da localização em metros
 * @param {Object} [mapInstance] - Instância do mapa (opcional)
 * @returns {Object|null} O marcador criado ou null em caso de falha
 */
export function createUserMarker(
  lat,
  lon,
  heading = 0,
  accuracy = 15,
  mapInstance = null
) {
  try {
    // Registro detalhado para debug
    console.log("[createUserMarker] Iniciando criação com parâmetros:", {
      lat,
      lon,
      heading,
      accuracy,
    });

    // Garantir que temos uma instância do mapa
    const map =
      mapInstance ||
      window.map ||
      (typeof getMapInstance === "function" ? getMapInstance() : null);

    if (!map) {
      console.error("[createUserMarker] Mapa não disponível");
      return null;
    }

    // Verificar coordenadas válidas
    if (isNaN(lat) || isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      console.error("[createUserMarker] Coordenadas inválidas:", lat, lon);
      return null;
    }

    // Adicionar estilos necessários se não existirem
    addUserMarkerStyles();

    // IMPORTANTE: Limpar qualquer marcador ou círculo de precisão existente
    // para evitar duplicação
    if (window.userMarker && typeof window.userMarker.remove === "function") {
      window.userMarker.remove();
    }

    if (
      window.userAccuracyCircle &&
      typeof window.userAccuracyCircle.remove === "function"
    ) {
      window.userAccuracyCircle.remove();
    }

    // Criar o ícone do marcador com a seta utilizando SVG
    const icon = L.divIcon({
      html: `
    <div class="user-location-arrow">
      <svg viewBox="0 0 24 24" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
        <!-- MODIFICAÇÃO: Usar um SVG que aponta para cima por padrão -->
        <path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z" 
              fill="#ff0000" 
              stroke="#ffffff" 
              stroke-width="1" />
      </svg>
    </div>
  `,
      className: "user-location-marker",
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });

    // Criar o marcador e adicioná-lo ao mapa
    window.userMarker = L.marker([lat, lon], {
      icon: icon,
      title: "Sua localização",
      zIndexOffset: 1000, // Garantir que fique acima dos outros marcadores
    }).addTo(map);

    // NOVO: Adicionar popup ao marcador do usuário
    const popup = L.popup({
      className: "user-location-popup",
      closeButton: false,
      autoClose: false,
      closeOnEscapeKey: false,
      closeOnClick: false,
      offset: [0, -5],
    }).setContent('<div class="user-here-popup">Você está aqui!</div>');

    window.userMarker.bindPopup(popup);
    window.userMarker.openPopup(); // Abrir o popup imediatamente

    // Adicionar estilo para o popup se ainda não existir
    addUserPopupStyles();

    console.log("[createUserMarker] Marcador base criado com popup");

    // Aplicar rotação explícita ao SVG dentro do marcador
    const iconElement = window.userMarker.getElement
      ? window.userMarker.getElement()
      : window.userMarker._icon;

    if (iconElement) {
      const arrowElement = iconElement.querySelector(".user-location-arrow");
      if (arrowElement) {
        arrowElement.style.transform = `rotate(${heading}deg)`;
        arrowElement.style.webkitTransform = `rotate(${heading}deg)`;
        arrowElement.dataset.heading = heading;
        console.log(`[createUserMarker] Rotação aplicada: ${heading}°`);
      } else {
        console.warn(
          "[createUserMarker] Elemento da seta não encontrado no DOM"
        );
      }
    } else {
      console.warn("[createUserMarker] Elemento do ícone não encontrado");
    }

    // Criar o círculo de precisão
    window.userAccuracyCircle = L.circle([lat, lon], {
      radius: accuracy,
      color: "rgba(255, 0, 0, 0.6)",
      fillColor: "rgba(255, 0, 0, 0.1)",
      fillOpacity: 0.3,
      weight: 2,
      className: "gps-accuracy-circle",
    }).addTo(map);

    console.log(
      "[createUserMarker] Círculo de precisão criado com raio:",
      accuracy
    );

    // Atualizar variáveis de tracking e estado
    try {
      // Atualizar userLocation para compatibilidade com código existente
      if (window.userLocation) {
        window.userLocation = {
          ...window.userLocation,
          latitude: lat,
          longitude: lon,
          accuracy: accuracy,
          heading: heading,
          timestamp: Date.now(),
        };
      }

      // Usar também a variável exportada se ela existir no escopo
      if (typeof userLocation !== "undefined") {
        userLocation = {
          ...userLocation,
          latitude: lat,
          longitude: lon,
          accuracy: accuracy,
          heading: heading,
          timestamp: Date.now(),
        };
      }

      // Atribuir à variável módulo para compatibilidade
      if (typeof userMarker !== "undefined") {
        userMarker = window.userMarker;
      }
    } catch (stateError) {
      console.warn("[createUserMarker] Erro ao atualizar estado:", stateError);
    }

    console.log("[createUserMarker] Marcador criado com sucesso");
    return window.userMarker;
  } catch (error) {
    console.error("[createUserMarker] Erro ao criar marcador:", error);
    console.error("[createUserMarker] Stack trace:", error.stack);
    return null;
  }
}

/**
 * Adiciona estilos CSS específicos para o popup do marcador do usuário
 */
function addUserPopupStyles() {
  if (document.getElementById("user-popup-style")) return;

  const style = document.createElement("style");
  style.id = "user-popup-style";
  style.textContent = `
    .user-location-popup {
      background: #004bc7;
      color: white;
      border: none;
      border-radius: 16px;
      padding: 5px 10px;
      font-weight: bold;
      width: 142px;
      box-shadow: 0 2px 5px #004bc7;
    }
    
    .user-location-popup .leaflet-popup-content-wrapper {
      background: #004bc7;
      color: white;
      border-radius: 16px;
      padding: 0;
    }
    
    .user-location-popup .leaflet-popup-content {
      margin: 5px 10px;
      font-size: 14px;
      font-weight: bold;
      text-align: center;
      color: white;
    }
    
    .user-location-popup .leaflet-popup-tip {
      background: rgba(255, 0, 0, 0.8);
    }
    
    .user-here-popup {
      white-space: nowrap;
    }
  `;
  document.head.appendChild(style);
  console.log("[addUserPopupStyles] Estilos de popup adicionados ao documento");
}

/**
 * Adiciona os estilos CSS necessários para o marcador do usuário
 * Garante que os estilos são adicionados apenas uma vez
 */
// Na função addUserMarkerStyles, adicionar:
function addUserMarkerStyles() {
  if (document.getElementById("user-marker-style")) return;

  const style = document.createElement("style");
  style.id = "user-marker-style";
  style.textContent = `
    .user-location-marker {
      background: transparent;
      border: none;
    }
    .user-location-arrow {
      transition: transform 0.3s ease-out;
      transform-origin: center center;
      will-change: transform;
    }
    .user-location-arrow svg {
      filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.5));
    }
    
    /* CORREÇÃO: Impedir que o marcador do usuário seja contra-rotacionado com os outros */
    .leaflet-map-rotated .user-location-marker {
      transform: none !important;
    }
    
    /* NOVO: Para garantir que o marcador fique estável durante navegação */
    .fixed-direction .user-location-arrow {
      transition: transform 0.6s ease-in-out;
    }
    
    /* Nova classe para transição durante mudanças de direção */
    .direction-transition {
      transition: transform 0.6s ease-in-out !important;
    }
    
    .gps-accuracy-circle {
      transition: all 0.3s ease;
    }
  `;
  document.head.appendChild(style);
  console.log("[addUserMarkerStyles] Estilos adicionados ao documento");
}

/**
 * Cria ou atualiza o círculo de precisão ao redor do marcador do usuário
 * @param {number} lat - Latitude do usuário
 * @param {number} lon - Longitude do usuário
 * @param {number} accuracy - Precisão da posição em metros
 * @returns {Object} O círculo criado
 */
function createAccuracyCircle(lat, lon, accuracy) {
  try {
    const mapInstance = map;
    if (!mapInstance) {
      console.warn("[createAccuracyCircle] Instância de mapa não disponível");
      return null;
    }

    // Criar o círculo de precisão
    window.userAccuracyCircle = L.circle([lat, lon], {
      radius: accuracy,
      weight: 1,
      color: "#3b82f6",
      fillColor: "#3b82f6",
      fillOpacity: 0.15,
      interactive: false, // Não deve responder a eventos do mouse
    }).addTo(mapInstance);

    console.log(
      "[createAccuracyCircle] Círculo de precisão criado com raio:",
      accuracy
    );
    return window.userAccuracyCircle;
  } catch (error) {
    console.error(
      "[createAccuracyCircle] Erro ao criar círculo de precisão:",
      error
    );
    return null;
  }
}

export function clearUserLocation() {
  if (userLocationMarker) {
    userLocationMarker.remove();
    userLocationMarker = null;
  }
  userLocation = null;
  trackingActive = false;
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  updateContext({ userLocation: null });
}

/**
 * Cache de rotas para evitar chamadas duplicadas à API
 */
const routeCache = new Map();

/**
 * Gera uma chave de cache para uma rota
 */
function generateRouteKey(startLat, startLon, destLat, destLon, profile) {
  // Arredonda as coordenadas para reduzir variações mínimas
  const precision = 5;
  return `${startLat.toFixed(precision)}_${startLon.toFixed(
    precision
  )}_${destLat.toFixed(precision)}_${destLon.toFixed(precision)}_${profile}`;
}

/**
 * Consulta a API OpenRouteService, obtém as coordenadas e plota a rota no mapa.
 * Versão otimizada com cache e melhor tratamento de erros.
 * @param {number} startLat - Latitude de partida.
 * @param {number} startLon - Longitude de partida.
 * @param {number} destLat - Latitude do destino.
 * @param {number} destLon - Longitude do destino.
 * @param {string} [profile="foot-walking"] - Perfil de navegação.
 * @param {string} [destinationName="Destino"] - Nome do destino para o marcador.
 * @returns {Promise<Object|null>} - Dados da rota ou null em caso de erro.
 */
export async function plotRouteOnMap(
  startLat,
  startLon,
  destLat,
  destLon,
  profile = "foot-walking",
  destinationName = "Destino"
) {
  console.log("Origem:", startLat, startLon, "Destino:", destLat, destLon);

  // Validar coordenadas
  if (
    !isValidCoordinate(startLat, startLon) ||
    !isValidCoordinate(destLat, destLon)
  ) {
    console.error("[plotRouteOnMap] Coordenadas inválidas", {
      start: [startLat, startLon],
      dest: [destLat, destLon],
    });
    showNotification(
      "Coordenadas inválidas. Verifique a localização.",
      "error"
    );
    return null;
  }

  // Verificar se é uma rota muito curta (menos de 50m) - nesse caso, não precisa calcular
  const directDistance = calculateHaversineDistance(
    startLat,
    startLon,
    destLat,
    destLon
  );
  if (directDistance < 50) {
    console.log(
      `[plotRouteOnMap] Rota muito curta (${directDistance.toFixed(
        1
      )}m), apenas desenhando linha direta`
    );
    drawStraightLine(startLat, startLon, destLat, destLon, destinationName);
    return {
      features: [
        {
          properties: {
            summary: {
              distance: directDistance,
              duration: directDistance / 1.4, // Aproximadamente 1.4m/s para caminhada
            },
          },
        },
      ],
    };
  }

  // Verificar cache de rotas
  const cacheKey = generateRouteKey(
    startLat,
    startLon,
    destLat,
    destLon,
    profile
  );
  if (routeCache.has(cacheKey)) {
    const cachedData = routeCache.get(cacheKey);
    const cacheAge = Date.now() - cachedData.timestamp;

    // Usar cache se tiver menos de 5 minutos
    if (cacheAge < 5 * 60 * 1000) {
      console.log("[plotRouteOnMap] Usando rota em cache");

      // Limpar rota anterior
      if (window.currentRoute) {
        map.removeLayer(window.currentRoute);
        console.log("[plotRouteOnMap] Rota anterior removida.");
      }

      // Limpar marcador anterior
      if (window.destinationMarker) {
        map.removeLayer(window.destinationMarker);
        console.log("[plotRouteOnMap] Marcador de destino anterior removido.");
      }

      // Recriar a polyline e o marcador com os dados em cache
      displayRouteFromData(
        cachedData.data,
        startLat,
        startLon,
        destLat,
        destLon,
        destinationName,
        profile
      );

      return cachedData.data;
    }
  }

  // Exibir indicador de carregamento
  const loadingIndicator = addLoadingIndicator("Calculando rota...");

  try {
    // Construir URL para a API
    const url =
      `https://api.openrouteservice.org/v2/directions/${profile}?api_key=${apiKey}` +
      `&start=${startLon},${startLat}&end=${destLon},${destLat}&instructions=true`;

    console.log(
      "[plotRouteOnMap] Chamando API:",
      url.replace(apiKey, "API_KEY_HIDDEN")
    );

    // Adicionar timeout à requisição
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 segundos

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      removeLoadingIndicator(loadingIndicator);

      const errorText = await response.text();
      console.error("[plotRouteOnMap] Erro da API:", errorText);

      // Tentar fallback ou desenhar linha reta
      drawStraightLine(startLat, startLon, destLat, destLon, destinationName);

      showNotification(
        "Não foi possível calcular a rota. Exibindo linha reta.",
        "warning"
      );

      return null;
    }

    const data = await response.json();
    console.log("[plotRouteOnMap] Dados recebidos da API:", data);

    // Remover indicador de carregamento
    removeLoadingIndicator(loadingIndicator);

    // Salvar no cache
    routeCache.set(cacheKey, {
      data: data,
      timestamp: Date.now(),
    });

    // Exibir a rota
    displayRouteFromData(
      data,
      startLat,
      startLon,
      destLat,
      destLon,
      destinationName,
      profile
    );

    return data;
  } catch (error) {
    console.error("[plotRouteOnMap] Erro:", error);
    removeLoadingIndicator(loadingIndicator);

    // Desenhar linha reta como fallback
    drawStraightLine(startLat, startLon, destLat, destLon, destinationName);

    showNotification(
      "Erro ao calcular a rota. Exibindo direção aproximada.",
      "warning"
    );
    return null;
  }
}

/**
 * Calcula a distância entre dois pontos geográficos usando a fórmula de Haversine.
 * Útil como fallback para estimar distâncias quando os serviços de roteamento falham.
 * @param {number} lat1 - Latitude do ponto 1
 * @param {number} lon1 - Longitude do ponto 1
 * @param {number} lat2 - Latitude do ponto 2
 * @param {number} lon2 - Longitude do ponto 2
 * @returns {number} - Distância em metros
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // raio da Terra em metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // em metros
}

/**
 * Exibe uma rota no mapa a partir de dados já processados
 */
function displayRouteFromData(
  data,
  startLat,
  startLon,
  destLat,
  destLon,
  destinationName,
  profile
) {
  try {
    // Processar os dados da rota
    const routeFeature = data.features?.[0];
    const routeProperties = routeFeature?.properties;

    // Registrar informações de duração e passos, se disponíveis
    if (routeProperties?.segments?.[0]) {
      const segment = routeProperties.segments[0];
      const steps = segment.steps || [];

      console.log(
        "[plotRouteOnMap] Duração total da rota:",
        segment.duration,
        "segundos"
      );
      console.log("[plotRouteOnMap] Número de passos:", steps.length);

      steps.forEach((step, index) => {
        // Garantir que cada passo tenha duração
        if (typeof step.duration !== "number") {
          const totalDistance = segment.distance || 1;
          const stepDistance = step.distance || 0;
          const proportion = stepDistance / totalDistance;
          step.duration = Math.round(segment.duration * proportion);
        }

        console.log(
          `[plotRouteOnMap] Passo ${index + 1}: Distância=${
            step.distance
          }m, Duração=${step.duration}s, Instrução=${step.instruction || "N/A"}`
        );
      });

      // Anexar dados processados
      data._processedSteps = steps;
      data._totalDuration = segment.duration || 0;
      data._totalDistance = segment.distance || 0;
    }

    // Extrair coordenadas
    const coords = routeFeature?.geometry?.coordinates;
    if (!coords || !coords.length) {
      console.warn("[plotRouteOnMap] Nenhuma coordenada encontrada");
      drawStraightLine(startLat, startLon, destLat, destLon, destinationName);
      return;
    }

    // Converter para formato [lat, lon]
    const latLngs = coords.map(([lon, lat]) => [lat, lon]);

    // Remover rota anterior
    if (window.currentRoute) {
      map.removeLayer(window.currentRoute);
      console.log("[plotRouteOnMap] Rota anterior removida.");
    }

    // Remover marcador anterior
    if (window.destinationMarker) {
      map.removeLayer(window.destinationMarker);
      console.log("[plotRouteOnMap] Marcador de destino anterior removido.");
    }

    // Criar polyline
    window.currentRoute = L.polyline(latLngs, {
      color: "#3b82f6",
      weight: 5,
      opacity: 0.8,
      lineJoin: "round",
      lineCap: "round",
      dashArray: profile === "driving-car" ? "10,10" : null,
    }).addTo(map);

    // Tentar adicionar setas direcionais se tiver L.Symbol
    try {
      if (L.polylineDecorator && L.Symbol && latLngs.length > 10) {
        const arrowDecorator = L.polylineDecorator(window.currentRoute, {
          patterns: [
            {
              offset: "5%",
              repeat: "10%",
              symbol: L.Symbol.arrowHead({
                pixelSize: 10,
                headAngle: 30,
                polygon: true,
                pathOptions: { color: "#3b82f6", fillOpacity: 0.8, weight: 0 },
              }),
            },
          ],
        }).addTo(map);
        window.arrowDecorator = arrowDecorator;
      }
    } catch (decoratorError) {
      console.warn(
        "[plotRouteOnMap] Erro ao adicionar decorador (não crítico):",
        decoratorError
      );
      // Falha no decorator não é crítica, continuamos sem ele
    }

    console.log("[plotRouteOnMap] Polyline adicionada ao mapa.");

    // Adicionar marcador de destino
    try {
      // Criar ícone para o marcador
      const icon = L.divIcon({
        html: `
    <div class="user-location-arrow">
      <svg viewBox="0 0 24 24" width="32" height="32" xmlns="http://www.w3.org/2000/svg">
        <!-- MODIFICAÇÃO: Usar um SVG que aponta para cima por padrão -->
        <path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z" 
              fill="#ff0000" 
              stroke="#ffffff" 
              stroke-width="1" />
      </svg>
    </div>
  `,
        className: "user-location-marker",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16],
      });

      window.destinationMarker = L.marker([destLat, destLon], {
        icon: icon,
        title: destinationName,
      }).addTo(map);

      window.destinationMarker
        .bindPopup(`<h3>${destinationName}</h3>`)
        .openPopup();

      console.log(
        "[plotRouteOnMap] Marcador de destino adicionado:",
        destinationName
      );
    } catch (markerError) {
      console.error(
        "[plotRouteOnMap] Erro ao adicionar marcador:",
        markerError
      );
    }

    // Ajustar visualização do mapa
    try {
      const bounds = window.currentRoute.getBounds();
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 17,
        animate: true,
        duration: 1.0,
      });
      console.log("[plotRouteOnMap] fitBounds aplicado.");
    } catch (boundsError) {
      console.warn(
        "[plotRouteOnMap] Erro ao ajustar visualização:",
        boundsError
      );

      // Centralizar entre origem e destino como fallback
      const centerLat = (startLat + destLat) / 2;
      const centerLon = (startLon + destLon) / 2;
      map.setView([centerLat, centerLon], 15);
    }
  } catch (error) {
    console.error("[displayRouteFromData] Erro ao exibir rota:", error);
  }
}

/**
 * Modifica o marcador do usuário para apontar para um destino específico
 * Pode ser chamado imediatamente após plotRouteOnMap
 * @param {number} lat - Latitude do usuário
 * @param {number} lon - Longitude do usuário
 * @param {Object} nextPoint - Próximo ponto na rota {lat, lng} ou {lat, lon}
 * @param {number} accuracy - Precisão da posição
 */
export function updateDirectionalUserMarker(
  lat,
  lon,
  nextPoint,
  accuracy = 15
) {
  // Calcular ângulo para o próximo ponto
  const heading = calculateBearing(
    lat,
    lon,
    nextPoint.lat || nextPoint[0],
    nextPoint.lon || nextPoint.lng || nextPoint[1]
  );

  // Atualizar o marcador com o ângulo calculado
  updateUserMarker(lat, lon, heading, accuracy);
}

// Substituir a função calculateBearing

/**
 * Calcula o ângulo/direção entre dois pontos geográficos com maior precisão
 * @param {number} lat1 - Latitude do ponto atual
 * @param {number} lon1 - Longitude do ponto atual
 * @param {number} lat2 - Latitude do ponto destino
 * @param {number} lon2 - Longitude do ponto destino
 * @returns {number} Ângulo em graus (0-360)
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  // Validar entradas
  if (
    lat1 === undefined ||
    lon1 === undefined ||
    lat2 === undefined ||
    lon2 === undefined ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    console.error("[calculateBearing] Coordenadas inválidas:", {
      lat1,
      lon1,
      lat2,
      lon2,
    });
    return 0;
  }

  // Converter strings para números se necessário
  lat1 = parseFloat(lat1);
  lon1 = parseFloat(lon1);
  lat2 = parseFloat(lat2);
  lon2 = parseFloat(lon2);

  // Converter para radianos
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  // Cálculo do bearing inicial
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  // Converter para graus e normalizar para 0-360
  const bearing = ((θ * 180) / Math.PI + 360) % 360;

  return bearing;
}

// Corrigir a implementação da função updateDirectionalMarker

/**
 * Atualiza o marcador do usuário para apontar para o próximo ponto na rota
 * @param {Object} userPos - Posição atual {latitude, longitude}
 * @param {Object} instructions - Array de instruções da rota
 * @param {number} currentIndex - Índice do passo atual
 */
export function updateDirectionalMarker(userPos, instructions, currentIndex) {
  if (!userPos || !userPos.latitude || !userPos.longitude) {
    return;
  }

  try {
    // Verificar se temos instruções e se currentIndex é válido
    if (!Array.isArray(instructions) || instructions.length === 0) {
      console.warn("[updateDirectionalMarker] Instruções inválidas");
      return;
    }

    // Determinar o próximo passo
    const nextIndex = Math.min(currentIndex + 1, instructions.length - 1);
    const nextStep = instructions[nextIndex];

    if (nextStep) {
      // Extrair coordenadas do próximo passo
      const nextLat = nextStep.latitude || nextStep.lat;
      const nextLon = nextStep.longitude || nextStep.lon || nextStep.lng;

      if (nextLat !== undefined && nextLon !== undefined) {
        // Calcular o ângulo para o próximo ponto
        const bearing = calculateBearing(
          userPos.latitude,
          userPos.longitude,
          nextLat,
          nextLon
        );

        // Atualizar o marcador com a nova orientação
        updateUserMarker(
          userPos.latitude,
          userPos.longitude,
          bearing,
          userPos.accuracy || 15
        );

        console.log(
          `[updateDirectionalMarker] Marcador apontando para o próximo ponto da rota: ${bearing.toFixed(
            1
          )}°`
        );
      }
    }
  } catch (error) {
    console.warn(
      "[updateDirectionalMarker] Erro ao atualizar orientação:",
      error
    );
  }
}

/**
 * Obtém a posição do usuário com estratégias de fallback para maior confiabilidade
 * @param {Object} options - Opções de geolocalização
 * @returns {Promise<Object>} Promise com os dados da posição
 */
export function getEnhancedPosition(options = {}) {
  return new Promise((resolve, reject) => {
    console.log(
      "[getEnhancedPosition] Tentando obter posição com alta precisão"
    );

    // Verificar se temos uma posição recente em cache
    const cachedPosition = window.lastUserPosition;
    const now = Date.now();
    const MAX_CACHE_AGE = 30000; // 30 segundos

    if (cachedPosition && now - cachedPosition.timestamp < MAX_CACHE_AGE) {
      console.log("[getEnhancedPosition] Usando posição em cache (recente)");
      setTimeout(() => resolve(cachedPosition), 0);
      return;
    }

    // Tentar alta precisão primeiro
    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.lastUserPosition = {
          ...position,
          timestamp: Date.now(),
        };
        console.log("[getEnhancedPosition] Posição obtida com alta precisão");
        resolve(position);
      },
      (error) => {
        console.warn("[getEnhancedPosition] Erro com alta precisão:", error);

        // Se falhar, tentar com baixa precisão
        navigator.geolocation.getCurrentPosition(
          (position) => {
            window.lastUserPosition = {
              ...position,
              timestamp: Date.now(),
            };
            console.log(
              "[getEnhancedPosition] Posição obtida com baixa precisão"
            );
            resolve(position);
          },
          (error) => {
            console.error(
              "[getEnhancedPosition] Erro com baixa precisão:",
              error
            );

            // Se ainda temos cache, usar como último recurso
            if (cachedPosition) {
              console.warn(
                "[getEnhancedPosition] Usando posição em cache (expirada)"
              );
              resolve(cachedPosition);
            } else {
              reject(error);
            }
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0, ...options }
    );
  });
}

// No arquivo navigationUserLocation/user-location.js
// Melhore a função determineCurrentSegment para detectar melhor o segmento atual

export function determineCurrentSegment(userLocation, instructions) {
  if (
    !instructions ||
    !Array.isArray(instructions) ||
    instructions.length === 0
  ) {
    return { segmentIndex: 0, distance: Infinity };
  }

  let closestSegmentIndex = 0;
  let minDistance = Infinity;

  // Encontrar o segmento mais próximo
  instructions.forEach((instruction, index) => {
    if (index < instructions.length - 1) {
      const segLat = instruction.latitude || instruction.lat;
      const segLon =
        instruction.longitude || instruction.lon || instruction.lng;

      if (segLat && segLon) {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          segLat,
          segLon
        );

        if (distance < minDistance) {
          minDistance = distance;
          closestSegmentIndex = index;
        }
      }
    }
  });

  return { segmentIndex: closestSegmentIndex, distance: minDistance };
}
/**
 * Calcula a direção fixa para um segmento específico da rota
 * @param {number} segmentIndex - Índice do segmento atual nas instruções
 * @param {Array} instructions - Array de instruções da rota
 * @returns {number|null} Ângulo de direção ou null se não for possível calcular
 */
export function getSegmentDirection(segmentIndex, instructions) {
  if (
    !instructions ||
    !Array.isArray(instructions) ||
    instructions.length === 0
  ) {
    return null;
  }

  // Obter o ponto atual
  const currentInstruction = instructions[segmentIndex];
  if (!currentInstruction) return null;

  const currentLat = currentInstruction.latitude || currentInstruction.lat;
  const currentLon =
    currentInstruction.longitude ||
    currentInstruction.lon ||
    currentInstruction.lng;

  if (isNaN(currentLat) || isNaN(currentLon)) return null;

  // Determinar o próximo ponto para calcular a direção
  let nextInstruction;
  let nextLat, nextLon;

  // Se já estamos no último ponto da rota, usar direção do segmento anterior
  if (segmentIndex >= instructions.length - 1) {
    if (segmentIndex === 0) return 0; // Se só tiver um ponto, direção padrão

    // Usar ponto anterior para calcular direção (invertendo-a)
    const prevInstruction = instructions[segmentIndex - 1];
    const prevLat = prevInstruction.latitude || prevInstruction.lat;
    const prevLon =
      prevInstruction.longitude || prevInstruction.lon || prevInstruction.lng;

    if (!isNaN(prevLat) && !isNaN(prevLon)) {
      // Calcular direção do ponto anterior para o atual e inverter
      const inverseBearing = calculateBearing(
        prevLat,
        prevLon,
        currentLat,
        currentLon
      );

      return inverseBearing; // Já está na direção correta
    }

    return null;
  } else {
    // Caso normal: pegar próximo ponto
    nextInstruction = instructions[segmentIndex + 1];
    nextLat = nextInstruction.latitude || nextInstruction.lat;
    nextLon =
      nextInstruction.longitude || nextInstruction.lon || nextInstruction.lng;

    if (isNaN(nextLat) || isNaN(nextLon)) return null;

    // Calcular ângulo do ponto atual para o próximo
    const bearing = calculateBearing(currentLat, currentLon, nextLat, nextLon);

    // O ângulo precisa ser ajustado para o sistema de coordenadas do SVG
    const correctedBearing = (bearing + 180) % 360;

    console.log(
      `[getSegmentDirection] Segmento #${segmentIndex}: direção fixa ${correctedBearing.toFixed(
        1
      )}°`
    );
    return correctedBearing;
  }
}

/**
 * Converte graus para radianos
 * @param {number} degrees - Ângulo em graus
 * @returns {number} - Ângulo em radianos
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Converte radianos para graus
 * @param {number} radians - Ângulo em radianos
 * @returns {number} - Ângulo em graus
 */
function toDegrees(radians) {
  return radians * (180 / Math.PI);
}
