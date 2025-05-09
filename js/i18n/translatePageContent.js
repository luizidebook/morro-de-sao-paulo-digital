// Sistema de tradução aprimorado para suportar múltiplos idiomas

// Exportar currentLang como uma variável que pode ser atualizada
export let currentLang = "pt";
export let selectedLanguage = "pt"; // Idioma selecionado, padrão é português

// Cache de traduções carregadas
const loadedTranslations = {};
// Objeto para armazenar todas as traduções
const translations = {};

/**
 * Carrega o arquivo de tradução de forma assíncrona
 * @param {string} lang - Código do idioma (ex: 'pt', 'en', 'es', 'he')
 * @returns {Promise<object>} - Objeto com as traduções
 */
async function loadTranslationFile(lang) {
  if (loadedTranslations[lang]) return loadedTranslations[lang];

  try {
    // Importar dinamicamente o arquivo de tradução
    const module = await import(`./${lang}.js`);
    const translationData = module.default;

    // Cache das traduções
    loadedTranslations[lang] = translationData;
    translations[lang] = translationData;

    console.log(
      `[translatePageContent] Carregado arquivo de tradução para: ${lang}`
    );
    return translationData;
  } catch (error) {
    console.error(
      `[translatePageContent] Erro ao carregar traduções para ${lang}:`,
      error
    );
    return null;
  }
}

/**
 * Carrega o arquivo de tradução com base no idioma e aplica à página.
 * @param {string} lang - Código do idioma (ex: 'pt', 'en', 'es', 'he').
 * @param {boolean} isInitialLoad - Indica se é a carga inicial
 * @returns {Promise<string>} - O código do idioma aplicado
 */
export async function translatePageContent(lang = "pt", isInitialLoad = false) {
  // Atualizar a variável global de idioma
  currentLang = lang;

  console.log(`[translatePageContent] Aplicando tradução para: ${lang}`);

  try {
    // Garantir que temos as traduções para este idioma
    await loadTranslationFile(lang);

    // Atualizar elementos com atributo data-i18n
    const elements = document.querySelectorAll("[data-i18n]");
    elements.forEach((el) => {
      // Ignorar botões com classe icon-only-button
      if (el.classList.contains("icon-only-button") || el.id === "sendButton") {
        return;
      }

      const key = el.getAttribute("data-i18n");
      const text = getGeneralText(key, lang);
      if (text) el.textContent = text;
    });

    // Atualizar placeholders
    const inputElements = document.querySelectorAll(
      "input[data-i18n-placeholder], textarea[data-i18n-placeholder]"
    );
    inputElements.forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      const text = getGeneralText(key, lang);
      if (text) el.placeholder = text;
    });

    // Atualizar atributos title
    const titleElements = document.querySelectorAll("[data-i18n-title]");
    titleElements.forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      const text = getGeneralText(key, lang);
      if (text) el.title = text;
    });

    // Atualizar atributos aria-label (exceto para botões de ícones)
    const ariaElements = document.querySelectorAll("[data-i18n-aria]");
    ariaElements.forEach((el) => {
      // Verificar se é um botão de ícone
      if (
        el.id === "sendButton" ||
        el.id === "voiceButton" ||
        el.id === "configButton"
      ) {
        return;
      }

      const key = el.getAttribute("data-i18n-aria");
      const text = getGeneralText(key, lang);
      if (text) el.setAttribute("aria-label", text);
    });

    // Atualizar o campo do assistente virtual
    const assistantInput = document.getElementById("assistantInput");
    if (assistantInput) {
      const placeholder = getGeneralText("input_placeholder", lang);
      if (placeholder) assistantInput.placeholder = placeholder;
    }

    // NÃO ATUALIZAR o botão de enviar - manter a estrutura original
    const sendButton = document.getElementById("sendButton");
    if (sendButton) {
      // Garantir que o sendButton mantenha apenas o ícone
      if (
        sendButton.childElementCount === 0 ||
        !sendButton.querySelector(".fas")
      ) {
        sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
      }
    }

    // Atualizar configurações do assistente
    updateAssistantSettings(lang);

    // Disparar evento customizado para que outros componentes possam reagir à mudança de idioma
    // CORREÇÃO: O bloco abaixo estava incompleto e causando um erro de sintaxe
    document.dispatchEvent(
      new CustomEvent("languageChanged", {
        detail: {
          language: lang,
          translations: translations[lang] || {},
          isInitialLoad: isInitialLoad,
        },
      })
    );

    return lang;
  } catch (error) {
    console.error(`[translatePageContent] Erro ao traduzir conteúdo:`, error);
    return lang;
  }
}

