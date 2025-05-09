/**
 * Sistema avançado de geolocalização para navegação
 * Implementa abordagens multi-sensores para obtenção de localização precisa
 */

// Configurações sensíveis ao contexto
const DEFAULT_OPTIONS = {
  // Alta precisão como padrão para navegação
  enableHighAccuracy: true,
  // Timeout razoável para equilibrar velocidade e qualidade
  timeout: 15000,
  // Aceitar dados com até 5 segundos
  maximumAge: 5000,
  // Configurações adicionais
  desiredAccuracy: 10, // metros (ideal)
  fallbackAccuracy: 50, // metros (aceitável)
  retryAttempts: 3, // número de tentativas
  useAllSensors: true, // usar todos os sensores disponíveis
  persistentTracking: true, // manter rastreamento mesmo em background
};

// Variáveis para gestão de estado
let watchId = null;
let retryCount = 0;
let fallbackUsed = false;
let lastKnownPosition = null;
let locationListeners = [];
let permissionStatus = null;
let isRequestingPermission = false;
let locationErrorCallbacks = [];

/**
 * Solicita permissão de localização com explicação clara e UX melhorada
 * @returns {Promise<boolean>} Indica se a permissão foi concedida
 */
export async function requestLocationPermission() {
  if (isRequestingPermission) {
    return new Promise((resolve) => {
      // Adicionar callback para ser notificado quando a solicitação atual terminar
      locationListeners.push((status) => resolve(status === "granted"));
    });
  }

  isRequestingPermission = true;
  console.log("[enhanced-geolocation] Solicitando permissão de localização");

  try {
    // 1. Verificar suporte à API de permissões
    if ("permissions" in navigator) {
      try {
        // Verificar status atual da permissão
        permissionStatus = await navigator.permissions.query({
          name: "geolocation",
        });

        if (permissionStatus.state === "granted") {
          console.log("[enhanced-geolocation] Permissão já concedida");
          isRequestingPermission = false;
          notifyLocationListeners("granted");
          return true;
        } else if (permissionStatus.state === "denied") {
          console.warn(
            "[enhanced-geolocation] Permissão já negada, exibindo instruções"
          );
          showPermissionInstructions();
          isRequestingPermission = false;
          notifyLocationListeners("denied");
          return false;
        }

        // Observar mudanças futuras no status da permissão
        permissionStatus.addEventListener("change", handlePermissionChange);
      } catch (error) {
        console.warn(
          "[enhanced-geolocation] Erro ao verificar permissão:",
          error
        );
      }
    }

    // 2. Mostrar diálogo explicativo personalizado antes da solicitação do sistema
    await showLocationExplanationDialog();

    // 3. Solicitar permissão com timeout adequado
    const permissionResult = await requestGeolocationWithTimeout();
    isRequestingPermission = false;
    notifyLocationListeners(permissionResult ? "granted" : "denied");
    return permissionResult;
  } catch (error) {
    console.error("[enhanced-geolocation] Erro ao solicitar permissão:", error);
    isRequestingPermission = false;
    notifyLocationListeners("error");
    return false;
  }
}

/**
 * Trata mudanças no status de permissão
 * @param {PermissionStatusEvent} event - Evento de mudança de permissão
 */
function handlePermissionChange(event) {
  console.log(
    `[enhanced-geolocation] Status da permissão alterado: ${event.target.state}`
  );
  notifyLocationListeners(event.target.state);
}

/**
 * Notifica listeners sobre mudanças no status da permissão
 * @param {string} status - Status atual da permissão
 */
function notifyLocationListeners(status) {
  while (locationListeners.length > 0) {
    const listener = locationListeners.shift();
    listener(status);
  }
}

/**
 * Solicita geolocalização com timeout para evitar travamento
 * @returns {Promise<boolean>} - Indica se obteve permissão
 */
