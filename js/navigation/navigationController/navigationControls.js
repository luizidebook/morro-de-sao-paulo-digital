/**
 * Controles de navegação
 *
 * Gerencia os controles e interações dos componentes da UI de navegação,
 * incluindo botões, gestos e comportamentos de interação durante a
 * navegação.
 *
 * Características:
 * - Controles avançados para banner de navegação
 * - Suporte a gestos para interação fluida
 * - Feedback tátil e visual em tempo real
 * - Gerenciamento de estados e transições
 * - Compatibilidade com mouse, toque e teclado
 * - Otimizado para acessibilidade
 */

// Importações de core
import { navigationState } from "../navigationState/navigationStateManager.js";
import { cancelNavigation } from "./navigationController.js";
import { map } from "../../map/map-controls.js";
import { calculateDistance } from "./navigationController.js";
// Importações de utils e UI
import { UI_CONFIG } from "../navigationUi/navigationConfig.js";

// Estado interno
const controlState = {
  isMinimized: false,
  touchStartTime: 0,
  lastTapTime: 0,
  dragStartX: 0,
  dragStartY: 0,
  isDragging: false,
  pressTimer: null,
  longPressTriggered: false,
  currentSwipeDirection: null,
  initialTouchPos: { x: 0, y: 0 },
  autoHideTimer: null,
  setupDone: false,
  uiMode: "standard", // 'standard', 'compact', 'expanded'
};

// Adicionar opções de personalização
const navigationPreferences = {
  instructionDetail: "normal", // 'minimal', 'normal', 'detailed'
  showNextStep: true,
  useVoiceGuidance: true,
  highContrastMode: false,
  largeTextMode: false,
  vibrationIntensity: "medium", // 'off', 'light', 'medium', 'strong'
};

function applyUserPreferences() {
  const banner = document.getElementById(UI_CONFIG.IDS.BANNER);

  // Aplicar preferências de detalhamento
  banner.setAttribute("data-detail", navigationPreferences.instructionDetail);

  // Aplicar modo de alto contraste
  if (navigationPreferences.highContrastMode) {
    banner.classList.add("high-contrast");
  } else {
    banner.classList.remove("high-contrast");
  }

  // Aplicar modo de texto grande
  if (navigationPreferences.largeTextMode) {
    banner.classList.add("large-text");
  } else {
    banner.classList.remove("large-text");
  }
}

/**
 * Inicializa os controles de navegação
 * @param {Object} options - Opções de configuração
 */
export function initNavigationControls(options = {}) {
  try {
    // Merge com opções padrão
    const settings = {
      AUTO_HIDE_DELAY: 5000,
      ENABLE_AUTO_MINIMIZE: true,
      DISABLE_CANCEL_CONFIRMATION: false,
      MIN_SWIPE_VELOCITY: 0.3,
      ...options,
    };

    console.log("[initNavigationControls] Iniciando com opções:", settings);

    // Verificar se o banner existe
    const banner = document.getElementById(UI_CONFIG.IDS.BANNER);
    if (!banner) {
      console.error(
        "[initNavigationControls] Banner não encontrado, criando um novo"
      );
      const newBanner = createNavigationBanner();
      return initNavigationControls(options); // Tentar novamente com o novo banner
    }

    // Configurar o botão de minimizar
    let minimizeButton = document.getElementById(UI_CONFIG.IDS.MINIMIZE_BUTTON);

    if (!minimizeButton) {
      console.warn(
        "[initNavigationControls] Botão de minimizar não encontrado, criando um novo"
      );

      // Criar o botão se não existir
      const primarySection = banner.querySelector(".instruction-primary");
      if (primarySection) {
        minimizeButton = document.createElement("button");
        minimizeButton.id = UI_CONFIG.IDS.MINIMIZE_BUTTON;
        minimizeButton.className = "minimize-button";
        minimizeButton.setAttribute(
          "aria-label",
          "Minimizar instruções de navegação"
        );
        minimizeButton.setAttribute("aria-expanded", "true");
        primarySection.appendChild(minimizeButton);
      }
    }

    // Verificar novamente se temos o botão
    if (!minimizeButton) {
      console.error(
        "[initNavigationControls] Não foi possível criar o botão de minimizar"
      );
      return false;
    }

    // Remover listeners anteriores para evitar duplicação
    const newBtn = minimizeButton.cloneNode(true);
    minimizeButton.parentNode.replaceChild(newBtn, minimizeButton);
    minimizeButton = newBtn;

    // Adicionar evento de clique
    minimizeButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isMinimized = banner.classList.contains(
        UI_CONFIG.CLASSES.MINIMIZED
      );
      toggleMinimizedState(banner, !isMinimized);

      console.log(
        `[initNavigationControls] Banner ${
          isMinimized ? "expandido" : "minimizado"
        }`
      );
    });

    console.log("[initNavigationControls] Controles configurados com sucesso");
    return true;
  } catch (error) {
    console.error(
      "[initNavigationControls] Erro ao inicializar controles:",
      error
    );
    return false;
  }
}