/**
 * Atualiza elementos específicos do painel de configurações do assistente
 * @param {string} lang - Código do idioma
 */
function updateAssistantSettings(lang) {
  // Título do painel de configurações
  const configTitle = document.querySelector(".config-panel-header h3");
  if (configTitle) {
    const title = getGeneralText("settings_title", lang);
    if (title) configTitle.textContent = title;
  }

  // Labels para as configurações
  const configLabels = {
    language_select: "settings_language",
    voice_select: "settings_voice",
    voice_speed: "settings_voice_speed",
    voice_enabled_toggle: "settings_voice_enabled",
    theme_select: "settings_theme",
    settings_title: "Configurações",
    settings_close: "Fechar",
    settings_language: "Idioma",
    settings_voice: "Voz",
    settings_voice_speed: "Velocidade da voz",
    settings_voice_enabled: "Voz ativada",
    settings_theme: "Tema",
    settings_theme_light: "Claro",
    settings_theme_dark: "Escuro",
    settings_theme_auto: "Automático",
  };

  for (const [id, key] of Object.entries(configLabels)) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) {
      const text = getGeneralText(key, lang);
      // Preservar o conteúdo após o ":" para velocidade da voz
      if (key === "settings_voice_speed" && label.childNodes.length > 1) {
        const spanElement = label.querySelector("span");
        if (spanElement) {
          const spanValue = spanElement.textContent;
          if (text) label.childNodes[0].textContent = `${text}: `;
        }
      } else if (text) {
        label.textContent = text;
      }
    }
  }

  // Opções de tema
  const themeOptions = {
    light: "settings_theme_light",
    dark: "settings_theme_dark",
    auto: "settings_theme_auto",
  };

  const themeSelect = document.getElementById("theme-select");
  if (themeSelect) {
    Array.from(themeSelect.options).forEach((option) => {
      const key = themeOptions[option.value];
      if (key) {
        const text = getGeneralText(key, lang);
        if (text) option.textContent = text;
      }
    });
  }

  // Botão de fechar
  const closeButton = document.getElementById("close-config-panel");
  if (closeButton) {
    const closeText = getGeneralText("settings_close", lang);
    if (closeText) closeButton.setAttribute("aria-label", closeText);
  }
}

/**
 * Obter texto geral para o idioma atual
 * @param {string} key - Chave da tradução
 * @param {string} [lang] - Código do idioma (opcional, usa o atual se omitido)
 * @returns {string} - Texto traduzido ou chave original se não encontrado
 */
export function getGeneralText(key, lang = null) {
  // Usar idioma fornecido ou o atual
  const currentLang = lang || getCurrentLanguage();

  try {
    const translations = getTranslations(currentLang);

    if (translations && translations[key]) {
      return translations[key];
    }

    // Tentar buscar em inglês como fallback
    if (currentLang !== "en") {
      const enTranslations = getTranslations("en");
      if (enTranslations && enTranslations[key]) {
        return enTranslations[key];
      }
    }

    console.warn(
      `[getGeneralText] Tradução ausente para: '${key}' em '${currentLang}'`
    );
    return key;
  } catch (error) {
    console.error(
      `[getGeneralText] Erro ao obter tradução para: ${key}`,
      error
    );
    return key;
  }
}

/**
 * Obter o idioma atual da aplicação
 * @returns {string} - Código do idioma
 */
export function getCurrentLanguage() {
  // Verificar localStorage primeiro
  const storedLang = localStorage.getItem("app-language");
  if (storedLang) return storedLang;

  // Verificar objeto de configuração global
  if (window.appConfig && window.appConfig.language) {
    return window.appConfig.language;
  }

  // Verificar atributo lang do HTML
  const htmlLang = document.documentElement.lang;
  if (htmlLang) return htmlLang;

  // Usar idioma do navegador como fallback
  return navigator.language.split("-")[0] || "en";
}

/**
 * Obtém as traduções para um idioma específico
 * @param {string} lang - Código do idioma
 * @returns {Object} - Objeto com as traduções
 */
