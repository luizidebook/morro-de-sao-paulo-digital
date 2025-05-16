/**
 * Módulo unificado para imagens de satélite no Mapbox
 * Combina funcionalidades de fontes diferentes, super-resolução, e melhorias visuais
 */
import { mapbox3dInstance } from "../map-3d.js";
import {
  addLoadingIndicator,
  removeLoadingIndicator,
} from "../../../utils/loadingIndicator.js";
import ModelDownloadUI from "./model-download-ui.js";
import modelDownloader from "../../../utils/model-downloader.js";

// Constantes para fontes de satélite
const SOURCES = {
  MAPBOX_STREETS: "mapbox://styles/mapbox/satellite-streets-v12",
  MAPBOX_HD: "mapbox://styles/mapbox/satellite-streets-v12",
  GOOGLE_SATELLITE: "google-satellite", // Fonte custom - requer configuração
  ESRI_WORLD: "esri-world-imagery", // Fonte custom - requer configuração
};

// Estado do módulo
let currentSource = SOURCES.MAPBOX_STREETS;
let enhancementLayer = null;
let isEnhanced = false;
let satelliteOverlaySource = null;
let userDefinedSettings = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  gamma: 1,
  resolution: "auto",
};

// Estado do renderizador de alta resolução
let model = null;
let isModelLoading = false;
let lastProcessedImage = null;
let processingQueue = [];
let isProcessing = false;

const MODEL_SOURCES = [
  {
    name: "Google Storage Direct",
    url: "https://storage.googleapis.com/tfjs-models/savedmodel/esrgan-tf2/model.json",
    requiresCheck: false,
  },
  {
    name: "Local Proxy",
    url: "http://localhost:3000/tfhub-proxy/captain-pool/esrgan-tf2/1/model.json",
    requiresCheck: true, // needs a status check first
  },
  {
    name: "TF Hub Direct",
    url: "https://tfhub.dev/captain-pool/esrgan-tf2/1/model.json",
    requiresCheck: false,
  },
  {
    name: "Local Path",
    url: "./assets/models/esrgan-tf2/model.json",
    requiresCheck: false,
  },
];

/**
 * Inicializa o módulo de melhoria de imagens de satélite
 * @returns {boolean} Sucesso da inicialização
 */
export function initSatelliteEnhancer() {
  try {
    if (!mapbox3dInstance) {
      console.warn("[satellite-enhancer] Mapbox não inicializado");
      return false;
    }

    // Adicionar ouvintes para eventos de estilo carregar
    mapbox3dInstance.on("style.load", () => {
      // Reaplica melhorias quando o estilo é alterado SE já estiverem ativas
      if (isEnhanced) applyEnhancements();
    });

    // Pré-carregar o modelo TensorFlow.js para super-resolução
    preloadSuperResolutionModel();

    console.log(
      "[satellite-enhancer] Módulo de melhoria de satélite inicializado"
    );
    return true;
  } catch (error) {
    console.error("[satellite-enhancer] Erro na inicialização:", error);
    return false;
  }
}

/**
 * Pré-carrega o modelo de super-resolução usando configuração otimizada
 * @returns {Promise<void>}
 */
async function preloadSuperResolutionModel() {
  try {
    // Verificar se TensorFlow já existe
    if (window.tf) {
      await initializeModelWithTensorFlow();
      return;
    }

    // Tentar carregar TensorFlow.js dinamicamente
    const tfLoaded = await tryLoadTensorFlow();

    if (tfLoaded) {
      await initializeModelWithTensorFlow();
    } else {
      // Fallback: criar um modelo simulado
      console.log(
        "[satellite-enhancer] Operando sem super-resolução (TensorFlow.js não disponível)"
      );
      setupFallbackModel();
    }
  } catch (error) {
    console.error(
      "[satellite-enhancer] Erro na inicialização do modelo:",
      error
    );
    setupFallbackModel();
  }
}

/**
 * Tenta carregar a biblioteca TensorFlow.js dinamicamente
 * @returns {Promise<boolean>} Sucesso do carregamento
 */
async function tryLoadTensorFlow() {
  // Não tentar carregar se já estamos em uma tentativa ou se já foi carregado
  if (isModelLoading || model || window.tf) return true;

  isModelLoading = true;
  console.log(
    "[satellite-enhancer] Tentando carregar TensorFlow.js dinamicamente..."
  );

  try {
    // Primeiro tentar verificar se existe um CDN confiável para o TensorFlow
    const tfCheck = await fetch(
      "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js",
      {
        method: "HEAD",
      }
    );

    if (!tfCheck.ok) {
      throw new Error("CDN não está disponível");
    }

    // Carregar os scripts do TensorFlow
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js";
      script.async = true;

      script.onload = () => {
        console.log("[satellite-enhancer] TensorFlow.js carregado com sucesso");
        isModelLoading = false;
        resolve(true);
      };

      script.onerror = () => {
        console.warn(
          "[satellite-enhancer] Não foi possível carregar TensorFlow.js"
        );
        isModelLoading = false;
        resolve(false);
      };

      document.head.appendChild(script);

      // Definir um timeout
      setTimeout(() => {
        if (isModelLoading) {
          console.warn(
            "[satellite-enhancer] Timeout ao carregar TensorFlow.js"
          );
          isModelLoading = false;
          resolve(false);
        }
      }, 10000);
    });
  } catch (error) {
    console.warn(
      "[satellite-enhancer] Erro ao verificar disponibilidade do TensorFlow:",
      error
    );
    isModelLoading = false;
    return false;
  }
}

/**
 * Inicializa o modelo de super-resolução com TensorFlow.js
 * @returns {Promise<void>}
 */
