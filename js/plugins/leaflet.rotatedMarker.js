(function () {
  // Verificar se o Leaflet está disponível
  if (typeof L === "undefined") {
    console.error("Leaflet deve estar carregado antes deste plugin.");
    return;
  }

  // Extender o objeto L.Marker para adicionar suporte à rotação
  L.Marker.prototype.options.rotationOrigin = "center center";
  L.Marker.prototype.options.rotationAngle = 0;

  // Método para definir o ângulo de rotação
  L.Marker.prototype.setRotationAngle = function (angle) {
    this.options.rotationAngle = angle;

    // Atualizar o marcador imediatamente se ele estiver no mapa
    if (this._icon) {
      this._updateIconStyle(this._icon, this.options);

      // Log para debug
      console.log(
        `[leaflet.rotatedMarker] Aplicando rotação de ${angle.toFixed(
          1
        )}° ao marcador`
      );
    }
    return this;
  };

  // Método para definir a origem da rotação
  L.Marker.prototype.setRotationOrigin = function (origin) {
    this.options.rotationOrigin = origin;

    // Atualizar o marcador imediatamente se ele estiver no mapa
    if (this._icon) {
      this._updateIconStyle(this._icon);
    }
    return this;
  };

  // Extender _initIcon para garantir que o ícone seja devidamente inicializado com rotação
  const originalInitIcon = L.Marker.prototype._initIcon;
  L.Marker.prototype._initIcon = function () {
    originalInitIcon.call(this);

    // Aplicar rotação após inicialização do ícone
    this._updateIconStyle(this._icon, this.options);
  };

  // Extender _setPos para manter a rotação durante reposicionamentos
  const originalSetPos = L.Marker.prototype._setPos;
  L.Marker.prototype._setPos = function (pos) {
    originalSetPos.call(this, pos);

    // Reaplicar rotação após reposicionamento
    this._updateIconStyle(this._icon, this.options);
  };

  // Método auxiliar para aplicar estilos de rotação
  L.Marker.prototype._updateIconStyle = function (icon, options) {
    if (!icon || !options) return;

    const angle = options.rotationAngle || 0;
    const origin = options.rotationOrigin || "center center";

    // Adicionar estilo de rotação
    icon.style.transformOrigin = origin;

    // Verificar se já existe um transform e adicionar rotação
    let transform = "";
    const existingTransform = icon.style.transform || "";

    // Remover qualquer rotação existente do transform atual
    if (existingTransform.includes("rotate")) {
      transform = existingTransform.replace(/rotate\([^)]+\)/g, "");
    } else {
      transform = existingTransform;
    }

    // Adicionar a nova rotação
    transform = transform.trim() + ` rotate(${angle}deg)`;
    icon.style.transform = transform;

    // Suporte para navegadores que exigem prefixos
    icon.style.webkitTransform = transform;
    icon.style.MozTransform = transform;
    icon.style.msTransform = transform;
    icon.style.OTransform = transform;
  };

  console.log("[leaflet.rotatedMarker] Plugin inicializado com sucesso");
})();

// Adicionar ao leaflet.rotatedMarker.js ou onde a rotação é aplicada
function applyRotationToMarker(marker, degrees, is3DMode) {
  if (!marker || typeof degrees !== "number" || isNaN(degrees)) {
    console.warn("[leaflet.rotatedMarker] Rotação inválida:", degrees);
    return;
  }

  try {
    console.log(
      `[leaflet.rotatedMarker] Aplicando rotação de ${degrees.toFixed(
        1
      )}° ao marcador`
    );

    const el = marker.getElement();
    if (!el) return;

    // Adicionar classe para animação suave
    el.classList.add("rotating");

    // Aplicar rotação diferente para modo 3D
    if (is3DMode) {
      // No modo 3D, alinhamos com o mapa
      el.style.transform = `rotate(${degrees}deg)`;
    } else {
      // No modo normal, rotacionamos o ícone
      el.style.transform = `rotate(${degrees}deg)`;
    }

    // Armazenar rotação atual para referência
    marker._bearing = degrees;
  } catch (error) {
    console.error("[leaflet.rotatedMarker] Erro ao aplicar rotação:", error);
  }
}
