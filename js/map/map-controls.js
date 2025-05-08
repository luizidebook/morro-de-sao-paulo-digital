// map-control.js - Controle e interação com o mapa Leaflet

import { showNotification } from "../utils/notifications.js";

import { apiKey } from "./osm-service.js"; // Importa a chave da API
import {
  getContext,
  updateContext,
} from "../assistant/assistant-context/context-manager.js";
import {
  clearAssistantMessages,
  appendMessage,
} from "../assistant/assistant.js";
import { animateMapToLocalizationUser } from "../navigation/navigationUserLocation/user-location.js";
import { updateUserMarker } from "../navigation/navigationUserLocation/user-location.js";
import { setLastRouteData } from "../navigation/navigationState/navigationStateManager.js";
/* O que esse módulo cobre:
Inicializa o mapa OpenStreetMap com Leaflet.
Centraliza o mapa em Morro de São Paulo.
Permite ao assistente exibir localizações com base no nome.
Remove marcadores e rotas anteriores para manter o mapa limpo.
Adiciona controle de geolocalização para o usuário encontrar sua localização no mapa.
*/

// Variáveis de controle de mapa e marcadores
export let markers = []; // Array global para armazenar os marcadores no mapa
export let userLocation = null;
export let map;
export let mapInstance;
export let selectedRoute = {}; // Variável global para armazenar a rota selecionada
// Instância do mapa Leaflet
let userPopupShown = false;

// Adicionar sistema de cache para rotas

// No início do arquivo:
const routeCache = new Map();

export function generateRouteCacheKey(
  startLat,
  startLon,
  destLat,
  destLon,
  profile
) {
  return `${startLat.toFixed(6)}_${startLon.toFixed(6)}_${destLat.toFixed(
    6
  )}_${destLon.toFixed(6)}_${profile}`;
}

// Adicione esta função ao final do arquivo map-controls.js

/**
 * Adiciona controle de rotação ao mapa
 * @param {Object} mapInstance - Instância do mapa (opcional)
 */
export function addRotationControl(mapInstance) {
  const targetMap = mapInstance || (typeof map !== "undefined" ? map : null);

  if (!targetMap) {
    console.error("[addRotationControl] Mapa não disponível");
    return;
  }

  // Verificar se o mapa está inicializado
  if (!targetMap.getContainer) {
    console.error("[addRotationControl] Mapa não inicializado corretamente");
    return;
  }

  try {
    console.log(
      "[addRotationControl] Verificando disponibilidade de plugin de rotação"
    );

    // Verificar se o plugin está disponível
    if (
      typeof L.control.rotate !== "function" ||
      typeof targetMap.setBearing !== "function"
    ) {
      console.warn(
        "[addRotationControl] Plugin de rotação não carregado corretamente"
      );

      // Tentar inicializar o plugin se a função estiver disponível
      if (typeof window.initLeafletRotatePlugin === "function") {
        console.log(
          "[addRotationControl] Tentando inicializar plugin de rotação manualmente"
        );
        window.initLeafletRotatePlugin();
      }

      // Verificar novamente
      if (typeof L.control.rotate !== "function") {
        // Criar um controle personalizado como fallback
        console.log(
          "[addRotationControl] Criando controle personalizado de rotação"
        );

        const rotationControl = L.Control.extend({
          options: {
            position: "topright",
          },

          onAdd: function () {
            const container = L.DomUtil.create(
              "div",
              "custom-rotation-control leaflet-bar"
            );

            // Botão de rotação de 90°
            const rotate90Button = L.DomUtil.create(
              "a",
              "rotate-90",
              container
            );
            rotate90Button.innerHTML = "↻";
            rotate90Button.title = "Rotacionar mapa 90°";
            rotate90Button.href = "#";

            // Botão para resetar rotação
            const resetButton = L.DomUtil.create(
              "a",
              "reset-rotation",
              container
            );
            resetButton.innerHTML = "⊥";
            resetButton.title = "Resetar rotação";
            resetButton.href = "#";

            // Eventos
            L.DomEvent.on(rotate90Button, "click", function (e) {
              L.DomEvent.stopPropagation(e);
              L.DomEvent.preventDefault(e);

              // Rotacionar 90 graus manualmente
              if (typeof targetMap.setBearing === "function") {
                const currentAngle = targetMap.getBearing
                  ? targetMap.getBearing()
                  : 0;
                targetMap.setBearing((currentAngle + 90) % 360);
              } else {
                console.warn(
                  "[addRotationControl] Função setBearing não disponível"
                );
              }
            });

            L.DomEvent.on(resetButton, "click", function (e) {
              L.DomEvent.stopPropagation(e);
              L.DomEvent.preventDefault(e);

              // Resetar rotação
              if (typeof targetMap.setBearing === "function") {
                targetMap.setBearing(0);
              } else {
                console.warn(
                  "[addRotationControl] Função setBearing não disponível"
                );
              }
            });

            return container;
          },
        });

        // Adicionar ao mapa
        new rotationControl().addTo(targetMap);
        console.log("[addRotationControl] Controle personalizado adicionado");
      } else {
        // Usar o controle do plugin se disponível agora
        L.control.rotate({ position: "topright" }).addTo(targetMap);
        console.log(
          "[addRotationControl] Controle de rotação do plugin adicionado após inicialização"
        );
      }
    } else {
      // Usar o controle do plugin
      L.control.rotate({ position: "topright" }).addTo(targetMap);
      console.log(
        "[addRotationControl] Controle de rotação do plugin adicionado"
      );
    }

    // Garantir que o mapa possa ser rotacionado
    if (typeof targetMap.setBearing === "function") {
      // Definir rotação inicial como 0 para garantir que as classes CSS e variáveis sejam configuradas
      targetMap.setBearing(0);
      console.log("[addRotationControl] Rotação inicial configurada");
    }

    return true;
  } catch (error) {
    console.error(
      "[addRotationControl] Erro ao adicionar controle de rotação:",
      error
    );
    return false;
  }
}
/**
 * Inicializa o mapa Leaflet e configura as camadas.
 * @param {string} containerId - ID do elemento HTML que conterá o mapa.
 * @param {Object} options - Opções de inicialização do mapa.
 * @returns {Object} Instância do mapa Leaflet.
 */
export function initializeMap(containerId, options = {}) {
  console.log("[initializeMap] Iniciando criação do mapa com ID:", containerId);

  // Validar elementos existentes
  if (map instanceof L.Map) {
    console.warn(
      "[initializeMap] Uma instância de mapa já existe e será retornada"
    );
    window.map = map;
    return map;
  }

  // Encontrar o elemento do container
  const mapElement = document.getElementById(containerId);
  if (!mapElement) {
    console.error(
      `[initializeMap] Elemento com ID "${containerId}" não encontrado no DOM`
    );
    return null;
  }

  console.log("[initializeMap] Elemento do mapa encontrado:", mapElement);

  try {
    // Configurar opções padrão e mesclá-las com as opções fornecidas
    const defaultOptions = {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
      dragging: true,
      doubleClickZoom: true,
      zoomAnimation: true,
    };

    // Extrair parâmetros específicos
    const initialZoom = options.zoom || 15;
    const initialLat =
      options.centerLat !== undefined ? options.centerLat : -13.3775457;
    const initialLng =
      options.centerLng !== undefined ? options.centerLng : -38.9159969;

    // Mesclar opções padrão com opções fornecidas
    const mapOptions = { ...defaultOptions, ...options };

    console.log("[initializeMap] Criando mapa com opções:", mapOptions);
    console.log("[initializeMap] Centro inicial:", initialLat, initialLng);

    // Inicializar o mapa com as opções completas
    map = L.map(containerId, mapOptions).setView(
      [initialLat, initialLng],
      initialZoom
    );

    // Adicionar camada de tiles do OpenStreetMap
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      tileSize: 256,
      detectRetina: true,
    }).addTo(map);

    // Garantir referência global
    window.map = map;

    // Registrar diagnóstico de estado
    map.once("load", () => {
      console.log(
        "[initializeMap] Evento 'load' disparado, mapa carregado completamente"
      );
    });

    // Registrar evento de redimensionamento
    map.on("resize", () => {
      console.log("[initializeMap] Mapa redimensionado:", map.getSize());
    });

    // Registrar evento de erro de carregamento de tile
    map.on("tileerror", (error) => {
      console.warn("[initializeMap] Erro ao carregar tile:", error);
    });

    console.log("[initializeMap] Mapa inicializado com sucesso");
    return map;
  } catch (error) {
    console.error("[initializeMap] Erro ao criar o mapa:", error);
    return null;
  }
}

