/**
 * Utility for downloading and managing ML models
 * Used for satellite imagery enhancement and other ML-based features
 */

// Change from class export to a singleton instance export
class ModelDownloader {
  constructor() {
    this.storagePrefix = "ml-models-";
    this.modelConfigs = {
      esrgan: {
        // Use the proxy URL as primary CDN
        cdnUrl: "http://localhost:3000/tfhub-proxy/captain-pool/esrgan-tf2/1/",
        // Fallback to a direct TF Hub URL (though it might have CORS issues)
        fallbackCdnUrl:
          "https://storage.googleapis.com/tfjs-models/savedmodel/esrgan-tf2/",
        // Local path as final fallback
        localPath: "./assets/models/esrgan-tf2/",
        sizeKB: 2240,
        files: ["model.json", "group1-shard1of1.bin"],
      },
    };

    this._initDownloadStorage();
  }

  /**
   * Checks if browser supports localStorage
   * @returns {boolean} Storage support
   * @private
   */
  _checkStorageSupport() {
    try {
      const testKey = "__storage_test__";
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Initializes storage for downloads
   * @private
   */
  _initDownloadStorage() {
    this.storageSupported = this._checkStorageSupport();
    console.log(
      `[ModelDownloader] Storage support: ${
        this.storageSupported ? "yes" : "no"
      }`
    );
  }

  /**
   * Checks if a model is available locally
   * @param {string} modelName - Name of the model
   * @returns {Promise<boolean>} - Model availability
   */
  async isModelAvailable(modelName) {
    if (!this.storageSupported) {
      return false;
    }

    try {
      // Check if model info exists in localStorage
      const modelInfo = localStorage.getItem(
        `${this.storagePrefix}${modelName}-info`
      );
      if (!modelInfo) {
        return false;
      }

      // Verify model data exists too
      const modelData = localStorage.getItem(
        `${this.storagePrefix}${modelName}-data`
      );
      return !!modelData;
    } catch (error) {
      console.error(
        `[ModelDownloader] Error checking model availability:`,
        error
      );
      return false;
    }
  }

  /**
   * Checks storage requirements for a model
   * @param {string} modelName - Model name
   * @returns {Object} Storage requirements check result
   */
  checkStorageRequirements(modelName) {
    if (!this.storageSupported) {
      return { hasSpace: false, requiredKB: 0, availableKB: 0 };
    }

    const config = this.modelConfigs[modelName];
    if (!config) {
      return { hasSpace: false, requiredKB: 0, availableKB: 0 };
    }

    // Estimate available space (rough approximation)
    let totalUsed = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        totalUsed += localStorage.getItem(key)?.length || 0;
      }
    } catch (e) {
      console.warn("[ModelDownloader] Error estimating storage usage:", e);
    }

    // Typical localStorage limit is 5MB (5120KB)
    const availableKB = Math.max(0, 5120 - totalUsed / 1024);
    const requiredKB = config.sizeKB || 1024; // Default to 1MB if unknown

    return {
      hasSpace: availableKB >= requiredKB,
      requiredKB,
      availableKB,
    };
  }