/**
 * Alterna o estado minimizado do banner
 * @param {HTMLElement} banner - Banner de navegação
 * @param {boolean} minimize - Se deve minimizar (true) ou expandir (false)
 */
function toggleMinimizedState(banner, minimize) {
  if (!banner) return;

  const minimizeBtn = banner.querySelector(`#${UI_CONFIG.IDS.MINIMIZE_BUTTON}`);

  if (minimize) {
    banner.classList.add(UI_CONFIG.CLASSES.MINIMIZED);
    if (minimizeBtn) {
      minimizeBtn.setAttribute("aria-expanded", "false");
      minimizeBtn.setAttribute(
        "aria-label",
        "Expandir instruções de navegação"
      );
    }
  } else {
    banner.classList.remove(UI_CONFIG.CLASSES.MINIMIZED);
    if (minimizeBtn) {
      minimizeBtn.setAttribute("aria-expanded", "true");
      minimizeBtn.setAttribute(
        "aria-label",
        "Minimizar instruções de navegação"
      );
    }
  }
}

/**
 * Adiciona botão para controlar rotação do mapa
 */
function addOrientationControl() {
  const mapContainer = document.querySelector("#map-container");
  if (!mapContainer) return;

  // Criar controle se não existir
  if (!document.querySelector("#orientation-control")) {
    const control = document.createElement("div");
    control.id = "orientation-control";
    control.className = "leaflet-control orientation-control";

    const button = document.createElement("button");
    button.innerHTML = '<span class="icon">🧭</span>';
    button.title = "Alternar entre mapa fixo e orientação automática";
    button.setAttribute("aria-label", "Alternar orientação do mapa");
    control.appendChild(button);

    // Adicionar ao mapa
    const controlContainer = document.querySelector(
      ".leaflet-top.leaflet-right"
    );
    if (controlContainer) {
      controlContainer.appendChild(control);
    } else {
      mapContainer.appendChild(control);
    }

    // Configurar evento
    button.addEventListener("click", toggleMapOrientation);

    // Aplicar estado inicial
    updateOrientationButtonState();
  }
}

/**
 * Alterna entre mapa fixo e orientação automática
 */
function toggleMapOrientation() {
  if (navigationState.isRotationEnabled) {
    // Desabilitar rotação
    navigationState.isRotationEnabled = false;
    resetMapRotation();
    document.body.classList.remove("map-rotation-enabled");
  } else {
    // Habilitar rotação
    navigationState.isRotationEnabled = true;
    document.body.classList.add("map-rotation-enabled");

    // Aplicar rotação inicial se houver heading
    if (userLocation && typeof userLocation.heading === "number") {
      setMapRotation(userLocation.heading);
    }
  }

  // Atualizar aparência do botão
  updateOrientationButtonState();

  // Fornecer feedback
  provideTactileFeedback("medium");
}

/**
 * Atualiza aparência do botão conforme estado de rotação
 */
function updateOrientationButtonState() {
  const button = document.querySelector("#orientation-control button");
  if (!button) return;

  if (navigationState.isRotationEnabled) {
    button.classList.add("active");
    button.title = "Desativar orientação automática";
  } else {
    button.classList.remove("active");
    button.title = "Ativar orientação automática";
  }
}

// Adicionar uma nova função para iniciar o monitoramento
function startNavigationMonitoring() {
  // Monitorar a cada 1 segundo
  const monitoringInterval = setInterval(() => {
    if (!navigationState.isActive) {
      clearInterval(monitoringInterval);
      return;
    }

    if (
      navigationState.userLocation &&
      navigationState.instructions &&
      navigationState.currentStepIndex < navigationState.instructions.length
    ) {
      const currentInstruction =
        navigationState.instructions[navigationState.currentStepIndex];
      const nextInstruction =
        navigationState.instructions[navigationState.currentStepIndex + 1];

      if (nextInstruction) {
        const distanceToTurn = calculateDistance(
          navigationState.userLocation.latitude,
          navigationState.userLocation.longitude,
          nextInstruction.latitude || nextInstruction.lat,
          nextInstruction.longitude || nextInstruction.lon
        );

        // Monitorar aproximação da curva
        monitorApproachingTurn(
          navigationState.userLocation,
          {
            lat: nextInstruction.latitude || nextInstruction.lat,
            lon: nextInstruction.longitude || nextInstruction.lon,
          },
          distanceToTurn
        );
      }
    }
  }, 1000);
}

/**
 * Configura eventos de clique para o botão de minimizar
 * @param {HTMLElement} minimizeBtn - Botão de minimizar
 * @param {HTMLElement} instructionBanner - Banner de instruções
 */
function setupClickEvents(minimizeBtn, instructionBanner) {
  // Remover listeners anteriores se existirem
  const newMinimizeBtn = minimizeBtn.cloneNode(true);
  minimizeBtn.parentNode.replaceChild(newMinimizeBtn, minimizeBtn);
  minimizeBtn = newMinimizeBtn;

  // Adicionar evento de clique principal
  minimizeBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    // Alternar estado minimizado/expandido
    toggleBannerState(instructionBanner);
  });

  // Adicionar evento de duplo clique para cancelar navegação
  minimizeBtn.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();

    // Confirmar cancelamento
    confirmCancelNavigation();
  });
}

