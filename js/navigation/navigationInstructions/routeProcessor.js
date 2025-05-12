/**
 * Módulo de processamento de rotas com tradução online
 * Responsável pelo processamento de instruções de navegação,
 * tradução automática via API, e formatação das instruções.
 */

// Importações de core
import {
  navigationState,
  selectedLanguage,
} from "../navigationState/navigationStateManager.js";
import { getGeneralText } from "../../i18n/translatePageContent.js";

import {
  getDirectionIcon,
  buildInstructionMessage,
} from "../navigationUtils/navigationIcons.js";
import { showNotification } from "../../utils/notifications.js";
import { startPositionTracking } from "../navigationUserLocation/user-location.js";
import {
  translateInstructionWithDictionary,
  directionTranslations,
} from "./translateInstruction.js";

// Cache para traduções já realizadas - reduz chamadas de API repetidas
const translationCache = new Map();

// Variável para controlar recálculo simultâneo
let recalculationInProgress = false;

// Exportar a variável para uso em outros módulos
export { recalculationInProgress };

// Adicione no topo do arquivo routeProcessor.js (após as importações)

// Adicionar traduções específicas no dicionário para direções cardeais
directionTranslations.pt = {
  ...directionTranslations.pt,
  northeast: "nordeste",
  southeast: "sudeste",
  northwest: "noroeste",
  southwest: "sudoeste",
  north: "norte",
  east: "leste",
  west: "oeste",
  south: "sul",
};

// Adicione no início do arquivo, após as importações
let lastRouteData = null; // Armazenar dados da última rota calculada

/**
 * Armazena os dados da última rota calculada
 * @param {Object} routeData - Dados da rota
 * @returns {Object} - Os mesmos dados da rota
 */
export function setLastRouteData(routeData) {
  lastRouteData = routeData;
  console.log("[routeProcessor] Dados da última rota armazenados:", {
    timestamp: new Date().toISOString(),
    routeId: routeData?.metadata?.uuid || "desconhecido",
    passos:
      routeData?.features?.[0]?.properties?.segments?.[0]?.steps?.length || 0,
  });
  return routeData;
}

/**
 * Recupera os dados da última rota calculada
 * @returns {Object|null} - Dados da última rota ou null
 */
export function getLastRouteData() {
  return lastRouteData;
}
// No processamento da rota, garantir uma estrutura consistente
async function processRouteData(routeData) {
  if (!routeData || !routeData.features || routeData.features.length === 0) {
    console.error("[processRouteData] Dados de rota inválidos");
    return null;
  }

  try {
    // Extrair primeiro feature que contém a rota
    const routeFeature = routeData.features[0];
    const routeGeometry = routeFeature?.geometry;
    const routeProperties = routeFeature?.properties;

    if (!routeGeometry || !routeProperties) {
      console.error("[processRouteData] Geometria ou propriedades ausentes");
      return null;
    }

    // Extrair segmentos e passos
    const segments = routeProperties.segments || [];
    if (segments.length === 0) {
      console.warn("[processRouteData] Sem segmentos na rota");
      return null;
    }

    const rawSteps = segments[0]?.steps || [];
    if (rawSteps.length === 0) {
      console.warn("[processRouteData] Sem passos no primeiro segmento");
      return null;
    }

    // Normalizar os passos para formato consistente
    const processedSteps = rawSteps.map((step, index) => {
      // Extrair coordenadas do passo
      let stepLat, stepLon;

      // Extrair do way_points, se existir
      if (
        step.way_points &&
        Array.isArray(step.way_points) &&
        step.way_points.length >= 2
      ) {
        const wayPointIndex = step.way_points[0]; // Início do segmento
        const coordinates = routeGeometry.coordinates?.[wayPointIndex];

        if (
          coordinates &&
          Array.isArray(coordinates) &&
          coordinates.length >= 2
        ) {
          // Coordenadas em GeoJSON são [lon, lat]
          stepLon = coordinates[0];
          stepLat = coordinates[1];
        }
      }

      // Objeto normalizado
      return {
        original: step.instruction,
        instruction: step.instruction,
        distance: step.distance,
        duration: step.duration,
        type: step.type,
        name: step.name || "",

        // Coordenadas normalizadas
        lat: stepLat,
        lon: stepLon,
        latitude: stepLat,
        longitude: stepLon,

        // Métodos são adicionados na etapa de processamento
        formattedDistance: formatDistance(step.distance),
        formattedTime: formatDuration(step.duration),

        // Índice para referência
        index,
        isLastStep: index === rawSteps.length - 1,
      };
    });

    return {
      steps: processedSteps,
      totalDistance: routeProperties.summary?.distance || 0,
      totalDuration: routeProperties.summary?.duration || 0,
    };
  } catch (error) {
    console.error("[processRouteData] Erro ao processar dados:", error);
    return null;
  }
}
/**
 * Processa as instruções de uma rota, traduzindo e formatando dados para exibição
 * @param {Object|Array} route - Dados da rota da API ou array de steps
 * @param {string|Object} lang - Código do idioma para tradução
 * @returns {Array} - Instruções processadas
 */
