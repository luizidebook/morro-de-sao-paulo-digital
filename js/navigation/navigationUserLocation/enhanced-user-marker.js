/**
 * Gerenciamento avançado do marcador do usuário
 * Fornece visualização responsiva e precisa da posição e direção do usuário
 */

import { map } from "../../map/map-controls.js";
import { navigationState } from "../navigationState/navigationStateManager.js";
// Configuração do marcador
const MarkerConfig = {
  ICON_SIZES: {
    DEFAULT: [32, 32], // Tamanho padrão
    NAVIGATION: [36, 36], // Maior durante navegação
    PRECISE: [28, 28], // Menor quando muito preciso
  },
  ACCURACY_CIRCLE: {
    FILL_COLOR: "#4285F4",
    FILL_OPACITY: 0.15,
    STROKE_COLOR: "#4285F4",
    STROKE_OPACITY: 0.4,
    STROKE_WEIGHT: 1,
    MIN_RADIUS: 5,
  },
  MARKER_COLORS: {
    DEFAULT: "#4285F4", // Azul normal
    HIGH_ACCURACY: "#22AA44", // Verde para alta precisão
    LOW_ACCURACY: "#EE8822", // Laranja para baixa precisão
    SIGNAL_LOSS: "#DD4444", // Vermelho para perda de sinal
  },
  ANIMATION: {
    DURATION: 300, // Duração da animação em ms
    REFRESH_RATE: 60, // Taxa de atualização em FPS
    EASING: "ease-out", // Função de easing
  },
};

// Estado do marcador
const markerState = {
  marker: null,
  accuracyCircle: null,
  directionIndicator: null,
  animationInProgress: false,
  lastPosition: null,
  lastHeading: 0,
  lastAccuracy: 0,
  pulseEffect: null,
  customIconUrl: null,
  iconType: "default", // 'default', 'navigation', 'arrival', 'searching'
};

/**
 * Inicializa o sistema de marcador do usuário
 * @param {Object} options - Opções de configuração
 */
export function initUserMarker(options = {}) {
  // Verificar se mapa está disponível
  if (!map) {
    console.error(
      "[UserMarker] Mapa não disponível para inicialização do marcador"
    );
    return false;
  }

  // Aplicar configurações personalizadas
  if (options.customIconUrl) {
    markerState.customIconUrl = options.customIconUrl;
  }

  // Limpar qualquer marcador existente
  cleanupUserMarker();

  return true;
}

/**
 * Cria o marcador do usuário
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} heading - Direção em graus
 * @param {number} accuracy - Precisão em metros
 * @returns {Object|null} - Marcador criado ou null em caso de erro
 */
export function createUserMarker(lat, lng, heading = 0, accuracy = 10) {
  try {
    // Garantir que as coordenadas são válidas
    if (!isValidCoordinate(lat, lng)) {
      console.error("[UserMarker] Coordenadas inválidas:", lat, lng);
      return null;
    }

    // Verificar se o mapa está disponível
    if (!map) {
      console.error("[UserMarker] Mapa não disponível");
      return null;
    }

    // Limpar marcador existente
    cleanupUserMarker();

    // Determinar tipo de ícone baseado no contexto
    const iconType = navigationState.isActive ? "navigation" : "default";

    // Criar ícone
    const icon = createMarkerIcon(iconType, heading);

    // Criar o marcador
    markerState.marker = L.marker([lat, lng], {
      icon: icon,
      zIndexOffset: 1000, // Sempre no topo
      interactive: false, // Não interativo
      keyboard: false, // Sem navegação por teclado
      rotationAngle: heading,
      rotationOrigin: "center center",
    }).addTo(map);

    // Adicionar estilos para o popup
    addUserPopupStyles();

    // NOVO: Adicionar popup ao marcador do usuário
    const popup = L.popup({
      className: "user-location-popup",
      closeButton: false,
      autoClose: false,
      closeOnEscapeKey: false,
      closeOnClick: false,
      offset: [0, -5],
    }).setContent('<div class="user-here-popup">Você está aqui!</div>');

    markerState.marker.bindPopup(popup);
    markerState.marker.openPopup(); // Abrir o popup imediatamente

    // Criar círculo de precisão
    createAccuracyCircle(lat, lng, accuracy);

    // Armazenar valores iniciais
    markerState.lastPosition = { lat, lng };
    markerState.lastHeading = heading;
    markerState.lastAccuracy = accuracy;
    markerState.iconType = iconType;

    // Expor para acesso global (compatibilidade)
    window.userMarker = markerState.marker;

    console.log(
      `[UserMarker] Marcador criado em ${lat}, ${lng} com heading ${heading}°`
    );
    return markerState.marker;
  } catch (error) {
    console.error("[UserMarker] Erro ao criar marcador do usuário:", error);
    return null;
  }
}
/**
 * Cria o círculo de precisão
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} accuracy - Precisão em metros
 * @returns {Object|null} - Círculo criado ou null em caso de erro
 */
