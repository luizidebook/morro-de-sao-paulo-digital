/**
 * Módulo de processamento de diálogos
 * Analisa entradas do usuário e determina respostas e ações apropriadas
 *
 * @module dialog
 */

import { locations } from "../../map/locations/locations.js";
import { dadosGeoJSON } from "../../map/locations/dadosLocations.js";
import {
  showLocationOnMap,
  showAllLocationsOnMap,
  requestAndTrackUserLocation,
  showRoute,
} from "../../map/map-controls.js";
import { fetchOSMData } from "../../map/osm-service.js";
import {
  getContext,
  updateContext,
  addToHistory,
  setLastOptions,
  getLastOptions,
  setAwaiting,
  getAwaiting,
  addFavorite,
  removeFavorite,
  getFavorites,
  incrementFallback,
  resetFallback,
  getHistory,
} from "../assistant-context/context-manager.js";
import { startCarousel } from "../../utils/carousel.js";
import { startNavigation } from "../../navigation/navigationController/navigationController.js";
import { clearAssistantMessages, appendMessage } from "../assistant.js";
import {
  getGeneralText,
  currentLang,
} from "../../i18n/translatePageContent.js";

// Importar mensagens do novo arquivo
import {
  messages,
  getMessage,
  getCategoryName,
  getPlaceOptions,
  getLocationListMessage,
  getDefaultResponse,
  formatHistoryMessage,
} from "../assistant-messages/assistant-messages.js";

// Cache para armazenar resultados de consultas frequentes
const cache = {
  placeDescriptions: new Map(),
  osmQueries: new Map(),
  lastSearch: {
    timestamp: 0,
    query: "",
    results: null,
  },
};

// Novas queries Overpass (use exatamente estas chaves)
const queries = {
  touristSpots:
    '[out:json];node["tourism"="attraction"](around:10000,-13.376,-38.917);out body;',
  tours:
    '[out:json];node["tourism"="information"](around:10000,-13.376,-38.917);out body;',
  beaches:
    '[out:json];node["natural"="beach"](around:10000,-13.376,-38.917);out body;',
  nightlife:
    '[out:json];node["amenity"~"bar|pub|nightclub"](around:10000,-13.376,-38.917);out body;',
  restaurants:
    '[out:json];node["amenity"="restaurant"](around:10000,-13.376,-38.917);out body;',
  inns: '[out:json];node["tourism"="hotel"](around:10000,-13.376,-38.917);out body;',
  shops: '[out:json];node["shop"](around:10000,-13.376,-38.917);out body;',
  emergencies:
    '[out:json];node["amenity"~"hospital|police"](around:10000,-13.376,-38.917);out body;',
};

/**
 * Função utilitária para calcular distância entre dois pontos geográficos
 * @param {number} lat - Latitude do ponto
 * @param {number} lon - Longitude do ponto
 * @param {number} centerLat - Latitude do centro (padrão: -13.376)
 * @param {number} centerLon - Longitude do centro (padrão: -38.917)
 * @param {number} radiusMeters - Raio de busca em metros (padrão: 10000)
 * @returns {boolean} - Verdadeiro se o ponto está dentro do raio
 */