/**
 * Configura eventos de toque e gestos
 * @param {HTMLElement} minimizeBtn - Botão de minimizar
 * @param {HTMLElement} instructionBanner - Banner de instruções
 */
function setupTouchGestures(minimizeBtn, instructionBanner) {
  // Configurar toque longo para cancelar navegação
  let pressTimer;
  let longPressTriggered = false;

  minimizeBtn.addEventListener("touchstart", () => {
    longPressTriggered = false;

    pressTimer = setTimeout(() => {
      longPressTriggered = true;
      provideTactileFeedback("medium");

      // Visual feedback durante pressão longa
      minimizeBtn.classList.add("long-press");

      // Confirmar cancelamento após pressão longa
      confirmCancelNavigation();

      // Limpar estado visual após um momento
      setTimeout(() => {
        minimizeBtn.classList.remove("long-press");
      }, 300);
    }, UI_CONFIG.TIMING.LONG_PRESS_THRESHOLD);
  });

  minimizeBtn.addEventListener("touchend", (e) => {
    clearTimeout(pressTimer);

    // Se foi um toque longo, não executar a ação normal de clique
    if (longPressTriggered) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  // Prevenir comportamento padrão para evitar seleção de texto
  minimizeBtn.addEventListener("touchmove", (e) => {
    clearTimeout(pressTimer);
  });

  // Configurar gestos de deslize para o banner
  setupAdvancedGestures(instructionBanner);
}

/**
 * Configura gestos de deslize (swipe) no banner
 * @param {HTMLElement} instructionBanner - Banner de instruções
 */
function setupSwipeGestures(instructionBanner) {
  // Variáveis para controlar o deslize
  let startX, startY, startTime;

  // Iniciar toque
  instructionBanner.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
    controlState.isDragging = false;

    // Armazenar posição inicial
    controlState.initialTouchPos = {
      x: startX,
      y: startY,
    };
  });

  // Processar movimento de toque
  instructionBanner.addEventListener("touchmove", (e) => {
    if (!startX || !startY) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - startX;
    const deltaY = currentY - startY;

    // Determinar se é deslize horizontal ou vertical
    if (!controlState.isDragging) {
      // Se o movimento é maior na horizontal e passou do threshold
      if (
        Math.abs(deltaX) > Math.abs(deltaY) &&
        Math.abs(deltaX) > UI_CONFIG.GESTURE.DRAG_START_THRESHOLD
      ) {
        controlState.isDragging = true;
        controlState.currentSwipeDirection = "horizontal";
        instructionBanner.classList.add(UI_CONFIG.CLASSES.DRAGGING);
      }
      // Se o movimento é maior na vertical e passou do threshold
      else if (
        Math.abs(deltaY) > Math.abs(deltaX) &&
        Math.abs(deltaY) > UI_CONFIG.GESTURE.DRAG_START_THRESHOLD
      ) {
        controlState.isDragging = true;
        controlState.currentSwipeDirection = "vertical";
        instructionBanner.classList.add(UI_CONFIG.CLASSES.DRAGGING);
      }
    }

    // Aplicar transformação com base no tipo de deslize
    if (controlState.isDragging) {
      if (controlState.currentSwipeDirection === "horizontal") {
        // Limitar o arraste horizontal com resistência
        const resistance = 0.5; // quanto menor, mais resistente
        const limitedDeltaX = deltaX * resistance;
        instructionBanner.style.transform = `translateX(${limitedDeltaX}px)`;
      } else if (controlState.currentSwipeDirection === "vertical") {
        // Em deslizes verticais, podemos minimizar/maximizar
        const primarySection = instructionBanner.querySelector(
          ".instruction-primary"
        );
        const secondarySection = instructionBanner.querySelector(
          ".instruction-secondary"
        );

        if (deltaY > 0 && !controlState.isMinimized) {
          // Deslizar para baixo - minimizar com animação suave
          if (secondarySection) {
            const progress = Math.min(
              1,
              deltaY / UI_CONFIG.GESTURE.DRAG_THRESHOLD
            );
            secondarySection.style.maxHeight = `${(1 - progress) * 100}px`;
            secondarySection.style.opacity = 1 - progress;
          }
        } else if (deltaY < 0 && controlState.isMinimized) {
          // Deslizar para cima - expandir com animação suave
          if (secondarySection) {
            const progress = Math.min(
              1,
              Math.abs(deltaY) / UI_CONFIG.GESTURE.DRAG_THRESHOLD
            );
            secondarySection.style.maxHeight = `${progress * 100}px`;
            secondarySection.style.opacity = progress;
          }
        }
      }
    }
  });

  // Finalizar toque
  instructionBanner.addEventListener("touchend", (e) => {
    if (!startX || !startY) return;

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const deltaTime = Date.now() - startTime;
    const velocityX = Math.abs(deltaX) / deltaTime;
    const velocityY = Math.abs(deltaY) / deltaTime;

    if (controlState.isDragging) {
      // Processar fim do arraste horizontal
      if (controlState.currentSwipeDirection === "horizontal") {
        handleHorizontalSwipeEnd(deltaX, velocityX, instructionBanner);
      }
      // Processar fim do arraste vertical
      else if (controlState.currentSwipeDirection === "vertical") {
        handleVerticalSwipeEnd(deltaY, velocityY, instructionBanner);
      }

      // Resetar estado de arraste
      instructionBanner.classList.remove(UI_CONFIG.CLASSES.DRAGGING);
      instructionBanner.style.transform = "";

      const secondarySection = instructionBanner.querySelector(
        ".instruction-secondary"
      );
      if (secondarySection) {
        secondarySection.style.maxHeight = "";
        secondarySection.style.opacity = "";
      }
    }

    // Resetar todas as variáveis
    startX = null;
    startY = null;
    controlState.isDragging = false;
    controlState.currentSwipeDirection = null;
  });

  // Cancelar toque
  instructionBanner.addEventListener("touchcancel", () => {
    // Restaurar visualmente o banner ao estado anterior
    instructionBanner.classList.remove(UI_CONFIG.CLASSES.DRAGGING);
    instructionBanner.style.transform = "";

    const secondarySection = instructionBanner.querySelector(
      ".instruction-secondary"
    );
    if (secondarySection) {
      secondarySection.style.maxHeight = "";
      secondarySection.style.opacity = "";
    }

    // Resetar todas as variáveis
    startX = null;
    startY = null;
    controlState.isDragging = false;
    controlState.currentSwipeDirection = null;
  });
}

