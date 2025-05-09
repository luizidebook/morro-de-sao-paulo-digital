/**
 * Sistema para evitar sobreposição de elementos de interface
 */
export function setupOverlapPrevention() {
  // Elementos principais que podem se sobrepor
  const elements = {
    assistant: { id: "assistant-messages", zIndex: 2000, priority: 2 },
    navigation: { id: "instruction-banner", zIndex: 2100, priority: 1 },
    quickActions: { className: "quick-actions", zIndex: 1900, priority: 3 },
  };

  // Verificar sobreposição e ajustar posições
  function checkOverlaps() {
    // Coletar elementos visíveis
    const visibleElements = [];

    for (const key in elements) {
      const el = elements[key];
      const domEl = el.id
        ? document.getElementById(el.id)
        : document.querySelector(`.${el.className}`);

      if (domEl && isVisible(domEl)) {
        const rect = domEl.getBoundingClientRect();
        visibleElements.push({
          key,
          element: domEl,
          rect,
          zIndex: el.zIndex,
          priority: el.priority,
        });
      }
    }

    // Verificar sobreposições entre elementos visíveis
    for (let i = 0; i < visibleElements.length; i++) {
      for (let j = i + 1; j < visibleElements.length; j++) {
        const el1 = visibleElements[i];
        const el2 = visibleElements[j];

        if (elementsOverlap(el1.rect, el2.rect)) {
          // Decidir qual elemento mover com base na prioridade
          const elementToMove = el1.priority > el2.priority ? el1 : el2;
          const fixedElement = el1.priority > el2.priority ? el2 : el1;

          // Calcular nova posição
          const newBottom = fixedElement.rect.bottom + 20; // 20px de gap
          const bottomOffset = window.innerHeight - newBottom;

          // Aplicar nova posição
          elementToMove.element.style.bottom = `${bottomOffset}px`;
          console.log(
            `[Overlap] Ajustando ${elementToMove.key} para evitar sobreposição com ${fixedElement.key}`
          );
        }
      }
    }
  }

  // Verificar se um elemento está visível
  function isVisible(element) {
    const style = window.getComputedStyle(element);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      !element.classList.contains("hidden")
    );
  }

  // Verificar se dois retângulos se sobrepõem
  function elementsOverlap(rect1, rect2) {
    return !(
      rect1.right < rect2.left ||
      rect1.left > rect2.right ||
      rect1.bottom < rect2.top ||
      rect1.top > rect2.bottom
    );
  }

  // Observer para monitorar mudanças em elementos relevantes
  const observer = new MutationObserver(() => {
    setTimeout(checkOverlaps, 50);
  });

  // Observar mudanças em todo o body (simplificado, mas pode ser otimizado)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style"],
  });

  // Verificar quando a orientação ou tamanho da tela mudar
  window.addEventListener("resize", () => {
    setTimeout(checkOverlaps, 200);
  });

  // Executar verificação inicial
  setTimeout(checkOverlaps, 500);

  // Retornar API para uso externo
  return {
    checkOverlaps,
  };
}

// Inicializar o sistema
document.addEventListener("DOMContentLoaded", () => {
  window.overlapPrevention = setupOverlapPrevention();
});