export function createAccuracyCircle(lat, lng, accuracy) {
  try {
    // Remover círculo anterior se existir
    if (markerState.accuracyCircle) {
      map.removeLayer(markerState.accuracyCircle);
    }

    // Garantir que a precisão é válida e não menor que o mínimo
    const radius = Math.max(accuracy, MarkerConfig.ACCURACY_CIRCLE.MIN_RADIUS);

    // Criar círculo
    markerState.accuracyCircle = L.circle([lat, lng], {
      radius: radius,
      fillColor: MarkerConfig.ACCURACY_CIRCLE.FILL_COLOR,
      fillOpacity: MarkerConfig.ACCURACY_CIRCLE.FILL_OPACITY,
      color: MarkerConfig.ACCURACY_CIRCLE.STROKE_COLOR,
      weight: MarkerConfig.ACCURACY_CIRCLE.STROKE_WEIGHT,
      opacity: MarkerConfig.ACCURACY_CIRCLE.STROKE_OPACITY,
      interactive: false,
    }).addTo(map);

    return markerState.accuracyCircle;
  } catch (error) {
    console.error("[UserMarker] Erro ao criar círculo de precisão:", error);
    return null;
  }
}

/**
 * Atualiza o marcador do usuário
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} heading - Direção em graus
 * @param {number} accuracy - Precisão em metros
 * @returns {boolean} - Sucesso da operação
 */
export function updateUserMarker(lat, lng, heading = 0, accuracy = 10) {
  try {
    // Validar coordenadas
    if (!isValidCoordinate(lat, lng)) {
      console.error("[UserMarker] Coordenadas inválidas:", lat, lng);
      return false;
    }

    // Verificar se o marcador existe
    if (!markerState.marker) {
      return createUserMarker(lat, lng, heading, accuracy) !== null;
    }

    // Usar animação se habilitado
    if (MarkerConfig.ANIMATION.DURATION > 0 && markerState.lastPosition) {
      animateMarkerMove(lat, lng, heading, accuracy);
    } else {
      // Atualização direta sem animação
      markerState.marker.setLatLng([lat, lng]);

      if (typeof markerState.marker.setRotationAngle === "function") {
        markerState.marker.setRotationAngle(heading);
      }

      updateAccuracyCircle(lat, lng, accuracy);
    }

    // Verificar se é necessário atualizar o tipo de ícone
    const iconType = determineIconType(accuracy);
    if (iconType !== markerState.iconType) {
      updateMarkerIcon(iconType, heading);
    }

    // Atualizar estado
    markerState.lastPosition = { lat, lng };
    markerState.lastHeading = heading;
    markerState.lastAccuracy = accuracy;

    return true;
  } catch (error) {
    console.error("[UserMarker] Erro ao atualizar marcador do usuário:", error);
    return false;
  }
}

/**
 * Anima a movimentação do marcador
 * @param {number} lat - Latitude de destino
 * @param {number} lng - Longitude de destino
 * @param {number} heading - Direção final
 * @param {number} accuracy - Precisão final
 */
