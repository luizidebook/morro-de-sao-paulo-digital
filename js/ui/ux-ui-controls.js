//  ux-ui-controls.js – Exibição e controle dinâmico de botões na interface

let activeControls = [];

/**
 * Exibe um conjunto de botões específicos baseado na categoria ou ação.
 * @param {Array<{ id: string, label: string, onClick: Function }>} buttons
 */
export function showControlButtonsX(buttons = []) {
  const container = document.getElementById("buttonGroup");
  if (!container) return console.warn("Elemento #buttonGroup não encontrado.");

  clearControlButtons();

  buttons.forEach((btnData) => {
    const button = document.createElement("button");
    button.id = btnData.id;
    button.textContent = btnData.label;
    button.classList.add("control-button");

    button.addEventListener("click", btnData.onClick);
    container.appendChild(button);
    activeControls.push(button);
  });

  container.classList.remove("hidden");
}

/**
 * Oculta todos os botões do painel de controle.
 */
export function hideAllControlButtons() {
  const container = document.getElementById("buttonGroup");
  if (container) {
    container.innerHTML = "";
    container.classList.add("hidden");
  }
  activeControls = [];
}

/**
 * Limpa todos os botões adicionados dinamicamente.
 */
function clearControlButtons() {
  activeControls.forEach((btn) => btn.remove());
  activeControls = [];
}
