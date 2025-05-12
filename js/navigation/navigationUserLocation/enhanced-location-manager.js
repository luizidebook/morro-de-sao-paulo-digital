/**
 * Sistema de gerenciamento de localização avançado
 * Fornece localização precisa, eficiente e confiável para a navegação
 */

import { navigationState } from "../navigationState/navigationStateManager.js";
import {
  updateUserMarker,
  calculateBearing,
  createUserMarker,
  createAccuracyCircle,
} from "./enhanced-user-marker.js";
import { updateRealTimeNavigation } from "../navigationController/navigationController.js";

// Configurações do sistema de localização
const LocationConfig = {
  // Níveis de precisão em metros
  ACCURACY: {
    ULTRA_HIGH: 5, // Para posicionamento preciso em interseções
    HIGH: 10, // Para navegação urbana normal
    MEDIUM: 25, // Para navegação em áreas suburbanas
    LOW: 50, // Para navegação em estradas
    VERY_LOW: 100, // Para contexto geográfico aproximado
  },

  // Intervalos de atualização em ms
  UPDATE_INTERVALS: {
    REALTIME: 1000, // Atualização contínua para navegação ativa
    FREQUENT: 3000, // Frequente para quando se aproxima de manobras
    NORMAL: 5000, // Padrão para economia de bateria durante navegação
    BACKGROUND: 10000, // Menos frequente quando app em background
    IDLE: 30000, // Apenas manter contexto quando não está navegando
  },

  // Timeouts para obtenção de localização
  TIMEOUTS: {
    CRITICAL: 5000, // Para manobras iminentes
    STANDARD: 15000, // Padrão para navegação
    PATIENT: 30000, // Para inicialização ou recuperação
  },

  // Thresholds para ativar diferentes algoritmos
  THRESHOLDS: {
    MOVEMENT_MIN: 3, // Movimento mínimo para considerar que houve deslocamento (m)
    DIRECTION_CHANGE: 20, // Mudança significativa de direção (graus)
    SIGNAL_LOSS: 10000, // Tempo máximo sem atualização de localização (ms)
    ACCURACY_JUMP: 50, // Mudança abrupta de precisão que requer atenção (m)
  },
};

// Estado interno do gerenciador de localização
const locationState = {
  // Estado atual
  currentLocation: null,
  previousLocation: null,
  lastAccurateLocation: null,

  // Monitoramento
  watchPositionId: null,
  updateInterval: null,
  backgroundUpdateInterval: null,

  // Análise de movimento
  isMoving: false,
  currentSpeed: 0,
  averageSpeed: 0,
  speedSamples: [],

  // Controle de qualidade
  accuracyHistory: [],
  signalQuality: "unknown", // 'good', 'fair', 'poor', 'lost'
  lastGoodSignalTime: 0,

  // Estratégia
  currentStrategy: "normal", // 'high-accuracy', 'normal', 'battery-saving', 'background'

  // Callbacks
  onLocationUpdate: null,
  onSignalLost: null,
  onSignalRecovered: null,

  // Timestamps de controle
  lastUpdateTime: 0,
  lastAccurateUpdateTime: 0,
};

/**
 * Inicializa o sistema de localização
 * @param {Object} options - Opções de configuração
 */
export function initLocationSystem(options = {}) {
  console.log("[LocationSystem] Inicializando sistema de localização avançado");

  // Combinar configurações padrão com opções do usuário
  const settings = {
    enableHighAccuracy: true,
    autoStart: true,
    adaptivePrecision: true,
    signalRecovery: true,
    ...options,
  };

  // Configurar callbacks
  if (options.onLocationUpdate)
    locationState.onLocationUpdate = options.onLocationUpdate;
  if (options.onSignalLost) locationState.onSignalLost = options.onSignalLost;
  if (options.onSignalRecovered)
    locationState.onSignalRecovered = options.onSignalRecovered;

  // Iniciar rastreamento automaticamente se configurado
  if (settings.autoStart) {
    startLocationTracking({
      enableHighAccuracy: settings.enableHighAccuracy,
      adaptivePrecision: settings.adaptivePrecision,
    });
  }

  // Exportar funções para acesso global
  exposeGlobalFunctions();

  return true;
}

