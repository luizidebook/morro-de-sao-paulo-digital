// dialog.js – Processamento de entrada do usuário e definição de respostas

import { showLocationOnMap, showAllLocationsOnMap } from "../map/uiMap.js";
import { intents } from "../assistant/intent-manager.js";
import { translations } from "../../i18n/translations.js";
import { conversationState } from "../assistant/assistant.js";
import { locations } from "../locations/locations.js";

/**
 * Processa a mensagem do usuário, define resposta e ação.
 * @param {string} input - Texto do usuário.
 * @param {object} context - Contexto atual da aplicação (ex: { map })
 * @returns {Promise<{ text: string, action?: Function }>}
 */
export async function processUserInput(input, context = {}) {
  const normalized = input.trim().toLowerCase();

  // Função auxiliar para buscar locais em uma categoria
  const findLocation = (category, name) =>
    locations[category]?.find(
      (location) => location.name.toLowerCase() === name
    );

  // Função auxiliar para verificar palavras-chave
  const includesKeywords = (keywords) =>
    keywords.some((keyword) => normalized.includes(keyword));

  // Verifica se o usuário mencionou "Toca do Morcego"
  if (normalized.includes("toca do morcego")) {
    const toca = findLocation("attractions", "toca do morcego");
    if (toca) {
      return {
        text: `Aqui está a localização da atração ${toca.name}: ${toca.description}`,
        action: () => showLocationOnMap(toca.name, toca.lat, toca.lon),
      };
    }
  }

  // Categorias gerais com palavras-chave associadas
  const categories = [
    { key: "praias", category: "beaches", keywords: ["praias", "mar"] },
    {
      key: "restaurantes",
      category: "restaurants",
      keywords: ["restaurantes", "comida", "onde comer"],
    },
    {
      key: "hotéis",
      category: "hotels",
      keywords: ["hotéis", "pousadas", "hospedagem", "onde ficar"],
    },
    {
      key: "lojas",
      category: "shops",
      keywords: ["lojas", "compras", "shopping"],
    },
    {
      key: "atrações",
      category: "attractions",
      keywords: ["atrações", "pontos turísticos", "o que fazer"],
    },
    {
      key: "festas",
      category: "nightclubs",
      keywords: ["festas", "baladas", "nightclub"],
    },
  ];

  // Verifica se o usuário mencionou uma categoria geral
  for (const { key, category, keywords } of categories) {
    if (includesKeywords(keywords)) {
      return {
        text: `Aqui estão todas as ${key} disponíveis. Estou exibindo no mapa.`,
        action: () => showAllLocationsOnMap(locations[category]),
      };
    }
  }

  // Verifica locais específicos em todas as categorias
  for (const category of Object.keys(locations)) {
    for (const location of locations[category]) {
      if (normalized.includes(location.name.toLowerCase())) {
        return {
          text: `Aqui está a localização de ${location.name}: ${location.description}`,
          action: () =>
            showLocationOnMap(location.name, location.lat, location.lon),
        };
      }
    }
  }

  // Intenções adicionais
  if (includesKeywords(["ajuda", "como usar", "o que posso perguntar"])) {
    return {
      text: "Você pode perguntar sobre praias, restaurantes, pousadas, lojas, atrações ou festas. Por exemplo: 'Quais são as praias disponíveis?' ou 'Onde fica a Toca do Morcego?'",
    };
  }

  if (includesKeywords(["localização atual", "onde estou"])) {
    return {
      text: "Estou exibindo sua localização atual no mapa.",
      action: () => context.map?.locate({ setView: true, maxZoom: 16 }),
    };
  }

  if (includesKeywords(["favoritos", "meus favoritos"])) {
    const favorites = conversationState.preferences;
    const favoriteLocations = Object.entries(favorites)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

    return {
      text: favoriteLocations
        ? `Aqui estão seus favoritos:\n${favoriteLocations}`
        : "Você ainda não adicionou nenhum favorito.",
    };
  }

  // Resposta padrão para entradas não reconhecidas
  return {
    text: "Desculpe, não entendi. Você pode perguntar sobre praias, restaurantes, pousadas, lojas, atrações ou festas. Também posso ajudar com sua localização atual ou favoritos.",
  };
}
