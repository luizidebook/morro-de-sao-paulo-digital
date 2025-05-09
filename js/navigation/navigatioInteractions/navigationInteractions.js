/**
 * NavigationInteractions.js
 *
 * Gerencia interações do usuário com o sistema de navegação,
 * incluindo gestos, toques e entradas do usuário.
 *
 * Este módulo centraliza todo o código de interatividade
 * para isolar a lógica de UI da lógica de negócios.
 */

import {
  NavigationStatus,
  navigationState,
  onNavigationEvent,
} from "../core/navigationState.js";

// Configurações para gestos e comportamentos
const CONFIG = {
  // Dimensões e thresholds para gestos
  GESTURE: {
    SWIPE_MIN_DISTANCE: 50, // Distância mínima para considerar um swipe
    SWIPE_MAX_TIME: 300, // Tempo máximo para um swipe (ms)
    DRAG_START_THRESHOLD: 10, // Distância mínima para iniciar um arraste
    TAP_MAX_DISTANCE: 10, // Distância máxima entre pressionar e soltar para ser tap
    DOUBLE_TAP_THRESHOLD: 300, // Tempo máximo entre dois taps (ms)
  },

  // Tempos para interações
  TIMING: {
    LONG_PRESS_THRESHOLD: 700, // Tempo para considerar pressão longa (ms)
    DEBOUNCE_DELAY: 100, // Delay para debounce de eventos (ms)
    SWIPE_COOLDOWN: 500, // Tempo entre swipes consecutivos
  },

  // Feedback tátil
  HAPTIC: {
    LIGHT: 10, // Duração da vibração leve (ms)
    MEDIUM: 40, // Duração da vibração média (ms)
    STRONG: [30, 50, 30], // Padrão de vibração forte
    TURN: [30, 50], // Vibração de curva
    ARRIVAL: [30, 50, 30, 50, 30], // Vibração de chegada
  },
};

// Estado interno do módulo
const interactions = {
  // Configurações
  language: "pt",
  enableTactile: true,

  // Estado atual da interação
  touchStartTime: 0,
  touchStartX: 0,
  touchStartY: 0,
  lastTapTime: 0,
  isPanning: false,
  isDragging: false,
  longPressTriggered: false,
  swipeDirection: null,
  pressTimer: null,
  lastInteractionTime: 0,

  // Elementos DOM
  bannerElement: null,
  mapElement: null,

  // Estado da UI
  bannerState: "expanded", // 'expanded', 'minimized'
  previousBannerState: null,
  showingOverlay: false,
  showingInfo: false,
  gestureLock: false,

  // Processadores de eventos
  eventHandlers: {},
  gestureCallbacks: {},

  // Flag para garantir inicialização única
  initialized: false,
};

/**
 * Inicializa o sistema de interações da navegação
 * @param {Object} options - Opções de configuração
 */
export function initialize(options = {}) {
  if (interactions.initialized) {
    console.log("[NavigationInteractions] Já inicializado");
    return;
  }

  console.log("[NavigationInteractions] Inicializando módulo de interações");

  // Aplicar configurações
  interactions.language = options.language || "pt";
  interactions.enableTactile = options.tactileFeedback !== false;

  // Registrar para eventos de navegação
  _setupNavigationEventListeners();

  // Inicialização completa após o DOM estar pronto
  if (document.readyState === "complete") {
    _initializeDOMInteractions();
  } else {
    window.addEventListener("load", _initializeDOMInteractions);
  }

  interactions.initialized = true;
}

/**
 * Configura os listeners de eventos da navegação
 * @private
 */
function _setupNavigationEventListeners() {
  // Reagir a mudanças de estado da navegação
  onNavigationEvent("state_updated", (data) => {
    if (data.changes.includes("status")) {
      // Status da navegação mudou
      _handleNavigationStatusChange(navigationState.status);
    }

    if (data.changes.includes("userLocation") && navigationState.userLocation) {
      // Nova localização do usuário
      _handleLocationUpdate(navigationState.userLocation);
    }

    if (data.changes.includes("currentStepIndex")) {
      // Mudou a instrução atual
      _handleInstructionChange(
        navigationState.currentStepIndex,
        navigationState.instructions[navigationState.currentStepIndex]
      );
    }
  });
}

