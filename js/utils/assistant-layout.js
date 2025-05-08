/**
 * Gerencia o layout adaptativo do assistente
 */
export function setupAdaptiveLayout() {
  // Encontrar referências aos elementos
  const assistantMessages = document.getElementById("assistant-messages");
  if (!assistantMessages) return;

  // Função para ajustar o layout com base no conteúdo
  function adjustLayoutBasedOnContent() {
    const messagesArea = assistantMessages.querySelector(".messages-area");
    if (!messagesArea) return;

    // Obter todas as mensagens de texto
    const textMessages = messagesArea.querySelectorAll(
      ".message:not(.carousel-container)"
    );
    const carouselContainers = messagesArea.querySelectorAll(
      ".carousel-container"
    );
    const totalTextLength = Array.from(textMessages).reduce(
      (total, msg) => total + msg.textContent.length,
      0
    );

    // Remover classes anteriores
    assistantMessages.classList.remove(
      "has-long-text",
      "has-short-text",
      "has-mixed-content"
    );

    // Aplicar classes com base no conteúdo
    if (totalTextLength > 500) {
      assistantMessages.classList.add("has-long-text");
    } else if (totalTextLength < 100) {
      assistantMessages.classList.add("has-short-text");
    }

    if (textMessages.length > 0 && carouselContainers.length > 0) {
      assistantMessages.classList.add("has-mixed-content");
    }

    // Verificar se há overflow e adicionar classe específica
    const hasOverflow = messagesArea.scrollHeight > messagesArea.clientHeight;
    assistantMessages.classList.toggle("has-overflow", hasOverflow);
  }

  // Criar um observador para detectar mudanças no conteúdo
  const observer = new MutationObserver(adjustLayoutBasedOnContent);

  // Observar mudanças na área de mensagens
  observer.observe(assistantMessages.querySelector(".messages-area"), {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Fazer ajuste inicial
  adjustLayoutBasedOnContent();

  // Ajustar também quando a janela for redimensionada
  window.addEventListener("resize", adjustLayoutBasedOnContent);

  return {
    update: adjustLayoutBasedOnContent,
    disconnect: () => observer.disconnect(),
  };
}
