/**
 * Plugin Leaflet.MapBearing
 * Adiciona suporte para rotação de mapa no Leaflet
 */

(function () {
  L.Map.mergeOptions({
    bearing: 0,
    maxBearing: 360,
  });

  L.Map.include({
    setBearing: function (angle) {
      if (!angle) angle = 0;
      this.bearing = angle;

      // Rotacionar elementos do mapa
      const container = this.getContainer();
      const mapPane = this._mapPane;
      const controlPane = document.querySelector(".leaflet-control-container");
      const rotationAngle = -angle;

      // Aplicar transformação
      if (mapPane) {
        mapPane.style.transition = "transform 0.3s ease-out";
        mapPane.style.transform = `rotate(${rotationAngle}deg)`;
      }

      if (controlPane) {
        // Manter controles na orientação normal
        controlPane.style.transition = "transform 0.3s ease-out";
        controlPane.style.transform = `rotate(${-rotationAngle}deg)`;
      }

      // Adicionar variáveis CSS para uso em outros elementos
      if (container) {
        container.style.setProperty("--map-rotation", `${angle}deg`);
        container.style.setProperty(
          "--map-rotation-inverse",
          `${rotationAngle}deg`
        );
      }

      // Disparar evento de rotação
      this.fire("rotate", { angle: angle });

      return this;
    },

    getBearing: function () {
      return this.bearing;
    },

    resetBearing: function () {
      return this.setBearing(0);
    },
  });
})();