/**
 * Inicializa interações baseadas em DOM
 * @private
 */
function _initializeDOMInteractions() {
  // Localizar elementos importantes
  interactions.bannerElement = document.getElementById("instruction-banner");
  interactions.mapElement = document.getElementById("map");

  // Configurar interações com o banner
  if (interactions.bannerElement) {
    _setupBannerInteractions(interactions.bannerElement);
  } else {
    console.warn("[NavigationInteractions] Banner de instrução não encontrado");

    // Tentar novamente mais tarde - pode ainda não estar no DOM
    setTimeout(() => {
      interactions.bannerElement =
        document.getElementById("instruction-banner");
      if (interactions.bannerElement) {
        _setupBannerInteractions(interactions.bannerElement);
      }
    }, 1000);
  }

  // Configurar interações com o mapa
  if (interactions.mapElement) {
    _setupMapInteractions(interactions.mapElement);
  } else {
    console.warn("[NavigationInteractions] Elemento de mapa não encontrado");
  }

  // Eventos globais (teclado, etc.)
  _setupGlobalInteractions();

  console.log("[NavigationInteractions] Interações DOM configuradas");
}

/**
 * Configura interações com o banner de instrução
 * @param {HTMLElement} bannerElement - Elemento do banner
 * @private
 */
function _setupBannerInteractions(bannerElement) {
  // Eventos de toque
  bannerElement.addEventListener("touchstart", _handleBannerTouchStart);
  bannerElement.addEventListener("touchmove", _handleBannerTouchMove);
  bannerElement.addEventListener("touchend", _handleBannerTouchEnd);
  bannerElement.addEventListener("touchcancel", _handleBannerTouchCancel);

  // Eventos de mouse
  bannerElement.addEventListener("click", _handleBannerClick);
  bannerElement.addEventListener("dblclick", _handleBannerDoubleClick);

  // Botão de minimizar/expandir
  const minimizeBtn = bannerElement.querySelector("#minimize-navigation-btn");
  if (minimizeBtn) {
    minimizeBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // Evitar que o click propague para o banner
      toggleBannerState();
    });
  }

  // Botão de cancelar navegação
  const cancelBtn = bannerElement.querySelector("#cancel-navigation-btn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      _triggerGesture("cancelNavigation");
    });
  }
}

/**
 * Configura interações com o mapa
 * @param {HTMLElement} mapElement - Elemento do mapa
 * @private
 */
function _setupMapInteractions(mapElement) {
  // Rastrear interações com o mapa
  mapElement.addEventListener("mousedown", _handleMapInteractionStart);
  mapElement.addEventListener("touchstart", _handleMapInteractionStart);
  mapElement.addEventListener("mouseup", _handleMapInteractionEnd);
  mapElement.addEventListener("touchend", _handleMapInteractionEnd);

  // Detectar quando o usuário está interagindo com o mapa
  // (útil para minimizar automaticamente o banner)
  mapElement.addEventListener(
    "mousemove",
    _debounce(_handleMapInteraction, CONFIG.TIMING.DEBOUNCE_DELAY)
  );
  mapElement.addEventListener(
    "touchmove",
    _debounce(_handleMapInteraction, CONFIG.TIMING.DEBOUNCE_DELAY)
  );
}

/**
 * Configura interações globais (teclado, etc.)
 * @private
 */
