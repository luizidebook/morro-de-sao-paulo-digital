/**
 * Módulo de UI do banner de navegação
 * Gerencia a criação, atualização e animação do banner de instruções
 * mostrado durante a navegação.
 *
 * Características:
 * - Gestão completa do ciclo de vida do banner de navegação
 * - Suporte a multidispositivos e gestos
 * - Animações e transições fluidas
 * - Gestão de estados (minimizado, expandido, destacado, etc.)
 */

// Importações de core
import { selectedLanguage } from "../../i18n/translatePageContent.js";
import { speak } from "../../voice/voiceSystem.js";
import { getGeneralText } from "../../i18n/translatePageContent.js";
import { getDirectionIcon } from "../navigationUtils/navigationIcons.js";
import { UI_CONFIG } from "./navigationConfig.js";

/**
 * Verifica se o banner de navegação existe e está visível
 * @returns {boolean} Verdadeiro se o banner estiver visível
 */
export function bannerExists() {
  // CORREÇÃO: Usar UI_CONFIG.IDS.BANNER em vez de UI_CONFIG.BANNER_ID
  const banner = document.getElementById(UI_CONFIG.IDS.BANNER);
  return banner && !banner.classList.contains(UI_CONFIG.CLASSES.HIDDEN);
}

// Na função createNavigationBanner, substituir a estrutura HTML do banner

export function createNavigationBanner() {
  const bannerId = UI_CONFIG.IDS.BANNER;
  let banner = document.getElementById(bannerId);
  if (banner) {
    console.log(
      "[createNavigationBanner] Banner já existe, retornando existente"
    );
    return banner;
  }

  banner = document.createElement("div");
  banner.id = bannerId;
  banner.className = "instruction-banner";

  // Garantir que o ID do botão esteja correto
  banner.innerHTML = `
    <div class="instruction-primary">
      <span id="${UI_CONFIG.IDS.INSTRUCTION_ARROW}" class="instruction-icon">↑</span>
      <h2 id="${UI_CONFIG.IDS.INSTRUCTION_MAIN}" class="instruction-main-text">Siga em frente</h2>
      <button id="${UI_CONFIG.IDS.MINIMIZE_BUTTON}" 
        class="minimize-button"
        aria-label="Minimizar instruções de navegação" 
        aria-expanded="true"></button>
    </div>
    <div class="instruction-secondary">
      <p id="${UI_CONFIG.IDS.INSTRUCTION_DETAILS}" class="instruction-details">Siga em frente por 100m</p>
      <div class="progress-container">
        <div id="route-progress" class="progress-indicator-fill" style="width: 0%"></div>
      </div>
      <div id="progress-text" style="text-align: center; font-size: 0.8em; margin: 4px 0;">0%</div>
      <div class="metrics-group">
        <div class="metric">
          <span class="metric-label">Distância</span>
          <span id="${UI_CONFIG.IDS.INSTRUCTION_DISTANCE}" class="metric-value">0 m</span>
        </div>
        <div class="metric">
          <span class="metric-label">Tempo</span>
          <span id="${UI_CONFIG.IDS.INSTRUCTION_TIME}" class="metric-value">0 min</span>
        </div>
      </div>
    </div>
  `;

  // Adicionar ao DOM
  document.body.appendChild(banner);

  // Adicionar estilos necessários
  addBannerStyles();

  // NOVO: Adicionar event listener ao botão de minimizar imediatamente
  setupMinimizeButton(banner);

  return banner;
}

/**
 * Exibe o banner de instruções de navegação
 * @param {boolean} animate - Se deve animar a entrada do banner
 * @returns {HTMLElement} - Elemento do banner
 */
export function showInstructionBanner(animate = true) {
  // Criar ou obter banner existente
  const banner =
    document.getElementById(UI_CONFIG.IDS.BANNER) || createNavigationBanner();

  // Garantir que TODAS as classes que ocultam elementos sejam removidas
  banner.classList.remove(
    UI_CONFIG.CLASSES.HIDDEN,
    UI_CONFIG.CLASSES.MINIMIZED,
    "hidden",
    "offscreen",
    "page-hidden"
  );

  // Adicionar classe de navegação ativa ao body
  document.body.classList.add(UI_CONFIG.CLASSES.NAVIGATION_ACTIVE);

  // Certificar que a seção secundária está visível
  const secondarySection = banner.querySelector(".instruction-secondary");
  if (secondarySection) {
    secondarySection.style.display = "block";
    secondarySection.style.maxHeight = ""; // Remover altura máxima que pode estar limitando
    secondarySection.style.opacity = "1";
  }

  // Animar entrada se solicitado
  if (animate) {
    banner.classList.add(UI_CONFIG.CLASSES.ENTRY_ANIMATION);
    setTimeout(() => {
      banner.classList.remove(UI_CONFIG.CLASSES.ENTRY_ANIMATION);
      banner.classList.add(UI_CONFIG.CLASSES.PREPARED);
    }, UI_CONFIG.ANIMATION.ENTRY_DURATION);
  } else {
    banner.classList.add(UI_CONFIG.CLASSES.PREPARED);
  }

  console.log("[bannerUI] Banner de instruções mostrado");

  return banner;
}