async function initializeModelWithTensorFlow() {
  if (model || !window.tf) return;

  try {
    isModelLoading = true;
    console.log("[satellite-enhancer] Carregando modelo de super-resolução...");

    // Mostrar notificação ao usuário que recursos avançados estão sendo preparados
    showSatelliteNotification(
      "Preparando recursos de melhoria de imagem...",
      "info"
    );

    // Usar configuração global ou padrões
    const config = window.tfConfig || {};
    const modelConfig = config.models?.superResolution || {};

    let modelPath;
    let modelError = null;

    // Tentar carregar o modelo usando lógica baseada na configuração
    if (config.useLocalOnly) {
      // Usar apenas modelo local
      modelPath = modelConfig.localPath || "./assets/models/esrgan-tf2/";
      try {
        model = await loadTFJSModel(modelPath);
      } catch (err) {
        modelError = err;
        console.warn(
          `[satellite-enhancer] Falha ao carregar modelo local: ${err.message}`
        );
      }
    } else if (config.useCDN) {
      // Tentar CDN primeiro, depois local
      try {
        modelPath =
          modelConfig.cdnPath ||
          "https://storage.googleapis.com/tfjs-models/savedmodel/esrgan-tf2/";
        model = await loadTFJSModel(modelPath);
      } catch (err) {
        console.warn(
          `[satellite-enhancer] Falha ao carregar do CDN, tentando local: ${err.message}`
        );
        try {
          modelPath = modelConfig.localPath || "./assets/models/esrgan-tf2/";
          model = await loadTFJSModel(modelPath);
        } catch (localErr) {
          modelError = localErr;
          console.warn(
            `[satellite-enhancer] Falha ao carregar modelo local: ${localErr.message}`
          );
        }
      }
    } else {
      // Tentar local primeiro, depois CDN
      try {
        modelPath = modelConfig.localPath || "./assets/models/esrgan-tf2/";
        model = await loadTFJSModel(modelPath);
      } catch (err) {
        console.warn(
          `[satellite-enhancer] Falha ao carregar local, tentando CDN: ${err.message}`
        );
        try {
          modelPath =
            modelConfig.cdnPath ||
            "https://storage.googleapis.com/tfjs-models/savedmodel/esrgan-tf2/";
          model = await loadTFJSModel(modelPath);
        } catch (cdnErr) {
          modelError = cdnErr;
          console.warn(
            `[satellite-enhancer] Falha ao carregar do CDN: ${cdnErr.message}`
          );
        }
      }
    }

    // Verificar se conseguimos carregar o modelo
    if (!model) {
      throw new Error(
        modelError || "Falha ao carregar modelo de super-resolução"
      );
    }

    console.log(
      "[satellite-enhancer] Modelo ESRGAN carregado com sucesso de: " +
        modelPath
    );

    // Warm-up do modelo para melhorar desempenho inicial
    await warmupModel();

    // Notificar que está pronto
    showSatelliteNotification(
      "Recursos de super-resolução prontos!",
      "success"
    );
  } catch (error) {
    console.warn(
      "[satellite-enhancer] Não foi possível carregar modelo de super-resolução:",
      error
    );
    setupFallbackModel();
  } finally {
    isModelLoading = false;
  }
}

// Updated loadTFJSModel function

async function loadTFJSModel(modelUrl) {
  try {
    console.log(`[satellite-enhancer] Carregando modelo de ${modelUrl}...`);

    // Check if we're loading the ESRGAN model
    if (modelUrl.includes("esrgan-tf2")) {
      const modelName = "esrgan";

      try {
        // First try CDN with explicit model.json path
        let cdnUrl =
          modelDownloader.modelConfigs[modelName].cdnUrl + "model.json";
        console.log(
          `[satellite-enhancer] Tentando carregar modelo de ${cdnUrl}`
        );

        try {
          // Test if the URL exists with a HEAD request
          const testResponse = await fetch(cdnUrl, {
            method: "HEAD",
            mode: "cors",
            headers: { Accept: "application/json" },
          });

          if (testResponse.ok) {
            return await tf.loadGraphModel(cdnUrl);
          }
        } catch (e) {
          console.log(
            `[satellite-enhancer] CDN principal não disponível: ${e.message}`
          );
        }

        // Try fallback CDN
        try {
          const fallbackUrl =
            modelDownloader.modelConfigs[modelName].fallbackCdnUrl;
          console.log(
            `[satellite-enhancer] Tentando CDN alternativo: ${fallbackUrl}`
          );
          return await tf.loadGraphModel(fallbackUrl);
        } catch (fallbackError) {
          console.log(
            `[satellite-enhancer] CDN alternativo falhou: ${fallbackError.message}`
          );
        }

        // If CDN fails, try downloading the model
        console.log("[satellite-enhancer] Baixando modelo ESRGAN...");
        const downloaded = await modelDownloader.downloadModel(
          modelName,
          (progress) => {
            console.log(
              `[satellite-enhancer] Progresso do download: ${progress.file} - ${progress.progress}/${progress.total}`
            );
          }
        );

        if (downloaded) {
          console.log(
            "[satellite-enhancer] Modelo baixado com sucesso, carregando..."
          );
          return await modelDownloader.loadModelFromStorage(modelName);
        }
      } catch (error) {
        console.error(
          `[satellite-enhancer] Falha ao carregar do CDN, tentando local: ${error.message}`
        );
      }

      // Finally, try local path
      try {
        const localUrl = "./assets/models/esrgan-tf2/model.json";
        console.log(
          `[satellite-enhancer] Tentando carregar modelo de caminho local: ${localUrl}`
        );
        return await tf.loadGraphModel(localUrl);
      } catch (localError) {
        console.error(
          `[satellite-enhancer] Falha ao carregar modelo local: ${localError.message}`
        );

        // As a last resort, create a simpler fallback model
        console.log("[satellite-enhancer] Configurando modelo de fallback");
        return createFallbackModel();
      }
    }

    // Fallback to original loading mechanism for non-ESRGAN models
    return await tf.loadGraphModel(modelUrl);
  } catch (error) {
    console.error(
      `[satellite-enhancer] Erro ao carregar modelo de ${modelUrl}: `,
      error
    );
    throw error;
  }
}

function createFallbackModel() {
  // Simple identity model that passes through the input tensor
  return {
    predict: function (input) {
      return input.clone();
    },
    execute: function (input) {
      return input.clone();
    },
    dispose: function () {},
    isFallbackModel: true,
  };
}

/**
 * Aquece o modelo com uma predição inicial para melhorar a performance
 */
async function warmupModel() {
  if (!model || !window.tf) return;

  try {
    console.log("[satellite-enhancer] Realizando warm-up do modelo...");

    // Criar um tensor simples para aquecer o modelo
    const dummyTensor = tf.zeros([1, 64, 64, 3]);

    // Executar uma predição descartável
    const result = model.predict(dummyTensor);

    // Liberar recursos
    dummyTensor.dispose();
    if (result.dispose) result.dispose();

    console.log("[satellite-enhancer] Warm-up do modelo concluído");
  } catch (error) {
    console.warn("[satellite-enhancer] Erro durante warm-up do modelo:", error);
  }
}

/**
 * Configura o modelo de fallback quando o TensorFlow não está disponível
 */
function setupFallbackModel() {
  console.log("[satellite-enhancer] Configurando modelo de fallback");

  // Criar um objeto simulado que implementa a mesma interface, mas sem processamento real
  model = {
    predict: function (input) {
      // Se for um tensor, retorná-lo como está
      if (input && typeof input.clone === "function") {
        return input.clone();
      }

      // Caso contrário, retornar um placeholder
      return {
        dispose: () => {},
        squeeze: () => {
          return { dispose: () => {} };
        },
      };
    },

    // Adicionar outros métodos necessários
    dispose: () => {},

    // Flag para indicar que é um modelo de fallback
    isFallbackModel: true,
  };

  // Definir suporte a recursos
  window.satelliteEnhancerCapabilities = {
    superResolution: false,
    enhancedFilters: true,
    nasaLayers: true,
  };
}

