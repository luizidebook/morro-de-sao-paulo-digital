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
    quickActions.style.left = "10px";

    // Posição fixa acima da área de input
    quickActions.style.bottom = "85px";

    // Em telas pequenas, ajustar
    if (window.innerWidth <= 480) {
      quickActions.style.left = "5px";
      quickActions.style.bottom = "75px";
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
  quickActions.style.bottom = window.innerWidth <= 480 ? "75px" : "85px";
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
      quickActions.style.bottom = "85px";

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

export { updateQuickActionsPosition, fixIOSPositioning };