function getTranslations(lang) {
  // 1. Verificar cache do objeto global translationsCache
  if (window.translationsCache && window.translationsCache[lang]) {
    return window.translationsCache[lang];
  }

  // 2. Verificar se as traduções já foram carregadas pelo sistema de módulos
  if (loadedTranslations && loadedTranslations[lang]) {
    // Se disponível no objeto de módulo, armazenar no cache global também
    if (!window.translationsCache) window.translationsCache = {};
    window.translationsCache[lang] = loadedTranslations[lang];
    return loadedTranslations[lang];
  }

  // 3. Tentar carregar o arquivo sob demanda (sem bloquear a thread)
  try {
    if (!window.translationsCache) window.translationsCache = {};

    // Inicializar com alguns textos básicos
    const basicTranslations = {
      welcome_message:
        "👋 Olá! Sou o assistente virtual do Morro Digital. Como posso ajudar você hoje?",
      ask_first_time:
        "É a sua primeira vez em Morro de São Paulo? Posso te mostrar os melhores lugares para visitar.",
      input_placeholder: "Digite o texto aqui...",

      settings_title: "Configurações",
      settings_close: "Fechar",
      settings_language: "Idioma",
      settings_voice: "Voz",
      settings_voice_speed: "Velocidade da voz",
      settings_voice_enabled: "Voz ativada",
      settings_theme: "Tema",
      settings_theme_light: "Claro",
      settings_theme_dark: "Escuro",
      settings_theme_auto: "Automático",
      settings_language_select: "Selecione o idioma",

      calculating_route: "Calculando rota...",
      location_error: "Erro ao obter localização",
      route_error: "Erro ao calcular rota",
      recalculating: "Recalculando rota...",
      navigation_arrived: "Você chegou ao seu destino!",
      routeDeviated: "Você se desviou da rota",
      offRoute: "Fora da rota",
      routeRecalculatedOk: "Rota recalculada com sucesso",
      noInstructions: "Sem instruções disponíveis",

      // Adicionar direções de navegação críticas

      // Traduções para navegação
      calculating_route_to: "Calculando rota para",
      navigation_head_southwest_on_rua_do_farol:
        "Siga na direção sudoeste pela Rua do Farol",
      navigation_head_south_on_escada_da_rua_do_farol:
        "Siga ao sul pela Escada da Rua do Farol",
      navigation_turn_slight_left: "Faça uma leve curva à esquerda",
      navigation_turn_left_onto_praça_aureliano_lima:
        "Vire à esquerda na Praça Aureliano Lima",
      navigation_turn_slight_left_onto_rua_caminho_da_praia:
        "Faça uma leve curva à esquerda na Rua Caminho da Praia",
      navigation_turn_slight_right_onto_rua_caminho_da_praia:
        "Faça uma leve curva à direita na Rua Caminho da Praia",
      navigation_turn_right: "Vire à direita",
      navigation_on: "na",
      navigation_for: "por",
      navigation_arrive_at_your_destination: "Chegou ao seu destino",
      navigation_turn_left: "Vire à esquerda",
      navigation_turn_right: "Vire à direita",
      navigation_turn_slight_left: "Vire ligeiramente à esquerda",
      navigation_turn_slight_right: "Vire ligeiramente à direita",
      navigation_turn_sharp_left: "Faça uma curva fechada à esquerda",
      navigation_turn_sharp_right: "Faça uma curva fechada à direita",
      navigation_continue: "Continue em frente",
      navigation_arrive_at_your_destination: "Chegou ao seu destino",
      "navigation_arrive_at_your_destination,_on_the_right":
        "Chegou ao seu destino, à direita",
      "navigation_arrive_at_your_destination,_on_the_left":
        "Chegou ao seu destino, à esquerda",
      navigation_head_southwest: "Siga ao sudoeste",
      navigation_head_south: "Siga ao sul",
      navigation_head_southeast: "Siga ao sudeste",
      navigation_head_east: "Siga ao leste",
      navigation_head_northeast: "Siga ao nordeste",
      navigation_head_north: "Siga ao norte",
      navigation_head_northwest: "Siga ao noroeste",
      navigation_head_west: "Siga ao oeste",
      navigation_on: "em",
      navigation_for: "por",
      navigation_arrived: "Você chegou ao seu destino!",
      recalculating: "Recalculando rota...",
      routeDeviated: "Você saiu da rota. Recalculando...",
      routeRecalculatedOk: "Rota recalculada com sucesso!",
      recalculation_failed: "Falha ao recalcular rota",
      locating: "Obtendo sua localização...",
      navigation_continue_straight: "Siga em frente",
      navigation_arrived: "Chegou ao destino",
      navigation_arrive_destination: "Chegou ao seu destino",
      navigation_head: "Siga",
      navigation_head_southwest_on_escada_da_rua_do_farol:
        "Siga ao sudoeste pela Escada da Rua do Farol",
      navigation_arrive_at_your_destination_on_the_left:
        "Chegou ao seu destino, à esquerda",
      navigation_arrive_at_your_destination_on_the_right:
        "Chegou ao seu destino, à direita",
      // Adicione estas traduções para clima
      // Meteorologia
      weather_high: "Máxima",
      weather_low: "Mínima",
      weather_rain: "Chuva",
      weather_humidity: "Umidade",
      weather_wind: "Vento",
      weather_wind_unit: "km/h",
      weather_visibility: "Visibilidade",
      weather_visibility_good: "Boa",
      weather_today: "Hoje",
      weather_error_fetch:
        "Não foi possível obter dados meteorológicos. Tente novamente mais tarde.",

      // Condições climáticas
      weather_thunderstorm: "Tempestades com trovoadas",
      weather_thunderstorm_rain: "Tempestades com chuva",
      weather_heavy_rain: "Chuva forte",
      weather_light_rain: "Chuva leve",
      weather_rain: "Chuva",
      weather_shower: "Pancadas de chuva",
      weather_partly_cloudy: "Parcialmente nublado",
      weather_mostly_cloudy: "Majoritariamente nublado",
      weather_overcast: "Encoberto",
      weather_cloudy: "Nublado",
      weather_fog: "Névoa ou neblina",
      weather_clear: "Céu limpo",
      weather_sunny: "Ensolarado",
      weather_snow: "Neve",
      weather_hail: "Granizo",
      weather_sleet: "Aguaneve",
      weather_fair: "Bom tempo",
      weather_unknown: "Sem informações",
      weather_chuva: "Chuva",
      weather_rain_light: "Chuva leve",
      weather_rain_moderate: "Chuva moderada",
      weather_rain_heavy: "Chuva forte",
      weather_clear_day: "Céu limpo (dia)",
      weather_clear_night: "Céu limpo (noite)",
      weather_cloudy: "Nublado",
      weather_fog: "Neblina",
      weather_freezing_rain: "Chuva congelante",
      weather_ice_pellets: "Granizo",
      weather_ice_pellets_heavy: "Granizo forte",
      weather_ice_pellets_light: "Granizo leve",
      weather_mostly_clear_day: "Predominantemente limpo (dia)",
      weather_mostly_clear_night: "Predominantemente limpo (noite)",
      weather_mostly_cloudy_day: "Predominantemente nublado (dia)",
      weather_mostly_cloudy_night: "Predominantemente nublado (noite)",
      weather_partly_cloudy_day: "Parcialmente nublado (dia)",
      weather_partly_cloudy_night: "Parcialmente nublado (noite)",
      weather_snow: "Neve",
      weather_snow_heavy: "Neve forte",
      weather_snow_light: "Neve leve",
      weather_thunderstorm: "Tempestade com trovoadas",
      weather_hurricane: "Furacão",
      weather_tropical_storm: "Tempestade tropical",

      // Dicas de clima
      weather_tip_storm:
        "💡 Recomendamos evitar sair durante tempestades. Se necessário, fique longe de árvores e postes.",
      weather_tip_heavy_rain:
        "💡 Não se esqueça de levar um guarda-chuva ou capa de chuva hoje!",
      weather_tip_rain_chance:
        "💡 Há chance de chuva, considere levar um guarda-chuva.",
      weather_tip_hot:
        "💡 Dia quente! Use protetor solar, mantenha-se hidratado e procure áreas com sombra.",
      weather_tip_cool:
        "💡 O dia está fresco, leve um agasalho leve para aproveitar melhor seu passeio.",
      weather_tip_sunny:
        "💡 Dia ensolarado perfeito para aproveitar as praias! Não esqueça o protetor solar.",
      weather_tip_cloudy:
        "💡 Dia nublado, bom para caminhadas mais longas sem calor excessivo.",
      weather_tip_fog:
        "💡 Com névoa, tenha atenção redobrada em trilhas e caminhos.",
      weather_tip_default: "💡 Aproveite seu dia em Morro de São Paulo!",

      // Marés
      tide_forecast: "Previsão da Maré",
      tide_data_unavailable:
        "Dados de maré não disponíveis para este dia. Por favor, tente novamente mais tarde.",
      tide_high: "Preamar (Alta)",
      tide_low: "Baixa-mar",
      tide_high_single: "Alta",
      tide_low_single: "Baixa",
      tide_high_type: "alta",
      tide_low_type: "baixa",
      not_available: "Não disponível",

      // Formatação de tempo para marés
      tide_time_hours_minutes:
        "{hours}h{minutes, plural, =0 {} other { {minutes}min}}",
      tide_time_minutes: "{minutes} minutos",

      // Alertas de maré
      tide_alert_title: "Alerta de Maré {type}",
      tide_alert_message:
        "Próxima maré {type} em {time} ({hour}). Nível previsto: {level}m.",

      // Previsão matinal
      weather_morning_forecast_title: "Bom dia! ☀️ Previsão de hoje",
      weather_morning_forecast:
        "Hoje teremos máxima de {high}°C, mínima de {low}°C. Clima {condition}.",

      // Novas entradas para o português
      weather_click_here: "Clique aqui",
      weather_update_error: "Não foi possível atualizar o clima.",
      weather_clear_conditions: "Condições claras",
    };

    // Armazenar as traduções básicas
    window.translationsCache[lang] = basicTranslations;

    // Iniciar carregamento assíncrono do arquivo de tradução completo
    loadTranslationFile(lang)
      .then((translations) => {
        if (translations) {
          // Quando o arquivo for carregado, atualizar o cache
          window.translationsCache[lang] = {
            ...window.translationsCache[lang],
            ...translations,
          };
          console.log(
            `[getTranslations] Carregamento assíncrono de traduções para ${lang} concluído.`
          );
        }
      })
      .catch((error) => {
        console.error(
          `[getTranslations] Erro ao carregar traduções assíncronas para ${lang}:`,
          error
        );
      });

    // Retornar as traduções básicas enquanto aguarda o carregamento completo
    return basicTranslations;
  } catch (error) {
    console.error(
      `[getTranslations] Erro ao processar traduções para: ${lang}`,
      error
    );

    // Em caso de erro, retornar um objeto vazio para evitar erros em cascata
    return {};
  }
}