/**
 * Exibe uma notificação relativa à funcionalidade de satélite
 * @param {string} message - Mensagem a ser exibida
 * @param {string} type - Tipo de mensagem (info, success, warning, error)
 */
function showSatelliteNotification(message, type = "info") {
  // Verificar se existe uma função global de notificação
  if (typeof window.showNotification === "function") {
    window.showNotification(message, type);
    return;
  }

  // Implementação básica de fallback
  const notif = document.createElement("div");
  notif.className = `satellite-notification ${type}`;
  notif.textContent = message;

  // Estilos
  Object.assign(notif.style, {
    position: "fixed",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "10px 20px",
    borderRadius: "4px",
    color: "white",
    backgroundColor:
      type === "error"
        ? "#f44336"
        : type === "success"
        ? "#4caf50"
        : type === "warning"
        ? "#ff9800"
        : "#2196f3",
    boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
    zIndex: 9999,
    transition: "opacity 0.3s",
    opacity: 0,
  });

  document.body.appendChild(notif);

  // Animar entrada
  setTimeout(() => {
    notif.style.opacity = 1;
  }, 10);

  // Remover após timeout
  setTimeout(() => {
    notif.style.opacity = 0;
    setTimeout(() => {
      if (notif.parentNode) {
        notif.parentNode.removeChild(notif);
      }
    }, 300);
  }, 3000);
}

/**
 * Verifica se os recursos avançados de satélite estão disponíveis
 * @returns {Object} Objeto com flags de recursos
 */
export function getSatelliteEnhancerCapabilities() {
  // Se já temos uma definição de recursos, retorná-la
  if (window.satelliteEnhancerCapabilities) {
    return window.satelliteEnhancerCapabilities;
  }

  // Caso contrário, criar e armazenar
  const capabilities = {
    superResolution: Boolean(window.tf && model && !model.isFallbackModel),
    enhancedFilters: true,
    nasaLayers: true,
  };

  window.satelliteEnhancerCapabilities = capabilities;
  return capabilities;
}

/**
 * Define a fonte de imagens de satélite
 * @param {string} sourceType - Tipo de fonte de imagens
 * @returns {Promise<boolean>} Sucesso da operação
 */
export async function setSatelliteSource(sourceType) {
  return new Promise((resolve, reject) => {
    try {
      if (!mapbox3dInstance) {
        console.error("[satellite-enhancer] Mapa não inicializado");
        return resolve(false);
      }

      // Verificar se o mapa já está carregado antes de tentar alterar o estilo
      if (!mapbox3dInstance.isStyleLoaded()) {
        console.log(
          "[satellite-enhancer] Estilo do mapa ainda não carregado, aguardando..."
        );

        // Aguardar carregamento do estilo antes de prosseguir
        mapbox3dInstance.once("style.load", () => {
          // Tentar novamente após o carregamento
          setSatelliteSource(sourceType).then(resolve).catch(reject);
        });

        return;
      }

      // Salvar estado de melhorias para reaplicar após alteração
      const previouslyEnhanced = isEnhanced;
      isEnhanced = false;

      // Verificar qual fonte foi solicitada
      switch (sourceType) {
        case "streets":
          currentSource = SOURCES.MAPBOX_STREETS;
          mapbox3dInstance.setStyle(SOURCES.MAPBOX_STREETS);
          break;

        case "hd":
          currentSource = SOURCES.MAPBOX_HD;
          mapbox3dInstance.setStyle(SOURCES.MAPBOX_HD);
          break;

        case "google":
          // Configura fonte Google (requer configuração adicional)
          setupGoogleSatelliteSource().then((success) => {
            if (success) {
              currentSource = SOURCES.GOOGLE_SATELLITE;
              console.log("[satellite-enhancer] Fonte Google configurada");
            }
          });
          break;

        case "esri":
          // Configura fonte ESRI (requer configuração adicional)
          setupESRIWorldImagerySource().then((success) => {
            if (success) {
              currentSource = SOURCES.ESRI_WORLD;
              console.log("[satellite-enhancer] Fonte ESRI configurada");
            }
          });
          break;

        default:
          console.warn(
            `[satellite-enhancer] Fonte desconhecida: ${sourceType}`
          );
          return resolve(false);
      }

      // Esperar carregamento do estilo para reaplicar melhorias
      mapbox3dInstance.once("style.load", () => {
        if (previouslyEnhanced) {
          applyEnhancements();
        }
        resolve(true);
      });

      // Resolver após um tempo máximo em caso de falha no evento
      setTimeout(() => resolve(true), 5000);
    } catch (error) {
      console.error("[satellite-enhancer] Erro ao definir fonte:", error);
      reject(error);
    }
  });
}

/**
 * Configura fonte de satélite Google
 * @returns {Promise<boolean>} Sucesso da configuração
 */