/**
 * Oculta o banner de instruções de navegação
 * @param {boolean} [animate=true] Se deve animar a saída
 */
export function hideInstructionBanner(animate = true) {
  // CORREÇÃO: Usar UI_CONFIG.IDS.BANNER em vez de UI_CONFIG.BANNER_ID
  const banner = document.getElementById(UI_CONFIG.IDS.BANNER);
  if (!banner) return;

  // Remover classe de navegação ativa do body
  document.body.classList.remove(UI_CONFIG.CLASSES.NAVIGATION_ACTIVE);

  // Animação de saída ou ocultação direta
  if (animate) {
    banner.classList.add(UI_CONFIG.CLASSES.CLOSING);
    setTimeout(() => {
      banner.classList.add(UI_CONFIG.CLASSES.HIDDEN);
      banner.classList.remove(UI_CONFIG.CLASSES.CLOSING);
    }, UI_CONFIG.ANIMATION.EXIT_DURATION);
  } else {
    banner.classList.add(UI_CONFIG.CLASSES.HIDDEN);
  }

  console.log("[bannerUI] Banner de instruções ocultado");
}

/**
 * Mostra indicador de carregamento durante a busca por instruções
 * @param {string} [message='Calculando rota...'] - Mensagem para exibir
 */
export function showNavigationLoading(message = "Calculando rota...") {
  console.log("[showNavigationLoading] INÍCIO - Estado atual do banner:", {
    existe: document.getElementById(UI_CONFIG.IDS.BANNER) ? true : false,
    classes: document.getElementById(UI_CONFIG.IDS.BANNER)
      ? Array.from(document.getElementById(UI_CONFIG.IDS.BANNER).classList)
      : [],
    message: message,
  });

  // CORREÇÃO: Usar UI_CONFIG.IDS.BANNER em vez de UI_CONFIG.BANNER_ID
  const banner =
    document.getElementById(UI_CONFIG.IDS.BANNER) || createNavigationBanner();

  // IMPORTANTE: Limpar TODAS as classes do banner exceto a ID base
  const classesToRemove = [
    UI_CONFIG.CLASSES.PREPARED,
    UI_CONFIG.CLASSES.MINIMIZED,
    UI_CONFIG.CLASSES.HIDDEN,
    UI_CONFIG.CLASSES.INITIALIZING,
    UI_CONFIG.CLASSES.ENTRY_ANIMATION,
  ];

  classesToRemove.forEach((cls) => banner.classList.remove(cls));
  banner.classList.add(UI_CONFIG.CLASSES.INITIALIZING);

  // Obter referências aos elementos
  const arrowEl = banner.querySelector(`#${UI_CONFIG.IDS.INSTRUCTION_ARROW}`);
  const mainTextEl = banner.querySelector(`#${UI_CONFIG.IDS.INSTRUCTION_MAIN}`);
  const detailsEl = banner.querySelector(
    `#${UI_CONFIG.IDS.INSTRUCTION_DETAILS}`
  );

  if (arrowEl) {
    arrowEl.innerHTML = "↻";
    arrowEl.className = `instruction-icon ${UI_CONFIG.CLASSES.ROTATING}`;
  }

  if (mainTextEl) {
    mainTextEl.textContent = message;
  }

  if (detailsEl) {
    detailsEl.innerHTML = "Calculando rota...";
  }

  // Animação de entrada
  document.body.classList.add(UI_CONFIG.CLASSES.NAVIGATION_ACTIVE);

  setTimeout(() => {
    banner.classList.remove(UI_CONFIG.CLASSES.INITIALIZING);
    banner.classList.add(UI_CONFIG.CLASSES.ENTRY_ANIMATION);

    setTimeout(() => {
      banner.classList.remove(UI_CONFIG.CLASSES.ENTRY_ANIMATION);
      banner.classList.add(UI_CONFIG.CLASSES.PREPARED); // Adiciona PREPARED explicitamente
    }, UI_CONFIG.ANIMATION.ENTRY_DURATION);
  }, UI_CONFIG.ANIMATION.INIT_DELAY);
}

