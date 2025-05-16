/**
 * Monitor de rotação do mapa
 * Garante que a rotação seja mantida durante a navegação
 */

let rotationMonitorInterval = null;

/**
 * Inicia o monitor de rotação do mapa
 */
export function startRotationMonitor() {
  if (rotationMonitorInterval) {
    clearInterval(rotationMonitorInterval);
  }

  rotationMonitorInterval = setInterval(() => {
    const isMapRotated = document.body.classList.contains("map-rotated");
    const navigationActive =
      window.navigationState && window.navigationState.isActive;

    if (navigationActive && !isMapRotated) {
      console.log(
        "[map-rotation-monitor] Restaurando estado de rotação do mapa"
      );
      document.body.classList.add("map-rotated");
      ensureMapElementsAreRotated();
    }
  }, 2000); // Verificar a cada 2 segundos

  console.log("[map-rotation-monitor] Monitor de rotação iniciado");
}

/**
 * Para o monitor de rotação do mapa
 */
export function stopRotationMonitor() {
  if (rotationMonitorInterval) {
    clearInterval(rotationMonitorInterval);
    rotationMonitorInterval = null;
    console.log("[map-rotation-monitor] Monitor de rotação parado");
  }
}

/**
 * Garante que todos os elementos do mapa estejam corretamente rotacionados
 */
function ensureMapElementsAreRotated() {
  const tilePane = document.querySelector(".leaflet-tile-pane");
  const mapPane = document.querySelector(".leaflet-map-pane");
  const controlPane = document.querySelector(".leaflet-control-container");

  if (tilePane) {
    tilePane.style.transform = "rotate(180deg) scale(-1, -1)";
    tilePane.style.transformOrigin = "center center";
  }

  if (mapPane) {
    mapPane.style.transformOrigin = "center center";
    mapPane.style.transform = "scale(-1, -1)";
  }

  if (controlPane) {
    controlPane.style.transformOrigin = "center center";
    controlPane.style.transform = "rotate(-180deg) scale(-1, -1)";
  }
}

// Exportar método para uso direto
export function ensureRotation() {
  if (window.navigationState && window.navigationState.isActive) {
    document.body.classList.add("map-rotated");
    ensureMapElementsAreRotated();
    return true;
  }
  return false;
}