export function processRouteInstructions(route, lang = "pt") {
  try {
    console.log(
      "[processRouteInstructions] Convertendo idioma de objeto para string:",
      lang
    );

    // Garantir que lang seja uma string
    const language = typeof lang === "object" ? lang.code || "pt" : lang;

    // Verificar se temos dados de rota válidos
    if (
      !route ||
      !route.features ||
      !route.features[0] ||
      !route.features[0].properties
    ) {
      console.error(
        "[processRouteInstructions] Dados da rota inválidos:",
        route
      );
      return [];
    }

    const segments = route.features[0].properties.segments;
    if (!segments || !segments.length) {
      console.error("[processRouteInstructions] Sem segmentos na rota:", route);
      return [];
    }

    const steps = segments[0].steps;
    if (!steps || !steps.length) {
      console.error(
        "[processRouteInstructions] Sem passos no segmento:",
        segments[0]
      );
      return [];
    }

    console.log(
      "[processRouteInstructions] Processando " +
        steps.length +
        " instruções para idioma: " +
        language
    );

    // Armazenar dados da rota para uso posterior
    setLastRouteData(route);

    const processedSteps = steps.map((step, index) => {
      console.log(
        "[processRouteInstructions] Instrução original:",
        step.instruction
      );

      // Extrair o nome da rua quando presente
      let streetName = "-";
      if (step.instruction && step.instruction.includes(" onto ")) {
        streetName = step.instruction.split(" onto ")[1];
        console.log(
          "[processRouteInstructions] Nome da rua extraído:",
          streetName
        );
      }

      // Traduzir a instrução usando o sistema de tradução local
      const translatedInstruction = translateInstructionWithDictionary(
        step.instruction,
        language
      );

      // Determinar tipo da instrução
      const instructionType = getInstructionType(step.instruction);

      // Formatar distância e duração
      const formattedDistance = formatDistanceSync(step.distance || 0);
      const formattedDuration = formatTimeSync(step.duration || 0);

      return {
        original: step.instruction,
        translated: translatedInstruction,
        distance: step.distance,
        duration: step.duration,
        formattedDistance: formattedDistance,
        formattedTime: `Caminhar por ${formattedDuration}`,
        name: step.name || streetName,
        streetName: streetName, // Adicionar explicitamente para consistência
        type: instructionType,
        isLast: index === steps.length - 1,
        position: step.way_points
          ? [
              route.features[0].geometry.coordinates[step.way_points[0]],
              route.features[0].geometry.coordinates[step.way_points[1]],
            ]
          : null,
        index: index + 1,

        // Campos adicionais para UI
        simplifiedInstruction: simplifyInstruction(
          step.instruction,
          instructionType
        ),
      };
    });

    console.log(
      "[processRouteInstructions] Instruções processadas com sucesso:",
      processedSteps.length
    );

    // Adicionar as instruções processadas à rota para reutilização
    route._processedSteps = processedSteps;
    return processedSteps;
  } catch (error) {
    console.error(
      "[processRouteInstructions] Erro no processamento de instruções:",
      error
    );
    return [];
  }
}

/**
 * Processa uma instrução de rota individual e prepara para exibição
 * @param {Object} step - Passo de navegação da API
 * @param {number} index - Índice do passo na sequência
 * @param {Array} rawSteps - Array completo de passos
 * @param {string} lang - Código do idioma
 * @returns {Object} - Instrução processada pronta para exibição
 */