/**
 * Obtém a instância atual do mapa Leaflet de maneira robusta
 * @returns {L.Map|null} Instância do mapa ou null se não encontrada
 */
export function getMapInstance() {
  // 1. Verificar a variável exportada do módulo atual
  if (map instanceof L.Map) {
    return map;
  }

  // 2. Verificar a variável global
  if (window.map instanceof L.Map) {
    return window.map;
  }

  // 3. Procurar no DOM pelo elemento do mapa e obter a instância Leaflet
  try {
    const mapContainer = document.getElementById("map-container");
    if (mapContainer) {
      // Procurar pelo elemento com classes leaflet-container
      const leafletContainer = mapContainer.querySelector(".leaflet-container");
      if (leafletContainer) {
        // O objeto Leaflet está armazenado no elemento com chave _leaflet_id
        for (let key in L) {
          if (L.hasOwnProperty(key) && key.startsWith("map")) {
            const possibleMap = L[key];
            if (possibleMap && possibleMap instanceof L.Map) {
              // Armazenamos o mapa encontrado na variável global para uso futuro
              window.map = possibleMap;
              return possibleMap;
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("[getMapInstance] Erro ao buscar pelo DOM:", e);
  }

  // 4. Verificar se há mapas registrados no Leaflet
  if (typeof L !== "undefined" && typeof L._leaflet_id_base === "number") {
    // Verificar se há mapas registrados
    for (let id in L._layers) {
      if (L._layers[id] instanceof L.Map) {
        window.map = L._layers[id];
        return L._layers[id];
      }
    }
  }

  console.error(
    "[getMapInstance] Não foi possível obter uma instância válida do mapa"
  );
  return null;
}

// Adicionar uma função para garantir que o mapa seja acessível globalmente
export function ensureGlobalMapReference() {
  if (!window.map || !(window.map instanceof L.Map)) {
    window.map = getMapInstance();
    console.log(
      "[ensureGlobalMapReference] Referência global do mapa atualizada:",
      !!window.map
    );
  }
  return window.map;
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

// Função utilitária para filtrar locais pelo raio de 10km do ponto central
function isWithinRadius(
  lat,
  lon,
  centerLat = -13.376,
  centerLon = -38.917,
  radiusMeters = 10000
) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371000; // Raio da Terra em metros
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
 * Centraliza o mapa em [lat, lon], mas com um deslocamento vertical (offsetY em pixels)
 * @param {number} lat
 * @param {number} lon
 * @param {number} offsetY - deslocamento em pixels (positivo para cima)
 * @param {number} zoom
 */
function flyToWithOffset(lat, lon, offsetY = 0, zoom = 16) {
  if (!map) return;
  // Converte lat/lon para ponto na tela
  const targetPoint = map.project([lat, lon], zoom);
  // Aplica o offset vertical
  targetPoint.y = targetPoint.y + offsetY;
  // Converte de volta para lat/lon
  const newCenter = map.unproject(targetPoint, zoom);
  map.flyTo(newCenter, zoom, { animate: true, duration: 1.5 });
}

/**
 * Solicita permissão de GPS e rastreia a posição do usuário
 * Versão melhorada com mais tentativas
 */
export function requestAndTrackUserLocation(
  onSuccess = null,
  onError = null,
  options = {}
) {
  const opts = {
    desiredAccuracy: options.desiredAccuracy || 3000, // 3km é aceitável para turismo
    fallbackAccuracy: options.fallbackAccuracy || 5000, // 5km se necessário
    timeout: options.timeout || 30000, // 30 segundos
    showNotifications: options.showNotifications !== false,
    centerMap: options.centerMap !== false,
    maxRetries: options.maxRetries || 1,
  };

  // Evitar múltiplas chamadas simultâneas
  if (window._pendingLocationRequest) {
    console.log(
      "[requestAndTrackUserLocation] Já existe uma solicitação em andamento, aguardando..."
    );
    return window._pendingLocationRequest;
  }

  // Mostrar ao usuário que estamos obtendo a localização
  appendMessage(
    "assistant",
    "Para calcular a rota, preciso da sua localização atual. Estou tentando determiná-la...",
    { speakMessage: true }
  );

  if (opts.showNotifications) {
    showNotification("Obtendo sua localização...", "info");
  }

  let attempts = 0;

  // Função que faz tentativas de obter localização
  const attemptGetLocation = async () => {
    try {
      // Aumentar contador de tentativas
      attempts++;

      console.log(
        `[requestAndTrackUserLocation] Tentativa ${attempts} de obter localização`
      );

      if (attempts > 1) {
        appendMessage(
          "assistant",
          `Tentando novamente obter sua localização (tentativa ${attempts})...`,
          { speakMessage: true }
        );
      }

      // Solicitar localização com configurações específicas para cada tentativa
      const location = await getBestEffortLocation(
        opts.timeout,
        // Aumentar limite de precisão aceitável em tentativas subsequentes
        opts.desiredAccuracy * Math.pow(2, attempts - 1)
      );

      // Localização obtida com sucesso
      userLocation = location;

      if (opts.centerMap && map) {
        if (typeof animateMapToLocalizationUser === "function") {
          animateMapToLocalizationUser(location.latitude, location.longitude);
        } else {
          map.setView([location.latitude, location.longitude], 16);
        }
      }

      // Atualizar marcador do usuário
      if (typeof updateUserMarker === "function") {
        updateUserMarker(
          location.latitude,
          location.longitude,
          0,
          location.accuracy
        );
      }

      // Chamar callback de sucesso
      if (typeof onSuccess === "function") {
        onSuccess(location);
      }

      // Processar pendências de rota
      processPendingRoute();

      return location;
    } catch (error) {
      console.warn(
        `[requestAndTrackUserLocation] Erro na tentativa ${attempts}:`,
        error
      );

      // Verificar se é erro de permissão negada
      if (error.message && error.message.includes("Permissão")) {
        appendMessage(
          "assistant",
          "Você negou o acesso à sua localização. Para continuar, permita o acesso à localização nas configurações do navegador e tente novamente.",
          { speakMessage: true }
        );
        throw error; // Não tentar novamente neste caso
      }

      // Se ainda temos tentativas disponíveis
      if (attempts < opts.maxRetries + 1) {
        return attemptGetLocation(); // Tentar novamente recursivamente
      }

      // Esgotamos as tentativas
      appendMessage(
        "assistant",
        "Não consegui determinar sua localização com precisão. Você pode verificar seu GPS e tentar novamente, ou escolher um destino específico sem usar rotas.",
        { speakMessage: true }
      );

      throw error; // Propagar o erro para o handler final
    }
  };

  // Criar promessa para permitir awaits externos
  window._pendingLocationRequest = attemptGetLocation()
    .catch((finalError) => {
      // Erro final após todas as tentativas
      console.error("[requestAndTrackUserLocation] Erro final:", finalError);

      if (typeof onError === "function") {
        onError(finalError);
      }

      throw finalError; // Propagar para quem chamou a função
    })
    .finally(() => {
      // Limpar referência de requisição pendente
      window._pendingLocationRequest = null;
    });

  return window._pendingLocationRequest;
}

/**
 * Processa uma rota pendente se houver
 */
function processPendingRoute() {
  try {
    if (typeof getContext !== "function") {
      console.warn("[processPendingRoute] Função getContext não disponível");
      return;
    }

    const ctx = getContext();
    if (ctx && ctx.pendingRoute && typeof showRoute === "function") {
      console.log(
        "[processPendingRoute] Processando rota pendente para:",
        ctx.pendingRoute.name
      );

      // Pequeno timeout para garantir que a UI esteja atualizada
      setTimeout(() => {
        showRoute(ctx.pendingRoute);
        if (typeof updateContext === "function") {
          updateContext({ pendingRoute: null });
        }
      }, 300);
    }
  } catch (e) {
    console.warn("[processPendingRoute] Erro:", e);
  }
}
/**
 * Adicionar controle de geolocalização para o usuário encontrar sua localização no mapa
 */
export function setupGeolocation(map) {
  if (!navigator.geolocation) {
    alert("Seu navegador não suporta geolocalização.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;

      // Atualiza a localização do usuário
      userLocation = { latitude, longitude };

      console.log(
        `[setupGeolocation] Localização do usuário atualizada: (${latitude}, ${longitude})`
      );

      // Atualiza o mapa para centralizar na localização do usuário
      if (map) {
        map.flyTo([-13.5815787, -38.9859057], 14);
      }

      animateMapToLocalizationUser(
        userLocation.latitude,
        userLocation.longitude
      );

      // Atualiza o marcador do usuário (se necessário)
      if (typeof updateUserMarker === "function") {
        updateUserMarker(latitude, longitude, position.coords.heading || 0);
      } else {
        console.warn(
          "[setupGeolocation] Função updateUserMarker não está disponível."
        );
      }
    },
    (error) => {
      console.error("[setupGeolocation] Erro ao obter localização:", error);
      alert("Não foi possível acessar sua localização.");
    }
  );
}

/**
 * Exibe a rota entre a localização atual do usuário e o destino.
 * Versão modificada para não criar botão no modal de mensagens.
 * @param {Object} destination - Objeto contendo informações do destino
 */
export async function showRoute(destination) {
  try {
    console.log("[showRoute] Iniciando exibição de rota para:", destination);

    if (!destination || !destination.lat || !destination.lon) {
      console.warn("[showRoute] destino inválido:", destination);
      showNotification("Selecione um destino válido.", "error");
      appendMessage(
        "assistant",
        "Não consegui encontrar o destino solicitado. Por favor, tente novamente com um local específico.",
        { speakMessage: true }
      );
      return;
    }

    const destinationLat = destination.lat;
    const destinationLon = destination.lon;

    // Verificar se já temos a localização do usuário
    if (!userLocation || !userLocation.latitude || !userLocation.longitude) {
      console.log(
        "[showRoute] Localização do usuário não disponível. Verificando se já compartilhou antes..."
      );

      // Verificar se o usuário já compartilhou localização anteriormente
      const locationPreviouslyShared = hasSharedLocation();

      if (locationPreviouslyShared) {
        // Se já compartilhou, apenas notificar que estamos obtendo a localização
        appendMessage(
          "assistant",
          `Calculando rota para ${destination.name}...`,
          { speakMessage: true }
        );
      } else {
        // Armazenar a intenção de mostrar rota para este destino após obter localização
        if (typeof updateContext === "function") {
          updateContext({ pendingRoute: destination });
        }

        // Se nunca compartilhou, exibir mensagem pedindo permissão
        appendMessage(
          "assistant",
          `Para traçar a rota até ${destination.name}, preciso da sua localização atual. Por favor, permita o acesso à sua localização.`,
          { speakMessage: true }
        );
      }

      // Solicitar localização
      try {
        await requestAndTrackUserLocation();
        return; // A função requestAndTrackUserLocation continuará o fluxo
      } catch (locError) {
        console.error("[showRoute] Erro ao solicitar localização:", locError);
        return;
      }
    }

    // Continua usando a localização existente
    console.log("[showRoute] Usando localização existente:", userLocation);

    // Centralizar o mapa na localização do usuário
    try {
      if (typeof animateMapToLocalizationUser === "function") {
        animateMapToLocalizationUser(
          userLocation.latitude,
          userLocation.longitude
        );
      } else if (map) {
        map.setView([userLocation.latitude, userLocation.longitude], 16);
      }
    } catch (mapError) {
      console.warn("[showRoute] Erro ao centralizar mapa:", mapError);
    }

    // Atualizar o marcador do usuário
    try {
      if (typeof updateUserMarker === "function") {
        updateUserMarker(
          userLocation.latitude,
          userLocation.longitude,
          0,
          userLocation.accuracy
        );
      }
    } catch (markerError) {
      console.warn("[showRoute] Erro ao atualizar marcador:", markerError);
    }

    // Calcular e exibir a rota
    try {
      appendMessage(
        "assistant",
        `Calculando rota para ${destination.name}...`,
        { speakMessage: true }
      );

      const routeData = await plotRouteOnMap(
        userLocation.latitude,
        userLocation.longitude,
        destinationLat,
        destinationLon,
        "foot-walking",
        destination.name
      );

      // Armazenar a rota calculada para reuso
      setLastRouteData(routeData);

      if (!routeData) {
        console.warn("[showRoute] Nenhum dado de rota retornado");
        showNotification("Não foi possível calcular a rota", "error");
        appendMessage(
          "assistant",
          `Não consegui traçar uma rota até ${destination.name}. O local pode estar inacessível a pé ou o serviço de rotas pode estar indisponível.`,
          { speakMessage: true }
        );
        return;
      }

      // Verificar se há rotas válidas
      if (!routeData.features || routeData.features.length === 0) {
        console.warn(
          "[showRoute] Nenhuma rota encontrada nos dados:",
          routeData
        );
        showNotification(
          "Nenhuma rota encontrada para este destino",
          "warning"
        );
        appendMessage(
          "assistant",
          `Não encontrei um caminho a pé até ${destination.name}. Talvez seja necessário outro meio de transporte.`,
          { speakMessage: true }
        );
        return;
      }

      const summary = routeData.features[0]?.properties?.summary;

      if (!summary) {
        console.warn(
          "[showRoute] summary não encontrado em routeData:",
          routeData
        );
        showNotification("Erro ao calcular o resumo da rota", "warning");

        // Tente extrair informações básicas para continuar
        let distance = 0;
        let duration = 0;

        try {
          // Tenta extrair distância e duração de outras partes dos dados
          const segments = routeData.features[0]?.properties?.segments;
          if (segments && segments.length > 0) {
            distance = segments[0].distance || 0;
            duration = segments[0].duration || 0;
          }
        } catch (extractError) {
          console.warn(
            "[showRoute] Erro ao extrair dados de segmentos:",
            extractError
          );
        }

        // Usar valores estimados ou extraídos
        if (distance > 0 && duration > 0) {
          showRouteSummary(destination.name, distance, duration);
        } else {
          // Estimar com base na distância em linha reta
          const estimatedDistance = calculateHaversineDistance(
            userLocation.latitude,
            userLocation.longitude,
            destinationLat,
            destinationLon
          );

          // Estimar duração com base na velocidade média de caminhada (4 km/h)
          const estimatedDuration = (estimatedDistance / 4000) * 3600; // segundos

          showRouteSummary(
            destination.name,
            estimatedDistance,
            estimatedDuration
          );
          appendMessage(
            "assistant",
            "Não foi possível calcular um resumo preciso da rota. Estou mostrando uma estimativa aproximada.",
            { speakMessage: true }
          );
        }
      } else {
        console.log("[showRoute] Rota calculada:", {
          from: [userLocation.latitude, userLocation.longitude],
          to: [destinationLat, destinationLon],
          distance: summary.distance,
          duration: summary.duration,
        });

        // Exibe o resumo da rota normalmente
        if (typeof showRouteSummary === "function") {
          showRouteSummary(
            destination.name,
            summary.distance,
            summary.duration
          );
        }

        // MODIFICAÇÃO: Remover criação do botão e substituir por mensagem que incentiva resposta de voz
        appendMessage(
          "assistant",
          `Rota para ${destination.name} calculada com sucesso! Distância: ${(
            summary.distance / 1000
          ).toFixed(2)} km, tempo estimado: ${Math.round(
            summary.duration / 60
          )} minutos. Deseja iniciar a navegação guiada? Diga "sim" ou "iniciar".`,
          { speakMessage: true }
        );
      }

      // Limpa mensagens anteriores do assistente relacionadas à solicitação de localização
      try {
        if (typeof clearAssistantMessages === "function") {
          clearAssistantMessages(
            (msg) =>
              msg.textContent &&
              msg.textContent.includes("Para traçar a rota") &&
              msg.textContent.includes("compartilhe sua localização")
          );
        }
      } catch (clearError) {
        console.warn("[showRoute] Erro ao limpar mensagens:", clearError);
      }

      // Atualizar contexto com o destino selecionado
      try {
        if (typeof updateContext === "function") {
          updateContext({
            selectedDestination: destination,
            lastIntent: "rota", // Marcar que estamos aguardando confirmação para navegação
            // Também armazena dados da rota para uso posterior
            currentRoute: {
              origin: {
                lat: userLocation.latitude,
                lon: userLocation.longitude,
              },
              destination: {
                lat: destinationLat,
                lon: destinationLon,
                name: destination.name,
              },
              summary: summary || null,
              timestamp: Date.now(),
            },
          });
        }
      } catch (contextError) {
        console.warn("[showRoute] Erro ao atualizar contexto:", contextError);
      }

      return routeData;
    } catch (routeError) {
      console.error("[showRoute] Erro ao calcular rota:", routeError);

      // Tentar identificar o tipo de erro para dar feedback mais preciso
      let errorMessage = "Erro ao calcular a rota. Tente novamente.";

      if (
        routeError.message &&
        routeError.message.includes("Could not find routable point")
      ) {
        errorMessage =
          "Não foi possível encontrar um ponto navegável próximo. Tente se aproximar de uma rua ou caminho.";
      } else if (routeError.message && routeError.message.includes("API key")) {
        errorMessage =
          "Erro de autenticação no serviço de rotas. Por favor, tente novamente mais tarde.";
      } else if (routeError.message && routeError.message.includes("timeout")) {
        errorMessage =
          "Tempo excedido ao calcular a rota. Verifique sua conexão e tente novamente.";
      }

      showNotification(errorMessage, "error");
      appendMessage("assistant", errorMessage, {
        speakMessage: true,
      });
    }
  } catch (error) {
    console.error("[showRoute] Erro geral:", error);
    showNotification("Erro ao exibir a rota. Tente novamente.", "error");

    appendMessage(
      "assistant",
      "Desculpe, encontrei um problema ao tentar criar a rota. Por favor, tente novamente em alguns instantes.",
      { speakMessage: true }
    );
  }
}

/**
 * Consulta a API OpenRouteService, obtém as coordenadas e plota a rota no mapa.
 * Versão robusta com melhor tratamento de erros e fallbacks.
 * @param {number} startLat - Latitude de partida.
 * @param {number} startLon - Longitude de partida.
 * @param {number} destLat - Latitude do destino.
 * @param {number} destLon - Longitude do destino.
 * @param {string} [profile="foot-walking"] - Perfil de navegação.
 * @param {string} [destinationName="Destino"] - Nome do destino para o marcador.
 * @returns {Promise<Object|null>} - Dados da rota ou null em caso de erro.
 */
export async function plotRouteOnMap(
  startLat,
  startLon,
  destLat,
  destLon,
  profile = "foot-walking",
  destinationName = "Destino"
) {
  // Verificar cache primeiro
  const cacheKey = generateRouteCacheKey(
    startLat,
    startLon,
    destLat,
    destLon,
    profile
  );

  if (routeCache.has(cacheKey)) {
    const cachedData = routeCache.get(cacheKey);
    const cacheAge = Date.now() - cachedData.timestamp;

    // Usar cache se tiver menos de 5 minutos
    if (cacheAge < 5 * 60 * 1000) {
      console.log("[plotRouteOnMap] Usando rota em cache");

      // Limpar e redesenhar a rota do cache
      if (window.currentRoute) {
        map.removeLayer(window.currentRoute);
      }

      if (window.destinationMarker) {
        map.removeLayer(window.destinationMarker);
      }

      // Exibir rota do cache (adicione função para isso)
      displayRouteFromData(
        cachedData.data,
        startLat,
        startLon,
        destLat,
        destLon,
        destinationName,
        profile
      );

      return cachedData.data;
    }
  }

  console.log("Origem:", startLat, startLon, "Destino:", destLat, destLon);

  // Validar coordenadas
  if (
    !isValidCoordinate(startLat, startLon) ||
    !isValidCoordinate(destLat, destLon)
  ) {
    console.error("[plotRouteOnMap] Coordenadas inválidas", {
      start: [startLat, startLon],
      dest: [destLat, destLon],
    });
    showNotification(
      "Coordenadas inválidas. Verifique a localização.",
      "error"
    );
    return null;
  }

  // Verificar se o destino está muito longe (acima de 15km)
  const directDistance = calculateHaversineDistance(
    startLat,
    startLon,
    destLat,
    destLon
  );
  if (directDistance > 15000) {
    console.warn(
      `[plotRouteOnMap] Destino muito distante: ${(
        directDistance / 1000
      ).toFixed(1)}km`
    );
    showNotification(
      "O destino está muito distante para navegação a pé.",
      "warning"
    );
  }

  // Construir URL da API
  let url;
  try {
    url =
      `https://api.openrouteservice.org/v2/directions/${profile}?api_key=${apiKey}` +
      `&start=${startLon},${startLat}&end=${destLon},${destLat}&instructions=true`;

    console.log(
      "[plotRouteOnMap] Chamando API:",
      url.replace(apiKey, "API_KEY_HIDDEN")
    );
  } catch (urlError) {
    console.error("[plotRouteOnMap] Erro ao construir URL:", urlError);
    return null;
  }

  try {
    // Adicionar indicador de carregamento ao mapa
    const loadingIndicator = addLoadingIndicator("Calculando rota...");

    let response;
    try {
      // Adicionar timeout para a requisição
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos

      response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (fetchError) {
      console.error("[plotRouteOnMap] Erro na requisição:", fetchError);

      // Remover indicador de carregamento
      removeLoadingIndicator(loadingIndicator);

      if (fetchError.name === "AbortError") {
        showNotification("Tempo limite excedido ao calcular a rota.", "error");
      } else {
        showNotification("Erro de conexão. Verifique sua internet.", "error");
      }
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        console.error("[plotRouteOnMap] Erro da API:", errorJson);

        if (
          errorJson.error &&
          errorJson.error.message &&
          errorJson.error.message.includes("Could not find routable point")
        ) {
          showNotification(
            "Não foi possível traçar uma rota a partir da sua localização atual. Tente se aproximar de uma rua ou área conhecida.",
            "error"
          );

          // Tentar um fallback com um perfil diferente
          if (profile === "foot-walking") {
            console.log(
              "[plotRouteOnMap] Tentando fallback com perfil 'driving-car'"
            );
            removeLoadingIndicator(loadingIndicator);

            // Chamar recursivamente com outro perfil como tentativa de fallback
            return plotRouteOnMap(
              startLat,
              startLon,
              destLat,
              destLon,
              "driving-car",
              destinationName
            );
          }
        } else if (errorJson.error && errorJson.error.code === 403) {
          showNotification(
            "Limite de API excedido. Tente novamente mais tarde.",
            "error"
          );
        } else {
          showNotification("Erro ao calcular a rota.", "error");
        }
      } catch {
        console.error("[plotRouteOnMap] Erro não JSON:", errorText);
        showNotification("Erro ao calcular a rota.", "error");
      }

      // Remover indicador de carregamento
      removeLoadingIndicator(loadingIndicator);

      // Se falhou, desenhar pelo menos uma linha reta para orientação básica
      drawStraightLine(startLat, startLon, destLat, destLon, destinationName);

      return null;
    }

    const data = await response.json();
    console.log("[plotRouteOnMap] Dados recebidos da API:", data);

    // Remover indicador de carregamento
    removeLoadingIndicator(loadingIndicator);

    // IMPORTANTE: Extrair informações detalhadas sobre duração e passos para processamento posterior
    const routeFeature = data.features?.[0];
    const routeProperties = routeFeature?.properties;

    // Extrair informações sobre segmentos e passos para enriquecer os dados
    const segments = routeProperties?.segments || [];
    const segment = segments[0] || {};
    const steps = segment.steps || [];

    // Processar os passos para incluir informações de duração
    if (steps.length > 0) {
      // Calcular duração total da rota
      const totalDuration = segment.duration || 0;

      // Log para diagnóstico
      console.log(
        "[plotRouteOnMap] Duração total da rota:",
        totalDuration,
        "segundos"
      );
      console.log("[plotRouteOnMap] Número de passos:", steps.length);

      // Adicionar dados de duração aos steps para uso posterior
      steps.forEach((step, index) => {
        // Garantir que cada passo tenha um campo duration
        if (typeof step.duration !== "number") {
          // Calcular duração proporcional baseada na distância
          const totalDistance = segment.distance || 1;
          const stepDistance = step.distance || 0;
          const proportion = stepDistance / totalDistance;
          step.duration = Math.round(totalDuration * proportion);
        }
        step.index = index + 1;

        // Log para diagnóstico
        console.log(
          `[plotRouteOnMap] Passo ${index + 1}: Distância=${
            step.distance
          }m, Duração=${step.duration}s, Instrução=${step.instruction || "N/A"}`
        );
      });

      // Anexar ao objeto de dados para uso posterior
      data._processedSteps = steps;
      data._totalDuration = totalDuration;
      data._totalDistance = segment.distance || 0;
    }

    // Extrai as coordenadas da rota e converte para formato [lat, lon]
    const coords = routeFeature?.geometry?.coordinates;
    if (!coords || !coords.length) {
      console.warn("[plotRouteOnMap] Nenhuma coordenada retornada:", coords);

      // Desenhar linha reta como fallback
      drawStraightLine(startLat, startLon, destLat, destLon, destinationName);

      return null;
    }
    const latLngs = coords.map(([lon, lat]) => [lat, lon]);

    // Se já houver uma rota traçada, remove-a
    if (window.currentRoute) {
      map.removeLayer(window.currentRoute);
      console.log("[plotRouteOnMap] Rota anterior removida.");
    }

    // Remover o marcador de destino anterior, se existir
    if (window.destinationMarker) {
      map.removeLayer(window.destinationMarker);
      console.log("[plotRouteOnMap] Marcador de destino anterior removido.");
    }

    // Cria e adiciona a polyline ao mapa com estilo melhorado
    window.currentRoute = L.polyline(latLngs, {
      color: "#3b82f6",
      weight: 5,
      opacity: 0.8,
      lineJoin: "round",
      lineCap: "round",
      dashArray: profile === "driving-car" ? "10,10" : null,
    }).addTo(map);

    // Armazena pontos da rota para uso no sistema de navegação
    window.lastRoutePoints = latLngs;

    // ADICIONAR ESTA PARTE: Encontrar o próximo ponto da rota e apontar o marcador
    updateUserMarkerDirection(userLocation, latLngs);

    // Importar a função getMarkerIconForLocation
    try {
      const markerModule = await import("./map-markers.js");

      // Adicionar marcador de destino usando getMarkerIconForLocation
      const icon = markerModule.getMarkerIconForLocation(
        destinationName.toLowerCase()
      );

      // Criar e adicionar o marcador de destino
      window.destinationMarker = L.marker([destLat, destLon], {
        icon: icon,
        title: destinationName,
      }).addTo(map);

      // Adicionar popup ao marcador com o nome do destino
      window.destinationMarker
        .bindPopup(`<h3>${destinationName}</h3>`)
        .openPopup();

      console.log(
        "[plotRouteOnMap] Marcador de destino adicionado:",
        destinationName
      );
    } catch (markerError) {
      console.error(
        "[plotRouteOnMap] Erro ao processar marcador:",
        markerError
      );

      // Criar um marcador básico como fallback
      window.destinationMarker = L.marker([destLat, destLon], {
        title: destinationName,
      }).addTo(map);

      window.destinationMarker
        .bindPopup(`<h3>${destinationName}</h3>`)
        .openPopup();
    }

    // Ajusta o mapa para mostrar toda a rota com padding adequado
    try {
      const bounds = window.currentRoute.getBounds();
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 17, // Limitar zoom para não ficar muito próximo
        animate: true,
        duration: 1.0, // Animação mais suave
      });
      console.log("[plotRouteOnMap] fitBounds aplicado.");
    } catch (boundsError) {
      console.warn(
        "[plotRouteOnMap] Erro ao ajustar visualização:",
        boundsError
      );

      // Fallback: centralizar entre os pontos
      const centerLat = (startLat + destLat) / 2;
      const centerLon = (startLon + destLon) / 2;
      map.setView([centerLat, centerLon], 15);
    }

    // Depois de obter a resposta com sucesso:
    routeCache.set(cacheKey, {
      data: data,
      timestamp: Date.now(),
      routePoints: latLngs, // Armazenar também os pontos da rota
    });

    setupDirectionalMarkerUpdates();

    return data;
  } catch (error) {
    console.error("[plotRouteOnMap] Erro ao plotar rota:", error);

    // Tentar desenhar uma linha reta como último recurso
    drawStraightLine(startLat, startLon, destLat, destLon, destinationName);

    return null;
  }
}

// Adicionar função para exibir rota a partir de dados já processados

/**
 * Exibe uma rota no mapa a partir de dados já processados
 * @param {Object} data - Dados de rota da API
 * @param {number} startLat - Latitude inicial
 * @param {number} startLon - Longitude inicial
 * @param {number} destLat - Latitude do destino
 * @param {number} destLon - Longitude do destino
 * @param {string} destinationName - Nome do destino
 * @param {string} profile - Perfil de rota
 * @returns {Object} Dados da rota
 */
function displayRouteFromData(
  data,
  startLat,
  startLon,
  destLat,
  destLon,
  destinationName,
  profile
) {
  try {
    // Extrair coordenadas
    const coords = data?.features?.[0]?.geometry?.coordinates;
    if (!coords || !coords.length) {
      console.warn("[displayRouteFromData] Nenhuma coordenada encontrada");
      return null;
    }

    // Converter para formato [lat, lon]
    const latLngs = coords.map(([lon, lat]) => [lat, lon]);

    // Remover rota anterior
    if (window.currentRoute) {
      map.removeLayer(window.currentRoute);
      console.log("[displayRouteFromData] Rota anterior removida.");
    }

    // Remover marcador anterior
    if (window.destinationMarker) {
      map.removeLayer(window.destinationMarker);
      console.log(
        "[displayRouteFromData] Marcador de destino anterior removido."
      );
    }

    // Criar polyline
    window.currentRoute = L.polyline(latLngs, {
      color: "#3b82f6",
      weight: 5,
      opacity: 0.8,
      lineJoin: "round",
      lineCap: "round",
      dashArray: profile === "driving-car" ? "10,10" : null,
    }).addTo(map);

    console.log("[displayRouteFromData] Polyline adicionada ao mapa.");

    // Adicionar setas à rota
    window.routeArrows = addArrowsToPolyline(window.currentRoute);

    // Adicionar marcador de destino
    try {
      // Importação dinâmica agora movida para uma função separada para melhor reuso
      getMarkerIconAsync(destinationName.toLowerCase()).then((icon) => {
        window.destinationMarker = L.marker([destLat, destLon], {
          icon: icon,
          title: destinationName,
        }).addTo(map);

        window.destinationMarker
          .bindPopup(`<h3>${destinationName}</h3>`)
          .openPopup();

        console.log(
          "[displayRouteFromData] Marcador de destino adicionado:",
          destinationName
        );
      });
    } catch (markerError) {
      console.error(
        "[displayRouteFromData] Erro ao adicionar marcador:",
        markerError
      );

      // Fallback para marcador simples
      window.destinationMarker = L.marker([destLat, destLon], {
        title: destinationName,
      }).addTo(map);

      window.destinationMarker.bindPopup(`<h3>${destinationName}</h3>`);
    }

    // Ajustar visualização
    try {
      const bounds = window.currentRoute.getBounds();
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 17,
        animate: true,
        duration: 1.0,
      });
    } catch (boundsError) {
      console.warn(
        "[displayRouteFromData] Erro ao ajustar visualização:",
        boundsError
      );

      // Centralizar entre origem e destino como fallback
      map.setView([(startLat + destLat) / 2, (startLon + destLon) / 2], 15);
    }

    return data;
  } catch (error) {
    console.error("[displayRouteFromData] Erro ao exibir rota:", error);
    return null;
  }
}

// Helper para carregar ícones de marcador de forma assíncrona
async function getMarkerIconAsync(nameHint) {
  try {
    const markerModule = await import("./map-markers.js");
    return (
      markerModule.getMarkerIconForLocation(nameHint) ||
      L.divIcon({
        html: `<i class="fas fa-map-marker-alt" style="font-size: 24px; color: #3b82f6;"></i>`,
        className: "custom-marker-icon",
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24],
      })
    );
  } catch (error) {
    console.warn(
      "[getMarkerIconAsync] Erro ao carregar módulo de marcadores:",
      error
    );
    return L.divIcon({
      html: `<i class="fas fa-map-marker-alt" style="font-size: 24px; color: #3b82f6;"></i>`,
      className: "custom-marker-icon",
      iconSize: [24, 24],
      iconAnchor: [12, 24],
      popupAnchor: [0, -24],
    });
  }
}

/**
 * Adiciona setas de direção à linha da rota de forma segura
 * @param {L.Polyline} polyline - Linha onde adicionar decoração
 * @param {string} color - Cor das setas
 */
function addArrowsToPolyline(polyline, color = "#3b82f6") {
  try {
    // Verificar se o plugin está disponível
    if (!L.polylineDecorator) {
      console.warn(
        "[addArrowsToPolyline] Plugin L.polylineDecorator não encontrado, pulando decoração"
      );
      return null;
    }

    // Verificar se a função Symbol.arrowHead está disponível
    if (!L.Symbol || !L.Symbol.arrowHead) {
      console.warn(
        "[addArrowsToPolyline] L.Symbol.arrowHead não disponível, pulando decoração"
      );
      return null;
    }

    // Criar decorações de maneira segura
    return L.polylineDecorator(polyline, {
      patterns: [
        {
          offset: "5%",
          repeat: "10%",
          symbol: L.Symbol.arrowHead({
            pixelSize: 10,
            headAngle: 30,
            polygon: true,
            pathOptions: { color: color, fillOpacity: 0.8, weight: 0 },
          }),
        },
      ],
    });
  } catch (error) {
    console.warn("[addArrowsToPolyline] Erro ao adicionar decoração:", error);
    return null;
  }
}

/**
 * Verifica se uma coordenada é válida
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean} - Verdadeiro se a coordenada for válida
 */
export function isValidCoordinate(lat, lon) {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Desenha uma linha reta entre dois pontos quando a API de rotas falha
 * @param {number} startLat - Latitude inicial
 * @param {number} startLon - Longitude inicial
 * @param {number} destLat - Latitude do destino
 * @param {number} destLon - Longitude do destino
 * @param {string} destinationName - Nome do destino
 */
function drawStraightLine(
  startLat,
  startLon,
  destLat,
  destLon,
  destinationName
) {
  try {
    console.log("[drawStraightLine] Desenhando linha reta como fallback");

    // Remover rota anterior se existir
    if (window.currentRoute && map) {
      map.removeLayer(window.currentRoute);
    }
    // Desenhar linha reta com estilo tracejado para indicar que não é uma rota real
    window.currentRoute = L.polyline(
      [
        [startLat, startLon],
        [destLat, destLon],
      ],
      {
        color: "#f59e0b", // Amarelo âmbar para distinguir de rotas normais
        weight: 4,
        opacity: 0.7,
        dashArray: "10,10",
      }
    ).addTo(map);

    // Adicionar texto informativo
    window.currentRoute.bindTooltip("Linha reta (não é uma rota navegável)", {
      permanent: true,
      direction: "center",
      className: "straight-line-tooltip",
    });
    // Adicionar marcador de destino simples
    if (window.destinationMarker && map) {
      map.removeLayer(window.destinationMarker);
    }

    window.destinationMarker = L.marker([destLat, destLon], {
      title: destinationName,
    }).addTo(map);

    window.destinationMarker
      .bindPopup(`<h3>${destinationName}</h3><p>Destino aproximado</p>`)
      .openPopup();

    // Ajustar o mapa para mostrar a linha completa
    const bounds = window.currentRoute.getBounds();
    map.fitBounds(bounds, { padding: [50, 50] });

    showNotification(
      "Não foi possível calcular uma rota precisa. Exibindo direção em linha reta.",
      "warning"
    );
  } catch (error) {
    console.error("[drawStraightLine] Erro ao desenhar linha reta:", error);
  }
}

/**
 * Obtém a melhor localização possível com timeout e gestão de erros aprimorada
 * @param {number} maxWaitMs - Tempo máximo de espera
 * @param {number} desiredAccuracy - Precisão desejada em metros
 * @returns {Promise<{ latitude, longitude, accuracy }>}
 */
export function getBestEffortLocation(
  maxWaitMs = 20000,
  desiredAccuracy = 200
) {
  return new Promise((resolve, reject) => {
    // Verificar se temos já uma localização em cache
    if (userLocation && userLocation.latitude && userLocation.longitude) {
      console.log(
        "[getBestEffortLocation] Usando localização existente:",
        userLocation
      );
      showNotification("Usando localização existente", "info");
      resolve(userLocation);
      return;
    }

    let bestLocation = null;
    let bestAccuracy = Infinity;
    let finished = false;
    let watchId = null;
    let timeoutTriggered = false;
    let permissionDenied = false;
    let firstPositionReceived = false;

    // Indicador visual de carregamento
    const loadingIndicator = addLoadingIndicator("Obtendo sua localização...");

    showNotification("Tentando obter sua localização...", "info");

    // Esta função executa uma única vez no final, seja por sucesso ou erro
    function finish(forced = false) {
      if (finished) return;
      finished = true;

      // Limpar recursos
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      removeLoadingIndicator(loadingIndicator);

      // Removemos círculo de precisão se existir
      if (window.precisionCircle && map) {
        map.removeLayer(window.precisionCircle);
      }

      // Se o usuário negou permissão, tratar específicamente esse caso
      if (permissionDenied) {
        showNotification(
          "Permissão de localização negada. Verifique suas configurações.",
          "error"
        );
        reject(new Error("Permissão de localização negada"));
        return;
      }

      // Se temos uma localização, mesmo que não seja a ideal, usamos
      if (bestLocation) {
        // Registrar que temos permissão para usar localização
        if (typeof markLocationAsShared === "function") {
          markLocationAsShared();
        } else {
          localStorage.setItem("location-permission-granted", "true");
        }

        // Gerenciar feedback baseado na precisão
        const precisionQuality =
          bestLocation.accuracy <= desiredAccuracy
            ? "success"
            : bestLocation.accuracy <= desiredAccuracy * 5
            ? "warning"
            : "info";

        showNotification(
          `Localização obtida com precisão de ${Math.round(
            bestLocation.accuracy
          )}m`,
          precisionQuality
        );

        // Atualizar variável global para reuso
        userLocation = bestLocation;

        resolve(bestLocation);
        return;
      }

      // Não conseguimos nenhuma localização
      showNotification(
        "Não foi possível obter sua localização. Verifique se o GPS está ativado.",
        "error"
      );
      reject(new Error("Não foi possível obter localização"));
    }

    // Verificar suporte a geolocalização no navegador
    if (!navigator.geolocation) {
      showNotification("Seu navegador não suporta geolocalização", "error");
      removeLoadingIndicator(loadingIndicator);
      reject(new Error("Geolocalização não suportada"));
      return;
    }

    // Definir handler para timeout parcial (aceitar localização aproximada)
    const partialTimeoutId = setTimeout(() => {
      timeoutTriggered = true;
      // Se já recebemos pelo menos uma posição, aceitamos mesmo com precisão baixa
      if (bestLocation && firstPositionReceived) {
        console.log(
          "[getBestEffortLocation] Timeout parcial - usando melhor localização disponível"
        );
        finish(true);
      }
    }, Math.min(maxWaitMs * 0.5, 8000)); // Máximo 8 segundos para timeout parcial

    // Solicitar localização do usuário (contínuo)
    try {
      // Primeiro, tentar com uma solicitação única e rápida
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Se já terminamos, ignorar
          if (finished) return;

          // Processar posição recebida
          const { latitude, longitude, accuracy } = position.coords;
          console.log(
            `[getBestEffortLocation] Posição rápida: (${latitude}, ${longitude}), precisão: ${accuracy}m`
          );

          firstPositionReceived = true;
          bestLocation = { latitude, longitude, accuracy };
          bestAccuracy = accuracy;

          // Se atende requisito de precisão, terminar
          if (accuracy <= desiredAccuracy) {
            clearTimeout(partialTimeoutId);
            finish();
          }
        },
        (error) => {
          // Ignorar erros desta tentativa inicial
          console.warn(
            "[getBestEffortLocation] Erro na posição rápida:",
            error
          );

          if (error.code === 1) {
            // PERMISSION_DENIED
            permissionDenied = true;
            finish();
          }
        },
        {
          enableHighAccuracy: false, // Priorizar velocidade
          timeout: 5000,
          maximumAge: 30000, // Aceitar posição de até 30 segundos atrás
        }
      );

      // Iniciar monitoramento contínuo para melhorar precisão
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          // Se já terminamos, ignorar
          if (finished) return;

          const { latitude, longitude, accuracy } = position.coords;
          console.log(
            `[getBestEffortLocation] Recebido: (${latitude}, ${longitude}), precisão: ${accuracy}m`
          );

          firstPositionReceived = true;

          // Se precisão melhorou, atualizar dados
          if (!bestLocation || accuracy < bestAccuracy) {
            bestAccuracy = accuracy;
            bestLocation = { latitude, longitude, accuracy };

            // Mostrar círculo de precisão no mapa
            if (map) {
              if (window.precisionCircle)
                map.removeLayer(window.precisionCircle);
              window.precisionCircle = L.circle([latitude, longitude], {
                radius: accuracy,
                color: "#3b82f6",
                fillColor: "#3b82f6",
                fillOpacity: 0.15,
              }).addTo(map);
              map.setView([latitude, longitude], 16);
            }
          }

          // Se atingimos precisão desejada
          if (accuracy <= desiredAccuracy) {
            clearTimeout(partialTimeoutId);
            finish();
          }
        },
        (error) => {
          console.error("[getBestEffortLocation] Erro:", error);

          if (error.code === 1) {
            // PERMISSION_DENIED
            permissionDenied = true;
            clearTimeout(partialTimeoutId);
            finish();
          }
          // Se já temos uma posição básica, usar mesmo com erro
          else if (bestLocation) {
            finish(true);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: maxWaitMs * 0.8,
          maximumAge: 0,
        }
      );
    } catch (e) {
      console.error("[getBestEffortLocation] Erro crítico:", e);
      finish();
    }

    // Definir timeout final
    setTimeout(() => {
      console.log(`[getBestEffortLocation] Timeout final após ${maxWaitMs}ms`);
      finish(true); // Forçar conclusão com o que tivermos
    }, maxWaitMs);
  });
}