async function setupGoogleSatelliteSource() {
  try {
    // Verificar se já existe
    if (mapbox3dInstance.getSource(SOURCES.GOOGLE_SATELLITE)) {
      return true;
    }

    // Adicionar fonte personalizada
    mapbox3dInstance.addSource(SOURCES.GOOGLE_SATELLITE, {
      type: "raster",
      tiles: [
        "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        "https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        "https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      ],
      tileSize: 256,
      attribution: "© Google",
      maxzoom: 20,
    });

    // Adicionar camada
    mapbox3dInstance.addLayer(
      {
        id: "google-satellite-layer",
        type: "raster",
        source: SOURCES.GOOGLE_SATELLITE,
        minzoom: 0,
        maxzoom: 22,
      },
      mapbox3dInstance.getLayer("building-extrusion")
        ? "building-extrusion"
        : undefined
    );

    return true;
  } catch (error) {
    console.error(
      "[satellite-enhancer] Erro ao configurar fonte Google:",
      error
    );
    return false;
  }
}

/**
 * Configura fonte de satélite ESRI World Imagery
 * @returns {Promise<boolean>} Sucesso da configuração
 */
async function setupESRIWorldImagerySource() {
  try {
    // Verificar se já existe
    if (mapbox3dInstance.getSource(SOURCES.ESRI_WORLD)) {
      return true;
    }

    // Adicionar fonte personalizada ESRI
    mapbox3dInstance.addSource(SOURCES.ESRI_WORLD, {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "© ESRI",
      maxzoom: 19,
    });

    // Adicionar camada
    mapbox3dInstance.addLayer(
      {
        id: "esri-world-imagery-layer",
        type: "raster",
        source: SOURCES.ESRI_WORLD,
        minzoom: 0,
        maxzoom: 22,
      },
      mapbox3dInstance.getLayer("building-extrusion")
        ? "building-extrusion"
        : undefined
    );

    return true;
  } catch (error) {
    console.error("[satellite-enhancer] Erro ao configurar fonte ESRI:", error);
    return false;
  }
}

/**
 * Aplica melhorias visuais às imagens de satélite
 * @returns {boolean} Sucesso da operação
 */
export function applyEnhancements() {
  try {
    if (!mapbox3dInstance) return false;

    // Remover camada de melhoria anterior se existir
    removeEnhancements();

    // Adicionar shader de pós-processamento para melhorar as imagens de satélite
    mapbox3dInstance.addLayer(
      {
        id: "satellite-enhancement-layer",
        type: "raster",
        source:
          currentSource === SOURCES.GOOGLE_SATELLITE
            ? SOURCES.GOOGLE_SATELLITE
            : currentSource === SOURCES.ESRI_WORLD
            ? SOURCES.ESRI_WORLD
            : {
                type: "raster",
                tiles: [
                  // Uma camada transparente que será usada apenas para aplicar o filtro
                  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
                ],
                tileSize: 256,
              },
        paint: {
          // Ajustar com base nas configurações do usuário
          "raster-opacity": 1,
          "raster-brightness-min": userDefinedSettings.brightness,
          "raster-brightness-max": userDefinedSettings.brightness + 1,
          "raster-contrast": userDefinedSettings.contrast,
          "raster-saturation": userDefinedSettings.saturation,
          "raster-hue-rotate": 0,
        },
      },
      "building-extrusion"
    ); // Coloca abaixo dos edifícios 3D

    enhancementLayer = "satellite-enhancement-layer";
    isEnhanced = true;

    // Adicionar filtro CSS para ganho de contraste global
    applyGlobalFilter();

    console.log("[satellite-enhancer] Melhorias aplicadas ao satélite");
    return true;
  } catch (error) {
    console.error("[satellite-enhancer] Erro ao aplicar melhorias:", error);
    return false;
  }
}

/**
 * Remove melhorias aplicadas ao satélite
 * @returns {boolean} Sucesso da operação
 */
export function removeEnhancements() {
  try {
    if (!mapbox3dInstance) return false;

    // Remover camada de melhoria se existir
    if (enhancementLayer && mapbox3dInstance.getLayer(enhancementLayer)) {
      mapbox3dInstance.removeLayer(enhancementLayer);
    }

    // Remover filtro CSS global
    removeGlobalFilter();

    isEnhanced = false;
    return true;
  } catch (error) {
    console.error("[satellite-enhancer] Erro ao remover melhorias:", error);
    return false;
  }
}

/**
 * Aplica filtro CSS global para melhorias adicionais
 */
function applyGlobalFilter() {
  // Remover filtro anterior se existir
  removeGlobalFilter();

  // Criar estilo para o filtro
  const styleElement = document.createElement("style");
  styleElement.id = "satellite-global-filter";
  styleElement.textContent = `
    .mapboxgl-canvas-container canvas {
      filter: contrast(${1 + userDefinedSettings.contrast * 0.1}) 
              brightness(${1 + userDefinedSettings.brightness * 0.05})
              saturate(${1 + userDefinedSettings.saturation * 0.1})
              ${
                userDefinedSettings.gamma !== 1
                  ? `gamma(${userDefinedSettings.gamma})`
                  : ""
              };
    }
  `;
  document.head.appendChild(styleElement);
}

/**
 * Remove filtro CSS global
 */
function removeGlobalFilter() {
  const existingFilter = document.getElementById("satellite-global-filter");
  if (existingFilter && existingFilter.parentNode) {
    existingFilter.parentNode.removeChild(existingFilter);
  }
}

/**
 * Configura parâmetros de melhoria de imagem
 * @param {Object} settings - Configurações de melhoria
 * @returns {boolean} Sucesso da operação
 */
export function configureEnhancements(settings) {
  try {
    userDefinedSettings = {
      ...userDefinedSettings,
      ...settings,
    };

    // Reaplica melhorias com novos parâmetros se ativo
    if (isEnhanced) {
      applyEnhancements();
    }

    console.log(
      "[satellite-enhancer] Configurações atualizadas:",
      userDefinedSettings
    );
    return true;
  } catch (error) {
    console.error("[satellite-enhancer] Erro ao configurar melhorias:", error);
    return false;
  }
}

/**
 * Inicializa o mapa NASA GIBS com camadas de dados de satélite NASA
 * @returns {Promise<boolean>} Sucesso da inicialização
 */
export async function initNasaGibsMap() {
  try {
    if (!mapbox3dInstance) return false;

    const loader = addLoadingIndicator("Carregando mapa NASA GIBS...");

    // Definir estilo base limpo para o mapa
    mapbox3dInstance.setStyle({
      version: 8,
      sources: {
        "nasa-blue-marble": {
          type: "raster",
          tiles: [
            "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
          ],
          tileSize: 256,
          attribution: "© NASA GIBS",
        },
        "nasa-modis-terra": {
          type: "raster",
          tiles: [
            "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
          ],
          tileSize: 256,
          attribution: "© NASA GIBS",
        },
        "nasa-viirs": {
          type: "raster",
          tiles: [
            "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
          ],
          tileSize: 256,
          attribution: "© NASA GIBS",
        },
      },
      layers: [
        {
          id: "nasa-blue-marble-layer",
          type: "raster",
          source: "nasa-blue-marble",
          minzoom: 0,
          maxzoom: 8,
        },
        {
          id: "nasa-modis-terra-layer",
          type: "raster",
          source: "nasa-modis-terra",
          minzoom: 8,
          maxzoom: 9,
        },
        {
          id: "nasa-viirs-layer",
          type: "raster",
          source: "nasa-viirs",
          minzoom: 9,
          maxzoom: 12,
        },
      ],
    });

    // Aguardar carregamento do estilo
    await new Promise((resolve) => {
      mapbox3dInstance.once("style.load", () => {
        // Aplicar melhorias visuais para as imagens NASA
        configureEnhancements({
          brightness: 0.1,
          contrast: 0.15,
          saturation: 0.1,
          gamma: 1.1,
        });
        applyEnhancements();

        // Adicionar camadas de dados adicionais
        try {
          // Camada de Temperatura da Superfície
          mapbox3dInstance.addSource("nasa-temperature", {
            type: "raster",
            tiles: [
              "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png",
            ],
            tileSize: 256,
            attribution: "© NASA GIBS",
          });

          mapbox3dInstance.addLayer({
            id: "nasa-temperature-layer",
            type: "raster",
            source: "nasa-temperature",
            minzoom: 0,
            maxzoom: 12,
            layout: {
              visibility: "none",
            },
            paint: {
              "raster-opacity": 0.7,
            },
          });

          // Outras camadas podem ser adicionadas aqui
        } catch (err) {
          console.warn(
            "[satellite-enhancer] Erro ao adicionar camadas NASA adicionais:",
            err
          );
        }

        resolve();
      });
    });

    // Adicionar controles para o mapa NASA
    addNasaGibsControls();

    removeLoadingIndicator(loader);
    console.log("[satellite-enhancer] Mapa NASA GIBS inicializado com sucesso");
    return true;
  } catch (error) {
    console.error(
      "[satellite-enhancer] Erro ao inicializar mapa NASA GIBS:",
      error
    );
    removeLoadingIndicator(loader);
    return false;
  }
}

/**
 * Adiciona controles específicos para o mapa NASA GIBS
 */
function addNasaGibsControls() {
  // Verificar se já existem controles
  if (document.getElementById("nasa-gibs-controls")) return;

  // Criar controles
  const controlsContainer = document.createElement("div");
  controlsContainer.id = "nasa-gibs-controls";
  controlsContainer.className =
    "mapboxgl-ctrl mapboxgl-ctrl-group nasa-controls";
  controlsContainer.innerHTML = `
    <button class="nasa-layer-toggle" data-layer="nasa-temperature-layer" title="Camada de temperatura">
      <span>Temp</span>
    </button>
    <button class="nasa-layer-toggle" data-layer="nasa-cloud-layer" title="Camada de nuvens">
      <span>Nuvens</span>
    </button>
    <button class="nasa-return-button" title="Voltar ao mapa normal">
      <span>Voltar</span>
    </button>
  `;

  // Adicionar estilos
  const style = document.createElement("style");
  style.textContent = `
    .nasa-controls {
      position: absolute;
      top: 120px;
      right: 10px;
      border-radius: 4px;
      overflow: hidden;
    }
    
    .nasa-controls button {
      display: block;
      width: 100%;
      padding: 8px 12px;
      background: white;
      border: none;
      border-bottom: 1px solid #ddd;
      cursor: pointer;
      font-family: Arial, sans-serif;
      font-size: 12px;
    }
    
    .nasa-controls button:last-child {
      border-bottom: none;
    }
    
    .nasa-controls button:hover {
      background: #f0f0f0;
    }
    
    .nasa-controls button.active {
      background: #4CAF50;
      color: white;
    }
    
    .nasa-return-button {
      background: #ff5252 !important;
      color: white !important;
    }
    
    .nasa-return-button:hover {
      background: #ff1744 !important;
    }
  `;
  document.head.appendChild(style);

  // Adicionar eventos
  controlsContainer.querySelectorAll(".nasa-layer-toggle").forEach((button) => {
    button.addEventListener("click", function () {
      const layerId = this.dataset.layer;
      const visibility = mapbox3dInstance.getLayoutProperty(
        layerId,
        "visibility"
      );

      // Alternar visibilidade
      mapbox3dInstance.setLayoutProperty(
        layerId,
        "visibility",
        visibility === "visible" ? "none" : "visible"
      );

      // Atualizar estado do botão
      this.classList.toggle("active", visibility !== "visible");
    });
  });

  // Botão para voltar ao mapa normal
  controlsContainer
    .querySelector(".nasa-return-button")
    .addEventListener("click", function () {
      // Voltar para o mapa padrão de ruas (não satélite)
      setSatelliteSource("streets");

      // Remover controles NASA
      if (controlsContainer.parentNode) {
        controlsContainer.parentNode.removeChild(controlsContainer);
      }
    });

  // Adicionar ao mapa
  document.body.appendChild(controlsContainer);
}

/**
 * Melhora resolução do satélite para a área visível
 * @param {Object} options - Opções para melhoria de resolução
 * @returns {Promise<boolean>} Sucesso da operação
 */
export async function enhanceResolution(options = {}) {
  // Verificar capacidades
  const capabilities = getSatelliteEnhancerCapabilities();

  // Se precisamos de super-resolução, verificar disponibilidade do modelo
  if (capabilities.superResolution) {
    // Verificar se o modelo ESRGAN está disponível localmente
    const isModelAvailable = await ModelDownloader.isModelAvailable("esrgan");

    if (!isModelAvailable) {
      // Mostrar UI para baixar o modelo
      const userAccepted = await ModelDownloadUI.showDownloadPrompt("esrgan");

      if (!userAccepted) {
        console.log(
          "[satellite-enhancer] Usuário cancelou o download do modelo"
        );
        // Usar alternativa simples já que o usuário cancelou o download
        return enhanceResolutionSimple(options);
      }

      // Se chegou aqui, o usuário baixou o modelo com sucesso
      console.log(
        "[satellite-enhancer] Modelo baixado com sucesso, usando super-resolução"
      );
    }

    // Usar super-resolução avançada
    return enhanceResolutionWithTF(options);
  } else {
    // Usar alternativa simples
    return enhanceResolutionSimple(options);
  }
}

/**
 * Versão simplificada de melhoria de resolução sem TensorFlow
 * @param {Object} options - Opções para melhoria
 * @returns {Promise<boolean>} Sucesso da operação
 */
async function enhanceResolutionSimple(options = {}) {
  const {
    zoomLevel = mapbox3dInstance ? mapbox3dInstance.getZoom() + 1 : 17,
    width = 1024,
    height = 1024,
    useCache = true,
    quality = 0.9,
  } = options;

  try {
    if (!mapbox3dInstance) return false;

    const loaderMessage =
      options.loaderMessage || "Melhorando imagem de satélite...";
    const loader = addLoadingIndicator(loaderMessage);

    // Obter bounds atuais
    const bounds = mapbox3dInstance.getBounds();
    const center = mapbox3dInstance.getCenter();

    // Criar ID único para esta área
    const areaId = `simple_${center.lat.toFixed(5)}_${center.lng.toFixed(
      5
    )}_${zoomLevel}_${width}x${height}`;

    // Verificar cache
    if (useCache) {
      const cachedImage = localStorage.getItem(`satellite_cache_${areaId}`);
      if (cachedImage) {
        console.log("[satellite-enhancer] Usando imagem em cache");
        const success = await applyCachedOverlay(cachedImage);
        removeLoadingIndicator(loader);
        return success;
      }
    }

    // Criar container para renderizar imagem em alta resolução
    const container = document.createElement("div");
    container.style.width = width + "px";
    container.style.height = height + "px";
    container.style.position = "absolute";
    container.style.top = "-9999px";
    container.style.left = "-9999px";
    document.body.appendChild(container);

    // Criar mapa temporário com zoom aumentado
    const tempMap = new mapboxgl.Map({
      container,
      style: mapbox3dInstance.getStyle(),
      center: [center.lng, center.lat],
      zoom: zoomLevel,
      preserveDrawingBuffer: true,
      attributionControl: false,
      fadeDuration: 0,
    });

    // Esperar carregamento do mapa temporário
    return new Promise((resolve) => {
      tempMap.once("load", () => {
        // Ajustar para os limites exatos da área atual
        tempMap.fitBounds(
          [
            [bounds.getWest(), bounds.getSouth()],
            [bounds.getEast(), bounds.getNorth()],
          ],
          { animate: false, padding: 0, duration: 0 }
        );

        // Esperar renderização completa
        setTimeout(async () => {
          try {
            // Capturar imagem
            const canvas = tempMap.getCanvas();

            // Aplicar filtros de melhoria básica usando canvas
            const enhancedCanvas = applyBasicEnhancements(canvas);

            // Converter para data URL
            const imageUrl = enhancedCanvas.toDataURL("image/jpeg", quality);

            // Limpar recursos
            tempMap.remove();
            document.body.removeChild(container);

            // Armazenar em cache
            if (useCache && imageUrl) {
              try {
                localStorage.setItem(`satellite_cache_${areaId}`, imageUrl);
                console.log("[satellite-enhancer] Imagem salva no cache");
              } catch (e) {
                console.warn(
                  "[satellite-enhancer] Não foi possível armazenar em cache:",
                  e
                );
              }
            }

            // Aplicar overlay
            const success = await applyCachedOverlay(imageUrl);
            removeLoadingIndicator(loader);
            resolve(success);
          } catch (error) {
            console.error(
              "[satellite-enhancer] Erro ao capturar imagem:",
              error
            );
            tempMap.remove();
            document.body.removeChild(container);
            removeLoadingIndicator(loader);
            resolve(false);
          }
        }, 1500);
      });
    });
  } catch (error) {
    console.error("[satellite-enhancer] Erro na melhoria simples:", error);
    removeLoadingIndicator(loader);
    return false;
  }
}

/**
 * Aplica melhorias básicas a uma imagem usando Canvas API
 * @param {HTMLCanvasElement} sourceCanvas - Canvas original
 * @returns {HTMLCanvasElement} Canvas com melhorias
 */
function applyBasicEnhancements(sourceCanvas) {
  // Criar canvas para o resultado
  const resultCanvas = document.createElement("canvas");
  resultCanvas.width = sourceCanvas.width;
  resultCanvas.height = sourceCanvas.height;

  const ctx = resultCanvas.getContext("2d");

  // Aplicar filtros básicos (equivalente a CSS filters)
  ctx.filter = `contrast(110%) saturate(105%) brightness(102%)`;

  // Desenhar a imagem original com os filtros aplicados
  ctx.drawImage(sourceCanvas, 0, 0);

  // Aplicar ajuste de nitidez (unsharp masking)
  // Esta é uma implementação simplificada - para uma versão completa seria necessário
  // implementar um shader ou usar uma biblioteca de processamento de imagem

  return resultCanvas;
}

/**
 * Processa uma imagem usando o modelo de super-resolução ESRGAN
 * @param {HTMLCanvasElement} canvas - Canvas contendo a imagem a ser processada
 * @param {number} quality - Qualidade da compressão JPEG
 * @returns {Promise<string>} URL de dados da imagem processada
 */
async function processSuperResolution(canvas, quality = 0.92) {
  if (!window.tf || !model) {
    throw new Error("Modelo de super-resolução não disponível");
  }

  // Adicionar à fila de processamento
  return new Promise((resolve, reject) => {
    const task = {
      canvas,
      quality,
      resolve,
      reject,
    };

    processingQueue.push(task);
    processNextInQueue();
  });
}

/**
 * Processa o próximo item na fila de processamento
 */
async function processNextInQueue() {
  if (isProcessing || processingQueue.length === 0) return;

  isProcessing = true;
  const task = processingQueue.shift();

  try {
    // Extrair dados da imagem
    const { canvas, quality, resolve, reject } = task;

    // Usando TensorFlow.js para processamento
    const imageData = tf.browser.fromPixels(canvas);

    // Normalizar valores de pixel para [0,1]
    const normalized = imageData.toFloat().div(tf.scalar(255));

    // Redimensionar para um tamanho que o modelo possa processar eficientemente
    // Se a imagem for muito grande, processamos em partes
    const MAX_SIZE = 512; // Tamanho máximo para processamento de uma vez
    let result;

    if (normalized.shape[0] > MAX_SIZE || normalized.shape[1] > MAX_SIZE) {
      // Processar em blocos para economizar memória
      result = await processLargeImage(normalized, MAX_SIZE);
    } else {
      // Processar a imagem inteira de uma vez
      // Adicionar dimensão de batch e processar
      const batched = normalized.expandDims(0);
      result = model.predict(batched);

      // Remover dimensão de batch do resultado
      result = result.squeeze();
    }

    // Converter de volta para valores de pixel [0,255]
    const processed = result.mul(tf.scalar(255)).cast("int32");

    // Converter para canvas e depois para URL de dados
    const outputCanvas = document.createElement("canvas");
    const tensorData = await tf.browser.toPixels(processed, outputCanvas);
    const dataURL = outputCanvas.toDataURL("image/jpeg", quality);

    // Liberar memória
    imageData.dispose();
    normalized.dispose();
    processed.dispose();
    result.dispose();

    // Resolver com a URL dos dados
    resolve(dataURL);
  } catch (error) {
    console.error(
      "[satellite-enhancer] Erro no processamento da super-resolução:",
      error
    );
    // Em caso de erro, simplesmente retornar a imagem original
    try {
      const originalDataURL = task.canvas.toDataURL("image/jpeg", task.quality);
      task.resolve(originalDataURL);
    } catch (e) {
      task.reject(e);
    }
  } finally {
    isProcessing = false;
    // Processar o próximo item na fila, se houver
    processNextInQueue();
  }
}

/**
 * Processa uma imagem grande dividindo-a em partes menores
 * @param {tf.Tensor3D} imageTensor - Tensor da imagem normalizada [0,1]
 * @param {number} maxSize - Tamanho máximo de cada parte
 * @returns {Promise<tf.Tensor3D>} Tensor da imagem processada
 */
async function processLargeImage(imageTensor, maxSize) {
  // Obter dimensões da imagem
  const [height, width] = imageTensor.shape;

  // Criar tensor para o resultado final
  const resultHeight = height * 2; // Fator de escala do ESRGAN
  const resultWidth = width * 2;
  const result = tf.zeros([resultHeight, resultWidth, 3]);

  // Calcular número de blocos em cada dimensão
  const numBlocksH = Math.ceil(height / maxSize);
  const numBlocksW = Math.ceil(width / maxSize);

  // Processar cada bloco
  const blockPromises = [];

  // Usar um pequeno overlap para evitar artefatos nas bordas
  const overlap = 16;

  for (let h = 0; h < numBlocksH; h++) {
    for (let w = 0; w < numBlocksW; w++) {
      // Calcular coordenadas do bloco atual com sobreposição
      const startH = Math.max(0, h * maxSize - (h > 0 ? overlap : 0));
      const startW = Math.max(0, w * maxSize - (w > 0 ? overlap : 0));
      const endH = Math.min(
        height,
        (h + 1) * maxSize + (h < numBlocksH - 1 ? overlap : 0)
      );
      const endW = Math.min(
        width,
        (w + 1) * maxSize + (w < numBlocksW - 1 ? overlap : 0)
      );

      // Extrair bloco
      const block = imageTensor.slice(
        [startH, startW, 0],
        [endH - startH, endW - startW, 3]
      );

      // Adicionar à lista de promessas
      blockPromises.push({
        coords: { startH, startW, endH, endW },
        block,
      });
    }
  }

  // Processar blocos em pequenos grupos para evitar esgotar a memória
  const BATCH_SIZE = 4;
  let processedCount = 0;

  for (let i = 0; i < blockPromises.length; i += BATCH_SIZE) {
    const batch = blockPromises.slice(i, i + BATCH_SIZE);

    // Processar lote atual em paralelo
    await Promise.all(
      batch.map(async ({ coords, block }) => {
        try {
          // Processar bloco
          const batched = block.expandDims(0);
          const processedBlock = model.predict(batched);
          const processedTensor = processedBlock.squeeze();

          // Calcular posição no resultado final (escala x2)
          const resultStartH = coords.startH * 2;
          const resultStartW = coords.startW * 2;
          const resultH = (coords.endH - coords.startH) * 2;
          const resultW = (coords.endW - coords.startW) * 2;

          // Se não for o bloco na borda, remover a sobreposição
          const trimStartH = coords.startH > 0 ? overlap * 2 : 0;
          const trimStartW = coords.startW > 0 ? overlap * 2 : 0;

          // Se não for o último bloco, remover a sobreposição
          const trimEndH = coords.endH < height ? overlap * 2 : 0;
          const trimEndW = coords.endW < width ? overlap * 2 : 0;

          // Recortar a parte com sobreposição
          const trimmedBlock = processedTensor.slice(
            [trimStartH, trimStartW, 0],
            [
              resultH - trimStartH - trimEndH,
              resultW - trimStartW - trimEndW,
              3,
            ]
          );

          // Inserir no tensor resultado
          const finalStartH = resultStartH + trimStartH;
          const finalStartW = resultStartW + trimStartW;

          // Atualizar o tensor resultado
          const prevResult = result.clone();
          result.dispose();
          const newResult = tf.tensor.scatter(
            prevResult,
            [[finalStartH, finalStartW, 0]],
            trimmedBlock,
            [resultHeight, resultWidth, 3]
          );
          prevResult.dispose();

          // Atualizar resultado
          Object.assign(result, newResult);

          // Liberar memória
          block.dispose();
          batched.dispose();
          processedBlock.dispose();
          processedTensor.dispose();
          trimmedBlock.dispose();

          processedCount++;
          console.log(
            `[satellite-enhancer] Processado bloco ${processedCount}/${blockPromises.length}`
          );
        } catch (error) {
          console.error("[satellite-enhancer] Erro ao processar bloco:", error);
          // Liberar memória em caso de erro
          block.dispose();
        }
      })
    );
  }

  return result;
}

/**
 * Aplica imagem em cache como overlay
 * @param {string} imageUrl - URL da imagem (data URL)
 * @returns {Promise<boolean>} Sucesso da operação
 */
async function applyCachedOverlay(imageUrl) {
  try {
    if (!mapbox3dInstance || !imageUrl) return false;

    // Remover overlay anterior se existir
    removeHighResolutionOverlay();

    // Obter bounds atuais
    const bounds = mapbox3dInstance.getBounds();

    // Criar overlay com a imagem
    mapbox3dInstance.addSource("high-res-satellite", {
      type: "image",
      url: imageUrl,
      coordinates: [
        [bounds.getWest(), bounds.getNorth()], // top-left (NW)
        [bounds.getEast(), bounds.getNorth()], // top-right (NE)
        [bounds.getEast(), bounds.getSouth()], // bottom-right (SE)
        [bounds.getWest(), bounds.getSouth()], // bottom-left (SW)
      ],
    });

    // Adicionar camada
    mapbox3dInstance.addLayer(
      {
        id: "high-res-overlay",
        type: "raster",
        source: "high-res-satellite",
        paint: {
          "raster-opacity": 0.85,
          "raster-fade-duration": 0,
        },
      },
      "building-extrusion"
    ); // Abaixo dos edifícios 3D

    satelliteOverlaySource = "high-res-satellite";
    console.log("[satellite-enhancer] Overlay de alta resolução aplicado");

    return true;
  } catch (error) {
    console.error("[satellite-enhancer] Erro ao aplicar overlay:", error);
    return false;
  }
}

/**
 * Remove overlay de alta resolução
 * @returns {boolean} Sucesso da operação
 */
export function removeHighResolutionOverlay() {
  try {
    if (!mapbox3dInstance) return false;

    // Remover camadas e fontes
    if (mapbox3dInstance.getLayer("high-res-overlay")) {
      mapbox3dInstance.removeLayer("high-res-overlay");
    }

    if (mapbox3dInstance.getSource("high-res-satellite")) {
      mapbox3dInstance.removeSource("high-res-satellite");
    }

    satelliteOverlaySource = null;
    console.log("[satellite-enhancer] Overlay de alta resolução removido");

    return true;
  } catch (error) {
    console.error("[satellite-enhancer] Erro ao remover overlay:", error);
    return false;
  }
}

/**
 * Limpa o cache de imagens de satélite
 * @returns {boolean} Sucesso da operação
 */
export function clearSatelliteCache() {
  try {
    // Buscar todas as keys do localStorage relacionadas ao cache de satélite
    const cacheKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("satellite_cache_")) {
        cacheKeys.push(key);
      }
    }

    // Remover cada item
    cacheKeys.forEach((key) => localStorage.removeItem(key));

    console.log(
      `[satellite-enhancer] Cache de satélite limpo (${cacheKeys.length} itens)`
    );
    return true;
  } catch (error) {
    console.error("[satellite-enhancer] Erro ao limpar cache:", error);
    return false;
  }
}

