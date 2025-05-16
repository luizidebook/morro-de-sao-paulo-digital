/**
 * Utility for downloading and managing ML models
 * Used by satellite-imagery-enhancer.js to provide local model storage capabilities
 */

class ModelDownloader {
  constructor() {
    this.baseUrl = "https://storage.googleapis.com/tfjs-models/savedmodel/";
    this.localStoragePrefix = "ml-model-";
    this.models = {
      esrgan: {
        url: "esrgan-tf2/",
        version: "1.0.0",
        files: ["model.json", "group1-shard1of1.bin"],
        size: "4.2 MB",
        description: "Super-resolution model for enhancing satellite imagery",
      },
      mobilenet: {
        url: "mobilenet_v2_1.0_224/",
        version: "2.0.0",
        files: [
          "model.json",
          "group1-shard1of3.bin",
          "group1-shard2of3.bin",
          "group1-shard3of3.bin",
        ],
        size: "8.8 MB",
        description: "Lightweight image classification model",
      },
    };

    // Check for required features support
    this.hasStorage = this._checkStorageSupport();
    this.hasFetch = typeof fetch === "function";

    // Internal state
    this.downloadQueue = [];
    this.isDownloading = false;
    this._initDownloadStorage();
  }

  /**
   * Checks if browser supports localStorage
   * @returns {boolean} Storage support
   * @private
   */
  _checkStorageSupport() {
    try {
      const testKey = "model-downloader-test";
      localStorage.setItem(testKey, "test");
      const result = localStorage.getItem(testKey) === "test";
      localStorage.removeItem(testKey);
      return result;
    } catch (e) {
      return false;
    }
  }

  /**
   * Initializes storage for downloads
   * @private
   */
  _initDownloadStorage() {
    if (!this.hasStorage) return;

    try {
      // Create or retrieve download registry
      const downloadsKey = `${this.localStoragePrefix}downloads`;
      if (!localStorage.getItem(downloadsKey)) {
        localStorage.setItem(downloadsKey, JSON.stringify({}));
      }
    } catch (e) {
      console.error("[ModelDownloader] Error initializing storage:", e);
    }
  }

  /**
   * Checks if a model is available locally
   * @param {string} modelName - Name of the model
   * @returns {Promise<boolean>} - Model availability
   */
  async isModelAvailable(modelName) {
    if (!this.hasStorage || !this.models[modelName]) return false;

    try {
      // Check metadata
      const metaKey = `${this.localStoragePrefix}${modelName}-meta`;
      const metaData = localStorage.getItem(metaKey);

      if (!metaData) return false;

      // Check if all files exist
      const meta = JSON.parse(metaData);
      const modelInfo = this.models[modelName];

      if (meta.version !== modelInfo.version) return false;

      // Check each file
      for (const file of modelInfo.files) {
        const key = `${this.localStoragePrefix}${modelName}-${file}`;
        if (!localStorage.getItem(key)) return false;
      }

      return true;
    } catch (e) {
      console.error("[ModelDownloader] Error checking availability:", e);
      return false;
    }
  }

