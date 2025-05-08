/**
 * Serviço de direções para navegação
 * Responsável por obter rotas e instruções de navegação das APIs.
 */

// Importações externas
import { apiKey } from "../../map/osm-service.js";
import { appendMessage } from "../../assistant/assistant-manager.js";
import { map } from "../../map/map-init.js";
import { plotRouteOnMap } from "../../map/map-controls.js";
import { mapORSInstruction } from "../navigationUtils/instructionBuilder.js";
/**
 * Obtém direções de rota de um ponto a outro
 * @param {Array<number>} start - [longitude, latitude] de origem
 * @param {Array<number>} end - [longitude, latitude] de destino
 * @param {string} [profile="foot-walking"] - Perfil de navegação
 * @param {string} [destinationName="Destino"] - Nome do destino
 * @returns {Promise<Object|null>} - Dados da rota ou null em caso de erro
 */
export async function getDirections(
  start,
  end,
  profile = "foot-walking",
  destinationName = "Destino"
) {
  try {
    // CORREÇÃO: Validação completa dos parâmetros antes de fazer a requisição
    if (!start || !end) {
      console.error("[getDirections] Parâmetros de coordenadas ausentes:", {
        start,
        end,
      });
      throw new Error("Coordenadas de origem ou destino ausentes");
    }

    // Verificar se são arrays e têm comprimento adequado
    if (
      !Array.isArray(start) ||
      !Array.isArray(end) ||
      start.length < 2 ||
      end.length < 2
    ) {
      console.error("[getDirections] Formato de coordenadas inválido:", {
        start,
        end,
      });
      throw new Error("Formato de coordenadas inválido");
    }

    // Verificar se os valores são numéricos e não undefined/null
    if (
      typeof start[0] !== "number" ||
      typeof start[1] !== "number" ||
      typeof end[0] !== "number" ||
      typeof end[1] !== "number" ||
      isNaN(start[0]) ||
      isNaN(start[1]) ||
      isNaN(end[0]) ||
      isNaN(end[1])
    ) {
      console.error("[getDirections] Valores de coordenadas inválidos:", {
        startLon: start[0],
        startLat: start[1],
        endLon: end[0],
        endLat: end[1],
      });
      throw new Error("Valores de coordenadas inválidos");
    }

    // Logging detalhado para diagnóstico
    console.log("[getDirections] Requisitando rota:", {
      origem: `[${start[0]}, ${start[1]}]`,
      destino: `[${end[0]}, ${end[1]}]`,
      perfil: profile,
      nomeDestino: destinationName,
    });

    const url =
      `https://api.openrouteservice.org/v2/directions/${profile}?` +
      `start=${start[0]},${start[1]}&end=${end[0]},${end[1]}&instructions=true&api_key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `API retornou ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    // Plotar a rota no mapa
    await plotRouteOnMap(
      start[1], // latitude origem (invertido para compatibilidade)
      start[0], // longitude origem
      end[1], // latitude destino
      end[0], // longitude destino
      profile,
      destinationName
    );

    return data;
  } catch (error) {
    console.error("[getDirections] Erro:", error);
    appendMessage(
      "assistant",
      "Erro ao obter direções de rota. Por favor, tente novamente.",
      { clear: true }
    );
    return null;
  }
}

/**
 * Obtém instruções detalhadas para uma rota
 * @param {number} startLat - Latitude de início
 * @param {number} startLon - Longitude de início
 * @param {number} destLat - Latitude de destino
 * @param {number} destLon - Longitude de destino
 * @param {string} lang - Idioma para instruções
 * @param {number} timeoutMs - Tempo máximo para a requisição
 * @param {boolean} shouldEnrich - Se deve enriquecer com POIs
 * @param {string} profile - Perfil de navegação
 * @returns {Promise<Array>} - Lista de instruções formatadas
 */