function _setupGlobalInteractions() {
  // Listener de teclas para navegação
  document.addEventListener("keydown", (e) => {
    if (!navigationState.isActive) return;

    if (e.code === "Escape") {
      _triggerGesture("cancelNavigation");
    }
  });

  // Visibilidade da página
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      // Salvar estado
      interactions.previousBannerState = interactions.bannerState;

      if (navigationState.isActive && !navigationState.isPaused) {
        // Notificar sistema para pausar navegação
        _triggerGesture("pauseNavigation");
      }
    } else if (document.visibilityState === "visible") {
      if (navigationState.isPaused && interactions.previousBannerState) {
        // Restaurar estado anterior
        if (interactions.previousBannerState === "expanded") {
          expandBanner();
        }

        // Notificar sistema para retomar navegação
        _triggerGesture("resumeNavigation");
      }
    }
  });
}

/**
 * Handler para início de toque no banner
 * @param {TouchEvent} e - Evento de toque
 * @private
 */
function _handleBannerTouchStart(e) {
  const touch = e.touches[0];
  interactions.touchStartX = touch.clientX;
  interactions.touchStartY = touch.clientY;
  interactions.touchStartTime = Date.now();
  interactions.isDragging = false;
  interactions.longPressTriggered = false;

  // Iniciar temporizador para pressão longa
  interactions.pressTimer = setTimeout(() => {
    interactions.longPressTriggered = true;

    // Oferecer feedback tátil
    provideTactileFeedback("medium");

    // Acionar gesto de pressão longa
    _triggerGesture("longPress", {
      element: e.currentTarget,
      position: {
        x: touch.clientX,
        y: touch.clientY,
      },
    });
  }, CONFIG.TIMING.LONG_PRESS_THRESHOLD);
}

/**
 * Handler para movimento de toque no banner
 * @param {TouchEvent} e - Evento de toque
 * @private
 */
function _handleBannerTouchMove(e) {
  if (!interactions.touchStartX || !interactions.touchStartY) return;

  // Cancelar qualquer temporizador de pressão longa
  if (interactions.pressTimer) {
    clearTimeout(interactions.pressTimer);
    interactions.pressTimer = null;
  }

  const touch = e.touches[0];
  const deltaX = touch.clientX - interactions.touchStartX;
  const deltaY = touch.clientY - interactions.touchStartY;

  // Determinar direção do gesto
  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);

  // Verificar se já passou o threshold para iniciar arraste
  if (
    !interactions.isDragging &&
    (absDeltaX > CONFIG.GESTURE.DRAG_START_THRESHOLD ||
      absDeltaY > CONFIG.GESTURE.DRAG_START_THRESHOLD)
  ) {
    interactions.isDragging = true;

    if (absDeltaX > absDeltaY) {
      interactions.swipeDirection = "horizontal";

      // Potencialmente iniciar um arraste horizontal
      _triggerGesture("dragStart", {
        direction: "horizontal",
        element: e.currentTarget,
        deltaX,
        deltaY,
      });
    } else {
      interactions.swipeDirection = "vertical";

      // Potencialmente iniciar um arraste vertical
      _triggerGesture("dragStart", {
        direction: "vertical",
        element: e.currentTarget,
        deltaX,
        deltaY,
      });
    }
  }

  if (interactions.isDragging) {
    // Continuando arraste
    _triggerGesture("dragging", {
      direction: interactions.swipeDirection,
      element: e.currentTarget,
      deltaX,
      deltaY,
    });
  }
}

/**
 * Handler para final de toque no banner
 * @param {TouchEvent} e - Evento de toque
 * @private
 */