  /**
   * Downloads a model and stores it locally
   * @param {string} modelName - Name of the model
   * @param {Function} progressCallback - Callback for download progress
   * @returns {Promise<boolean>} - Download success
   */
  async downloadModel(modelName, progressCallback = null) {
    if (!this.hasStorage || !this.hasFetch) {
      console.error("[ModelDownloader] Required features not available");
      return false;
    }

    const modelInfo = this.models[modelName];
    if (!modelInfo) {
      console.error(`[ModelDownloader] Model '${modelName}' not defined`);
      return false;
    }

    try {
      // Mark download as in progress
      this.isDownloading = true;

      // Download each file
      let completedFiles = 0;
      const totalFiles = modelInfo.files.length;

      for (const file of modelInfo.files) {
        // Build file URL
        const fileUrl = `${this.baseUrl}${modelInfo.url}${file}`;

        // Notify progress
        if (progressCallback) {
          progressCallback({
            file,
            progress: completedFiles,
            total: totalFiles,
            status: "downloading",
          });
        }

        try {
          // Download file
          const response = await fetch(fileUrl);

          if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
          }

          // For JSON files, store as text
          if (file.endsWith(".json")) {
            const text = await response.text();
            localStorage.setItem(
              `${this.localStoragePrefix}${modelName}-${file}`,
              text
            );
          }
          // For binary files, store as encoded blob
          else {
            const blob = await response.blob();
            const reader = new FileReader();

            await new Promise((resolve, reject) => {
              reader.onload = () => {
                try {
                  localStorage.setItem(
                    `${this.localStoragePrefix}${modelName}-${file}`,
                    reader.result
                  );
                  resolve();
                } catch (err) {
                  // Handle storage full error
                  if (err.name === "QuotaExceededError") {
                    reject(
                      new Error(
                        "Local storage is full. Try clearing cache to free up space."
                      )
                    );
                  } else {
                    reject(err);
                  }
                }
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          }

          // Increment counter
          completedFiles++;

          // Notify progress
          if (progressCallback) {
            progressCallback({
              file,
              progress: completedFiles,
              total: totalFiles,
              status: "completed",
            });
          }
        } catch (fileError) {
          // Notify error
          if (progressCallback) {
            progressCallback({
              file,
              error: fileError.message,
              status: "error",
            });
          }

          console.error(
            `[ModelDownloader] Error downloading file '${file}':`,
            fileError
          );
          this.isDownloading = false;
          return false;
        }
      }

      // Store metadata
      localStorage.setItem(
        `${this.localStoragePrefix}${modelName}-meta`,
        JSON.stringify({
          name: modelName,
          version: modelInfo.version,
          timestamp: Date.now(),
          files: modelInfo.files,
        })
      );

      // Record completed download
      this._updateDownloadRegistry(modelName, true);

      // Finish
      this.isDownloading = false;
      return true;
    } catch (error) {
      console.error("[ModelDownloader] Error downloading model:", error);

      if (progressCallback) {
        progressCallback({
          error: error.message,
          status: "error",
        });
      }

      this.isDownloading = false;
      return false;
    }
  }

  /**
   * Updates download registry in localStorage
   * @param {string} modelName - Name of the model
   * @param {boolean} status - Download status (completed or not)
   * @private
   */
  _updateDownloadRegistry(modelName, status) {
    if (!this.hasStorage) return;

    try {
      const downloadsKey = `${this.localStoragePrefix}downloads`;
      const registry = JSON.parse(localStorage.getItem(downloadsKey) || "{}");

      registry[modelName] = {
        status: status ? "complete" : "failed",
        timestamp: Date.now(),
        version: this.models[modelName]?.version,
      };

      localStorage.setItem(downloadsKey, JSON.stringify(registry));
    } catch (e) {
      console.error("[ModelDownloader] Error updating registry:", e);
    }
  }

  /**
   * Loads a model from local storage into TensorFlow.js
   * @param {string} modelName - Name of the model
   * @returns {Promise<tf.GraphModel>} - Loaded model
   */
  async loadModelFromStorage(modelName) {
    if (!this.hasStorage || !window.tf) {
      throw new Error(
        "Required features not available (localStorage or TensorFlow)"
      );
    }

    // Check model availability
    const isAvailable = await this.isModelAvailable(modelName);
    if (!isAvailable) {
      throw new Error(`Model '${modelName}' not available in local storage`);
    }

    // Implement interface to load model from localStorage
    const modelInfo = this.models[modelName];
    const metaKey = `${this.localStoragePrefix}${modelName}-meta`;
    const metadata = JSON.parse(localStorage.getItem(metaKey));

    // Create custom loader
    const storageLoader = {
      load: async () => {
        // Load model.json
        const modelJsonKey = `${this.localStoragePrefix}${modelName}-model.json`;
        const modelJsonString = localStorage.getItem(modelJsonKey);

        if (!modelJsonString) {
          throw new Error(`'model.json' file not found for model ${modelName}`);
        }

        try {
          return JSON.parse(modelJsonString);
        } catch (e) {
          throw new Error(
            `Error parsing JSON for model ${modelName}: ${e.message}`
          );
        }
      },

      loadWeights: async (weightNames) => {
        const weightPromises = modelInfo.files
          .filter((file) => file.endsWith(".bin"))
          .map((file) => {
            return new Promise((resolve, reject) => {
              const storageKey = `${this.localStoragePrefix}${modelName}-${file}`;
              const base64Data = localStorage.getItem(storageKey);

              if (!base64Data) {
                return reject(
                  new Error(`Weight '${file}' not found in storage`)
                );
              }

              // Extract binary part from dataURI
              const binary = atob(base64Data.split(",")[1]);
              const bytes = new Uint8Array(binary.length);

              for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
              }

              resolve({
                name: file,
                data: bytes.buffer,
              });
            });
          });

        return Promise.all(weightPromises);
      },
    };

    // Load model using custom loader
    try {
      const model = await window.tf.loadGraphModel(storageLoader);
      console.log(
        `[ModelDownloader] Model '${modelName}' loaded from local storage`
      );
      return model;
    } catch (error) {
      console.error(
        `[ModelDownloader] Error loading model '${modelName}':`,
        error
      );
      throw error;
    }
  }

  /**
   * Removes a model from local storage
   * @param {string} modelName - Name of the model
   * @returns {boolean} - Removal success
   */
  removeModel(modelName) {
    if (!this.hasStorage || !this.models[modelName]) return false;

    try {
      // Remove metadata
      localStorage.removeItem(`${this.localStoragePrefix}${modelName}-meta`);

      // Remove each file
      const modelInfo = this.models[modelName];
      for (const file of modelInfo.files) {
        localStorage.removeItem(
          `${this.localStoragePrefix}${modelName}-${file}`
        );
      }

      // Update registry
      this._updateDownloadRegistry(modelName, false);

      console.log(
        `[ModelDownloader] Model '${modelName}' removed from local storage`
      );
      return true;
    } catch (e) {
      console.error(
        `[ModelDownloader] Error removing model '${modelName}':`,
        e
      );
      return false;
    }
  }

  /**
   * Gets storage usage information for models
   * @returns {Object} - Storage information
   */
  getStorageInfo() {
    if (!this.hasStorage) {
      return {
        supported: false,
        models: {},
        totalUsage: 0,
        available: 0,
      };
    }

    try {
      // Calculate space used by each model
      const modelsSpace = {};
      let totalUsage = 0;

      // Check each known model
      Object.keys(this.models).forEach((modelName) => {
        const metaKey = `${this.localStoragePrefix}${modelName}-meta`;
        const metaData = localStorage.getItem(metaKey);

        if (!metaData) {
          modelsSpace[modelName] = { downloaded: false, size: 0 };
          return;
        }

        try {
          // Calculate space used by this model
          let modelSize = metaData.length;
          const modelInfo = this.models[modelName];

          for (const file of modelInfo.files) {
            const key = `${this.localStoragePrefix}${modelName}-${file}`;
            const fileData = localStorage.getItem(key);
            if (fileData) {
              modelSize += fileData.length;
            }
          }

          // Convert to KB
          const sizeKB = Math.round(modelSize / 1024);
          modelsSpace[modelName] = {
            downloaded: true,
            size: sizeKB,
            files: modelInfo.files.length,
            version: JSON.parse(metaData).version,
          };

          totalUsage += modelSize;
        } catch (e) {
          modelsSpace[modelName] = { error: e.message, size: 0 };
        }
      });

      // Estimate available space (5MB is typical limit, but varies by browser)
      const totalAvailable = 5 * 1024 * 1024; // 5MB in bytes
      const available = Math.max(0, totalAvailable - totalUsage);

      return {
        supported: true,
        models: modelsSpace,
        totalUsage: Math.round(totalUsage / 1024), // KB
        available: Math.round(available / 1024), // KB
        totalModels: Object.keys(modelsSpace).filter(
          (m) => modelsSpace[m].downloaded
        ).length,
      };
    } catch (e) {
      console.error("[ModelDownloader] Error calculating storage info:", e);
      return {
        supported: true,
        error: e.message,
        models: {},
        totalUsage: 0,
        available: 0,
      };
    }
  }

  /**
   * Checks storage requirements for downloading a model
   * @param {string} modelName - Name of the model
   * @returns {Object} - Requirements information
   */
  checkStorageRequirements(modelName) {
    if (!this.hasStorage || !this.models[modelName]) {
      return {
        supported: false,
        hasSpace: false,
        modelName,
      };
    }

    const storageInfo = this.getStorageInfo();
    const modelInfo = this.models[modelName];

    // Estimate required space (approximate)
    let requiredKB = 0;

    if (modelName === "esrgan") {
      requiredKB = 4300; // ~4.2MB
    } else if (modelName === "mobilenet") {
      requiredKB = 9000; // ~8.8MB
    } else {
      // Generic estimate for other models
      requiredKB = 5000;
    }

    const hasSpace = storageInfo.available >= requiredKB;

    return {
      supported: true,
      hasSpace,
      requiredKB,
      availableKB: storageInfo.available,
      modelName,
      modelInfo,
    };
  }
}

// Export singleton instance
export default new ModelDownloader();