/**
 * Inicia o rastreamento de localização do usuário
 * @param {Object} options - Opções de configuração
 * @returns {Promise<boolean>} - Sucesso da operação
 */
export async function startLocationTracking(options = {}) {
  // Interromper rastreamento anterior se existir
  stopLocationTracking();

  // Verificar permissão primeiro
  const hasPermission = await requestLocationPermission();
  if (!hasPermission) {
    console.error("[LocationSystem] Permissão de localização negada");
    return false;
  }

  // Configurações padrão
  const trackingOptions = {
    enableHighAccuracy: navigationState.isActive ? true : false,
    adaptivePrecision: true,
    interval: navigationState.isActive
      ? LocationConfig.UPDATE_INTERVALS.REALTIME
      : LocationConfig.UPDATE_INTERVALS.NORMAL,
    ...options,
  };

  try {
    // Definir estratégia inicial com base no contexto
    locationState.currentStrategy = determineOptimalStrategy();

    // Iniciar monitoramento contínuo
    locationState.watchPositionId = navigator.geolocation.watchPosition(
      (position) => processNewLocation(position, trackingOptions),
      (error) => handleLocationError(error),
      {
        enableHighAccuracy: trackingOptions.enableHighAccuracy,
        timeout: LocationConfig.TIMEOUTS.STANDARD,
        maximumAge: 0,
      }
    );

    // Iniciar intervalo adicional para atualização de lógica de movimento
    locationState.updateInterval = setInterval(
      () => updateMovementAnalysis(),
      trackingOptions.interval
    );

    // Iniciar intervalo para verificações de integridade
    locationState.healthCheckInterval = setInterval(
      () => performHealthCheck(),
      LocationConfig.UPDATE_INTERVALS.NORMAL
    );

    console.log("[LocationSystem] Rastreamento de localização iniciado:", {
      strategy: locationState.currentStrategy,
      options: trackingOptions,
    });

    return true;
  } catch (error) {
    console.error("[LocationSystem] Erro ao iniciar rastreamento:", error);
    return false;
  }
}

/**
 * Interrompe o rastreamento de localização
 */
export function stopLocationTracking() {
  if (locationState.watchPositionId !== null) {
    navigator.geolocation.clearWatch(locationState.watchPositionId);
    locationState.watchPositionId = null;
  }

  if (locationState.updateInterval) {
    clearInterval(locationState.updateInterval);
    locationState.updateInterval = null;
  }

  if (locationState.healthCheckInterval) {
    clearInterval(locationState.healthCheckInterval);
    locationState.healthCheckInterval = null;
  }

  if (locationState.backgroundUpdateInterval) {
    clearInterval(locationState.backgroundUpdateInterval);
    locationState.backgroundUpdateInterval = null;
  }

  console.log("[LocationSystem] Rastreamento de localização interrompido");
}

/**
 * Processa uma nova localização recebida
 * @param {GeolocationPosition} position - Posição recebida da API Geolocation
 * @param {Object} options - Opções de processamento
 */