export function processRouteInstruction(step, index, rawSteps, lang = "pt") {
  try {
    // 1. Extrair dados básicos da etapa
    const originalInstruction = step.instruction || "";
    let position = null;

    // 2. Tentar extrair coordenadas se disponíveis
    if (step.waypoints && step.waypoints.length > 0) {
      position = step.waypoints[0].location || null;
    } else if (step.location) {
      position = step.location;
    }

    // 3. Processar direção (esquerda/direita)
    const hasLeft = originalInstruction.toLowerCase().includes("left");
    const hasRight = originalInstruction.toLowerCase().includes("right");

    // 4. Formatar distância e tempo
    const formattedDistance = formatDistanceSync(step.distance || 0);
    const formattedTime = `Caminhar por ${formatTimeSync(step.duration || 0)}`;

    // 5. Extrair nome da rua (crucial para o banner)
    let streetName = null;
    console.log(
      "[processRouteInstructions] Instrução original:",
      originalInstruction
    );

    // Procurar nome da rua no formato "... onto Street Name"
    if (originalInstruction.includes(" onto ")) {
      streetName = originalInstruction.split(" onto ")[1].trim();
      console.log(
        "[processRouteInstructions] Nome da rua extraído:",
        streetName
      );
    } else if (step.name && step.name !== "-") {
      streetName = step.name;
    }

    // 6. Determinar tipo de instrução
    let stepType = 0; // Padrão: Seguir em frente

    if (hasRight) {
      if (originalInstruction.includes("slight")) stepType = 2;
      else if (originalInstruction.includes("sharp")) stepType = 4;
      else stepType = 3;
    } else if (hasLeft) {
      if (originalInstruction.includes("slight")) stepType = 8;
      else if (originalInstruction.includes("sharp")) stepType = 6;
      else stepType = 7;
    } else if (
      originalInstruction.includes("uturn") ||
      originalInstruction.includes("u-turn")
    ) {
      stepType = 5;
    } else if (
      originalInstruction.includes("arrive") ||
      originalInstruction.includes("destination")
    ) {
      stepType = 11;
    }

    // 7. Criar objeto de instrução enriquecido para UI
    const instructionObject = {
      original: originalInstruction,
      translated: originalInstruction, // Tradução será feita posteriormente se necessário
      distance: step.distance || 0,
      duration: step.duration || 0,
      formattedDistance: formattedDistance,
      formattedTime: formattedTime,
      name: step.name || "-",
      streetName: streetName || null,
      type: stepType,
      isLast: index === rawSteps.length - 1,
      position: position,
      index: index + 1,

      // Informações adicionais para UI
      maneuver: stepType,
      instruction: originalInstruction,
      simplifiedInstruction: simplifyInstruction(originalInstruction, stepType),
    };

    return instructionObject;
  } catch (error) {
    console.error(
      `[processRouteInstruction] Erro ao processar passo ${index}:`,
      error
    );
    // Retornar objeto mínimo para evitar falhas em cascata
    return {
      original: step.instruction || "Erro na instrução",
      translated: step.instruction || "Erro na instrução",
      distance: step.distance || 0,
      duration: step.duration || 0,
      formattedDistance: "0 m",
      formattedTime: "0 s",
      name: "-",
      streetName: null,
      type: "unknown",
      isLast: false,
      index: index + 1,
      position: null,

      // Informações adicionais para UI
      maneuver: 0,
      instruction: step.instruction || "Erro na instrução",
      simplifiedInstruction: "Siga em frente",
    };
  }
}

/**
 * Simplifica uma instrução de navegação para um formato básico
 * @param {string} instruction - Instrução completa original
 * @param {number|string} type - Tipo de manobra
 * @returns {string} - Instrução simplificada
 */
export function simplifyInstruction(instruction, type) {
  // Verificar pelo tipo numérico
  switch (type) {
    case 0:
    case 1:
      return "Siga em frente";
    case 2:
      return "Curva leve à direita";
    case 3:
      return "Vire à direita";
    case 4:
      return "Curva acentuada à direita";
    case 5:
      return "Faça o retorno";
    case 6:
      return "Curva acentuada à esquerda";
    case 7:
      return "Vire à esquerda";
    case 8:
      return "Curva leve à esquerda";
    case 10:
    case 11:
    case 12:
      return "Chegou ao destino";
  }

  // Se não conseguir determinar pelo tipo, tentar analisar o texto
  const lowerText = instruction.toLowerCase();

  if (lowerText.includes("head") || lowerText.includes("continue"))
    return "Siga em frente";
  if (lowerText.includes("left")) return "Vire à esquerda";
  if (lowerText.includes("right")) return "Vire à direita";
  if (lowerText.includes("arrive") || lowerText.includes("destination"))
    return "Chegou ao destino";
  if (lowerText.includes("slight left")) return "Curva leve à esquerda";
  if (lowerText.includes("slight right")) return "Curva leve à direita";
  if (lowerText.includes("sharp left")) return "Curva acentuada à esquerda";
  if (lowerText.includes("sharp right")) return "Curva acentuada à direita";

  // Valor padrão
  return "Siga em frente";
}

