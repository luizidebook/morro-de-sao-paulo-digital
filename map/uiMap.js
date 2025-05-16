import { map } from "../map/map-controls.js"; // Importa a instância do mapa
import { userLocation } from "../map/map-controls.js";

export let markers = []; // Array global para armazenar os marcadores no mapa

/**
 * Esconde ou elimina o popup associado a um nome específico
 * @param {string} name - O nome do local associado ao popup
 * @param {boolean} [remove=false] - Se true, elimina o popup; caso contrário, apenas esconde
 */
export function hidePopup(name, remove = false) {
  // Encontrar todos os popups abertos no mapa
  const popupElements = document.querySelectorAll(".leaflet-popup");

  // Iterar sobre os popups para encontrar o que contém o nome especificado
  popupElements.forEach((popup) => {
    const h3 = popup.querySelector(".custom-popup h3");
    if (h3 && h3.textContent.trim() === name) {
      if (remove) {
        // Eliminar o popup do DOM
        popup.remove();
      } else {
        // Esconder o popup
        popup.style.display = "none";
      }
    }
  });

  // Se nenhum popup for encontrado, exibir um aviso
  if (!popupElements.length) {
    console.warn(`Popup para "${name}" não encontrado.`);
  }
}

/**
 * Limpa todos os marcadores e rotas existentes no mapa.
 */
export function clearMarkers() {
  if (!map) {
    console.error("[clearMarkers] map não está inicializado.");
    return;
  }

  markers.forEach((marker) => {
    if (
      marker !== selectedDestination.marker &&
      marker.options?.title !== "Sua localização"
    ) {
      map.removeLayer(marker); // Remove o marcador do mapa
    }
  });

  // Atualiza o array de marcadores para conter apenas o marcador do destino
  markers = markers.filter(
    (marker) =>
      marker === selectedDestination.marker ||
      marker.options?.title === "Sua localização"
  );

  console.log(
    "[clearMarkers] Marcadores antigos removidos, exceto o destino e a localização do usuário."
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
    marker.bindPopup(createPopupContent(locationName)).openPopup();
    markers.push(marker);

    map.flyTo([lat, lon], 16, { animate: true, duration: 1.5 });
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
    marker.bindPopup(createPopupContent(name));
    markers.push(marker);

    bounds.extend([lat, lon]);
  });

  map.fitBounds(bounds); // Ajusta o mapa para mostrar todos os marcadores
}

/**
 * Seleciona o ícone apropriado com base no tipo de localização usando Font Awesome.
 * @param {string} name - Nome do local.
 * @returns {Object} Configuração do ícone.
 */
function getMarkerIconForLocation(name) {
  let iconClass = "fa-map-marker-alt"; // Ícone padrão

  if (name.includes("praia")) {
    iconClass = "fa-umbrella-beach";
  } else if (name.includes("restaurante") || name.includes("sabores")) {
    iconClass = "fa-utensils";
  } else if (
    name.includes("pousada") ||
    name.includes("hotel") ||
    name.includes("vila")
  ) {
    iconClass = "fa-bed";
  } else if (name.includes("atração") || name.includes("farol")) {
    iconClass = "fa-mountain";
  } else if (name.includes("loja") || name.includes("mercado")) {
    iconClass = "fa-shopping-bag";
  } else if (name.includes("hospital") || name.includes("polícia")) {
    iconClass = "fa-ambulance";
  }

  // Retorna um ícone do Leaflet com Font Awesome
  return window.L.divIcon({
    html: `<i class="fas ${iconClass}" style="font-size: 24px; color: #3b82f6;"></i>`,
    className: "custom-marker-icon",
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
}

/**
 * Cria conteúdo HTML personalizado para os popups
 */
/**
 * Creates the HTML content for a popup.
 * @param {string} name - The name of the location.
 * @returns {string} - The HTML string for the popup content.
 */
export function createPopupContent(name) {
  return `<div class="custom-popup">
    <h3>${name}</h3>
    <p>${getLocationDescription(name.toLowerCase())}</p>
    <div class="popup-buttons">
      <button class="popup-button" onclick="window.navigateTo('${name.toLowerCase()}')">Mais detalhes</button>
      <button class="popup-button" onclick="startCarousel('${name}')">Fotos</button>
      <button class="popup-button" onclick="showRoute('${name}')">Como Chegar</button>
    </div>
  </div>`;
}

/**
 * Retorna uma descrição curta para a localização
 */
export function getLocationDescription(key) {
  const descriptions = {
    "primeira praia":
      "a favorita dos moradores, com suas ondas perfeitas para surfe e piscinas naturais ideais para mergulho.",
    "segunda praia": "A mais movimentada e cheia de quiosques.",
    "terceira praia": "Mais tranquila, com águas calmas.",
    "quarta praia": "Extensa e com menos estrutura, perfeita para caminhadas.",
    "praia do encanto": "Paraíso isolado com águas cristalinas.",
    // Adicione mais descrições conforme necessário
  };

  return (
    descriptions[key] ||
    "Um local incrível para conhecer em Morro de São Paulo."
  );
}