function _handleBannerTouchEnd(e) {
  // Limpar temporizador de pressão longa
  if (interactions.pressTimer) {
    clearTimeout(interactions.pressTimer);
    interactions.pressTimer = null;
  }

  // Verificar se há dados de início de toque
  if (!interactions.touchStartX || !interactions.touchStartY) return;

  const touchEnd = e.changedTouches[0];
  const deltaX = touchEnd.clientX - interactions.touchStartX;
  const deltaY = touchEnd.clientY - interactions.touchStartY;
  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);
  const touchDuration = Date.now() - interactions.touchStartTime;

  // Detectar clique simples vs. arraste
  if (
    !interactions.isDragging &&
    Math.max(absDeltaX, absDeltaY) < CONFIG.GESTURE.TAP_MAX_DISTANCE
  ) {
    // É um simples toque (tap), verificar se é duplo
    const now = Date.now();
    const timeSinceLastTap = now - interactions.lastTapTime;

    if (timeSinceLastTap < CONFIG.GESTURE.DOUBLE_TAP_THRESHOLD) {
      // Double tap detectado
      _triggerGesture("doubleTap", {
        element: e.currentTarget,
        position: {
          x: touchEnd.clientX,
          y: touchEnd.clientY,
        },
      });

      interactions.lastTapTime = 0; // Resetar para evitar triple tap
    } else {
      // Single tap
      _triggerGesture("tap", {
        element: e.currentTarget,
        position: {
          x: touchEnd.clientX,
          y: touchEnd.clientY,
        },
      });

      interactions.lastTapTime = now;
    }
  } else if (interactions.isDragging) {
    // Final de arraste - verificar se foi rápido o suficiente para ser um swipe
    if (
      touchDuration < CONFIG.GESTURE.SWIPE_MAX_TIME &&
      (absDeltaX > CONFIG.GESTURE.SWIPE_MIN_DISTANCE ||
        absDeltaY > CONFIG.GESTURE.SWIPE_MIN_DISTANCE)
    ) {
      // É um swipe - determinar direção
      let swipeDirection;
      if (interactions.swipeDirection === "horizontal") {
        swipeDirection = deltaX > 0 ? "right" : "left";
      } else {
        swipeDirection = deltaY > 0 ? "down" : "up";
      }

      // Velocidade do swipe
      const velocity =
        (interactions.swipeDirection === "horizontal" ? absDeltaX : absDeltaY) /
        touchDuration;

      _triggerGesture("swipe", {
        direction: swipeDirection,
        element: e.currentTarget,
        velocity,
        deltaX,
        deltaY,
      });
    } else {
      // Final de arraste normal
      _triggerGesture("dragEnd", {
        direction: interactions.swipeDirection,
        element: e.currentTarget,
        deltaX,
        deltaY,
        duration: touchDuration,
      });
    }
  }

  // Resetar estado
  interactions.touchStartX = 0;
  interactions.touchStartY = 0;
  interactions.isDragging = false;
  interactions.swipeDirection = null;
}

/**
 * Handler para cancelamento de toque no banner
 * @private
 */
function _handleBannerTouchCancel() {
  // Limpar temporizador de pressão longa
  if (interactions.pressTimer) {
    clearTimeout(interactions.pressTimer);
    interactions.pressTimer = null;
  }

  // Resetar estado
  interactions.touchStartX = 0;
  interactions.touchStartY = 0;
  interactions.isDragging = false;
  interactions.swipeDirection = null;

  // Notificar sobre cancelamento
  _triggerGesture("touchCancel");
}

/**
 * Handler para clique no banner
 * @param {MouseEvent} e - Evento de clique
 * @private
 */
function _handleBannerClick(e) {
  // Verificar se é um clique real (sem arraste)
  if (!interactions.isDragging) {
    // Verificar se foi em algum botão específico
    const target = e.target;
    const closestButton = target.closest("button");

    if (!closestButton) {
      // Clique no banner geral - alternar estado
      toggleBannerState();
    }
  }
}

/**
 * Handler para duplo clique no banner
 * @param {MouseEvent} e - Evento de duplo clique
 * @private
 */
function _handleBannerDoubleClick(e) {
  // Evitar propagação e comportamento padrão
  e.preventDefault();
  e.stopPropagation();

  // Acionar gesto de duplo clique
  _triggerGesture("doubleTap", {
    element: e.currentTarget,
    position: {
      x: e.clientX,
      y: e.clientY,
    },
  });
}

/**
 * Handler para início de interação com mapa
 * @private
 */
function _handleMapInteractionStart() {
  interactions.mapInteractionActive = true;
  document.body.classList.add("map-interaction-active");

  // Minimizar banner durante interação com mapa
  if (interactions.bannerState === "expanded") {
    interactions.previousBannerState = "expanded";
    minimizeBanner(true);
  }
}

