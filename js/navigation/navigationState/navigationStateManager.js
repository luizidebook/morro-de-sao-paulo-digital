/**
 * NavigationState.js
 *
 * Gerencia o estado central do sistema de navegação.
 * Este módulo implementa um sistema de estado centralizado com transições
 * controladas entre estados bem definidos e notificações de mudanças.
 */
import { updateUserMarker } from "../navigationUserLocation/user-location.js";
export let selectedLanguage = {}; // Idioma padrão
export let selectedDestination = {}; // Destino padrão

// Adicionar/modificar para armazenar dados de rotas

export let lastRouteData = null; // Armazenar dados da última rota calculada

// Adicionar verificação de segurança para lastRouteData
export function setLastRouteData(routeData) {
  // Verificar se o dado recebido é válido
  if (!routeData) {
    console.warn(
      "[navigationState] Tentativa de salvar routeData inválido:",
      routeData
    );
    return lastRouteData; // Retornar estado atual sem mudar
  }

  // Verificar tipo específico de dados esperados
  if (Array.isArray(routeData)) {
    console.log(
      "[navigationState] Armazenando array de instruções:",
      routeData.length
    );
  } else if (routeData.features && routeData.features.length > 0) {
    console.log("[navigationState] Armazenando resposta da API de rotas");
  } else {
    console.warn(
      "[navigationState] Formato desconhecido de routeData:",
      routeData
    );
  }

  lastRouteData = routeData;
  return routeData;
}

export function getLastRouteData() {
  return lastRouteData;
}

