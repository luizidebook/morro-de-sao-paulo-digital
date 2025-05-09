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

// Novas queries Overpass (use exatamente estas chaves)
const queries = {
  touristSpots:
    '[out:json];node["tourism"="attraction"](around:10000,-13.376,-38.917);out body;',
  tours:
    '[out:json];node["tourism"="information"](around:10000,-13.376,-38.917);out body;',
  beaches:
    '[out:json];node["natural"="beach"](around:10000,-13.376,-38.917);out body;',
  nightlife:
    '[out:json];node["amenity"="nightclub"](around:10000,-13.376,-38.917);out body;',
  restaurants:
    '[out:json];node["amenity"="restaurant"](around:10000,-13.376,-38.917);out body;',
  inns: '[out:json];node["tourism"="hotel"](around:10000,-13.376,-38.917);out body;',
  shops: '[out:json];node["shop"](around:10000,-13.376,-38.917);out body;',
  emergencies:
    '[out:json];node["amenity"~"hospital|police"](around:10000,-13.376,-38.917);out body;',
};

// Função utilitária para filtrar locais pelo raio de 10km do ponto central
function isWithinRadius(
  lat,
  lon,
  centerLat = -13.376,
  centerLon = -38.917,
  radiusMeters = 10000
) {
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
}

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

// Função auxiliar para buscar detalhes completos pelo nome
function findGeoJSONDetailsByName(name) {
  return dadosGeoJSON.features.find(
    (f) =>
      f.properties &&
      f.properties.name &&
      f.properties.name.toLowerCase() === name.toLowerCase()
  );
}

// Função para obter um breve resumo do local (description do locations.js ou dadosGeoJSON)
function getBriefDescription(place) {
  if (place.description) return place.description;
  const geo = findGeoJSONDetailsByName(place.name);
  if (geo && geo.properties && geo.properties.description)
    return geo.properties.description;
  return "Sem descrição disponível.";
}

// Junta todos os locais em uma lista única
const allPlaces = [];
Object.entries(locations).forEach(([category, items]) => {
  items.forEach((loc) => {
    if (loc.name && loc.lat && loc.lon && isWithinRadius(loc.lat, loc.lon)) {
      allPlaces.push({
        ...loc,
        category,
      });
    }
  });
});

// Agora sim, defina a função que usa allPlaces
function findLastDestinationFromHistory() {
  const history = getHistory();
  // Procura nas duas últimas mensagens do usuário
  for (let i = history.length - 1; i >= 0 && i >= history.length - 2; i--) {
    const input = history[i]?.input?.toLowerCase();
    if (!input) continue;
    // Procura por nome de local conhecido
    const place = allPlaces.find((loc) =>
      input.includes(loc.name.toLowerCase())
    );
    if (place) return place;
  }
  return null;
}

/**
 * Processa a mensagem do usuário, define resposta e ação.
 * @param {string} input - Texto do usuário.
 * @param {object} context - Contexto atual da aplicação (ex: { map, lastPlace })
 * @returns {Promise<{ text: string, action?: Function, options?: string[], context?: object }>}
 */
