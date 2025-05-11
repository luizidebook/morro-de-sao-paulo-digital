/**
 * Cria e exibe um indicador de carregamento na interface
 * @param {string} message - Mensagem a exibir no indicador
 * @param {Object} options - Opções adicionais
 * @returns {HTMLElement} - Referência ao elemento do indicador
 */
export function addLoadingIndicator(message, options = {}) {
  // Configurações padrão
  const settings = {
    position: options.position || "center", // center, top, bottom
    overlay: options.overlay !== false,
    spinnerSize: options.spinnerSize || "normal", // small, normal, large
    theme: options.theme || "light", // light, dark
  };

  // Criar container do indicador
  const indicator = document.createElement("div");
  indicator.className = `loading-indicator loading-position-${settings.position} loading-theme-${settings.theme}`;
  indicator.setAttribute("role", "status");
  indicator.setAttribute("aria-live", "polite");

  // Adicionar overlay se necessário
  if (settings.overlay) {
    indicator.classList.add("loading-with-overlay");
  }

  // Criar conteúdo do indicador
  indicator.innerHTML = `
    <div class="loading-content">
      <div class="loading-spinner loading-spinner-${settings.spinnerSize}"></div>
      <div class="loading-message">${message}</div>
    </div>
  `;

  // Adicionar estilos se ainda não existirem
  addLoadingStyles();

  // Adicionar ao DOM
  document.body.appendChild(indicator);

  // Adicionar classe para animar entrada
  setTimeout(() => {
    indicator.classList.add("loading-visible");
  }, 10);

  console.log(`[addLoadingIndicator] Indicador adicionado: ${message}`);

  return indicator;
}

/**
 * Remove um indicador de carregamento específico
 * @param {HTMLElement} indicator - Referência ao elemento do indicador
 */
export function removeLoadingIndicator(indicator) {
  if (!indicator) return;

  indicator.classList.remove("loading-visible");
  indicator.classList.add("loading-hidden");

  // Remover do DOM após a transição
  setTimeout(() => {
    if (indicator.parentNode) {
      indicator.parentNode.removeChild(indicator);
      console.log("[removeLoadingIndicator] Indicador específico removido");
    }
  }, 300); // Tempo da transição
}

/**
 * Remove todos os indicadores de carregamento
 */
export function removeAllLoadingIndicators() {
  const indicators = document.querySelectorAll(".loading-indicator");
  indicators.forEach(removeLoadingIndicator);
  console.log("[removeAllLoadingIndicators] Todos os indicadores removidos");
}

/**
 * Adiciona estilos CSS para os indicadores de carregamento
 */
function addLoadingStyles() {
  if (document.getElementById("loading-indicator-styles")) return;

  const style = document.createElement("style");
  style.id = "loading-indicator-styles";
  style.textContent = `
    .loading-indicator {
      position: fixed;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }
    
    .loading-visible {
      opacity: 1;
      pointer-events: auto;
    }
    
    .loading-hidden {
      opacity: 0;
    }
    
    .loading-with-overlay {
      background: rgba(0, 0, 0, 0.5);
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    }
    
    .loading-position-center {
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    }
    
    .loading-position-top {
      top: 20px;
      left: 0;
      right: 0;
    }
    
    .loading-position-bottom {
      bottom: 20px;
      left: 0;
      right: 0;
    }
    
    .loading-content {
      background: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
    }
    
    .loading-theme-dark .loading-content {
      background: #333;
      color: #fff;
    }
    
    .loading-spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #3498db;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      animation: spin 1s linear infinite;
      margin-right: 10px;
    }
    
    .loading-theme-dark .loading-spinner {
      border-color: #555;
      border-top-color: #3498db;
    }
    
    .loading-spinner-small {
      width: 16px;
      height: 16px;
      border-width: 2px;
    }
    
    .loading-spinner-large {
      width: 32px;
      height: 32px;
      border-width: 4px;
    }
    
    .loading-message {
      font-size: 14px;
      font-weight: 500;
      color: #333;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  document.head.appendChild(style);
}

export default {
  addLoadingIndicator,
  removeLoadingIndicator,
  removeAllLoadingIndicators,
};
