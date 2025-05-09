/**
 * Serviço para buscar dados do OpenStreetMap
 * @module osm-service
 */
// osm-service.js – Consulta de pontos de interesse via Overpass API (ou mock local)

/* O que esse módulo faz:
Usa a Overpass API para buscar POIs de categorias específicas.
Está preparado para funcionar offline com dados mockados durante o desenvolvimento.
Fácil de expandir com novas categorias e novas fontes de dados no futuro.*/

export const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
export const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";
export const apiKey =
  "5b3ce3597851110001cf62480e27ce5b5dcf4e75a9813468e027d0d3";

// Queries Overpass
export const queries = {
  "touristSpots-submenu":
    '[out:json];node["tourism"="attraction"](around:10000,-13.376,-38.917);out body;',
  "tours-submenu":
    '[out:json];node["tourism"="information"](around:10000,-13.376,-38.917);out body;',
  "beaches-submenu":
    '[out:json];node["natural"="beach"](around:10000,-13.376,-38.917);out body;',
  "nightlife-submenu":
    '[out:json];node["amenity"="nightclub"](around:10000,-13.376,-38.917);out body;',
  "restaurants-submenu":
    '[out:json];node["amenity"="restaurant"](around:10000,-13.376,-38.917);out body;',
  "inns-submenu":
    '[out:json];node["tourism"="hotel"](around:15000,-13.376,-38.917);out body;',
  "shops-submenu":
    '[out:json];node["shop"](around:10000,-13.376,-38.917);out body;',
  "emergencies-submenu":
    '[out:json];node["amenity"~"hospital|police"](around:10000,-13.376,-38.917);out body;',
  "tips-submenu":
    '[out:json];node["tips"](around:10000,-13.376,-38.913);out body;',
  "about-submenu":
    '[out:json];node["about"](around:10000,-13.376,-38.913);out body;',
  "education-submenu":
    '[out:json];node["education"](around:10000,-13.376,-38.913);out body;',
};

/**
 * Carrega os itens do submenu com base na chave da query fornecida.
 * @param {string} queryKey - Chave da query (ex: 'restaurants-submenu').
 */
export async function loadSubMenu(queryKey) {
  const container = document.getElementById("submenuContainer");
  if (!container) return console.error("Submenu container não encontrado.");

  container.innerHTML = "<p>Carregando...</p>";

  try {
    selectedFeature = queryKey;

    const results = await fetchOSMData(queryKey);
    console.log("[OSM Data]", results); // Verifique os dados retornados aqui

    submenuData[queryKey] = results;
    renderSubmenuItems(container, results);
  } catch (err) {
    container.innerHTML = "<p>Erro ao carregar dados.</p>";
    console.error("Erro no submenu:", err);
  }
}

/**
 * Valida as coordenadas fornecidas usando a API Nominatim.
 * @param {number} lat - Latitude.
 * @param {number} lon - Longitude.
 * @returns {Promise<Object>} Coordenadas validadas ou originais.
 */