function processNewLocation(position, options = {}) {
  try {
    const now = Date.now();

    // Extrair dados da posição
    const newLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      heading: position.coords.heading || 0,
      speed: position.coords.speed || 0,
      timestamp: position.timestamp,
      receivedAt: now,
    };

    // Guardar localização anterior
    if (locationState.currentLocation) {
      locationState.previousLocation = { ...locationState.currentLocation };
    }

    // Avaliar a precisão da nova localização
    evaluateLocationQuality(newLocation);

    // Guardar nova localização
    locationState.currentLocation = newLocation;
    locationState.lastUpdateTime = now;

    // Atualizar dados de movimento e velocidade
    updateSpeedData(newLocation);

    // Salvar como localização precisa se atender aos critérios
    if (newLocation.accuracy <= getDesiredAccuracyForContext()) {
      locationState.lastAccurateLocation = { ...newLocation };
      locationState.lastAccurateUpdateTime = now;
    }

    // Atualizar objeto global de localização para compatibilidade
    window.userLocation = { ...newLocation };

    // Criar ou atualizar o marcador na tela
    updateUserVisualization(newLocation);

    // Executar callback de atualização de localização se existir
    if (typeof locationState.onLocationUpdate === "function") {
      locationState.onLocationUpdate(newLocation);
    }

    // Atualizar navegação em tempo real se estiver ativa
    if (
      navigationState.isActive &&
      typeof updateRealTimeNavigation === "function"
    ) {
      updateRealTimeNavigation(newLocation);
    }

    // Ajustar estratégia de localização baseada no contexto atual
    if (options.adaptivePrecision) {
      optimizeLocationStrategy();
    }

    return newLocation;
  } catch (error) {
    console.error(
      "[LocationSystem] Erro ao processar nova localização:",
      error
    );
    return null;
  }
}

/**
 * Avalia a qualidade de uma nova localização
 * @param {Object} location - Nova localização recebida
 */
function evaluateLocationQuality(location) {
  // Registrar histórico de precisão (últimas 5 amostras)
  locationState.accuracyHistory.push(location.accuracy);
  if (locationState.accuracyHistory.length > 5) {
    locationState.accuracyHistory.shift();
  }

  // Análise de precisão média
  const averageAccuracy =
    locationState.accuracyHistory.reduce((sum, acc) => sum + acc, 0) /
    locationState.accuracyHistory.length;

  // Determinar qualidade do sinal
  let newQuality;
  if (location.accuracy <= LocationConfig.ACCURACY.HIGH) {
    newQuality = "good";
    locationState.lastGoodSignalTime = Date.now();
  } else if (location.accuracy <= LocationConfig.ACCURACY.MEDIUM) {
    newQuality = "fair";
  } else if (location.accuracy <= LocationConfig.ACCURACY.LOW) {
    newQuality = "poor";
  } else {
    newQuality = "very-poor";
  }

  // Detectar mudanças abruptas de qualidade
  if (
    locationState.signalQuality !== "unknown" &&
    locationState.signalQuality !== newQuality
  ) {
    // Se recuperou de um sinal ruim
    if (
      (locationState.signalQuality === "poor" ||
        locationState.signalQuality === "very-poor") &&
      (newQuality === "good" || newQuality === "fair")
    ) {
      console.log(
        "[LocationSystem] Qualidade do sinal recuperada:",
        newQuality
      );
      if (typeof locationState.onSignalRecovered === "function") {
        locationState.onSignalRecovered(location, newQuality);
      }
    }

    // Se houve degradação significativa
    if (
      (locationState.signalQuality === "good" ||
        locationState.signalQuality === "fair") &&
      (newQuality === "poor" || newQuality === "very-poor")
    ) {
      console.log(
        "[LocationSystem] Degradação da qualidade do sinal:",
        newQuality
      );
    }
  }

  // Atualizar estado de qualidade
  locationState.signalQuality = newQuality;
}

/**
 * Atualiza os dados de velocidade e movimento
 * @param {Object} location - Nova localização
 */
