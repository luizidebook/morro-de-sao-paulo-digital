/**
 * Controles personalizados para o modo 3D do mapa
 * Adiciona botões e funcionalidades de controle da visualização 3D
 */

/**
 * Adds a 3D toggle control to the map
 * @param {Object} options - Control options
 * @param {Object} options.mapInstance - The Leaflet map instance
 * @param {Object} options.mapbox3dInstance - The Mapbox GL JS instance
 * @returns {boolean} Success status
 */
export function add3DToggleControl(options = {}) {
  try {
    const { mapbox3dInstance } = options;

    // First check if we have a valid mapbox3dInstance
    if (
      !mapbox3dInstance ||
      typeof mapbox3dInstance.addControl !== "function"
    ) {
      console.warn("[add3DToggleControl] Invalid Mapbox GL JS instance");
      return false;
    }

    // Create a custom control for Mapbox GL JS
    const CustomControl = class {
      onAdd(map) {
        this.map = map;
        this.container = document.createElement("div");
        this.container.className =
          "mapboxgl-ctrl mapboxgl-ctrl-group custom-3d-control";

        // Create toggle button
        const toggleButton = document.createElement("button");
        toggleButton.className = "mapboxgl-ctrl-icon custom-3d-toggle";
        toggleButton.setAttribute("type", "button");
        toggleButton.setAttribute("aria-label", "Alternar visualização 3D");
        toggleButton.innerHTML = '<i class="fas fa-cube"></i>';

        // Set initial state based on current pitch
        const currentPitch = map.getPitch();
        if (currentPitch > 30) {
          toggleButton.classList.add("active");
        }

        // Add click handler
        toggleButton.addEventListener("click", () => {
          const currentPitch = map.getPitch();
          const newPitch = currentPitch > 30 ? 0 : 60;

          map.easeTo({
            pitch: newPitch,
            duration: 1000,
          });

          // Toggle active class
          if (newPitch > 0) {
            toggleButton.classList.add("active");
          } else {
            toggleButton.classList.remove("active");
          }
        });

        // Add tilt up and down buttons
        const tiltUpButton = document.createElement("button");
        tiltUpButton.className = "mapboxgl-ctrl-icon custom-3d-tilt-up";
        tiltUpButton.setAttribute("type", "button");
        tiltUpButton.setAttribute("aria-label", "Aumentar inclinação");
        tiltUpButton.innerHTML = '<i class="fas fa-angle-up"></i>';

        const tiltDownButton = document.createElement("button");
        tiltDownButton.className = "mapboxgl-ctrl-icon custom-3d-tilt-down";
        tiltDownButton.setAttribute("type", "button");
        tiltDownButton.setAttribute("aria-label", "Diminuir inclinação");
        tiltDownButton.innerHTML = '<i class="fas fa-angle-down"></i>';

        // Add click handlers
        tiltUpButton.addEventListener("click", () => {
          const currentPitch = map.getPitch();
          const newPitch = Math.min(currentPitch + 10, 85);
          map.easeTo({ pitch: newPitch, duration: 300 });
        });

        tiltDownButton.addEventListener("click", () => {
          const currentPitch = map.getPitch();
          const newPitch = Math.max(currentPitch - 10, 0);
          map.easeTo({ pitch: newPitch, duration: 300 });
        });

        // Add rotate buttons
        const rotateLeftButton = document.createElement("button");
        rotateLeftButton.className = "mapboxgl-ctrl-icon custom-3d-rotate-left";
        rotateLeftButton.setAttribute("type", "button");
        rotateLeftButton.setAttribute("aria-label", "Girar para esquerda");
        rotateLeftButton.innerHTML = '<i class="fas fa-undo"></i>';

        const rotateRightButton = document.createElement("button");
        rotateRightButton.className =
          "mapboxgl-ctrl-icon custom-3d-rotate-right";
        rotateRightButton.setAttribute("type", "button");
        rotateRightButton.setAttribute("aria-label", "Girar para direita");
        rotateRightButton.innerHTML = '<i class="fas fa-redo"></i>';

        // Add click handlers
        rotateLeftButton.addEventListener("click", () => {
          const currentBearing = map.getBearing();
          map.easeTo({ bearing: currentBearing - 45, duration: 300 });
        });

        rotateRightButton.addEventListener("click", () => {
          const currentBearing = map.getBearing();
          map.easeTo({ bearing: currentBearing + 45, duration: 300 });
        });

        // Add reset button
        const resetButton = document.createElement("button");
        resetButton.className = "mapboxgl-ctrl-icon custom-3d-reset";
        resetButton.setAttribute("type", "button");
        resetButton.setAttribute("aria-label", "Resetar visualização");
        resetButton.innerHTML = '<i class="fas fa-compass"></i>';

        resetButton.addEventListener("click", () => {
          map.easeTo({
            pitch: 0,
            bearing: 0,
            duration: 1000,
          });
          toggleButton.classList.remove("active");
        });

        // Add buttons to container
        this.container.appendChild(toggleButton);
        this.container.appendChild(document.createElement("hr"));
        this.container.appendChild(tiltUpButton);
        this.container.appendChild(tiltDownButton);
        this.container.appendChild(document.createElement("hr"));
        this.container.appendChild(rotateLeftButton);
        this.container.appendChild(rotateRightButton);
        this.container.appendChild(document.createElement("hr"));
        this.container.appendChild(resetButton);

        // Position the control at the center right
        setTimeout(() => {
          this.container.style.position = "absolute";
          this.container.style.right = "1px";
          this.container.style.top = "300%";
          this.container.style.transform = "translateY(-50%)";
          this.container.style.zIndex = "1000";
        }, 100);

        return this.container;
      }

      onRemove() {
        this.container.parentNode.removeChild(this.container);
        this.map = undefined;
      }
    };

    // Add the custom control to the map
    mapbox3dInstance.addControl(new CustomControl());

    console.log("[add3DToggleControl] 3D controls added successfully");
    return true;
  } catch (error) {
    console.error("[add3DToggleControl] Erro ao adicionar controle 3D:", error);
    return false;
  }
}

