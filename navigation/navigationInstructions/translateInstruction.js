import { getGeneralText } from "../../i18n/translatePageContent.js";

export default {
  // Navegação - comandos básicos
  walk_on: "Caminhe na",
  for: "por",
  navigation_turn_left: "Vire à esquerda",
  navigation_turn_right: "Vire à direita",
  navigation_turn_slight_left: "Faça uma curva leve à esquerda",
  navigation_turn_slight_right: "Faça uma curva leve à direita",
  navigation_turn_sharp_left: "Faça uma curva fechada à esquerda",
  navigation_turn_sharp_right: "Faça uma curva fechada à direita",
  navigation_continue: "Continue em frente",
  navigation_continue_straight: "Siga em frente",
  navigation_arrived: "Chegou ao destino",
  navigation_arrive_destination: "Chegou ao seu destino",
  navigation_head: "Siga",
  navigation_onto: "para",
  navigation_on_right: "à direita",
  navigation_on_left: "à esquerda",

  // Direções cardeais
  direction_north: "norte",
  direction_south: "sul",
  direction_east: "leste",
  direction_west: "oeste",
  direction_northeast: "nordeste",
  direction_northwest: "noroeste",
  direction_southeast: "sudeste",
  direction_southwest: "sudoeste",

  // Mensagens do sistema
  calculating_route: "Calculando rota...",
  route_error: "Erro ao calcular rota",
  location_error: "Erro de localização",
  navigation_stop: "Navegação finalizada",
  navigation_recalculating: "Recalculando rota...",
  please_wait: "Aguarde um momento...",
  routeDeviated: "Você se afastou da rota",
  routeCreated: "Rota criada",
  routeRecalculatedOk: "Rota recalculada com sucesso",
  route_not_found: "Rota não encontrada",
  cant_calculate_route: "Não foi possível calcular uma nova rota",
  noInstructions: "Sem instruções de navegação",
};

// Mapeamento de traduções para direções
export const directionTranslations = {
  pt: {
    "on the right": "à direita",
    "on the left": "à esquerda",
    "Turn left": "Vire à esquerda",
    "Turn right": "Vire à direita",
    "Turn slight left": "Faça uma leve curva à esquerda",
    "Turn slight right": "Faça uma leve curva à direita",
    "Turn sharp left": "Faça uma curva acentuada à esquerda",
    "Turn sharp right": "Faça uma curva acentuada à direita",
    "Continue straight": "Continue em frente",
    Head: "Siga",
    "Head north": "Siga para o norte",
    "Head south": "Siga para o sul",
    "Head east": "Siga para o leste",
    "Head west": "Siga para o oeste",
    "Head northeast": "Siga para o nordeste",
    "Head northwest": "Siga para o noroeste",
    "Head southeast": "Siga para o sudeste",
    "Head southwest": "Siga para o sudoeste",
    onto: "para",
    "Arrive at your destination": "Chegou ao seu destino",
    destination: "destino",
    northeast: "nordeste",
    southeast: "sudeste",
    northwest: "noroeste",
    southwest: "sudoeste",
    north: "norte",
    south: "sul",
    east: "leste",
    west: "oeste",
  },
  en: {
    // Valores padrão (inglês)
  },
  es: {
    "on the right": "a la derecha",
    "on the left": "a la izquierda",
  },
  he: {
    "on the right": "מימין",
    "on the left": "משמאל",
  },
};

// Constantes para padrões de instruções com referência a ruas
const STREET_PATTERNS = {
  ONTO: " onto ",
  ON: " on ",
  TO: " to ",
  FOR: " for ",
  ALONG: " along ",
};

/**
 * Obtém a tradução de uma instrução de navegação preservando nomes de ruas
 *
 * @param {string} instruction - Instrução original em inglês
 * @param {string} language - Código do idioma (pt, en, etc.)
 * @param {Object} options - Opções de configuração adicionais
 * @returns {string} - Instrução traduzida com nome de rua preservado
 */
export function getGeneralInstruction(
  instruction,
  language = "pt",
  options = {}
) {
  // Verificações básicas
  if (!instruction) return "";
  if (language === "en") return instruction;

  try {
    console.log(
      `[getGeneralInstruction] Processando: "${instruction}" para ${language}`
    );

    // Extrair partes da instrução
    const parts = extractInstructionParts(instruction);

    // Se não tem nome de rua, simplificar o processo
    if (!parts.streetName) {
      return getActionTranslation(parts.action, language);
    }

    // Traduzir apenas a ação
    const translatedAction = getActionTranslation(parts.action, language);

    // Traduzir a preposição que conecta à rua
    const translatedConnector = getConnectorTranslation(
      parts.connector,
      language
    );

    // Reconstruir a instrução preservando o nome da rua
    const result = `${translatedAction}${translatedConnector}${parts.streetName}`;

    console.log(`[getGeneralInstruction] Resultado: "${result}"`);
    return result;
  } catch (error) {
    console.warn(`[getGeneralInstruction] Erro: ${error.message}`);

    // Em caso de erro, retornar instrução original
    return instruction;
  }
}