function updateSpeedData(location) {
  if (!locationState.previousLocation) return;

  const timeDiff =
    (location.timestamp - locationState.previousLocation.timestamp) / 1000;
  if (timeDiff <= 0) return;

  // Calcular distância percorrida
  const distance = calculateDistance(
    locationState.previousLocation.latitude,
    locationState.previousLocation.longitude,
    location.latitude,
    location.longitude
  );

  // Calcular velocidade em m/s
  const calculatedSpeed = timeDiff > 0 ? distance / timeDiff : 0;

  // Usar velocidade fornecida pelo GPS se disponível e confiável, senão a calculada
  let speed;
  if (
    location.speed !== null &&
    location.speed !== undefined &&
    !isNaN(location.speed) &&
    location.speed >= 0
  ) {
    speed = location.speed;
  } else {
    speed = calculatedSpeed;
  }

  // Atualizar velocidade atual
  locationState.currentSpeed = speed;

  // Adicionar à lista de amostras para média móvel (máximo 5 amostras)
  locationState.speedSamples.push(speed);
  if (locationState.speedSamples.length > 5) {
    locationState.speedSamples.shift();
  }

  // Calcular velocidade média
  locationState.averageSpeed =
    locationState.speedSamples.reduce((sum, s) => sum + s, 0) /
    locationState.speedSamples.length;

  // Determinar se está em movimento (velocidade média acima de 0.5 m/s - cerca de 1.8 km/h)
  locationState.isMoving = locationState.averageSpeed > 0.5;
}

/**
 * Atualiza a visualização do usuário no mapa
 * @param {Object} location - Localização atual
 */
function updateUserVisualization(location) {
  try {
    // Verificar se o marcador já existe
    if (!window.userMarker && typeof createUserMarker === "function") {
      // Criar marcador pela primeira vez
      createUserMarker(
        location.latitude,
        location.longitude,
        location.heading,
        location.accuracy
      );

      // Criar círculo de precisão
      if (typeof createAccuracyCircle === "function") {
        createAccuracyCircle(
          location.latitude,
          location.longitude,
          location.accuracy
        );
      }
    } else if (typeof updateUserMarker === "function") {
      // Determinar o heading correto para o marcador
      const heading = determineOptimalHeading(location);

      // Atualizar posição e direção do marcador existente
      updateUserMarker(
        location.latitude,
        location.longitude,
        heading,
        location.accuracy
      );
    }
  } catch (error) {
    console.error(
      "[LocationSystem] Erro ao atualizar visualização do usuário:",
      error
    );
  }
}

/**
 * Determina a melhor direção (heading) para o marcador do usuário
 * @param {Object} location - Localização atual
 * @returns {number} - Direção em graus (0-359)
 */
function determineOptimalHeading(location) {
  // Se existe uma direção calculada no estado de navegação, usar essa como preferência
  if (
    typeof navigationState.calculatedBearing === "number" &&
    !isNaN(navigationState.calculatedBearing) &&
    navigationState.isActive
  ) {
    return navigationState.calculatedBearing;
  }

  // Se o GPS fornece heading e está em movimento, usar o heading do GPS
  if (
    location.speed > 1 &&
    typeof location.heading === "number" &&
    !isNaN(location.heading)
  ) {
    return location.heading;
  }

  // Se tem localização anterior e está em movimento, calcular direção baseada no movimento
  if (locationState.previousLocation && locationState.isMoving) {
    return calculateBearing(
      locationState.previousLocation.latitude,
      locationState.previousLocation.longitude,
      location.latitude,
      location.longitude
    );
  }

  // Fallback: usar o último heading conhecido ou 0 como padrão
  return location.heading || 0;
}

/**
 * Realiza verificação de integridade do sistema de localização
 */
function performHealthCheck() {
  const now = Date.now();

  // Verificar perda de sinal
  const timeSinceLastUpdate = now - locationState.lastUpdateTime;
  if (timeSinceLastUpdate > LocationConfig.THRESHOLDS.SIGNAL_LOSS) {
    handleSignalLoss(timeSinceLastUpdate);
  }

  // Verificar sinal consistentemente ruim
  if (
    locationState.signalQuality === "poor" ||
    locationState.signalQuality === "very-poor"
  ) {
    const poorSignalDuration = now - locationState.lastGoodSignalTime;
    if (poorSignalDuration > LocationConfig.THRESHOLDS.SIGNAL_LOSS) {
      handlePoorSignal();
    }
  }
}