export async function processUserInput(input, context = {}) {
  const ctx = getContext();
  const normalized = input.trim().toLowerCase();
  const navigateRegex =
    /(como chegar|chegar|criar rota|rota|ir para|como vou para|navegar para|route to|go to)/i;

  // Exemplo: Resposta contextual para favoritos
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

  // Exemplo: Adicionar/remover favorito
  if (normalized.startsWith("adicionar aos favoritos")) {
    const placeName = normalized.replace("adicionar aos favoritos", "").trim();
    if (placeName) {
      addFavorite(placeName);
      return {
        text: messages.favorites.addedToFavorites(placeName),
      };
    }
  }

  if (normalized.startsWith("remover dos favoritos")) {
    const placeName = normalized.replace("remover dos favoritos", "").trim();
    if (placeName) {
      removeFavorite(placeName);
      return {
        text: messages.favorites.removedFromFavorites(placeName),
      };
    }
  }

  // Exemplo: Histórico de conversa
  if (normalized === "histórico" || normalized === "meu histórico") {
    const history = getContext().history;
    return {
      text: formatHistoryMessage(history),
    };
  }

  // Exemplo: Contexto de espera ("awaiting")
  const awaiting = getAwaiting();
  if (awaiting && awaiting.type === "selecionar_local") {
    const selected = normalized;
    const place = allPlaces.find((loc) => loc.name.toLowerCase() === selected);
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

  // Exemplo: Sugestão baseada em última intenção - FOTOS
  // Substitua este bloco nas linhas 421-450
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

  // Exemplo: Sugestão baseada em última categoria
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

  // Exemplo: Contexto de fallback inteligente
  if (ctx.fallbackCount >= 2) {
    resetFallback();
    return {
      text: messages.fallback.difficulties(),
      options: [messages.options.tutorial(), messages.options.contactAgent()],
    };
  }

  // 1. Busca por nome exato ou parcial (mostra resumo, mas NÃO exibe fotos automaticamente)
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

  // 1.1. Perguntas do tipo "onde fica" ou "onde está"
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

  // 2. Busca por categoria e oferece opções (usando apenas locais dentro do raio)
  for (const cat of categories) {
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
    // Busca OSM (Overpass) para todas as categorias
    if (
      cat.queryKey &&
      cat.keywords.some((word) => normalized.includes(word))
    ) {
      return {
        text: messages.categories.searching(getCategoryName(cat.key)),
        action: async () => {
          const results = await fetchOSMData(
            cat.queryKey,
            queries[cat.queryKey]
          );
          const filtered = (results || []).filter(
            (r) => r.lat && r.lon && isWithinRadius(r.lat, r.lon)
          );
          if (filtered.length > 0) {
            showAllLocationsOnMap(filtered);
          }
        },
      };
    }
  }

  // 3. Localização do usuário
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

  // 4. Rota para um local (Melhorado)
  if (navigateRegex.test(normalized)) {
    console.log("[processUserInput] Detecção de comando de rota:", normalized);

    // Obter último destino da conversa ou destino explícito
    let destination =
      getDestinationFromContext() || getDestinationFromInput(normalized);

    if (!destination) {
      // Tente buscar do histórico como fallback
      destination = findLastDestinationFromHistory();
      console.log(
        "[processUserInput] Destino encontrado no histórico:",
        destination
      );
    }

    if (destination) {
      console.log("[processUserInput] Destino encontrado:", destination);

      // Verificar se temos localização do usuário
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

        // Mostrar mensagem
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

            // Garantir os campos no formato correto
            const normalizedDestination = normalizeDestination(destination);

            // Iniciar navegação usando a função adequada
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

        // Garantir os campos no formato correto
        const normalizedDestination = normalizeDestination(destination);

        // Iniciar navegação
        startNavigationSafely(normalizedDestination);
      }

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

  // Detecta resposta afirmativa para navegação guiada - MODIFICADO
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

    // Verificar se temos destino selecionado (sem verificar lastIntent)
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

    // Limpar mensagens antigas
    clearAssistantMessages(
      (msg) =>
        msg.textContent &&
        (msg.textContent.includes("Deseja iniciar uma navegação guiada") ||
          msg.textContent.includes("Rota calculada com sucesso") ||
          msg.textContent.includes("Rota criada para"))
    );

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
        // Fallback para texto genérico caso estrutura de mensagens esteja incorreta
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
        // Garantir os campos no formato correto antes de iniciar navegação
        const normalizedDestination = normalizeDestination(destino);
        startNavigation(normalizedDestination);
      },
    };
  }

  // 5. Resposta padrão se não encontrou nada
  const result = getDefaultResponse();

  if (result.context) {
    updateContext(result.context);
  }
  if (result.action) {
    result.action();
  }

  return result;
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
  // Verificar se temos pelo menos as coordenadas básicas
  if (!destination.lat && !destination.latitude) {
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
}

