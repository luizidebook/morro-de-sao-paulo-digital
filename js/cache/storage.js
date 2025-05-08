// 5. Cache e LocalStorage
/**
 * 1. cacheRouteData - Salva dados da rota (instruções e polyline) no cache local (localStorage).
 */
export function cacheRouteData(routeInstructions, routeLatLngs) {
  if (typeof localStorage === "undefined") {
    console.warn("LocalStorage não está disponível.");
    return;
  }
  try {
    const data = {
      instructions: routeInstructions,
      route: routeLatLngs,
      timestamp: Date.now(),
    };
    localStorage.setItem("cachedRoute", JSON.stringify(data));
    console.log("[cacheRouteData] Rota salva no cache local (localStorage).");
    showNotification("Rota salva em cache para uso offline.", "success");
  } catch (err) {
    console.error("[cacheRouteData] Erro ao salvar rota no cache:", err);
    showNotification(
      getGeneralText("routeDataError", navigationState.lang),
      "error"
    );
  }
}

/*
 * 2. loadRouteFromCache - Carrega rota salva do cache (localStorage). */
function loadRouteFromCache() {
  if (typeof localStorage === "undefined") {
    console.warn("LocalStorage não está disponível.");
    return null;
  }
  try {
    const dataStr = localStorage.getItem("cachedRoute");
    if (!dataStr) {
      console.warn("[loadRouteFromCache] Nenhuma rota salva no cache.");
      return null;
    }
    const data = JSON.parse(dataStr);
    console.log("[loadRouteFromCache] Rota carregada do cache:", data);
    showNotification("Rota carregada do cache com sucesso.", "info");
    return data;
  } catch (err) {
    console.error("[loadRouteFromCache] Erro ao carregar rota do cache:", err);
    showNotification(
      getGeneralText("routeDataError", navigationState.lang),
      "error"
    );
    return null;
  }
} /*

  --- 5.2. Destinos, LocalStorage e Histórico ---
 /**
 * 1. loadDestinationsFromCache - Carrega destinos salvos do cache (ou Service Worker). */
function loadDestinationsFromCache(callback) {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      command: "loadDestinations",
    });
    navigator.serviceWorker.onmessage = (event) => {
      if (event.data.command === "destinationsLoaded") {
        callback(event.data.data);
      }
    };
  } else {
    console.error("Service worker não está ativo.");
  }
} /*

/**
 * 2. getLocalStorageItem - Recupera item do localStorage, parseando JSON.
 */
export function getLocalStorageItem(key) {
  const item = localStorage.getItem(key);
  try {
    return JSON.parse(item); // Tenta converter o valor para JSON
  } catch (error) {
    console.error(`Erro ao analisar JSON para a chave ${key}:`, error);
    return item; // Retorna o valor bruto se não for JSON válido
  }
}

/**
 * 3. setLocalStorageItem - Define item no localStorage, convertendo para JSON.
 */
function setLocalStorageItem(key, value) {
  localStorage.setItem(key, JSON.stringify(value)); // Armazena o valor de forma segura como JSON
}

/**
 * 4. removeLocalStorageItem - Remove item do localStorage por chave.
 */
function removeLocalStorageItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Erro ao remover item do localStorage (${key}):`, error);
  }
}

/**
 * 5. saveDestinationToCache - Salva destino selecionado no cache local.
 */
function saveDestinationToCache(destination) {
  return new Promise((resolve, reject) => {
    try {
      console.log("Saving Destination to Cache:", destination);
      localStorage.setItem("selectedDestination", JSON.stringify(destination));
      resolve();
    } catch (error) {
      console.error("Erro ao salvar destino no cache:", error);
      reject(new Error("Erro ao salvar destino no cache."));
    }
  });
}

/**
 * 6. saveRouteToHistory - Salva rota no histórico (localStorage).
 */
function saveRouteToHistory(route) {
  const historyStr = localStorage.getItem("routeHistory") || "[]";
  const history = JSON.parse(historyStr);
  history.push(route);
  localStorage.setItem("routeHistory", JSON.stringify(history));
  console.log("Rota salva no histórico (routeHistory).");
}

/**
 * 7. saveSearchQueryToHistory - Salva query de pesquisa no histórico.
 */
function saveSearchQueryToHistory(query) {
  const searchHistoryStr = localStorage.getItem("searchHistory") || "[]";
  const searchHistoryArr = JSON.parse(searchHistoryStr);
  searchHistoryArr.push(query);
  localStorage.setItem("searchHistory", JSON.stringify(searchHistoryArr));
  console.log("Consulta de pesquisa salva no histórico:", query);
}

/**
 * 8. loadOfflineInstructions - Carrega instruções offline (ex.: localStorage).
 */
function loadOfflineInstructions() {
  const cachedInstr = localStorage.getItem("offlineInstructions");
  if (cachedInstr) {
    return JSON.parse(cachedInstr);
  } else {
    console.warn("Nenhuma instrução offline encontrada.");
    return [];
  }
}

/**
 * 9. loadSearchHistory
 *    Carrega o histórico de buscas do localStorage e exibe na interface.
 */
function loadSearchHistory() {
  const history = getLocalStorageItem("searchHistory", []);
  searchHistory = history; // Atualiza a variável global

  const historyContainer = document.getElementById("search-history-container");
  if (historyContainer) {
    historyContainer.innerHTML = "";
    history.forEach((query) => {
      const historyItem = document.createElement("div");
      historyItem.className = "history-item";
      historyItem.textContent = query;
      historyContainer.appendChild(historyItem);
    });
  }
}