/**
 * Formata uma distância em metros para exibição
 * @param {number} distance - Distância em metros
 * @returns {string} - Distância formatada
 */
function formatDistanceSync(distance) {
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1)} km`;
  }
  return `${Math.round(distance)} m`;
}

/**
 * Formata tempo em segundos para representação legível
 * @param {number} seconds - Tempo em segundos
 * @returns {string} - Tempo formatado
 */
function formatTimeSync(seconds) {
  if (seconds < 60) {
    return `${Math.round(seconds)} s`;
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)} min`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours} h ${minutes} min`;
  }
}
/**
 * Tenta traduzir uma instrução usando o dicionário local
 *
 * @param {string} instruction - Instrução original em inglês
 * @param {string} language - Código do idioma alvo
 * @param {Object} translations - Dicionário de traduções
 * @param {string} streetName - Nome da rua, se disponível
 * @returns {string} - Instrução traduzida ou original se não for possível traduzir
 */
function tryLocalTranslation(
  instruction,
  language,
  translations,
  streetName = ""
) {
  if (language === "en" || !translations[language]) {
    return instruction;
  }

  let translated = instruction.toLowerCase();
  const translationMap = translations[language];

  // Ordenar padrões por comprimento (maior para menor) para evitar substituições parciais
  const patterns = Object.keys(translationMap).sort(
    (a, b) => b.length - a.length
  );

  // Substituir padrões por traduções
  for (const pattern of patterns) {
    const translation = translationMap[pattern];
    const regex = new RegExp(`\\b${pattern}\\b`, "i");

    if (regex.test(translated)) {
      translated = translated.replace(regex, translation);
    }
  }

  // Processar "onto" e "on" para nomes de rua
  if (streetName && streetName.trim().length > 0) {
    const prepositions = ["onto", "on"];

    for (const prep of prepositions) {
      if (translations[language][prep]) {
        const regex = new RegExp(`\\b${prep} ${streetName}\\b`, "i");
        if (regex.test(instruction)) {
          const translation = translations[language][prep];
          translated = translated.replace(
            regex,
            `${translation} ${streetName}`
          );
        }
      }
    }

    // Se o nome da rua está na instrução original mas não na traduzida, adicionar
    if (instruction.includes(streetName) && !translated.includes(streetName)) {
      translated += ` ${streetName}`;
    }
  }

  // Capitalizar primeira letra
  return translated.charAt(0).toUpperCase() + translated.slice(1);
}

/**
 * Traduz um texto usando a API de tradução online
 *
 * @param {string} text - Texto a ser traduzido
 * @param {string} targetLang - Código do idioma alvo
 * @returns {Promise<string>} - Texto traduzido
 */
async function translateOnline(text, targetLang) {
  // Normalizar idioma recebido
  if (typeof targetLang === "object") {
    targetLang = targetLang.code || targetLang.language || "pt";
  }

  // Se o idioma for inglês ou o texto estiver vazio, retornar o próprio texto
  if (targetLang === "en" || !text || !text.trim()) {
    return text;
  }

  console.log(`[translateOnline] Traduzindo "${text}" para ${targetLang}`);

  try {
    // Para MyMemory (mais confiável para frases de navegação)
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text
    )}&langpair=en|${targetLang}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.responseData && data.responseData.translatedText) {
      return data.responseData.translatedText;
    } else {
      throw new Error("Formato de resposta de tradução inválido");
    }
  } catch (error) {
    console.error("[translateOnline] Erro na tradução online:", error);

    // Em caso de erro, tentar tradução local ou retornar texto original
    const localTranslation = tryLocalTranslation(
      text,
      targetLang,
      directionTranslations
    );
    return localTranslation || text;
  }
}
export async function formatDistance(distance, language) {
  // Normalizar idioma
  if (typeof language === "object") {
    language = language.code || language.language || "pt";
  }

  try {
    // Usar a função importada diretamente (evitar import dinâmico)
    const metersText = getGeneralText("meters", language) || "m";
    const kilometersText = getGeneralText("kilometers", language) || "km";

    // Formatar distância com base na magnitude
    if (distance < 1000) {
      return `${Math.round(distance)} ${metersText}`;
    } else {
      return `${(distance / 1000).toFixed(1)} ${kilometersText}`;
    }
  } catch (error) {
    console.error("[formatDistance] Erro ao formatar distância:", error);

    // Fallback seguro
    if (distance < 1000) {
      return `${Math.round(distance)} m`;
    } else {
      return `${(distance / 1000).toFixed(1)} km`;
    }
  }
}

async function formatTime(duration, language) {
  // Normalizar idioma
  if (typeof language === "object") {
    language = language.code || language.language || "pt";
  }

  try {
    // Usar a função importada diretamente (evitar import dinâmico)
    const walkOnText = getGeneralText("walk_on", language) || "Caminhar por";
    const forText = getGeneralText("for", language) || "por";

    // Formato para duração curta (menos de 1 minuto)
    if (duration < 60) {
      return `${walkOnText} ${Math.round(duration)} s`;
    }

    // Formato para duração em minutos
    const minutes = Math.floor(duration / 60);
    return `${walkOnText} ${minutes} min`;
  } catch (error) {
    console.error("[formatTime] Erro ao formatar tempo:", error);

    // Fallback seguro
    if (duration < 60) {
      return `${Math.round(duration)} s`;
    } else {
      const minutes = Math.floor(duration / 60);
      return `${minutes} min`;
    }
  }
}

function getStepType(instruction, hasLeft, hasRight) {
  const lowerInstruction = instruction.toLowerCase();

  if (
    lowerInstruction.includes("destination") ||
    lowerInstruction.includes("arrive")
  ) {
    return "destination";
  }

  if (lowerInstruction.includes("turn") || lowerInstruction.includes("keep")) {
    if (hasLeft) return "turn-left";
    if (hasRight) return "turn-right";
    return "turn";
  }

  if (
    lowerInstruction.includes("head") ||
    lowerInstruction.includes("continue")
  ) {
    return "straight";
  }

  if (lowerInstruction.includes("slight")) {
    if (hasLeft) return "slight-left";
    if (hasRight) return "slight-right";
  }

  if (lowerInstruction.includes("sharp")) {
    if (hasLeft) return "sharp-left";
    if (hasRight) return "sharp-right";
  }

  return "navigation";
}
/**
 * Obtém texto de posição traduzido (à direita/à esquerda)
 *
 * @param {string} language - Código do idioma
 * @param {string} position - Posição em inglês ("on the right"/"on the left")
 * @returns {Promise<string>} - Posição traduzida
 */
async function getPositionText(language, position) {
  if (language === "en") {
    return position;
  }

  // Usar tradução local se disponível
  const localTranslations = {
    pt: { "on the right": "à direita", "on the left": "à esquerda" },
    es: { "on the right": "a la derecha", "on the left": "a la izquierda" },
    he: { "on the right": "מימין", "on the left": "משמאל" },
  };

  if (localTranslations[language] && localTranslations[language][position]) {
    return localTranslations[language][position];
  }

  // Tentar com tradução online
  try {
    return await translateOnline(position, language);
  } catch (error) {
    console.warn(
      `[getPositionText] Erro ao traduzir posição "${position}"`,
      error
    );
    return position;
  }
}

/**
 * Converte o tipo de instrução da API para um tipo interno
 * @param {number|string} apiType - Tipo da instrução na API
 * @returns {number} - Tipo interno
 */
function getInstructionType(apiType) {
  // Mapeamento entre tipos da API e tipos internos
  const typeMap = {
    0: 1, // Continuar
    1: 2, // Virar à direita
    2: 3, // Virar à esquerda
    3: 4, // Virar ligeiramente à direita
    4: 5, // Virar ligeiramente à esquerda
    5: 6, // Virar acentuadamente à direita
    6: 7, // Virar acentuadamente à esquerda
    7: 8, // Fazer retorno
    8: 9, // Entrar em rotatória
    9: 10, // Sair de rotatória
    10: 11, // Chegada
    11: 12, // Partida
    // Strings para compatibilidade com outras APIs
    continue: 1,
    right: 2,
    left: 3,
    "slight right": 4,
    "slight left": 5,
    "sharp right": 6,
    "sharp left": 7,
    uturn: 8,
    roundabout: 9,
    "roundabout-exit": 10,
    arrive: 11,
    depart: 12,
  };

  return typeMap[apiType] || 1; // Padrão: continuar em frente
}

/**
 * Notifica o usuário sobre desvio ou conclusão de recálculo
 * @param {boolean} starting - Se está iniciando o recálculo
 * @param {boolean} failed - Se houve falha no recálculo
 */
export function notifyDeviation(starting = true, failed = false) {
  if (starting) {
    // Notificar início do recálculo
    const recalculatingMsg =
      getGeneralText("navigation_recalculating", selectedLanguage) ||
      "Recalculando rota...";

    appendNavigationInstruction(
      "🔄",
      recalculatingMsg,
      getGeneralText("please_wait", selectedLanguage) || "Aguarde um momento..."
    );

    // Feedback com vibração (se disponível)
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  } else if (failed) {
    // Notificar falha no recálculo
    appendNavigationInstruction(
      "⚠️",
      getGeneralText("route_not_found", selectedLanguage) ||
        "Rota não encontrada",
      getGeneralText("cant_calculate_route", selectedLanguage) ||
        "Não foi possível calcular uma nova rota"
    );
  } else {
    // Recálculo bem-sucedido
    showNotification(
      getGeneralText("routeCreated", selectedLanguage) || "Rota recalculada",
      "success"
    );

    // Feedback com vibração (se disponível)
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }
  }
}

export async function recalculateRoute(
  userLat,
  userLon,
  destLat,
  destLon,
  { lang = "pt", bigDeviation = false, profile = "foot-walking" } = {}
) {
  // Verificar se já está recalculando
  if (recalculationInProgress) {
    console.log(
      "[recalculateRoute] Já existe um recálculo em andamento, ignorando solicitação"
    );
    return;
  }

  try {
    // Marcar como em progresso
    recalculationInProgress = true;
    console.log("[NavigationService] Recalculando rota...");

    // Resto do código existente...
    if (bigDeviation) {
      showNotification(getGeneralText("routeDeviated", lang), "warning");
    }

    const newInstructions = await fetchRouteInstructions(
      userLat,
      userLon,
      destLat,
      destLon,
      lang,
      10000,
      true,
      profile
    );

    if (!newInstructions.length) {
      showNotification(getGeneralText("noInstructions", lang), "error");
      return;
    }

    clearCurrentRoute();
    await plotRouteOnMap(userLat, userLon, destLat, destLon, profile);
    navigationState.instructions = newInstructions;
    navigationState.currentStepIndex = 0;
    showNotification(getGeneralText("routeRecalculatedOk", lang), "success");
    startPositionTracking();
  } catch (error) {
    console.error("[recalculateRoute] Erro:", error);
    showNotification(
      getGeneralText("cant_calculate_route", lang) ||
        "Não foi possível calcular uma nova rota",
      "error"
    );
  } finally {
    // Sempre marcar como concluído ao final, mesmo em caso de erro
    recalculationInProgress = false;
    console.log("[recalculateRoute] Estado de recálculo resetado");
  }
}

/**
 * Enriquece a instrução com informações sobre landmarks próximos
 * @param {Object} instruction - A instrução original
 * @param {Array} landmarks - Lista de landmarks próximos
 * @returns {Object} - Instrução enriquecida
 */
export function enhanceInstructionWithLandmarks(instruction, landmarks) {
  if (!landmarks || landmarks.length === 0) return instruction;

  const nearbyLandmark = landmarks[0];

  // Verificar se o landmark tem nome/propriedade válida
  const landmarkName = nearbyLandmark.name || nearbyLandmark.title;
  if (!landmarkName) return instruction;

  // Adicionar referência ao landmark na instrução
  return {
    ...instruction,
    enhancedText: `${instruction.instruction} (próximo a ${landmarkName})`,
    landmark: nearbyLandmark,
  };
}

/**
 * Define o estado de recálculo em andamento
 * @param {boolean} state - Novo estado (true = recalculando, false = inativo)
 * @returns {boolean} - Estado atual após a alteração
 */
export function setRecalculationInProgress(state) {
  recalculationInProgress = Boolean(state);
  console.log(
    `[routeProcessor] Estado de recálculo definido: ${recalculationInProgress}`
  );
  return recalculationInProgress;
}

/**
 * Obtém o estado atual de recálculo
 * @returns {boolean} - Se há um recálculo em andamento
 */
export function isRecalculationInProgress() {
  return recalculationInProgress;
}

export default {
  processRouteInstructions,
  recalculateRoute,
  notifyDeviation,
  getDirectionIcon,
  buildInstructionMessage,
};
