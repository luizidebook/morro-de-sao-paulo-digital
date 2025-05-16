/**
 * Módulo de integração Mapbox-OSM para mapas 3D aprimorados
 * Combina os dados do OpenStreetMap com a renderização 3D do Mapbox GL
 */

import { NOMINATIM_URL } from "./osm-service.js";

// Configurações
const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";
const MAPBOX_TOKEN =
  "pk.eyJ1IjoibHVpemlkZWJvb2siLCJhIjoiY2x3emQ4c2JtMDYyODJqcTdyazlhOHQxeiJ9.0t3JTpGWGqDtv61P_D7wuw";
const DEFAULT_BUILDING_HEIGHT = 10;
const DEFAULT_BUILDING_OPACITY = 0.8;

// Estado do módulo
let mapInstance = null;
let osmDataLoaded = false;
let currentCenter = null;
let mapStyle = "mapbox://styles/mapbox/streets-v12";
let isMapReady = false;

/**
 * Inicializa o mapa 3D com integração OSM
 * @param {Object} options - Opções de inicialização
 * @returns {Object} - Instância do mapa
 */
export async function initMapboxOSM(options = {}) {
  console.log("[mapbox-osm] Iniciando integração Mapbox-OSM");

  try {
    // Verificar se o Mapbox GL está disponível
    if (!window.mapboxgl) {
      console.error("[mapbox-osm] Mapbox GL JS não está disponível");
      await loadMapboxScript();
    }

    const {
      container = "mapbox-3d-container",
      center = [-38.9159969, -13.3775457],
      zoom = 15,
      pitch = 45,
      bearing = 0,
      style = mapStyle,
      includeBuildings = true,
      includeTerreno = true,
    } = options;

    // Criar container para o mapa se não existir
    const containerElement = ensureMapContainer(container);
    if (!containerElement) {
      console.error("[mapbox-osm] Falha ao criar/encontrar container do mapa");
      return null;
    }

    // Configurar token do Mapbox
    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Criar instância do mapa
    mapInstance = new mapboxgl.Map({
      container: containerElement,
      style: style,
      center: center,
      zoom: zoom,
      pitch: pitch,
      bearing: bearing,
      antialias: true,
    });

    // Adicionar controles de navegação
    mapInstance.addControl(new mapboxgl.NavigationControl());

    // Configurar handlers de eventos
    mapInstance.on("load", () => {
      console.log("[mapbox-osm] Mapa base carregado com sucesso");
      isMapReady = true;

      // Adicionar terreno se solicitado
      if (includeTerreno) {
        addTerrain();
      }

      // Adicionar edifícios 3D se solicitado
      if (includeBuildings) {
        addBuildings();
      }

      // Sinalizar que o mapa está pronto
      const event = new CustomEvent("mapbox-osm:ready", {
        detail: { map: mapInstance },
      });
      document.dispatchEvent(event);
    });

    // Adicionar handler de erro
    mapInstance.on("error", (e) => {
      console.error("[mapbox-osm] Erro no mapa:", e);
    });

    // Fazer container visível
    containerElement.style.display = "block";
    containerElement.style.visibility = "visible";

    return mapInstance;
  } catch (error) {
    console.error("[mapbox-osm] Erro ao inicializar mapa:", error);
    return null;
  }
}

/**
 * Garante que o container do mapa exista
 * @param {string} containerId - ID do container
 * @returns {HTMLElement} - Elemento do container
 */
function ensureMapContainer(containerId) {
  let container = document.getElementById(containerId);

  if (!container) {
    // Tentar criar container no elemento map original
    const mapContainer =
      document.getElementById("map") ||
      document.getElementById("map-container");
    if (mapContainer) {
      container = document.createElement("div");
      container.id = containerId;
      container.style.position = "absolute";
      container.style.top = "0";
      container.style.left = "0";
      container.style.width = "100%";
      container.style.height = "100%";
      container.style.zIndex = "399";
      container.style.display = "none";
      mapContainer.appendChild(container);
    }
  }

  return container;
}

/**
 * Carrega o script Mapbox GL JS
 * @returns {Promise} - Promise que resolve quando o script é carregado
 */
function loadMapboxScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://api.mapbox.com/mapbox-gl-js/v2.12.0/mapbox-gl.js";
    script.onload = () => {
      console.log("[mapbox-osm] Mapbox GL JS carregado com sucesso");

      // Carregar também o CSS
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://api.mapbox.com/mapbox-gl-js/v2.12.0/mapbox-gl.css";
      document.head.appendChild(link);

      resolve();
    };
    script.onerror = (error) => {
      console.error("[mapbox-osm] Erro ao carregar Mapbox GL JS:", error);
      reject(error);
    };
    document.head.appendChild(script);
  });
}

/**
 * Adiciona terreno 3D ao mapa
 */