/**
 * Handler para fim de interação com mapa
 * @private
 */
function _handleMapInteractionEnd() {
  interactions.mapInteractionActive = false;
  document.body.classList.remove("map-interaction-active");

  // Verificar se deve restaurar estado do banner
  if (interactions.previousBannerState === "expanded") {
    // Esperar um pouco para garantir que não foi apenas um clique
    setTimeout(() => {
      if (!interactions.mapInteractionActive) {
        expandBanner();
        interactions.previousBannerState = null;
      }
    }, 300);
  }
}

/**
 * Handler para interação contínua com mapa
 * @private
 */
function _handleMapInteraction() {
  // Atualizar timestamp de última interação
  interactions.lastInteractionTime = Date.now();
}

/**
 * Handler para mudança de status da navegação
 * @param {string} status - Novo status
 * @private
 */
function _handleNavigationStatusChange(status) {
  // Ajustar UI com base no estado da navegação
  if (status === NavigationStatus.ACTIVE) {
    // Navegação ativa - garantir que UI está preparada
    document.body.classList.add("navigation-active");
    expandBanner();
  } else if (status === NavigationStatus.IDLE) {
    // Navegação inativa
    document.body.classList.remove("navigation-active");
    // Esconder banner se visível
    minimizeBanner(true);
  } else if (status === NavigationStatus.ARRIVED) {
    // Chegada ao destino
    document.body.classList.add("navigation-arrived");
    expandBanner();
  }
}

/**
 * Handler para atualização de localização
 * @param {Object} location - Nova localização
 * @private
 */
function _handleLocationUpdate(location) {
  // Por enquanto, sem comportamento especial
}

/**
 * Handler para mudança de instrução
 * @param {number} index - Índice da instrução
 * @param {Object} instruction - Dados da instrução
 * @private
 */
function _handleInstructionChange(index, instruction) {
  // Fornecer feedback adequado para nova instrução

  // Feedback tátil para tipos importantes de manobras
  if (instruction && _isSignificantManeuver(instruction.type)) {
    provideTactileFeedback("turn");
  }

  // Expandir banner para mostrar nova instrução
  expandBanner();
}

/**
 * Dispara um gesto reconhecido
 * @param {string} gesture - Nome do gesto
 * @param {Object} data - Dados relacionados ao gesto
 * @private
 */
function _triggerGesture(gesture, data = {}) {
  // Se estamos bloqueados, ignorar gestos
  if (interactions.gestureLock) return;

  // Registrar última interação
  interactions.lastInteractionTime = Date.now();

  console.log(`[NavigationInteractions] Gesto: ${gesture}`, data);

  // Verificar se há um callback registrado
  if (interactions.gestureCallbacks[gesture]) {
    try {
      interactions.gestureCallbacks[gesture](data);
    } catch (err) {
      console.error(
        `[NavigationInteractions] Erro ao processar gesto ${gesture}:`,
        err
      );
    }
  }

  // Processar gestos internos
  switch (gesture) {
    case "swipe":
      _processSwipeGesture(data.direction);
      break;

    case "doubleTap":
      // Duplo toque no banner - alguma ação especial?
      break;

    case "longPress":
      // Mostrar menu de contexto ou informações adicionais?
      break;
  }
}

/**
 * Processa um gesto de swipe
 * @param {string} direction - Direção do swipe
 * @private
 */
function _processSwipeGesture(direction) {
  if (
    Date.now() - interactions.lastInteractionTime <
    CONFIG.TIMING.SWIPE_COOLDOWN
  ) {
    // Evitar ações muito frequentes
    return;
  }

  switch (direction) {
    case "up":
      expandBanner();
      break;

    case "down":
      minimizeBanner(true);
      break;

    case "left":
    case "right":
      // Swipe lateral - poderia mudar para instruções anteriores/próximas
      break;
  }

  // Oferecer feedback tátil para o swipe
  provideTactileFeedback("light");
}