/**
 * Lida com perda de sinal GPS
 * @param {number} duration - Duração da perda de sinal em ms
 */
function handleSignalLoss(duration) {
  console.warn(
    `[LocationSystem] Perda de sinal detectada (${Math.round(
      duration / 1000
    )}s)`
  );

  // Atualizar estado
  locationState.signalQuality = "lost";

  // Tentar obter localização uma vez com alta prioridade
  navigator.geolocation.getCurrentPosition(
    (position) => {
      processNewLocation(position, { forceUpdate: true });
      console.log("[LocationSystem] Sinal recuperado após solicitação única");
    },
    (error) => {
      console.error(
        "[LocationSystem] Tentativa de recuperar sinal falhou:",
        error
      );

      // Notificar perda de sinal
      if (typeof locationState.onSignalLost === "function") {
        locationState.onSignalLost(duration);
      }

      // Se estiver em navegação ativa, tentar medidas mais agressivas de recuperação
      if (navigationState.isActive) {
        restartLocationTracking({ highPriority: true });
      }
    },
    {
      enableHighAccuracy: true,
      timeout: LocationConfig.TIMEOUTS.CRITICAL,
      maximumAge: 0,
    }
  );
}

/**
 * Lida com sinal GPS persistentemente ruim
 */
function handlePoorSignal() {
  console.warn("[LocationSystem] Sinal persistentemente ruim detectado");

  // Se estiver em navegação ativa, tentar alternar configurações para melhorar sinal
  if (navigationState.isActive) {
    console.log(
      "[LocationSystem] Tentando alternar configurações para recuperar sinal"
    );
    restartLocationTracking({
      enableHighAccuracy: !locationState.currentHighAccuracy,
      timeout: LocationConfig.TIMEOUTS.PATIENT,
    });
  }
}

/**
 * Reinicia o rastreamento de localização com novas configurações
 * @param {Object} options - Novas opções para rastreamento
 */
function restartLocationTracking(options = {}) {
  console.log("[LocationSystem] Reiniciando rastreamento de localização");

  // Parar rastreamento atual
  stopLocationTracking();

  // Pequena pausa para garantir limpeza completa
  setTimeout(() => {
    // Iniciar com novas opções
    startLocationTracking({
      ...options,
      forceRestart: true,
    });
  }, 500);
}

/**
 * Realiza análise de padrões de movimento para otimizar rastreamento
 */
function updateMovementAnalysis() {
  // Verificar se há dados suficientes
  if (!locationState.currentLocation || !locationState.previousLocation) {
    return;
  }

  // Converter velocidade de m/s para km/h para análise
  const speedKmh = locationState.averageSpeed * 3.6;

  // Detectar mudanças no padrão de movimento
  let movementPattern;

  if (speedKmh < 0.5) {
    movementPattern = "stationary";
  } else if (speedKmh < 4) {
    movementPattern = "walking";
  } else if (speedKmh < 15) {
    movementPattern = "jogging";
  } else {
    movementPattern = "vehicle";
  }

  // Atualizar estratégia se necessário com base no padrão de movimento
  if (movementPattern !== locationState.movementPattern) {
    locationState.movementPattern = movementPattern;
    optimizeLocationStrategy();
  }
}

/**
 * Otimiza a estratégia de localização com base no contexto atual
 */
function optimizeLocationStrategy() {
  // Determinar a melhor estratégia para o contexto atual
  const newStrategy = determineOptimalStrategy();

  // Se a estratégia mudou, aplicar novas configurações
  if (newStrategy !== locationState.currentStrategy) {
    console.log(
      `[LocationSystem] Alterando estratégia: ${locationState.currentStrategy} → ${newStrategy}`
    );

    locationState.currentStrategy = newStrategy;

    // Aplicar configurações baseadas na nova estratégia
    applyStrategySettings(newStrategy);
  }
}