/**
 * Simplifica uma instrução de navegação para um formato básico
 * @param {string} instruction - Instrução completa original
 * @param {number|string} type - Tipo de manobra
 * @returns {string} - Instrução simplificada (sem nome de rua ou distância)
 */
export function simplifyInstruction(instruction, type) {
  // Mapeamento padronizado dos tipos de instrução
  const actionTypeMap = {
    // Valores numéricos conforme padrão da API
    0: "Siga em frente",
    1: "Siga em frente",
    2: "Curva leve à direita",
    3: "Vire à direita",
    4: "Curva acentuada à direita",
    5: "Faça o retorno",
    6: "Curva acentuada à esquerda",
    7: "Vire à esquerda",
    8: "Curva leve à esquerda",
    10: "Chegou ao destino",
    11: "Chegou ao destino",
    12: "Chegou ao destino",
    // Strings para compatibilidade
    continue: "Siga em frente",
    straight: "Siga em frente",
    "turn-left": "Vire à esquerda",
    "turn-right": "Vire à direita",
    "turn-slight-left": "Curva leve à esquerda",
    "turn-slight-right": "Curva leve à direita",
    "turn-sharp-left": "Curva acentuada à esquerda",
    "turn-sharp-right": "Curva acentuada à direita",
    uturn: "Faça o retorno",
    arrive: "Chegou ao destino",
    destination: "Chegou ao destino",
  };

  // Tratamento de tipo string
  if (typeof type === "string") {
    for (const [key, value] of Object.entries(actionTypeMap)) {
      if (type.includes(key)) {
        return value;
      }
    }
  }

  // Tratamento de tipo numérico
  if (typeof type === "number" && actionTypeMap[type]) {
    return actionTypeMap[type];
  }

  // Se não conseguir determinar pelo tipo, tentar analisar o texto da instrução
  const lowerText = (instruction || "").toLowerCase();

  if (lowerText.includes("arrive") || lowerText.includes("destination")) {
    return "Chegou ao destino";
  } else if (lowerText.includes("sharp left")) {
    return "Curva acentuada à esquerda";
  } else if (lowerText.includes("sharp right")) {
    return "Curva acentuada à direita";
  } else if (lowerText.includes("slight left")) {
    return "Curva leve à esquerda";
  } else if (lowerText.includes("slight right")) {
    return "Curva leve à direita";
  } else if (lowerText.includes("left")) {
    return "Vire à esquerda";
  } else if (lowerText.includes("right")) {
    return "Vire à direita";
  } else if (lowerText.includes("head") || lowerText.includes("continue")) {
    return "Siga em frente";
  }

  // Valor padrão
  return "Siga em frente";
}

/**
 * Atualiza o banner com as informações da instrução atual
 * @param {Object} instruction - Instrução de navegação
 * @param {string} [lang=selectedLanguage] - Código do idioma
 * @returns {HTMLElement|boolean} - Elemento do banner ou false se falhar
 */
