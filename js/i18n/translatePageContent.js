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
    "language-select": "settings_language",
    "voice-select": "settings_voice",
    "voice-speed": "settings_voice_speed",
    "voice-enabled-toggle": "settings_voice_enabled",
    "theme-select": "settings_theme",
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
 * Obtém um texto traduzido com base na chave e no idioma
 * @param {string} key - Chave de tradução
 * @param {string} lang - Código do idioma (opcional)
 * @returns {string} - Texto traduzido ou chave original se não encontrado
 */
export function getGeneralText(key, language = selectedLanguage) {
  // Possível problema: selectedLanguage pode ser objeto quando deveria ser string
  if (typeof language === "object") {
    language = language.code || language.language || "pt";
  }

  // Possível problema: neste ponto, translations[language] pode estar vazio
  if (!translations[language] || !translations[language][key]) {
    console.warn(
      `[getGeneralText] Tradução ausente para: '${key}' em '${language}'`
    );
    // Tentativa com fallback para inglês
    return translations["en"] && translations["en"][key]
      ? translations["en"][key]
      : key;
  }

  return translations[language][key];
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

// Iniciar o pré-carregamento
preloadTranslations();

// Adicionar após a declaração da função showWeatherWidget
document.addEventListener("languageChanged", async () => {
  // Atualizar o widget quando o idioma for alterado
  if (typeof updateWidget === "function") {
    await updateWidget();
  }
});
