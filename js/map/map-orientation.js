/**
 * Configura a rotação inicial do mapa quando a navegação é iniciada
 * Rotaciona o mapa em 180 graus para orientação inversa mantendo os elementos legíveis
 * @param {number} lat - Latitude do usuário
 * @param {number} lon - Longitude do usuário
 */
export function setupInitialMapOrientation(lat, lon) {
  // Obter referência ao mapa global
  const map =
    window.map ||
    (typeof getMapInstance === "function" ? getMapInstance() : null);

  // Verificar se temos uma referência válida ao navigationState
  const navigationState = window.navigationState || {};

  if (!map) {
    console.warn("[setupInitialMapOrientation] Mapa não disponível");
    return;
  }

  try {
    console.log(
      "[setupInitialMapOrientation] Configurando orientação inicial do mapa"
    );

    // 1. Centralizar o mapa na localização do usuário com zoom adequado
    map.setView([lat, lon], 18, { animate: false });

    // 2. Aplicar rotação de 180 graus ao mapa
    if (typeof map.setBearing === "function") {
      // Usar o plugin leaflet.mapbearing.js
      map.setBearing(180);
      console.log(
        "[setupInitialMapOrientation] Rotação aplicada via plugin: 180°"
      );
    } else {
      // Fallback: aplicar rotação manualmente aos elementos do mapa
      const tilePane = document.querySelector(".leaflet-tile-pane");
      const mapPane = document.querySelector(".leaflet-map-pane");
      const controlPane = document.querySelector(".leaflet-control-container");

      if (tilePane && mapPane) {
        // Rotacionar o conteúdo do mapa
        tilePane.style.transition = "transform 0.5s ease-out";
        tilePane.style.transformOrigin = "center center";
        tilePane.style.transform = "rotate(180deg) scale(-1, -1)";

        // Aplicar transformação escalar para corrigir o espelhamento dos elementos
        mapPane.style.transition = "transform 0.5s ease-out";
        mapPane.style.transformOrigin = "center center";
        mapPane.style.transform = "scale(-1, -1)";

        // Manter controles na orientação normal
        if (controlPane) {
          controlPane.style.transition = "transform 0.5s ease-out";
          controlPane.style.transformOrigin = "center center";
          controlPane.style.transform = "rotate(-180deg) scale(-1, -1)";
        }

        console.log(
          "[setupInitialMapOrientation] Rotação aplicada manualmente: 180°"
        );
      } else {
        console.warn(
          "[setupInitialMapOrientation] Elementos do mapa não encontrados"
        );
      }
    }

    // 3. Salvar o estado de rotação
    if (navigationState) {
      navigationState.currentHeading = 180;
      navigationState.isRotationEnabled = true;
    }

    // 4. Atualizar variáveis CSS para contrabalançar a rotação em outros elementos
    document.documentElement.style.setProperty("--map-rotation", "180deg");
    document.documentElement.style.setProperty(
      "--map-rotation-inverse",
      "-180deg"
    );

    // 5. Adicionar classe ao body para permitir outros ajustes por CSS
    document.body.classList.add("map-rotated");

    // 6. Corrigir especificamente os marcadores e popups
    adjustMarkersForRotation();

    return true;
  } catch (error) {
    console.error(
      "[setupInitialMapOrientation] Erro ao configurar orientação do mapa:",
      error
    );
    return false;
  }
}

/**
 * Ajusta os marcadores e outros elementos para a rotação do mapa
 */
function adjustMarkersForRotation() {
  // Ajustar marcadores (exceto o do usuário)
  const markers = document.querySelectorAll(
    ".leaflet-marker-icon:not(.user-location-marker)"
  );
  markers.forEach((marker) => {
    marker.style.transform = `${marker.style.transform || ""} rotate(-180deg)`;
    marker.dataset.rotated = "true";
  });

  // Ajustar popups
  const popups = document.querySelectorAll(".leaflet-popup-content");
  popups.forEach((popup) => {
    popup.style.transform = "rotate(-180deg)";
  });

  // Ajustar controles de zoom
  const zoomControls = document.querySelectorAll(".leaflet-control-zoom a");
  zoomControls.forEach((control) => {
    control.style.transform = "rotate(-180deg)";
  });

  console.log(
    "[adjustMarkersForRotation] Elementos do mapa ajustados para rotação"
  );
}