/**
 * Rastreia a localização do usuário em tempo real até atingir a precisão desejada.
 * Retorna um objeto { latitude, longitude, accuracy, stop: Function }
 * O método stop() pode ser chamado para parar o rastreamento.
 */
export function getPreciseLocationRealtime(
  desiredAccuracy = 20, // metros
  fallbackAccuracy = 200, // metros
  maxWaitMs = 60000, // 1 minuto
  onUpdate = null // callback opcional para cada atualização
) {
  let bestLocation = null;
  let bestAccuracy = Infinity;
  let finished = false;
  let watchId = null;
  let timeoutId = null;

  showNotification(
    "Obtendo sua localização precisa... Aguarde e, se possível, vá para um local aberto.",
    "info"
  );

  function finish(acceptFallback = false) {
    if (finished) return;
    finished = true;
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    if (timeoutId) clearTimeout(timeoutId);
    if (
      bestLocation &&
      (acceptFallback || bestLocation.accuracy <= desiredAccuracy)
    ) {
      showNotification(
        `Localização obtida com precisão de ${Math.round(
          bestLocation.accuracy
        )}m.`,
        bestLocation.accuracy <= desiredAccuracy ? "success" : "warning"
      );
      resolveFn(bestLocation);
    } else {
      showNotification(
        "Não foi possível obter sua localização precisa.",
        "error"
      );
      rejectFn(new Error("Não foi possível obter localização precisa."));
    }
  }

  let resolveFn, rejectFn;
  const promise = new Promise((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        console.log(
          `[getPreciseLocationRealtime] Atualização: (${latitude}, ${longitude}), precisão: ${accuracy}m`
        );
        if (accuracy < bestAccuracy) {
          bestAccuracy = accuracy;
          bestLocation = { latitude, longitude, accuracy };
          if (typeof onUpdate === "function") onUpdate(bestLocation);
          // Mostra círculo de precisão no mapa
          if (map) {
            if (window.precisionCircle) map.removeLayer(window.precisionCircle);
            window.precisionCircle = L.circle([latitude, longitude], {
              radius: accuracy,
              color: "#3b82f6",
              fillColor: "#3b82f6",
              fillOpacity: 0.15,
            }).addTo(map);
            map.setView([latitude, longitude], 16);
          }
        }
        if (accuracy <= desiredAccuracy) {
          finish();
        }
      },
      (error) => {
        console.error(
          "[getPreciseLocationRealtime] Erro ao obter localização:",
          error
        );
        finish();
      },
      {
        enableHighAccuracy: true,
        timeout: maxWaitMs,
        maximumAge: 0,
      }
    );

    timeoutId = setTimeout(() => {
      // Aceita fallbackAccuracy se não atingiu a desejada
      if (bestLocation && bestLocation.accuracy <= fallbackAccuracy) {
        finish(true);
      } else {
        finish();
      }
    }, maxWaitMs);
  });

  // Permite cancelar o rastreamento manualmente
  promise.stop = () => {
    finished = true;
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    if (timeoutId) clearTimeout(timeoutId);
  };

  return promise;
}