/**
 * Inicia a navegação com tratamento de erros
 * @param {Object} destination - Destino normalizado
 * @returns {boolean} - Se a navegação foi iniciada
 */
function startNavigationSafely(destination) {
  try {
    console.log(
      "[startNavigationSafely] Tentando iniciar navegação para:",
      destination.name
    );

    // Tentativa com versão global
    if (typeof window.startNavigation === "function") {
      console.log(
        "[startNavigationSafely] Usando função global startNavigation"
      );
      window.startNavigation(destination);
      return true;
    }
    // Tentativa com importação
    else if (typeof startNavigation === "function") {
      console.log(
        "[startNavigationSafely] Usando função importada startNavigation"
      );
      startNavigation(destination);
      return true;
    }
    // Tentativa de importação dinâmica
    else {
      console.log("[startNavigationSafely] Tentando importação dinâmica");
      import("../../navigation/navigationController/navigationController.js")
        .then((module) => {
          if (typeof module.startNavigation === "function") {
            console.log(
              "[startNavigationSafely] Função encontrada via importação dinâmica"
            );
            module.startNavigation(destination);
          } else {
            throw new Error("Função startNavigation não encontrada no módulo");
          }
        })
        .catch((error) => {
          console.error(
            "[startNavigationSafely] Erro na importação dinâmica:",
            error
          );
          appendMessage(
            "assistant",
            "Desculpe, não consegui iniciar a navegação. Sistema temporariamente indisponível.",
            { speakMessage: true }
          );
        });

      return true;
    }
  } catch (error) {
    console.error("[startNavigationSafely] Erro ao iniciar navegação:", error);
    appendMessage(
      "assistant",
      "Desculpe, ocorreu um erro ao iniciar a navegação. Por favor, tente novamente.",
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
  const normalizedInput = input.toLowerCase();

  // Remover o comando de navegação para isolar o nome do destino
  const commands = [
    "como chegar",
    "navegar para",
    "ir para",
    "rota para",
    "chegar em",
    "chegar na",
    "chegar no",
  ];
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

  // Buscar correspondência na lista de lugares
  for (const place of allPlaces) {
    if (
      (place.name && place.name.toLowerCase().includes(potentialDestName)) ||
      potentialDestName.includes(place.name.toLowerCase())
    ) {
      console.log("[getDestinationFromInput] Destino encontrado:", place.name);
      return place;
    }
  }

  // Tentar encontrar correspondência parcial
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
}

/**
 * Extrai categoria a partir do texto do usuário
 * @param {string} input - Texto do usuário
 * @returns {string|null} - Categoria encontrada ou null
 */
function extractCategoryFromInput(input) {
  const normalizedInput = input.toLowerCase();

  // Verificar categorias comuns
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
}

/**
 * Obter nome da categoria em português
 * @param {string} category - Nome da categoria em inglês
 * @returns {string} - Nome em português
 */
function getCategoryNamePortuguese(category) {
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
  if (locations && locations[category] && Array.isArray(locations[category])) {
    return locations[category].filter(
      (place) => place.name && place.lat && place.lon
    );
  }
  return [];
}

// Função auxiliar para determinar o ícone com base na categoria
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

// Função auxiliar para extrair destino do contexto
function getDestinationFromContext() {
  // Verificar se temos algum destino no contexto
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
}

/**
 * Função auxiliar para inserir carrossel nas mensagens
 * @param {string} placeName - Nome do local para mostrar no carrossel
 */
function insertCarouselInMessages(placeName) {
  // Verificar se temos o módulo de carrossel disponível
  if (typeof startCarousel !== "function") {
    console.warn(
      "[insertCarouselInMessages] Função startCarousel não encontrada"
    );
    return;
  }

  try {
    // Importar módulo para exibir carrossel
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