export async function validateCoordinates(lat, lon) {
  const url = `${NOMINATIM_URL}?format=json&lat=${lat}&lon=${lon}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch (error) {
    console.error("Erro ao validar coordenadas:", error);
  }
  return { lat, lon }; // Retorna as coordenadas originais se não houver correção
}

// Cache para armazenar os resultados das consultas
const cache = new Map();

/**
 * Busca dados do OpenStreetMap com base na consulta especificada
 * @param {string} queryKey - Chave identificadora da consulta
 * @param {string} query - Consulta Overpass a ser executada
 * @returns {Promise<Array>} - Array de locais encontrados
 */
export async function fetchOSMData(queryKey, query) {
  try {
    console.log(`[fetchOSMData] Executando consulta para: ${queryKey}`);

    // Verificar cache primeiro
    if (cache.has(queryKey)) {
      const cachedResult = cache.get(queryKey);
      const now = Date.now();
      // Cache válido por 1 hora (3600000 ms)
      if (now - cachedResult.timestamp < 3600000) {
        console.log(`[fetchOSMData] Usando dados em cache para: ${queryKey}`);
        return cachedResult.data;
      }
    }

    // Verificação de parâmetros
    if (!queryKey || !query) {
      console.error("[fetchOSMData] Parâmetros inválidos:", {
        queryKey,
        query,
      });

      // Fornecer dados fallback para categorias conhecidas quando a consulta falhar
      return getFallbackDataForCategory(queryKey);
    }

    // CORREÇÃO: Validar formato da consulta antes de enviar
    if (!query.includes("[out:json]") || !query.includes("out body")) {
      console.error("[fetchOSMData] Formato de consulta inválido:", query);
      return getFallbackDataForCategory(queryKey);
    }

    // URL do serviço Overpass
    const overpassUrl = "https://overpass-api.de/api/interpreter";

    // Fazer a requisição
    const response = await fetch(overpassUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "data=" + encodeURIComponent(query),
      timeout: 10000, // 10 segundos de timeout
    });

    // Verificar se a requisição foi bem-sucedida
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    // Processar os dados
    const data = await response.json();
    const elements = data.elements || [];

    // Transformar os elementos em formato mais útil
    const locations = elements.map((element) => {
      return {
        name: element.tags?.name || `Local ${element.id}`,
        lat: element.lat,
        lon: element.lon,
        category: queryKey,
        tags: element.tags || {},
        osmId: element.id,
      };
    });

    // Filtrar locais sem nome ou coordenadas
    const validLocations = locations.filter(
      (loc) => loc.name && loc.lat && loc.lon
    );

    // Armazenar no cache
    cache.set(queryKey, { data: validLocations, timestamp: Date.now() });

    return validLocations;
  } catch (error) {
    console.error(`[fetchOSMData] Erro ao buscar ${queryKey}:`, error);

    // Fornecer dados fallback
    return getFallbackDataForCategory(queryKey);
  }
}

/**
 * Fornece dados fallback para categorias conhecidas quando a API falha
 * @param {string} category - Categoria para buscar dados fallback
 * @returns {Array} - Array de locais de fallback
 */
function getFallbackDataForCategory(category) {
  // Mapeamento de categorias para dados fallback
  const fallbackData = {
    beaches: [
      {
        name: "Segunda Praia",
        lat: -13.376,
        lon: -38.905,
        category: "beaches",
      },
      { name: "Praia do Forte", lat: -13.38, lon: -38.91, category: "beaches" },
    ],
    restaurants: [
      {
        name: "Restaurante do Morro",
        lat: -13.375,
        lon: -38.915,
        category: "restaurants",
      },
      {
        name: "Sabor da Ilha",
        lat: -13.371,
        lon: -38.918,
        category: "restaurants",
      },
    ],
    nightlife: [
      { name: "Bar do Mar", lat: -13.374, lon: -38.913, category: "nightlife" },
      { name: "Clube Lua", lat: -13.378, lon: -38.92, category: "nightlife" },
      {
        name: "Festa na Praia",
        lat: -13.38,
        lon: -38.915,
        category: "nightlife",
      },
    ],
    shops: [
      {
        name: "Loja de Artesanato",
        lat: -13.373,
        lon: -38.916,
        category: "shops",
      },
      { name: "Mercado Local", lat: -13.379, lon: -38.919, category: "shops" },
    ],
    emergencies: [
      {
        name: "Hospital Morro",
        lat: -13.372,
        lon: -38.914,
        category: "emergencies",
      },
      {
        name: "Posto Policial",
        lat: -13.377,
        lon: -38.917,
        category: "emergencies",
      },
    ],
    inns: [
      {
        name: "Pousada Vista Mar",
        lat: -13.375,
        lon: -38.912,
        category: "inns",
      },
      { name: "Hotel da Ilha", lat: -13.38, lon: -38.916, category: "inns" },
    ],
    touristSpots: [
      {
        name: "Mirante do Morro",
        lat: -13.37,
        lon: -38.915,
        category: "touristSpots",
      },
      {
        name: "Farol Histórico",
        lat: -13.381,
        lon: -38.918,
        category: "touristSpots",
      },
    ],
    tours: [
      {
        name: "Passeio de Barco",
        lat: -13.372,
        lon: -38.91,
        category: "tours",
      },
      {
        name: "Tour pelo Centro Histórico",
        lat: -13.378,
        lon: -38.914,
        category: "tours",
      },
    ],
  };

  // Retornar dados fallback para a categoria ou array vazio
  console.log(`[fetchOSMData] Retornando dados fallback para ${category}`);
  return fallbackData[category] || [];
}
