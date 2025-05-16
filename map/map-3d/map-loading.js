/**
 * Map loading indicator management module
 */

let loadingIndicator = null;

/**
 * Shows loading indicator for 3D map initialization
 */
export function showMap3DLoadingIndicator() {
  // Check if loading indicator already exists
  let indicator = document.getElementById("map3d-loading");
  if (indicator) {
    indicator.style.display = "flex";
    return indicator;
  }

  // Create loading indicator
  loadingIndicator = document.createElement("div");
  loadingIndicator.id = "map3d-loading";
  loadingIndicator.className = "map3d-loading-overlay";

  const spinner = document.createElement("div");
  spinner.className = "map3d-loading-spinner";

  const text = document.createElement("div");
  text.className = "map3d-loading-text";
  text.textContent = "Carregando Morro Digital...";

  loadingIndicator.appendChild(spinner);
  loadingIndicator.appendChild(text);

  // Add styles if they don't exist
  if (!document.getElementById("map3d-loading-styles")) {
    const style = document.createElement("style");
    style.id = "map3d-loading-styles";
    style.textContent = `
      .map3d-loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: #004bc7
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 9999;
      }
      .map3d-loading-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: #fff;
        animation: map3d-spin 1s ease-in-out infinite;
        margin-bottom: 10px;
      }
      .map3d-loading-text {
        color: white;
        font-size: 16px;
        font-weight: bold;
      }
      @keyframes map3d-spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  return loadingIndicator;
}

/**
 * Hides the 3D map loading indicator
 */
export function hideMap3DLoadingIndicator() {
  const indicator = document.getElementById("map3d-loading");
  if (indicator) {
    indicator.style.display = "none";
  }
}
