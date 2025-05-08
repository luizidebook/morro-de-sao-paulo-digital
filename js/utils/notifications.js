/**
 * showNotification
 * Exibe uma notificação para o usuário.
 *
 * @param {string} message - Mensagem a ser exibida.
 * @param {string} type - Tipo da notificação ("error", "warning", "success", "info").
 * @param {number} [duration=3000] - Duração em milissegundos para ocultar a notificação.
 */
export function showNotification(message, type, duration = 3000) {
  // Tenta selecionar o container de notificações; se não existir, cria um novo
  let container = document.getElementById("notification-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "notification-container";
    container.style.position = "fixed";
    container.style.top = "20px";
    container.style.right = "20px";
    container.style.zIndex = "1000";
    document.body.appendChild(container);
  }
  // Cria a notificação com a mensagem e define estilos básicos
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.marginBottom = "10px";
  notification.style.padding = "10px 20px";
  notification.style.borderRadius = "4px";
  notification.style.color = "#fff";
  // Define a cor de fundo de acordo com o tipo
  switch (type) {
    case "error":
      notification.style.backgroundColor = "#e74c3c";
      break;
    case "warning":
      notification.style.backgroundColor = "#f39c12";
      break;
    case "success":
      notification.style.backgroundColor = "#27ae60";
      break;
    default:
      notification.style.backgroundColor = "#3498db";
  }
  container.appendChild(notification);
  // Remove a notificação após o tempo definido (3000ms por padrão)
  setTimeout(() => {
    notification.remove();
  }, duration);
}
