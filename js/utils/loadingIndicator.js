/**
 * Funções utilitárias para manipulação de indicadores de carregamento
 */

/**
 * Adiciona um indicador visual de carregamento ao corpo do documento
 * @param {string} message - Mensagem a ser exibida
 * @returns {HTMLElement} - Referência ao elemento criado
 */
export function addLoadingIndicator(message = "Carregando...") {
  // Verificar se já existe um indicador
  let loadingIndicator = document.querySelector(".loading-indicator");

  // Se já existe, atualizar mensagem e retornar
  if (loadingIndicator) {
    loadingIndicator.querySelector(".loading-message").textContent = message;
    return loadingIndicator;
  }

  // Criar novo indicador
  loadingIndicator = document.createElement("div");
  loadingIndicator.className = "loading-indicator";

  // Adicionar estilos inline para garantir consistência
  loadingIndicator.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    font-family: sans-serif;
  `;

  // Adicionar HTML interno
  loadingIndicator.innerHTML = `
    <div class="loading-container" style="
      background-color: white;
      border-radius: 8px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      max-width: 85%;
    ">
      <div class="loading-spinner" style="
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 15px;
      "></div>
      <div class="loading-message" style="
        color: #333;
        font-size: 16px;
        font-weight: 500;
        text-align: center;
      ">${message}</div>
    </div>
  `;

  // Adicionar keyframes para animação
  const style = document.createElement("style");
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Adicionar ao corpo do documento
  document.body.appendChild(loadingIndicator);

  return loadingIndicator;
}

/**
 * Remove um indicador de carregamento do DOM
 * @param {HTMLElement} loadingIndicator - Referência ao elemento a remover
 */
export function removeLoadingIndicator(loadingIndicator) {
  // Se não for fornecido um elemento específico, procurar qualquer indicador de carregamento
  if (!loadingIndicator) {
    loadingIndicator = document.querySelector(".loading-indicator");
  }

  // Remover se existir
  if (loadingIndicator && loadingIndicator.parentNode) {
    // Adicionar classe para fade-out
    loadingIndicator.style.opacity = "0";
    loadingIndicator.style.transition = "opacity 0.3s ease";

    // Remover após animação
    setTimeout(() => {
      if (loadingIndicator.parentNode) {
        loadingIndicator.parentNode.removeChild(loadingIndicator);
      }
    }, 300);
  }
}

export default {
  addLoadingIndicator,
  removeLoadingIndicator,
};
