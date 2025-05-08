/**
 * Sistema de mensagens do assistente virtual
 * Este módulo centraliza todas as mensagens pré-definidas e respostas do assistente
 * Utiliza o sistema de tradução para obter as mensagens no idioma correto
 */

import {
  getGeneralText,
  formatText,
  currentLang,
} from "../../i18n/translatePageContent.js";

/**
 * Obtém uma mensagem do sistema de tradução com parâmetros opcionais
 * @param {string} key - A chave de tradução da mensagem
 * @param {Object} params - Parâmetros para substituição na mensagem
 * @returns {string} - A mensagem traduzida com parâmetros aplicados
 */
export function getMessage(key, params = {}) {
  try {
    return formatText(key, params);
  } catch (error) {
    console.error(`[messages] Erro ao formatar mensagem '${key}':`, error);
    return key;
  }
}

/**
 * Define mensagens específicas para diferentes cenários do assistente
 */
export const messages = {
  // Mensagens de boas-vindas e saudações
  greetings: {
    welcome: () => getGeneralText("welcome_message"),
    firstTime: () => getGeneralText("ask_first_time"),
    morning: () => getGeneralText("assistant_greeting_morning"),
    afternoon: () => getGeneralText("assistant_greeting_afternoon"),
    evening: () => getGeneralText("assistant_greeting_evening"),
    default: () => getGeneralText("assistant_greeting"),
  },

  // Mensagens para navegação e rotas
  navigation: {
    routeCreated: (place) => formatText("navigation_started", { place }),
    requestLocation: (place) => formatText("location_requested", { place }),
    creating: (place) => formatText("creating_route", { place }),
    routeNotFound: () => getGeneralText("route_error"),
    destinationMissing: () => getGeneralText("destination_missing"),
    arrived: () => getGeneralText("navigation_arrived"),
    recalculating: () => getGeneralText("navigation_recalculating"),
    startNavigation: () => getGeneralText("navigation_start"),
    stopNavigation: () => getGeneralText("navigation_stop"),
  },

  // Mensagens para favoritos
  favorites: {
    noFavorites: () => getGeneralText("no_favorites"),
    yourFavorites: (places) => formatText("your_favorites", { places }),
    addedToFavorites: (place) =>
      formatText("add_to_favorites_success", { place }),
    removedFromFavorites: (place) =>
      formatText("remove_from_favorites_success", { place }),
  },

  // Mensagens para locais e pontos de interesse
  locations: {
    details: (place, description) =>
      formatText("location_details", { place, description }),
    notFound: () => getGeneralText("location_not_found"),
    showingAll: (category) =>
      formatText("showing_all_locations_category", { category }) ||
      getGeneralText("showing_all_locations"),
    showingLocation: () => getGeneralText("showing_location"),
    showingPhotos: () => getGeneralText("showing_photos"),
    askMoreInfo: () => getGeneralText("ask_more_info"),
    wherePlaceQuestion: (place) =>
      formatText("where_is_place_question", { place }) ||
      `Você gostaria de saber onde fica ${place}?`,
  },

  // Sistema e erros
  system: {
    thinking: () => getGeneralText("assistant_thinking"),
    error: () => getGeneralText("assistant_error"),
    noResults: () => getGeneralText("assistant_no_results"),
    languageChanged: (language) =>
      formatText("language_changed_success", { language }) ||
      `Idioma alterado para ${language}!`,
    voiceEnabled: () => getGeneralText("voice_enabled"),
    voiceDisabled: () => getGeneralText("voice_disabled"),
    voiceChanged: () => getGeneralText("voice_changed"),
    speedAdjusted: () => getGeneralText("speed_adjusted"),
    noVoiceAvailable: () => getGeneralText("no_voice_available"),
    useAnyVoice: () => getGeneralText("use_any_voice"),
  },

  // Mensagens de clima
  weather: {
    current: (temp, condition) =>
      formatText("weather_now", { temp, condition }),
    humidity: (humidity) => formatText("weather_humidity", { humidity }),
    wind: (wind) => formatText("weather_wind", { wind }),
    rain: (rain) => formatText("weather_rain", { rain }),
  },

  // Mensagens de histórico
  history: {
    empty: () =>
      getGeneralText("history_empty") ||
      "Seu histórico está vazio. Gostaria de começar uma nova busca?",
    recent: (historyItems) =>
      getGeneralText("history_recent") ||
      "Seu histórico recente:\n" + historyItems,
    askMore: () =>
      getGeneralText("history_ask_more") ||
      "Deseja saber mais sobre algum desses locais?",
  },

  // Mensagens de configurações
  settings: {
    title: () => getGeneralText("settings_title"),
    language: () => getGeneralText("settings_language"),
    voice: () => getGeneralText("settings_voice"),
    voiceSpeed: () => getGeneralText("settings_voice_speed"),
    voiceEnabled: () => getGeneralText("settings_voice_enabled"),
    theme: () => getGeneralText("settings_theme"),
    themeLight: () => getGeneralText("settings_theme_light"),
    themeDark: () => getGeneralText("settings_theme_dark"),
    themeAuto: () => getGeneralText("settings_theme_auto"),
    close: () => getGeneralText("settings_close"),
  },

  // Mensagens de fallback e default
  fallback: {
    default: () => getGeneralText("default_response"),
    tryAgain: () => getGeneralText("try_again"),
    needHelp: () => getGeneralText("need_help"),
    tutorial: () => getGeneralText("tutorial_offer"),
    notUnderstood: () => getGeneralText("not_understood"),
    difficulties: () =>
      getGeneralText("difficulties_message") ||
      "Parece que você está tendo dificuldades. Deseja ver um tutorial ou falar com um atendente?",
  },

  // Opções comuns para botões
  options: {
    moreDetails: () => getGeneralText("more_details"),
    showPhotos: () => getGeneralText("show_photos"),
    createRoute: () => getGeneralText("create_route"),
    yes: () => getGeneralText("yes"),
    no: () => getGeneralText("no"),
    showAll: () => getGeneralText("show_all"),
    filter: () => getGeneralText("filter"),
    tutorial: () => getGeneralText("tutorial"),
    contactAgent: () =>
      getGeneralText("contact_agent") || "Falar com atendente",
  },

  // Mensagens para categorias
  categories: {
    beaches: () => getGeneralText("category_beaches"),
    restaurants: () => getGeneralText("category_restaurants"),
    hotels: () => getGeneralText("category_hotels"),
    attractions: () => getGeneralText("category_attractions"),
    nightlife: () => getGeneralText("category_nightlife"),
    shops: () => getGeneralText("category_shops"),
    tours: () => getGeneralText("category_tours"),
    emergencies: () => getGeneralText("category_emergencies"),
    allOptions: (category, places) =>
      formatText("places_in_category", {
        category,
        places,
      }) ||
      `Aqui estão as opções de ${category}: ${places}. Qual deles você quer saber mais?`,
    noPlaces: (category) =>
      formatText("no_places_in_category", { category }) ||
      `Não encontrei lugares na categoria ${category}.`,
    searching: (category) =>
      formatText("searching_category", { category }) ||
      `Buscando ${category} no mapa... Gostaria de ver todos ou filtrar por algum nome específico?`,
  },

  // Mensagens para localização do usuário
  userLocation: {
    locating: () =>
      getGeneralText("locating_user") ||
      "Vou localizar você no mapa! Deseja buscar algo próximo a você?",
    permissionNeeded: () =>
      getGeneralText("location_permission_needed") ||
      "Preciso da sua permissão para acessar sua localização.",
    permissionDenied: () =>
      getGeneralText("location_permission_denied") ||
      "Permissão de localização negada. Para usar esta funcionalidade, habilite o acesso à sua localização nas configurações do navegador.",
    error: () =>
      getGeneralText("location_error") ||
      "Não foi possível obter sua localização. Por favor, verifique as permissões e tente novamente.",
  },

  // Mensagens para tutorial
  tutorial: {
    intro: () => getGeneralText("tutorial_message"),
    beaches: () => getGeneralText("tutorial_beaches"),
    restaurants: () => getGeneralText("tutorial_restaurants"),
    hotels: () => getGeneralText("tutorial_hotels"),
  },
};

