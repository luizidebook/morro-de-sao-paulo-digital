/**
 * leaflet.rotateMap.js
 * Plugin para rotação de mapas Leaflet com suporte a contra-rotação de elementos
 */
(function () {
  // Verificar se o Leaflet está carregado
  if (typeof L === "undefined") {
    console.error("Leaflet deve ser carregado antes deste plugin");
    return;
  }

  console.log("[leaflet.rotateMap] Plugin inicializado com sucesso");

  // Adicionar método de rotação ao mapa - CORRIGIDO para evitar recursão
  L.Map.include({
    // Propriedade para armazenar o ângulo atual
    _bearing: 0,

    // Método para obter o ângulo atual
    getBearing: function () {
      return this._bearing;
    },

    // Método para definir o ângulo de rotação
    setBearing: function (angle) {
      // Armazenar o ângulo
      this._bearing = angle;

      // Normalizar o ângulo entre 0-360
      const normalizedAngle = ((angle % 360) + 360) % 360;

      // Aplicar rotação ao contêiner do mapa
      const mapContainer = this.getContainer();
      if (mapContainer) {
        mapContainer.style.transform = `rotate(${normalizedAngle}deg)`;

        // Adicionar classe para estilização
        mapContainer.classList.add("leaflet-map-rotated");

        // Definir variáveis CSS para uso em contra-rotações
        document.documentElement.style.setProperty(
          "--map-bearing",
          `${normalizedAngle}deg`
        );
        document.documentElement.style.setProperty(
          "--bearing-inverse",
          `-${normalizedAngle}deg`
        );
        document.documentElement.style.setProperty(
          "--bearing-value",
          `${normalizedAngle}`
        );

        // Disparar evento de rotação para outros componentes reagirem
        this.fire("rotate", { bearing: normalizedAngle });
      }

      return this;
    },

    // Método para resetar a rotação
    resetBearing: function () {
      return this.setBearing(0);
    },
  });

  // Adicionar controle de rotação
  L.Control.Rotate = L.Control.extend({
    options: {
      position: "topright",
      autoHide: false,
    },

    onAdd: function (map) {
      const container = L.DomUtil.create(
        "div",
        "leaflet-control-rotate leaflet-bar"
      );
      const button = L.DomUtil.create(
        "a",
        "leaflet-control-rotate-button",
        container
      );

      button.innerHTML = "⤿";
      button.href = "#";
      button.title = "Resetar rotação";

      L.DomEvent.on(button, "click", L.DomEvent.stopPropagation)
        .on(button, "click", L.DomEvent.preventDefault)
        .on(button, "click", function () {
          map.resetBearing();
        });

      this._map = map;

      // Mostrar/esconder o botão conforme a rotação
      if (this.options.autoHide) {
        this._map.on("rotate", function (e) {
          container.style.display = e.bearing === 0 ? "none" : "block";
        });
        container.style.display = "none";
      }

      return container;
    },
  });

  // Criar função factory para o controle de rotação
  L.control.rotate = function (options) {
    return new L.Control.Rotate(options);
  };

  // Adicionar CSS necessário
  function addRotationStyles() {
    if (document.getElementById("leaflet-rotate-style")) return;

    const styleElem = document.createElement("style");
    styleElem.id = "leaflet-rotate-style";
    styleElem.textContent = `
      .leaflet-rotate-enabled {
        transition: transform 0.3s ease-out;
        transform-origin: center center !important;
        backface-visibility: hidden;
        perspective: 1000px;
      }
      
      /* CORREÇÃO: Contra-rotacionar todos os elementos do painel de controle */
      .leaflet-map-rotated .leaflet-control-container .leaflet-top,
      .leaflet-map-rotated .leaflet-control-container .leaflet-bottom,
      .leaflet-map-rotated .leaflet-control,
      .leaflet-map-rotated .leaflet-control-scale,
      .leaflet-map-rotated .leaflet-control-attribution {
        transform: rotate(var(--bearing-inverse)) !important;
        transform-origin: center center;
      }
      
      /* CORREÇÃO: Assegurar que textos não fiquem de cabeça para baixo */
      .leaflet-map-rotated .leaflet-marker-icon:not(.user-location-marker),
      .leaflet-map-rotated .leaflet-popup,
      .leaflet-map-rotated .leaflet-tooltip {
        transform: rotate(var(--bearing-inverse)) !important;
      }
      
      /* CORREÇÃO: Manter o popup alinhado */
      .leaflet-map-rotated .leaflet-popup-tip-container {
        transform: rotate(var(--bearing-inverse)) !important;
      }
    `;

    document.head.appendChild(styleElem);
  }

  // Adicionar estilos quando o plugin é carregado
  addRotationStyles();

  console.log("[leaflet.rotateMap] Plugin inicializado com sucesso");
})();
