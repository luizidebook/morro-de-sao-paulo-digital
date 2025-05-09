/**
 * Atualiza o marcador do usuário no mapa
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} heading - Direção em graus (0-359)
 * @param {number} accuracy - Precisão em metros
 * @returns {boolean} Sucesso da operação
 */
export function updateUserMarker(lat, lon, heading = 0, accuracy = 15) {
  // Validação robusta dos parâmetros
  if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) {
    console.error("[updateUserMarker] Coordenadas inválidas:", lat, lon);
    return false;
  }

  try {
    const mapInstance = map;
    if (!mapInstance) {
      console.warn("[updateUserMarker] Instância de mapa não disponível");
      return false;
    }

    // Criar marcador se não existir
    if (!window.userMarker) {
      return createUserMarker(lat, lon, heading, accuracy);
    }

    // Atualizar posição
    window.userMarker.setLatLng([lat, lon]);

    // Aplicar rotação
    if (typeof heading === "number" && !isNaN(heading)) {
      // Via plugin se disponível
      if (typeof window.userMarker.setRotationAngle === "function") {
        window.userMarker.setRotationAngle(heading);
        console.log(`[updateUserMarker] Aplicando rotação: ${heading}°`);
      }
      // Fallback via CSS
      else {
        try {
          const markerElement =
            window.userMarker._icon ||
            (window.userMarker.getElement
              ? window.userMarker.getElement()
              : null);

          if (markerElement) {
            markerElement.style.transform = `rotate(${heading}deg)`;
          }
        } catch (error) {
          console.error(
            "[updateUserMarker] Erro ao aplicar rotação via CSS:",
            error
          );
        }
      }
    }

    // Atualizar círculo de precisão
    if (window.userAccuracyCircle) {
      window.userAccuracyCircle.setLatLng([lat, lon]);
      window.userAccuracyCircle.setRadius(accuracy);
    }

    // ADICIONAR NO FINAL DA FUNÇÃO: Elemento visual de depuração
    try {
      if (!document.getElementById("debug-rotation")) {
        const debugEl = document.createElement("div");
        debugEl.id = "debug-rotation";
        debugEl.style =
          "position:fixed; bottom:70px; left:10px; background:rgba(0,0,0,0.7); color:white; padding:5px; z-index:9999; font-size:14px;";
        document.body.appendChild(debugEl);
      }

      document.getElementById("debug-rotation").innerHTML =
        `Ângulo: ${heading.toFixed(1)}°<br>` +
        `Plugin ativo: ${
          typeof window.userMarker.setRotationAngle === "function"
            ? "Sim"
            : "Não"
        }<br>` +
        `IconURL: ${
          window.userMarker.getIcon
            ? window.userMarker.getIcon().options.iconUrl || "SVG"
            : "?"
        }`;
    } catch (e) {}

    return true;
  } catch (error) {
    console.error("[updateUserMarker] Erro:", error);
    return false;
  }
}
