/**
 * Exibe uma notificação para o usuário
 * @param {string} message - Mensagem a ser exibida
 * @param {string} type - Tipo de notificação ('success', 'error', 'warning', 'info')
 * @param {Object} options - Opções adicionais
 */
export function showNotification(message, type = "info", options = {}) {
  // Configurações padrão
  const settings = {
    duration: options.duration || getDefaultDuration(type),
    showClose: options.showClose !== false,
    speakMessage: options.speakMessage || false,
    position: options.position || "top-center",
  };

  // Criar elemento de notificação
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.setAttribute("role", "alert");

  // Definir conteúdo
  notification.innerHTML = `
    <div class="notification-content">
      <div class="notification-message">${message}</div>
      ${
        settings.showClose
          ? '<button class="notification-close">&times;</button>'
          : ""
      }
    </div>
  `;

  // Adicionar ao DOM
  const container = getNotificationContainer(settings.position);
  container.appendChild(notification);

  // Animar entrada
  setTimeout(() => {
    notification.classList.add("notification-show");
  }, 10);

  // Remover após duração
  const timeout = setTimeout(() => {
    closeNotification(notification);
  }, settings.duration);

  // Adicionar evento para fechar
  const closeButton = notification.querySelector(".notification-close");
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      clearTimeout(timeout);
      closeNotification(notification);
    });
  }

  // Falar a mensagem se solicitado e se a API estiver disponível
  if (settings.speakMessage && window.speechSynthesis) {
    try {
      const utterance = new SpeechSynthesisUtterance(message);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("[showNotification] Erro ao sintetizar fala:", e);
    }
  }

  console.log(`[showNotification] ${type.toUpperCase()}: ${message}`);

  // Retornar função para fechar a notificação manualmente
  return {
    close: () => {
      clearTimeout(timeout);
      closeNotification(notification);
    },
  };
}

/**
 * Obtém ou cria um container para notificações
 * @param {string} position - Posição do container
 * @returns {HTMLElement} - Container para notificações
 */
function getNotificationContainer(position) {
  let container = document.querySelector(`.notification-container-${position}`);

  if (!container) {
    container = document.createElement("div");
    container.className = `notification-container notification-container-${position}`;
    document.body.appendChild(container);

    // Adicionar estilos se ainda não existirem
    addNotificationStyles();
  }

  return container;
}

/**
 * Fecha uma notificação com animação
 * @param {HTMLElement} notification - Elemento da notificação
 */
function closeNotification(notification) {
  notification.classList.add("notification-hide");

  notification.addEventListener("transitionend", function handler() {
    notification.removeEventListener("transitionend", handler);
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  });
}

/**
 * Determina a duração padrão com base no tipo de notificação
 * @param {string} type - Tipo de notificação
 * @returns {number} - Duração em milissegundos
 */
function getDefaultDuration(type) {
  switch (type) {
    case "error":
      return 8000;
    case "warning":
      return 5000;
    case "success":
      return 3000;
    case "info":
    default:
      return 4000;
  }
}

/**
 * Adiciona estilos CSS para as notificações
 */
function addNotificationStyles() {
  if (document.getElementById("notification-styles")) return;

  const style = document.createElement("style");
  style.id = "notification-styles";
  style.textContent = `
    .notification-container {
      position: fixed;
      z-index: 9999;
      pointer-events: none;
      display: flex;
      flex-direction: column;
    }
    
    .notification-container-top-right {
      top: 10px;
      right: 10px;
      align-items: flex-end;
    }
    
    .notification-container-top-center {
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      align-items: center;
    }
    
    .notification-container-top-left {
      top: 10px;
      left: 10px;
      align-items: flex-start;
    }
    
    .notification-container-bottom-right {
      bottom: 10px;
      right: 10px;
      align-items: flex-end;
    }
    
    .notification-container-bottom-center {
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      align-items: center;
    }
    
    .notification-container-bottom-left {
      bottom: 10px;
      left: 10px;
      align-items: flex-start;
    }
    
    .notification {
      margin: 5px;
      padding: 10px;
      border-radius: 5px;
      background: white;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      opacity: 0;
      transition: opacity 0.3s, transform 0.3s;
      transform: translateY(20px);
      max-width: 350px;
      width: 100%;
      pointer-events: all;
    }
    
    .notification-show {
      opacity: 1;
      transform: translateY(0);
    }
    
    .notification-hide {
      opacity: 0;
      transform: translateY(-20px);
    }
    
    .notification-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    
    .notification-message {
      flex: 1;
      margin-right: 10px;
    }
    
    .notification-close {
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }
    
    .notification-close:hover {
      background: rgba(0,0,0,0.1);
    }
    
    .notification-success {
      background-color: #d4edda;
      border-color: #c3e6cb;
      color: #155724;
    }
    
    .notification-error {
      background-color: #f8d7da;
      border-color: #f5c6cb;
      color: #721c24;
    }
    
    .notification-warning {
      background-color: #fff3cd;
      border-color: #ffeeba;
      color: #856404;
    }
    
    .notification-info {
      background-color: #d1ecf1;
      border-color: #bee5eb;
      color: #0c5460;
    }
  `;

  document.head.appendChild(style);
}

/**
 * Criar um toast - forma mais simples de notificação
 * @param {string} message - Mensagem a ser exibida
 * @param {string} type - Tipo de notificação
 */
export function showToast(message, type = "info") {
  showNotification(message, type, {
    showClose: false,
    duration: 2000,
    position: "bottom-center",
  });
}

export default {
  showNotification,
  showToast,
};
