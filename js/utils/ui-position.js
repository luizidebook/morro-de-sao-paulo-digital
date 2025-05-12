/**
 * UI Position Utility
 * Mantém o posicionamento correto entre elementos da UI
 */

// Corrigir a função updateQuickActionsPosition

function updateQuickActionsPosition() {
  const inputArea = document.getElementById("assistant-input-area");
  const quickActions = document.querySelector(".quick-actions");

  if (!inputArea || !quickActions) return;

  // Observar mudanças
  const observer = new ResizeObserver(() => {
    // Manter posição fixa e simples
    quickActions.style.left = "1px";

    // Posição fixa acima da área de input
    quickActions.style.bottom = "85px";

    // Em telas pequenas, ajustar
    if (window.innerWidth <= 480) {
      quickActions.style.left = "1px";
      quickActions.style.bottom = "275px";
    }

    // Se o teclado estiver visível
    if (document.body.classList.contains("keyboard-visible")) {
      quickActions.style.bottom = "100px";
    }

    console.log("[UI Position] Quick actions reposicionado: ", {
      inputAreaTop: inputArea.getBoundingClientRect().top,
      quickActionsBottom: quickActions.style.bottom,
    });
  });

  // Iniciar observação
  observer.observe(inputArea);
  observer.observe(document.body); // Observar também o body para detectar classe keyboard-visible

  // Primeira atualização
  quickActions.style.left = window.innerWidth <= 480 ? "5px" : "10px";
  quickActions.style.bottom = window.innerWidth <= 480 ? "275px" : "285px";
}

// Ajuste para iOS
function fixIOSPositioning() {
  // Verificar se é dispositivo iOS
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isIOS) {
    const quickActions = document.querySelector(".quick-actions");
    const assistantInputArea = document.getElementById("assistant-input-area");

    if (quickActions && assistantInputArea) {
      // Em iOS, garantir posições fixas para evitar problemas com teclado virtual
      quickActions.style.position = "fixed";
      quickActions.style.bottom = "385px";

      assistantInputArea.style.position = "fixed";
      assistantInputArea.style.bottom = "0";
      assistantInputArea.style.left = "0";
      assistantInputArea.style.width = "100%";
    }
  }
}

// Aplicar quando a página carregar
document.addEventListener("DOMContentLoaded", () => {
  updateQuickActionsPosition();
  fixIOSPositioning();

  // Adicionar listeners para eventos que podem afetar o layout
  window.addEventListener("resize", updateQuickActionsPosition);
  window.addEventListener("orientationchange", () => {
    setTimeout(updateQuickActionsPosition, 300); // Tempo para o sistema se ajustar
    setTimeout(fixIOSPositioning, 300);
  });

  // Atualizar também quando o teclado aparecer/desaparecer
  document.addEventListener(
    "focus",
    function (e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        setTimeout(updateQuickActionsPosition, 300);
      }
    },
    true
  );

  document.addEventListener(
    "blur",
    function (e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        setTimeout(updateQuickActionsPosition, 300);
      }
    },
    true
  );
});

/**
 * Ajusta os elementos da UI para evitar sobreposição com o banner de navegação
 * Esta função deve ser chamada quando o estado de navegação mudar
 * @param {boolean} isNavigationActive - Se a navegação está ativa
 */
