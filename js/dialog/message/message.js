/**
 * Sistema de Mensagens do Assistente Virtual
 * =========================================
 *
 * Este módulo gerencia a exibição, formatação e processamento de mensagens
 * trocadas entre o usuário e o assistente virtual, incluindo respostas
 * contextuais e elementos interativos da interface.
 *
 * SUMÁRIO:
 * 1. Importações e configuração
 * 2. Exibição de mensagens
 *    - Adição de mensagens à interface
 *    - Indicadores de digitação
 *    - Formatação de conteúdo
 * 3. Processamento de mensagens
 *    - Análise de intenção
 *    - Geração de respostas
 *    - Execução de ações
 * 4. Interações contextuais
 *    - Elementos interativos
 *    - Opções baseadas em contexto
 * 5. Respostas multilíngues
 * 6. Funções utilitárias
 * 7. Exportações e API pública
 */

//============================================================================
// 1. IMPORTAÇÕES E CONFIGURAÇÃO
//============================================================================

// Importações necessárias
import { showLocationOnMap } from '../../integration/integration.js';
import { getAssistantText } from '../../language/translations.js';

//
//  Variável global para armazenar a instância
let conversationFlowInstance = null;

/**
 * Configura a instância do conversationFlow
 *
 * @param {Object} instance - Instância do ConversationFlow
 */
export function setConversationFlow(instance) {
  conversationFlowInstance = instance;
  console.log('Instância do ConversationFlow configurada com sucesso');
}

//============================================================================
// 2. EXIBIÇÃO DE MENSAGENS
//============================================================================

/**
 * Adiciona uma mensagem à interface do usuário
 *
 * @param {string|Object} message - Mensagem a ser adicionada (texto ou objeto com ação)
 * @param {string} sender - Remetente ('user' ou 'assistant')
 * @param {boolean} requireInteraction - Se requer interação do usuário
 * @returns {boolean} Sucesso da operação
 */
export function addMessageToUI(
  message,
  sender = 'assistant',
  requireInteraction = false
) {
  const messagesContainer = document.getElementById('assistant-messages');
  if (!messagesContainer) {
    console.error('Container de mensagens não encontrado');
    return false;
  }

  // Criar elemento da mensagem
  const messageElement = document.createElement('div');
  messageElement.className = `assistant-message ${sender}`;

  // Processar texto ou objeto de resposta
  let messageText = '';
  let messageAction = null;

  if (typeof message === 'object' && message !== null) {
    // Se tem ação e texto
    if (message.text) {
      messageText = message.text;
    }

    // Se tem ação
    if (message.action) {
      messageAction = message.action;
    }
  } else {
    // Se for apenas texto
    messageText = String(message);
  }

  // Formatar links no texto
  messageText = formatLinks(messageText);

  // Adicionar texto à mensagem
  messageElement.innerHTML = `<div class="message-content">${messageText}</div>`;

  // Adicionar à interface
  messagesContainer.appendChild(messageElement);

  // Auto-scroll para a última mensagem
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Executar ação, se houver
  if (messageAction) {
    setTimeout(() => {
      executeMessageAction(messageAction);
    }, 500);
  }

  // Disparar evento para notificar outros componentes
  document.dispatchEvent(
    new CustomEvent('assistant:message:added', {
      detail: { message, sender, requireInteraction },
    })
  );

  return true;
}

/**
 * Mostra indicador de digitação do assistente
 */
export function showTypingIndicator() {
  const messagesContainer = document.getElementById('assistant-messages');
  if (!messagesContainer) return;

  // Remover indicador existente, se houver
  removeTypingIndicator();

  // Criar indicador de digitação
  const typingIndicator = document.createElement('div');
  typingIndicator.className = 'typing-indicator';
  typingIndicator.innerHTML = '<span></span><span></span><span></span>';

  messagesContainer.appendChild(typingIndicator);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Atualizar estado
  if (window.assistantStateManager) {
    window.assistantStateManager.set('isTyping', true);
  }
}

/**
 * Remove indicador de digitação do assistente
 */