/**
 * Formata uma string de tradução com parâmetros
 * @param {string} key - Chave de tradução
 * @param {object} params - Objeto com os parâmetros para substituição
 * @param {string} lang - Código do idioma (opcional)
 * @returns {string} - Texto traduzido com parâmetros substituídos
 */
export function formatText(key, params = {}, lang = currentLang) {
  let text = getGeneralText(key, lang);

  if (!text) return key;

  // Substituir parâmetros no formato {paramName}
  for (const [param, value] of Object.entries(params)) {
    text = text.replace(new RegExp(`{${param}}`, "g"), value);
  }

  return text; // Esta linha estava faltando
}

/**
 * Carrega traduções adicionais de uma fonte externa
 * @param {string} lang - Código do idioma
 * @returns {Promise<object>} - Objeto com as traduções adicionais
 */
export async function loadExtraTranslations(lang) {
  if (!lang) return null;

  try {
    // Verificar se já temos estas traduções no cache
    if (loadedTranslations[`extra_${lang}`]) {
      return loadedTranslations[`extra_${lang}`];
    }

    // Carregar arquivo adicional de tradução
    const response = await fetch(`/locales/${lang}.json`);
    if (!response.ok) {
      throw new Error(`Falha ao carregar traduções para ${lang}`);
    }

    const extraTranslations = await response.json();
    loadedTranslations[`extra_${lang}`] = extraTranslations;

    // Mesclar com as traduções existentes
    if (!translations[lang]) translations[lang] = {};
    Object.assign(translations[lang], extraTranslations);

    console.log(
      `[translatePageContent] Carregadas ${
        Object.keys(extraTranslations).length
      } traduções adicionais para ${lang}`
    );
    return extraTranslations;
  } catch (error) {
    console.error(
      `[translatePageContent] Erro ao carregar traduções: ${error.message}`
    );
    return null;
  }
}

// Pré-carregar os idiomas principais para melhorar a experiência do usuário
export function preloadTranslations() {
  const languages = ["pt", "en", "es", "he"];

  Promise.all(languages.map((lang) => loadTranslationFile(lang)))
    .then(() => {
      console.log("[translatePageContent] Idiomas pré-carregados com sucesso!");
    })
    .catch((error) => {
      console.error(
        "[translatePageContent] Erro ao pré-carregar idiomas:",
        error
      );
    });
}