/**
 * Atualiza o marcador do usuário para apontar para o próximo ponto da rota
 * Versão robusta que garante que o marcador sempre aponte na direção correta
 * @param {Object} userPos - Posição do usuário: {latitude, longitude}
 * @param {Array} routePoints - Pontos da rota
 */
export function updateUserMarkerDirection(userPos, routePoints) {
  // Verificar se temos os dados necessários
  if (!userPos || !routePoints || !routePoints.length) {
    console.warn(
      "[updateUserMarkerDirection] Dados insuficientes para atualizar direção"
    );
    return;
  }

  try {
    // Importar funções necessárias do módulo de localização do usuário
    import("../navigation/navigationUserLocation/user-location.js")
      .then((userLocationModule) => {
        // Encontrar o próximo ponto relevante na rota
        const nextPoint = findNextRoutePoint(routePoints, userPos, 30);

        if (!nextPoint) {
          console.warn(
            "[updateUserMarkerDirection] Não foi possível encontrar próximo ponto da rota"
          );
          return;
        }

        // Calcular o ângulo para o próximo ponto
        const nextLat = nextPoint.lat || nextPoint[0];
        const nextLon = nextPoint.lon || nextPoint.lng || nextPoint[1];

        // Garantir que temos coordenadas válidas
        if (!nextLat || !nextLon) {
          console.warn(
            "[updateUserMarkerDirection] Próximo ponto com coordenadas inválidas"
          );
          return;
        }

        // Calcular o bearing (ângulo) entre a posição atual e o próximo ponto
        const bearing = userLocationModule.calculateBearing(
          userPos.latitude || userPos.lat,
          userPos.longitude || userPos.lon || userPos.lng,
          nextLat,
          nextLon
        );

        // Atualizar o marcador com o ângulo calculado
        userLocationModule.updateUserMarker(
          userPos.latitude || userPos.lat,
          userPos.longitude || userPos.lon || userPos.lng,
          bearing,
          userPos.accuracy || 15
        );

        console.log(
          "[updateUserMarkerDirection] Marcador apontando para o próximo ponto da rota:",
          bearing.toFixed(1) + "°"
        );

        // Armazenar o ângulo atual para uso em outras partes do sistema
        window.currentUserBearing = bearing;

        // Se estivermos em navegação ativa e a rotação estiver habilitada, rotacionar o mapa
        if (
          window.navigationState &&
          window.navigationState.isActive &&
          window.navigationState.isRotationEnabled
        ) {
          // Importar função para rotacionar mapa, se necessário
          import("../navigation/navigationController/navigationControls.js")
            .then((module) => {
              if (typeof module.setMapRotation === "function") {
                module.setMapRotation(bearing);
              }
            })
            .catch((err) =>
              console.warn(
                "[updateUserMarkerDirection] Erro ao importar controles de navegação:",
                err
              )
            );
        }
      })
      .catch((error) => {
        console.error(
          "[updateUserMarkerDirection] Erro ao importar módulo:",
          error
        );
      });
  } catch (error) {
    console.warn(
      "[updateUserMarkerDirection] Erro ao atualizar direção do marcador:",
      error
    );
  }
}