export async function fetchRouteInstructions(
  startLat,
  startLon,
  destLat,
  destLon,
  lang = "pt",
  timeoutMs = 10000,
  shouldEnrich = true,
  profile = "foot-walking"
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Monta a URL para a API com os parâmetros necessários
    const url =
      `https://api.openrouteservice.org/v2/directions/${profile}?` +
      `start=${startLon},${startLat}&end=${destLon},${destLat}&language=${lang}` +
      `&api_key=${apiKey}&instructions=true`;

    console.log("[fetchRouteInstructions] Chamando API com URL:", url);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!response.ok) {
      showNotification(
        `Falha ao obter rota (status ${response.status})`,
        "error"
      );
      return [];
    }
    const data = await response.json();

    // Log detalhado para diagnóstico
    console.log("[fetchRouteInstructions] Dados recebidos da API:", data);

    // Extrai os passos (steps) e as coordenadas da rota
    const segments = data.features?.[0]?.properties?.segments || [];
    const segment = segments[0] || {};
    const steps = segment.steps || [];
    const coords = data.features?.[0]?.geometry?.coordinates;

    // Calcular duração total
    const totalDuration = segment.duration || 0;
    const totalDistance = segment.distance || 0;

    console.log(
      "[fetchRouteInstructions] Duração total:",
      totalDuration,
      "segundos"
    );
    console.log(
      "[fetchRouteInstructions] Distância total:",
      totalDistance,
      "metros"
    );

    if (!steps || !coords) {
      showNotification(getGeneralText("noInstructions", lang), "error");
      return [];
    }

    // Mapeia os passos para um formato mais simples, incluindo dados de duração
    const finalSteps = steps.map((step, index) => {
      // Calcular duração proporcional se não estiver presente
      const stepDuration =
        step.duration || totalDuration * (step.distance / totalDistance);

      const coordIndex = step.way_points?.[0] ?? 0;
      const [lon, lat] = coords[coordIndex];
      const { maneuverKey, placeName } = mapORSInstruction(step.instruction);

      return {
        id: index + 1,
        raw: {
          ...step, // Incluir todos os dados originais
          instruction: step.instruction,
          duration: stepDuration,
        },
        text: step.instruction,
        distance: Math.round(step.distance),
        duration: Math.round(stepDuration), // Duração em segundos
        lat,
        lon,
        maneuverKey,
        streetName: placeName,
        type: step.type || 0,
      };
    });

    // Log para verificar se os passos têm duração
    console.log(
      "[fetchRouteInstructions] Passos processados com duração:",
      finalSteps.map((s) => ({
        id: s.id,
        distance: s.distance,
        duration: s.duration,
      }))
    );

    return finalSteps;
  } catch (err) {
    clearTimeout(id);
    console.error(
      "[fetchRouteInstructions] Erro ou timeout na requisição:",
      err
    );
    showNotification(
      "Tempo excedido ou erro ao buscar rota. Tente novamente.",
      "error"
    );
    return [];
  }
}

/**
 * Finaliza a configuração dos marcadores na rota
 * @param {number} userLat - Latitude do usuário
 * @param {number} userLon - Longitude do usuário
 * @param {Object} destination - Objeto com dados do destino
 */
export function finalizeRouteMarkers(userLat, userLon, destination) {
  if (!map) {
    console.error("[finalizeRouteMarkers] map não está inicializado.");
    return;
  }

  // Adicionar marcador do usuário se não existir
  if (!window.userMarker && window.updateUserMarker) {
    window.updateUserMarker(userLat, userLon);
  }

  // Garantir que o marcador do destino tenha popup apropriado
  if (window.destinationMarker) {
    if (destination && destination.name) {
      window.destinationMarker
        .bindPopup(`<strong>${destination.name}</strong>`)
        .openPopup();
    }
  }

  console.log(
    "[finalizeRouteMarkers] Marcadores de origem e destino configurados."
  );
}

export default {
  getDirections,
  fetchRouteInstructions,
  finalizeRouteMarkers,
};
