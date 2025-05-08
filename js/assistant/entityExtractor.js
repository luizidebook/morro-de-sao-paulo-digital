/**
 * Sistema de extração de entidades para processamento de linguagem natural
 */

import { getAssistantText } from '../language/translations.js';

/**
 * Extrai entidades de uma mensagem de texto
 * @param {string} text - Texto da mensagem
 * @param {string} language - Idioma atual
 * @returns {Object} - Objeto com entidades extraídas
 */
export function extractEntities(text, language = 'pt') {
  const lowerText = text.toLowerCase();
  const entities = {
    locations: [],
    activities: [],
    food: [],
    accommodation: [],
    greeting: false,
    question: false,
    farewell: false,
  };

  // Extrair locais
  const locations = [
    { name: 'primeira praia', type: 'beach' },
    { name: 'segunda praia', type: 'beach' },
    { name: 'terceira praia', type: 'beach' },
    { name: 'quarta praia', type: 'beach' },
    { name: 'quinta praia', type: 'beach' },
    { name: 'gamboa', type: 'beach' },
    { name: 'farol', type: 'landmark' },
    { name: 'vila', type: 'area' },
    { name: 'centro', type: 'area' },
    { name: 'toca do morcego', type: 'landmark' },
    { name: 'piscina natural', type: 'attraction' },
  ];

  locations.forEach((location) => {
    // Para cada idioma, verificar a versão traduzida
    const keys = [`${location.name.replace(/\s/g, '_')}`, `${location.type}`];

    // Verificar versão em português (padrão)
    if (lowerText.includes(location.name)) {
      entities.locations.push({
        name: location.name,
        type: location.type,
        original: location.name,
      });
    }

    // Se o idioma não for português, verificar tradução
    if (language !== 'pt') {
      keys.forEach((key) => {
        const translated = getAssistantText(key, language).toLowerCase();
        if (translated && lowerText.includes(translated)) {
          // Verificar se já não foi adicionado
          const exists = entities.locations.some(
            (loc) => loc.name === location.name
          );
          if (!exists) {
            entities.locations.push({
              name: location.name,
              type: location.type,
              original: translated,
            });
          }
        }
      });
    }
  });

  // Extrair atividades
  const activities = [
    'passeio',
    'mergulho',
    'snorkeling',
    'caminhada',
    'trilha',
    'barco',
    'surf',
    'tirolesa',
  ];
  activities.forEach((activity) => {
    if (lowerText.includes(activity)) {
      entities.activities.push(activity);
    }
  });

  // Extrair comida
  const foodTerms = [
    'restaurante',
    'comida',
    'comer',
    'almoço',
    'jantar',
    'café',
    'bar',
  ];
  foodTerms.forEach((term) => {
    if (lowerText.includes(term)) {
      entities.food.push(term);
    }
  });

  // Extrair acomodação
  const accommodationTerms = [
    'hotel',
    'pousada',
    'hospedagem',
    'ficar',
    'dormir',
  ];
  accommodationTerms.forEach((term) => {
    if (lowerText.includes(term)) {
      entities.accommodation.push(term);
    }
  });

  // Detectar saudação
  const greetings = [
    'oi',
    'olá',
    'bom dia',
    'boa tarde',
    'boa noite',
    'hello',
    'hi',
  ];
  for (const greeting of greetings) {
    if (lowerText.includes(greeting)) {
      entities.greeting = true;
      break;
    }
  }

  // Detectar pergunta
  if (
    lowerText.includes('?') ||
    lowerText.startsWith('como') ||
    lowerText.startsWith('onde') ||
    lowerText.startsWith('quando') ||
    lowerText.startsWith('quem') ||
    lowerText.startsWith('por que') ||
    lowerText.startsWith('qual')
  ) {
    entities.question = true;
  }

  // Detectar despedida
  const farewells = ['tchau', 'adeus', 'até logo', 'até mais', 'bye'];
  for (const farewell of farewells) {
    if (lowerText.includes(farewell)) {
      entities.farewell = true;
      break;
    }
  }

  return entities;
}

/**
 * Detecta a intenção principal da mensagem
 * @param {string} text - Texto da mensagem
 * @param {string} language - Idioma atual
 * @returns {string} - Intenção detectada
 */
export function detectIntent(text, language = 'pt') {
  const lowerText = text.toLowerCase();
  const entities = extractEntities(text, language);

  // Detectar intenção baseada nas entidades
  if (entities.greeting && text.length < 20) {
    return 'greeting';
  }

  if (entities.farewell) {
    return 'farewell';
  }

  if (entities.locations.length > 0) {
    if (entities.question) {
      return 'location_info';
    }
    return 'show_location';
  }

  if (entities.food.length > 0) {
    return 'food_info';
  }

  if (entities.accommodation.length > 0) {
    return 'accommodation_info';
  }

  if (entities.activities.length > 0) {
    return 'activity_info';
  }

  // Verificar palavras-chave específicas
  if (lowerText.includes('obrigad') || lowerText.includes('thank')) {
    return 'thanks';
  }

  if (
    lowerText.includes('clima') ||
    lowerText.includes('tempo') ||
    lowerText.includes('weather')
  ) {
    return 'weather_info';
  }

  if (lowerText.includes('ajuda') || lowerText.includes('help')) {
    return 'help';
  }

  // Intenção padrão para perguntas
  if (entities.question) {
    return 'general_question';
  }

  // Intenção padrão
  return 'general_chat';
}