/**
 * Encontra o próximo ponto da rota a partir da posição atual
 * @param {Array} routePoints - Array de pontos da rota [[lat,lon], ...]
 * @param {Object} userPos - Posição atual {latitude, longitude}
 * @param {number} lookAheadDistance - Distância a olhar à frente em metros
 * @returns {Object} Próximo ponto {lat, lon} ou null
 */
function findNextRoutePoint(routePoints, userPos, lookAheadDistance = 30) {
  if (!routePoints || routePoints.length < 2 || !userPos) return null;

  const userLat = userPos.latitude || userPos.lat;
  const userLon = userPos.longitude || userPos.lon || userPos.lng;

  if (!userLat || !userLon) return null;

  // Encontrar o ponto mais próximo do usuário
  let closestDistance = Infinity;
  let closestIndex = -1;

  for (let i = 0; i < routePoints.length; i++) {
    const point = routePoints[i];
    const pointLat = Array.isArray(point)
      ? point[0]
      : point.lat || point.latitude;
    const pointLon = Array.isArray(point)
      ? point[1]
      : point.lon || point.lng || point.longitude;

    const distance = calculateDistance(userLat, userLon, pointLat, pointLon);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = i;
    }
  }

  // Se estamos no último ponto ou não encontramos nada
  if (closestIndex === -1 || closestIndex >= routePoints.length - 1) {
    // Retornar o destino final
    const lastPoint = routePoints[routePoints.length - 1];
    return {
      lat: Array.isArray(lastPoint)
        ? lastPoint[0]
        : lastPoint.lat || lastPoint.latitude,
      lon: Array.isArray(lastPoint)
        ? lastPoint[1]
        : lastPoint.lon || lastPoint.lng || lastPoint.longitude,
    };
  }

  // Olhar à frente na rota para evitar pontos muito próximos
  let cumulativeDistance = 0;
  let targetIndex = closestIndex;

  for (let i = closestIndex + 1; i < routePoints.length; i++) {
    const prevPoint = routePoints[i - 1];
    const currentPoint = routePoints[i];

    const prevLat = Array.isArray(prevPoint)
      ? prevPoint[0]
      : prevPoint.lat || prevPoint.latitude;
    const prevLon = Array.isArray(prevPoint)
      ? prevPoint[1]
      : prevPoint.lon || prevPoint.lng || prevPoint.longitude;
    const currLat = Array.isArray(currentPoint)
      ? currentPoint[0]
      : currentPoint.lat || currentPoint.latitude;
    const currLon = Array.isArray(currentPoint)
      ? currentPoint[1]
      : currentPoint.lon || currentPoint.lng || currentPoint.longitude;

    const segmentDistance = calculateDistance(
      prevLat,
      prevLon,
      currLat,
      currLon
    );
    cumulativeDistance += segmentDistance;

    // Se já olhamos suficientemente à frente ou este é o último ponto
    if (
      cumulativeDistance >= lookAheadDistance ||
      i === routePoints.length - 1
    ) {
      targetIndex = i;
      break;
    }
  }

  // Retornar o ponto alvo
  const targetPoint = routePoints[targetIndex];
  return {
    lat: Array.isArray(targetPoint)
      ? targetPoint[0]
      : targetPoint.lat || targetPoint.latitude,
    lon: Array.isArray(targetPoint)
      ? targetPoint[1]
      : targetPoint.lon || targetPoint.lng || targetPoint.longitude,
  };
}