/**
 * Determina a estratégia de localização ideal para o contexto atual
 * @returns {string} - Nome da estratégia ('high-accuracy', 'normal', 'battery-saving', 'background')
 */
function determineOptimalStrategy() {
  // Se estiver em navegação ativa
  if (navigationState.isActive) {
    // Se estiver se aproximando de uma manobra
    if (isApproachingManeuver()) {
      return "high-accuracy";
    }

    // Padrão para navegação
    return "normal";
  }

  // Se não estiver navegando
  if (document.hidden) {
    return "background";
  }

  // Economia de bateria quando não está navegando
  return "battery-saving";
}

/**
 * Verifica se o usuário está se aproximando de uma manobra
 * @returns {boolean}
 */
function isApproachingManeuver() {
  if (
    !navigationState.isActive ||
    !navigationState.instructions ||
    !navigationState.currentStepIndex
  ) {
    return false;
  }

  const nextStep =
    navigationState.instructions[navigationState.currentStepIndex + 1];
  if (!nextStep) return false;

  const currentLocation = locationState.currentLocation;
  if (!currentLocation) return false;

  // Determinar distância até a próxima manobra
  const nextStepLat = nextStep.latitude || nextStep.lat;
  const nextStepLon = nextStep.longitude || nextStep.lon || nextStep.lng;

  if (!nextStepLat || !nextStepLon) return false;

  // Calcular distância até a próxima manobra
  const distance = calculateDistance(
    currentLocation.latitude,
    currentLocation.longitude,
    nextStepLat,
    nextStepLon
  );

  // Está aproximando se estiver a menos de 100m da manobra
  return distance < 100;
}

/**
 * Aplica configurações de acordo com a estratégia de localização
 * @param {string} strategy - Estratégia de localização
 */
function applyStrategySettings(strategy) {
  // Parar o rastreamento existente
  if (locationState.watchPositionId !== null) {
    navigator.geolocation.clearWatch(locationState.watchPositionId);
    locationState.watchPositionId = null;
  }

  // Ajustar intervalo de atualização
  if (locationState.updateInterval) {
    clearInterval(locationState.updateInterval);
  }

  let updateInterval;
  let geoOptions = {};

  // Configurar com base na estratégia
  switch (strategy) {
    case "high-accuracy":
      geoOptions = {
        enableHighAccuracy: true,
        timeout: LocationConfig.TIMEOUTS.CRITICAL,
        maximumAge: 0,
      };
      updateInterval = LocationConfig.UPDATE_INTERVALS.REALTIME;
      break;

    case "normal":
      geoOptions = {
        enableHighAccuracy: true,
        timeout: LocationConfig.TIMEOUTS.STANDARD,
        maximumAge: 1000,
      };
      updateInterval = LocationConfig.UPDATE_INTERVALS.NORMAL;
      break;

    case "battery-saving":
      geoOptions = {
        enableHighAccuracy: false,
        timeout: LocationConfig.TIMEOUTS.STANDARD,
        maximumAge: 10000,
      };
      updateInterval = LocationConfig.UPDATE_INTERVALS.FREQUENT;
      break;

    case "background":
      geoOptions = {
        enableHighAccuracy: false,
        timeout: LocationConfig.TIMEOUTS.STANDARD,
        maximumAge: 30000,
      };
      updateInterval = LocationConfig.UPDATE_INTERVALS.BACKGROUND;
      break;
  }

  // Aplicar novas configurações
  locationState.currentHighAccuracy = geoOptions.enableHighAccuracy;

  // Iniciar novo rastreamento
  locationState.watchPositionId = navigator.geolocation.watchPosition(
    (position) => processNewLocation(position),
    (error) => handleLocationError(error),
    geoOptions
  );

  // Configurar novo intervalo
  locationState.updateInterval = setInterval(
    () => updateMovementAnalysis(),
    updateInterval
  );
}

