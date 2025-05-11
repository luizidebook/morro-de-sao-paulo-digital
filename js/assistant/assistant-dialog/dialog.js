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
import { clearAssistantMessages } from "../assistant.js";
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
  if (!input || typeof input !== "string") {
    return {
      text: "Por favor, digite algo para que eu possa ajudar.",
    };
  }

  // Normalizar texto removendo acentos, convertendo para minúsculas
  const normalizedInput = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  const ctx = getContext();
  const rotaRegex =
    /(como chegar|chegar|criar rota|rota|ir para|como vou para|route to|go to)/i;

  // Verificar se é comando de encerramento de navegação
  const navigationEndTerms = [
    "encerrar navegacao",
    "encerrar navegação",
    "terminar navegacao",
    "terminar navegação",
    "finalizar navegacao",
    "finalizar navegação",
    "cancelar navegacao",
    "cancelar navegação",
    "parar navegacao",
    "parar navegação",
    "sair da navegacao",
    "sair da navegação",
    "desligar navegacao",
    "fechar navegacao",
    "parar rota",
    "cancelar rota",
    "encerrar rota",
    "finalizar rota",
    "terminar rota",
    "voltar ao mapa",
  ];

  // Verificar se algum dos termos de encerramento está presente na entrada normalizada
  const isEndNavigationCommand = navigationEndTerms.some(
    (term) =>
      normalizedInput.includes(term) ||
      // Para capturar frases mais complexas como "quero encerrar a navegação por favor"
      ((normalizedInput.includes("navegacao") ||
        normalizedInput.includes("navegação")) &&
        (normalizedInput.includes("encerrar") ||
          normalizedInput.includes("terminar") ||
          normalizedInput.includes("finalizar") ||
          normalizedInput.includes("parar") ||
          normalizedInput.includes("cancelar") ||
          normalizedInput.includes("sair")))
  );

  if (isEndNavigationCommand) {
    // Verificar se a navegação realmente está ativa antes de tentar cancelar
    const isNavigationActive =
      window.navigationState && window.navigationState.isActive;

    if (isNavigationActive) {
      console.log(
        "[processUserInput] Comando de encerramento de navegação detectado"
      );

      try {
        // Importar a função assincronamente para evitar dependências circulares
        const { cancelNavigation } = await import(
          "../navigation/navigationController/navigationController.js"
        );

        // Executar cancelamento da navegação
        await cancelNavigation();

        return {
          text: "Navegação encerrada. Voltando ao modo de mapa normal.",
          action: () => {
            // Limpar qualquer estado de navegação pendente
            updateContext({
              pendingRoute: null,
              selectedDestination: null,
              lastIntent: "mapa",
            });

            // Se houver uma função específica para atualizar a UI após cancelamento
            if (typeof refreshMapView === "function") {
              refreshMapView();
            }
          },
        };
      } catch (error) {
        console.error("[processUserInput] Erro ao cancelar navegação:", error);

        return {
          text: "Ocorreu um erro ao encerrar a navegação. Por favor, tente novamente ou use o botão de cancelar na interface.",
        };
      }
    } else {
      return {
        text: "Não há navegação ativa no momento.",
      };
    }
  }

  // Exemplo: Resposta contextual para favoritos
  if (
    normalizedInput.includes("favorito") ||
    normalizedInput.includes("favoritos") ||
    normalizedInput.includes("meus lugares")
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
  if (normalizedInput.startsWith("adicionar aos favoritos")) {
    const placeName = normalizedInput
      .replace("adicionar aos favoritos", "")
      .trim();
    if (placeName) {
      addFavorite(placeName);
      return {
        text: messages.favorites.addedToFavorites(placeName),
      };
    }
  }

  if (normalizedInput.startsWith("remover dos favoritos")) {
    const placeName = normalizedInput
      .replace("remover dos favoritos", "")
      .trim();
    if (placeName) {
      removeFavorite(placeName);
      return {
        text: messages.favorites.removedFromFavorites(placeName),
      };
    }
  }

  // Exemplo: Histórico de conversa
  if (normalizedInput === "historico" || normalizedInput === "meu historico") {
    const history = getContext().history;
    return {
      text: formatHistoryMessage(history),
    };
  }

  // Exemplo: Contexto de espera ("awaiting")
  const awaiting = getAwaiting();
  if (awaiting && awaiting.type === "selecionar_local") {
    const selected = normalizedInput;
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
    (normalizedInput === "fotos" || normalizedInput === "imagens")
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
    (normalizedInput === "ver todos" || normalizedInput === "mostrar todos")
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
    normalizedInput.includes(loc.name.toLowerCase())
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
  const ondeFicaMatch = normalizedInput.match(
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
        if (cat.keywords.some((word) => normalizedInput.includes(word))) {
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
      cat.keywords.some((word) => normalizedInput.includes(word))
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
    normalizedInput.includes("minha localizacao") ||
    normalizedInput.includes("onde estou") ||
    normalizedInput.includes("me encontre") ||
    normalizedInput.includes("localizacao atual") ||
    normalizedInput.includes("my location") ||
    normalizedInput.includes("find me")
  ) {
    return {
      text: messages.userLocation.locating(),
      action: () => requestAndTrackUserLocation(),
    };
  }

  // 4. Rota para um local
  if (rotaRegex.test(normalizedInput)) {
    console.log(
      "[processUserInput] Detecção de comando de rota:",
      normalizedInput
    );

    let destino = allPlaces.find((loc) =>
      normalizedInput.includes(loc.name.toLowerCase())
    );
    if (!destino) {
      destino = findLastDestinationFromHistory();
      console.log(
        "[processUserInput] Destino encontrado no histórico:",
        destino
      );
    } else {
      console.log("[processUserInput] Destino encontrado direto:", destino);
    }

    if (destino) {
      if (!context.userLocation) {
        console.log(
          "[processUserInput] Usuário ainda não compartilhou localização."
        );
        return {
          text: messages.navigation.requestLocation(destino.name),
          action: () => {
            updateContext({
              pendingRoute: destino,
              selectedDestination: destino,
              lastIntent: "rota",
            });
            requestAndTrackUserLocation();
          },
        };
      } else {
        updateContext({ lastIntent: "rota" });
        return {
          text: messages.navigation.creating(destino.name),
          action: () => {
            showRoute(destino);
          },
        };
      }
    } else {
      console.log("[processUserInput] Nenhum destino encontrado.");
      return {
        text: messages.navigation.destinationMissing(),
      };
    }
  }

  // Detecta resposta afirmativa para navegação guiada - MODIFICADO
  if (
    /(iniciar navegação|navegação guiada|começar navegação|sim|iniciar|guiada|confirmar)/i.test(
      normalizedInput
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
        startNavigation(destino);
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
