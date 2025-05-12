/**
 * Garante que todos os elementos do mapa estejam corretamente rotacionados
 */
function ensureMapElementsAreRotated() {
  try {
    const tilePane = document.querySelector(".leaflet-tile-pane");

    // Verificar se elementos existem
    if (!tilePane) {
      console.warn(
        "[ensureMapElementsAreRotated] Elementos essenciais do mapa não encontrados"
      );
      return false;
    }

    // Aplicar transformações APENAS ao tile pane
    tilePane.style.transform = "rotate(180deg)";
    tilePane.style.transformOrigin = "center center";

    return true;
  } catch (error) {
    console.error("[ensureMapElementsAreRotated] Erro:", error);
    return false;
  }
}

/**
 * Restaura elementos do mapa à orientação normal
 */
function resetMapRotation() {
  try {
    // Resetar transformações APENAS do tile pane
    const tilePane = document.querySelector(".leaflet-tile-pane");

    if (tilePane) {
      tilePane.style.transform = "none";
    }

    return true;
  } catch (error) {
    console.error("[resetMapRotation] Erro:", error);
    return false;
  }
}

/**
 * Força a rotação do mapa imediatamente
 * @returns {boolean} Se a operação foi bem-sucedida
 */
export function forceMapRotation() {
  try {
    // Usar plugin se disponível
    if (window.map && typeof window.map.setBearing === "function") {
      window.map.setBearing(180);
      return true;
    }

    // Fallback: rotação manual APENAS do tile pane
    const tilePane = document.querySelector(".leaflet-tile-pane");

    if (tilePane) {
      tilePane.style.transform = "rotate(180deg)";
      tilePane.style.transformOrigin = "center center";
    }

    return true;
  } catch (error) {
    console.error("[forceMapRotation] Erro:", error);
    return false;
  }
}