function requestGeolocationWithTimeout() {
  return new Promise((resolve) => {
    // Timeout para evitar bloqueio indefinido
    const timeoutId = setTimeout(() => {
      console.warn("[enhanced-geolocation] Timeout ao solicitar permissão");
      resolve(false);
    }, 20000);

    // Tentar obter posição única para acionar solicitação de permissão
    navigator.geolocation.getCurrentPosition(
      () => {
        clearTimeout(timeoutId);
        resolve(true);
      },
      (error) => {
        clearTimeout(timeoutId);
        console.warn(
          "[enhanced-geolocation] Erro ao solicitar permissão:",
          error
        );
        resolve(error.code !== 1); // Não é erro de permissão negada
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

/**
 * Exibe diálogo explicando por que a permissão de localização é necessária
 * @returns {Promise<void>}
 */
async function showLocationExplanationDialog() {
  // Implementação de UI para explicar ao usuário por que precisamos da localização
  return new Promise((resolve) => {
    // Se já temos função de notificação implementada no sistema
    if (typeof showNotification === "function") {
      showNotification(
        "Para navegação precisa, este app precisa acessar sua localização. " +
          "A permissão será solicitada em seguida.",
        "info",
        8000 // Duração longa para dar tempo de ler
      );

      // Resolver após breve atraso para o usuário ler
      setTimeout(resolve, 2000);
    } else {
      // Implementação simples se não tivermos um sistema de notificação
      const dialog = document.createElement("div");
      dialog.className = "location-permission-dialog";
      dialog.innerHTML = `
        <div class="dialog-content">
          <h3>Permissão de Localização</h3>
          <p>Para guiar você com precisão ao seu destino, precisamos da sua permissão para acessar sua localização em tempo real.</p>
          <p>Isso nos permite:</p>
          <ul>
            <li>Mostrar sua posição exata no mapa</li>
            <li>Calcular a melhor rota ao destino</li>
            <li>Avisar quando você deve virar</li>
          </ul>
          <button id="location-permission-continue">Continuar</button>
        </div>
      `;

      // Adicionar estilos inline para garantir visibilidade
      dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

      dialog.querySelector(".dialog-content").style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 10px;
        max-width: 90%;
        width: 400px;
      `;

      dialog.querySelector("button").style.cssText = `
        background: #3B82F6;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        margin-top: 15px;
        font-weight: bold;
        width: 100%;
      `;

      document.body.appendChild(dialog);

      dialog.querySelector("button").addEventListener("click", () => {
        dialog.remove();
        resolve();
      });
    }
  });
}

/**
 * Mostra instruções caso a permissão tenha sido negada
 */
function showPermissionInstructions() {
  if (typeof showNotification === "function") {
    showNotification(
      "Permissão de localização necessária. Por favor, acesse as configurações do seu navegador para habilitá-la.",
      "error",
      10000
    );
  } else {
    alert(
      "Para usar a navegação, você precisa permitir o acesso à sua localização. " +
        "Por favor, acesse as configurações do seu navegador/dispositivo para conceder essa permissão."
    );
  }
}

/**
 * Obtém a localização atual com suporte a múltiplas estratégias e fallbacks
 * @param {Object} options - Opções de configuração
 * @returns {Promise<Object>} - Objeto com dados de localização
 */
export async function getCurrentLocation(options = {}) {
  const settings = { ...DEFAULT_OPTIONS, ...options };

  console.log(
    "[enhanced-geolocation] Obtendo localização atual com alta precisão"
  );

  try {
    // 1. Verificar se temos permissão
    if (permissionStatus === null || permissionStatus.state !== "granted") {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        console.warn(
          "[enhanced-geolocation] Sem permissão para acessar localização"
        );
        throw new Error("PERMISSION_DENIED");
      }
    }

    // 2. Tenta obter localização do GPS com alta precisão
    try {
      const position = await getPositionPromise({
        enableHighAccuracy: true,
        timeout: settings.timeout,
        maximumAge: 0, // Forçar posição atual
      });

      // Salvar como última posição conhecida e retornar
      updateLastKnownPosition(position);
      console.log(
        "[enhanced-geolocation] Posição obtida com precisão alta:",
        position
      );
      return position;
    } catch (error) {
      console.warn(
        "[enhanced-geolocation] Erro ao obter posição com alta precisão:",
        error
      );

      // 3. Se falhar com alta precisão, tentar com precisão menor
      if (error.code !== 1) {
        // Não é erro de permissão
        try {
          console.log("[enhanced-geolocation] Tentando com precisão menor");
          const position = await getPositionPromise({
            enableHighAccuracy: false,
            timeout: settings.timeout,
            maximumAge: 15000, // Posição mais antiga é aceitável como fallback
          });

          updateLastKnownPosition(position);
          console.log(
            "[enhanced-geolocation] Posição obtida com precisão reduzida:",
            position
          );
          return position;
        } catch (fallbackError) {
          console.warn(
            "[enhanced-geolocation] Erro na tentativa com precisão reduzida:",
            fallbackError
          );
        }
      }

      // 4. Por último, tentar usar última posição conhecida
      if (lastKnownPosition) {
        console.log(
          "[enhanced-geolocation] Usando última posição conhecida:",
          lastKnownPosition
        );
        return lastKnownPosition;
      }

      // 5. Sem alternativas, propagar o erro
      throw error;
    }
  } catch (error) {
    console.error("[enhanced-geolocation] Erro ao obter localização:", error);

    // Notificar callbacks de erro
    notifyLocationErrorCallbacks(error);

    throw error;
  }
}

/**
 * Promisifica o getCurrentPosition da API de geolocalização
 * @param {Object} options - Opções para geolocalização
 * @returns {Promise<Object>} - Promessa com resultado da geolocalização
 */
function getPositionPromise(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(formatPosition(position));
      },
      (error) => {
        reject(error);
      },
      options
    );
  });
}

/**
 * Inicia o monitoramento contínuo da localização do usuário
 * com suporte a múltiplos sensores e modos de economia de bateria
 * @param {Function} successCallback - Função chamada quando há atualização de posição
 * @param {Function} errorCallback - Função chamada em caso de erro
 * @param {Object} options - Opções de configuração
 * @returns {number} ID do observador para cancelamento posterior
 */
export function startLocationTracking(
  successCallback,
  errorCallback,
  options = {}
) {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  retryCount = 0;
  fallbackUsed = false;

  // Registrar callback de erro se fornecido
  if (errorCallback && typeof errorCallback === "function") {
    locationErrorCallbacks.push(errorCallback);
  }

  // Primeiro verificar permissão
  requestLocationPermission().then((hasPermission) => {
    if (!hasPermission) {
      if (errorCallback) {
        errorCallback({
          code: 1,
          message: "Permissão para localização negada",
        });
      }
      return;
    }

    // Função de sucesso com processamento extra
    const enhancedSuccessCallback = (position) => {
      // Resetar contadores quando recebemos posição com sucesso
      retryCount = 0;
      fallbackUsed = false;

      // Atualizar última posição conhecida
      const formattedPosition = formatPosition(position);
      updateLastKnownPosition(formattedPosition);

      // Aplicar melhoria de precisão usando sensores adicionais
      if (settings.useAllSensors) {
        enhancePositionWithSensors(formattedPosition).then(
          (enhancedPosition) => {
            successCallback(enhancedPosition);
          }
        );
      } else {
        successCallback(formattedPosition);
      }
    };

    // Função de erro com retentativas inteligentes
    const enhancedErrorCallback = (error) => {
      console.warn("[enhanced-geolocation] Erro de rastreamento:", error);

      // Incrementar contador de tentativas
      retryCount++;

      if (error.code !== 1 && retryCount <= settings.retryAttempts) {
        // Alternar para modo de baixa precisão após falhas
        if (!fallbackUsed) {
          fallbackUsed = true;
          console.log(
            "[enhanced-geolocation] Alternando para modo de baixa precisão"
          );

          // Tentar com baixa precisão
          if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
          }

          watchId = navigator.geolocation.watchPosition(
            enhancedSuccessCallback,
            enhancedErrorCallback,
            {
              enableHighAccuracy: false,
              timeout: settings.timeout * 1.5,
              maximumAge: settings.maximumAge * 2,
            }
          );
        } else if (lastKnownPosition) {
          // Usar última posição conhecida temporariamente
          console.log(
            "[enhanced-geolocation] Usando última posição conhecida como fallback"
          );
          successCallback({
            ...lastKnownPosition,
            timestamp: Date.now(),
            isFallback: true,
          });
        }
      } else {
        // Propagar erro para callback original
        if (errorCallback) {
          errorCallback(error);
        }

        // Se for erro de permissão, não tentar mais
        if (error.code === 1) {
          if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
          }
        }
      }

      // Notificar todos os callbacks de erro registrados
      notifyLocationErrorCallbacks(error);
    };

    // Iniciar rastreamento com alta precisão primeiro
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }

    watchId = navigator.geolocation.watchPosition(
      enhancedSuccessCallback,
      enhancedErrorCallback,
      {
        enableHighAccuracy: settings.enableHighAccuracy,
        timeout: settings.timeout,
        maximumAge: settings.maximumAge,
      }
    );

    // Adicionar suporte a rastreamento em background se disponível
    enableBackgroundTracking(settings.persistentTracking);

    console.log("[enhanced-geolocation] Rastreamento de localização iniciado");
  });

  return watchId;
}

/**
 * Para o monitoramento de localização
 */
export function stopLocationTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    console.log("[enhanced-geolocation] Rastreamento de localização parado");
  }

  // Limpar callbacks de erro
  locationErrorCallbacks = [];

  // Desativar rastreamento em background
  disableBackgroundTracking();
}

/**
 * Formata objeto Position para formato padronizado
 * @param {Position} position - Objeto Position da API Geolocation
 * @returns {Object} Objeto formatado com campos consistentes
 */
function formatPosition(position) {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    altitude: position.coords.altitude,
    altitudeAccuracy: position.coords.altitudeAccuracy,
    heading: position.coords.heading,
    speed: position.coords.speed,
    timestamp: position.timestamp,
  };
}

/**
 * Atualiza referência da última posição conhecida
 * @param {Object} position - Dados de posição
 */
function updateLastKnownPosition(position) {
  lastKnownPosition = { ...position };

  // Atualizar também no armazenamento local para recuperação entre sessões
  try {
    localStorage.setItem(
      "lastKnownPosition",
      JSON.stringify({
        position: lastKnownPosition,
        timestamp: Date.now(),
      })
    );
  } catch (e) {
    console.warn(
      "[enhanced-geolocation] Não foi possível salvar posição no localStorage"
    );
  }
}

/**
 * Habilita rastreamento em background quando disponível
 * @param {boolean} persistent - Se o rastreamento deve persistir em background
 */
function enableBackgroundTracking(persistent) {
  // Verificar suporte à API Background Geolocation
  if ("BackgroundGeolocation" in window) {
    try {
      // Android/iOS normalmente possuem plugins específicos
      window.BackgroundGeolocation.configure({
        desiredAccuracy: 10,
        stationaryRadius: 10,
        distanceFilter: 5,
        debug: false,
        stopOnTerminate: !persistent,
      });

      window.BackgroundGeolocation.start();
      console.log(
        "[enhanced-geolocation] Rastreamento em background ativado via plugin"
      );
    } catch (e) {
      console.warn(
        "[enhanced-geolocation] Erro ao configurar rastreamento em background:",
        e
      );
    }
  }

  // Verificar permissões específicas da plataforma sem causar erros
  if (navigator.permissions && persistent) {
    try {
      // Lista de permissões potenciais relacionadas à geolocalização
      const permissionNames = ["geolocation"];

      // Alguns navegadores podem suportar essas permissões no futuro
      if (navigator.userAgent.includes("Chrome")) {
        // Não tenta permissões não padronizadas em navegadores não suportados
        console.log(
          "[enhanced-geolocation] O rastreamento em background pode ter funcionalidade limitada neste navegador"
        );
      }

      // Verificar apenas a permissão de geolocalização padrão
      navigator.permissions
        .query({ name: "geolocation" })
        .then((status) => {
          console.log(
            `[enhanced-geolocation] Status de permissão geolocation: ${status.state}`
          );

          // Se estamos em um dispositivo móvel, mostrar informações adicionais
          if (isMobileDevice()) {
            console.log(
              "[enhanced-geolocation] Para melhor rastreamento em dispositivos móveis, mantenha o aplicativo aberto"
            );
          }
        })
        .catch((e) => {
          console.warn(
            "[enhanced-geolocation] Erro ao verificar permissão de geolocalização:",
            e
          );
        });
    } catch (e) {
      console.warn("[enhanced-geolocation] Erro ao verificar permissões:", e);
    }
  }

  // Salvar configuração para referência
  try {
    localStorage.setItem("persistentTracking", persistent ? "true" : "false");
  } catch (e) {
    console.warn(
      "[enhanced-geolocation] Erro ao salvar preferência de rastreamento:",
      e
    );
  }

  // Função auxiliar para detectar dispositivos móveis
  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }
}

/**
 * Desabilita rastreamento em background se ativo
 */
function disableBackgroundTracking() {
  if ("BackgroundGeolocation" in window) {
    try {
      window.BackgroundGeolocation.stop();
      console.log(
        "[enhanced-geolocation] Rastreamento em background desativado"
      );
    } catch (e) {
      console.warn(
        "[enhanced-geolocation] Erro ao desativar rastreamento em background:",
        e
      );
    }
  }
}

/**
 * Notifica todos os callbacks de erro registrados
 * @param {Error} error - Objeto de erro
 */
function notifyLocationErrorCallbacks(error) {
  locationErrorCallbacks.forEach((callback) => {
    try {
      callback(error);
    } catch (callbackError) {
      console.warn(
        "[enhanced-geolocation] Erro ao executar callback:",
        callbackError
      );
    }
  });
}

/**
 * Melhora dados de posição usando outros sensores disponíveis
 * @param {Object} position - Posição original
 * @returns {Promise<Object>} - Posição aprimorada
 */
async function enhancePositionWithSensors(position) {
  const enhancedPosition = { ...position };

  // Tenta acessar sensores se disponíveis
  if ("DeviceOrientationEvent" in window || "DeviceMotionEvent" in window) {
    try {
      // Melhorar a precisão do heading usando o sensor de orientação
      if ("DeviceOrientationEvent" in window && !enhancedPosition.heading) {
        const orientation = await getDeviceOrientation();
        if (orientation && orientation.alpha !== null) {
          enhancedPosition.heading = orientation.alpha;
          enhancedPosition.headingSource = "deviceorientation";
        }
      }

      // Estimar velocidade se não disponível
      if ("DeviceMotionEvent" in window && !enhancedPosition.speed) {
        const motion = await getDeviceMotion();
        if (motion && motion.acceleration) {
          // Cálculo simplificado de velocidade baseado em aceleração
          const accelMagnitude = Math.sqrt(
            Math.pow(motion.acceleration.x || 0, 2) +
              Math.pow(motion.acceleration.y || 0, 2) +
              Math.pow(motion.acceleration.z || 0, 2)
          );

          // Estimativa muito simples apenas para fins de backup
          if (accelMagnitude > 1) {
            enhancedPosition.speed = accelMagnitude * 0.5; // Estimativa básica
            enhancedPosition.speedSource = "devicemotion";
          }
        }
      }
    } catch (e) {
      console.warn(
        "[enhanced-geolocation] Erro ao acessar sensores adicionais:",
        e
      );
    }
  }

  // Verificar acurácia da posição em alguns dispositivos Android
  if ("performance" in window && enhancedPosition.accuracy > 100) {
    enhancedPosition.accuracyLevel = "low";
  } else if (enhancedPosition.accuracy <= 10) {
    enhancedPosition.accuracyLevel = "high";
  } else {
    enhancedPosition.accuracyLevel = "medium";
  }

  return enhancedPosition;
}

/**
 * Obtém orientação do dispositivo como Promise
 * @returns {Promise<Object>} Dados de orientação
 */
function getDeviceOrientation() {
  if (!("DeviceOrientationEvent" in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let timeoutId;

    const handleOrientation = (event) => {
      window.removeEventListener("deviceorientation", handleOrientation);
      clearTimeout(timeoutId);
      resolve({
        alpha: event.alpha, // Z-axis rotation [0,360)
        beta: event.beta, // X-axis rotation [-180,180]
        gamma: event.gamma, // Y-axis rotation [-90,90]
      });
    };

    // Timeout caso o evento não seja disparado
    timeoutId = setTimeout(() => {
      window.removeEventListener("deviceorientation", handleOrientation);
      resolve(null);
    }, 1000);

    window.addEventListener("deviceorientation", handleOrientation, {
      once: true,
    });

    // Em alguns browsers, precisamos solicitar permissão
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      DeviceOrientationEvent.requestPermission().catch(() => {
        window.removeEventListener("deviceorientation", handleOrientation);
        clearTimeout(timeoutId);
        resolve(null);
      });
    }
  });
}

/**
 * Obtém movimento do dispositivo como Promise
 * @returns {Promise<Object>} Dados de movimento
 */
function getDeviceMotion() {
  if (!("DeviceMotionEvent" in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let timeoutId;

    const handleMotion = (event) => {
      window.removeEventListener("devicemotion", handleMotion);
      clearTimeout(timeoutId);
      resolve({
        acceleration: event.acceleration,
        rotationRate: event.rotationRate,
        interval: event.interval,
      });
    };

    timeoutId = setTimeout(() => {
      window.removeEventListener("devicemotion", handleMotion);
      resolve(null);
    }, 1000);

    window.addEventListener("devicemotion", handleMotion, { once: true });

    // Em alguns browsers, precisamos solicitar permissão
    if (
      typeof DeviceMotionEvent !== "undefined" &&
      typeof DeviceMotionEvent.requestPermission === "function"
    ) {
      DeviceMotionEvent.requestPermission().catch(() => {
        window.removeEventListener("devicemotion", handleMotion);
        clearTimeout(timeoutId);
        resolve(null);
      });
    }
  });
}

/**
 * Verifica se as coordenadas são válidas
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {boolean} Se as coordenadas são válidas
 */
export function isValidCoordinate(latitude, longitude) {
  return (
    latitude !== undefined &&
    longitude !== undefined &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

/**
 * Obtém a melhor localização possível, mesmo que seja uma aproximação
 * @returns {Promise<Object>} - Melhor estimativa de localização
 */
export async function getBestEffortLocation(timeoutMs = 30000) {
  console.log(
    `[enhanced-geolocation] Obtendo localização com timeout de ${timeoutMs}ms`
  );

  // Verificar se já temos uma posição recente
  if (lastKnownPosition) {
    const positionAge = Date.now() - (lastKnownPosition.timestamp || 0);
    if (positionAge < 60000) {
      // Menos de 1 minuto
      console.log(
        "[enhanced-geolocation] Usando posição recente:",
        lastKnownPosition
      );
      return lastKnownPosition;
    }
  }

  // Verificar se temos uma posição salva no localStorage
  try {
    const savedPositionData = localStorage.getItem("lastKnownPosition");
    if (savedPositionData) {
      const savedData = JSON.parse(savedPositionData);
      const age = Date.now() - savedData.timestamp;

      if (age < 3600000) {
        // Menos de 1 hora
        console.log(
          "[enhanced-geolocation] Usando posição recuperada do localStorage"
        );
        lastKnownPosition = savedData.position;
        return savedData.position;
      }
    }
  } catch (e) {
    /* Ignorar erros de localStorage */
  }

  // Tentar obter uma nova posição com timeout
  return Promise.race([
    getCurrentLocation(),
    new Promise((_, reject) => {
      setTimeout(() => {
        console.warn(
          `[enhanced-geolocation] Timeout final após ${timeoutMs}ms`
        );
        reject(new Error("TIMEOUT"));
      }, timeoutMs);
    }),
  ]).catch((error) => {
    console.warn("[enhanced-geolocation] Erro ao obter posição:", error);

    // Se falhar, tentar com lower accuracy como última tentativa
    if (error.message === "TIMEOUT") {
      console.log(
        "[enhanced-geolocation] Tentando posição com baixa precisão..."
      );
      return getPositionPromise({
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 60000, // Aceitar posições mais antigas
      }).catch(() => {
        // Se ainda falhar, retornar última conhecida ou null
        console.log(
          "[enhanced-geolocation] Retornando última posição conhecida (fallback final)"
        );
        return lastKnownPosition || null;
      });
    }

    // Em caso de outros erros, retornar última conhecida ou null
    return lastKnownPosition || null;
  });
}

/**
 * Inicializa o sistema de geolocalização
 */
export function initGeolocationSystem() {
  // Carregar última posição conhecida do armazenamento local
  try {
    const savedPositionData = localStorage.getItem("lastKnownPosition");
    if (savedPositionData) {
      const savedData = JSON.parse(savedPositionData);
      lastKnownPosition = savedData.position;
      console.log(
        "[enhanced-geolocation] Última posição conhecida carregada do armazenamento"
      );
    }
  } catch (e) {
    console.warn("[enhanced-geolocation] Erro ao carregar posição salva:", e);
  }

  // Verificar permissões atuais sem iniciar diálogo
  if ("permissions" in navigator) {
    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        permissionStatus = status;
        console.log(
          `[enhanced-geolocation] Status atual da permissão: ${status.state}`
        );
        status.addEventListener("change", handlePermissionChange);
      })
      .catch((e) =>
        console.warn("[enhanced-geolocation] Erro ao verificar permissão:", e)
      );
  }

  console.log(
    "[enhanced-geolocation] Sistema de geolocalização avançada inicializado"
  );

  return {
    getCurrentLocation,
    startLocationTracking,
    stopLocationTracking,
    requestLocationPermission,
    getBestEffortLocation,
    isValidCoordinate,
  };
}

// Exportar objeto API
export default initGeolocationSystem();