/**
 * Configura um observador para atualizar continuamente a direção do marcador do usuário
 * Esta função deve ser chamada quando uma rota é plotada no mapa
 */
function setupDirectionalMarkerUpdates() {
  // Cancelar qualquer observador existente
  if (window.directionUpdateInterval) {
    clearInterval(window.directionUpdateInterval);
  }

  // Configurar novo observador para atualizar a direção a cada segundo
  window.directionUpdateInterval = setInterval(() => {
    // Verificar se temos uma rota ativa e localização do usuário
    if (
      window.lastRoutePoints &&
      userLocation &&
      userLocation.latitude &&
      userLocation.longitude
    ) {
      updateUserMarkerDirection(userLocation, window.lastRoutePoints);
    }
  }, 1000); // Atualizar a cada segundo
}

// Verificar se a função já existe, senão adicioná-la

/**
 * Calcula a distância entre dois pontos geográficos em metros
 * @param {number} lat1 - Latitude do ponto 1
 * @param {number} lon1 - Longitude do ponto 1
 * @param {number} lat2 - Latitude do ponto 2
 * @param {number} lon2 - Longitude do ponto 2
 * @returns {number} Distância em metros
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;

  const R = 6371000; // Raio da Terra em metros
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distância em metros
}

/**
 * Adiciona um indicador de carregamento/processamento no mapa
 *
 * @param {string} message - Mensagem a ser exibida no indicador
 * @returns {Object} Referência para o elemento DOM criado
 */
