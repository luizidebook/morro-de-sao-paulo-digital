// Importar os módulos necessários
import {
  getCurrentLocation,
  startLocationTracking,
  stopLocationTracking,
} from "../navigation/navigationUserLocation/enhanced-geolocation.js";

import {
  startNavigation,
  updateRealTimeNavigation,
  checkDestinationArrival,
  updateUserMarkerDirection,
} from "../navigation/navigationController/navigationController.js";
import { calculateRoute } from "./navigationUtils/distanceCalculator.js";
import {
  createUserMarker,
  updateUserMarker,
} from "../navigation/navigationUserLocation/user-location.js";

/**
 * Integra os diversos sistemas de navegação para funcionamento coeso
 */
export function integrateNavigationSystems() {
  console.log(
    "[navigationIntegration] Iniciando integração dos sistemas de navegação"
  );

  // 1. Garantir que a geolocalização seja inicializada
  if (typeof getCurrentLocation === "function") {
    console.log(
      "[navigationIntegration] Expondo funções de geolocalização globalmente"
    );

    // Expor as funções globalmente
    window.getCurrentLocation = getCurrentLocation;
    window.startLocationTracking = startLocationTracking;
    window.stopLocationTracking = stopLocationTracking;
  } else {
    console.error(
      "[navigationIntegration] Funções de geolocalização não encontradas!"
    );
  }

  // 2. Expor funções de navegação globalmente
  if (typeof startNavigation === "function") {
    console.log(
      "[navigationIntegration] Expondo funções de navegação globalmente"
    );

    window.startNavigation = startNavigation;
    window.updateRealTimeNavigation = updateRealTimeNavigation;
    window.checkDestinationArrival = checkDestinationArrival;
    window.calculateRoute = calculateRoute;
  } else {
    console.error(
      "[navigationIntegration] Funções de navegação não encontradas!"
    );
  }

  // 3. Expor funções de manipulação do marcador do usuário
  if (typeof createUserMarker === "function") {
    console.log(
      "[navigationIntegration] Expondo funções de marcador do usuário"
    );

    window.createUserMarker = createUserMarker;
    window.updateUserMarker = updateUserMarker;
    window.updateUserMarkerDirection = updateUserMarkerDirection;
  } else {
    console.error(
      "[navigationIntegration] Funções de marcador não encontradas!"
    );
  }

  // 4. Verificar e criar estado de navegação global
  if (typeof window.navigationState === "undefined") {
    console.log("[navigationIntegration] Inicializando estado de navegação");

    window.navigationState = {
      isActive: false,
      lastUpdateTime: Date.now(),
    };
  }

  // 5. Registrar interoperabilidade entre geolocalização e navegação
  console.log(
    "[navigationIntegration] Registrando interoperabilidade entre módulos"
  );

  try {
    // Sobreescrever startLocationTracking para notificar navegação
    const originalStartTracking = startLocationTracking;
    window.startLocationTracking = function (
      successCallback,
      errorCallback,
      options
    ) {
      console.log("[navigationIntegration] Iniciando rastreamento melhorado");

      return originalStartTracking(
        function (position) {
          // Atualizar variável global
          window.userLocation = position;

          // Notificar sistema de navegação se ativo
          if (
            window.navigationState &&
            window.navigationState.isActive &&
            typeof updateRealTimeNavigation === "function"
          ) {
            updateRealTimeNavigation(position);
          }

          // Chamar callback original
          if (typeof successCallback === "function") {
            successCallback(position);
          }
        },
        errorCallback,
        options
      );
    };

    console.log(
      "[navigationIntegration] Interoperabilidade configurada com sucesso"
    );
  } catch (error) {
    console.error(
      "[navigationIntegration] Erro ao configurar interoperabilidade:",
      error
    );
  }

  // 6. Verificar funções essenciais
  const missingFunctions = [];

  [
    "calculateRoute",
    "updateRealTimeNavigation",
    "checkDestinationArrival",
    "updateUserMarkerDirection",
  ].forEach((funcName) => {
    if (typeof window[funcName] !== "function") {
      missingFunctions.push(funcName);
    }
  });

  if (missingFunctions.length > 0) {
    console.error(
      `[navigationIntegration] Funções essenciais não encontradas: ${missingFunctions.join(
        ", "
      )}`
    );
  } else {
    console.log(
      "[navigationIntegration] Todas as funções essenciais disponíveis"
    );
  }

  console.log(
    "[navigationIntegration] Sistema de navegação integrado com sucesso"
  );
}

// Auto-inicializar na importação
integrateNavigationSystems();
