// Adicionar ao arquivo principal da aplicação (app.js ou index.js)
import { initLocationSystem } from "./js/navigation/navigationUserLocation/enhanced-location-manager.js";
import { initUserMarker } from "./js/navigation/navigationUserLocation/enhanced-user-marker.js";

// Inicializar sistemas durante carregamento da página
document.addEventListener("DOMContentLoaded", () => {
  // Verificar compatibilidade
  const supportsLeaflet = typeof L !== "undefined";
  const supportsGeolocation = "geolocation" in navigator;

  if (supportsLeaflet && supportsGeolocation) {
    // Inicializar sistema de localização avançado
    initLocationSystem({
      autoStart: false, // Iniciar apenas quando solicitado
      adaptivePrecision: true,
      enableHighAccuracy: true,
    });

    // Inicializar sistema de marcador
    initUserMarker();

    console.log("✅ Sistema de localização avançado inicializado");
  } else {
    console.warn(
      "⚠️ Requisitos para sistema de localização avançado não atendidos"
    );
  }
});