function animateMarkerMove(lat, lng, heading, accuracy) {
  // Se já está animando, cancelar
  if (markerState.animationInProgress) {
    cancelAnimationFrame(markerState.animationFrame);
  }

  const startTime = performance.now();
  const startLat = markerState.lastPosition.lat;
  const startLng = markerState.lastPosition.lng;
  const startHeading = markerState.lastHeading;
  const startAccuracy = markerState.lastAccuracy;

  const duration = MarkerConfig.ANIMATION.DURATION;

  markerState.animationInProgress = true;

  // Normalizar ângulo para evitar rotação de 359° para 1° dando volta completa
  let headingDiff = heading - startHeading;
  if (headingDiff > 180) headingDiff -= 360;
  if (headingDiff < -180) headingDiff += 360;
  const targetHeading = startHeading + headingDiff;

  // Função de animação
  const animate = (currentTime) => {
    const elapsed = currentTime - startTime;

    if (elapsed >= duration) {
      // Finalizar animação
      if (markerState.marker) {
        markerState.marker.setLatLng([lat, lng]);
        if (typeof markerState.marker.setRotationAngle === "function") {
          markerState.marker.setRotationAngle(heading);
        }
      }
      updateAccuracyCircle(lat, lng, accuracy);
      markerState.animationInProgress = false;
      return;
    }

    // Calcular progresso da animação (0 a 1)
    const progress = easeOut(elapsed / duration);

    // Calcular posição e direção intermediárias
    const currentLat = startLat + (lat - startLat) * progress;
    const currentLng = startLng + (lng - startLng) * progress;
    const currentHeading =
      startHeading + (targetHeading - startHeading) * progress;
    const currentAccuracy =
      startAccuracy + (accuracy - startAccuracy) * progress;

    // Atualizar marcador
    if (markerState.marker) {
      markerState.marker.setLatLng([currentLat, currentLng]);
      if (typeof markerState.marker.setRotationAngle === "function") {
        markerState.marker.setRotationAngle(currentHeading % 360);
      }
    }

    // Atualizar círculo de precisão a cada 3 frames para poupar recursos
    if (Math.floor(elapsed / (1000 / MarkerConfig.REFRESH_RATE)) % 3 === 0) {
      updateAccuracyCircle(currentLat, currentLng, currentAccuracy);
    }

    // Continuar animação
    markerState.animationFrame = requestAnimationFrame(animate);
  };

  // Iniciar animação
  markerState.animationFrame = requestAnimationFrame(animate);
}

/**
 * Função de easing para suavizar a animação
 * @param {number} t - Tempo normalizado (0-1)
 * @returns {number} - Valor de easing (0-1)
 */
function easeOut(t) {
  return 1 - Math.pow(1 - t, 2);
}

/**
 * Atualiza apenas o círculo de precisão
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} accuracy - Precisão em metros
 */
function updateAccuracyCircle(lat, lng, accuracy) {
  if (!markerState.accuracyCircle) {
    createAccuracyCircle(lat, lng, accuracy);
    return;
  }

  markerState.accuracyCircle.setLatLng([lat, lng]);

  const radius = Math.max(accuracy, MarkerConfig.ACCURACY_CIRCLE.MIN_RADIUS);
  markerState.accuracyCircle.setRadius(radius);
}

/**
 * Determina o tipo de ícone com base no contexto atual
 * @param {number} accuracy - Precisão em metros
 * @returns {string} - Tipo de ícone
 */
function determineIconType(accuracy) {
  if (navigationState.isActive) {
    if (navigationState.isApproachingDestination) {
      return "arrival";
    }
    return "navigation";
  }

  if (accuracy > 50) {
    return "searching";
  }

  return "default";
}

/**
 * Atualiza o ícone do marcador
 * @param {string} iconType - Tipo de ícone
 * @param {number} heading - Direção em graus
 */
function updateMarkerIcon(iconType, heading) {
  if (!markerState.marker) return;

  const icon = createMarkerIcon(iconType, heading);
  markerState.marker.setIcon(icon);
  markerState.iconType = iconType;
}

const SVG_ICONS = {
  DEFAULT:
    '<svg viewBox="0 0 24 24" width="32" height="32" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="2" fill="#ffffff" fill-opacity="0.7"/><path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z" fill="#ff0000" stroke="#ffffff" stroke-width="1" stroke-linejoin="round" /></svg>',

  NAVIGATION:
    '<svg viewBox="0 0 24 24" width="32" height="32" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="4" fill="rgba(255, 255, 255, 0.2)"/><circle cx="12" cy="12" r="2" fill="#ffffff" fill-opacity="0.9"/><path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z" fill="#ff0000" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/></svg>',

  ARRIVAL:
    '<svg viewBox="0 0 24 24" width="32" height="32" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="6" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="3,2"/><circle cx="12" cy="12" r="3" fill="#ffffff" fill-opacity="0.7"/><path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z" fill="#00cc44" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/></svg>',

  SEARCHING:
    '<svg viewBox="0 0 24 24" width="32" height="32" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" fill="none" stroke="#ffaa00" stroke-width="1" stroke-dasharray="2,2" opacity="0.7"/><circle cx="12" cy="12" r="3" fill="#ffffff" fill-opacity="0.6"/><path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z" fill="#ffaa00" stroke="#ffffff" stroke-width="1" stroke-linejoin="round"/></svg>',

  PRECISE:
    '<svg viewBox="0 0 24 24" width="32" height="32" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="5" fill="none" stroke="#ffffff" stroke-width="1"/><circle cx="12" cy="12" r="2" fill="#ffffff"/><path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z" fill="#0066ff" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/></svg>',
};
/**
 * Cria um ícone para o marcador usando SVG inline
 * @param {string} iconType - Tipo de ícone
 * @param {number} heading - Direção em graus
 * @returns {L.DivIcon} - Ícone Leaflet
 */