/**
 * Processa o fim de um deslize horizontal
 * @param {number} deltaX - Distância do deslize horizontal
 * @param {number} velocity - Velocidade do deslize
 * @param {HTMLElement} banner - Elemento do banner
 */
function handleHorizontalSwipeEnd(deltaX, velocity, banner) {
  const isSwipeFastEnough = velocity > UI_CONFIG.BEHAVIOR.MIN_SWIPE_VELOCITY;
  const isSwipeLongEnough =
    Math.abs(deltaX) > UI_CONFIG.GESTURE.SWIPE_MIN_DISTANCE;

  // Se o deslize foi rápido e longo o suficiente
  if (isSwipeFastEnough && isSwipeLongEnough) {
    if (deltaX < 0) {
      // Deslize para esquerda - esconder e cancelar navegação
      animateSwipeOut(banner, "left", () => {
        confirmCancelNavigation();
      });
    } else {
      // Deslize para direita - esconder e cancelar navegação
      animateSwipeOut(banner, "right", () => {
        confirmCancelNavigation();
      });
    }
  } else {
    // Se foi apenas um deslize pequeno, voltar para a posição original
    animateSwipeReturn(banner);
  }
}

/**
 * Processa o fim de um deslize vertical
 * @param {number} deltaY - Distância do deslize vertical
 * @param {number} velocity - Velocidade do deslize
 * @param {HTMLElement} banner - Elemento do banner
 */
function handleVerticalSwipeEnd(deltaY, velocity, banner) {
  const isSwipeFastEnough = velocity > UI_CONFIG.BEHAVIOR.MIN_SWIPE_VELOCITY;
  const isSwipeLongEnough =
    Math.abs(deltaY) > UI_CONFIG.GESTURE.SWIPE_MIN_DISTANCE;

  if (isSwipeFastEnough && isSwipeLongEnough) {
    if (deltaY > 0) {
      // Deslize para baixo - minimizar
      minimizeBanner(true, banner);
    } else {
      // Deslize para cima - expandir
      minimizeBanner(false, banner);
    }
  } else {
    // Se o deslize foi pequeno, manter o estado atual
    if (deltaY > 0 && Math.abs(deltaY) > 30) {
      minimizeBanner(true, banner);
    } else if (deltaY < 0 && Math.abs(deltaY) > 30) {
      minimizeBanner(false, banner);
    }
  }
}

/**
 * Anima o banner deslizando para fora da tela
 * @param {HTMLElement} banner - Banner de instruções
 * @param {string} direction - Direção ('left' ou 'right')
 * @param {Function} callback - Função a ser chamada após a animação
 */
function animateSwipeOut(banner, direction, callback) {
  const distance = direction === "left" ? "-100%" : "100%";

  // Adicionar classe de animação
  banner.classList.add("swiping-out");

  // Configurar animação
  banner.style.transition = "transform 0.3s ease-out";
  banner.style.transform = `translateX(${distance})`;

  // Executar callback após conclusão
  setTimeout(() => {
    banner.classList.remove("swiping-out");
    banner.style.transition = "";
    banner.style.transform = "";

    if (typeof callback === "function") {
      callback();
    }
  }, 300);

  // Feedback tátil para confirmar ação
  provideTactileFeedback("medium");
}

/**
 * Anima o retorno do banner para posição original
 * @param {HTMLElement} banner - Banner de instruções
 */