/**
 * Extrai as diferentes partes de uma instrução de navegação
 * @param {string} instruction - Instrução completa
 * @returns {Object} - Partes da instrução {action, connector, streetName}
 */
function extractInstructionParts(instruction) {
  // Verificar cada padrão de separação para nome de rua
  for (const [patternName, separator] of Object.entries(STREET_PATTERNS)) {
    if (instruction.includes(separator)) {
      const [action, streetName] = instruction.split(separator);
      return {
        action: action.trim(),
        connector: separator.trim(),
        streetName: streetName.trim(),
      };
    }
  }

  // Se nenhum padrão for encontrado, toda a instrução é considerada ação
  return {
    action: instruction,
    connector: null,
    streetName: null,
  };
}

/**
 * Obtém a tradução para a parte de ação da instrução
 * @param {string} action - Parte da instrução que contém a ação
 * @param {string} language - Código do idioma
 * @returns {string} - Ação traduzida
 */
function getActionTranslation(action, language) {
  // 1. Tentar obter tradução exata da ação completa
  const normalizedKey = `navigation_${action
    .toLowerCase()
    .replace(/\s+/g, "_")}`;
  const exactTranslation = getGeneralText(normalizedKey, language);

  if (exactTranslation && exactTranslation !== normalizedKey) {
    return exactTranslation;
  }

  // 2. Verificar padrões comuns de navegação
  const actionPatterns = [
    { pattern: "Turn left", key: "navigation_turn_left" },
    { pattern: "Turn right", key: "navigation_turn_right" },
    { pattern: "Turn slight left", key: "navigation_turn_slight_left" },
    { pattern: "Turn slight right", key: "navigation_turn_slight_right" },
    { pattern: "Turn sharp left", key: "navigation_turn_sharp_left" },
    { pattern: "Turn sharp right", key: "navigation_turn_sharp_right" },
    { pattern: "Continue straight", key: "navigation_continue_straight" },
    { pattern: "Head", key: "navigation_head" },
    {
      pattern: "Arrive at your destination",
      key: "navigation_arrive_destination",
    },
  ];

  for (const { pattern, key } of actionPatterns) {
    if (action.includes(pattern)) {
      const translation = getGeneralText(key, language);
      if (translation && translation !== key) {
        // Substituir apenas o padrão específico
        return action.replace(pattern, translation);
      }
    }
  }

  // 3. Traduzir direções cardeais
  let result = action;
  const directions = [
    "north",
    "south",
    "east",
    "west",
    "northeast",
    "northwest",
    "southeast",
    "southwest",
  ];

  directions.forEach((dir) => {
    if (result.toLowerCase().includes(dir)) {
      const directionKey = `direction_${dir}`;
      const translatedDir =
        getGeneralText(directionKey, language) ||
        directionTranslations[language]?.[dir] ||
        dir;

      result = result.replace(new RegExp(`\\b${dir}\\b`, "gi"), translatedDir);
    }
  });

  // 4. Verificar se houve alteração
  if (result !== action) {
    return result;
  }

  // 5. Usar o dicionário de traduções como último recurso
  if (directionTranslations[language]) {
    for (const [pattern, translation] of Object.entries(
      directionTranslations[language]
    )) {
      if (action.includes(pattern)) {
        return action.replace(pattern, translation);
      }
    }
  }

  // Se nada funcionou, retornar a ação original
  return action;
}

/**
 * Traduz o conector entre a ação e o nome da rua
 * @param {string} connector - Preposição de conexão (onto, on, etc.)
 * @param {string} language - Código do idioma
 * @returns {string} - Conector traduzido
 */
function getConnectorTranslation(connector, language) {
  if (!connector) return " ";

  const connectorMap = {
    onto: "navigation_onto",
    on: "navigation_on",
    to: "navigation_to",
    for: "navigation_for",
    along: "navigation_along",
  };

  // Remover espaços para obter só a preposição
  const cleanConnector = connector.trim();

  if (connectorMap[cleanConnector]) {
    const translated =
      getGeneralText(connectorMap[cleanConnector], language) ||
      directionTranslations[language]?.[cleanConnector] ||
      cleanConnector;

    return ` ${translated} `; // Adicionar espaços para separação
  }

  return ` ${connector} `; // Manter o conector original com espaços
}