export function adjustUIForNavigation(isNavigationActive) {
  // Obter referências aos elementos
  const weatherWidget = document.querySelector(".weather-widget");
  const leafletControls = document.querySelector(".leaflet-control-container");
  const banner = document.getElementById("instruction-banner");

  // Verificar se o banner existe para calcular seu tamanho
  if (!banner && isNavigationActive) {
    console.warn(
      "[adjustUIForNavigation] Banner não encontrado, adiando ajustes"
    );
    // Tentar novamente após um breve intervalo, caso o banner esteja sendo criado
    setTimeout(() => adjustUIForNavigation(isNavigationActive), 300);
    return;
  }

  // Calcular altura do banner quando estiver visível
  let bannerHeight = 0;
  if (isNavigationActive && banner) {
    const bannerRect = banner.getBoundingClientRect();
    bannerHeight = bannerRect.height;

    // Se o banner estiver minimizado, usar apenas a altura da seção primária
    if (banner.classList.contains("minimized")) {
      const primarySection = banner.querySelector(".instruction-primary");
      bannerHeight = primarySection ? primarySection.offsetHeight : 70; // Valor de fallback
    }

    // Adicionar margem de segurança
    bannerHeight + 1;
  }

  console.log(
    `[adjustUIForNavigation] Navegação ativa: ${isNavigationActive}, Altura do banner: ${bannerHeight}px`
  );

  // Ajustar posição do widget de clima
  if (weatherWidget) {
    if (isNavigationActive) {
      // Guardar posição original para restaurar depois
      if (!weatherWidget.hasAttribute("data-original-top")) {
        weatherWidget.setAttribute(
          "data-original-top",
          weatherWidget.style.top || ""
        );
      }

      // Calcular nova posição - mover para baixo do banner
      const newTop = `calc(${bannerHeight}px + 10px)`;
      weatherWidget.style.top = newTop;
      weatherWidget.classList.add("shifted-for-navigation");

      console.log(
        `[adjustUIForNavigation] Widget de clima ajustado para top: ${newTop}`
      );
    } else {
      // Restaurar posição original
      const originalTop =
        weatherWidget.getAttribute("data-original-top") || "var(--spacing-sm)";
      weatherWidget.style.top = originalTop;
      weatherWidget.classList.remove("shifted-for-navigation");

      console.log(
        `[adjustUIForNavigation] Widget de clima restaurado para posição original: ${originalTop}`
      );
    }
  }

  // Ajustar controles do Leaflet
  if (leafletControls) {
    // Identificar controles no canto superior direito que precisam ser ajustados
    const topRightControls = leafletControls.querySelector(
      ".leaflet-top.leaflet-right"
    );

    if (topRightControls) {
      if (isNavigationActive) {
        // Guardar posição original
        if (!topRightControls.hasAttribute("data-original-top")) {
          topRightControls.setAttribute(
            "data-original-top",
            topRightControls.style.top || ""
          );
        }

        // Calcular nova posição - mover para baixo do banner
        const newTop = `${bannerHeight}px`;
        topRightControls.style.top = newTop;
        topRightControls.classList.add("shifted-for-navigation");

        console.log(
          `[adjustUIForNavigation] Controles Leaflet ajustados para top: ${newTop}`
        );
      } else {
        // Restaurar posição original
        const originalTop =
          topRightControls.getAttribute("data-original-top") || "";
        topRightControls.style.top = originalTop;
        topRightControls.classList.remove("shifted-for-navigation");

        console.log(
          "[adjustUIForNavigation] Controles Leaflet restaurados para posição original"
        );
      }
    }

    // Também ajustar controles no canto superior esquerdo se necessário
    const topLeftControls = leafletControls.querySelector(
      ".leaflet-top.leaflet-left"
    );

    if (topLeftControls) {
      if (isNavigationActive) {
        if (!topLeftControls.hasAttribute("data-original-top")) {
          topLeftControls.setAttribute(
            "data-original-top",
            topLeftControls.style.top || ""
          );
        }

        const newTop = `${bannerHeight}px`;
        topLeftControls.style.top = newTop;
        topLeftControls.classList.add("shifted-for-navigation");
      } else {
        const originalTop =
          topLeftControls.getAttribute("data-original-top") || "";
        topLeftControls.style.top = originalTop;
        topLeftControls.classList.remove("shifted-for-navigation");
      }
    }
  }
}

/**
 * Observa mudanças no banner de navegação e ajusta a UI conforme necessário
 */