function animateSwipeReturn(banner) {
  // Adicionar classe de animação
  banner.classList.add("returning");

  // Configurar animação de retorno
  banner.style.transition = "transform 0.2s ease-out";
  banner.style.transform = "translateX(0)";

  // Limpar após conclusão
  setTimeout(() => {
    banner.classList.remove("returning");
    banner.style.transition = "";
  }, 200);
}

/**
 * Configura interações específicas do banner
 * @param {HTMLElement} instructionBanner - Banner de instruções
 */
function setupBannerInteractions(instructionBanner) {
  // Adicionar interação de toque no bloco primário para minimizar/maximizar
  const primarySection = instructionBanner.querySelector(
    ".instruction-primary"
  );

  if (primarySection) {
    primarySection.addEventListener("click", (event) => {
      // Ignorar cliques no botão de minimizar
      if (
        event.target.id === UI_CONFIG.IDS.MINIMIZE_BTN ||
        event.target.closest(`#${UI_CONFIG.IDS.MINIMIZE_BTN}`)
      ) {
        return;
      }

      toggleBannerState(instructionBanner);
    });
  }

  // Detectar cliques duplos para inativar temporariamente o auto-minimizar
  instructionBanner.addEventListener("click", (event) => {
    const now = Date.now();

    if (
      now - controlState.lastTapTime <
      UI_CONFIG.TIMING.DOUBLE_TAP_THRESHOLD
    ) {
      // Duplo clique detectado
      UI_CONFIG.BEHAVIOR.ENABLE_AUTO_MINIMIZE =
        !UI_CONFIG.BEHAVIOR.ENABLE_AUTO_MINIMIZE;

      // Feedback visual
      highlightInstruction(true, instructionBanner);

      // Feedback tátil
      provideTactileFeedback(
        UI_CONFIG.BEHAVIOR.ENABLE_AUTO_MINIMIZE ? "light" : "medium"
      );

      event.preventDefault();
    }

    controlState.lastTapTime = now;
  });

  // Ativar auto-minimizar após período de inatividade
  setupAutoMinimize(instructionBanner);
}

/**
 * Configura comportamento de auto-minimizar após inatividade
 * @param {HTMLElement} banner - Banner de instruções
 */
function setupAutoMinimize(banner) {
  // Cancelar timer anterior se existir
  if (controlState.autoHideTimer) {
    clearTimeout(controlState.autoHideTimer);
  }

  // Função para iniciar o timer
  const startAutoMinimizeTimer = () => {
    // Só ativar se a funcionalidade estiver habilitada e banner não estiver minimizado
    if (!UI_CONFIG.BEHAVIOR.ENABLE_AUTO_MINIMIZE || controlState.isMinimized) {
      return;
    }

    // Configurar novo timer
    controlState.autoHideTimer = setTimeout(() => {
      minimizeBanner(true, banner);
    }, UI_CONFIG.BEHAVIOR.AUTO_HIDE_DELAY);
  };

  // Resetar timer ao interagir
  const resetAutoMinimizeTimer = () => {
    if (controlState.autoHideTimer) {
      clearTimeout(controlState.autoHideTimer);
    }

    startAutoMinimizeTimer();
  };

  // Adicionar listeners para resetar timer em interações
  banner.addEventListener("touchstart", resetAutoMinimizeTimer);
  banner.addEventListener("click", resetAutoMinimizeTimer);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      resetAutoMinimizeTimer();
    }
  });

  // Iniciar timer inicialmente
  startAutoMinimizeTimer();
}

/**
 * Configura animações e feedback visual
 * @param {HTMLElement} banner - Banner de instruções
 */
function setupVisualFeedback(banner) {
  // Adicionar classes para melhorar animações
  document.body.classList.add("with-navigation-controls");

  // Configurar transições suaves em alterações de altura
  const secondarySection = banner.querySelector(".instruction-secondary");
  if (secondarySection) {
    secondarySection.style.transition =
      "max-height 0.3s ease, opacity 0.3s ease";
  }

  // Adicionar observador para ajustar altura automaticamente se o conteúdo mudar
  setupHeightObserver(banner);
}

/**
 * Configura observador para ajustar altura do banner automaticamente
 * @param {HTMLElement} banner - Banner de instruções
 */
function setupHeightObserver(banner) {
  // Usar ResizeObserver para detectar mudanças na altura do conteúdo
  if (window.ResizeObserver) {
    const secondarySection = banner.querySelector(".instruction-secondary");

    if (secondarySection) {
      const resizeObserver = new ResizeObserver((entries) => {
        // Só ajustar altura se não estiver minimizado
        if (!controlState.isMinimized) {
          for (let entry of entries) {
            // Ajustar altura do secundário para acomodar conteúdo
            const height = entry.contentRect.height;
            if (height > 0) {
              secondarySection.style.maxHeight = `${height}px`;
            }
          }
        }
      });

      // Observar o conteúdo interno
      const content = secondarySection.querySelector("p") || secondarySection;
      resizeObserver.observe(content);
    }
  }
}

/**
 * Configura observadores de visibilidade para otimizar recursos
 * @param {HTMLElement} banner - Banner de instruções
 */