export function updateInstructionBanner(instruction, lang = selectedLanguage) {
  try {
    // 1. Validação e extração de dados
    if (!instruction) {
      console.error(
        "[updateInstructionBanner] Instrução inválida:",
        instruction
      );
      return false;
    }

    // 2. Garantir que o banner existe
    const banner =
      document.getElementById(UI_CONFIG.IDS.BANNER) || createNavigationBanner();
    if (!banner) {
      console.error(
        "[updateInstructionBanner] Não foi possível obter ou criar o banner"
      );
      return false;
    }

    // 3. Extrair dados da instrução com fallbacks robustos
    const originalInstruction =
      instruction.original || instruction.instruction || "";
    const type = instruction.type || getInstructionType(originalInstruction);
    const streetName = instruction.streetName || instruction.name || "-";
    const formattedDistance = instruction.formattedDistance || "0 m";
    const remainingDistance =
      instruction.remainingDistance || formattedDistance;
    const estimatedTime =
      instruction.estimatedTime || instruction.formattedTime || "0 min";
    const progress =
      typeof instruction.progress === "number" ? instruction.progress : 0;

    // 4. Processar a instrução simplificada para exibição no cabeçalho
    const simplifiedInstruction =
      instruction.simplifiedInstruction ||
      simplifyInstruction(originalInstruction, type);

    // 5. Obter referências aos elementos do banner
    const iconEl = document.getElementById(UI_CONFIG.IDS.INSTRUCTION_ARROW);
    const mainTextEl = document.getElementById(UI_CONFIG.IDS.INSTRUCTION_MAIN);
    const detailsEl = document.getElementById(
      UI_CONFIG.IDS.INSTRUCTION_DETAILS
    );
    const distanceEl = document.getElementById(
      UI_CONFIG.IDS.INSTRUCTION_DISTANCE
    );
    const timeEl = document.getElementById(UI_CONFIG.IDS.INSTRUCTION_TIME);
    const progressEl = banner.querySelector(".progress-indicator-fill");

    // 6. Verificar se todos os elementos críticos existem
    if (!iconEl || !mainTextEl || !detailsEl || !distanceEl || !timeEl) {
      console.error(
        "[updateInstructionBanner] Elementos críticos ausentes do banner"
      );
      return false;
    }

    // 7. Atualizar elementos do banner

    // 7.1. Ícone direcional
    const directionIcon = getDirectionIcon(type);
    iconEl.innerHTML = directionIcon;

    // 7.2. Texto principal (simplificado)
    mainTextEl.textContent = simplifiedInstruction;

    // 7.3. Texto detalhado com formato específico
    // Usar buildDetailsText para gerar o texto no formato:
    // "Siga em frente/Vire à esquerda/Vire à direita na {streetName} por {formattedDistance}"
    const detailsText = buildDetailsText(
      originalInstruction,
      streetName,
      formattedDistance,
      lang,
      type // Passando o tipo para que buildDetailsText possa obter a ação correta
    );
    detailsEl.textContent = detailsText;

    // 7.4. Métricas e progresso
    distanceEl.textContent = remainingDistance;
    timeEl.textContent = estimatedTime;

    if (progressEl) {
      progressEl.style.width = `${progress}%`;
      progressEl.classList.toggle("almost-complete", progress > 75);
    }

    // 8. Log de sucesso
    console.log("[updateInstructionBanner] Banner atualizado com sucesso:", {
      main: simplifiedInstruction,
      details: detailsText,
      metrics: `${remainingDistance} / ${estimatedTime}`,
    });

    return banner;
  } catch (error) {
    console.error("[updateInstructionBanner] Erro ao atualizar banner:", error);
    return false;
  }
}

/**
 * Determina o tipo de instrução com base no texto
 * @param {string} instruction - Texto da instrução
 * @returns {number} - Código do tipo de instrução
 */
function getInstructionType(instruction) {
  if (!instruction) return 1; // Padrão "siga em frente"

  const lowerText = instruction.toLowerCase();

  if (lowerText.includes("destination") || lowerText.includes("arrive")) {
    return 10; // Chegada ao destino
  } else if (lowerText.includes("sharp left")) {
    return 6; // Curva acentuada à esquerda
  } else if (lowerText.includes("sharp right")) {
    return 4; // Curva acentuada à direita
  } else if (lowerText.includes("slight left")) {
    return 8; // Curva leve à esquerda
  } else if (lowerText.includes("slight right")) {
    return 2; // Curva leve à direita
  } else if (lowerText.includes("left")) {
    return 7; // Vire à esquerda
  } else if (lowerText.includes("right")) {
    return 3; // Vire à direita
  } else if (lowerText.includes("uturn")) {
    return 5; // Faça o retorno
  }

  return 1; // Padrão é seguir em frente
}

/**
 * Constrói o texto detalhado para as instruções de navegação no formato:
 * "Siga em frente/Vire à esquerda/Vire à direita na {streetName} por {formattedDistance}"
 *
 * @param {string} instructionText - Texto original da instrução
 * @param {string} streetName - Nome da rua (será preservado)
 * @param {string} formattedDistance - Distância formatada
 * @param {string} lang - Código do idioma
 * @param {number|string} instructionType - Tipo da instrução ou texto simplificado
 * @returns {string} - Texto detalhado formatado
 */