  /**
   * Downloads a model and stores it in localStorage
   * @param {string} modelName - Name of the model to download
   * @param {Function} progressCallback - Called with progress updates
   * @returns {Promise<boolean>} - Success status
   */
  async downloadModel(modelName, progressCallback) {
    if (!this.storageSupported) {
      console.error("[ModelDownloader] Local storage not supported");
      return false;
    }

    const config = this.modelConfigs[modelName];
    if (!config) {
      console.error(
        `[ModelDownloader] Model ${modelName} configuration not found`
      );
      return false;
    }

    try {
      // Check storage requirements
      const storageCheck = this.checkStorageRequirements(modelName);
      if (!storageCheck.hasSpace) {
        console.warn(`[ModelDownloader] Insufficient storage:`, storageCheck);
        return false;
      }

      // Download and store each file
      let modelJson = null;

      for (const file of config.files) {
        const url = `${config.cdnUrl}${file}`;

        // Report progress
        if (progressCallback) {
          progressCallback({ file, progress: 0, total: config.files.length });
        }

        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(
              `Failed to fetch ${url}: ${response.status} ${response.statusText}`
            );
          }

          let data;
          if (file.endsWith(".json")) {
            data = await response.text();
            modelJson = JSON.parse(data);

            // Update paths in model.json to point to local storage
            if (modelJson && modelJson.weightsManifest) {
              modelJson.weightsManifest.forEach((manifest) => {
                manifest.paths = manifest.paths.map((path) =>
                  path.replace(/^.*\//, "")
                );
              });
            }

            // Store the modified JSON
            data = JSON.stringify(modelJson);
          } else {
            // For binary files, get as arraybuffer and convert to base64
            const buffer = await response.arrayBuffer();
            data = this._arrayBufferToBase64(buffer);
          }

          localStorage.setItem(
            `${this.storagePrefix}${modelName}-${file}`,
            data
          );

          // Report progress
          if (progressCallback) {
            progressCallback({
              file,
              progress: config.files.indexOf(file) + 1,
              total: config.files.length,
            });
          }
        } catch (error) {
          console.error(`[ModelDownloader] Error downloading ${file}:`, error);
          return false;
        }
      }

      // Store model info with timestamp
      const modelInfo = {
        name: modelName,
        version: "1.0",
        files: config.files,
        timestamp: Date.now(),
      };

      localStorage.setItem(
        `${this.storagePrefix}${modelName}-info`,
        JSON.stringify(modelInfo)
      );

      console.log(
        `[ModelDownloader] Model ${modelName} downloaded and stored successfully`
      );
      return true;
    } catch (error) {
      console.error(
        `[ModelDownloader] Error downloading model ${modelName}:`,
        error
      );
      return false;
    }
  }

  /**
   * Loads a model from localStorage
   * @param {string} modelName - Name of the model to load
   * @returns {Promise<Object>} - The loaded model
   */
  async loadModelFromStorage(modelName) {
    if (!this.storageSupported) {
      throw new Error("Local storage not supported");
    }

    try {
      // Check if model info exists
      const modelInfoStr = localStorage.getItem(
        `${this.storagePrefix}${modelName}-info`
      );
      if (!modelInfoStr) {
        throw new Error(`Model ${modelName} not found in storage`);
      }

      const modelInfo = JSON.parse(modelInfoStr);
      const modelPath = `indexeddb://${modelName}-model`;

      // Load model using appropriate method based on the framework
      if (window.tf) {
        const modelJson = localStorage.getItem(
          `${this.storagePrefix}${modelName}-model.json`
        );
        if (!modelJson) {
          throw new Error(`Model JSON for ${modelName} not found in storage`);
        }

        // Create a model loader that loads from localStorage instead of HTTP
        const localStorageHandler = {
          load: async (modelUrl) => {
            if (modelUrl.endsWith("model.json")) {
              return JSON.parse(
                localStorage.getItem(
                  `${this.storagePrefix}${modelName}-model.json`
                )
              );
            } else {
              // For weight files, convert base64 back to arrayBuffer
              const base64Data = localStorage.getItem(
                `${this.storagePrefix}${modelName}-${modelUrl}`
              );
              return this._base64ToArrayBuffer(base64Data);
            }
          },
        };

        // Load model with TensorFlow.js using custom IO handler
        return await tf.loadGraphModel(localStorageHandler);
      } else {
        throw new Error("TensorFlow.js not found");
      }
    } catch (error) {
      console.error(
        `[ModelDownloader] Error loading model ${modelName} from storage:`,
        error
      );
      throw error;
    }
  }

  /**
   * Deletes a model from localStorage
   * @param {string} modelName - Name of the model to delete
   * @returns {boolean} - Success status
   */
  deleteModel(modelName) {
    if (!this.storageSupported) {
      return false;
    }

    try {
      // Get model info
      const modelInfoStr = localStorage.getItem(
        `${this.storagePrefix}${modelName}-info`
      );
      if (!modelInfoStr) {
        return false; // Model not found
      }

      const modelInfo = JSON.parse(modelInfoStr);

      // Remove all model files
      if (modelInfo.files && Array.isArray(modelInfo.files)) {
        modelInfo.files.forEach((file) => {
          localStorage.removeItem(`${this.storagePrefix}${modelName}-${file}`);
        });
      }

      // Remove model info
      localStorage.removeItem(`${this.storagePrefix}${modelName}-info`);

      console.log(`[ModelDownloader] Model ${modelName} deleted from storage`);
      return true;
    } catch (error) {
      console.error(
        `[ModelDownloader] Error deleting model ${modelName}:`,
        error
      );
      return false;
    }
  }

  /**
   * Helper method to convert ArrayBuffer to Base64 string
   * @param {ArrayBuffer} buffer - The array buffer to convert
   * @returns {string} - Base64 string
   * @private
   */
  _arrayBufferToBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;

    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return window.btoa(binary);
  }

  /**
   * Helper method to convert Base64 string to ArrayBuffer
   * @param {string} base64 - The base64 string to convert
   * @returns {ArrayBuffer} - Array buffer
   * @private
   */
  _base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes.buffer;
  }
}

// Export singleton instance
const modelDownloader = new ModelDownloader();
export default modelDownloader;