function setupVisibilityObservers(banner) {
  // Usar IntersectionObserver para detectar quando o banner não está visível
  if (window.IntersectionObserver) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            // O banner não está visível na tela
            banner.classList.add("offscreen");
          } else {
            // O banner está visível
            banner.classList.remove("offscreen");
          }
        });
      },
      {
        threshold: 0.1, // 10% visível é suficiente
      }
    );

    observer.observe(banner);
  }

  // Monitorar alterações de visibilidade da página
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      // Economia de recursos quando a página não está visível
      banner.classList.add("page-hidden");
    } else {
      banner.classList.remove("page-hidden");
    }
  });
}

/**
 * Alterna entre estado minimizado e expandido do banner
 * @param {HTMLElement} banner - Banner de instruções
 */
function toggleBannerState(banner) {
  const isCurrentlyMinimized = controlState.isMinimized;
  minimizeBanner(!isCurrentlyMinimized, banner);
}

/**
 * Minimiza ou expande o banner
 * @param {boolean} minimize - Se deve minimizar
 * @param {HTMLElement} banner - Banner de instruções
 */
export function minimizeBanner(minimize, banner) {
  // Se o banner não existe, não fazer nada
  if (!banner) {
    banner = document.getElementById(UI_CONFIG.IDS.BANNER);
    if (!banner) return;
  }

  // Obter referência ao botão de minimizar
  const minimizeBtn = banner.querySelector(`#${UI_CONFIG.IDS.MINIMIZE_BTN}`);

  // Se já está no estado desejado, não fazer nada
  if (minimize === controlState.isMinimized) return;

  // Atualizar estado
  controlState.isMinimized = minimize;

  // Adicionar ou remover classes de acordo com o estado
  if (minimize) {
    banner.classList.add(UI_CONFIG.CLASSES.MINIMIZED);
    banner.classList.add(UI_CONFIG.CLASSES.MINIMIZING);

    setTimeout(() => {
      banner.classList.remove(UI_CONFIG.CLASSES.MINIMIZING);
    }, UI_CONFIG.TIMING.MINIMIZE_ANIMATION);

    // Atualizar atributos ARIA
    if (minimizeBtn) {
      minimizeBtn.setAttribute("aria-expanded", "false");
      minimizeBtn.setAttribute("aria-label", UI_CONFIG.MESSAGES.EXPAND_ARIA);
    }

    // Atualizar modo da UI
    controlState.uiMode = "compact";

    console.log("[navigationControls] Banner minimizado");
  } else {
    banner.classList.remove(UI_CONFIG.CLASSES.MINIMIZED);
    banner.classList.add(UI_CONFIG.CLASSES.EXPANDING);

    setTimeout(() => {
      banner.classList.remove(UI_CONFIG.CLASSES.EXPANDING);
    }, UI_CONFIG.TIMING.MINIMIZE_ANIMATION);

    // Atualizar atributos ARIA
    if (minimizeBtn) {
      minimizeBtn.setAttribute("aria-expanded", "true");
      minimizeBtn.setAttribute("aria-label", UI_CONFIG.MESSAGES.MINIMIZE_ARIA);
    }

    // Atualizar modo da UI
    controlState.uiMode = "expanded";

    console.log("[navigationControls] Banner maximizado");
  }

  // Feedback tátil
  provideTactileFeedback("light");

  // Resetar timer de auto-minimização se expandiu
  if (!minimize && UI_CONFIG.BEHAVIOR.ENABLE_AUTO_MINIMIZE) {
    if (controlState.autoHideTimer) {
      clearTimeout(controlState.autoHideTimer);
    }

    controlState.autoHideTimer = setTimeout(() => {
      minimizeBanner(true, banner);
    }, UI_CONFIG.BEHAVIOR.AUTO_HIDE_DELAY);
  }
}

/**
 * Destaca a instrução para chamar atenção do usuário
 * @param {boolean} highlight - Se deve destacar a instrução
 * @param {HTMLElement} banner - Banner de instruções
 */
export function highlightInstruction(highlight = true, banner) {
  // Se o banner não existe, não fazer nada
  if (!banner) {
    banner = document.getElementById(UI_CONFIG.IDS.BANNER);
    if (!banner) return;
  }

  if (highlight) {
    banner.classList.add(UI_CONFIG.CLASSES.HIGHLIGHT);

    // Expandir banner se estiver minimizado
    if (controlState.isMinimized) {
      minimizeBanner(false, banner);
    }

    // Remover classe após a animação
    setTimeout(() => {
      banner.classList.remove(UI_CONFIG.CLASSES.HIGHLIGHT);
    }, UI_CONFIG.TIMING.HIGHLIGHT_ANIMATION);
  } else {
    banner.classList.remove(UI_CONFIG.CLASSES.HIGHLIGHT);
  }
}

/**
 * Mostra diálogo de confirmação para cancelar navegação
 */