/**
 * Initializes 3D map controls
 * @param {Object} options - Options containing map instances
 * @returns {boolean} Success status
 */
export function initMap3DControls(options = {}) {
  try {
    console.log("[initMap3DControls] Initializing 3D map controls");

    const { mapbox3dInstance } = options;

    if (!mapbox3dInstance) {
      console.error("[initMap3DControls] mapbox3dInstance is required");
      return false;
    }

    // Add controls
    const controlsAdded = add3DToggleControl({ mapbox3dInstance });

    // Add custom CSS for the controls
    addControlsCSS();

    console.log(
      "[initMap3DControls] 3D map controls initialized:",
      controlsAdded
    );
    return true;
  } catch (error) {
    console.error("[initMap3DControls] Error initializing 3D controls:", error);
    return false;
  }
}

/**
 * Add CSS styles for 3D controls
 */
function addControlsCSS() {
  if (!document.getElementById("map-3d-controls-css")) {
    const style = document.createElement("style");
    style.id = "map-3d-controls-css";
    style.textContent = `
      .custom-3d-control {
        background: linear-gradient(135deg, #0043b3, #004bc7);
        border-radius: 4px;
        box-shadow: 0 0 10px rgba(0,0,0,0.2);
        overflow: hidden;
      }
      
      .custom-3d-control hr {
        margin: 5px 0;
        border: 0;
        height: 1px;
        background: #ddd;
      }
      
      .custom-3d-control button {
        background: none;
        border: 0;
        cursor: pointer;
        padding: 10px;
        width: 40px;
        height: 40px;
        display: flex;
        justify-content: center;
        align-items: center;
        transition: background-color 0.2s;
      }
      
      .custom-3d-control button:hover {
        background-color: #f0f0f0;
      }
      
      .custom-3d-control button.active {
        background-color: #e3f2fd;
        color: #1976d2;
      }
      
      .custom-3d-control i {
    font-size: 18px;
    color: white;
      }
    `;
    document.head.appendChild(style);
    console.log("[addControlsCSS] 3D controls CSS added");
  }
}