export function setupNavigationUIObserver() {
  // Configurar observer para detectar quando o banner é adicionado/removido
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        // Verificar se o banner foi adicionado ou removido
        const banner = document.getElementById("instruction-banner");
        const isNavigationActive =
          banner && !banner.classList.contains("hidden");

        // Ajustar UI baseado na presença do banner
        adjustUIForNavigation(isNavigationActive);
      }
    }
  });

  // Observar o body para detectar adição/remoção do banner
  observer.observe(document.body, { childList: true, subtree: true });

  // Observar mudanças de classe no banner existente
  const bannerObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "class"
      ) {
        const banner = document.getElementById("instruction-banner");
        if (banner) {
          const isNavigationActive = !banner.classList.contains("hidden");
          adjustUIForNavigation(isNavigationActive);
        }
      }
    }
  });

  // Tentar encontrar o banner existente para observá-lo
  const existingBanner = document.getElementById("instruction-banner");
  if (existingBanner) {
    bannerObserver.observe(existingBanner, { attributes: true });
  }

  // Também verificar o estado de navegação atual
  const isCurrentlyNavigating =
    existingBanner && !existingBanner.classList.contains("hidden");
  adjustUIForNavigation(isCurrentlyNavigating);

  // Adicionar um observador específico para o botão de minimização
  document.addEventListener("click", function (e) {
    // Verificar se o clique foi no botão de minimizar
    if (
      e.target.id === "minimize-navigation-btn" ||
      e.target.closest("#minimize-navigation-btn")
    ) {
      const banner = document.getElementById("instruction-banner");
      if (banner) {
        // Determinar se está minimizando ou maximizando
        const isCurrentlyMinimized = banner.classList.contains("minimized");

        // Chamar a função de sincronização antes da mudança de classe
        syncUIWithBannerTransition(banner, !isCurrentlyMinimized);
      }
    }
  });

  // Também observar eventos de transição no banner
  const bannerTransitionObserver = (banner) => {
    if (!banner) return;

    banner.addEventListener("transitionstart", function (e) {
      // Verificar se é uma transição relevante (altura ou max-height)
      if (e.propertyName === "height" || e.propertyName === "max-height") {
        const isMinimizing =
          banner.classList.contains("minimizing") ||
          (banner.classList.contains("minimized") &&
            !banner.classList.contains("maximizing"));
        syncUIWithBannerTransition(banner, isMinimizing);
      }
    });
  };

  // Observer para detectar quando o banner é adicionado
  const bannerCreationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) {
          if (node.id === "instruction-banner") {
            bannerTransitionObserver(node);
            break;
          }
        }
      }
    }
  });

  bannerCreationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return {
    disconnect: () => {
      observer.disconnect();
      bannerObserver.disconnect();
    },
  };
}

/**
 * Monitoramento manual do estado de navegação
 * @param {boolean} isActive - Se a navegação está ativa
 */
export function setNavigationStatus(isActive) {
  adjustUIForNavigation(isActive);
}

// Adicionar ao arquivo existente

/**
 * Reposiciona a área de mensagens do assistente com transição suave
 * @param {boolean} reposition - Se deve reposicionar (true) ou restaurar (false)
 * @param {boolean} animate - Se deve animar a transição
 * @returns {boolean} Sucesso da operação
 */