/**
 * Obtém uma mensagem para categoria específica
 * @param {string} category - Nome da categoria
 * @returns {string} - Nome da categoria traduzido
 */
export function getCategoryName(category) {
  return getGeneralText(`category_${category}`);
}

/**
 * Obtém lista de opções para interação com um local
 * @returns {string[]} - Array com as opções traduzidas
 */
export function getPlaceOptions() {
  return [
    messages.options.moreDetails(),
    messages.options.showPhotos(),
    messages.options.createRoute(),
  ];
}

/**
 * Gera mensagem para exibir lista de locais por categoria
 * @param {string} categoryKey - Chave da categoria
 * @param {Array} places - Lista de locais
 * @returns {string} - Mensagem formatada
 */
export function getLocationListMessage(categoryKey, places) {
  const categoryName = getCategoryName(categoryKey);

  if (!places || places.length === 0) {
    return messages.categories.noPlaces(categoryName);
  }

  const placesList = places.map((p) => p.name).join(", ");
  return messages.categories.allOptions(categoryName, placesList);
}

/**
 * Gera resposta padrão quando nenhuma correspondência foi encontrada
 * @returns {Object} - Objeto de resposta padrão
 */
export function getDefaultResponse() {
  return {
    text: messages.fallback.default(),
  };
}