function addLoadingIndicator(message = "Carregando...") {
  try {
    // Verificar se já existe um indicador ativo
    const existingIndicator = document.getElementById("map-loading-indicator");
    if (existingIndicator) {
      existingIndicator.textContent = message;
      return existingIndicator;
    }

    // Criar o elemento do indicador
    const indicator = document.createElement("div");
    indicator.id = "map-loading-indicator";
    indicator.className = "map-loading-indicator";

    // Adicionar spinner e texto
    indicator.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
      </div>
      <div class="loading-text">${message}</div>
    `;

    // Adicionar estilo inline (caso o CSS não esteja carregado)
    indicator.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 1000;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    `;

    // Adicionar ao DOM
    const mapContainer = getMapContainer();
    if (mapContainer) {
      mapContainer.appendChild(indicator);
      console.log("[addLoadingIndicator] Indicador adicionado:", message);
    } else {
      // Se não encontrou o container do mapa, adicionar ao body
      document.body.appendChild(indicator);
      console.log(
        "[addLoadingIndicator] Indicador adicionado ao body:",
        message
      );
    }

    return indicator;
  } catch (error) {
    console.error("[addLoadingIndicator] Erro ao criar indicador:", error);
    return null;
  }
}

/**
 * Remove o indicador de carregamento do mapa
 *
 * @param {HTMLElement|null} indicatorElement - Referência opcional para o elemento específico
 */
