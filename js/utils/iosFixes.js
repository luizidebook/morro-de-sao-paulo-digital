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
  // CORRIGIDO: Lidar melhor com eventos de resize em iOS
  window.addEventListener("resize", () => {
    // Se a altura atual for menor que a altura original, o teclado provavelmente está visível
    if (window.innerHeight < windowHeight) {
      console.log("[iosFixes] Teclado detectado, ajustando elementos...");
      document.body.classList.add("keyboard-visible");

      // NOVO: Corrigir posicionamento no iOS quando o teclado aparece
      const quickActions = document.querySelector(".quick-actions");
      const assistantMessages = document.getElementById("assistant-messages");
      const moodButton = document.querySelector(
        ".action-button.primary.mood-button"
      );

      if (quickActions) {
        quickActions.style.bottom = "100px"; // Valor maior para evitar sobreposição
        // ADICIONADO: Garantir que left permaneça 1px quando o teclado aparece
        quickActions.style.left = "1px";
      }

      // ADICIONADO: Garantir que o mood button mantenha left: 1px
      if (moodButton) {
        moodButton.style.left = "1px";
      }

      if (assistantMessages) {
        assistantMessages.style.bottom = "70px"; // Garantir que não fique sob o teclado
        assistantMessages.style.maxHeight = "40vh"; // Reduzir altura para manter visibilidade
      }
    } else {
      console.log("[iosFixes] Teclado recolhido, restaurando layout");
      document.body.classList.remove("keyboard-visible");

      // Restaurar posições originais
      const quickActions = document.querySelector(".quick-actions");
      const assistantMessages = document.getElementById("assistant-messages");
      const moodButton = document.querySelector(
        ".action-button.primary.mood-button"
      );

      if (quickActions) {
        quickActions.style.bottom = "85px"; // Valor padrão
        // ADICIONADO: Manter left: 1px ao restaurar layout
        quickActions.style.left = "1px";
      }

      // ADICIONADO: Garantir que o mood button mantenha left: 1px
      if (moodButton) {
        moodButton.style.left = "1px";
      }

      if (assistantMessages) {
        assistantMessages.style.bottom = ""; // Remover estilo inline
        assistantMessages.style.maxHeight = ""; // Remover estilo inline
      }

      // Restaurar o scroll para o topo
      window.scrollTo(0, 0);
    }
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
