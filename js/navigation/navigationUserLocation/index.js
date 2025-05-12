/**
 * Sistema de localização avançado - Ponto de entrada
 * Facilita a importação integrada dos módulos do sistema
 */

// Exportar todos os componentes principais
export * from "./enhanced-location-manager.js";
export * from "./enhanced-user-marker.js";
export * from "./movement-predictor.js";

// Importar para compatibilidade global
import {
  initLocationSystem,
  startLocationTracking,
  stopLocationTracking,
  getBestLocation,
} from "./enhanced-location-manager.js";

import {
  createUserMarker,
  updateUserMarker,
  toggleAccuracyVisibility,
  pulseUserMarker,
} from "./enhanced-user-marker.js";

import {
  trackPosition,
  getCurrentOrPredictedPosition,
} from "./movement-predictor.js";

// Verificar se estamos em ambiente de produção
const isProduction = process.env.NODE_ENV === "production";

// Inicializar automaticamente se necessário e em ambiente de desenvolvimento
if (!isProduction) {
  console.log(
    "[LocationSystem] Inicialização automática em ambiente de desenvolvimento"
  );

  // Esperar pelo DOMContentLoaded para inicializar
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      initLocationSystem({
        autoStart: false, // Iniciar apenas quando solicitado por outro componente
        adaptivePrecision: true,
      });
    }, 1000);
  });
}

// Exportar objeto de API unificada
export const LocationSystem = {
  init: initLocationSystem,
  start: startLocationTracking,
  stop: stopLocationTracking,
  getBestLocation,
  getMarker: () => window.userMarker,
  createMarker: createUserMarker,
  updateMarker: updateUserMarker,
  pulse: pulseUserMarker,
  showAccuracy: toggleAccuracyVisibility,
  trackPosition,
  getPrediction: getCurrentOrPredictedPosition,
  isInitialized: () => !!window.userLocation,
};

// Expor para acesso global
window.LocationSystem = LocationSystem;