function createMarkerIcon(iconType, heading) {
  // Definir tamanho do ícone
  let iconSize;
  let svgContent;

  switch (iconType) {
    case "navigation":
      iconSize = MarkerConfig.ICON_SIZES.NAVIGATION;
      svgContent = SVG_ICONS.NAVIGATION;
      break;
    case "arrival":
      iconSize = MarkerConfig.ICON_SIZES.NAVIGATION;
      svgContent = SVG_ICONS.ARRIVAL;
      break;
    case "searching":
      iconSize = MarkerConfig.ICON_SIZES.DEFAULT;
      svgContent = SVG_ICONS.SEARCHING;
      break;
    case "precise":
      iconSize = MarkerConfig.ICON_SIZES.PRECISE;
      svgContent = SVG_ICONS.PRECISE;
      break;
    default:
      iconSize = MarkerConfig.ICON_SIZES.DEFAULT;
      svgContent = SVG_ICONS.DEFAULT;
  }

  // Criar um DivIcon com SVG embutido
  return L.divIcon({
    html: `<div class="user-location-arrow">${svgContent}</div>`,
    className: `user-marker ${iconType}-marker`,
    iconSize: iconSize,
    iconAnchor: [iconSize[0] / 2, iconSize[1] / 2],
  });
}

/**
 * Atualiza a direção do marcador para apontar para um destino
 * @param {Object} currentPosition - Posição atual {lat, lng}
 * @param {Object} targetPosition - Posição de destino {lat, lng}
 * @returns {number} - Direção calculada em graus
 */
export function updateUserMarkerDirection(currentPosition, targetPosition) {
  // Validar entradas
  if (!currentPosition || !targetPosition) return null;

  // Calcular bearing
  const bearing = calculateBearing(
    currentPosition.lat || currentPosition.latitude,
    currentPosition.lng || currentPosition.longitude,
    targetPosition.lat || targetPosition.latitude,
    targetPosition.lng || targetPosition.longitude
  );

  // Atualizar apenas rotação se marcador existir
  if (markerState.marker) {
    if (typeof markerState.marker.setRotationAngle === "function") {
      markerState.marker.setRotationAngle(bearing);
    }
    markerState.lastHeading = bearing;
  }

  return bearing;
}

/**
 * Calcula o bearing (direção) entre dois pontos
 * @param {number} lat1 - Latitude inicial
 * @param {number} lon1 - Longitude inicial
 * @param {number} lat2 - Latitude final
 * @param {number} lon2 - Longitude final
 * @returns {number} - Direção em graus (0-359)
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const λ1 = (lon1 * Math.PI) / 180;
  const λ2 = (lon2 * Math.PI) / 180;

  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);

  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  if (bearing < 0) {
    bearing += 360;
  }

  return bearing;
}

/**
 * Adiciona efeito de pulsar no marcador para indicar evento ou estado
 * @param {string} type - Tipo do pulso ('normal', 'alert', 'arrival')
 * @param {number} duration - Duração em ms
 */
export function pulseUserMarker(type = "normal", duration = 2000) {
  if (!markerState.marker) return;

  // Selecionar elemento DOM do marcador
  const markerElement = markerState.marker.getElement();
  if (!markerElement) return;

  // Remover pulso anterior
  if (markerState.pulseEffect) {
    clearTimeout(markerState.pulseEffect);
    markerElement.classList.remove(
      "pulse",
      "pulse-normal",
      "pulse-alert",
      "pulse-arrival"
    );
  }

  // Adicionar classe de pulso
  markerElement.classList.add("pulse", `pulse-${type}`);

  // Definir timeout para remover efeito
  markerState.pulseEffect = setTimeout(() => {
    markerElement.classList.remove(
      "pulse",
      "pulse-normal",
      "pulse-alert",
      "pulse-arrival"
    );
    markerState.pulseEffect = null;
  }, duration);
}

