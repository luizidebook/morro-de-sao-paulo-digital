/**
 * Configura a rotação inicial do mapa quando a navegação é iniciada
 * Rotaciona o mapa em 180 graus para orientação inversa mantendo os elementos legíveis
 * @param {number} lat - Latitude do usuário
 * @param {number} lon - Longitude do usuário
 * @returns {boolean} - Indica se a operação foi bem-sucedida
 */
export function setupInitialMapOrientation(lat, lon) {
  console.log(
    "[setupInitialMapOrientation] Iniciando com coordenadas:",
    lat,
    lon
  );

  // Obter referência ao mapa global
  const map =
    window.map ||
    (typeof getMapInstance === "function" ? getMapInstance() : null);

  // Usar destino como fallback se a posição do usuário não estiver disponível
  if (
    (!lat || !lon || isNaN(lat) || isNaN(lon)) &&
    window.navigationState &&
    window.navigationState.destination
  ) {
    console.warn(
      "[setupInitialMapOrientation] Usando coordenadas do destino como fallback"
    );
    lat = window.navigationState.destination.lat;
    lon = window.navigationState.destination.lon;
  }

  // Verificação final de coordenadas
  if (!lat || !lon || !map) {
    console.error("[setupInitialMapOrientation] Dados inválidos:", {
      map: !!map,
      lat: lat,
      lon: lon,
    });
    return false;
  }

  try {
    console.log(
      "[setupInitialMapOrientation] Configurando orientação inicial do mapa"
    );

    // 1. Centralizar o mapa na localização do usuário com zoom adequado
    map.setView([lat, lon], 18, { animate: true });

    // 2. Aplicar rotação de 180 graus APENAS ao mapa
    if (typeof map.setBearing === "function") {
      // Usar o plugin leaflet.mapbearing.js
      map.setBearing(180);
      console.log(
        "[setupInitialMapOrientation] Rotação aplicada via plugin: 180°"
      );
    } else {
      // Fallback: aplicar rotação APENAS ao tile pane (camada de mapa)
      const tilePane = document.querySelector(".leaflet-tile-pane");

      if (tilePane) {
        // Definir estilos de transição para animação suave
        const transitionStyle = "transform 0.5s ease-out";

        // Rotacionar APENAS o conteúdo do mapa
        tilePane.style.transition = transitionStyle;
        tilePane.style.transformOrigin = "center center";
        tilePane.style.transform = "rotate(180deg)";

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
    if (window.navigationState) {
      window.navigationState.currentHeading = 180;
      window.navigationState.isRotationEnabled = true;
    }

    // Não adicionar classe ao body para evitar estilos em cascata
    // que poderiam afetar outros elementos

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
 * Reinicia a orientação do mapa para o estado padrão
 */
export function resetMapOrientation() {
  try {
    const map = window.map;
    if (!map) return false;

    // Usar plugin se disponível
    if (typeof map.setBearing === "function") {
      map.setBearing(0);
      console.log("[resetMapOrientation] Rotação resetada via plugin");
      return true;
    }

    // Fallback: resetar manualmente APENAS o tile pane
    const tilePane = document.querySelector(".leaflet-tile-pane");

    if (tilePane) {
      tilePane.style.transform = "none";
    }

    // Atualizar estado
    if (window.navigationState) {
      window.navigationState.currentHeading = 0;
      window.navigationState.isRotationEnabled = false;
    }

    return true;
  } catch (error) {
    console.error("[resetMapOrientation] Erro ao resetar orientação:", error);
    return false;
  }
}