function isWithinRadius(
  lat,
  lon,
  centerLat = -13.376,
  centerLon = -38.917,
  radiusMeters = 10000
) {
  try {
    // Verificar se lat e lon são valores válidos
    if (
      typeof lat !== "number" ||
      isNaN(lat) ||
      typeof lon !== "number" ||
      isNaN(lon)
    ) {
      return false;
    }

    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371000; // Raio da Terra em metros
    const dLat = toRad(lat - centerLat);
    const dLon = toRad(lon - centerLon);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(centerLat)) *
        Math.cos(toRad(lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d <= radiusMeters;
  } catch (error) {
    console.error("[isWithinRadius] Erro ao calcular distância:", error);
    return false;
  }
}

// Categorias para pesquisa
const categories = [
  {
    key: "beaches",
    keywords: [
      "praia",
      "praias",
      "beach",
      "beaches",
      "mar",
      "litoral",
      "costa",
      "orla",
    ],
    queryKey: "beaches",
    localKey: "beaches",
  },
  {
    key: "restaurants",
    keywords: [
      "restaurante",
      "restaurantes",
      "comida",
      "onde comer",
      "food",
      "eat",
      "meal",
      "dining",
      "lunch",
      "jantar",
      "almoço",
      "dinner",
    ],
    queryKey: "restaurants",
    localKey: "restaurants",
  },
  {
    key: "hotels",
    keywords: [
      "hotel",
      "hotéis",
      "hospedagem",
      "pousada",
      "pousadas",
      "inn",
      "inns",
      "hostel",
      "hostels",
      "accommodation",
      "stay",
      "lodging",
    ],
    queryKey: "inns",
    localKey: "hotels",
  },
  {
    key: "shops",
    keywords: [
      "loja",
      "lojas",
      "compras",
      "shopping",
      "store",
      "stores",
      "shop",
      "market",
      "markets",
      "mercado",
      "mercados",
      "boutique",
      "souvenir",
    ],
    queryKey: "shops",
    localKey: "shops",
  },
  {
    key: "attractions",
    keywords: [
      "atração",
      "atrações",
      "pontos turísticos",
      "turismo",
      "tourist spot",
      "tourist spots",
      "tourist attraction",
      "tourist attractions",
      "sightseeing",
      "ponto turístico",
      "tour",
      "tours",
      "passeio",
      "passeios",
      "visitar",
      "visit",
      "touristSpots",
    ],
    queryKey: "touristSpots",
    localKey: "attractions",
  },
  {
    key: "nightlife",
    keywords: [
      "balada",
      "baladas",
      "noite",
      "noitada",
      "nightlife",
      "night club",
      "nightclub",
      "nightclubs",
      "club",
      "clubs",
      "festa",
      "festas",
      "party",
      "parties",
      "bar",
      "bares",
      "pub",
      "pubs",
    ],
    queryKey: "nightlife",
    localKey: "nightlife",
  },
  {
    key: "emergencies",
    keywords: [
      "emergência",
      "emergências",
      "emergency",
      "emergencies",
      "hospital",
      "hospitais",
      "posto de saúde",
      "health center",
      "polícia",
      "police",
      "delegacia",
      "fire",
      "bombeiro",
      "bombeiros",
      "ambulância",
      "ambulance",
      "help",
      "socorro",
    ],
    queryKey: "emergencies",
    localKey: "emergencies",
  },
  {
    key: "tours",
    keywords: [
      "passeio",
      "passeios",
      "tour",
      "tours",
      "excursão",
      "excursões",
      "boat tour",
      "boat",
      "barco",
      "trilha",
      "trilhas",
      "hiking",
      "walk",
      "walking tour",
      "city tour",
    ],
    queryKey: "tours",
    localKey: "tours",
  },
];

/**
 * Busca detalhes completos de um local pelo nome
 * @param {string} name - Nome do local
 * @returns {Object|null} - Detalhes do local ou null
 */
function findGeoJSONDetailsByName(name) {
  if (!name) return null;

  try {
    // Normalizar o nome para comparação
    const normalizedName = name.toLowerCase().trim();

    // Verificar cache primeiro
    const cacheKey = `geoDetails_${normalizedName}`;
    if (cache[cacheKey]) return cache[cacheKey];

    // Buscar nos dados
    const feature = dadosGeoJSON.features.find(
      (f) =>
        f.properties &&
        f.properties.name &&
        f.properties.name.toLowerCase() === normalizedName
    );

    // Armazenar no cache
    if (feature) {
      cache[cacheKey] = feature;
    }

    return feature;
  } catch (error) {
    console.error("[findGeoJSONDetailsByName] Erro ao buscar detalhes:", error);
    return null;
  }
}

/**
 * Obtém um breve resumo do local
 * @param {Object} place - Local para buscar a descrição
 * @returns {string} - Descrição do local
 */
function getBriefDescription(place) {
  if (!place || !place.name) return "Sem descrição disponível.";

  try {
    // Verificar cache
    const cacheKey = `description_${place.name.toLowerCase()}`;
    if (cache.placeDescriptions.has(cacheKey)) {
      return cache.placeDescriptions.get(cacheKey);
    }

    // Tentar obter do objeto place
    if (place.description) {
      cache.placeDescriptions.set(cacheKey, place.description);
      return place.description;
    }

    // Tentar obter do GeoJSON
    const geo = findGeoJSONDetailsByName(place.name);
    if (geo && geo.properties && geo.properties.description) {
      const desc = geo.properties.description;
      cache.placeDescriptions.set(cacheKey, desc);
      return desc;
    }

    // Fallback
    return "Sem descrição disponível.";
  } catch (error) {
    console.error("[getBriefDescription] Erro ao obter descrição:", error);
    return "Sem descrição disponível.";
  }
}

// Junta todos os locais em uma lista única com validação
const allPlaces = [];
try {
  Object.entries(locations).forEach(([category, items]) => {
    if (!Array.isArray(items)) {
      console.warn(`[dialog] Categoria ${category} não é um array válido`);
      return;
    }

    items.forEach((loc) => {
      if (
        loc.name &&
        typeof loc.lat === "number" &&
        typeof loc.lon === "number" &&
        isWithinRadius(loc.lat, loc.lon)
      ) {
        allPlaces.push({
          ...loc,
          category,
        });
      }
    });
  });
  console.log(`[dialog] ${allPlaces.length} locais carregados no total`);
} catch (error) {
  console.error("[dialog] Erro ao carregar locais:", error);
}

/**
 * Encontra o último destino mencionado no histórico de conversas
 * @returns {Object|null} - Objeto do local ou null
 */
function findLastDestinationFromHistory() {
  try {
    const history = getHistory();
    // Procura nas duas últimas mensagens do usuário
    for (let i = history.length - 1; i >= 0 && i >= history.length - 2; i--) {
      const input = history[i]?.input?.toLowerCase();
      if (!input) continue;
      // Procura por nome de local conhecido
      const place = allPlaces.find((loc) =>
        input.includes(loc.name.toLowerCase())
      );
      if (place) {
        console.log(
          "[findLastDestinationFromHistory] Local encontrado no histórico:",
          place.name
        );
        return place;
      }
    }
    return null;
  } catch (error) {
    console.error(
      "[findLastDestinationFromHistory] Erro ao buscar histórico:",
      error
    );
    return null;
  }
}

/**
 * Processa a mensagem do usuário, define resposta e ação.
 * @param {string} input - Texto do usuário.
 * @param {object} context - Contexto atual da aplicação (ex: { map, lastPlace })
 * @returns {Promise<{ text: string, action?: Function, options?: string[], context?: object }>}
 */
export async function processUserInput(input, context = {}) {
  try {
    // Validação de entrada
    if (!input || typeof input !== "string") {
      console.warn("[processUserInput] Entrada inválida:", input);
      return getDefaultResponse();
    }

    const ctx = getContext();
    const normalized = input.trim().toLowerCase();
    const navigateRegex =
      /(como chegar|chegar|criar rota|rota|ir para|como vou para|navegar para|route to|go to)/i;

    console.log(`[processUserInput] Processando: "${normalized}"`);

    // Favoritos
    if (
      normalized.includes("favorito") ||
      normalized.includes("favoritos") ||
      normalized.includes("meus lugares")
    ) {
      const favs = getFavorites();
      if (favs.length === 0) {
        return {
          text: messages.favorites.noFavorites(),
        };
      }
      return {
        text: messages.favorites.yourFavorites(favs.join(", ")),
        options: favs,
      };
    }

    // Adicionar aos favoritos
    if (normalized.startsWith("adicionar aos favoritos")) {
      const placeName = normalized
        .replace("adicionar aos favoritos", "")
        .trim();
      if (placeName) {
        addFavorite(placeName);
        return {
          text: messages.favorites.addedToFavorites(placeName),
        };
      }
    }

    // Remover dos favoritos
    if (normalized.startsWith("remover dos favoritos")) {
      const placeName = normalized.replace("remover dos favoritos", "").trim();
      if (placeName) {
        removeFavorite(placeName);
        return {
          text: messages.favorites.removedFromFavorites(placeName),
        };
      }
    }

    // Histórico de conversa
    if (normalized === "histórico" || normalized === "meu histórico") {
      const history = getContext().history;
      return {
        text: formatHistoryMessage(history),
      };
    }

    // Contexto de espera ("awaiting")
    const awaiting = getAwaiting();
    if (awaiting && awaiting.type === "selecionar_local") {
      const selected = normalized;
      const place = allPlaces.find(
        (loc) => loc.name.toLowerCase() === selected
      );
      if (place) {
        updateContext({ lastPlace: place.name, lastIntent: "detalhes" });
        setAwaiting(null);
        const resumo = getBriefDescription(place);
        return {
          text: messages.locations.details(place.name, resumo),
          options: getPlaceOptions(),
          context: { lastPlace: place.name },
          action: () => {
            insertCarouselInMessages(place.name);
          },
        };
      } else {
        incrementFallback();
        return {
          text: messages.locations.notFound(),
          options: getLastOptions(),
        };
      }
    }

    // Fotos - carrossel
    if (
      ctx.lastIntent === "detalhes" &&
      (normalized === "fotos" || normalized === "imagens")
    ) {
      if (ctx.lastPlace) {
        return {
          text: "", // String vazia para não exibir "Aqui estão as fotos"
          action: () => {
            // Importar a função showCarouselInAssistant
            import("../../utils/carousel.js").then((module) => {
              // Usar a função para exibir o carrossel
              module.showCarouselInAssistant(ctx.lastPlace);

              // Adicionar apenas o texto de seguimento após o carrossel
              setTimeout(() => {
                const messagesArea = document.querySelector(
                  "#assistant-messages .messages-area"
                );
                if (messagesArea) {
                  // Criar o texto de seguimento após o carrossel
                  const infoMsg = document.createElement("div");
                  infoMsg.classList.add(
                    "message",
                    "assistant",
                    "carousel-info-text"
                  );
                  infoMsg.textContent = messages.locations.askMoreInfo();
                  messagesArea.appendChild(infoMsg);
                }
              }, 300);
            });
          },
          context: { lastPlace: ctx.lastPlace },
        };
      }
    }

    // Comando "mostrar todos" baseado em categoria anterior
    if (
      ctx.lastCategory &&
      (normalized === "ver todos" || normalized === "mostrar todos")
    ) {
      const locais = (locations[ctx.lastCategory] || []).filter(
        (l) => l.name && l.lat && l.lon
      );
      if (locais.length > 0) {
        return {
          text: messages.locations.showingAll(ctx.lastCategory),
          action: () => showAllLocationsOnMap(locais),
          options: locais.map((l) => l.name),
        };
      }
    }

    // Fallback inteligente após várias tentativas falhas
    if (ctx.fallbackCount >= 2) {
      resetFallback();
      return {
        text: messages.fallback.difficulties(),
        options: [messages.options.tutorial(), messages.options.contactAgent()],
      };
    }

    // Busca por nome de local
    const found = allPlaces.find((loc) =>
      normalized.includes(loc.name.toLowerCase())
    );
    if (found) {
      updateContext({ lastPlace: found.name, lastIntent: "detalhes" });
      const resumo = getBriefDescription(found);
      const responseText = messages.locations.details(found.name, resumo);
      addToHistory({ input, response: responseText });

      return {
        text: responseText,
        options: getPlaceOptions(),
        context: { lastPlace: found.name },
        action: () => {
          showLocationOnMap(found.name, found.lat, found.lon);
        },
      };
    }

    // Perguntas "onde fica"
    const ondeFicaMatch = normalized.match(
      /onde (fica|está|encontra|localiza)[\s:]*([\w\s]+)/i
    );
    if (ondeFicaMatch) {
      const nomeBuscado = ondeFicaMatch[2]?.trim();
      if (nomeBuscado) {
        const place = allPlaces.find(
          (loc) =>
            loc.name.toLowerCase() === nomeBuscado.toLowerCase() ||
            nomeBuscado.toLowerCase().includes(loc.name.toLowerCase()) ||
            loc.name.toLowerCase().includes(nomeBuscado.toLowerCase())
        );
        if (place) {
          const resumo = getBriefDescription(place);
          return {
            text: messages.locations.wherePlaceQuestion(place.name),
            options: [
              messages.options.moreDetails(),
              messages.options.showPhotos(),
              messages.options.createRoute(),
            ],
            context: { lastPlace: place.name },
            action: () => {
              showLocationOnMap(place.name, place.lat, place.lon);
            },
          };
        }
      }
    }

    // Buscar por categoria
    for (const cat of categories) {
      // Prioridade para locais já cadastrados no sistema
      if (
        cat.key &&
        cat.key !== "nightlife" &&
        cat.key !== "emergencies" &&
        cat.key !== "tours"
      ) {
        if (
          cat.key in locations &&
          cat.key !== "nightlife" &&
          cat.key !== "emergencies" &&
          cat.key !== "tours"
        ) {
          if (cat.keywords.some((word) => normalized.includes(word))) {
            const locais = (locations[cat.localKey] || []).filter(
              (l) => l.name && l.lat && l.lon && isWithinRadius(l.lat, l.lon)
            );
            if (locais && locais.length > 0) {
              // Salvar categoria no contexto
              updateContext({ lastCategory: cat.key });

              return {
                text: messages.categories.allOptions(
                  getCategoryName(cat.key),
                  locais.map((l) => l.name).join(", ")
                ),
                options: locais.map((l) => l.name),
                action: () => showAllLocationsOnMap(locais),
              };
            }
          }
        }
      }

      // Busca OSM para todas as categorias
      if (
        cat.queryKey &&
        cat.keywords.some((word) => normalized.includes(word))
      ) {
        // Salvar categoria no contexto
        updateContext({ lastCategory: cat.key });

        // Mensagem inicial para o usuário
        const categoryName = getCategoryName(cat.key);
        const responseText = messages.categories.searching(categoryName);

        return {
          text: responseText,
          action: async () => {
            try {
              console.log(
                `[processUserInput] Executando consulta para ${
                  cat.queryKey
                } usando a query: ${queries[cat.queryKey]}`
              );

              // Verificar se a query existe
              if (!queries[cat.queryKey]) {
                throw new Error(
                  `Query não encontrada para a chave: ${cat.queryKey}`
                );
              }

              // Buscar os dados
              const results = await fetchOSMData(
                cat.queryKey,
                queries[cat.queryKey]
              );

              // Verificar se temos resultados
              if (!results || results.length === 0) {
                appendMessage(
                  "assistant",
                  `Não encontrei locais de ${categoryName} na região. Tente outra categoria.`,
                  { speakMessage: true }
                );
                return;
              }

              // Filtrar e mostrar no mapa
              const filtered = results.filter(
                (r) => r.lat && r.lon && isWithinRadius(r.lat, r.lon)
              );

              // Mostrar locais encontrados
              if (filtered.length > 0) {
                showAllLocationsOnMap(filtered);
                appendMessage(
                  "assistant",
                  `Encontrei ${filtered.length} locais de ${categoryName}. Gostaria de detalhes sobre algum deles?"`,
                  { speakMessage: true }
                );
              } else {
                appendMessage(
                  "assistant",
                  `Não encontrei locais de ${categoryName} próximos. Tente outra categoria.`,
                  { speakMessage: true }
                );
              }
            } catch (error) {
              console.error(
                `[processUserInput] Erro ao buscar ${cat.key}:`,
                error
              );

              // Mensagem de erro específica
              appendMessage(
                "assistant",
                "Desculpe, não consegui carregar os dados. Tente novamente mais tarde ou escolha outra categoria.",
                { speakMessage: true }
              );
            }
          },
        };
      }
    }

    // Localização do usuário
    if (
      normalized.includes("minha localização") ||
      normalized.includes("onde estou") ||
      normalized.includes("me encontre") ||
      normalized.includes("localização atual") ||
      normalized.includes("my location") ||
      normalized.includes("find me")
    ) {
      return {
        text: messages.userLocation.locating(),
        action: () => requestAndTrackUserLocation(),
      };
    }

    // Processamento de comandos de navegação (rota)
    if (navigateRegex.test(normalized)) {
      console.log(
        "[processUserInput] Detecção de comando de rota:",
        normalized
      );

      // Obter destino da conversa ou entrada direta
      let destination =
        getDestinationFromContext() || getDestinationFromInput(normalized);

      if (!destination) {
        // Tentar buscar do histórico como fallback
        destination = findLastDestinationFromHistory();
        console.log(
          "[processUserInput] Destino encontrado no histórico:",
          destination
        );
      }

      if (destination) {
        console.log("[processUserInput] Destino encontrado:", destination);

        // Verificar localização do usuário
        if (
          !window.userLocation ||
          !isValidCoordinate(
            window.userLocation.latitude,
            window.userLocation.longitude
          )
        ) {
          console.log(
            "[processUserInput] Usuário ainda não compartilhou localização."
          );

          // Mostrar mensagem de espera
          appendMessage(
            "assistant",
            "Estou calculando a distância e o tempo até " +
              destination.name +
              ", aguarde um momento...",
            { speakMessage: true }
          );

          // Solicitar localização e depois iniciar navegação
          requestAndTrackUserLocation()
            .then((location) => {
              console.log(
                "[processUserInput] Localização obtida, iniciando navegação para:",
                destination
              );

              // Normalizar destino para formato padrão
              const normalizedDestination = normalizeDestination(destination);

              // Iniciar navegação com tratamento de erros
              startNavigationSafely(normalizedDestination);
            })
            .catch((error) => {
              console.error(
                "[processUserInput] Erro ao obter localização:",
                error
              );
              appendMessage(
                "assistant",
                "Não consegui obter sua localização. Verifique se o GPS está ativado.",
                { speakMessage: true }
              );
            });
        } else {
          // Já temos localização, iniciar navegação diretamente
          console.log(
            "[processUserInput] Localização já disponível, iniciando navegação"
          );

          // Normalizar destino
          const normalizedDestination = normalizeDestination(destination);

          // Iniciar navegação
          startNavigationSafely(normalizedDestination);
        }

        // Atualizar contexto com o destino selecionado
        updateContext({
          lastDestination: destination,
          selectedDestination: destination,
          lastIntent: "rota",
        });

        return {
          text: messages.navigation.creating(destination.name),
          action: () => {
            // Esta ação será executada além do código acima
            showRoute(destination);
          },
        };
      } else {
        console.log(
          "[processUserInput] Comando de navegação sem destino específico"
        );

        // Verificar se o usuário especificou uma categoria em vez de destino específico
        const category = extractCategoryFromInput(normalized);

        if (category) {
          // Se identificou uma categoria, mostrar opções dessa categoria
          appendMessage(
            "assistant",
            `Para qual ${getCategoryNamePortuguese(
              category
            )} você deseja ir? Por favor, escolha um destino específico.`,
            { speakMessage: true }
          );

          // Mostrar opções de lugares da categoria
          const placesOptions = getPlacesFromCategory(category);
          if (placesOptions.length > 0) {
            // Mostrar as primeiras 5 opções
            const limitedOptions = placesOptions.slice(0, 5);
            appendMessage(
              "system",
              `Opções: ${limitedOptions.map((p) => p.name).join(", ")}`,
              { isOptions: true }
            );

            // Salvar categoria no contexto
            updateContext({ lastCategory: category });
          }

          return {
            text: messages.navigation.destinationMissing(),
            options: placesOptions.slice(0, 5).map((p) => p.name),
          };
        } else {
          appendMessage(
            "assistant",
            "Para onde você deseja ir? Por favor, especifique um destino.",
            { speakMessage: true }
          );

          return {
            text: messages.navigation.destinationMissing(),
          };
        }
      }
    }

    // Confirmação de navegação guiada
    if (
      /(iniciar navegação|navegação guiada|começar navegação|sim|iniciar|guiada|confirmar)/i.test(
        normalized
      )
    ) {
      // Obter contexto atual
      const currentContext = getContext();
      console.log(
        "[processUserInput] Resposta positiva detectada. Contexto atual:",
        currentContext
      );

      // Verificar se temos destino selecionado
      const destino = currentContext.selectedDestination;
      if (!destino) {
        console.log("[processUserInput] Nenhum destino encontrado no contexto");
        return {
          text: messages.navigation.destinationMissing(),
        };
      }

      // Log detalhado
      console.log("[processUserInput] Destino encontrado:", destino);
      console.log("[processUserInput] Iniciando navegação guiada");

      // Limpar mensagens antigas relacionadas a navegação
      clearAssistantMessages(
        (msg) =>
          msg.textContent &&
          (msg.textContent.includes("Deseja iniciar uma navegação guiada") ||
            msg.textContent.includes("Rota calculada com sucesso") ||
            msg.textContent.includes("Rota criada para"))
      );

      // Preparar mensagem de resposta
      let messageText;
      try {
        // Tentar chamar como função de ordem superior
        if (typeof messages.navigation.routeCreated === "function") {
          const routeCreatedFn = messages.navigation.routeCreated();
          if (typeof routeCreatedFn === "function") {
            messageText = routeCreatedFn(destino.name);
          } else {
            messageText = messages.navigation.routeCreated(destino.name);
          }
        } else {
          // Fallback para texto genérico
          messageText = `Iniciando navegação guiada para ${destino.name}`;
        }
      } catch (err) {
        console.error(
          "[processUserInput] Erro ao formatar mensagem de navegação:",
          err
        );
        messageText = `Iniciando navegação guiada para ${destino.name}`;
      }

      return {
        text: messageText,
        action: () => {
          // Normalizar o destino antes de iniciar navegação
          const normalizedDestination = normalizeDestination(destino);
          startNavigation(normalizedDestination);
        },
      };
    }

    // Resposta padrão se não encontrou correspondência
    const result = getDefaultResponse();

    if (result.context) {
      updateContext(result.context);
    }
    if (result.action) {
      result.action();
    }

    return result;
  } catch (error) {
    console.error("[processUserInput] Erro inesperado:", error);
    return {
      text: "Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente.",
      options: ["Ajuda", "Voltar ao início"],
    };
  }
}

/**
 * Verifica se as coordenadas são válidas
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean} - Indica se as coordenadas são válidas
 */
function isValidCoordinate(lat, lon) {
  return (
    typeof lat === "number" &&
    !isNaN(lat) &&
    typeof lon === "number" &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Normaliza o formato do destino para garantir consistência
 * @param {Object} destination - Destino a ser normalizado
 * @returns {Object} - Destino normalizado
 */
function normalizeDestination(destination) {
  try {
    // Verificar se temos pelo menos as coordenadas básicas
    if (!destination || (!destination.lat && !destination.latitude)) {
      console.error(
        "[normalizeDestination] Destino não possui coordenadas:",
        destination
      );
      throw new Error("Destino inválido: sem coordenadas");
    }

    return {
      latitude: destination.lat || destination.latitude,
      longitude: destination.lon || destination.lng || destination.longitude,
      name: destination.name || "Destino",
      category: destination.category || "location",
      icon: destination.icon || determineIconForCategory(destination.category),
      // Adicionar detalhes extras se disponíveis
      description: destination.description || null,
      arrivalRadius: destination.arrivalRadius || 30, // metros
      navigationType: destination.navigationType || "walking", // walking, cycling, driving
    };
  } catch (error) {
    console.error("[normalizeDestination] Erro:", error);
    throw error; // Relançar erro para tratamento superior
  }
}

/**
 * Inicia a navegação com tratamento de erros
 * @param {Object} destination - Destino normalizado
 * @returns {boolean} - Se a navegação foi iniciada
 */
// Em assistant-dialog.js, função startNavigationSafely
// Em assistant-dialog.js, função startNavigationSafely
export async function startNavigationSafely(destination) {
  try {
    console.log(
      "[startNavigationSafely] Tentando iniciar navegação para:",
      destination.name
    );

    // Adaptar formato do destino para o formato esperado por navigationController
    const adaptedDestination = {
      lat: destination.latitude || destination.lat,
      lon: destination.longitude || destination.lon,
      name: destination.name,
      category: destination.category,
      // Outras propriedades relevantes
      description: destination.description,
      icon: destination.icon,
    };

    // Verificar se temos a função via importação dinâmica
    if (typeof window.startNavigation === "function") {
      return window.startNavigation(adaptedDestination);
    } else {
      console.log(
        "[startNavigationSafely] Usando função importada startNavigation"
      );
      const navigationController = await import(
        "../../navigation/navigationController/navigationController.js"
      );
      return navigationController.startNavigation(adaptedDestination);
    }
  } catch (error) {
    console.error("[startNavigationSafely] Erro:", error);
    appendMessage(
      "assistant",
      "Não foi possível iniciar a navegação. Tente novamente mais tarde.",
      { speakMessage: true }
    );
    return false;
  }
}

/**
 * Extrai um destino a partir do texto de entrada
 * @param {string} input - Texto do usuário
 * @returns {Object|null} - Objeto de destino ou null
 */
function getDestinationFromInput(input) {
  try {
    if (!input || typeof input !== "string") return null;

    const normalizedInput = input.toLowerCase();

    // Comandos de navegação para filtrar
    const commands = [
      "como chegar",
      "navegar para",
      "ir para",
      "rota para",
      "chegar em",
      "chegar na",
      "chegar no",
    ];

    // Extrair o nome do destino
    let potentialDestName = normalizedInput;
    for (const cmd of commands) {
      if (normalizedInput.includes(cmd)) {
        potentialDestName = normalizedInput.split(cmd)[1].trim();
        break;
      }
    }

    // Se ficou muito curto, usar o texto original
    if (potentialDestName.length < 3) {
      potentialDestName = normalizedInput;
    }

    console.log(
      "[getDestinationFromInput] Buscando destino para:",
      potentialDestName
    );

    // Buscar correspondência exata na lista de lugares
    for (const place of allPlaces) {
      if (
        (place.name && place.name.toLowerCase().includes(potentialDestName)) ||
        potentialDestName.includes(place.name.toLowerCase())
      ) {
        console.log(
          "[getDestinationFromInput] Destino encontrado:",
          place.name
        );
        return place;
      }
    }

    // Buscar correspondência parcial por palavras
    for (const place of allPlaces) {
      const words = potentialDestName.split(" ");
      for (const word of words) {
        if (word.length > 3 && place.name.toLowerCase().includes(word)) {
          console.log(
            "[getDestinationFromInput] Destino parcial encontrado:",
            place.name
          );
          return place;
        }
      }
    }

    // Não encontrou
    console.log(
      "[getDestinationFromInput] Nenhum destino correspondente encontrado"
    );
    return null;
  } catch (error) {
    console.error("[getDestinationFromInput] Erro:", error);
    return null;
  }
}

/**
 * Extrai categoria a partir do texto do usuário
 * @param {string} input - Texto do usuário
 * @returns {string|null} - Categoria encontrada ou null
 */
function extractCategoryFromInput(input) {
  try {
    if (!input || typeof input !== "string") return null;

    const normalizedInput = input.toLowerCase();

    // Mapeamento de palavras-chave para categorias
    const categoryMatches = {
      praia: "beaches",
      praias: "beaches",
      restaurante: "restaurants",
      comer: "restaurants",
      hotel: "hotels",
      pousada: "hotels",
      hospedagem: "hotels",
      compras: "shops",
      loja: "shops",
      atrações: "attractions",
      turismo: "attractions",
      balada: "nightlife",
      bar: "nightlife",
      hospital: "emergencies",
      policia: "emergencies",
      passeio: "tours",
      tour: "tours",
    };

    for (const [keyword, category] of Object.entries(categoryMatches)) {
      if (normalizedInput.includes(keyword)) {
        return category;
      }
    }

    return null;
  } catch (error) {
    console.error("[extractCategoryFromInput] Erro:", error);
    return null;
  }
}

/**
 * Obter nome da categoria em português
 * @param {string} category - Nome da categoria em inglês
 * @returns {string} - Nome em português
 */
function getCategoryNamePortuguese(category) {
  if (!category) return "destino";

  const categoryNames = {
    beaches: "praia",
    restaurants: "restaurante",
    hotels: "hotel ou pousada",
    shops: "loja",
    attractions: "atração turística",
    nightlife: "opção de vida noturna",
    emergencies: "serviço de emergência",
    tours: "passeio",
  };

  return categoryNames[category] || "destino";
}

/**
 * Obtém lista de lugares de uma categoria
 * @param {string} category - Categoria desejada
 * @returns {Array} - Lista de lugares
 */
function getPlacesFromCategory(category) {
  try {
    if (!category || !locations) return [];

    if (locations[category] && Array.isArray(locations[category])) {
      return locations[category].filter(
        (place) => place && place.name && place.lat && place.lon
      );
    }
    return [];
  } catch (error) {
    console.error("[getPlacesFromCategory] Erro:", error);
    return [];
  }
}

/**
 * Determina o ícone com base na categoria
 * @param {string} category - Categoria do local
 * @returns {string} - Nome do ícone FontAwesome
 */
function determineIconForCategory(category) {
  if (!category) return "map-marker";

  const iconMap = {
    beaches: "umbrella-beach",
    restaurants: "utensils",
    hotels: "hotel",
    attractions: "camera",
    bars: "glass-cheers",
    shops: "shopping-bag",
    parks: "tree",
    landmarks: "landmark",
    museums: "museum",
    nightlife: "cocktail",
    emergencies: "ambulance",
    tours: "route",
  };

  return iconMap[category?.toLowerCase()] || "map-marker";
}

/**
 * Extrai um destino a partir do contexto atual
 * @returns {Object|null} - Destino encontrado ou null
 */
function getDestinationFromContext() {
  try {
    // Obter o contexto atual
    const context = typeof getContext === "function" ? getContext() : {};

    // Verificar destinos no contexto em ordem de prioridade
    if (context && context.selectedDestination) {
      return context.selectedDestination;
    }

    if (context && context.pendingRoute) {
      return context.pendingRoute;
    }

    if (context && context.lastPlace) {
      // Buscar o local pelo nome
      const place = allPlaces.find((p) => p.name === context.lastPlace);
      if (place) return place;
    }

    if (context && context.lastDestination) {
      return context.lastDestination;
    }

    // Verificar outras fontes potenciais
    if (context && context.conversation) {
      // Examinar as últimas 5 mensagens em busca de menções a lugares
      const recentMessages = context.conversation.slice(-5);

      for (const message of recentMessages) {
        if (
          message.entities &&
          message.entities.places &&
          message.entities.places.length > 0
        ) {
          // Retornar o lugar mais recente mencionado
          return message.entities.places[0];
        }
      }
    }

    // Verificar no histórico de pesquisa
    if (typeof findLastDestinationFromHistory === "function") {
      const historyDestination = findLastDestinationFromHistory();
      if (historyDestination) return historyDestination;
    }

    return null;
  } catch (error) {
    console.error("[getDestinationFromContext] Erro:", error);
    return null;
  }
}

/**
 * Insere um carrossel de imagens nas mensagens
 * @param {string} placeName - Nome do local para mostrar no carrossel
 */
function insertCarouselInMessages(placeName) {
  try {
    // Verificar parâmetros
    if (!placeName) {
      console.warn("[insertCarouselInMessages] Nome do local inválido");
      return;
    }

    // Importar módulo de carrossel
    import("../../utils/carousel.js")
      .then((module) => {
        if (typeof module.showCarouselInAssistant === "function") {
          module.showCarouselInAssistant(placeName);
        } else {
          console.warn(
            "[insertCarouselInMessages] showCarouselInAssistant não encontrado"
          );
        }
      })
      .catch((error) => {
        console.error(
          "[insertCarouselInMessages] Erro ao importar módulo:",
          error
        );
      });
  } catch (error) {
    console.error(
      "[insertCarouselInMessages] Erro ao inserir carrossel:",
      error
    );
  }
}