function buildDetailsText(
  instructionText,
  streetName,
  formattedDistance,
  lang,
  instructionType
) {
  try {
    // Obter textos traduzidos para os conectores e preposições
    const onText = getGeneralText("navigation_on", lang) || "na";
    const forText = getGeneralText("navigation_for", lang) || "por";

    // Extrair nome da rua do texto original se não foi passado explicitamente
    let extractedStreetName = streetName;

    // Se o nome da rua for vazio ou "-", tentar extrair do texto original
    if (!extractedStreetName || extractedStreetName === "-") {
      const instructionLower = instructionText.toLowerCase();

      // Verificar se contém "on " seguido do nome da rua
      if (instructionLower.includes(" on ")) {
        extractedStreetName = instructionText.split(" on ")[1];
      }
      // Verificar se contém "onto " seguido do nome da rua
      else if (instructionLower.includes(" onto ")) {
        extractedStreetName = instructionText.split(" onto ")[1];
      }
    }

    // Extrair a ação simplificada (Siga em frente, Vire à esquerda, etc.)
    let action;

    // Determinar a ação da instrução
    if (
      typeof instructionType === "string" &&
      (instructionType.startsWith("Siga") ||
        instructionType.startsWith("Vire") ||
        instructionType.startsWith("Curva") ||
        instructionType.startsWith("Faça") ||
        instructionType.startsWith("Chegou"))
    ) {
      // Se já recebemos um texto processado, usar diretamente
      action = instructionType;
    } else {
      // Caso contrário, derivar a ação do tipo ou do texto
      action = simplifyInstruction(instructionText, instructionType);
    }

    // Montar a instrução completa no formato padrão
    let detailsText;

    // Para casos de chegada ao destino, formato diferente
    if (action.includes("Chegou")) {
      return action;
    }

    // Garantir que o nome da rua seja exibido quando disponível
    if (extractedStreetName && extractedStreetName !== "-") {
      detailsText = `${action} ${onText} ${extractedStreetName} ${forText} ${formattedDistance}`;
    } else {
      // Se não tiver nome de rua, omitir a parte "na {streetName}"
      detailsText = `${action} ${forText} ${formattedDistance}`;
    }

    console.log("[buildDetailsText] Texto construído:", detailsText);
    return detailsText;
  } catch (error) {
    console.warn("[buildDetailsText] Erro ao construir texto:", error);
    return `Siga em frente por ${formattedDistance}`;
  }
}

/**
 * Configura o comportamento do botão minimizar
 * @param {HTMLElement} banner - Banner a configurar
 */
export function setupMinimizeButton(banner) {
  // Usar o ID correto definido em UI_CONFIG.IDS.MINIMIZE_BUTTON
  const minimizeBtn = banner.querySelector(`#${UI_CONFIG.IDS.MINIMIZE_BUTTON}`);
  if (!minimizeBtn) {
    console.warn(
      "[setupMinimizeButton] Botão não encontrado com ID:",
      UI_CONFIG.IDS.MINIMIZE_BUTTON
    );
    return;
  }

  console.log(
    "[setupMinimizeButton] Configurando botão de minimizar:",
    minimizeBtn
  );

  // Remover listeners anteriores para evitar duplicação
  const newBtn = minimizeBtn.cloneNode(true);
  if (minimizeBtn.parentNode) {
    minimizeBtn.parentNode.replaceChild(newBtn, minimizeBtn);
  }

  // Adicionar novo listener com registro de logs para depuração
  newBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log("[setupMinimizeButton] Botão clicado");

    const isMinimized = banner.classList.contains(UI_CONFIG.CLASSES.MINIMIZED);
    toggleMinimizedState(banner, !isMinimized);

    console.log(
      "[setupMinimizeButton] Banner foi",
      isMinimized ? "expandido" : "minimizado"
    );
  });

  console.log("[setupMinimizeButton] Event listener configurado com sucesso");
}
/**
 * Alterna o estado minimizado do banner
 * @param {HTMLElement} banner - Banner de navegação
 * @param {boolean} minimize - Se deve minimizar (true) ou expandir (false)
 */
