import { getGeneralText } from "../../i18n/translatePageContent.js";

/**
 * Mapeamento de tipos de instruções para ícones
 */
export const DIRECTION_ICONS = {
  // Tipos padrão de instruções
  0: { name: "head", icon: "↑", description: "Siga em frente" },
  1: { name: "continue", icon: "↑", description: "Continue em frente" },
  2: {
    name: "turn_slight_right",
    icon: "↗",
    description: "Vire levemente à direita",
  },
  3: { name: "turn_right", icon: "→", description: "Vire à direita" },
  4: {
    name: "turn_sharp_right",
    icon: "↘",
    description: "Vire fortemente à direita",
  },
  5: { name: "uturn", icon: "↓", description: "Faça o retorno" },
  6: {
    name: "turn_sharp_left",
    icon: "↙",
    description: "Vire fortemente à esquerda",
  },
  7: { name: "turn_left", icon: "←", description: "Vire à esquerda" },
  8: {
    name: "turn_slight_left",
    icon: "↖",
    description: "Vire levemente à esquerda",
  },
  9: { name: "roundabout", icon: "↻", description: "Entre na rotatória" },
  10: { name: "exit_roundabout", icon: "⇢", description: "Saia da rotatória" },
  11: { name: "arrive", icon: "⚑", description: "Chegue ao destino" },

  // Tipos extras para situações especiais
  12: { name: "elevator", icon: "↕", description: "Use o elevador" },
  13: { name: "stairs", icon: "⟰", description: "Use as escadas" },
  14: { name: "ramp", icon: "⟰", description: "Use a rampa" },
  15: { name: "fork", icon: "⑂", description: "Bifurcação" },
  16: { name: "merge", icon: "⑃", description: "Junção" },
  17: { name: "offroute", icon: "⚠", description: "Fora da rota" },
};

/**
 * Retorna o ícone correspondente ao tipo de direção
 * @param {number|string} typeOrKey - O tipo de direção conforme API ou a chave textual
 * @returns {string} - O ícone correspondente
 */
export function getDirectionIcon(typeOrKey) {
  // Compatibilidade com chamadas existentes - usando mapeamento emoji
  if (typeof typeOrKey === "number" || !isNaN(Number(typeOrKey))) {
    const numericType = Number(typeOrKey);

    // Mapeamento de tipos numéricos para chaves textuais
    const numericTypeMap = {
      0: "head_north",
      1: "continue_straight",
      2: "turn_slight_right",
      3: "turn_right",
      4: "turn_sharp_right",
      5: "u_turn",
      6: "turn_sharp_left",
      7: "turn_left",
      8: "turn_slight_left",
      9: "enter_roundabout",
      10: "exit_roundabout",
      11: "arrive_destination",
    };

    // Ícones por chave textual
    const iconMap = {
      head_north: "⬆️",
      head_south: "⬇️",
      head_east: "➡️",
      head_west: "⬅️",
      turn_left: "⬅️",
      turn_right: "➡️",
      turn_sharp_left: "↰",
      turn_sharp_right: "↱",
      turn_slight_left: "↲",
      turn_slight_right: "↳",
      continue_straight: "⬆️",
      keep_left: "↰",
      keep_right: "↱",
      u_turn: "↩️",
      enter_roundabout: "🔄",
      exit_roundabout: "🔄",
      ferry: "⛴️",
      arrive_destination: "🏁",
    };

    const maneuverKey = numericTypeMap[numericType] || "continue_straight";

    // Retornar emoji correspondente para compatibilidade
    if (iconMap[maneuverKey]) {
      return iconMap[maneuverKey];
    }

    // Versão simples caso emoji não encontrado
    return DIRECTION_ICONS[numericType]?.icon || "•";
  }

  // Caso seja uma string direta
  if (typeof typeOrKey === "string") {
    // Adicionar mapeamento para "straight" -> corresponde a 0/1 (continue/head)
    if (typeOrKey === "straight") {
      return "⬆️"; // Mesmo ícone usado para "continue straight"
    }

    // Verificar strings para formatos especiais
    if (typeOrKey.startsWith("exit_roundabout_")) {
      const exitNum = typeOrKey.replace("exit_roundabout_", "");
      return `🔄${exitNum}`;
    }

    // Mapeamento reverso para encontrar o tipo numérico a partir de string
    for (const [key, value] of Object.entries(DIRECTION_ICONS)) {
      if (value.name === typeOrKey) {
        return value.icon;
      }
    }
  }

  // Valor padrão
  console.warn(`[getDirectionIcon] Manobra não reconhecida: "${typeOrKey}"`);
  return "⬆️";
}