export function repositionMessagesArea(reposition = true, animate = true) {
  const messagesArea = document.getElementById("assistant-messages");
  if (!messagesArea) {
    console.error(
      "[repositionMessagesArea] Elemento assistant-messages não encontrado"
    );
    return false;
  }

  // Obter o contêiner de mensagens
  const messagesContainer = messagesArea.querySelector(".messages-area");
  if (!messagesContainer) {
    console.error(
      "[repositionMessagesArea] Elemento messages-area não encontrado"
    );
    return false;
  }

  // Salvar posição original apenas na primeira vez
  if (reposition && !messagesArea.hasAttribute("data-original-position")) {
    try {
      const style = window.getComputedStyle(messagesArea);
      messagesArea.setAttribute(
        "data-original-position",
        JSON.stringify({
          top: "40%",
          left: "50%",
          transform: "translateX(-50%)",
          maxWidth: style.maxWidth,
          position: style.position,
          zIndex: style.zIndex,
          opacity: style.opacity,
        })
      );
      console.log("[repositionMessagesArea] Posição original salva");
    } catch (error) {
      console.warn("[repositionMessagesArea] Erro ao salvar posição:", error);
    }
  }

  // IMPORTANTE: Sempre usar a mesma posição, independentemente do reposition
  // Configuração para qualquer estado
  if (animate) {
    // Preparação para a animação
    messagesArea.style.transition = "none";
    void messagesArea.offsetWidth; // Forçar reflow

    // Configuração inicial
    messagesArea.style.position = "fixed";
    messagesArea.style.zIndex = "1050";
    messagesArea.style.display = "flex";
    messagesArea.style.flexDirection = "column";

    // POSIÇÃO FIXA: sempre 50% left, 40% top, centralizado com transform
    messagesArea.style.left = "50%";
    messagesArea.style.top = "40%";
    messagesArea.style.transform = "translateX(-50%)";
    messagesArea.style.right = "auto";
    messagesArea.style.bottom = "auto";
    messagesArea.style.maxWidth = "95%";
    messagesArea.style.width = "auto";
    messagesArea.style.height = "auto";

    // Se estiver reposicionando, adicione a classe, senão remova
    if (reposition) {
      messagesArea.classList.add("repositioned");
    } else {
      messagesArea.classList.remove("repositioned");
    }

    // Aplicar transição e animar
    requestAnimationFrame(() => {
      messagesArea.style.transition =
        "all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)";
      messagesArea.style.opacity = "1";
      messagesArea.style.transform = "translateX(-50%)";

      console.log(
        `[repositionMessagesArea] Animação concluída - sempre em left: 50%, top: 40%`
      );
    });
  } else {
    // Aplicação imediata sem animação
    messagesArea.style.position = "fixed";
    messagesArea.style.zIndex = "1050";
    messagesArea.style.left = "50%";
    messagesArea.style.top = "40%";
    messagesArea.style.transform = "translateX(-50%)";
    messagesArea.style.right = "auto";
    messagesArea.style.bottom = "auto";
    messagesArea.style.maxWidth = "95%";
    messagesArea.style.width = "auto";
    messagesArea.style.opacity = "1";
    messagesArea.style.height = "auto";

    // Se estiver reposicionando, adicione a classe, senão remova
    if (reposition) {
      messagesArea.classList.add("repositioned");
    } else {
      messagesArea.classList.remove("repositioned");
    }

    console.log(
      `[repositionMessagesArea] Posicionamento imediato - sempre em left: 50%, top: 40%`
    );
  }

  // Resetar estilos do container de mensagens
  resetMessagesContainerStyles(messagesContainer);

  return true;
}

/**
 * Restaura os estilos originais do container de mensagens
 * @param {HTMLElement} messagesContainer - Container de mensagens
 */
function resetMessagesContainerStyles(messagesContainer) {
  if (!messagesContainer) return;

  // Limpar estilos aplicados
  messagesContainer.style.maxHeight = "";
  messagesContainer.style.height = "auto";
  messagesContainer.style.overflowY = "";

  // Restaurar estilos das mensagens
  const messages = messagesContainer.querySelectorAll(".message");
  messages.forEach((message) => {
    message.style.width = "";
    message.style.maxWidth = "";
    message.style.overflowWrap = "";
    message.style.wordBreak = "";
  });
}

/**
 * Verifica se a área de mensagens está reposicionada
 * @returns {boolean} Se a área está reposicionada
 */
export function isMessagesAreaRepositioned() {
  const messagesArea = document.getElementById("assistant-messages");
  return messagesArea && messagesArea.classList.contains("repositioned");
}

/**
 * Alterna o estado de posicionamento da área de mensagens
 * @param {boolean} animate - Se deve animar a transição
 */
export function toggleMessagesAreaPosition(animate = true) {
  const isRepositioned = isMessagesAreaRepositioned();
  repositionMessagesArea(!isRepositioned, animate);
  return !isRepositioned;
}

export { updateQuickActionsPosition, fixIOSPositioning };

// Adicione este trecho no final de cada função que deve reposicionar a área de mensagens
export function dispatchActionEvent(action) {
  document.dispatchEvent(
    new CustomEvent("navigation:action", {
      detail: { action },
    })
  );
}

// Adicionar ao final do arquivo ou após as funções relacionadas

/**
 * Configura observador para manter o ajuste de altura atualizado
 */
