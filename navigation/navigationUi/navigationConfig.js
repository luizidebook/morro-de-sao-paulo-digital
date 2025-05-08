export const UI_CONFIG = {
  IDS: {
    BANNER: "instruction-banner",
    INSTRUCTION_ARROW: "instruction-arrow",
    INSTRUCTION_MAIN: "instruction-main",
    INSTRUCTION_DETAILS: "instruction-details",
    INSTRUCTION_DISTANCE: "instruction-distance",
    INSTRUCTION_TIME: "instruction-time",
    MINIMIZE_BUTTON: "minimize-navigation-btn", // Garantir que o ID correto seja usado
  },
  CLASSES: {
    HIDDEN: "hidden",
    MINIMIZED: "minimized",
    HIGHLIGHT: "highlight",
    PREPARED: "prepared",
    ENTRY_ANIMATION: "entering",
    CLOSING: "closing",
    ROTATING: "rotating",
    NAVIGATION_ACTIVE: "navigation-active",
    INITIALIZING: "initializing",
  },
  ANIMATION: {
    ENTRY_DURATION: 300,
    EXIT_DURATION: 300,
    FLASH_DURATION: 600,
    INIT_DELAY: 100,
    HIGHLIGHT_DURATION: 600,
  },
  TIMING: {
    LONG_PRESS_THRESHOLD: 700,
    DOUBLE_TAP_THRESHOLD: 300,
    MINIMIZE_ANIMATION: 300,
  },
  BEHAVIOR: {
    MIN_SWIPE_VELOCITY: 0.3,
    AUTO_HIDE_DELAY: 5000,
  },
  GESTURE: {
    DRAG_START_THRESHOLD: 10,
    SWIPE_MIN_DISTANCE: 80,
    DRAG_THRESHOLD: 100,
  },
  MESSAGES: {
    CANCEL_CONFIRM: "Deseja cancelar a navegação?",
    NAVIGATION_CANCELED: "Navegação cancelada",
    MINIMIZE_ARIA: "Minimizar instruções de navegação",
    EXPAND_ARIA: "Expandir instruções de navegação",
  },
};
