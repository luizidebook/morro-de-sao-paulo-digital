/**
 * Carregador para TensorFlow.js
 * Carrega a biblioteca TensorFlow.js de forma assíncrona
 */

let tensorflowLoaded = false;
let loadPromise = null;

/**
 * Carrega a biblioteca TensorFlow.js
 * @returns {Promise<boolean>} Promise que resolve com true se carregado com sucesso
 */
export function loadTensorFlow() {
  // Se já carregado, retorna Promise resolvida
  if (tensorflowLoaded && window.tf) {
    return Promise.resolve(true);
  }

  // Se já está carregando, retorna a Promise existente
  if (loadPromise) {
    return loadPromise;
  }

  // Criar nova Promise de carregamento
  loadPromise = new Promise((resolve, reject) => {
    try {
      // Verificar se já está carregado
      if (window.tf) {
        tensorflowLoaded = true;
        return resolve(true);
      }

      // Carregar script do TensorFlow.js
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.13.0/dist/tf.min.js";
      script.async = true;

      script.onload = () => {
        tensorflowLoaded = true;
        console.log("[tensor-loader] TensorFlow.js carregado com sucesso");
        resolve(true);
      };

      script.onerror = (err) => {
        console.error("[tensor-loader] Erro ao carregar TensorFlow.js:", err);
        reject(new Error("Falha ao carregar TensorFlow.js"));
      };

      document.head.appendChild(script);
    } catch (error) {
      console.error(
        "[tensor-loader] Erro ao iniciar carregamento de TensorFlow.js:",
        error
      );
      reject(error);
    }
  });

  return loadPromise;
}

/**
 * Verifica se o TensorFlow.js está carregado
 * @returns {boolean} true se carregado
 */
export function isTensorFlowLoaded() {
  return tensorflowLoaded && window.tf;
}