/**
 * Determina a precisão desejada para o contexto atual
 * @returns {number} - Precisão em metros
 */
function getDesiredAccuracyForContext() {
  if (navigationState.isActive) {
    // Se está próximo de uma manobra, exigir alta precisão
    if (isApproachingManeuver()) {
      return LocationConfig.ACCURACY.HIGH;
    }

    // Durante navegação normal
    return LocationConfig.ACCURACY.MEDIUM;
  }

  // Quando não está navegando
  return LocationConfig.ACCURACY.LOW;
}

/**
 * Lida com erros na obtenção de localização
 * @param {GeolocationPositionError} error - Erro da API Geolocation
 */
function handleLocationError(error) {
  console.error("[LocationSystem] Erro de geolocalização:", error.message);

  switch (error.code) {
    case error.PERMISSION_DENIED:
      console.error("[LocationSystem] Usuário negou acesso à localização");
      break;

    case error.POSITION_UNAVAILABLE:
      console.error("[LocationSystem] Localização indisponível");
      // Tentar recuperar com configurações alternativas após breve atraso
      setTimeout(() => {
        restartLocationTracking({
          enableHighAccuracy: !locationState.currentHighAccuracy,
        });
      }, 2000);
      break;

    case error.TIMEOUT:
      console.error("[LocationSystem] Timeout ao obter localização");
      // Tentar com timeout maior
      setTimeout(() => {
        restartLocationTracking({
          timeout: LocationConfig.TIMEOUTS.PATIENT,
        });
      }, 1000);
      break;
  }
}

/**
 * Obtém a melhor localização possível uma única vez
 * @param {Object} options - Opções para obtenção de localização
 * @returns {Promise<Object>} - Promessa com a localização
 */
export async function getBestLocation(options = {}) {
  const settings = {
    maxWaitTime: LocationConfig.TIMEOUTS.STANDARD,
    desiredAccuracy: LocationConfig.ACCURACY.MEDIUM,
    timeoutStrategy: "best-available", // 'fail', 'best-available', 'last-known'
    ...options,
  };

  return new Promise((resolve, reject) => {
    // Se já temos uma localização que atenda os critérios, retornar imediatamente
    if (
      locationState.currentLocation &&
      locationState.currentLocation.accuracy <= settings.desiredAccuracy
    ) {
      return resolve(locationState.currentLocation);
    }

    // Controladores de timeout
    let watchId = null;
    let timeoutId = null;
    let resolved = false;

    // Variáveis para guardar a melhor localização obtida
    let bestLocation = locationState.currentLocation;
    let bestAccuracy = bestLocation ? bestLocation.accuracy : Infinity;

    // Função para limpar recursos
    const cleanup = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    // Função para finalizar com a melhor localização disponível
    const resolveWithBestAvailable = () => {
      if (resolved) return;
      resolved = true;

      // Limpar recursos
      cleanup();

      // Se não temos nenhuma localização, falhar
      if (!bestLocation) {
        if (settings.timeoutStrategy === "fail") {
          return reject(
            new Error(
              "Não foi possível obter localização no tempo especificado"
            )
          );
        } else if (settings.timeoutStrategy === "last-known") {
          // Tentar retornar a última localização conhecida
          const lastKnown =
            locationState.lastAccurateLocation || locationState.currentLocation;
          if (lastKnown) {
            console.warn(
              "[LocationSystem] Usando última localização conhecida"
            );
            return resolve(lastKnown);
          } else {
            return reject(new Error("Nenhuma localização disponível"));
          }
        }
      }

      console.log(
        `[LocationSystem] Retornando melhor localização disponível (precisão: ${bestAccuracy.toFixed(
          1
        )}m)`
      );
      resolve(bestLocation);
    };

    // Configurar timeout
    timeoutId = setTimeout(() => {
      console.warn(
        `[LocationSystem] Timeout após ${settings.maxWaitTime}ms esperando localização precisa`
      );
      resolveWithBestAvailable();
    }, settings.maxWaitTime);

    // Iniciar watch position para obter atualizações
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        // Converter para formato padrão
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading || 0,
          speed: position.coords.speed || 0,
          timestamp: position.timestamp,
          receivedAt: Date.now(),
        };

        // Verificar se esta é a melhor localização até agora
        if (location.accuracy < bestAccuracy) {
          bestLocation = location;
          bestAccuracy = location.accuracy;

          // Se atingimos a precisão desejada, resolver imediatamente
          if (bestAccuracy <= settings.desiredAccuracy) {
            console.log(
              `[LocationSystem] Localização com precisão desejada obtida (${bestAccuracy.toFixed(
                1
              )}m)`
            );
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve(bestLocation);
            }
          }
        }
      },
      (error) => {
        console.error(
          "[LocationSystem] Erro ao obter localização:",
          error.message
        );
        // Se ocorrer erro, tentar resolver com a melhor localização disponível
        resolveWithBestAvailable();
      },
      {
        enableHighAccuracy: true,
        timeout: settings.maxWaitTime,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Solicita permissão para acessar a localização do usuário
 * @returns {Promise<boolean>} - Resultado da solicitação
 */
export async function requestLocationPermission() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.error(
        "[LocationSystem] Geolocalização não suportada pelo navegador"
      );
      resolve(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        console.log("[LocationSystem] Permissão de localização concedida");
        resolve(true);
      },
      (error) => {
        console.error(
          "[LocationSystem] Erro ao solicitar permissão:",
          error.message
        );
        resolve(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });
}