function addTerrain() {
  if (!mapInstance || !isMapReady) return false;

  try {
    // Adicionar fonte de terreno
    mapInstance.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    });

    // Configurar terreno
    mapInstance.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });

    // Adicionar camada de sombreamento
    mapInstance.addLayer({
      id: "sky",
      type: "sky",
      paint: {
        "sky-type": "atmosphere",
        "sky-atmosphere-sun": [0.0, 0.0],
        "sky-atmosphere-sun-intensity": 15,
      },
    });

    console.log("[mapbox-osm] Terreno 3D adicionado com sucesso");
    return true;
  } catch (error) {
    console.error("[mapbox-osm] Erro ao adicionar terreno:", error);
    return false;
  }
}

/**
 * Adiciona camada de edifícios 3D
 */
function addBuildings() {
  if (!mapInstance || !isMapReady) return false;

  try {
    // Verificar se o mapa já tem a camada de edifícios
    if (mapInstance.getLayer("3d-buildings")) {
      console.log("[mapbox-osm] Camada de edifícios já existe");
      return true;
    }

    // Verificar se o mapa tem a fonte 'composite'
    if (
      !mapInstance.getSource("composite") &&
      !mapInstance.getSource("mapbox-buildings")
    ) {
      // Adicionar fonte para edifícios
      mapInstance.addSource("mapbox-buildings", {
        type: "vector",
        url: "mapbox://mapbox.mapbox-streets-v8",
      });
    }

    // Adicionar camada de edifícios 3D
    mapInstance.addLayer({
      id: "3d-buildings",
      source: mapInstance.getSource("composite")
        ? "composite"
        : "mapbox-buildings",
      "source-layer": "building",
      filter: ["==", "extrude", "true"],
      type: "fill-extrusion",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["get", "height"],
          0,
          "#d1d5db",
          50,
          "#a3b1c6",
          100,
          "#8596ac",
          200,
          "#667892",
        ],
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          0,
          16,
          ["get", "height"],
        ],
        "fill-extrusion-base": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          0,
          16,
          ["get", "min_height"],
        ],
        "fill-extrusion-opacity": DEFAULT_BUILDING_OPACITY,
      },
    });

    console.log("[mapbox-osm] Camada de edifícios 3D adicionada com sucesso");
    return true;
  } catch (error) {
    console.error("[mapbox-osm] Erro ao adicionar edifícios:", error);
    return false;
  }
}

/**
 * Adiciona POIs do OpenStreetMap
 * @param {Object} options - Opções para busca de POIs
 */
export async function addOSMPoints(options = {}) {
  if (!mapInstance || !isMapReady) {
    console.error("[mapbox-osm] Mapa não inicializado para adicionar POIs");
    return false;
  }

  try {
    const { radius = 500, categories = ["amenity", "tourism", "shop"] } =
      options;

    // Obter centro atual do mapa
    const center = mapInstance.getCenter();
    currentCenter = [center.lng, center.lat];

    // Construir query Overpass
    let query = `
      [out:json];
      (
    `;

    categories.forEach((category) => {
      query += `node["${category}"](around:${radius},${center.lat},${center.lng});`;
    });

    query += `
      );
      out body;
    `;

    // Fazer a requisição
    const response = await fetch(
      `${OVERPASS_API_URL}?data=${encodeURIComponent(query)}`
    );
    const data = await response.json();

    // Processar pontos
    if (data.elements && data.elements.length > 0) {
      const geojson = {
        type: "FeatureCollection",
        features: data.elements.map((element) => ({
          type: "Feature",
          properties: {
            id: element.id,
            ...element.tags,
          },
          geometry: {
            type: "Point",
            coordinates: [element.lon, element.lat],
          },
        })),
      };

      // Adicionar fonte se não existir
      if (!mapInstance.getSource("osm-pois")) {
        mapInstance.addSource("osm-pois", {
          type: "geojson",
          data: geojson,
        });

        // Adicionar camada de pontos
        mapInstance.addLayer({
          id: "osm-pois",
          type: "circle",
          source: "osm-pois",
          paint: {
            "circle-radius": 6,
            "circle-color": "#3B82F6",
            "circle-stroke-width": 1,
            "circle-stroke-color": "#FFFFFF",
          },
        });

        // Adicionar camada de rótulos
        mapInstance.addLayer({
          id: "osm-pois-labels",
          type: "symbol",
          source: "osm-pois",
          layout: {
            "text-field": ["get", "name"],
            "text-size": 12,
            "text-offset": [0, 1.5],
            "text-anchor": "top",
          },
          paint: {
            "text-color": "#333333",
            "text-halo-color": "#FFFFFF",
            "text-halo-width": 1,
          },
        });

        // Adicionar popup ao clicar nos pontos
        mapInstance.on("click", "osm-pois", (e) => {
          const feature = e.features[0];
          const coordinates = feature.geometry.coordinates.slice();
          const properties = feature.properties;

          // Criar conteúdo do popup
          let content = `<h4>${properties.name || "Ponto de Interesse"}</h4>`;

          // Adicionar tipo do local
          const type =
            properties.amenity || properties.tourism || properties.shop;
          if (type) {
            content += `<p>Tipo: ${type}</p>`;
          }

          // Criar popup
          new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(content)
            .addTo(mapInstance);
        });

        // Mudar cursor ao passar sobre os pontos
        mapInstance.on("mouseenter", "osm-pois", () => {
          mapInstance.getCanvas().style.cursor = "pointer";
        });

        mapInstance.on("mouseleave", "osm-pois", () => {
          mapInstance.getCanvas().style.cursor = "";
        });
      } else {
        // Atualizar dados da fonte existente
        mapInstance.getSource("osm-pois").setData(geojson);
      }

      console.log(
        `[mapbox-osm] ${data.elements.length} POIs adicionados ao mapa`
      );
      osmDataLoaded = true;
      return true;
    } else {
      console.log("[mapbox-osm] Nenhum POI encontrado na área");
      return false;
    }
  } catch (error) {
    console.error("[mapbox-osm] Erro ao adicionar POIs:", error);
    return false;
  }
}