// Sistema de eventos para notificar mudanças de estado
class EventEmitter {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(
      (cb) => cb !== callback
    );
  }

  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[EventEmitter] Error in ${event} listener:`, error);
      }
    });
  }
}

// Estados possíveis de navegação
const NavigationStatus = {
  IDLE: "idle", // Parado, sem navegação ativa
  INITIALIZING: "initializing", // Inicializando (obtendo localização, etc)
  CALCULATING: "calculating", // Calculando rota
  ACTIVE: "active", // Navegação em andamento
  PAUSED: "paused", // Navegação pausada temporariamente
  REROUTING: "rerouting", // Recalculando rota
  ARRIVED: "arrived", // Chegou ao destino
  ERROR: "error", // Erro de navegação
};

// O estado compartilhado da navegação
export const navigationState = {
  // Estado principal da navegação
  status: NavigationStatus.IDLE,
  // Novas propriedades para modo 3D
  is3DModeEnabled: false,
  previousMapState: null,
  lastUserHeading: 0,

  // Para rastreamento de câmera
  followUser: true,
  autoRotateMap: true, // Estado de erro
  error: null,

  // Flag para controle da navegação
  isActive: false,
  isPaused: false,

  // Informações do destino
  selectedDestination: {
    name: "",
    lat: null,
    lon: null,
    type: null,
    id: null,
  },

  // Dados de localização e progresso
  userPosition: null,
  userLocation: null,
  routeStartTime: null,
  distanceRemaining: 0,
  distanceTotal: 0,
  timeRemaining: 0, // em segundos
  timeElapsed: 0, // em segundos

  // Instruções e progresso
  instructions: [],
  currentStepIndex: 0,
  nextStepIndex: 1,
  routeProgress: 0, // 0-100%

  // Informações da rota atual
  currentRoute: null,
  routeCoordinates: [],
  destination: null,
  // Flags de controle UI
  hasArrivedAtDestination: false,
  isOffRoute: false,
  disableTactileFeedback: false,
  controlsInitialized: false,
  voiceGuidanceEnabled: true,
  route: null,
  routeProgress: 0,
  remainingDistance: 0,
  remainingTime: 0,
  isRotationEnabled: false,
  isRotationEnabled: true,
  currentHeading: 0,
  // Configurações de linguagem
  language: "pt",
  deviationDetected: false,
  recalculationStatus: "idle",
  // Timestamp da última atualização
  lastUpdated: Date.now(),
};

// Cria o gerenciador de eventos para navegação
const navigationEvents = new EventEmitter();

export function getState() {
  return { ...navigationState }; // Retorna cópia para evitar mutação direta
}

export function updateState(updates) {
  const prevState = { ...navigationState };
  Object.assign(navigationState, updates);
  notifyStateListeners(prevState, navigationState);
  return navigationState;
}

function throttle(func, limit) {
  let lastFunc;
  let lastRan;
  return function () {
    const context = this;
    const args = arguments;
    if (!lastRan) {
      func.apply(context, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(function () {
        if (Date.now() - lastRan >= limit) {
          func.apply(context, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  };
}

// Uso:
const throttledUpdateUserMarker = throttle(updateUserMarker, 100); // Limita a 10 atualizações/segundo

// Sistema de observadores para responder a alterações de estado
const stateListeners = [];
const recalculationQueue = {
  isProcessing: false,
  pendingRecalculation: null,

  enqueue(recalcParams) {
    // Substitui qualquer recálculo pendente pelo mais recente
    this.pendingRecalculation = recalcParams;
    this.processQueue();
  },

  async processQueue() {
    if (this.isProcessing || !this.pendingRecalculation) return;

    try {
      this.isProcessing = true;
      const params = this.pendingRecalculation;
      this.pendingRecalculation = null;

      // Notificar início
      updateState({ recalculationStatus: "in-progress" });

      // Executar recálculo
      await recalculateRoute(...params);

      // Notificar conclusão
      updateState({ recalculationStatus: "completed" });
    } catch (error) {
      console.error("Erro no recálculo:", error);
      updateState({ recalculationStatus: "failed" });
    } finally {
      this.isProcessing = false;
      // Verificar se há outro recálculo pendente
      if (this.pendingRecalculation) {
        setTimeout(() => this.processQueue(), 300);
      }
    }
  },
};
/**
 * Atualiza o estado de navegação e notifica os ouvintes sobre as mudanças
 * @param {Object} updates - Objetos com as propriedades a serem atualizadas
 */
export function updateNavigationState(updates) {
  // Registrar estado anterior para comparação
  const previousState = { ...navigationState };

  // Registrar timestamp da atualização
  updates.lastUpdated = Date.now();

  // Aplicar atualizações ao estado
  Object.assign(navigationState, updates);

  // Se o status mudou, emitir evento específico
  if (updates.status && updates.status !== previousState.status) {
    navigationEvents.emit("status_changed", {
      previous: previousState.status,
      current: navigationState.status,
    });

    // Emitir evento específico para o novo status
    navigationEvents.emit(`status_${navigationState.status}`, navigationState);
  }

  // Verificações especiais para certos tipos de atualizações

  // Chegada ao destino
  if (
    updates.hasArrivedAtDestination &&
    !previousState.hasArrivedAtDestination
  ) {
    navigationEvents.emit("arrival", {
      destination: navigationState.selectedDestination,
      elapsedTime: navigationState.timeElapsed,
    });
  }

  // Mudança de instrução atual
  if (
    updates.currentStepIndex !== undefined &&
    updates.currentStepIndex !== previousState.currentStepIndex
  ) {
    navigationEvents.emit("instruction_changed", {
      index: navigationState.currentStepIndex,
      instruction:
        navigationState.instructions[navigationState.currentStepIndex],
    });
  }

  // Saída da rota
  if (
    updates.isOffRoute !== undefined &&
    updates.isOffRoute !== previousState.isOffRoute
  ) {
    navigationEvents.emit("route_deviation", {
      isOffRoute: navigationState.isOffRoute,
    });
  }

  // Sempre emitir evento genérico de atualização
  navigationEvents.emit("state_updated", {
    previous: previousState,
    current: navigationState,
    changes: Object.keys(updates),
  });
}

/**
 * Transição controlada entre estados da navegação
 * @param {string} newStatus - Novo estado (de NavigationStatus)
 * @param {Object} additionalUpdates - Atualizações adicionais ao estado
 * @returns {boolean} - Se a transição foi bem sucedida
 */
export function changeNavigationStatus(newStatus, additionalUpdates = {}) {
  const currentStatus = navigationState.status;

  // Validar transições permitidas
  const validTransitions = {
    [NavigationStatus.IDLE]: [
      NavigationStatus.INITIALIZING,
      NavigationStatus.ERROR,
    ],
    [NavigationStatus.INITIALIZING]: [
      NavigationStatus.CALCULATING,
      NavigationStatus.ERROR,
      NavigationStatus.IDLE,
    ],
    [NavigationStatus.CALCULATING]: [
      NavigationStatus.ACTIVE,
      NavigationStatus.ERROR,
      NavigationStatus.IDLE,
    ],
    [NavigationStatus.ACTIVE]: [
      NavigationStatus.PAUSED,
      NavigationStatus.REROUTING,
      NavigationStatus.ARRIVED,
      NavigationStatus.ERROR,
      NavigationStatus.IDLE,
    ],
    [NavigationStatus.PAUSED]: [
      NavigationStatus.ACTIVE,
      NavigationStatus.REROUTING,
      NavigationStatus.ERROR,
      NavigationStatus.IDLE,
    ],
    [NavigationStatus.REROUTING]: [
      NavigationStatus.ACTIVE,
      NavigationStatus.ERROR,
      NavigationStatus.IDLE,
    ],
    [NavigationStatus.ARRIVED]: [
      NavigationStatus.IDLE,
      NavigationStatus.INITIALIZING, // Para nova navegação
    ],
    [NavigationStatus.ERROR]: [
      NavigationStatus.IDLE,
      NavigationStatus.INITIALIZING, // Para tentar novamente
    ],
  };

  // Verificar se a transição é permitida
  if (!validTransitions[currentStatus]?.includes(newStatus)) {
    console.error(
      `[NavigationState] Transição inválida de estado: ${currentStatus} -> ${newStatus}`
    );
    return false;
  }

  // Ações específicas para certos estados
  const stateUpdates = {
    ...additionalUpdates,
    status: newStatus,
  };

  switch (newStatus) {
    case NavigationStatus.IDLE:
      // Resetar tudo ao ficar ocioso
      stateUpdates.isActive = false;
      stateUpdates.isPaused = false;
      stateUpdates.hasArrivedAtDestination = false;
      stateUpdates.isOffRoute = false;
      break;

    case NavigationStatus.INITIALIZING:
      // Preparar para inicialização
      stateUpdates.isActive = false;
      stateUpdates.error = null;
      break;

    case NavigationStatus.ACTIVE:
      // Ativar navegação
      stateUpdates.isActive = true;
      stateUpdates.isPaused = false;
      stateUpdates.routeStartTime = stateUpdates.routeStartTime || Date.now();
      break;

    case NavigationStatus.PAUSED:
      // Pausar
      stateUpdates.isPaused = true;
      break;

    case NavigationStatus.ARRIVED:
      stateUpdates.hasArrivedAtDestination = true;
      break;

    case NavigationStatus.ERROR:
      // Garantir que temos informações do erro
      if (!stateUpdates.error && !additionalUpdates.error) {
        stateUpdates.error = {
          code: "unknown",
          message: "Erro desconhecido no sistema de navegação",
        };
      }
      break;
  }

  // Aplicar atualizações ao estado
  updateNavigationState(stateUpdates);

  return true;
}

/**
 * Retorna o destino atual selecionado
 * @returns {Object} Objeto com dados do destino
 */
export function getCurrentDestination() {
  return navigationState.selectedDestination;
}

/**
 * Reseta completamente o estado da navegação
 */
export function resetNavigationState() {
  // Preservar apenas as configurações do usuário
  const userPreferences = {
    language: navigationState.language,
    voiceGuidanceEnabled: navigationState.voiceGuidanceEnabled,
    disableTactileFeedback: navigationState.disableTactileFeedback,
  };

  // Criar um novo estado com valores padrão
  Object.keys(navigationState).forEach((key) => {
    if (key === "selectedDestination") {
      navigationState[key] = {
        name: "",
        lat: null,
        lon: null,
        type: null,
        id: null,
      };
    } else if (userPreferences.hasOwnProperty(key)) {
      // Manter preferências do usuário
      navigationState[key] = userPreferences[key];
    } else if (Array.isArray(navigationState[key])) {
      navigationState[key] = [];
    } else if (
      typeof navigationState[key] === "object" &&
      navigationState[key] !== null
    ) {
      navigationState[key] = null;
    } else if (typeof navigationState[key] === "boolean") {
      navigationState[key] = false;
    } else if (typeof navigationState[key] === "number") {
      navigationState[key] = 0;
    } else if (typeof navigationState[key] === "string") {
      navigationState[key] = "";
    }
  });

  // Restaurar valores iniciais específicos
  navigationState.status = NavigationStatus.IDLE;
  navigationState.lastUpdated = Date.now();

  // Notificar listeners
  navigationEvents.emit("state_reset", navigationState);
}

/**
 * Registra um ouvinte para eventos de navegação
 * @param {string} event - Nome do evento
 * @param {Function} callback - Função callback
 * @returns {Function} - Função para remover o ouvinte
 */
export function onNavigationEvent(event, callback) {
  return navigationEvents.on(event, callback);
}

/**
 * Salva o estado atual para posterior restauração
 * (ex: em caso de reload da página)
 */
export function persistNavigationState() {
  try {
    // Não salvar dados sensíveis ou muito grandes
    const stateToSave = {
      status: navigationState.status,
      selectedDestination: navigationState.selectedDestination,
      language: navigationState.language,
      voiceGuidanceEnabled: navigationState.voiceGuidanceEnabled,
      disableTactileFeedback: navigationState.disableTactileFeedback,
    };

    localStorage.setItem("saved_navigation_state", JSON.stringify(stateToSave));
  } catch (error) {
    console.error("[NavigationState] Erro ao persistir estado:", error);
  }
}

/**
 * Tenta restaurar um estado salvo anteriormente
 * @returns {boolean} - true se conseguiu restaurar, false caso contrário
 */
export function restoreNavigationState() {
  try {
    const savedState = localStorage.getItem("saved_navigation_state");
    if (!savedState) return false;

    const parsedState = JSON.parse(savedState);

    // Validar dados
    if (!parsedState || !parsedState.selectedDestination) {
      return false;
    }

    // Aplicar apenas dados seguros
    updateNavigationState({
      language: parsedState.language,
      voiceGuidanceEnabled: parsedState.voiceGuidanceEnabled,
      disableTactileFeedback: parsedState.disableTactileFeedback,
    });

    // Se havia um destino e navegação ativa,
    // notificar mas não restaurar automaticamente
    if (
      parsedState.status !== NavigationStatus.IDLE &&
      parsedState.selectedDestination?.lat
    ) {
      navigationEvents.emit("previous_navigation_found", {
        destination: parsedState.selectedDestination,
      });
    }

    return true;
  } catch (error) {
    console.error("[NavigationState] Erro ao restaurar estado:", error);
    return false;
  }
}

// Exportar constantes e interfaces
export { NavigationStatus, EventEmitter };

// Valores de configuração padrão para navegação
export const DEFAULT_NAVIGATION_CONFIG = {
  // Distâncias importantes (em metros)
  DISTANCES: {
    NEAR_INSTRUCTION: 50, // Destacar próxima instrução
    VERY_NEAR_INSTRUCTION: 20, // Transição iminente
    ARRIVAL_THRESHOLD: 15, // Considerado como chegada
    RECALCULATION_THRESHOLD: 30, // Máxima distância permitida da rota
  },

  // Tempos (em ms)
  TIMING: {
    INSTRUCTION_ADVANCE_DELAY: 500,
    VOICE_FEEDBACK_DELAY: 800,
    MAP_UPDATE_THROTTLE: 250,
    RECALCULATION_MINIMUM_INTERVAL: 5000,
  },
};

// Adicionar a lastRouteData na exportação default
export default {
  lastRouteData,
  setLastRouteData,
  getLastRouteData,
};
