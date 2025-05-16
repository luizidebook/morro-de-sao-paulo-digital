/**
 * Adaptador para compatibilidade entre modos de mapa (2D e 3D)
 * Permite que as mesmas funções funcionem em ambos os modos
 */

import { getMapInstance } from "./map-init.js";
import {
  is3DModeActive,
  getMapbox3DInstance,
  addMarker3D,
  clearMarkers3D,
  showRoute3D,
} from "./map-3d/map-3d.js";

/**
 * Obtém a instância do mapa ativo (2D ou 3D)
 * @returns {Object} Instância do mapa ativo
 */
export function getActiveMapInstance() {
  return is3DModeActive() ? getMapbox3DInstance() : getMapInstance();
}

/**
 * Adiciona um marcador ao mapa ativo (2D ou 3D)
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Object} options - Opções do marcador
 * @returns {Object} Marcador criado
 */
export function addMarkerToActiveMap(lat, lon, options = {}) {
  if (is3DModeActive()) {
    return addMarker3D(lat, lon, options);
  } else {
    const map = getMapInstance();
    if (!map) return null;

    // Criar marcador para mapa 2D (Leaflet)
    let icon;

    if (options.icon) {
      icon = options.icon;
    } else if (
      options.className &&
      options.className.includes("user-location")
    ) {
      // Ícone para localização do usuário
      icon = L.divIcon({
        html: `<i class="fas fa-dot-circle" style="color: #3b82f6; font-size: 24px;"></i>`,
        className: "user-location-marker",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
    } else {
      // Ícone padrão ou personalizado
      icon = L.divIcon({
        html: `<i class="fas fa-map-marker-alt" style="font-size: 24px; color: #3b82f6;"></i>`,
        className: "custom-marker-icon",
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24],
      });
    }

    // Criar e adicionar marcador
    const marker = L.marker([lat, lon], {
      icon: icon,
      title: options.title || "",
    }).addTo(map);

    // Adicionar popup se fornecido
    if (options.popupContent) {
      marker.bindPopup(options.popupContent);
      if (options.openPopup) {
        marker.openPopup();
      }
    }

    return marker;
  }
}

/**
 * Limpa marcadores no mapa ativo
 * @param {boolean} preserveUserMarker - Se deve preservar o marcador do usuário
 */
export function clearMarkersOnActiveMap(preserveUserMarker = false) {
  if (is3DModeActive()) {
    clearMarkers3D(preserveUserMarker);
  } else {
    // Importar função de limpeza do mapa 2D e executar
    import("./map-markers.js")
      .then((module) => {
        if (typeof module.clearMarkers === "function") {
          module.clearMarkers();
        }
      })
      .catch((err) => {
        console.error(
          "[map-mode-adapter] Erro ao importar módulo de marcadores:",
          err
        );
      });
  }
}

/**
 * Mostra uma rota no mapa ativo
 * @param {Object} destination - Destino da rota
 * @param {Object} options - Opções adicionais
 */
export function showRouteOnActiveMap(destination, options = {}) {
  if (!destination || !destination.lat || !destination.lon) {
    console.error("[map-mode-adapter] Destino inválido para rota");
    return;
  }

  if (is3DModeActive()) {
    // Obter localização do usuário para origem
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        // Mostrar rota no mapa 3D
        showRoute3D({
          startLat: latitude,
          startLon: longitude,
          endLat: destination.lat,
          endLon: destination.lon,
          destinationName: destination.name || "Destino",
        });
      },
      (error) => {
        console.error(
          "[map-mode-adapter] Erro ao obter localização para rota:",
          error
        );
        alert("Não foi possível obter sua localização para calcular a rota.");
      }
    );
  } else {
    // Importar função de rota do mapa 2D e executar
    import("./map-controls.js")
      .then((module) => {
        if (typeof module.showRoute === "function") {
          module.showRoute(destination);
        }
      })
      .catch((err) => {
        console.error(
          "[map-mode-adapter] Erro ao importar módulo de controles:",
          err
        );
      });
  }
}

/**
 * Mostra local no mapa ativo
 * @param {string} locationName - Nome do local
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Object} options - Opções adicionais
 */
export function showLocationOnActiveMap(locationName, lat, lon, options = {}) {
  if (is3DModeActive()) {
    // Limpar marcadores existentes
    clearMarkers3D(options.preserveUserMarker !== false);

    // Voar para a localização
    const mapbox3D = getMapbox3DInstance();
    if (mapbox3D) {
      mapbox3D.flyTo({
        center: [lon, lat],
        zoom: options.zoom || 16,
        pitch: options.pitch || 60,
        bearing: options.bearing || 0,
        duration: 2000,
      });
    }

    // Adicionar marcador
    addMarker3D(lat, lon, {
      title: locationName,
      popupContent: `<h3>${locationName}</h3>`,
      openPopup: true,
    });
  } else {
    // Importar função do mapa 2D e executar
    import("./map-markers.js")
      .then((module) => {
        if (typeof module.showLocationOnMap === "function") {
          module.showLocationOnMap(locationName, lat, lon, options);
        }
      })
      .catch((err) => {
        console.error(
          "[map-mode-adapter] Erro ao importar módulo de marcadores:",
          err
        );
      });
  }
}

/**
 * Mostra múltiplos locais no mapa ativo
 * @param {Array} locations - Lista de locais para exibir
 * @param {Object} options - Opções adicionais
 */
export function showAllLocationsOnActiveMap(locations, options = {}) {
  if (is3DModeActive()) {
    // Limpar marcadores existentes
    clearMarkers3D(options.preserveUserMarker !== false);

    if (!locations || !locations.length) return;

    // Criar bounds para ajustar visualização
    const bounds = new mapboxgl.LngLatBounds();

    // Adicionar cada localização
    locations.forEach((location) => {
      const { name, lat, lon } = location;

      // Adicionar ao bounds
      bounds.extend([lon, lat]);

      // Adicionar marcador
      addMarker3D(lat, lon, {
        title: name,
        popupContent: `<h3>${name}</h3>`,
      });
    });

    // Ajustar visualização para mostrar todos os pontos
    const mapbox3D = getMapbox3DInstance();
    if (mapbox3D && !bounds.isEmpty()) {
      mapbox3D.fitBounds(bounds, {
        padding: 50,
        pitch: 45,
        duration: 2000,
      });
    }
  } else {
    // Importar função do mapa 2D e executar
    import("./map-markers.js")
      .then((module) => {
        if (typeof module.showAllLocationsOnMap === "function") {
          module.showAllLocationsOnMap(locations, options);
        }
      })
      .catch((err) => {
        console.error(
          "[map-mode-adapter] Erro ao importar módulo de marcadores:",
          err
        );
      });
  }
}

/**
 * Certifica-se de que todas as referências globais para o mapa estão sincronizadas
 * @param {Object} mapInstance - Instância do mapa a ser sincronizada
 */
export function syncMapReferences(mapInstance) {
  if (!mapInstance) return;

  // Atualizar referência na janela global
  window.map = mapInstance;

  // Atualizar referência no módulo map-init se possível
  import("./map-init.js")
    .then((module) => {
      if (module && typeof module.updateMapReference === "function") {
        module.updateMapReference(mapInstance);
      } else {
        // Alternativa: atribuir diretamente
        if (module && "map" in module) {
          module.map = mapInstance;
        }
      }
    })
    .catch((err) =>
      console.error(
        "[map-mode-adapter] Erro ao sincronizar referência de mapa:",
        err
      )
    );
}