/**
 * Alterna a visibilidade do mapa 3D
 * @param {boolean} visible - Estado de visibilidade
 */
export function toggleMap3D(visible) {
  const container = document.getElementById("mapbox-3d-container");
  if (!container) return false;

  if (visible) {
    container.style.display = "block";
    setTimeout(() => {
      container.style.visibility = "visible";
      container.style.opacity = "1";

      // Forçar redimensionamento do mapa
      if (mapInstance) {
        mapInstance.resize();
      }
    }, 50);
  } else {
    container.style.visibility = "hidden";
    container.style.opacity = "0";
    setTimeout(() => {
      container.style.display = "none";
    }, 500);
  }

  return true;
}

/**
 * Altera o estilo do mapa
 * @param {string} styleName - Nome do estilo ('streets', 'satellite', 'light', 'dark')
 */
export function changeMapStyle(styleName) {
  if (!mapInstance || !isMapReady) return false;

  const styles = {
    streets: "mapbox://styles/mapbox/streets-v12",
    satellite: "mapbox://styles/mapbox/satellite-streets-v12",
    light: "mapbox://styles/mapbox/light-v11",
    dark: "mapbox://styles/mapbox/dark-v11",
  };

  const styleUrl = styles[styleName] || styles.streets;

  try {
    // Guardar posição e zoom atuais
    const center = mapInstance.getCenter();
    const zoom = mapInstance.getZoom();
    const pitch = mapInstance.getPitch();
    const bearing = mapInstance.getBearing();

    // Mudar estilo
    mapInstance.setStyle(styleUrl);

    // Quando o novo estilo carregar, restaurar visão e adicionar camadas 3D
    mapInstance.once("style.load", () => {
      mapInstance.setCenter(center);
      mapInstance.setZoom(zoom);
      mapInstance.setPitch(pitch);
      mapInstance.setBearing(bearing);

      // Readicionar terreno e edifícios
      addTerrain();
      addBuildings();

      // Se dados OSM já foram carregados, recarregar
      if (osmDataLoaded && currentCenter) {
        addOSMPoints();
      }

      console.log(`[mapbox-osm] Estilo alterado para: ${styleName}`);
    });

    return true;
  } catch (error) {
    console.error("[mapbox-osm] Erro ao alterar estilo:", error);
    return false;
  }
}

/**
 * Obtém a instância atual do mapa
 * @returns {Object} - Instância do mapa
 */
export function getMapInstance() {
  return mapInstance;
}

/**
 * Busca informações sobre um endereço usando o Nominatim
 * @param {string} query - Texto da busca
 * @returns {Promise} - Promise que resolve com os resultados
 */
export async function searchLocation(query) {
  try {
    // Verificar se o Nominatim está disponível
    if (!query || query.trim() === "") {
      return { results: [] };
    }

    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: 5,
      addressdetails: 1,
    });

    const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`);
    const data = await response.json();

    if (data && data.length > 0) {
      return {
        results: data.map((item) => ({
          id: item.place_id,
          name: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          type: item.type,
          address: item.address,
        })),
      };
    } else {
      return { results: [] };
    }
  } catch (error) {
    console.error("[mapbox-osm] Erro na busca:", error);
    return { error: "Falha ao buscar local", results: [] };
  }
}

/**
 * Centraliza o mapa em uma localização
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} options - Opções adicionais
 */
export function flyToLocation(lat, lng, options = {}) {
  if (!mapInstance) return false;

  const { zoom = 16, pitch = 60, bearing = -15, duration = 2000 } = options;

  try {
    mapInstance.flyTo({
      center: [lng, lat],
      zoom: zoom,
      pitch: pitch,
      bearing: bearing,
      duration: duration,
      essential: true,
    });

    // Carregar dados OSM após a animação
    setTimeout(() => {
      addOSMPoints({ radius: 500 });
    }, duration + 100);

    return true;
  } catch (error) {
    console.error("[mapbox-osm] Erro ao voar para localização:", error);
    return false;
  }
}