/**
 * Gera mensagem para tutorial ou ajuda
 * @returns {Object} - Objeto com o texto do tutorial e opções
 */
export function getTutorialResponse() {
  return {
    text: messages.tutorial.intro(),
    options: [
      messages.tutorial.beaches(),
      messages.tutorial.restaurants(),
      messages.tutorial.hotels(),
    ],
  };
}

/**
 * Determina o período do dia e retorna a saudação apropriada
 * @returns {string} - Mensagem de saudação para o período atual do dia
 */
export function getGreetingByTime() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return messages.greetings.morning();
  } else if (hour >= 12 && hour < 18) {
    return messages.greetings.afternoon();
  } else {
    return messages.greetings.evening();
  }
}

/**
 * Formata uma mensagem de histórico
 * @param {Array} historyItems - Itens do histórico de conversa
 * @returns {string} - Texto formatado do histórico
 */
export function formatHistoryMessage(historyItems) {
  if (!historyItems || historyItems.length === 0) {
    return messages.history.empty();
  }

  const formattedHistory = historyItems
    .slice(-5)
    .map((h) => `Você: ${h.input}\nAssistente: ${h.response || ""}`)
    .join("\n\n");

  return (
    messages.history.recent(formattedHistory) +
    "\n" +
    messages.history.askMore()
  );
}

/**
 * Determina o idioma e retorna a mensagem de mudança de idioma
 * @param {string} lang - Código do idioma
 * @returns {string} - Mensagem de confirmação de mudança de idioma
 */
export function getLanguageChangeMessage(lang) {
  // Nomes de idioma para exibição
  const languageNames = {
    pt: "Português",
    en: "English",
    es: "Español",
    he: "עברית",
  };

  return messages.system.languageChanged(languageNames[lang] || lang);
}

export default {
  messages,
  getMessage,
  getCategoryName,
  getPlaceOptions,
  getLocationListMessage,
  getDefaultResponse,
  getTutorialResponse,
  getGreetingByTime,
  formatHistoryMessage,
  getLanguageChangeMessage,
};
