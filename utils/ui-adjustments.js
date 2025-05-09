/**
 * Ajustes finos de UI para o assistente
 */

// Corrigir a função que ajusta dimensões do container
function setupExactContainerDimensions() {
  const assistantMessages = document.getElementById("assistant-messages");

  if (!assistantMessages) return;

  // Função que ajusta as dimensões do container para corresponder exatamente ao conteúdo
  function adjustContainerSize() {
    // Resetar estilos para medir corretamente
    assistantMessages.style.width = "auto";
    assistantMessages.style.height = "auto";

    // Verificar se há alguma mensagem
    const messagesArea = assistantMessages.querySelector(".messages-area");
    if (!messagesArea) return;

    const messages = messagesArea.querySelectorAll(".message");

    if (messages.length > 0) {
      // CORREÇÃO: Calcular o tamanho total necessário incluindo todos os elementos
      let totalHeight = 0;
      let maxWidth = 0;

      messages.forEach((message) => {
        // Garantir que cada mensagem seja medida corretamente
        message.style.width = "auto";

        // Obter dimensões reais incluindo padding e margin
        const rect = message.getBoundingClientRect();
        totalHeight += rect.height + 10; // Adicionar gap entre mensagens (10px)
        maxWidth = Math.max(maxWidth, rect.width);
      });

      // Adicionar padding e espaço para o botão de minimizar
      totalHeight += 40; // 20px de padding superior + inferior
      maxWidth += 30; // 15px de padding esquerdo + direito

      // Limitar altura máxima para não exceder o viewport
      const maxHeight = window.innerHeight * 0.8;
      const finalHeight = Math.min(totalHeight, maxHeight);

      // Aplicar dimensões calculadas com valor mínimo de segurança
      assistantMessages.style.width = `${Math.max(maxWidth, 280)}px`;
      assistantMessages.style.height = `${Math.max(finalHeight, 100)}px`;

      // Adicionar overflow apenas se necessário
      if (totalHeight > maxHeight) {
        messagesArea.style.overflowY = "auto";
      } else {
        messagesArea.style.overflowY = "visible";
      }

      console.log("[UI Adjustments] Container dimensionado para conteúdo:", {
        width: maxWidth,
        height: finalHeight,
        contentHeight: totalHeight,
      });
    }
  }

  // Observer para monitorar mudanças no conteúdo
  const observer = new MutationObserver(() => {
    // Pequeno atraso para garantir que os elementos estejam renderizados
    setTimeout(adjustContainerSize, 50);
  });

  // Observar mudanças no conteúdo
  observer.observe(assistantMessages, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Ajustar quando a janela for redimensionada
  window.addEventListener("resize", adjustContainerSize);

  // Executar uma vez na inicialização
  setTimeout(adjustContainerSize, 100);

  // Executar novamente após um tempo maior para garantir que os estilos estão aplicados
  setTimeout(adjustContainerSize, 500);

  return {
    adjustNow: adjustContainerSize,
  };
}

// Limpar áreas vazias para não ocuparem espaço
function hideEmptyAreas() {
  const messagesArea = document.querySelector(
    "#assistant-messages .messages-area"
  );
  const navigationArea = document.querySelector(
    "#assistant-messages .navigation-instruction-area"
  );

  function checkAndUpdateVisibility() {
    if (messagesArea && !messagesArea.hasChildNodes()) {
      messagesArea.style.display = "none";
    } else if (messagesArea) {
      messagesArea.style.display = "flex";
    }

    if (navigationArea && !navigationArea.hasChildNodes()) {
      navigationArea.style.display = "none";
    } else if (navigationArea) {
      navigationArea.style.display = "flex";
    }
  }

  // Observer para cada área
  if (messagesArea) {
    const observer = new MutationObserver(checkAndUpdateVisibility);
    observer.observe(messagesArea, { childList: true });
  }

  if (navigationArea) {
    const observer = new MutationObserver(checkAndUpdateVisibility);
    observer.observe(navigationArea, { childList: true });
  }

  // Verificar áreas vazias imediatamente
  checkAndUpdateVisibility();
}

// Exportar funções
export { setupExactContainerDimensions, hideEmptyAreas };