export default {
  extractEntities,
  detectIntent,
};

// nlp/entityExtractor.js
export class NLPProcessor {
  constructor() {
    this.intents = [];
    this.entities = {};
    this.initialized = false;
  }

  async initialize() {
    // Carregar modelos de intenções e entidades
    await this._loadIntents();
    await this._loadEntities();

    this.initialized = true;
    return this;
  }

  async process(input) {
    if (!this.initialized) await this.initialize();

    // Normalizar input
    const normalizedInput = this._normalizeInput(input);

    // Detectar intenção principal
    const intent = this._detectIntent(normalizedInput);

    // Extrair entidades relevantes
    const entities = this._extractEntities(normalizedInput, intent);

    return { intent, entities };
  }

  // Métodos de implementação
  _normalizeInput(input) {
    // Converter para minúsculas e remover caracteres especiais
    return input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _detectIntent(normalizedInput) {
    // Estrutura simplificada para detecção de intenção
    // Em produção, usar algoritmos mais robustos

    // Verificar cada padrão de intenção
    for (const intent of this.intents) {
      for (const pattern of intent.patterns) {
        if (this._matchPattern(normalizedInput, pattern)) {
          return intent.name;
        }
      }
    }

    // Fallback para intenção genérica
    return 'general_query';
  }

  _matchPattern(input, pattern) {
    // Implementação simplificada - em produção usar regex ou ML
    return input.includes(pattern);
  }

  _extractEntities(normalizedInput, intent) {
    const result = {};

    // Extrair entidades relevantes para a intenção
    switch (intent) {
      case 'show_location':
      case 'show_images':
        result.location = this._extractLocation(normalizedInput);
        break;

      case 'create_route':
        const locationParts = this._extractRouteLocations(normalizedInput);
        if (locationParts.origin) result.origin = locationParts.origin;
        if (locationParts.destination)
          result.destination = locationParts.destination;
        break;

      case 'show_poi':
        result.category = this._extractCategory(normalizedInput);
        result.name = this._extractPoiName(normalizedInput, result.category);
        break;

      // Adicionar mais casos para outras intenções
    }

    return result;
  }

  _extractLocation(input) {
    // Buscar por locais conhecidos no input
    for (const location of this.entities.locations) {
      if (input.includes(location.name.toLowerCase())) {
        return { name: location.name, type: location.type };
      }

      // Verificar também aliases/nomes alternativos
      if (location.aliases) {
        for (const alias of location.aliases) {
          if (input.includes(alias.toLowerCase())) {
            return { name: location.name, type: location.type };
          }
        }
      }
    }

    // Tentar encontrar nome de local após palavras-chave
    const locationIndicators = [
      'mostrar',
      'exibir',
      'ver',
      'ir para',
      'local',
      'lugar',
    ];

    for (const indicator of locationIndicators) {
      const index = input.indexOf(indicator);
      if (index !== -1) {
        const possibleLocation = input
          .substring(index + indicator.length)
          .trim();
        if (possibleLocation) {
          return { name: possibleLocation, type: 'unknown' };
        }
      }
    }

    return null;
  }

  _extractRouteLocations(input) {
    const result = {};

    // Extrair destino (mais importante)
    const destIndicators = [
      'para',
      'ate',
      'até',
      'em direcao a',
      'em direção a',
      'destino',
    ];
    for (const indicator of destIndicators) {
      const index = input.indexOf(indicator);
      if (index !== -1) {
        const possibleDest = input.substring(index + indicator.length).trim();
        if (possibleDest) {
          result.destination = { name: possibleDest, type: 'destination' };
          break;
        }
      }
    }

    // Extrair origem (opcional)
    const originIndicators = [
      'de',
      'da',
      'do',
      'partir de',
      'saindo de',
      'origem',
    ];
    for (const indicator of originIndicators) {
      const index = input.indexOf(indicator);
      if (index !== -1 && result.destination) {
        // Se temos destino, verificar se a origem está antes
        if (index < input.indexOf(result.destination.name)) {
          const possibleOrigin = input
            .substring(
              index + indicator.length,
              input.indexOf(result.destination.name)
            )
            .trim();
          if (possibleOrigin) {
            result.origin = { name: possibleOrigin, type: 'origin' };
            break;
          }
        }
      } else if (index !== -1) {
        // Se não temos destino definido, extrair o que parece ser origem
        const restOfInput = input.substring(index + indicator.length).trim();
        const nextSpace = restOfInput.indexOf(' ');
        const possibleOrigin =
          nextSpace !== -1 ? restOfInput.substring(0, nextSpace) : restOfInput;

        if (possibleOrigin) {
          result.origin = { name: possibleOrigin, type: 'origin' };
        }
      }
    }

    return result;
  }

  _extractCategory(input) {
    // Categorias conhecidas
    const categories = {
      praia: 'praias',
      praias: 'praias',
      'ponto turistico': 'pontos_turisticos',
      'pontos turisticos': 'pontos_turisticos',
      atracao: 'pontos_turisticos',
      atracoes: 'pontos_turisticos',
      restaurante: 'restaurantes',
      restaurantes: 'restaurantes',
      comer: 'restaurantes',
      comida: 'restaurantes',
      hotel: 'pousadas',
      pousada: 'pousadas',
      pousadas: 'pousadas',
      hospedagem: 'pousadas',
      loja: 'lojas',
      lojas: 'lojas',
      comprar: 'lojas',
      shopping: 'lojas',
      emergencia: 'emergencias',
      emergencias: 'emergencias',
      hospital: 'emergencias',
      medico: 'emergencias',
      policia: 'emergencias',
    };

    // Buscar categorias no input
    for (const [keyword, category] of Object.entries(categories)) {
      if (input.includes(keyword)) {
        return category;
      }
    }

    return null;
  }

  _extractPoiName(input, category) {
    // Se não temos categoria, não podemos extrair nome específico
    if (!category) return null;

    // Tenta extrair nome específico após a categoria
    const categoryTerms = {
      praias: ['praia', 'praias'],
      pontos_turisticos: ['ponto', 'pontos', 'atracao', 'atracoes'],
      restaurantes: ['restaurante', 'restaurantes', 'comida'],
      pousadas: ['hotel', 'pousada', 'hospedagem'],
      lojas: ['loja', 'shopping'],
      emergencias: ['emergencia', 'hospital', 'medico'],
    };

    const terms = categoryTerms[category] || [];

    for (const term of terms) {
      const index = input.indexOf(term);
      if (index !== -1) {
        const afterTerm = input.substring(index + term.length).trim();
        // Remover palavras comuns como "de", "da", "do"
        const cleanedName = afterTerm
          .replace(/^(de|da|do|dos|das)\s+/i, '')
          .trim();

        if (cleanedName) {
          return cleanedName;
        }
      }
    }

    // Se não encontrar nome específico, retornar null
    return null;
  }

  // Métodos para carregar dados
  async _loadIntents() {
    // Em produção, carregar de API ou arquivo
    this.intents = [
      {
        name: 'greeting',
        patterns: [
          'ola',
          'oi',
          'bom dia',
          'boa tarde',
          'boa noite',
          'hello',
          'hi',
        ],
      },
      {
        name: 'farewell',
        patterns: ['tchau', 'adeus', 'ate logo', 'ate mais', 'bye'],
      },
      {
        name: 'show_location',
        patterns: [
          'mostrar',
          'exibir',
          'ver',
          'onde fica',
          'localizar',
          'encontrar',
        ],
      },
      {
        name: 'create_route',
        patterns: [
          'rota',
          'caminho',
          'como chegar',
          'ir para',
          'direcao',
          'navegar',
        ],
      },
      {
        name: 'show_poi',
        patterns: [
          'ponto',
          'pontos',
          'local',
          'locais',
          'praia',
          'praias',
          'restaurante',
          'pousada',
          'loja',
          'atração',
        ],
      },
      {
        name: 'show_images',
        patterns: [
          'foto',
          'fotos',
          'imagem',
          'imagens',
          'mostrar foto',
          'ver foto',
        ],
      },
      {
        name: 'help',
        patterns: [
          'ajuda',
          'ajudar',
          'socorro',
          'como usar',
          'o que voce faz',
          'funcionalidades',
        ],
      },
    ];
  }

  async _loadEntities() {
    // Em produção, carregar de API ou arquivo
    this.entities = {
      locations: [
        { name: 'Primeira Praia', type: 'beach', aliases: ['Praia Um'] },
        { name: 'Segunda Praia', type: 'beach', aliases: ['Praia Dois'] },
        { name: 'Terceira Praia', type: 'beach', aliases: ['Praia Três'] },
        { name: 'Quarta Praia', type: 'beach', aliases: ['Praia Quatro'] },
        {
          name: 'Quinta Praia',
          type: 'beach',
          aliases: ['Praia Cinco', 'Praia do Encanto'],
        },
        { name: 'Toca do Morcego', type: 'tourist_spot' },
        { name: 'Farol', type: 'tourist_spot' },
        { name: 'Fonte Grande', type: 'tourist_spot', aliases: ['Cachoeira'] },
        // Mais locais seriam adicionados aqui
      ],
    };
  }
}