/**
 * Gera uma imagem de alta resolução da área atual
 * Útil para capturar screenshots da área visualizada
 * @param {Object} options - Opções para captura da imagem
 * @returns {Promise<string>} Imagem em formato data-URL
 */
export async function captureHighResolutionImage(options = {}) {
  const {
    width = 1920,
    height = 1080,
    format = "jpeg",
    quality = 0.9,
    includeControls = false,
    applySuperResolution = false,
  } = options;

  try {
    if (!mapbox3dInstance) throw new Error("Mapa não inicializado");

    const loader = addLoadingIndicator(
      "Capturando imagem de alta resolução..."
    );

    // Determinar a estratégia de captura
    if (includeControls) {
      // Capturar o mapa atual com controles
      const canvas = mapbox3dInstance.getCanvas();

      // Aplicar processamento de super-resolução se solicitado
      if (applySuperResolution && window.tf && model) {
        try {
          const processedImage = await processSuperResolution(canvas, quality);
          removeLoadingIndicator(loader);
          return processedImage;
        } catch (error) {
          console.warn(
            "[satellite-enhancer] Erro na super-resolução, usando imagem original:",
            error
          );
          const originalImage = canvas.toDataURL(`image/${format}`, quality);
          removeLoadingIndicator(loader);
          return originalImage;
        }
      } else {
        const image = canvas.toDataURL(`image/${format}`, quality);
        removeLoadingIndicator(loader);
        return image;
      }
    } else {
      // Criar um mapa temporário sem controles para captura limpa
      const container = document.createElement("div");
      container.style.width = `${width}px`;
      container.style.height = `${height}px`;
      container.style.position = "absolute";
      container.style.top = "-9999px";
      container.style.left = "-9999px";
      document.body.appendChild(container);

      // Configurar o mapa temporário com as mesmas configurações do mapa atual
      const tempMap = new mapboxgl.Map({
        container,
        style: mapbox3dInstance.getStyle(),
        center: mapbox3dInstance.getCenter(),
        zoom: mapbox3dInstance.getZoom(),
        bearing: mapbox3dInstance.getBearing(),
        pitch: mapbox3dInstance.getPitch(),
        preserveDrawingBuffer: true,
        attributionControl: false,
        fadeDuration: 0,
      });

      return new Promise((resolve, reject) => {
        tempMap.once("load", () => {
          // Dar tempo para renderizar completamente
          setTimeout(async () => {
            try {
              const canvas = tempMap.getCanvas();

              // Aplicar super-resolução se solicitado
              let imageUrl;
              if (applySuperResolution && window.tf && model) {
                try {
                  imageUrl = await processSuperResolution(canvas, quality);
                } catch (error) {
                  console.warn(
                    "[satellite-enhancer] Erro na super-resolução, usando imagem original:",
                    error
                  );
                  imageUrl = canvas.toDataURL(`image/${format}`, quality);
                }
              } else {
                imageUrl = canvas.toDataURL(`image/${format}`, quality);
              }

              // Limpar recursos
              tempMap.remove();
              document.body.removeChild(container);

              removeLoadingIndicator(loader);
              resolve(imageUrl);
            } catch (error) {
              console.error(
                "[satellite-enhancer] Erro ao capturar imagem:",
                error
              );

              // Limpar recursos
              tempMap.remove();
              document.body.removeChild(container);

              removeLoadingIndicator(loader);
              reject(error);
            }
          }, 1000);
        });
      });
    }
  } catch (error) {
    console.error(
      "[satellite-enhancer] Erro ao capturar imagem de alta resolução:",
      error
    );
    removeLoadingIndicator(loader);
    throw error;
  }
}