/**
 * Traduz uma instrução de navegação usando o dicionário local
 * @param {string} instruction - Instrução original em inglês
 * @param {string} language - Código do idioma alvo
 * @returns {string} - Instrução traduzida
 */
export function translateInstructionWithDictionary(instruction, language) {
  if (!instruction) return "";
  if (language === "en") return instruction;

  const lowerInstruction = instruction.toLowerCase();

  // 1. Procurar por padrões completos primeiro
  try {
    const translationKey = `navigation_${lowerInstruction.replace(
      /\s+/g,
      "_"
    )}`;
    const translation = getGeneralText(translationKey, language);

    // Se encontrou uma tradução exata, retornar
    if (translation && translation !== translationKey) {
      return translation;
    }
  } catch (err) {
    console.warn(
      "[translateInstructionWithDictionary] Erro ao tentar tradução exata:",
      err
    );
  }

  // 2. Tentar traduzir por partes com o dicionário directionTranslations
  try {
    if (!directionTranslations[language]) {
      return instruction;
    }

    let translatedText = instruction;

    // Aplicar traduções do dicionário
    Object.entries(directionTranslations[language]).forEach(
      ([source, target]) => {
        const regex = new RegExp(`\\b${source}\\b`, "gi");
        translatedText = translatedText.replace(regex, target);
      }
    );

    // Verificar se houve alteração
    if (translatedText !== instruction) {
      return translatedText;
    }
  } catch (err) {
    console.warn(
      "[translateInstructionWithDictionary] Erro ao traduzir com dicionário:",
      err
    );
  }

  // 3. Traduzir partes específicas da instrução
  try {
    // Extrair componentes da instrução
    let resultText = instruction;

    // Processar direções cardeais
    const directions = [
      "north",
      "south",
      "east",
      "west",
      "northeast",
      "northwest",
      "southeast",
      "southwest",
    ];
    directions.forEach((dir) => {
      const regexDir = new RegExp(`\\b${dir}\\b`, "gi");

      if (regexDir.test(resultText)) {
        const translatedDir =
          getGeneralText(`direction_${dir}`, language) ||
          directionTranslations[language]?.[dir] ||
          dir;
        resultText = resultText.replace(regexDir, translatedDir);
      }
    });

    // Processar comandos comuns
    const commands = {
      Turn_left: "turn_left",
      Turn_right: "turn_right",
      Turn_slight_left: "turn_slight_left",
      Turn_slight_right: "turn_slight_right",
      Turn_sharp_left: "turn_sharp_left",
      Turn_sharp_right: "turn_sharp_right",
      Continue_straight: "continue_straight",
      Head: "head",
      Arrive_at_your_destination: "arrive_destination",
      on_the_right: "on_right",
      on_the_left: "on_left",
    };

    Object.entries(commands).forEach(([phrase, key]) => {
      const regexPhrase = new RegExp(`\\b${phrase}\\b`, "gi");

      if (regexPhrase.test(resultText)) {
        const translatedPhrase =
          getGeneralText(`navigation_${key}`, language) ||
          directionTranslations[language]?.[phrase] ||
          phrase;
        resultText = resultText.replace(regexPhrase, translatedPhrase);
      }
    });

    // Processar a palavra "onto"
    if (resultText.includes(" onto ")) {
      const ontoText =
        getGeneralText("navigation_onto", language) ||
        directionTranslations[language]?.["onto"] ||
        "onto";

      resultText = resultText.replace(" onto ", ` ${ontoText} `);
    }

    // Se houve alteração, retornar o texto modificado
    if (resultText !== instruction) {
      return resultText;
    }
  } catch (err) {
    console.warn(
      "[translateInstructionWithDictionary] Erro ao traduzir componentes:",
      err
    );
  }

  // 4. Se nada funcionou, tentar uma tradução genérica baseada no tipo
  try {
    if (lowerInstruction.includes("turn left")) {
      return (
        getGeneralText("navigation_turn_left", language) || "Vire à esquerda"
      );
    } else if (lowerInstruction.includes("turn right")) {
      return (
        getGeneralText("navigation_turn_right", language) || "Vire à direita"
      );
    } else if (
      lowerInstruction.includes("head") ||
      lowerInstruction.includes("continue")
    ) {
      return (
        getGeneralText("navigation_continue", language) || "Siga em frente"
      );
    } else if (
      lowerInstruction.includes("arrive") ||
      lowerInstruction.includes("destination")
    ) {
      return (
        getGeneralText("navigation_arrived", language) || "Chegou ao destino"
      );
    }
  } catch (err) {
    console.warn(
      "[translateInstructionWithDictionary] Erro na tradução genérica:",
      err
    );
  }

  // Se nada funcionou, retornar a instrução original
  return instruction;
}