function confirmCancelNavigation() {
  // Se estiver configurado para não mostrar confirmação
  if (UI_CONFIG.BEHAVIOR.DISABLE_CANCEL_CONFIRMATION) {
    performCancelNavigation();
    return;
  }

  // Vibrar para indicar ação importante
  provideTactileFeedback("strong");

  // Mostrar diálogo
  const confirmed = window.confirm(UI_CONFIG.MESSAGES.CANCEL_CONFIRM);

  if (confirmed) {
    performCancelNavigation();
  }
}

/**
 * Executa o cancelamento da navegação
 */
function performCancelNavigation() {
  try {
    // Feedback tátil para confirmar ação
    provideTactileFeedback("strong");

    // Executar função de cancelamento
    cancelNavigation();

    // Informação visual para o usuário (opcional)
    showToast(UI_CONFIG.MESSAGES.NAVIGATION_CANCELED);

    console.log("[navigationControls] Navegação cancelada pelo usuário");
  } catch (error) {
    console.error("[navigationControls] Erro ao cancelar navegação:", error);
  }
}

/**
 * Exibe uma notificação toast temporária
 * @param {string} message - Mensagem a exibir
 * @param {number} [duration=3000] - Duração em ms
 */
function showToast(message, duration = 3000) {
  // Verificar se já existe um toast ativo
  let toast = document.querySelector(".navigation-toast");

  // Se não existe, criar um
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "navigation-toast";
    document.body.appendChild(toast);
  }

  // Atualizar conteúdo
  toast.textContent = message;
  toast.classList.add("active");

  // Remover após duração
  setTimeout(() => {
    toast.classList.remove("active");

    // Remover elemento após animação
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

/**
 * Adiciona feedback tátil para ações importantes
 * @param {string} intensity - Intensidade da vibração: 'light', 'medium' ou 'strong'
 */
function provideTactileFeedback(intensity = "medium") {
  // Verificar se o usuário desabilitou feedback tátil
  if (navigationState.disableTactileFeedback) return;

  // Verificar suporte à API de vibração
  if ("vibrate" in navigator) {
    switch (intensity) {
      case "light":
        navigator.vibrate(10);
        break;
      case "medium":
        navigator.vibrate(40);
        break;
      case "strong":
        navigator.vibrate([30, 50, 30]);
        break;
    }
  }
}

/**
 * Atualiza o estado do botão de minimizar visualmente
 * @param {boolean} minimized - Se está minimizado
 */
export function updateMinimizeButtonState(minimized = false) {
  const minimizeBtn = document.getElementById(UI_CONFIG.IDS.MINIMIZE_BTN);
  if (!minimizeBtn) return;

  // Atualizar atributos ARIA
  if (minimized) {
    minimizeBtn.setAttribute("aria-expanded", "false");
    minimizeBtn.setAttribute("aria-label", UI_CONFIG.MESSAGES.EXPAND_ARIA);
  } else {
    minimizeBtn.setAttribute("aria-expanded", "true");
    minimizeBtn.setAttribute("aria-label", UI_CONFIG.MESSAGES.MINIMIZE_ARIA);
  }

  // Atualizar estado interno
  controlState.isMinimized = minimized;
}

/**
 * Ajusta o zoom do mapa com base na velocidade do usuário
 * @param {number} speed - Velocidade em m/s
 */
export function adjustMapZoomBasedOnSpeed(speed) {
  if (!map) return;

  let zoomLevel = speed < 5 ? 18 : speed < 15 ? 16 : speed < 50 ? 14 : 12;

  map.setZoom(zoomLevel);
}

// Remover funções conflitantes e substituir por esta implementação unificada
export function setMapRotation(heading) {
  // Validar parâmetros e estado
  if (!map || !navigationState.isActive || !navigationState.isRotationEnabled) {
    return;
  }

  // Proteção contra valores nulos
  const angle = heading !== null && heading !== undefined ? heading : 0;

  // Limitar frequência de atualização
  const now = Date.now();
  if (now - navigationState.lastRotationTime < 100) {
    return;
  }
  navigationState.lastRotationTime = now;

  console.log(`[setMapRotation] Rotacionando mapa: ${angle}°`);

  try {
    // Verificar se o mapa tem a função setBearing (do plugin leaflet.rotateMap)
    if (typeof map.setBearing === "function") {
      // Usar o plugin oficial
      map.setBearing(angle);
    } else {
      // Implementação alternativa quando o plugin não está disponível
      const mapContainer = map.getContainer();
      const tilePane = mapContainer.querySelector(".leaflet-tile-pane");

      if (tilePane) {
        // Rotacionar tiles manualmente (180° - angle para visão de primeira pessoa)
        const rotationAngle = 180 - angle;

        // Adicionar classe para CSS
        document.body.classList.add("map-rotation-active");

        // Rotacionar apenas o painel de tiles
        tilePane.style.transform = `rotate(${rotationAngle}deg)`;
        tilePane.style.transformOrigin = "center center";

        // Definir variáveis CSS
        document.documentElement.style.setProperty(
          "--map-rotation",
          `${rotationAngle}deg`
        );
        document.documentElement.style.setProperty(
          "--map-rotation-inverse",
          `-${rotationAngle}deg`
        );
      }

      // Rotacionar marcadores individualmente
      adjustMapMarkers(angle);
    }

    // Atualizar estado
    navigationState.currentHeading = angle;
  } catch (error) {
    console.error("[setMapRotation] Erro ao rotacionar mapa:", error);
  }
}

/**
 * Reseta a rotação do mapa
 */
export function resetMapRotation() {
  const pane = document.querySelector(".leaflet-tile-pane");
  const controls = document.querySelector(".leaflet-control-container");

  if (pane) {
    pane.style.transition = "transform 0.5s ease-out";
    pane.style.transform = "none";
  }

  if (controls) {
    controls.style.transition = "transform 0.5s ease-out";
    controls.style.transform = "none";
  }
}

function monitorApproachingTurn(
  currentPosition,
  nextTurnCoordinates,
  distance
) {
  // Se estiver se aproximando de uma curva (menos de 100m)
  if (distance < 100) {
    // Fornecer alerta visual
    const banner = document.getElementById(UI_CONFIG.IDS.BANNER);
    if (banner) {
      banner.classList.add("approaching-turn");
    }

    // Feedback tátil e sonoro...
  } else {
    // Remover alerta se estiver longe da curva
    const banner = document.getElementById(UI_CONFIG.IDS.BANNER);
    if (banner) {
      banner.classList.remove("approaching-turn");
    }
    window.turnAnnounced = false;
  }
}

// Adicionar ao navigationControls.js
function setupAdvancedGestures(banner) {
  // Sistema de gestos existente
  // Adicionar pinch-to-zoom para ajustar tamanho
  let initialDistance = 0;
  let currentScale = 1;

  banner.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      initialDistance = getDistance(
        { x: e.touches[0].clientX, y: e.touches[0].clientY },
        { x: e.touches[1].clientX, y: e.touches[1].clientY }
      );
    }
  });

  banner.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2) {
      const currentDistance = getDistance(
        { x: e.touches[0].clientX, y: e.touches[0].clientY },
        { x: e.touches[1].clientX, y: e.touches[1].clientY }
      );

      const scale = currentDistance / initialDistance;
      currentScale = Math.min(Math.max(currentScale * scale, 0.8), 1.5);

      banner.style.transform = `scale(${currentScale})`;
      e.preventDefault();
    }
  });

  function getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }
}

