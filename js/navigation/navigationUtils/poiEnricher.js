/**
 * Utilitário para enriquecimento de instruções com pontos de interesse
 * Busca informações sobre pontos próximos para melhorar contexto de navegação
 */

// Importações
import { calculateDistance } from "./distanceCalculator.js";

/**
 * Enriquece as instruções de navegação com dados do OpenStreetMap
 * @param {Array<Object>} instructions - Array de instruções a enriquecer
 * @param {string} [lang="pt"] - Idioma para tradução de POIs
 * @returns {Promise<Array<Object>>} - Instruções enriquecidas
 */
export async function enrichInstructionsWithOSM(instructions, lang = "pt") {
  try {
    const enriched = await Promise.all(
      instructions.map(async (step) => {
        if (!step.latitude || !step.longitude) {
          console.warn(
            "[enrichInstructionsWithOSM] Coordenadas inválidas:",
            step
          );
          return step;
        }

        // Obter POIs próximos para esta coordenada
        const pois = await FetchPOIsNearby(step.latitude, step.longitude, lang);

        // Gerar clone com adição de dados de POIs e manobra formatada
        return {
          ...step,
          pois: pois || [],
          raw: {
            ...(step.raw || {}),
            maneuver: {
              ...(step.raw?.maneuver || {}),
              // NÃO sobrescreva o valor numérico de type!
              // Apenas mantenha o valor original, não altere:
              type:
                typeof step.raw?.maneuver?.type === "number"
                  ? step.raw.maneuver.type
                  : typeof step.type === "number"
                  ? step.type
                  : Number(step.type) || 0,
            },
            street: step.name || step.streetName || "",
            distance: step.distance || 0,
          },
        };
      })
    );

    console.log(
      "[enrichInstructionsWithOSM] Instruções enriquecidas com POIs."
    );
    return enriched;
  } catch (error) {
    console.error("[enrichInstructionsWithOSM] Erro:", error);
    return instructions;
  }
}

/**
 * Mapeia tipos numéricos para nomes de manobras
 * @param {number} type - Tipo numérico de manobra
 * @returns {string} - Nome da manobra
 */
function mapTypeToManeuver(type) {
  const typeMap = {
    0: "head", // Início
    1: "continue",
    2: "turn_slight_right",
    3: "turn_right",
    4: "turn_sharp_right",
    5: "uturn",
    6: "turn_sharp_left",
    7: "turn_left",
    8: "turn_slight_left",
    9: "roundabout", // Entrada em rotatória
    10: "roundabout_exit", // Saída da rotatória
    11: "arrive",
    12: "enter_against",
    13: "leave_against",
  };

  return typeMap[type] || "continue";
}

/**
 * Constrói uma consulta Overpass para buscar POIs próximos
 * @param {number} lat - Latitude do ponto central
 * @param {number} lon - Longitude do ponto central
 * @param {number} [radius=30] - Raio de busca em metros
 * @returns {string} - Consulta Overpass
 */
export function buildOverpassQuery(lat, lon, radius = 30) {
  return `
    [out:json];
    (
      node(around:${radius},${lat},${lon})["tourism"];
      node(around:${radius},${lat},${lon})["historic"];
      node(around:${radius},${lat},${lon})["amenity"];
      node(around:${radius},${lat},${lon})["natural"];
      node(around:${radius},${lat},${lon})["shop"];
    );
    out center;
  `;
}

/**
 * Busca POIs próximos via Overpass API
 * @param {number} lat - Latitude do ponto de busca
 * @param {number} lon - Longitude do ponto de busca
 * @param {string} [lang="pt"] - Idioma para tradução
 * @returns {Promise<Array<Object>>} - Lista de POIs encontrados
 */
export async function FetchPOIsNearby(lat, lon, lang = "pt") {
  try {
    const query = buildOverpassQuery(lat, lon);
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
      headers: { "Content-Type": "text/plain" },
    });

    // Se a requisição falhou, retornar array vazio
    if (!response.ok) {
      console.warn("[FetchPOIsNearby] Erro na requisição:", response.status);
      return [];
    }

    const data = await response.json();

    // Filtrar e mapear elementos com nomes
    return data.elements
      .filter((el) => el.tags && el.tags.name)
      .map((el) => ({
        name: translatePOI(el.tags.name, lang),
        type:
          el.tags.tourism ||
          el.tags.historic ||
          el.tags.amenity ||
          el.tags.natural ||
          el.tags.shop ||
          "landmark",
        lat: el.lat,
        lon: el.lon,
        distance: calculateDistance(lat, lon, el.lat, el.lon),
        originalName: el.tags.name,
        tags: el.tags,
      }))
      .sort((a, b) => a.distance - b.distance); // Ordenar pelo mais próximo
  } catch (error) {
    console.error("[FetchPOIsNearby] Erro:", error);
    return [];
  }
}

/**
 * Traduz o nome de um POI para o idioma especificado
 * @param {string} name - Nome original do POI
 * @param {string} [lang="pt"] - Idioma de destino
 * @returns {string} - Nome traduzido ou original
 */
export function translatePOI(name, lang = "pt") {
  // Dicionário de traduções para pontos de interesse conhecidos
  const translations = {
    "Praça Aureliano Lima": {
      pt: "Praça Aureliano Lima",
      en: "Aureliano Lima Square",
      es: "Plaza Aureliano Lima",
      he: "כיכר אורליאנו לימה",
    },
    "Igreja de Nossa Senhora da Luz": {
      pt: "Igreja de Nossa Senhora da Luz",
      en: "Church of Our Lady of Light",
      es: "Iglesia de Nuestra Señora de la Luz",
      he: "כנסיית גבירתנו של האור",
    },
    "Primeira Praia": {
      pt: "Primeira Praia",
      en: "First Beach",
      es: "Primera Playa",
      he: "החוף הראשון",
    },
    "Segunda Praia": {
      pt: "Segunda Praia",
      en: "Second Beach",
      es: "Segunda Playa",
      he: "החוף השני",
    },
    "Terceira Praia": {
      pt: "Terceira Praia",
      en: "Third Beach",
      es: "Tercera Playa",
      he: "החוף השלישי",
    },
    "Quarta Praia": {
      pt: "Quarta Praia",
      en: "Fourth Beach",
      es: "Cuarta Playa",
      he: "החוף הרביעי",
    },
    // Outros pontos conhecidos
  };

  // Retornar tradução se existir, ou o nome original
  return translations[name]?.[lang] || name;
}

export default {
  enrichInstructionsWithOSM,
  buildOverpassQuery,
  FetchPOIsNearby,
  translatePOI,
};
