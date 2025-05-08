import { getDirectionIcon } from "./navigationIcons.js";
import { getGeneralText } from "../../i18n/translatePageContent.js";

/**
 * Mapeia instruções da API OpenRouteService para chaves de instruções internas
 * @param {string} instruction - Instrução original da API
 * @returns {Object} - Objeto com chave de manobra e nome do lugar
 */
export function mapORSInstruction(instruction) {
  if (!instruction) return { maneuverKey: "continue", placeName: "" };

  // Log para diagnóstico
  console.log("[mapORSInstruction] Mapeando instrução:", instruction);

  const lowerInstruction = instruction.toLowerCase();

  // Analisar texto da instrução para determinar o verdadeiro tipo de manobra
  // CORREÇÃO: Detectar corretamente as palavras-chave para identificar o tipo de manobra
  let maneuverKey = "continue"; // Padrão
  let placeName = "";

  // Extração do nome do lugar se presente
  const onMatch = lowerInstruction.match(/\bon\s+(.+?)(\s+for|\s+in|$)/i);
  if (onMatch && onMatch[1]) {
    placeName = onMatch[1].trim();
  }

  // Detecção precisa do tipo de manobra baseada no texto
  if (
    lowerInstruction.startsWith("head") ||
    lowerInstruction.includes("siga")
  ) {
    // "Head" sempre deve ser interpretado como início/continuação, NUNCA como chegada
    maneuverKey = "continue";
    console.log(
      "[mapORSInstruction] Instrução 'head' detectada -> tipo definido como continue (0)"
    );
  } else if (
    lowerInstruction.includes("arrive") ||
    lowerInstruction.includes("chegou") ||
    lowerInstruction.includes("destino")
  ) {
    maneuverKey = "arrive";
    console.log(
      "[mapORSInstruction] Instrução 'arrive' detectada -> tipo definido como arrive (11)"
    );
  } else if (
    lowerInstruction.includes("turn slight right") ||
    lowerInstruction.includes("vire levemente à direita")
  ) {
    maneuverKey = "turn_slight_right";
  } else if (
    lowerInstruction.includes("turn right") ||
    lowerInstruction.includes("vire à direita")
  ) {
    maneuverKey = "turn_right";
  } else if (
    lowerInstruction.includes("turn sharp right") ||
    lowerInstruction.includes("curva fechada à direita")
  ) {
    maneuverKey = "turn_sharp_right";
  } else if (
    lowerInstruction.includes("turn slight left") ||
    lowerInstruction.includes("vire levemente à esquerda")
  ) {
    maneuverKey = "turn_slight_left";
  } else if (
    lowerInstruction.includes("turn left") ||
    lowerInstruction.includes("vire à esquerda")
  ) {
    maneuverKey = "turn_left";
  } else if (
    lowerInstruction.includes("turn sharp left") ||
    lowerInstruction.includes("curva fechada à esquerda")
  ) {
    maneuverKey = "turn_sharp_left";
  } else if (
    lowerInstruction.includes("make a u-turn") ||
    lowerInstruction.includes("faça retorno")
  ) {
    maneuverKey = "uturn";
  } else if (
    lowerInstruction.includes("enter roundabout") ||
    lowerInstruction.includes("entre na rotatória")
  ) {
    maneuverKey = "roundabout";
  } else if (
    lowerInstruction.includes("exit roundabout") ||
    lowerInstruction.includes("saia da rotatória")
  ) {
    maneuverKey = "exit_roundabout";
  } else if (
    lowerInstruction.includes("continue") ||
    lowerInstruction.includes("continue")
  ) {
    maneuverKey = "continue";
  }

  // Log para verificar o mapeamento
  console.log(
    `[mapORSInstruction] Resultado: maneuverKey=${maneuverKey}, placeName=${placeName}`
  );

  return { maneuverKey, placeName };
}

/**
 * Cria a mensagem para uma instrução
 * @param {Object} instruction - Objeto com dados da instrução
 * @param {string} lang - Código do idioma
 * @returns {string} - Mensagem formatada
 */
export function buildInstructionMessage(instruction, lang = "pt") {
  if (!instruction) return "Instrução indisponível";

  return instruction.text || instruction.raw || "Siga em frente";
}

export default {
  mapORSInstruction,
  getDirectionIcon,
  buildInstructionMessage,
};