/**
 * Retorna informações completas sobre um tipo de instrução
 * @param {number} type - Código do tipo de instrução
 * @returns {Object} Informações do tipo (nome, ícone, descrição)
 */
export function getDirectionInfo(type) {
  return (
    DIRECTION_ICONS[type] || {
      name: "unknown",
      icon: "•",
      description: "Instrução desconhecida",
    }
  );
}

/**
 * Retorna classe CSS para estilizar um tipo de instrução
 * @param {number} type - Código do tipo de instrução
 * @returns {string} Nome da classe CSS
 */
export function getDirectionClass(type) {
  const info = DIRECTION_ICONS[type];
  return info ? `direction-${info.name}` : "direction-unknown";
}

/**
 * Retorna a descrição de um tipo de instrução
 * @param {number} type - Código do tipo de instrução
 * @param {string} lang - Código do idioma
 * @returns {string} Descrição da instrução
 */
export function getDirectionDescription(type, lang = "pt") {
  const info = DIRECTION_ICONS[type];
  if (!info) return "Instrução desconhecida";

  // No futuro, poderia retornar descrições traduzidas com base no idioma
  return info.description;
}

/**
 * Retorna o ícone para representar a chegada ao destino
 * @param {string} destinationType - Tipo de destino
 * @returns {string} Ícone de chegada
 */
export function getArrivalIcon(destinationType = "default") {
  const arrivalIcons = {
    default: "⚑",
    restaurant: "🍽️",
    hotel: "🏨",
    beach: "🏖️",
    park: "🏞️",
    museum: "🏛️",
    shopping: "🛍️",
    airport: "✈️",
    bus_station: "🚏",
    train_station: "🚉",
    attraction: "🎯",
    landmark: "🗿",
  };

  return arrivalIcons[destinationType] || arrivalIcons.default;
}

/**
 * Converte um ângulo (bearing) em uma instrução de direção
 * @param {number} angle - Ângulo em graus (0-360)
 * @returns {number} Código do tipo de direção
 */
export function angleToDirectionType(angle) {
  // Normalizar ângulo
  const normalizedAngle = ((angle % 360) + 360) % 360;

  // Converter para tipo de direção
  if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) {
    return 0; // Norte / Frente
  } else if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) {
    return 2; // Nordeste / Leve direita
  } else if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) {
    return 3; // Leste / Direita
  } else if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) {
    return 4; // Sudeste / Forte direita
  } else if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) {
    return 5; // Sul / Retorno
  } else if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) {
    return 6; // Sudoeste / Forte esquerda
  } else if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) {
    return 7; // Oeste / Esquerda
  } else {
    return 8; // Noroeste / Leve esquerda
  }
}

/**
 * Cria a mensagem para uma instrução
 * @param {Object} step - Objeto com dados da instrução
 * @param {string} lang - Código do idioma
 * @returns {string} - Mensagem formatada
 */
export function buildInstructionMessage(step, lang = "pt") {
  if (!step) return "";

  // Mapeamento de tipos numéricos para chaves de tradução
  const typeMap = {
    0: "head",
    1: "continue",
    2: "turn_slight_right",
    3: "turn_right",
    4: "turn_sharp_right",
    5: "uturn",
    6: "turn_sharp_left",
    7: "turn_left",
    8: "turn_slight_left",
    9: "roundabout",
    10: "roundabout_exit",
    11: "arrive",
  };

  // Obter tipo como número
  const type =
    typeof step.type === "number"
      ? step.type
      : typeof step.type === "string"
      ? parseInt(step.type, 10)
      : 0;

  // Obter a chave de tradução correspondente
  const key = typeMap[type] || "continue";

  // Nome da rua ou local
  const street = step.streetName || step.name || "";

  // Construir a mensagem baseada no tipo e se tem nome de rua
  let message = "";

  if (key === "arrive" && street) {
    message = getGeneralText(`${key}_on`, lang).replace("{street}", street);
  } else if (street) {
    message = getGeneralText(`${key}_on`, lang).replace("{street}", street);
  } else {
    message = getGeneralText(key, lang);
  }

  // Adicionar distância, se disponível e não for o destino final
  if (step.distance && key !== "arrive") {
    message += ` e siga em frente por ${Math.round(step.distance)} metros.`;
  }

  return message;
}
