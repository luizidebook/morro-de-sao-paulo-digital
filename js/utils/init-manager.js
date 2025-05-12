/**
 * Application Initialization Manager
 * Controls the loading sequence and ensures the loading overlay
 * is only removed when all components are ready
 */

// Track initialization status of all critical components
const initStatus = {
  language: false,
  map: false,
  map3d: false,
  assistant: false,
  ui: false,
  weather: false,
};

// Callbacks to run when everything is fully loaded
const readyCallbacks = [];

/**
 * Report component initialization complete
 * @param {string} component - Component name that's been initialized
 */
export function initComplete(component) {
  if (component in initStatus) {
    console.log(`[InitManager] Component ready: ${component}`);
    initStatus[component] = true;
    checkAllReady();
  }
}

/**
 * Check if all components are initialized and ready
 */
function checkAllReady() {
  const allReady = Object.values(initStatus).every((status) => status === true);

  if (allReady) {
    console.log("[InitManager] All components initialized, application ready!");

    // Execute all ready callbacks
    readyCallbacks.forEach((callback) => callback());

    // Hide the loading overlay
    if (typeof window.hideLoadingOverlay === "function") {
      window.hideLoadingOverlay();
    } else {
      const loadingOverlay = document.getElementById("loading-overlay");
      if (loadingOverlay) {
        loadingOverlay.classList.add("fade-out");
      }
    }
  } else {
    // Log which components are still initializing
    const pending = Object.entries(initStatus)
      .filter(([, ready]) => !ready)
      .map(([name]) => name)
      .join(", ");
    console.log(`[InitManager] Still waiting for: ${pending}`);
  }
}

/**
 * Add a callback to run when everything is ready
 * @param {Function} callback - Function to call when initialization is complete
 */
export function onReady(callback) {
  if (typeof callback === "function") {
    // Check if everything is already ready
    const allReady = Object.values(initStatus).every(
      (status) => status === true
    );
    if (allReady) {
      // Already ready, execute immediately
      callback();
    } else {
      // Add to queue for later execution
      readyCallbacks.push(callback);
    }
  }
}

/**
 * Updates loading message to show progress
 * @param {string} message - Message to display
 */
export function updateLoadingMessage(message) {
  const loadingMessage = document.querySelector("#loading-overlay p");
  if (loadingMessage && message) {
    loadingMessage.textContent = message;
  }
}

/**
 * Reset initialization status (useful for page reloads)
 */
export function resetInitStatus() {
  Object.keys(initStatus).forEach((key) => {
    initStatus[key] = false;
  });
}
