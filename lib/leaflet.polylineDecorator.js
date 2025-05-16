/**
 * Leaflet Polyline Decorator Plugin
 * Modificado para garantir que o Leaflet esteja carregado antes
 */
(function () {
  // Verificar se o Leaflet está disponível
  if (typeof L === "undefined") {
    console.warn(
      "[leaflet.polylineDecorator] Leaflet não encontrado. Este plugin será inicializado quando Leaflet estiver disponível."
    );

    // Criar um observador para aguardar o Leaflet ser carregado
    let checkInterval = setInterval(function () {
      if (typeof L !== "undefined") {
        clearInterval(checkInterval);
        initPolylineDecorator();
        console.log(
          "[leaflet.polylineDecorator] Leaflet detectado, plugin inicializado."
        );
      }
    }, 200);

    return;
  }

  // Se o Leaflet já estiver carregado, inicializa imediatamente
  initPolylineDecorator();

  function initPolylineDecorator() {
    L.Symbol = L.Symbol || {};

    L.Symbol.arrowHead = function (options) {
      return {
        polygon: true,
        pixelSize: options.pixelSize || 10,
        headAngle: options.headAngle || 30,
        pathOptions: options.pathOptions || { stroke: true },
      };
    };

    L.PolylineDecorator = L.Layer.extend({
      options: {
        patterns: [],
      },

      initialize: function (polyline, options) {
        L.setOptions(this, options);
        this._polyline = polyline;
        this._layers = [];
      },

      onAdd: function (map) {
        this._map = map;
        this._draw();
        return this;
      },

      onRemove: function () {
        this._layers.forEach(function (layer) {
          this._map.removeLayer(layer);
        }, this);
        return this;
      },

      _draw: function () {
        this._layers = [];
        this.options.patterns.forEach(function (pattern) {
          if (pattern.symbol.polygon) {
            this._drawArrowHead(pattern);
          }
        }, this);
      },

      _drawArrowHead: function (pattern) {
        const pathData = this._polyline.getLatLngs();
        if (!pathData.length || pathData.length < 2) return;

        // Calcular os pontos onde colocar as setas
        const points = this._getArrowPoints(pathData, pattern);

        points.forEach(function (point) {
          const arrowHead = this._createArrowHead(
            point.latLng,
            point.angle,
            pattern.symbol
          );
          this._map.addLayer(arrowHead);
          this._layers.push(arrowHead);
        }, this);
      },

      _getArrowPoints: function (pathData, pattern) {
        const points = [];
        const offset = pattern.offset || "0%";
        const repeat = pattern.repeat || "10%";

        // Calcular o comprimento total do polyline
        let totalLength = 0;
        for (let i = 1; i < pathData.length; i++) {
          totalLength += this._map.distance(pathData[i - 1], pathData[i]);
        }

        // Converter offset e repeat para metros
        let offsetM = this._parseDistance(offset, totalLength);
        const repeatM = this._parseDistance(repeat, totalLength);

        // Adicionar setas ao longo do caminho
        let currentLength = 0;

        while (offsetM < totalLength) {
          // Encontrar o segmento onde cai este offset
          let segmentStart = 0;
          let segmentEnd = 1;
          let segmentLength = 0;

          while (segmentEnd < pathData.length) {
            segmentLength = this._map.distance(
              pathData[segmentStart],
              pathData[segmentEnd]
            );
            if (currentLength + segmentLength > offsetM) break;

            currentLength += segmentLength;
            segmentStart++;
            segmentEnd++;
          }

          if (segmentEnd >= pathData.length) break;

          // Calcular a posição exata no segmento
          const ratio = (offsetM - currentLength) / segmentLength;
          const pt = L.latLng(
            pathData[segmentStart].lat +
              ratio * (pathData[segmentEnd].lat - pathData[segmentStart].lat),
            pathData[segmentStart].lng +
              ratio * (pathData[segmentEnd].lng - pathData[segmentStart].lng)
          );

          // Calcular o ângulo
          let angle =
            (Math.atan2(
              pathData[segmentEnd].lat - pathData[segmentStart].lat,
              pathData[segmentEnd].lng - pathData[segmentStart].lng
            ) *
              180) /
            Math.PI;

          points.push({
            latLng: pt,
            angle: angle,
          });

          offsetM += repeatM;
        }

        return points;
      },

      _parseDistance: function (distance, totalLength) {
        if (typeof distance === "string" && distance.endsWith("%")) {
          return (totalLength * parseFloat(distance)) / 100;
        }
        return parseFloat(distance);
      },

      _createArrowHead: function (latLng, angle, symbol) {
        const size = symbol.pixelSize;
        const headAngle = symbol.headAngle;

        // Coordenadas do triângulo da seta
        const points = [
          latLng,
          this._getPointAt(latLng, angle - headAngle, size),
          this._getPointAt(latLng, angle + headAngle, size),
        ];

        return L.polygon(points, symbol.pathOptions);
      },

      _getPointAt: function (latLng, angle, distance) {
        const rad = (angle * Math.PI) / 180;
        const lat = latLng.lat + distance * 0.00001 * Math.sin(rad);
        const lng =
          latLng.lng +
          (distance * 0.00001 * Math.cos(rad)) /
            Math.cos((latLng.lat * Math.PI) / 180);

        return L.latLng(lat, lng);
      },
    });

    L.polylineDecorator = function (polyline, options) {
      return new L.PolylineDecorator(polyline, options);
    };
  }
})();
