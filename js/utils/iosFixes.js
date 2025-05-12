// Criar este novo arquivo para correções específicas para iOS

/**
 * Correções específicas para comportamentos estranhos em iOS
 */

// Corrigir problemas com teclado virtual no iOS
function fixIOSKeyboard() {
  // Verificar se estamos em um dispositivo iOS
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (!isIOS) return;

  console.log("[iosFixes] Aplicando correções específicas para teclado iOS");

  // Altura da janela antes que o teclado seja acionado
  let windowHeight = window.innerHeight;

  // CORRIGIDO: Lidar melhor com eventos de resize em iOS
  window.addEventListener("resize", () => {
    // Se a altura atual for menor que a altura original, o teclado provavelmente está visível
    if (window.innerHeight < windowHeight) {
      console.log("[iosFixes] Teclado detectado, ajustando elementos...");
      document.body.classList.add("keyboard-visible");

      // NOVO: Corrigir posicionamento no iOS quando o teclado aparece
      const quickActions = document.querySelector(".quick-actions");
      const assistantMessages = document.getElementById("assistant-messages");

      if (quickActions) {
        quickActions.style.bottom = "100px"; // Valor maior para evitar sobreposição
      }

      if (assistantMessages) {
        assistantMessages.style.bottom = "270px"; // Garantir que não fique sob o teclado
        assistantMessages.style.maxHeight = "40vh"; // Reduzir altura para manter visibilidade
      }
    } else {
      console.log("[iosFixes] Teclado recolhido, restaurando layout");
      document.body.classList.remove("keyboard-visible");

      // Restaurar posições originais
      const quickActions = document.querySelector(".quick-actions");
      const assistantMessages = document.getElementById("assistant-messages");

      if (quickActions) {
        quickActions.style.bottom = "85px"; // Valor padrão
      }

      if (assistantMessages) {
        assistantMessages.style.bottom = ""; // Remover estilo inline
        assistantMessages.style.maxHeight = ""; // Remover estilo inline
      }

      // Restaurar o scroll para o topo
      window.scrollTo(0, 0);
    }
  });

  // Ajustar o comportamento dos campos de entrada
  document.querySelectorAll("input, textarea, select").forEach((input) => {
    // Prevenir o zoom automático
    input.style.fontSize = "16px";

    // Adicionar evento de blur para restaurar a visualização
    input.addEventListener("blur", () => {
      // Dar tempo para o teclado recolher antes de resetar o scroll
      setTimeout(() => {
        window.scrollTo(0, 0);
      }, 100);
    });
  });
}

// Adicionar classe para ajustes CSS específicos quando o teclado está visível
function setupKeyboardVisibilityTracking() {
  const inputs = document.querySelectorAll("input, textarea, select");

  inputs.forEach((input) => {
    input.addEventListener("focus", () => {
      document.documentElement.classList.add("keyboard-visible");
    });

    input.addEventListener("blur", () => {
      document.documentElement.classList.remove("keyboard-visible");
    });
  });
}

// Garante que esta função seja chamada ao iniciar a aplicação
export { fixIOSKeyboard, setupKeyboardVisibilityTracking };