function removeLoadingIndicator(indicatorElement = null) {
  try {
    // Se foi fornecido um elemento específico
    if (indicatorElement && indicatorElement.parentNode) {
      indicatorElement.parentNode.removeChild(indicatorElement);
      console.log("[removeLoadingIndicator] Indicador específico removido");
      return;
    }

    // Caso contrário, procurar por qualquer indicador ativo
    const indicator = document.getElementById("map-loading-indicator");
    if (indicator && indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
      console.log("[removeLoadingIndicator] Indicador removido");
    }
  } catch (error) {
    console.error("[removeLoadingIndicator] Erro ao remover indicador:", error);
  }
}

/**
 * Obtém o elemento contenedor do mapa
 * @returns {HTMLElement|null} Elemento do mapa ou null se não encontrado
 */
function getMapContainer() {
  // Tentar por ID comum
  let container = document.getElementById("map-container");

  // Se não encontrou, tentar pela classe do Leaflet
  if (!container) {
    container = document.querySelector(".leaflet-container");
  }

  // Se ainda não encontrou e temos uma instância de mapa, tentar pelo container da instância
  if (!container && map && typeof map.getContainer === "function") {
    try {
      container = map.getContainer();
    } catch (e) {
      console.warn(
        "[getMapContainer] Erro ao obter container via instância de mapa:",
        e
      );
    }
  }

  return container;
}
/**
 * Calcula a distância Haversine (em linha reta) entre dois pontos geográficos
 * @param {number} lat1 - Latitude do ponto 1
 * @param {number} lon1 - Longitude do ponto 1
 * @param {number} lat2 - Latitude do ponto 2
 * @param {number} lon2 - Longitude do ponto 2
 * @returns {number} Distância em metros
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  // Validar coordenadas
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    console.warn("[calculateHaversineDistance] Coordenadas inválidas");
    return 0;
  }

  const R = 6371000; // Raio da Terra em metros
  const φ1 = (lat1 * Math.PI) / 180; // φ, λ em radianos
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // em metros

  return distance;
}