/**
 * Configurações do painel de camadas do mapa para incluir opções
 * específicas para o aprimorador de satélite
 */
export function getSatelliteEnhancementControls() {
  // Verificar capacidades para determinar quais controles mostrar
  const capabilities = getSatelliteEnhancerCapabilities();

  const controls = [];

  // Controle básico - sempre disponível
  controls.push({
    id: "satellite-enhancement-toggle",
    label: "Melhorias visuais",
    type: "toggle",
    defaultValue: false,
    onChange: (enabled) => {
      if (enabled) {
        applyEnhancements();
      } else {
        removeEnhancements();
      }
    },
  });

  // Controle de resolução - disponível apenas se tivermos super-resolução
  if (capabilities.superResolution) {
    controls.push({
      id: "satellite-super-resolution",
      label: "Super-resolução (IA)",
      type: "toggle",
      defaultValue: false,
      onChange: (enabled) => {
        if (enabled) {
          enhanceResolution({
            loaderMessage: "Aplicando super-resolução (usando IA)...",
          });
        } else {
          removeHighResolutionOverlay();
        }
      },
    });
  } else {
    // Versão simplificada para dispositivos sem TensorFlow
    controls.push({
      id: "satellite-enhance-resolution",
      label: "Melhorar resolução",
      type: "toggle",
      defaultValue: false,
      onChange: (enabled) => {
        if (enabled) {
          enhanceResolutionSimple({
            loaderMessage: "Melhorando imagem de satélite...",
          });
        } else {
          removeHighResolutionOverlay();
        }
      },
    });
  }

  // Controles de ajuste - sempre disponíveis
  controls.push({
    id: "satellite-brightness",
    label: "Brilho",
    type: "slider",
    min: -0.5,
    max: 0.5,
    step: 0.05,
    defaultValue: 0,
    onChange: (value) => {
      userDefinedSettings.brightness = parseFloat(value);
      if (isEnhanced) {
        applyEnhancements();
      }
    },
  });

  controls.push({
    id: "satellite-contrast",
    label: "Contraste",
    type: "slider",
    min: -0.5,
    max: 1,
    step: 0.05,
    defaultValue: 0,
    onChange: (value) => {
      userDefinedSettings.contrast = parseFloat(value);
      if (isEnhanced) {
        applyEnhancements();
      }
    },
  });

  controls.push({
    id: "satellite-saturation",
    label: "Saturação",
    type: "slider",
    min: -1,
    max: 1,
    step: 0.05,
    defaultValue: 0,
    onChange: (value) => {
      userDefinedSettings.saturation = parseFloat(value);
      if (isEnhanced) {
        applyEnhancements();
      }
    },
  });

  return controls;
}

// Add this function to handle retries for the proxy
async function fetchWithRetry(url, retries = 3, delay = 1000) {
  try {
    const response = await fetch(url);
    return response;
  } catch (error) {
    if (retries > 0) {
      console.log(`[satellite-enhancer] Retry ${4 - retries}/3 for ${url}...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, retries - 1, delay);
    }
    throw error;
  }
}

// Add this function to your satellite-imagery-enhancer.js
async function isProxyServerRunning() {
  try {
    const response = await fetch("http://localhost:3000/status", {
      method: "GET",
      headers: { Accept: "application/json" },
      timeout: 2000,
    });
    return response.ok;
  } catch (error) {
    console.warn(
      "[satellite-enhancer] Proxy server check failed:",
      error.message
    );
    return false;
  }
}

// Exportar como módulo único
export default {
  initSatelliteEnhancer,
  setSatelliteSource,
  applyEnhancements,
  removeEnhancements,
  configureEnhancements,
  enhanceResolution,
  removeHighResolutionOverlay,
  clearSatelliteCache,
  captureHighResolutionImage,
  initNasaGibsMap,
  getSatelliteEnhancerCapabilities,
  getSatelliteEnhancementControls,
  fetchWithRetry,
  isProxyServerRunning,
};