/**
 * Limpa o marcador e recursos associados
 */
export function cleanupUserMarker() {
  if (markerState.marker && map) {
    map.removeLayer(markerState.marker);
    markerState.marker = null;
  }

  if (markerState.accuracyCircle && map) {
    map.removeLayer(markerState.accuracyCircle);
    markerState.accuracyCircle = null;
  }

  if (markerState.directionIndicator && map) {
    map.removeLayer(markerState.directionIndicator);
    markerState.directionIndicator = null;
  }

  if (markerState.animationInProgress) {
    cancelAnimationFrame(markerState.animationFrame);
    markerState.animationInProgress = false;
  }

  if (markerState.pulseEffect) {
    clearTimeout(markerState.pulseEffect);
    markerState.pulseEffect = null;
  }

  // Limpar referência global
  if (window.userMarker === markerState.marker) {
    window.userMarker = null;
  }
}

/**
 * Exibe temporariamente a precisão como efeito visual
 * @param {boolean} show - Se deve mostrar ou ocultar
 */
export function toggleAccuracyVisibility(show = true) {
  if (!markerState.accuracyCircle) return;

  if (show) {
    markerState.accuracyCircle.setStyle({
      fillOpacity: MarkerConfig.ACCURACY_CIRCLE.FILL_OPACITY * 2,
      opacity: MarkerConfig.ACCURACY_CIRCLE.STROKE_OPACITY * 2,
    });

    // Retornar à opacidade normal após 2 segundos
    setTimeout(() => {
      if (markerState.accuracyCircle) {
        markerState.accuracyCircle.setStyle({
          fillOpacity: MarkerConfig.ACCURACY_CIRCLE.FILL_OPACITY,
          opacity: MarkerConfig.ACCURACY_CIRCLE.STROKE_OPACITY,
        });
      }
    }, 2000);
  } else {
    markerState.accuracyCircle.setStyle({
      fillOpacity: 0,
      opacity: 0,
    });
  }
}

/**
 * Verifica se as coordenadas são válidas
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean} - Se são coordenadas válidas
 */
export function isValidCoordinate(lat, lon) {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}

// Adicionar ao enhanced-user-marker.js
// Função de compatibilidade para integração com o sistema antigo
export function bridgeToLegacyMarkerSystem(userLocation) {
  if (!userLocation) return;

  // Atualizar marcador com nova implementação
  updateUserMarker(
    userLocation.latitude,
    userLocation.longitude,
    userLocation.heading || 0,
    userLocation.accuracy || 15
  );

  // Atualizar referências globais para compatibilidade
  if (window.userMarker) {
    window.userLocation = userLocation;
  }
}

/**
 * Adiciona estilos CSS específicos para o popup do marcador do usuário
 */
export function addUserPopupStyles() {
  if (document.getElementById("user-popup-style")) return;

  const style = document.createElement("style");
  style.id = "user-popup-style";
  style.textContent = `
    .user-location-popup {
      background: #004bc7;
      color: white;
      border: none;
      border-radius: 16px;
      padding: 5px 10px;
      font-weight: bold;
      width: 142px;
      box-shadow: 0 2px 5px #004bc7;
    }
    
    .user-location-popup .leaflet-popup-content-wrapper {
      background: #004bc7;
      color: white;
      border-radius: 16px;
      padding: 0;
    }
    
    .user-location-popup .leaflet-popup-content {
      margin: 5px 10px;
      font-size: 14px;
      font-weight: bold;
      text-align: center;
      color: white;
    }
    
    .user-location-popup .leaflet-popup-tip {
      background: rgba(255, 0, 0, 0.8);
    }
    
    .user-here-popup {
      white-space: nowrap;
    }
  `;
  document.head.appendChild(style);
  console.log("[addUserPopupStyles] Estilos de popup adicionados ao documento");
}
// Expor funções para compatibilidade com sistema legado
window.createUserMarker = createUserMarker;
window.updateUserMarker = updateUserMarker;
window.createAccuracyCircle = createAccuracyCircle;
window.calculateBearing = calculateBearing;
window.isValidCoordinate = isValidCoordinate;