export function removeTypingIndicator() {
  const messagesContainer = document.getElementById('assistant-messages');
  if (!messagesContainer) return;

  const typingIndicator = messagesContainer.querySelector('.typing-indicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }

  // Atualizar estado
  if (window.assistantStateManager) {
    window.assistantStateManager.set('isTyping', false);
  }
}

/**
 * Formata links em texto para HTML clicável
 *
 * @param {string|Object} message - Mensagem a ser formatada
 * @returns {string} - Texto formatado com links HTML
 */
function formatLinks(message) {
  // Se a mensagem for um objeto (resposta com ação)
  if (typeof message === 'object' && message.text) {
    return message.text;
  }

  // Se for apenas texto
  const text = String(message);
  // Regex para identificar URLs no texto
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(
    urlRegex,
    (url) => `<a href="${url}" target="_blank">${url}</a>`
  );
}

/**
 * Mostra a mensagem de boas-vindas do assistente
 *
 * @returns {boolean} Sucesso da operação
 */
export function showWelcomeMessage() {
  console.log('Exibindo mensagem de boas-vindas do assistente...');

  // Verificação única e confiável se a mensagem já foi mostrada
  // Usar estado do assistente como fonte única de verdade
  if (
    window.assistantStateManager &&
    window.assistantStateManager.hasShownWelcome()
  ) {
    console.log('Mensagem de boas-vindas já exibida anteriormente, ignorando.');
    return false;
  }

  // Verificar se o container existe
  const messagesContainer = document.getElementById('assistant-messages');
  if (!messagesContainer) {
    console.error('Container de mensagens não encontrado');
    return false;
  }

  // Limpar mensagens existentes para garantir que não haja duplicatas
  messagesContainer.innerHTML = '';

  // Mostrar indicador de digitação
  showTypingIndicator();

  // Obter idioma atual - PRIORIZAR o estado do assistente
  const currentLanguage =
    (window.assistantStateManager &&
      window.assistantStateManager.get('selectedLanguage')) ||
    localStorage.getItem('preferredLanguage') ||
    'pt';

  console.log(`Exibindo boas-vindas no idioma: ${currentLanguage}`);

  try {
    // Obter texto de boas-vindas
    const welcomeText = getAssistantText('welcome', currentLanguage);

    // Exibir mensagem após delay
    setTimeout(() => {
      removeTypingIndicator();

      // Verificar novamente se o container ainda existe
      const container = document.getElementById('assistant-messages');
      if (!container) return;

      // Adicionar mensagem à UI
      addMessageToUI(welcomeText, 'assistant');

      // IMPORTANTE: Marcar a mensagem como mostrada DEPOIS de exibi-la
      if (window.assistantStateManager) {
        window.assistantStateManager.markWelcomeAsShown();
      }
      window.welcomeMessageShown = true;

      // Tentar falar a mensagem
      if (
        window.assistantApi &&
        typeof window.assistantApi.speak === 'function'
      ) {
        window.assistantApi.speak(welcomeText);
      }
    }, 1500);

    return true;
  } catch (error) {
    console.error('Erro ao processar mensagem de boas-vindas:', error);

    // Recuperação em caso de erro - mostrar mensagem padrão
    removeTypingIndicator();
    const fallbackMessage =
      currentLanguage === 'en'
        ? "Hello! I'm your virtual assistant!"
        : 'Olá! Eu sou seu assistente virtual!';

    addMessageToUI(fallbackMessage, 'assistant');

    // Marcar mensagem como exibida mesmo no caso de erro
    if (window.assistantStateManager) {
      window.assistantStateManager.markWelcomeAsShown();
    }
    window.welcomeMessageShown = true;

    return false;
  }
}

//============================================================================
// 3. PROCESSAMENTO DE MENSAGENS
//============================================================================

/**
 * Processa a mensagem do usuário e gera resposta
 *
 * @param {string} text - Texto da mensagem
 */
function processUserMessage(text) {
  // Importar módulos necessários dinamicamente
  import('../nlp/entityExtractor.js')
    .then((nlpModule) => {
      const { extractEntities, detectIntent } = nlpModule;

      // Obter idioma atual
      const currentLanguage =
        (window.assistantStateManager &&
          window.assistantStateManager.get('selectedLanguage')) ||
        'pt';

      // Extrair entidades e detectar intenção
      const entities = extractEntities(text, currentLanguage);
      const intent = detectIntent(text, currentLanguage);

      // Armazenar mensagem no histórico
      if (window.assistantStateManager) {
        const conversations =
          window.assistantStateManager.get('conversations') || [];
        conversations.push({
          text,
          sender: 'user',
          timestamp: Date.now(),
          entities,
          intent,
        });

        // Limitar tamanho do histórico
        if (conversations.length > 10) {
          conversations.shift();
        }

        window.assistantStateManager.set('conversations', conversations);
      }

      // Mostrar indicador de digitação
      showTypingIndicator();

      // Calcular tempo de resposta contextual
      const responseTime = determineResponseTime(text, intent);

      // Gerar resposta baseada na intenção e entidades
      setTimeout(() => {
        removeTypingIndicator();

        // Verificar se há contexto ativo
        const currentContext = window.assistantStateManager
          ? window.assistantStateManager.get('currentContext')
          : 'general';

        let response;

        if (currentContext && currentContext !== 'general') {
          // Processar com base no contexto atual
          response = processContextualMessage(
            text,
            currentContext,
            currentLanguage
          );
        } else {
          // Processar com base na intenção detectada
          response = processIntentMessage(
            text,
            intent,
            entities,
            currentLanguage
          );
        }

        // Adicionar resposta à interface
        addMessageToUI(response, 'assistant');

        // Armazenar resposta no histórico
        if (window.assistantStateManager) {
          const conversations =
            window.assistantStateManager.get('conversations') || [];
          conversations.push({
            text: typeof response === 'object' ? response.text : response,
            sender: 'assistant',
            timestamp: Date.now(),
            intent: intent,
          });
          window.assistantStateManager.set('conversations', conversations);
        }

        // Mostrar botões de sugestão contextual se aplicável
        showSuggestionsByIntent(intent, entities, currentLanguage);
      }, responseTime);
    })
    .catch((error) => {
      console.error('Erro ao importar módulos NLP:', error);
      removeTypingIndicator();
      addMessageToUI(
        'Desculpe, houve um erro ao processar sua mensagem. Por favor, tente novamente.',
        'assistant'
      );
    });
}

/**
 * Determina o tempo apropriado de resposta com base na entrada
 *
 * @param {string} text - Texto da mensagem
 * @param {string} intent - Intenção detectada
 * @returns {number} Tempo de resposta em milissegundos
 */
function determineResponseTime(text, intent) {
  // Responder mais rapidamente a saudações e agradecimentos
  if (intent === 'greeting' || intent === 'thanks' || intent === 'farewell') {
    return 800;
  }

  // Respostas mais lentas para perguntas complexas
  if (intent === 'location_info' || intent === 'general_question') {
    return Math.min(1500 + text.length * 20, 3000);
  }

  // Tempo padrão
  return Math.min(1200 + text.length * 15, 2500);
}

/**
 * Processa mensagens baseadas em intenção
 *
 * @param {string} text - Texto da mensagem
 * @param {string} intent - Intenção detectada
 * @param {Object} entities - Entidades extraídas
 * @param {string} language - Idioma atual
 * @returns {string|Object} Resposta formatada
 */
function processIntentMessage(text, intent, entities, language) {
  switch (intent) {
    case 'greeting':
      return getAssistantText('greeting_response', language);

    case 'farewell':
      return (
        getAssistantText('farewell_response', language) ||
        'Até logo! Estou aqui se precisar de mais informações sobre Morro de São Paulo!'
      );

    case 'thanks':
      return getAssistantText('thanks_response', language);

    case 'location_info':
      if (entities.locations && entities.locations.length > 0) {
        const location = entities.locations[0];
        return processLocationInfo(location, language);
      }
      break;

    case 'food_info':
      // Definir contexto para alimentação
      if (window.assistantStateManager) {
        window.assistantStateManager.set('currentContext', 'food');
      }
      return getAssistantText('food_options', language);

    case 'accommodation_info':
      // Definir contexto para hospedagem
      if (window.assistantStateManager) {
        window.assistantStateManager.set('currentContext', 'accommodation');
      }
      return (
        getAssistantText('accommodation_options', language) ||
        'Morro de São Paulo tem opções de hospedagem para todos os gostos e bolsos. Você procura algo mais econômico, confortável ou luxuoso?'
      );

    case 'activity_info':
      // Definir contexto para atividades
      if (window.assistantStateManager) {
        window.assistantStateManager.set('currentContext', 'activities');
      }
      return (
        getAssistantText('activity_options', language) ||
        'Há muitas atividades em Morro de São Paulo! Você pode fazer passeios de barco, mergulho, caminhadas, ou apenas relaxar nas praias. O que você prefere?'
      );

    case 'weather_info':
      return getAssistantText('weather_response', language);

    case 'help':
      return (
        getAssistantText('help_response', language) ||
        'Posso ajudar com informações sobre praias, restaurantes, hospedagem, passeios, clima e muito mais em Morro de São Paulo. O que você gostaria de saber?'
      );

    case 'general_question':
    case 'general_chat':
    default:
      return getSimpleResponse(text, language);
  }
}

/**
 * Processa informações sobre locais específicos
 *
 * @param {Object} location - Informação do local
 * @param {string} language - Idioma atual
 * @returns {Object} Resposta com texto e ação
 */
function processLocationInfo(location, language) {
  const locationMap = {
    'primeira praia': {
      text:
        getAssistantText('first_beach_info', language) ||
        'A Primeira Praia é a mais próxima do centro histórico, com águas agitadas, ideal para surf. Tem menos estrutura que as outras praias, mas é uma boa opção para quem quer ficar perto da vila.',
      coordinates: { lat: -13.3795, lng: -38.9157 },
    },
    'segunda praia': {
      text:
        getAssistantText('second_beach_info', language) ||
        'A Segunda Praia é o coração de Morro de São Paulo! Tem águas calmas, bares, restaurantes e muita agitação. É perfeita para quem quer curtir a praia com estrutura completa e boa vida noturna.',
      coordinates: { lat: -13.3825, lng: -38.9138 },
    },
    'terceira praia': {
      text:
        getAssistantText('third_beach_info', language) ||
        'A Terceira Praia tem águas tranquilas e cristalinas, perfeitas para banho! É mais familiar e relaxante, com excelentes pousadas e restaurantes. Daqui saem muitos barcos para passeios.',
      coordinates: { lat: -13.3865, lng: -38.9088 },
    },
    'quarta praia': {
      text:
        getAssistantText('fourth_beach_info', language) ||
        'A Quarta Praia é a mais extensa e tranquila. Suas águas são cristalinas com piscinas naturais na maré baixa. É ideal para quem busca relaxamento e contato com a natureza.',
      coordinates: { lat: -13.3915, lng: -38.9046 },
    },
    'quinta praia': {
      text:
        getAssistantText('fifth_beach_info', language) ||
        'A Quinta Praia, também conhecida como Praia do Encanto, é a mais preservada e deserta. Perfeita para quem busca privacidade e natureza intocada.',
      coordinates: { lat: -13.3975, lng: -38.899 },
    },
    farol: {
      text: 'O Farol é um dos pontos mais altos da ilha, oferecendo uma vista 360° espetacular! É ideal para ver o nascer e o pôr do sol.',
      coordinates: { lat: -13.3762, lng: -38.9185 },
    },
    'fonte grande': {
      text: 'A Fonte Grande é uma área de nascente de água doce e cachoeira, um refúgio natural refrescante no meio da ilha.',
      coordinates: { lat: -13.3788, lng: -38.9143 },
    },
    'toca do morcego': {
      text: 'A Toca do Morcego é uma caverna natural com vista deslumbrante para o mar, perfeita para assistir ao pôr do sol.',
      coordinates: { lat: -13.3778, lng: -38.9177 },
    },
  };

  // Verificar se o local é reconhecido
  if (locationMap[location.name]) {
    return {
      text: locationMap[location.name].text,
      action: {
        type: 'show_location',
        name: location.name,
        coordinates: locationMap[location.name].coordinates,
      },
    };
  }

  // Se o local não for reconhecido
  return (
    getAssistantText('unknown_location', language) ||
    `Não tenho informações específicas sobre ${location.name}, mas posso falar sobre as principais praias e pontos turísticos de Morro de São Paulo.`
  );
}

/**
 * Processa mensagem contextual
 *
 * @param {string} text - Texto da mensagem
 * @param {string} context - Contexto atual
 * @param {string} language - Idioma atual
 * @returns {string|Object} - Resposta ao usuário
 */
function processContextualMessage(text, context, language) {
  const lowerText = text.toLowerCase();

  // Obter o histórico de conversa para contexto
  const conversations = window.assistantStateManager
    ? window.assistantStateManager.get('conversations') || []
    : [];

  // Contexto de alimentação/gastronomia
  if (context === 'food') {
    // Verificar se a tradução existe antes de usar toLowerCase()
    const seafoodText = getAssistantText('seafood', language);

    // Restaurantes de frutos do mar
    if (seafoodText && lowerText.includes(seafoodText.toLowerCase())) {
      // Adicionar resposta estruturada com ação para mostrar no mapa
      return {
        text:
          getAssistantText('seafood_response', language) ||
          'Os melhores restaurantes de frutos do mar são o Sambass na Terceira Praia e o Ponto do Marisco na Segunda Praia. Ambos têm pratos frescos e deliciosos, com destaque para a moqueca de camarão e lagosta grelhada.',
        action: {
          type: 'show_location',
          name: 'Sambass',
          coordinates: { lat: -13.3865, lng: -38.9088 },
        },
      };
    }

    // Comida baiana
    const bahianText = getAssistantText('bahian_food', language);
    if (bahianText && lowerText.includes(bahianText.toLowerCase())) {
      return {
        text: 'A culinária baiana é uma das mais ricas do Brasil! Em Morro, recomendo o Maria Mata Fome na Segunda Praia para provar moquecas autênticas e acarajé fresco. Os pratos têm o tempero tradicional com dendê e pimenta na medida certa.',
        action: {
          type: 'show_location',
          name: 'Maria Mata Fome',
          coordinates: { lat: -13.383, lng: -38.9125 },
        },
      };
    }

    // Comida internacional
    const internationalText = getAssistantText('international_food', language);
    if (
      internationalText &&
      lowerText.includes(internationalText.toLowerCase())
    ) {
      return {
        text: 'Para culinária internacional, o Pasta & Vino oferece excelentes pratos italianos. Há também opções de comida japonesa no Sushi Morro e mediterrânea no Mediterraneo Restaurant.',
        action: {
          type: 'show_category',
          category: 'international_restaurants',
        },
      };
    }
  }

  // Contexto: acomodações/hospedagem
  else if (context === 'accommodation') {
    if (
      lowerText.includes('barato') ||
      lowerText.includes('econômic') ||
      lowerText.includes('budget') ||
      lowerText.includes('cheap')
    ) {
      return {
        text:
          getAssistantText('budget_accommodation_response', language) ||
          'Para hospedagem econômica, recomendo a Pousada Bahia Inn na vila ou o Hostel Morro de São Paulo, ambos oferecem bom custo-benefício e estão bem localizados.',
        action: {
          type: 'show_poi_category',
          category: 'budget_inns',
        },
      };
    }

    // Opções confortáveis
    if (
      lowerText.includes('confort') ||
      lowerText.includes('médio') ||
      lowerText.includes('medio') ||
      lowerText.includes('comfortable')
    ) {
      return {
        text: 'Para hospedagem confortável com bom custo-benefício, recomendo a Pousada Natureza na Segunda Praia ou a Pousada Praia do Encanto na Terceira Praia. Ambas têm piscina, café da manhã incluso e localização privilegiada.',
        action: {
          type: 'show_poi_category',
          category: 'mid_range_inns',
        },
      };
    }

    // Opções de luxo
    if (
      lowerText.includes('luxo') ||
      lowerText.includes('luxuos') ||
      lowerText.includes('luxury') ||
      lowerText.includes('caro') ||
      lowerText.includes('expensive')
    ) {
      return {
        text: 'Para hospedagem de luxo, a Vila dos Corais na Terceira Praia e o Hotel Morro de São Paulo na Segunda Praia são excelentes escolhas. Oferecem apartamentos espaçosos, serviços premium, piscinas impressionantes e vistas deslumbrantes para o mar.',
        action: {
          type: 'show_location',
          name: 'Vila dos Corais',
          coordinates: { lat: -13.3845, lng: -38.91 },
        },
      };
    }
  }

  // Contexto: atividades/passeios
  else if (context === 'activities') {
    if (
      lowerText.includes('mergulho') ||
      lowerText.includes('diving') ||
      lowerText.includes('buceo') ||
      lowerText.includes('snorkel')
    ) {
      return {
        text:
          getAssistantText('diving_response', language) ||
          'Há excelentes pontos para mergulho em Morro! A Piscina Natural é perfeita para snorkeling e é acessível mesmo para iniciantes. Para mergulho com cilindro, recomendo a Náutica Diving School na Segunda Praia.',
        action: {
          type: 'show_location',
          name: 'Piscina Natural',
          coordinates: { lat: -13.3841, lng: -38.9112 },
        },
      };
    }

    // Passeios de barco
    if (
      lowerText.includes('barco') ||
      lowerText.includes('boat') ||
      lowerText.includes('lancha') ||
      lowerText.includes('passeio marítimo')
    ) {
      return {
        text: 'Os passeios de barco são imperdíveis! O mais popular é a "Volta à Ilha", que contorna Morro de São Paulo com paradas para mergulho. Há também passeios para ilhas próximas como Boipeba e Cairú. Os barcos saem da Terceira Praia e podem ser reservados nos quiosques à beira-mar.',
        action: {
          type: 'show_location',
          name: 'Ponto de Passeios',
          coordinates: { lat: -13.3865, lng: -38.9088 },
        },
      };
    }

    // Trilhas
    if (
      lowerText.includes('trilha') ||
      lowerText.includes('caminhada') ||
      lowerText.includes('hiking') ||
      lowerText.includes('trail')
    ) {
      return {
        text: 'Morro tem trilhas incríveis! A mais popular leva ao Farol e à Toca do Morcego, com vistas panorâmicas deslumbrantes. Há também a trilha para Gamboa (pode ser feita na maré baixa pela praia) e trilhas ecológicas na parte interior da ilha. Use tênis apropriados e leve água!',
        action: {
          type: 'show_route',
          start: { lat: -13.3825, lng: -38.9138 }, // Segunda Praia
          end: { lat: -13.3762, lng: -38.9185 }, // Farol
        },
      };
    }
  }

  // Se não houver resposta específica, voltar ao contexto geral
  if (window.assistantStateManager) {
    window.assistantStateManager.set('currentContext', 'general');
  }
  return getSimpleResponse(text, language);
}

/**
 * Executa ação associada a uma mensagem
 *
 * @param {Object} action - Ação a ser executada
 */
function executeMessageAction(action) {
  if (!action || !action.type) return;

  switch (action.type) {
    case 'show_location':
      if (action.coordinates && action.name) {
        showLocationOnMap(action.coordinates, action.name);
      }
      break;

    case 'show_category':
      if (action.category && typeof window.showPoiCategory === 'function') {
        window.showPoiCategory(action.category);
      }
      break;

    case 'show_route':
      if (
        action.start &&
        action.end &&
        typeof window.showRoute === 'function'
      ) {
        window.showRoute(action.start, action.end, action.mode || 'foot');
      }
      break;

    case 'start_navigation':
      if (action.destination && typeof window.startNavigation === 'function') {
        window.startNavigation(action.destination);
      }
      break;

    case 'reset_map':
      if (typeof window.resetMapView === 'function') {
        window.resetMapView();
      }
      break;

    case 'change_language':
      if (action.language && typeof window.changeLanguage === 'function') {
        window.changeLanguage(action.language);
      }
      break;
  }
}

//============================================================================
// 4. INTERAÇÕES CONTEXTUAIS
//============================================================================

/**
 * Mostra sugestões baseadas na intenção detectada
 *
 * @param {string} intent - Intenção detectada
 * @param {Object} entities - Entidades extraídas
 * @param {string} language - Idioma atual
 */
function showSuggestionsByIntent(intent, entities, language) {
  switch (intent) {
    case 'location_info':
    case 'show_location':
      if (
        entities.locations &&
        entities.locations.some((loc) => loc.type === 'beach')
      ) {
        setTimeout(() => showBeachOptions(language), 500);
      }
      break;

    case 'food_info':
      setTimeout(() => showFoodOptions(language), 500);
      break;

    case 'activity_info':
      setTimeout(() => showActivityOptions(language), 500);
      break;

    case 'accommodation_info':
      setTimeout(() => showAccommodationOptions(language), 500);
      break;
  }
}

/**
 * Mostra opções para resposta de primeira visita
 */
function showFirstTimeOptions() {
  const messagesContainer = document.getElementById('assistant-messages');
  if (!messagesContainer) return;

  // Criar contêiner de botões
  const choicesElement = document.createElement('div');
  choicesElement.className = 'assistant-choices';
  choicesElement.innerHTML = `
    <button class="assistant-choice-btn" data-choice="sim">Sim, primeira vez</button>
    <button class="assistant-choice-btn" data-choice="nao">Já estive aqui antes</button>
  `;

  messagesContainer.appendChild(choicesElement);

  // Adicionar eventos aos botões
  const botoes = choicesElement.querySelectorAll('.assistant-choice-btn');
  botoes.forEach((botao) => {
    botao.addEventListener('click', (e) => {
      const escolha = e.target.getAttribute('data-choice');
      handleFirstTimeResponse(escolha);
    });
  });
}

/**
 * Processa a resposta do usuário sobre primeira vez
 *
 * @param {string} resposta - Sim ou não
 */
function handleFirstTimeResponse(resposta) {
  if (
    !window.assistantStateManager ||
    !window.assistantStateManager.get('awaitingFirstTimeResponse')
  )
    return;

  window.assistantStateManager.set('awaitingFirstTimeResponse', false);

  // Atualizar estado
  if (resposta === 'nao') {
    window.assistantStateManager.set('firstTimeVisitor', false);
    if (typeof window.saveAssistantState === 'function') {
      window.saveAssistantState();
    }
  }

  showTypingIndicator();

  setTimeout(() => {
    removeTypingIndicator();

    let mensagemResposta;
    if (resposta === 'sim') {
      mensagemResposta =
        'Que incrível! Você vai adorar conhecer o Morro! Posso te ajudar com sugestões de roteiros e informações importantes para quem está aqui pela primeira vez. Do que você mais gosta: praias, festas, gastronomia ou trilhas?';
    } else {
      mensagemResposta =
        'Ah, então você já conhece as maravilhas do Morro! Sempre bom voltar, não é? Quer saber sobre alguma novidade ou precisa de informações específicas sobre algum local?';
    }

    addMessageToUI(mensagemResposta, 'assistant');

    // Mostrar opções de tópicos após um delay
    setTimeout(() => {
      showTopicOptions(resposta);
    }, 500);
  }, 1500);
}

/**
 * Mostra opções de tópicos para o usuário escolher
 *
 * @param {string} resposta - Resposta anterior do usuário
 */
function showTopicOptions(resposta) {
  const messagesContainer = document.getElementById('assistant-messages');
  if (!messagesContainer) return;

  // Criar contêiner de botões
  const choicesElement = document.createElement('div');
  choicesElement.className = 'assistant-choices';

  if (resposta === 'sim') {
    // Opções para primeira visita
    choicesElement.innerHTML = `
      <button class="assistant-choice-btn" data-choice="praias">Praias</button>
      <button class="assistant-choice-btn" data-choice="festas">Festas</button>
      <button class="assistant-choice-btn" data-choice="gastronomia">Gastronomia</button>
      <button class="assistant-choice-btn" data-choice="trilhas">Trilhas</button>
    `;
  } else {
    // Opções para quem já conhece
    choicesElement.innerHTML = `
      <button class="assistant-choice-btn" data-choice="novidades">Novidades</button>
      <button class="assistant-choice-btn" data-choice="eventos">Eventos atuais</button>
      <button class="assistant-choice-btn" data-choice="melhores_lugares">Melhores lugares</button>
      <button class="assistant-choice-btn" data-choice="off_beaten">Fora do circuito</button>
    `;
  }

  messagesContainer.appendChild(choicesElement);

  // Adicionar eventos aos botões
  const botoes = choicesElement.querySelectorAll('.assistant-choice-btn');
  botoes.forEach((botao) => {
    botao.addEventListener('click', (e) => {
      const escolha = e.target.getAttribute('data-choice');
      handleTopicSelection(escolha);
    });
  });
}

/**
 * Processa seleção de tópico do usuário
 *
 * @param {string} escolha - Tópico escolhido
 */
function handleTopicSelection(escolha) {
  let mensagemResposta = '';

  showTypingIndicator();

  setTimeout(() => {
    removeTypingIndicator();

    // Gerar resposta com base na escolha
    switch (escolha) {
      // Respostas para primeira vez
      case 'praias':
        mensagemResposta = {
          text: 'Morro tem 5 praias principais, cada uma com seu charme! A Primeira é ótima para surf, a Segunda é a mais animada com bares e restaurantes, a Terceira tem águas calmas perfeitas para banho, a Quarta é mais tranquila e a Quinta é quase deserta. Quer que eu mostre a Segunda Praia no mapa?',
          action: {
            type: 'show_location',
            name: 'Segunda Praia',
            coordinates: { lat: -13.3825, lng: -38.9138 },
          },
        };
        break;
      case 'festas':
        mensagemResposta =
          'A vida noturna em Morro é animada! Os principais points são os bares da Segunda Praia, que têm festas todas as noites. No verão, rolam festas na praia e há boates como o Pulso e o Toca do Morcego. Quer mais detalhes sobre algum lugar específico?';
        break;
      case 'gastronomia':
        mensagemResposta =
          'A gastronomia aqui é incrível! Você encontra desde frutos do mar fresquíssimos até pratos internacionais. Não deixe de provar a moqueca baiana e o acarajé! Recomendo o restaurante Sambass na Terceira Praia e o Pasta & Vino para comida italiana. Alguma preferência específica?';
        break;
      case 'trilhas':
        mensagemResposta =
          'As trilhas de Morro são espetaculares! A mais famosa é a trilha até a Ponta do Morro, passando pelo Farol e Toca do Morcego, com vistas incríveis. Há também trilhas para as praias mais isoladas como Gamboa e Garapuá. Use tênis e leve bastante água!';
        break;

      // Respostas para retornantes
      case 'novidades':
        mensagemResposta =
          'Temos algumas novidades! Foi inaugurado o novo deck de observação na Quinta Praia, há um novo sistema de trilhas ecológicas na reserva, e agora temos passeios noturnos para observação de tartarugas (na temporada). O que te interessa mais?';
        break;
      case 'eventos':
        mensagemResposta =
          'Neste momento temos o Festival Gastronômico acontecendo na Vila, com pratos especiais em vários restaurantes. No próximo fim de semana teremos música ao vivo na Praça Central. Quer que eu te indique algum restaurante participante?';
        break;
      case 'melhores_lugares':
        mensagemResposta =
          'Os lugares mais bem avaliados atualmente são o restaurante Sambass na Terceira Praia, a Pousada Natureza na Segunda Praia, e os passeios de lancha até Cairú estão com avaliações excelentes. Quer saber mais sobre algum deles?';
        break;
      case 'off_beaten':
        mensagemResposta =
          'Para quem já conhece o básico, recomendo conhecer a praia de Garapuá (de barco), a Gamboa do Morro (travessia de barco ou caminhada na maré baixa), e a cachoeira da Fonte Grande. São lugares menos turísticos e muito especiais!';
        break;
      default:
        mensagemResposta =
          'Desculpe, não entendi sua escolha. Pode me dizer de outra forma o que você gostaria de saber sobre Morro de São Paulo?';
    }

    addMessageToUI(mensagemResposta, 'assistant');
  }, 1500);
}

/**
 * Mostra opções de atividades
 *
 * @param {string} language - Idioma atual
 */
function showActivityOptions(language = 'pt') {
  const messagesContainer = document.getElementById('assistant-messages');
  if (!messagesContainer) return;

  const choicesElement = document.createElement('div');
  choicesElement.className = 'assistant-choices';

  choicesElement.innerHTML = `
    <button class="assistant-choice-btn" data-choice="passeio_barco">${getAssistantText('boat_tour', language) || 'Passeio de Barco'}</button>
    <button class="assistant-choice-btn" data-choice="mergulho">${getAssistantText('diving', language) || 'Mergulho'}</button>
    <button class="assistant-choice-btn" data-choice="trilhas">${getAssistantText('trails', language) || 'Trilhas'}</button>
  `;

  messagesContainer.appendChild(choicesElement);

  // Adicionar eventos aos botões
  const botoes = choicesElement.querySelectorAll('.assistant-choice-btn');
  botoes.forEach((botao) => {
    botao.addEventListener('click', (e) => {
      const escolha = e.target.getAttribute('data-choice');
      let mensagem = '';

      switch (escolha) {
        case 'passeio_barco':
          mensagem = 'Quero saber sobre passeios de barco';
          break;
        case 'mergulho':
          mensagem = 'Me fale sobre mergulho em Morro de São Paulo';
          break;
        case 'trilhas':
          mensagem = 'Quais são as trilhas disponíveis?';
          break;
      }

      if (mensagem) {
        sendMessage(mensagem);
      }
    });
  });
}

/**
 * Mostra opções de hospedagem
 *
 * @param {string} language - Idioma atual
 */
function showAccommodationOptions(language = 'pt') {
  const messagesContainer = document.getElementById('assistant-messages');
  if (!messagesContainer) return;

  const choicesElement = document.createElement('div');
  choicesElement.className = 'assistant-choices';

  choicesElement.innerHTML = `
    <button class="assistant-choice-btn" data-choice="economico">${getAssistantText('budget', language) || 'Econômico'}</button>
    <button class="assistant-choice-btn" data-choice="conforto">${getAssistantText('comfort', language) || 'Confortável'}</button>
    <button class="assistant-choice-btn" data-choice="luxo">${getAssistantText('luxury', language) || 'Luxo'}</button>
  `;

  messagesContainer.appendChild(choicesElement);

  // Adicionar eventos aos botões
  const botoes = choicesElement.querySelectorAll('.assistant-choice-btn');
  botoes.forEach((botao) => {
    botao.addEventListener('click', (e) => {
      const escolha = e.target.getAttribute('data-choice');
      let mensagem = '';

      switch (escolha) {
        case 'economico':
          mensagem = 'Procuro hospedagem econômica';
          break;
        case 'conforto':
          mensagem = 'Quero opções de hospedagem confortáveis';
          break;
        case 'luxo':
          mensagem = 'Me indique hospedagens de luxo';
          break;
      }

      if (mensagem) {
        sendMessage(mensagem);
      }
    });
  });
}

/**
 * Mostra opções de comida
 *
 * @param {string} language - Idioma atual
 */
function showFoodOptions(language = 'pt') {
  const messagesContainer = document.getElementById('assistant-messages');
  if (!messagesContainer) return;

  const choicesElement = document.createElement('div');
  choicesElement.className = 'assistant-choices';

  // Usar traduções para os botões
  const seafoodText = getAssistantText('seafood', language) || 'Frutos do Mar';
  const bahianText =
    getAssistantText('bahian_food', language) || 'Comida Baiana';
  const internationalText =
    getAssistantText('international_food', language) || 'Internacional';

  choicesElement.innerHTML = `
    <button class="assistant-choice-btn" data-choice="frutos_do_mar">${seafoodText}</button>
    <button class="assistant-choice-btn" data-choice="baiana">${bahianText}</button>
    <button class="assistant-choice-btn" data-choice="internacional">${internationalText}</button>
  `;

  messagesContainer.appendChild(choicesElement);

  // Adicionar eventos aos botões
  const botoes = choicesElement.querySelectorAll('.assistant-choice-btn');
  botoes.forEach((botao) => {
    botao.addEventListener('click', (e) => {
      const escolha = e.target.getAttribute('data-choice');
      let mensagem;

      // Usar traduções para as mensagens de envio
      switch (escolha) {
        case 'frutos_do_mar':
          mensagem =
            getAssistantText('ask_seafood', language) ||
            `Quero saber sobre restaurantes de frutos do mar`;
          break;
        case 'baiana':
          mensagem =
            getAssistantText('ask_bahian', language) ||
            `Quero saber sobre restaurantes de comida baiana`;
          break;
        case 'internacional':
          mensagem =
            getAssistantText('ask_international', language) ||
            `Quero saber sobre restaurantes de comida internacional`;
          break;
      }

      sendMessage(mensagem);
    });
  });
}

/**
 * Mostra opções de praias
 *
 * @param {string} language - Idioma atual
 */
export function showBeachOptions(language = 'pt') {
  const messagesContainer = document.getElementById('assistant-messages');
  if (!messagesContainer) return;

  const choicesElement = document.createElement('div');
  choicesElement.className = 'assistant-choices';

  // Usar traduções para os botões
  const firstBeachText =
    getAssistantText('first_beach_name', language) || 'Primeira Praia';
  const secondBeachText =
    getAssistantText('second_beach_name', language) || 'Segunda Praia';
  const thirdBeachText =
    getAssistantText('third_beach_name', language) || 'Terceira Praia';
  const fourthBeachText =
    getAssistantText('fourth_beach_name', language) || 'Quarta Praia';

  choicesElement.innerHTML = `
    <button class="assistant-choice-btn" data-choice="primeira_praia">${firstBeachText}</button>
    <button class="assistant-choice-btn" data-choice="segunda_praia">${secondBeachText}</button>
    <button class="assistant-choice-btn" data-choice="terceira_praia">${thirdBeachText}</button>
    <button class="assistant-choice-btn" data-choice="quarta_praia">${fourthBeachText}</button>
  `;

  messagesContainer.appendChild(choicesElement);

  // Adicionar eventos aos botões
  const botoes = choicesElement.querySelectorAll('.assistant-choice-btn');
  botoes.forEach((botao) => {
    botao.addEventListener('click', (e) => {
      const escolha = e.target.getAttribute('data-choice');
      let mensagem;

      // Usar traduções para as mensagens de envio
      switch (escolha) {
        case 'primeira_praia':
          mensagem =
            getAssistantText('ask_first_beach', language) ||
            `Me fale sobre a primeira praia`;
          break;
        case 'segunda_praia':
          mensagem =
            getAssistantText('ask_second_beach', language) ||
            `Me fale sobre a segunda praia`;
          break;
        case 'terceira_praia':
          mensagem =
            getAssistantText('ask_third_beach', language) ||
            `Me fale sobre a terceira praia`;
          break;
        case 'quarta_praia':
          mensagem =
            getAssistantText('ask_fourth_beach', language) ||
            `Me fale sobre a quarta praia`;
          break;
      }

      sendMessage(mensagem);
    });
  });
}

//============================================================================
// 5. RESPOSTAS MULTILÍNGUES
//============================================================================

/**
 * Obtém uma resposta simples para mensagens gerais com suporte multilíngue
 *
 * @param {string} text - Texto da mensagem
 * @param {string} currentLanguage - Idioma atual
 * @returns {string} - Resposta simples
 */
function getSimpleResponse(text, currentLanguage = 'pt') {
  const lowerText = text.toLowerCase();

  // Verificar palavras-chave específicas no idioma atual usando o arquivo de traduções
  // Para cada palavra-chave, verificar se existe tradução no arquivo translations.js
  const greetings = ['greeting', 'hello', 'hi'];
  const timeGreetings = ['good_morning', 'good_afternoon', 'good_evening'];
  const keywords = [
    'hotel',
    'accommodation',
    'transport',
    'tour',
    'diving',
    'weather',
    'money',
    'wifi',
    'thanks',
  ];

  // Verificar saudações
  for (const greeting of greetings) {
    const keywordText = getAssistantText(
      greeting,
      currentLanguage
    )?.toLowerCase();
    if (keywordText && lowerText.includes(keywordText)) {
      return (
        getAssistantText(`${greeting}_response`, currentLanguage) ||
        getAssistantText('general_greeting', currentLanguage) ||
        'Olá! Como posso ajudar você a aproveitar Morro de São Paulo?'
      );
    }
  }

  // Verificar saudações por horário
  for (const timeGreeting of timeGreetings) {
    const keywordText = getAssistantText(
      timeGreeting,
      currentLanguage
    )?.toLowerCase();
    if (keywordText && lowerText.includes(keywordText)) {
      return (
        getAssistantText(`${timeGreeting}_response`, currentLanguage) ||
        getAssistantText('general_greeting', currentLanguage) ||
        'Olá! Como posso ajudar você a aproveitar Morro de São Paulo?'
      );
    }
  }

  // Verificar outras palavras-chave
  for (const keyword of keywords) {
    const keywordText = getAssistantText(
      keyword,
      currentLanguage
    )?.toLowerCase();
    if (keywordText && lowerText.includes(keywordText)) {
      return (
        getAssistantText(`${keyword}_response`, currentLanguage) ||
        getAssistantText('fallback_response', currentLanguage) ||
        `Desculpe, não tenho informações específicas sobre ${text}, mas posso ajudar com praias, restaurantes, hospedagem ou passeios em Morro de São Paulo.`
      );
    }
  }

  // Respostas genéricas se nenhuma palavra-chave for identificada
  const genericResponses = [
    getAssistantText('generic_response_1', currentLanguage) ||
      `Entendi sua mensagem sobre "${text}". Posso ajudar com informações sobre praias, restaurantes, hospedagem ou passeios em Morro de São Paulo.`,
    getAssistantText('generic_response_2', currentLanguage) ||
      `Obrigado por sua pergunta sobre "${text}". Para ajudar melhor, você poderia ser mais específico sobre o que deseja saber de Morro de São Paulo?`,
    getAssistantText('generic_response_3', currentLanguage) ||
      `Sobre "${text}", posso oferecer várias informações. Você está interessado em quais aspectos de Morro de São Paulo?`,
    getAssistantText('generic_response_4', currentLanguage) ||
      `Recebi sua mensagem sobre "${text}". Posso ajudar com dicas de praias, restaurantes, hospedagem ou atividades. O que prefere saber?`,
  ];

  // Retornar uma resposta genérica aleatória no idioma atual
  return genericResponses[Math.floor(Math.random() * genericResponses.length)];
}

//============================================================================
// 6. FUNÇÕES UTILITÁRIAS
//============================================================================

/**
 * Verifica compatibilidade de navegador com recursos necessários
 *
 * @returns {boolean} Se o navegador é compatível com os recursos necessários
 */
function checkBrowserCompatibility() {
  const requirements = {
    localStorage: typeof localStorage !== 'undefined',
    querySelector: typeof document.querySelector === 'function',
    eventListener: typeof window.addEventListener === 'function',
    fetch: typeof fetch === 'function',
    customEvent: typeof CustomEvent === 'function',
  };

  const incompatibleFeatures = Object.entries(requirements)
    .filter(([_, isSupported]) => !isSupported)
    .map(([feature]) => feature);

  if (incompatibleFeatures.length > 0) {
    console.warn(
      'Recursos incompatíveis detectados:',
      incompatibleFeatures.join(', ')
    );
    return false;
  }

  return true;
}

/**
 * Limpa todas as mensagens da interface
 */
export function clearMessages() {
  const messagesContainer = document.getElementById('assistant-messages');
  if (!messagesContainer) return;

  messagesContainer.innerHTML = '';
  console.log('Mensagens do assistente limpas');
}

/**
 * Remove os elementos de opções interativas da interface
 */
export function removeChoices() {
  const choicesElements = document.querySelectorAll('.assistant-choices');
  choicesElements.forEach((element) => {
    element.remove();
  });
}

//============================================================================
// 7. EXPORTAÇÕES E API PÚBLICA
//============================================================================

/**
 * Envia uma mensagem para o assistente
 *
 * @param {string} message - Mensagem a ser enviada
 */
export function sendMessage(message) {
  if (!message) return;

  // Adicionar mensagem do usuário à interface
  addMessageToUI(message, 'user');

  // Obter o elemento de input e limpar
  const inputField = document.getElementById('assistant-input-field');
  if (inputField) {
    inputField.value = '';
  }

  // Processar mensagem
  processUserMessage(message);
}

// Exportar API pública do módulo
export default {
  addMessageToUI,
  showTypingIndicator,
  removeTypingIndicator,
  showWelcomeMessage,
  showBeachOptions,
  sendMessage,
  clearMessages,
  removeChoices,
  setConversationFlow,
};