function toggleMinimizedState(banner, minimize) {
  if (!banner) return;

  const minimizeBtn = banner.querySelector(`#${UI_CONFIG.IDS.MINIMIZE_BUTTON}`);

  // Adicionar classe transitória para detectar início da animação
  if (minimize) {
    banner.classList.add("minimizing");
    setTimeout(() => banner.classList.remove("minimizing"), 10);

    banner.classList.add(UI_CONFIG.CLASSES.MINIMIZED);
    if (minimizeBtn) {
      minimizeBtn.setAttribute("aria-expanded", "false");
      minimizeBtn.setAttribute(
        "aria-label",
        "Expandir instruções de navegação"
      );
    }

    // Disparar evento para sincronização da UI
    document.dispatchEvent(
      new CustomEvent("banner:minimizing", {
        detail: { banner, height: banner.offsetHeight },
      })
    );
  } else {
    banner.classList.add("maximizing");
    setTimeout(() => banner.classList.remove("maximizing"), 10);

    banner.classList.remove(UI_CONFIG.CLASSES.MINIMIZED);
    if (minimizeBtn) {
      minimizeBtn.setAttribute("aria-expanded", "true");
      minimizeBtn.setAttribute(
        "aria-label",
        "Minimizar instruções de navegação"
      );
    }

    // Disparar evento para sincronização da UI
    document.dispatchEvent(
      new CustomEvent("banner:maximizing", {
        detail: { banner, height: banner.offsetHeight },
      })
    );
  }
}

/**
 * Destaca o banner para chamar a atenção do usuário
 * @param {boolean} [flash=true] - Se deve destacar o banner
 */
export function flashBanner(flash = true) {
  // CORREÇÃO: Usar UI_CONFIG.IDS.BANNER em vez de UI_CONFIG.BANNER_ID
  const banner = document.getElementById(UI_CONFIG.IDS.BANNER);
  if (!banner) return;

  if (flash) {
    // Adicionar classe de highlight
    banner.classList.add(UI_CONFIG.CLASSES.HIGHLIGHT);

    // Remover após período de tempo
    setTimeout(() => {
      banner.classList.remove(UI_CONFIG.CLASSES.HIGHLIGHT);
    }, UI_CONFIG.ANIMATION.HIGHLIGHT_DURATION);

    // Feedback tátil se disponível
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }
}

/**
 * Formata uma distância em metros para exibição amigável
 * @param {number} distance - Distância em metros
 * @param {string} lang - Código do idioma
 * @returns {string} Distância formatada
 */