/**
 * Verifica se uma manobra é significativa (curva acentuada, retorno, etc.)
 * @param {number} type - Tipo da manobra
 * @returns {boolean} Verdadeiro se for manobra significativa
 * @private
 */
function _isSignificantManeuver(type) {
  // Tipos significativos: curvas acentuadas, retorno, rotatória, chegada
  return [3, 4, 5, 6, 7, 9, 10, 11].includes(type);
}

/**
 * Minimiza ou expande o banner de instruções
 * @param {boolean} minimize - Se verdadeiro, minimiza; caso contrário, expande
 * @param {boolean} [animate=true] - Se deve animar a transição
 */
export function minimizeBanner(minimize, animate = true) {
  if (!interactions.bannerElement) return;

  // Se já está no estado desejado, não fazer nada
  if (
    (minimize && interactions.bannerState === "minimized") ||
    (!minimize && interactions.bannerState === "expanded")
  ) {
    return;
  }

  // Atualizar estado
  interactions.bannerState = minimize ? "minimized" : "expanded";

  // Aplicar classes para animação
  if (animate) {
    interactions.bannerElement.classList.add(
      minimize ? "minimizing" : "expanding"
    );

    setTimeout(() => {
      interactions.bannerElement.classList.remove("minimizing", "expanding");
    }, 300);
  }

  // Aplicar classe de estado
  interactions.bannerElement.classList.toggle("minimized", minimize);

  // Atualizar atributos ARIA
  const minimizeBtn = interactions.bannerElement.querySelector(
    "#minimize-navigation-btn"
  );
  if (minimizeBtn) {
    minimizeBtn.setAttribute("aria-expanded", !minimize);

    // Atualizar ícone ou texto do botão
    const icon = minimizeBtn.querySelector("i, span.icon");
    if (icon) {
      icon.textContent = minimize ? "▲" : "▼";
    }
  }
}

/**
 * Expande o banner de instruções
 * @param {boolean} [animate=true] - Se deve animar a transição
 */
export function expandBanner(animate = true) {
  minimizeBanner(false, animate);
}

/**
 * Alterna o estado do banner entre minimizado e expandido
 */
export function toggleBannerState() {
  minimizeBanner(interactions.bannerState === "expanded");
}

/**
 * Registra um callback para um gesto específico
 * @param {string} gesture - Nome do gesto
 * @param {Function} callback - Função a ser chamada
 */
export function onGesture(gesture, callback) {
  if (typeof callback !== "function") {
    console.error(
      `[NavigationInteractions] Callback inválido para gesto ${gesture}`
    );
    return;
  }

  interactions.gestureCallbacks[gesture] = callback;
}

/**
 * Fornece feedback tátil (vibração) se suportado
 * @param {string|number|Array} pattern - Padrão de vibração
 */
export function provideTactileFeedback(pattern) {
  // Verificar se feedback tátil está habilitado
  if (!interactions.enableTactile || navigationState.disableTactileFeedback) {
    return;
  }

  // Verificar suporte à API de vibração
  if (!("vibrate" in navigator)) {
    return;
  }

  // Determinar padrão de vibração
  let vibrationPattern;

  if (typeof pattern === "string") {
    vibrationPattern =
      CONFIG.HAPTIC[pattern.toUpperCase()] || CONFIG.HAPTIC.MEDIUM;
  } else {
    vibrationPattern = pattern;
  }

  // Executar vibração
  try {
    navigator.vibrate(vibrationPattern);
  } catch (err) {
    console.warn("[NavigationInteractions] Erro ao acionar vibração:", err);
  }
}

/**
 * Bloqueia ou desbloqueia gestos temporariamente
 * @param {boolean} lock - Se deve bloquear gestos
 */
export function lockGestures(lock) {
  interactions.gestureLock = lock;
}

/**
 * Cria uma versão debounced de uma função
 * @param {Function} func - Função a ser debounced
 * @param {number} wait - Tempo de espera em ms
 * @returns {Function} Função com debounce
 * @private
 */
function _debounce(func, wait) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}