export function setupMessagesHeightObserver() {
  // Observador para ajuste de altura quando o conteúdo muda
  const observer = new MutationObserver((mutations) => {
    const messagesArea = document.getElementById("assistant-messages");
    if (messagesArea && messagesArea.classList.contains("repositioned")) {
      // Não fazemos nada aqui além de garantir que a posição seja mantida
      messagesArea.style.left = "50%";
      messagesArea.style.top = "40%";
      messagesArea.style.transform = "translateX(-50%)";
    }
  });

  // Observar quando mensagens são adicionadas/removidas
  const messagesContainer = document.querySelector(
    "#assistant-messages .messages-area"
  );
  if (messagesContainer) {
    observer.observe(messagesContainer, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  // Também observar quando a janela é redimensionada
  window.addEventListener("resize", () => {
    const messagesArea = document.getElementById("assistant-messages");
    if (messagesArea) {
      messagesArea.style.left = "50%";
      messagesArea.style.top = "40%";
      messagesArea.style.transform = "translateX(-50%)";
    }
  });

  // Retornar função para desconectar quando necessário
  return () => observer.disconnect();
}
// Chamar a função de setup imediatamente
setupMessagesHeightObserver();

/**
 * Ajusta os elementos da UI em tempo real durante a transição do banner
 * @param {HTMLElement} banner - Elemento do banner de navegação
 * @param {boolean} isMinimizing - Se está minimizando (true) ou maximizando (false)
 */
export function syncUIWithBannerTransition(banner, isMinimizing) {
  if (!banner) return;

  const weatherWidget = document.querySelector(".weather-widget");
  const leafletControls = document.querySelector(".leaflet-top");

  // Elementos que queremos ajustar
  const elementsToAdjust = [weatherWidget];

  // Adicionar controles do leaflet se existirem
  if (leafletControls) {
    const topRightControls = document.querySelector(
      ".leaflet-top.leaflet-right"
    );
    const topLeftControls = document.querySelector(".leaflet-top.leaflet-left");

    if (topRightControls) elementsToAdjust.push(topRightControls);
    if (topLeftControls) elementsToAdjust.push(topLeftControls);
  }

  // Altura inicial e final do banner
  let startHeight, endHeight;

  if (isMinimizing) {
    // De expandido para minimizado
    const primarySection = banner.querySelector(".instruction-primary");
    startHeight = banner.offsetHeight;
    endHeight = primarySection ? primarySection.offsetHeight : 70;
  } else {
    // De minimizado para expandido
    const primarySection = banner.querySelector(".instruction-primary");
    const secondarySection = banner.querySelector(".instruction-secondary");
    startHeight = primarySection ? primarySection.offsetHeight : 70;
    endHeight =
      primarySection && secondarySection
        ? primarySection.offsetHeight + secondarySection.offsetHeight
        : 230;
  }

  // Duração da animação em milissegundos (deve corresponder à do CSS)
  const animationDuration = 400;
  const startTime = performance.now();

  // Função de animação para ajustar elementos em tempo real
  function animateUIElements(currentTime) {
    const elapsedTime = currentTime - startTime;
    const progress = Math.min(elapsedTime / animationDuration, 1);

    // Cálculo da altura atual usando easing
    const easeProgress = easeOutQuad(progress);
    const currentHeight =
      startHeight + (endHeight - startHeight) * easeProgress;

    // Ajustar posição de cada elemento
    elementsToAdjust.forEach((element) => {
      if (!element) return;

      if (element === weatherWidget) {
        element.style.top = `calc(${currentHeight}px + 10px)`;
      } else {
        // Controles do Leaflet
        element.style.top = `${currentHeight}px`;
      }
    });

    // Continuar animação se não estiver completa
    if (progress < 1) {
      requestAnimationFrame(animateUIElements);
    }
  }

  // Função de easing para suavizar a animação
  function easeOutQuad(t) {
    return t * (2 - t);
  }

  // Iniciar animação
  requestAnimationFrame(animateUIElements);

  console.log(
    `[syncUIWithBannerTransition] Sincronizando elementos UI durante ${
      isMinimizing ? "minimização" : "maximização"
    } do banner`
  );
}