/**
 * Calcula distância entre dois pontos em metros
 * @param {number} lat1 - Latitude do primeiro ponto
 * @param {number} lon1 - Longitude do primeiro ponto
 * @param {number} lat2 - Latitude do segundo ponto
 * @param {number} lon2 - Longitude do segundo ponto
 * @returns {number} - Distância em metros
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;

  // Implementação do algoritmo de Haversine para calcular distância
  const R = 6371000; // Raio da Terra em metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Expõe funções essenciais globalmente para outros módulos
 */
function exposeGlobalFunctions() {
  // Expor funções necessárias para o sistema existente
  window.getBestEffortLocation = getBestLocation;
  window.stopLocationTracking = stopLocationTracking;
  window.requestLocationPermission = requestLocationPermission;

  // Adicionar função para verificação de coordenadas
  window.isValidCoordinate = (lat, lon) => {
    return (
      typeof lat === "number" &&
      typeof lon === "number" &&
      !isNaN(lat) &&
      !isNaN(lon) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lon) <= 180
    );
  };
}

/**
 * Obtém o estado atual do sistema de localização
 * @returns {Object} - Estado atual do sistema
 */
export function getLocationSystemState() {
  return {
    currentLocation: locationState.currentLocation,
    signalQuality: locationState.signalQuality,
    isMoving: locationState.isMoving,
    currentSpeed: locationState.currentSpeed,
    movementPattern: locationState.movementPattern,
    strategy: locationState.currentStrategy,
    lastUpdateTime: locationState.lastUpdateTime,
  };
}

/**
 * Obtém um relatório detalhado do sistema de localização
 * @returns {Object} - Relatório completo
 */
export function getLocationSystemReport() {
  return {
    ...locationState,
    config: LocationConfig,
    diagnóstico: {
      permissãoConcedida: !!locationState.currentLocation,
      tempoDesdeÚltimaAtualização: Date.now() - locationState.lastUpdateTime,
      precisãoAtual: locationState.currentLocation?.accuracy || "N/A",
      históricoDePrecisão: locationState.accuracyHistory,
      velocidadeMédia: locationState.averageSpeed * 3.6, // m/s para km/h
    },
  };
}