/**
 * Substituir a implementação de appendNavigationInstruction para usar apenas banners
 */
export function appendNavigationInstruction(icon, title, details = "") {
  // Em vez de usar o assistente, atualizar o banner de navegação
  const instruction = {
    instruction: title,
    type: getTypeFromIcon(icon),
    details: details,
  };

  // Atualizar o banner com esta instrução especial
  updateInstructionBanner(instruction);

  // Destacar o banner para chamar atenção
  highlightBanner();

  console.log(
    "[appendNavigationInstruction] Instrução exibida no banner:",
    title
  );
}

// No arquivo bannerUI.js
export function createNavigationBanner() {
  let banner = document.getElementById(UI_CONFIG.IDS.BANNER);
  if (banner) return banner;

  banner = document.createElement("div");
  banner.id = UI_CONFIG.IDS.BANNER;
  banner.className = `instruction-banner ${UI_CONFIG.CLASSES.HIDDEN}`;

  // Garantir que o HTML correto seja criado
  banner.innerHTML = `
    <div class="instruction-primary">
      <span id="${UI_CONFIG.IDS.INSTRUCTION_ARROW}" class="instruction-icon">↑</span>
      <h2 id="${UI_CONFIG.IDS.INSTRUCTION_MAIN}" class="instruction-main-text">Siga em frente</h2>
      <!-- CERTIFIQUE-SE DE QUE O ID DO BOTÃO ESTÁ CORRETO! -->
      <button id="${UI_CONFIG.IDS.MINIMIZE_BUTTON}" 
        aria-label="Minimizar instruções de navegação"
        aria-expanded="true"></button>
    </div>
    <div class="instruction-secondary">
      <!-- restante do HTML... -->
    </div>
  `;

  document.body.appendChild(banner);
  return banner;
}

export function addNavigationControls() {
  if (navigationState.controlsInitialized) {
    console.log("[addNavigationControls] Controles já inicializados, pulando");
    return;
  }

  console.log("[addNavigationControls] Controles de navegação adicionados");

  // ADICIONE ESTE DEBUG
  const banner = document.getElementById(UI_CONFIG.IDS.BANNER);
  console.log("[addNavigationControls] Estado atual do banner:", {
    existe: !!banner,
    html: banner ? banner.innerHTML : "N/A",
    botaoMinimizar: banner
      ? banner.querySelector(`#${UI_CONFIG.IDS.MINIMIZE_BUTTON}`)
      : null,
    idsBotao: {
      usado: UI_CONFIG.IDS.MINIMIZE_BUTTON,
      encontrado: banner
        ? banner.querySelector(`#${UI_CONFIG.IDS.MINIMIZE_BUTTON}`) !== null
        : false,
    },
  });

  // Inicializar controles de navegação
  initNavigationControls({
    enableAutoMinimize: false,
    disableCancelConfirmation: false,
  });

  // Restante do código...
}