export function formatDistance(distance, lang) {
  if (typeof distance !== "number") {
    const parsed = parseFloat(distance);
    if (isNaN(parsed)) return "0 m";
    distance = parsed;
  }

  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1)} km`;
  }

  return `${Math.round(distance)} m`;
}

/**
 * Adiciona estilos CSS para o banner de navegação
 */
function addNavigationBannerStyles() {
  const styleId = "navigation-banner-styles";
  if (!document.getElementById(styleId)) {
    const styleElement = document.createElement("style");
    styleElement.id = styleId;
    styleElement.textContent = `
      /* Navigation instruction banner */
      .instruction-banner {
        position: fixed;
        left: 50%;
        top: 1px;
        transform: translateX(-50%);
        width: 100%;
        max-width: 450px;
        display: flex;
        flex-direction: column;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 8px 24px rgba(0,0,0,0.25);
        backdrop-filter: blur(10px);
        background-color: rgba(255,255,255,0.95);
        z-index: 2100;
        opacity: 1;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .instruction-banner.hidden {
        opacity: 0;
        transform: translateX(-50%) translateY(30px);
        pointer-events: none;
      }

      .instruction-primary {
        display: flex;
        align-items: center;
        background: linear-gradient(135deg, #004bc7, #0067e6);
        color: white;
        padding: 0.75rem 1rem;
        position: relative;
      }

      #instruction-arrow {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 48px;
        height: 48px;
        background: rgba(255,255,255,0.2);
        border-radius: 50%;
        font-size: 1.8rem;
        margin-right: 16px;
      }

      #instruction-main {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0;
        flex-grow: 1;
      }
      
      #minimize-navigation-btn {
        width: 24px;
        height: 24px;
        background: rgba(255,255,255,0.3);
        border: none;
        border-radius: 50%;
        position: relative;
        cursor: pointer;
      }
      
      #minimize-navigation-btn::before,
      #minimize-navigation-btn::after {
        content: '';
        position: absolute;
        width: 10px;
        height: 2px;
        background: white;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
      }
      
      .instruction-banner:not(.minimized) #minimize-navigation-btn::after {
        transform: translate(-50%, -50%) rotate(90deg);
      }

      .instruction-secondary {
        background-color: white;
        padding: 0.75rem 1rem;
        transition: max-height 0.3s ease, padding 0.3s ease, opacity 0.3s ease;
        max-height: 200px;
        opacity: 1;
      }

      #instruction-details {
        font-size: 1rem;
        margin: 0 0 0.5rem;
      }

      .instruction-extra {
        display: flex;
        justify-content: space-between;
        font-size: 0.85rem;
        color: #555;
      }
      
      .instruction-banner.minimized .instruction-secondary {
        max-height: 0;
        overflow: hidden;
        padding-top: 0;
        padding-bottom: 0;
        opacity: 0;
      }
      
      .instruction-banner.highlight {
        box-shadow: 0 4px 20px rgba(52, 152, 219, 0.7);
      }
      
      .approaching-turn .instruction-primary {
        animation: pulse-highlight 1.2s infinite;
      }
      
      @keyframes pulse-highlight {
        0%, 100% { background: linear-gradient(135deg, #004bc7, #0067e6); }
        50% { background: linear-gradient(135deg, #0056e4, #0078ff); }
      }
      
      @keyframes rotateIcon {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      
      .rotating {
        display: inline-block;
        animation: rotateIcon 2s infinite linear;
      }
      
      /* Suporte para tema escuro */
      @media (prefers-color-scheme: dark) {
        .instruction-secondary {
          background-color: #222;
          color: #eee;
        }
        .instruction-extra {
          color: #bbb;
        }
      }
    `;
    document.head.appendChild(styleElement);
    console.log("[addNavigationBannerStyles] Estilos CSS adicionados");
  }
}

/**
 * Verifica e corrige o banner de navegação se elementos essenciais estiverem faltando
 * @returns {HTMLElement} O banner corrigido
 */
export function ensureBannerIntegrity() {
  const banner = document.getElementById(UI_CONFIG.IDS.BANNER);

  // Se o banner não existir, criar um novo
  if (!banner) {
    console.log("[ensureBannerIntegrity] Banner não existe, criando novo");
    const newBanner = createNavigationBanner();

    // Adicionar o handler ao botão de minimizar
    import("../navigationControls/navigationControls.js")
      .then((module) => {
        if (typeof module.addMinimizeButtonHandler === "function") {
          module.addMinimizeButtonHandler();
        }
      })
      .catch((err) =>
        console.error("[ensureBannerIntegrity] Erro ao importar módulo:", err)
      );

    return newBanner;
  }

  // Verificar elementos essenciais
  const requiredElements = [
    {
      id: UI_CONFIG.IDS.INSTRUCTION_ARROW,
      selector: `#${UI_CONFIG.IDS.INSTRUCTION_ARROW}`,
    },
    {
      id: UI_CONFIG.IDS.INSTRUCTION_MAIN,
      selector: `#${UI_CONFIG.IDS.INSTRUCTION_MAIN}`,
    },
    {
      id: UI_CONFIG.IDS.INSTRUCTION_DETAILS,
      selector: `#${UI_CONFIG.IDS.INSTRUCTION_DETAILS}`,
    },
    {
      id: UI_CONFIG.IDS.INSTRUCTION_DISTANCE,
      selector: `#${UI_CONFIG.IDS.INSTRUCTION_DISTANCE}`,
    },
    {
      id: UI_CONFIG.IDS.INSTRUCTION_TIME,
      selector: `#${UI_CONFIG.IDS.INSTRUCTION_TIME}`,
    },
    { id: "progress", selector: ".progress-indicator-fill" },
  ];

  let needsRebuild = false;

  // Verificar se todos os elementos essenciais existem
  for (const element of requiredElements) {
    if (!banner.querySelector(element.selector)) {
      console.warn(`[ensureBannerIntegrity] Elemento ausente: ${element.id}`);
      needsRebuild = true;
      break;
    }
  }

  // Se algum elemento estiver faltando, recriar o banner
  if (needsRebuild) {
    console.log(
      "[ensureBannerIntegrity] Recriando banner devido a elementos ausentes"
    );
    const parent = banner.parentNode;
    parent.removeChild(banner);
    return createNavigationBanner();
  }

  // Garantir que a seção secundária esteja visível
  const secondarySection = banner.querySelector(".instruction-secondary");
  if (
    secondarySection &&
    (secondarySection.style.display === "none" ||
      secondarySection.style.opacity === "0")
  ) {
    console.log(
      "[ensureBannerIntegrity] Corrigindo visibilidade da seção secundária"
    );
    secondarySection.style.display = "block";
    secondarySection.style.maxHeight = "";
    secondarySection.style.opacity = "1";
  }

  return banner;
}

/**
 * Adiciona estilos CSS necessários para o banner de navegação
 */
function addBannerStyles() {
  const styleId = "navigation-banner-styles";

  // Evitar adicionar estilos duplicados
  if (document.getElementById(styleId)) {
    return;
  }

  const styleElement = document.createElement("style");
  styleElement.id = styleId;
  styleElement.textContent = `
    .instruction-banner {
      position: fixed;
      top: 1px;
      left: 0;
      width: 100%;
      background-color: #fff;
      box-shadow: 0 -2px 10px rgba(0,0,0,0.2);
      z-index: 1000;
      transition: transform 0.3s ease, opacity 0.3s ease;
      max-height: 80vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .instruction-banner.hidden {
      transform: translateY(100%);
      opacity: 0;
      pointer-events: none;
    }
    
    .instruction-primary {
      display: flex;
      align-items: center;
      padding: 16px;
      background-color: #1D4ED8;
      color: white;
      position: relative;
    }
    
    .instruction-icon {
      font-size: 24px;
      margin-right: 16px;
    }
    
    .instruction-main-text {
      flex: 1;
      margin: 0;
      font-size: 18px;
    }
    
    #${UI_CONFIG.IDS.MINIMIZE_BUTTON}, .minimize-button {
      width: 24px;
      height: 24px;
      background: rgba(255,255,255,0.2);
      border: none;
      border-radius: 50%;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
    }
    
    /* Linha horizontal sempre presente */
    #${UI_CONFIG.IDS.MINIMIZE_BUTTON}::before, .minimize-button::before {
      content: '';
      width: 12px;
      height: 2px;
      background: white;
      position: absolute;
    }
    
    /* Linha vertical - presente apenas quando minimizado (mostra o +) */
    .instruction-banner.minimized #${UI_CONFIG.IDS.MINIMIZE_BUTTON}::after,
    .instruction-banner.minimized .minimize-button::after {
      content: '';
      width: 2px;
      height: 12px;
      background: white;
      position: absolute;
    }
    
    .instruction-secondary {
      padding: 16px;
      transition: max-height 0.3s ease, opacity 0.3s ease;
    }
    
    .instruction-banner.minimized .instruction-secondary {
      max-height: 0;
      padding-top: 0;
      padding-bottom: 0;
      opacity: 0;
      overflow: hidden;
    }
    
    .instruction-details {
      margin: 0 0 16px;
      font-size: 16px;
    }
    
    .progress-container {
      height: 4px;
      background-color: #E5E7EB;
      border-radius: 2px;
      overflow: hidden;
      margin: 12px 0;
    }
    
    .progress-indicator-fill {
      height: 100%;
      background-color: #2563EB;
      border-radius: 2px;
      width: 0%;
      transition: width 0.3s ease;
    }
    
    .progress-indicator-fill.almost-complete {
      background-color: #10B981;
    }
    
    .metrics-group {
      display: flex;
      justify-content: space-between;
    }
    
    .metric {
      text-align: center;
    }
    
    .metric-label {
      display: block;
      font-size: 12px;
      color: #6B7280;
    }
    
    .metric-value {
      font-weight: 500;
      font-size: 16px;
    }
    
    .instruction-banner.highlight {
      animation: highlight-pulse 0.6s ease;
    }
    
    @keyframes highlight-pulse {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
    
    .rotating {
      animation: rotation 1.5s infinite linear;
    }
    
    @keyframes rotation {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;

  document.head.appendChild(styleElement);
  console.log(
    "[addBannerStyles] Estilos CSS adicionados para o banner de navegação"
  );
}

/**
 * Cria e retorna o elemento de barra de progresso
 * @returns {HTMLElement} Elemento da barra de progresso
 */
function createProgressBar() {
  // Container da barra
  const progressContainer = document.createElement("div");
  progressContainer.className = "progress-container";

  // Barra de progresso
  const progressBar = document.createElement("div");
  progressBar.className = "progress-bar";
  progressBar.id = "progress"; // ID específico necessário
  progressBar.setAttribute("role", "progressbar");
  progressBar.setAttribute("aria-valuenow", "0");
  progressBar.setAttribute("aria-valuemin", "0");
  progressBar.setAttribute("aria-valuemax", "100");

  // Texto de progresso
  const progressText = document.createElement("span");
  progressText.id = "progress-text";
  progressText.className = "progress-text";
  progressText.textContent = "0%";

  // Montagem
  progressContainer.appendChild(progressBar);
  progressContainer.appendChild(progressText);

  return progressContainer;
}
