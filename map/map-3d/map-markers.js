import { map } from "./map-init.js";
import { flyToWithOffset } from "./map-utils.js";
/**
 * Módulo de Marcadores do Mapa
 * Gerencia marcadores, exibição de locais e ícones.
 */

// Variáveis de controle de mapa e marcadores
export let markers = []; // Array global para armazenar os marcadores no mapa
export let userLocation = null;
// Instância do mapa Leaflet
let userPopupShown = false;

/**
 * Limpa todos os marcadores e rotas existentes no mapa.
 */
export function clearMarkers() {
  if (!map) {
    console.error("[clearMarkers] map não está inicializado.");
    return;
  }

  markers.forEach((marker) => {
    // Remove todos os marcadores, exceto o marcador da localização do usuário
    if (marker.options?.title !== "Sua localização") {
      map.removeLayer(marker);
    }
  });

  // Mantém apenas o marcador da localização do usuário
  markers = markers.filter(
    (marker) => marker.options?.title === "Sua localização"
  );

  console.log(
    "[clearMarkers] Marcadores antigos removidos, exceto a localização do usuário."
  );
}

/**
 * Mostra uma localização no mapa com base no nome do local e coordenadas.
 * @param {string} locationName - Nome descritivo (ex: 'Praia do Encanto')
 * @param {number} lat - Latitude da localização
 * @param {number} lon - Longitude da localização
 */
export function showLocationOnMap(locationName, lat, lon) {
  if (!map) {
    console.error("[showLocationOnMap] map não está inicializado.");
    return;
  }

  clearMarkers();

  if (!lat || !lon) {
    console.warn(
      "[showLocationOnMap] Coordenadas inválidas para a localização:",
      locationName
    );
    return;
  }

  try {
    const icon = getMarkerIconForLocation(locationName.toLowerCase());
    if (!icon) {
      console.error(
        "[showLocationOnMap] Nenhum ícone válido encontrado para a localização:",
        locationName
      );
      return;
    }

    const marker = window.L.marker([lat, lon], { icon }).addTo(map);
    marker.bindPopup(`<h3>${locationName}</h3>`).openPopup(); // Exibe apenas o nome do local
    markers.push(marker);

    // 10% do mapa para cima (em pixels)
    const offsetY = map.getSize().y * 0.3;
    flyToWithOffset(lat, lon, offsetY, 16);
  } catch (error) {
    console.error("[showLocationOnMap] Erro ao adicionar marcador:", error);
  }
}

/**
 * Exibe todos os marcadores de uma categoria no mapa.
 * @param {Array} locations - Lista de locais com nome, latitude e longitude.
 */
export function showAllLocationsOnMap(locations) {
  clearMarkers();

  if (!locations || locations.length === 0) {
    console.warn("Nenhuma localização encontrada para exibir.");
    return;
  }

  const bounds = window.L.latLngBounds();

  locations.forEach((location) => {
    const { name, lat, lon } = location;

    // Limite: só exibe marcadores dentro do raio de 10km do ponto central
    if (!lat || !lon || !isWithinRadius(lat, lon, -13.376, -38.917, 10000)) {
      return;
    }

    // Verifica se as coordenadas coincidem com a localização do usuário
    if (
      userLocation &&
      lat === userLocation.latitude &&
      lon === userLocation.longitude
    ) {
      console.warn(
        `[showAllLocationsOnMap] Ignorando local com coordenadas da localização do usuário: ${name}`
      );
      return;
    }

    const icon = getMarkerIconForLocation(name.toLowerCase());
    const marker = window.L.marker([lat, lon], { icon }).addTo(map);
    marker.bindPopup(`<h3>${name}</h3>`);
    markers.push(marker);

    bounds.extend([lat, lon]);
  });

  // Ajusta os bounds sem animação
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [40, 40], animate: false });
    setTimeout(() => {
      // Após o fitBounds, ajusta o centro com offset, mas mantém o zoom atual
      const center = bounds.getCenter();
      const offsetY = map.getSize().y * 0.1;
      flyToWithOffset(center.lat, center.lng, offsetY, map.getZoom());
    }, 0); // sem delay perceptível
  }
}

/**
 * Destaca um marcador no mapa com base no nome da localização.
 * @param {string} locationName - Nome da localização.
 */
export function highlightMarker(locationName) {
  const marker = markers.find((m) =>
    m.getPopup().getContent().includes(locationName)
  );
  if (marker) {
    marker.openPopup();
    marker.setZIndexOffset(1000); // Destaca o marcador
    map.flyTo(marker.getLatLng(), 16, { animate: true });
  }
}

export function getMarkerIconForLocation(name) {
  let iconHtml =
    '<i class="fas fa-map-marker-alt" style="font-size: 24px; color: #3b82f6;"></i>'; // HTML padrão
  let className = "custom-marker-icon";
  let iconSize = [24, 24];
  let iconAnchor = [12, 24];
  let popupAnchor = [0, -24];

  // SVG para a seta vermelha do usuário
  const redArrowSvg =
    '<svg viewBox="0 0 24 24" width="32" height="32" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="rgba(0, 0, 0, 0.2)" stroke="#ffffff" stroke-width="1"/><circle cx="12" cy="12" r="3" fill="#ffffff" fill-opacity="0.9"/><path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z" fill="#ff0000" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" /></svg>';

  if (name.includes("praia")) {
    iconHtml =
      '<i class="fas fa-umbrella-beach" style="font-size: 24px; color: #3b82f6;"></i>';
  } else if (name.includes("restaurante") || name.includes("sabores")) {
    iconHtml =
      '<i class="fas fa-utensils" style="font-size: 24px; color: #3b82f6;"></i>';
  } else if (
    name.includes("pousada") ||
    name.includes("hotel") ||
    name.includes("vila")
  ) {
    iconHtml =
      '<i class="fas fa-bed" style="font-size: 24px; color: #3b82f6;"></i>';
  } else if (name.includes("atração") || name.includes("farol")) {
    iconHtml =
      '<i class="fas fa-mountain" style="font-size: 24px; color: #3b82f6;"></i>';
  } else if (name.includes("loja") || name.includes("mercado")) {
    iconHtml =
      '<i class="fas fa-shopping-bag" style="font-size: 24px; color: #3b82f6;"></i>';
  } else if (name.includes("hospital") || name.includes("polícia")) {
    iconHtml =
      '<i class="fas fa-ambulance" style="font-size: 24px; color: #3b82f6;"></i>';
  } else if (
    name.includes("pessoa") ||
    name.includes("você") ||
    name.includes("usuário")
  ) {
    // Usar a seta vermelha SVG em vez do ícone Font Awesome
    iconHtml = redArrowSvg;
    className = "user-location-marker";
    iconSize = [32, 32];
    iconAnchor = [16, 16]; // Centralizar o ícone nas coordenadas
    popupAnchor = [0, -16]; // Ajuste do ponto de ancoragem do popup
  }

  // Retorna um ícone do Leaflet com o HTML apropriado
  return window.L.divIcon({
    html: iconHtml,
    className: className,
    iconSize: iconSize,
    iconAnchor: iconAnchor,
    popupAnchor: popupAnchor,
  });
}

/**
 * Função utilitária para filtrar locais pelo raio de 10km do ponto central
 */
function isWithinRadius(
  lat,
  lon,
  centerLat = -13.376,
  centerLon = -38.917,
  radiusMeters = 10000
) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat - centerLat);
  const dLon = toRad(lon - centerLon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(centerLat)) *
      Math.cos(toRad(lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d <= radiusMeters;
}
