/**
 * Controles personalizados para o modo 3D do mapa
 * Adiciona botões e funcionalidades de controle da visualização 3D
 */
import { addSatelliteControlButton } from "./satelite-google/satellite-imagery-controls.js";

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

    // Verificar se os controles já existem para evitar duplicação
    const existingControls = document.querySelector(".custom-3d-control");
    if (existingControls) {
      console.log(
        "[add3DToggleControl] Controles 3D já existem, não criando novamente"
      );
      existingControls.style.display = "block";
      existingControls.style.visibility = "visible";
      existingControls.style.position = "absolute";
      existingControls.style.right = "10px";
      existingControls.style.top = "10px";
      existingControls.style.zIndex = "2000";
      return true;
    }

    // Remover botão de satélite antigo se existir
    removePreviousSatelliteButtons();

    // Importar o módulo map-3d.js para usar suas funções
    let map3dModule = null;

    // Importar o módulo apenas uma vez e reutilizar
    import("./map-3d.js")
      .then((module) => {
        map3dModule = module;
        console.log(
          "[add3DToggleControl] Módulo map-3d.js importado com sucesso"
        );
      })
      .catch((error) => {
        console.error(
          "[add3DToggleControl] Erro ao importar map-3d.js:",
          error
        );
      });

    // Import para os controles de satélite
    import("./satelite-google/satellite-imagery-controls.js").then(
      (satelliteModule) => {
        console.log("[add3DToggleControl] Módulo de satélite importado");
      }
    );

    // Create a custom control for Mapbox GL JS
    const CustomControl = class {
      onAdd(map) {
        this.map = map;
        this.container = document.createElement("div");
        this.container.className =
          "mapboxgl-ctrl mapboxgl-ctrl-group custom-3d-control";

        // Criando o container principal de botões
        const mainButtons = document.createElement("div");
        mainButtons.className = "main-buttons";

        // ==================== BOTÕES PRINCIPAIS ====================

        // 1. Botão para alternar entre fontes do mapa (substituindo o antigo botão de satélite)
        const mapLayersButton = document.createElement("button");
        mapLayersButton.className = "mapboxgl-ctrl-icon map-layers-control";
        mapLayersButton.setAttribute("type", "button");
        mapLayersButton.setAttribute("aria-label", "Alterar camadas do mapa");
        mapLayersButton.innerHTML = '<i class="fas fa-map"></i>';
        mapLayersButton.title = "Alterar camadas do mapa";

        // 2. Botão para ativar/desativar o modo 3D completo (agora segundo na ordem)
        const toggle3DButton = document.createElement("button");
        toggle3DButton.className = "mapboxgl-ctrl-icon custom-3d-toggle-map";
        toggle3DButton.setAttribute("type", "button");
        toggle3DButton.setAttribute("aria-label", "Ativar/Desativar mapa 3D");
        toggle3DButton.innerHTML = '<i class="fas fa-cube"></i>';
        toggle3DButton.title = "Ativar/Desativar mapa 3D";

        // Criando o container de botões do modo 3D (inicialmente oculto, agora dentro do container principal)
        const mode3DButtons = document.createElement("div");
        mode3DButtons.className = "mode-3d-buttons hidden";

        // A. Botão de inclinação para cima
        const tiltUpButton = document.createElement("button");
        tiltUpButton.className = "mapboxgl-ctrl-icon custom-3d-tilt-up";
        tiltUpButton.setAttribute("type", "button");
        tiltUpButton.setAttribute("aria-label", "Aumentar inclinação");
        tiltUpButton.innerHTML = '<i class="fas fa-angle-up"></i>';
        tiltUpButton.title = "Aumentar inclinação";

        // B. Botão de inclinação para baixo
        const tiltDownButton = document.createElement("button");
        tiltDownButton.className = "mapboxgl-ctrl-icon custom-3d-tilt-down";
        tiltDownButton.setAttribute("type", "button");
        tiltDownButton.setAttribute("aria-label", "Diminuir inclinação");
        tiltDownButton.innerHTML = '<i class="fas fa-angle-down"></i>';
        tiltDownButton.title = "Diminuir inclinação";

        // C. Botão de rotação para esquerda
        const rotateLeftButton = document.createElement("button");
        rotateLeftButton.className = "mapboxgl-ctrl-icon custom-3d-rotate-left";
        rotateLeftButton.setAttribute("type", "button");
        rotateLeftButton.setAttribute("aria-label", "Girar para esquerda");
        rotateLeftButton.innerHTML = '<i class="fas fa-undo"></i>';
        rotateLeftButton.title = "Girar para esquerda";

        // D. Botão de rotação para direita
        const rotateRightButton = document.createElement("button");
        rotateRightButton.className =
          "mapboxgl-ctrl-icon custom-3d-rotate-right";
        rotateRightButton.setAttribute("type", "button");
        rotateRightButton.setAttribute("aria-label", "Girar para direita");
        rotateRightButton.innerHTML = '<i class="fas fa-redo"></i>';
        rotateRightButton.title = "Girar para direita";

        // E. Botão de reset da visualização
        const resetButton = document.createElement("button");
        resetButton.className = "mapboxgl-ctrl-icon custom-3d-reset";
        resetButton.setAttribute("type", "button");
        resetButton.setAttribute("aria-label", "Resetar visualização");
        resetButton.innerHTML = '<i class="fas fa-compass"></i>';
        resetButton.title = "Resetar visualização";

        // 3. Botão de localização do usuário (mantido como terceiro e último)
        const locateButton = document.createElement("button");
        locateButton.className = "mapboxgl-ctrl-icon custom-locate-button";
        locateButton.setAttribute("type", "button");
        locateButton.setAttribute("aria-label", "Localizar minha posição");
        locateButton.innerHTML = '<i class="fas fa-location-arrow"></i>';
        locateButton.title = "Localizar minha posição";

        // ==================== IMPLEMENTAÇÃO DE EVENTOS ====================

        // Variáveis de estado
        let is3DEnabled = false;
        let is3DControlsVisible = false;
        let currentMapSource = "standard"; // 'standard' ou 'satélite'

        // 1. Evento do botão de camadas do mapa
        mapLayersButton.addEventListener("click", () => {
          // Mostrar o painel completo de controle de satélite em vez do menu simples
          import("./satelite-google/satellite-imagery-controls.js").then(
            (module) => {
              // Usar a função existente de toggle do painel, mantendo a estrutura
              module.toggleSatelliteControlPanel();

              // Ativar visualmente o botão
              mapLayersButton.classList.toggle("active");
            }
          );
        }); // 2. Evento do botão ativar/desativar 3D
        toggle3DButton.addEventListener("click", () => {
          is3DEnabled = !is3DEnabled;

          if (is3DEnabled) {
            // Ativar modo 3D
            map.easeTo({
              pitch: 60,
              duration: 1000,
            });
            toggle3DButton.classList.add("active");
            mode3DButtons.classList.remove("hidden");
            is3DControlsVisible = true;

            // Importar e usar a função enable3DMode
            import("./map-3d.js").then((module) => {
              module.enable3DMode();
            });
          } else {
            // Desativar modo 3D
            map.easeTo({
              pitch: 0,
              bearing: 0,
              duration: 1000,
            });
            toggle3DButton.classList.remove("active");
            mode3DButtons.classList.add("hidden");
            is3DControlsVisible = false;

            // Importar e usar a função disable3DMode
            import("./map-3d.js").then((module) => {
              module.disable3DMode();
            });
          }
        });

        // 3. Evento do botão de localização
        locateButton.addEventListener("click", () => {
          // Verifica se já está em modo de seguir
          const isCurrentlyFollowing =
            locateButton.classList.contains("following");

          if (isCurrentlyFollowing) {
            // Desativar modo de seguir
            locateButton.classList.remove("following");
            enableFollowUserMode(map, false);
            return;
          }

          // Ativar modo ativo normal
          locateButton.classList.add("active");

          try {
            // Fallback para o método original
            navigator.geolocation.getCurrentPosition(
              (position) => {
                // Criar um novo marcador ou obter o existente
                let userMarker;

                // Verificar se já existe um marcador de usuário
                if (window.userMarker3D) {
                  userMarker = window.userMarker3D;
                } else {
                  // Criar o marcador se não existir, usando a função addMarker3D
                  if (
                    map3dModule &&
                    typeof map3dModule.addMarker3D === "function"
                  ) {
                    userMarker = map3dModule.addMarker3D(
                      position.coords.latitude,
                      position.coords.longitude,
                      {
                        title: "Sua localização",
                        className: "user-location-marker",
                        isUserMarker: true,
                      }
                    );

                    // Guardar referência global
                    window.userMarker3D = userMarker;
                  }
                }

                // Centralizar no marcador
                map.flyTo({
                  center: [position.coords.longitude, position.coords.latitude],
                  zoom: 17,
                  pitch: map.getPitch(),
                  bearing: position.coords.heading || 0,
                  duration: 1500,
                });

                // Criar popup "Você está aqui!" acima do marcador
                createUserLocationPopup(
                  map,
                  position.coords.longitude,
                  position.coords.latitude
                );

                // Adicionar classe "following" após animação
                setTimeout(() => {
                  locateButton.classList.remove("active");
                  locateButton.classList.add("following");
                  enableFollowUserMode(map, true);
                }, 1500);
              },
              (error) => {
                console.error("Erro ao obter localização:", error);
                locateButton.classList.remove("active");
                alert(
                  "Não foi possível obter sua localização. Verifique as permissões do navegador."
                );
              },
              { enableHighAccuracy: true, timeout: 10000 }
            );
          } catch (error) {
            console.error("[locateButton] Erro:", error);
            locateButton.classList.remove("active");
          }
        });

        // A. Evento do botão de inclinação para cima
        tiltUpButton.addEventListener("click", () => {
          // Adicionar classe para o efeito visual
          tiltUpButton.classList.add("clicked");

          // Remover a classe após a animação
          setTimeout(() => {
            tiltUpButton.classList.remove("clicked");
          }, 1500);

          // Ação original
          const currentPitch = map.getPitch();
          const newPitch = Math.min(currentPitch + 10, 85);
          map.easeTo({ pitch: newPitch, duration: 300 });
        });

        // B. Evento do botão de inclinação para baixo
        tiltDownButton.addEventListener("click", () => {
          // Adicionar classe para o efeito visual
          tiltDownButton.classList.add("clicked");

          // Remover a classe após a animação
          setTimeout(() => {
            tiltDownButton.classList.remove("clicked");
          }, 1500);

          // Ação original
          const currentPitch = map.getPitch();
          const newPitch = Math.max(currentPitch - 10, 0);
          map.easeTo({ pitch: newPitch, duration: 300 });
        });

        // C. Evento do botão de rotação para esquerda
        rotateLeftButton.addEventListener("click", () => {
          // Adicionar classe para o efeito visual
          rotateLeftButton.classList.add("clicked");

          // Remover a classe após a animação
          setTimeout(() => {
            rotateLeftButton.classList.remove("clicked");
          }, 1500);

          // Ação original
          const currentBearing = map.getBearing();
          map.easeTo({ bearing: currentBearing - 45, duration: 300 });
        });

        // D. Evento do botão de rotação para direita
        rotateRightButton.addEventListener("click", () => {
          // Adicionar classe para o efeito visual
          rotateRightButton.classList.add("clicked");

          // Remover a classe após a animação
          setTimeout(() => {
            rotateRightButton.classList.remove("clicked");
          }, 1500);

          // Ação original
          const currentBearing = map.getBearing();
          map.easeTo({ bearing: currentBearing + 45, duration: 300 });
        });

        // E. Evento do botão de reset da visualização
        resetButton.addEventListener("click", () => {
          // Adicionar classe para o efeito visual
          resetButton.classList.add("clicked");

          // Remover a classe após a animação
          setTimeout(() => {
            resetButton.classList.remove("clicked");
          }, 1500);

          // Ação original
          map.easeTo({
            pitch: 60, // Mantém em 3D, mas com valores padrão
            bearing: 0,
            duration: 1000,
          });
        });

        // ==================== MONTAGEM DA ESTRUTURA DOM ====================

        // 1. Adicionar primeiro botão (mapas)
        mainButtons.appendChild(mapLayersButton);

        // 2. Adicionar segundo botão (3D)
        mainButtons.appendChild(toggle3DButton);

        // 3. Adicionar botões de controle 3D ao container principal (entre 3D e locate)
        mode3DButtons.appendChild(tiltUpButton);
        mode3DButtons.appendChild(tiltDownButton);
        mode3DButtons.appendChild(rotateLeftButton);
        mode3DButtons.appendChild(rotateRightButton);
        mode3DButtons.appendChild(resetButton);
        mainButtons.appendChild(mode3DButtons);

        // 4. Adicionar terceiro e último botão (localização)
        mainButtons.appendChild(locateButton);

        // Adicionar os grupos ao container principal
        this.container.appendChild(mainButtons);

        // Remover classe de posição padrão e adicionar nossa classe personalizada
        this.container.classList.remove("mapboxgl-ctrl-top-right");
        this.container.classList.add("map-3d-controls-right-center");

        // Forçar o estilo inline para garantir que nosso posicionamento seja aplicado
        const applyPosition = () => {
          const mapContainer = map.getContainer();
          const mapHeight = mapContainer.offsetHeight;

          this.container.style.position = "absolute";
          this.container.style.right = "10px";
          this.container.style.left = "auto";
          this.container.style.top = "50%";
          this.container.style.marginTop = "0";
          this.container.style.visibility = "visible"; // Garantir visibilidade
          this.container.style.transform = "translateY(-50%)";
          this.container.style.zIndex = "2000";

          // Verificar se o container foi realmente adicionado ao DOM
          const isInDOM = document.contains(this.container);
          console.log(
            `[Custom3DControl] Container no DOM: ${isInDOM ? "Sim" : "Não"}`
          );

          // Verificar computedStyle para posição top
          if (isInDOM) {
            const computedStyle = window.getComputedStyle(this.container);
            console.log(
              `[Custom3DControl] Posição computada: top=${computedStyle.top}, right=${computedStyle.right}`
            );
          }
        };

        // Aplicar imediatamente e nos eventos relevantes
        applyPosition();

        // Usar MutationObserver para detectar quando o controle é movido ou modificado
        this.observer = new MutationObserver(applyPosition);
        this.observer.observe(this.container, {
          attributes: true,
          attributeFilter: ["style", "class"],
          subtree: false,
        });

        // Aplicar novamente após a inicialização completa do mapa
        map.on("load", applyPosition);
        map.on("resize", applyPosition);

        // Também aplicar após pequenos atrasos para capturar mudanças assíncronas
        [100, 500, 1000].forEach((delay) => setTimeout(applyPosition, delay));

        // Inicializar módulo de satélite quando o mapa estiver pronto
        map.once("load", () => {
          import("./satelite-google/satellite-imagery-controls.js")
            .then((module) => {
              module.initSatelliteControls({
                initialSource: "standard",
                addControlButton: false, // Não adicionar botão extra, já temos o nosso
                autoInitEnhancer: true,
                // Configurar para mostrar apenas Padrão e Satélite
                sources: ["standard", "satélite"],
              });
              console.log(
                "[add3DToggleControl] Controles de satélite inicializados"
              );

              // Remover novamente botões antigos após inicialização
              removePreviousSatelliteButtons();
            })
            .catch((error) => {
              console.error(
                "[add3DToggleControl] Erro ao inicializar controles de satélite:",
                error
              );
            });
        });

        // Tornar o container visível imediatamente após a criação
        setTimeout(() => {
          if (this.container) {
            this.container.style.display = "block";
            this.container.style.visibility = "visible";
            this.container.style.position = "absolute";
            this.container.style.right = "10px";
            this.container.style.top = "10px";
            this.container.style.zIndex = "2000";
          }
        }, 100);

        return this.container;
      }

      onRemove() {
        // Desconectar o observer quando o controle for removido
        if (this.observer) {
          this.observer.disconnect();
          this.observer = null;
        }

        // Remover o listener de redimensionamento
        window.removeEventListener("resize", this.applyPosition);

        this.container.parentNode.removeChild(this.container);
        this.map = undefined;
      }
    };

    // Add the custom control to the map
    mapbox3dInstance.addControl(new CustomControl(), "top-right");

    // Adicionar estilos para os controles
    addControlsCSS();

    // Remover botão antigo novamente após um breve atraso
    setTimeout(removePreviousSatelliteButtons, 500);

    console.log("[add3DToggleControl] 3D controls added successfully");
    return true;
  } catch (error) {
    console.error("[add3DToggleControl] Erro ao adicionar controle 3D:", error);
    return false;
  }
}

/**
 * Remove quaisquer botões de satélite existentes do controle antigo
 */
function removePreviousSatelliteButtons() {
  try {
    // Buscar todos os possíveis botões de satélite pelo seletor de classe
    const satelliteButtons = document.querySelectorAll(
      ".satellite-controls-button"
    );

    if (satelliteButtons.length > 0) {
      console.log(
        `[removePreviousSatelliteButtons] Encontrados ${satelliteButtons.length} botões antigos`
      );

      satelliteButtons.forEach((button, index) => {
        // Verificar se este botão está dentro do nosso novo controle (evitar remover o novo botão)
        const isInNewControl = button.closest(".custom-3d-control");
        if (!isInNewControl) {
          // Remover o container pai (grupo de controle)
          const container = button.closest(".mapboxgl-ctrl-group");
          if (container) {
            container.remove();
            console.log(
              `[removePreviousSatelliteButtons] Removido container ${index + 1}`
            );
          } else {
            button.remove();
            console.log(
              `[removePreviousSatelliteButtons] Removido botão avulso ${
                index + 1
              }`
            );
          }
        }
      });
    }

    return true;
  } catch (error) {
    console.error("[removePreviousSatelliteButtons] Erro:", error);
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

    // Verificar se os controles já existem
    const existingControls = document.querySelector(".custom-3d-control");
    if (existingControls) {
      console.log(
        "[initMap3DControls] Controles 3D já existem, tornando visíveis"
      );

      // Garantir que sejam visíveis
      existingControls.style.display = "block";
      existingControls.style.visibility = "visible";
      existingControls.style.position = "absolute";
      existingControls.style.right = "10px";
      existingControls.style.top = "10px";
      existingControls.style.zIndex = "2000";

      console.log(
        "[initMap3DControls] 3D map controls already exist, made visible"
      );
      return true;
    }

    // Aguardar um momento até que o mapa esteja realmente pronto
    setTimeout(() => {
      try {
        // Add controls
        const controlsAdded = add3DToggleControl({ mapbox3dInstance });

        // Add custom CSS for the controls
        addControlsCSS();

        // Verificar se os controles foram adicionados
        if (controlsAdded) {
          // Forçar visibilidade explicitamente após 500ms
          setTimeout(() => {
            const controls = document.querySelector(".custom-3d-control");
            if (controls) {
              controls.style.display = "block";
              controls.style.visibility = "visible";
              controls.style.position = "absolute";
              controls.style.right = "10px";
              controls.style.top = "10px";
              controls.style.zIndex = "2000";
              console.log(
                "[initMap3DControls] Visibility forced for 3D controls"
              );
            } else {
              console.warn(
                "[initMap3DControls] Controls not found after adding"
              );
            }
          }, 500);
        }

        console.log(
          "[initMap3DControls] 3D map controls initialized:",
          controlsAdded
        );
      } catch (err) {
        console.error(
          "[initMap3DControls] Error in delayed initialization:",
          err
        );
      }
    }, 1000);

    return true;
  } catch (error) {
    console.error("[initMap3DControls] Error initializing 3D controls:", error);
    return false;
  }
}
function addControlsCSS() {
  if (!document.getElementById("map-3d-controls-css")) {
    const style = document.createElement("style");
    style.id = "map-3d-controls-css";
    style.textContent = `
      /* Estilos compartilhados entre nossos controles e os do map-3d.js */
      .custom-3d-control button.active,
      .mapboxgl-ctrl button.active,
      .map-layers-control.active {
        background-color: #4CAF50 !important; /* Verde para todos os botões ativos */
        color: white !important;
      }
      
      .custom-3d-control button.active i,
      .mapboxgl-ctrl button.active i,
      .map-layers-control.active i {
        color: white !important;
      }
      
      /* Estilos base para o controle 3D personalizado */
      .custom-3d-control {
        background: linear-gradient(135deg, #0043b3, #004bc7);
        border-radius: 4px;
        box-shadow: 0 0 10px rgba(0,0,0,0.2);
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      
      /* Classe específica para garantir posicionamento */
      .map-3d-controls-right-center {
        position: absolute !important;
        right: 10px !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        z-index: 1000 !important;
      }
      
      /* Sobrescrever qualquer tentativa de posicionar em outro lugar */
      .mapboxgl-ctrl.custom-3d-control {
        position: absolute !important;
        right: 10px !important;
        left: auto !important;
        top: 50% !important;
        bottom: auto !important;
        transform: translateY(-50%) !important;
      }
      
      .custom-3d-control .main-buttons {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      
      /* NOVO: Modo 3D buttons agora está no fluxo principal */
      .custom-3d-control .mode-3d-buttons {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      
      .custom-3d-control .hidden {
        display: none;
      }
      
      /* Estilo base para todos os botões */
      .custom-3d-control button {
        background: none;
        border: 1px solid rgba(0,0,0,0.15); /* Adicionada borda fina para todos os botões */
        cursor: pointer;
        padding: 10px;
        width: 40px;
        height: 40px;
        display: flex;
        justify-content: center;
        align-items: center;
        transition: all 0.2s;
        position: relative;
        overflow: hidden;
      }
      
      /* ATUALIZADO: Os botões de controle 3D agora mantêm o background azul como os outros */
      .custom-3d-control .mode-3d-buttons button {
        /* Sem background-color específico - herda do container pai */
      }
      
      /* Ícones em branco para todos os botões */
      .custom-3d-control button i {
        font-size: 18px;
        color: white;
      }
      
      /* Efeito de clique com animação */
      .custom-3d-control .mode-3d-buttons button.clicked::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #4CAF50;
        opacity: 0.8;
        animation: fade-out 1.5s forwards;
        z-index: -1;
      }
      
      @keyframes fade-out {
        0% { opacity: 0.8; }
        100% { opacity: 0; }
      }
      
      .custom-3d-control button:hover {
        background-color: rgba(255,255,255,0.2);
      }
      
      /* Estilo para o botão de localização quando está seguindo */
      .custom-3d-control button.custom-locate-button.following {
        background-color: #4CAF50; /* Verde */
      }
      
      .custom-3d-control button.custom-locate-button.following i {
        color: white;
      }
      
      /* Estilo para o botão 3D quando está ativo */
      .custom-3d-control button.custom-3d-toggle-map.active {
        background-color: #4CAF50; /* Verde */
      }
      
      .custom-3d-control button.custom-3d-toggle-map.active i {
        color: white;
      }
      
      /* Efeito de pulso verde */
      @keyframes pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7); /* Verde mais transparente */
        }
        70% {
          box-shadow: 0 0 0 6px rgba(76, 175, 80, 0); /* Verde que desaparece */
        }
        100% {
          box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
        }
      }
      
      .custom-3d-control button.custom-locate-button.following {
        animation: pulse 2s infinite;
      }
      
      /* Estilos para o popup "Você está aqui!" */
      .you-are-here-popup .mapboxgl-popup-content {
        background: #4CAF50;
        color: white;
        font-weight: bold;
        padding: 10px 15px;
        border-radius: 20px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.25);
        font-family: Arial, sans-serif;
        text-align: center;
        font-size: 14px;
        min-width: 120px;
      }
      
      .you-are-here-popup .mapboxgl-popup-tip {
        border-top-color: #4CAF50;
        border-bottom-color: #4CAF50;
      }
      
      /* Para garantir que a seta do popup tenha a cor correta em todas as direções */
      .you-are-here-popup.mapboxgl-popup-anchor-top .mapboxgl-popup-tip {
        border-bottom-color: #4CAF50;
      }
      
      .you-are-here-popup.mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip {
        border-top-color: #4CAF50;
      }
      
      .you-are-here-popup.mapboxgl-popup-anchor-left .mapboxgl-popup-tip {
        border-right-color: #4CAF50;
      }
      
      .you-are-here-popup.mapboxgl-popup-anchor-right .mapboxgl-popup-tip {
        border-left-color: #4CAF50;
      }
      
      /* Estilos para o painel de satélite simplificado - mostrar apenas Padrão e Google */
      .satellite-control-panel .source-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      
      /* Ocultar fontes não-necessárias */
      .satellite-control-panel .source-button[data-source="streets"],
      .satellite-control-panel .source-button[data-source="hd"],
      .satellite-control-panel .source-button[data-source="esri"] {
        display: none;
      }
      
      /* Estilos para o modo forced-colors para acessibilidade */
      @media (forced-colors: active) {
        .custom-3d-control button,
        .mapboxgl-ctrl button,
        .map-layers-control {
          forced-color-adjust: none;
          color: CanvasText;
          background-color: ButtonFace;
          border-color: ButtonBorder;
        }
        
        .custom-3d-control button:hover,
        .mapboxgl-ctrl button:hover {
          background-color: Highlight;
          color: HighlightText;
        }
        
        .custom-3d-control button.active,
        .mapboxgl-ctrl button.active,
        .custom-3d-control button.following,
        .map-layers-control.active {
          background-color: Highlight !important;
          color: HighlightText !important;
        }
        
        .custom-3d-control button i,
        .mapboxgl-ctrl button i {
          color: currentColor !important;
        }
        
        .you-are-here-popup .mapboxgl-popup-content {
          background-color: ButtonFace;
          color: CanvasText;
          border: 1px solid ButtonBorder;
        }
        
        .you-are-here-popup .mapboxgl-popup-tip {
          border-color: transparent;
          border-bottom-color: ButtonBorder;
        }
        
        .map-source-menu {
          border: 1px solid ButtonBorder;
          background-color: Canvas;
        }
        
        .map-source-option.active {
          color: Highlight;
        }
      }
    `;
    document.head.appendChild(style);
    console.log("[addControlsCSS] 3D controls CSS added");
  }
}

/**
 * Adiciona um indicador de carregamento na tela
 * @param {string} message - Mensagem a exibir durante o carregamento
 * @returns {HTMLElement} Elemento do indicador criado
 */
function addLoadingIndicator(message = "Carregando...") {
  // Verificar se já existe uma função global para isso
  if (typeof window.addLoadingIndicator === "function") {
    return window.addLoadingIndicator(message);
  }

  const indicator = document.createElement("div");
  indicator.className = "loading-indicator";
  indicator.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-message">${message}</div>
  `;

  // Estilizar o indicador
  indicator.style.position = "fixed";
  indicator.style.top = "50%";
  indicator.style.left = "50%";
  indicator.style.transform = "translate(-50%, -50%)";
  indicator.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  indicator.style.borderRadius = "8px";
  indicator.style.padding = "20px";
  indicator.style.color = "white";
  indicator.style.display = "flex";
  indicator.style.flexDirection = "column";
  indicator.style.alignItems = "center";
  indicator.style.zIndex = "9999";

  // Adicionar estilos para o spinner
  const style = document.createElement("style");
  style.textContent = `
    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s linear infinite;
      margin-bottom: 10px;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .loading-message {
      font-family: sans-serif;
      font-size: 14px;
    }
  `;
  document.head.appendChild(style);

  // Adicionar ao DOM
  document.body.appendChild(indicator);

  return indicator;
}

/**
 * Ativa o modo de seguir usuário no mapa 3D
 * @param {Object} map - Instância do mapa
 * @param {boolean} enabled - Se o modo deve ser ativado/desativado
 */
export function enableFollowUserMode(map, enabled = true) {
  try {
    // Definir o estado no objeto global do mapa
    if (!window.mapState) window.mapState = {};
    window.mapState.followUser = enabled;

    console.log(
      `[enableFollowUserMode] Modo seguir usuário ${
        enabled ? "ativado" : "desativado"
      }`
    );

    // Atualizar visualmente o botão
    const locateButton = document.querySelector(".custom-locate-button");
    if (locateButton) {
      if (enabled) {
        locateButton.classList.add("following");
      } else {
        locateButton.classList.remove("following");
      }
    }

    // Iniciar ou parar o rastreamento se necessário
    if (enabled) {
      // Se já existe um watcher, limpe-o para evitar duplicação
      if (window.positionWatcherId) {
        navigator.geolocation.clearWatch(window.positionWatcherId);
      }

      // Iniciar novo watcher
      window.positionWatcherId = navigator.geolocation.watchPosition(
        (position) => {
          if (window.mapState && window.mapState.followUser) {
            // Atualizar mapa para seguir a posição do usuário
            map.flyTo({
              center: [position.coords.longitude, position.coords.latitude],
              zoom: map.getZoom(), // Manter zoom atual
              pitch: map.getPitch(), // Manter inclinação atual
              bearing: position.coords.heading || map.getBearing(),
              duration: 500, // Transição suave
            });

            // Atualizar marcador se existir
            if (
              window.userMarker3D &&
              typeof window.userMarker3D.setLngLat === "function"
            ) {
              window.userMarker3D.setLngLat([
                position.coords.longitude,
                position.coords.latitude,
              ]);

              // Atualizar rotação do marcador se tiver heading
              if (position.coords.heading) {
                const markerElement = window.userMarker3D.getElement();
                if (
                  markerElement &&
                  markerElement.classList.contains("user-location-arrow")
                ) {
                  markerElement.style.transform = `rotate(${position.coords.heading}deg)`;
                }
              }
            }
          }
        },
        (error) => {
          console.error("[enableFollowUserMode] Erro de rastreamento:", error);
          // Desativar modo seguir em caso de erro
          enableFollowUserMode(map, false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      // Parar de rastrear
      if (window.positionWatcherId) {
        navigator.geolocation.clearWatch(window.positionWatcherId);
        window.positionWatcherId = null;
      }
    }

    return true;
  } catch (error) {
    console.error("[enableFollowUserMode] Erro:", error);
    return false;
  }
}

/**
 * Transição suave para uma localização no mapa 3D
 * @param {Object} map - Instância do mapa
 * @param {Object} location - Objeto com coordenadas
 * @param {Object} options - Opções adicionais para a transição
 */
export function flyToLocation(map, location, options = {}) {
  const {
    zoom = 17,
    pitch = 60,
    bearing = 0,
    duration = 1500,
    userLocationMarker = false,
    showPopup = true,
  } = options;

  // Verificar formato da localização
  const lat = location.latitude || location.lat;
  const lng = location.longitude || location.lon || location.lng;

  if (!lat || !lng) {
    console.error("[flyToLocation] Localização inválida:", location);
    return;
  }

  // Executar a transição
  map.flyTo({
    center: [lng, lat],
    zoom,
    pitch,
    bearing,
    duration,
    essential: true,
  });

  // Se solicitado, mostrar/atualizar marcador do usuário
  if (userLocationMarker) {
    // Importar o módulo map-3d.js para usar sua função de marcador
    import("./map-3d.js")
      .then((module) => {
        if (typeof module.addUserLocationMarker === "function") {
          module.addUserLocationMarker(lat, lng, {
            heading: bearing,
            showPopup: false, // O popup será criado separadamente abaixo
          });
        }
      })
      .catch((error) => {
        console.error("[flyToLocation] Erro ao importar map-3d.js:", error);
      });
  }

  // Mostrar popup "Você está aqui!" se solicitado
  if (showPopup) {
    createUserLocationPopup(map, lng, lat);
  }

  console.log(
    `[flyToLocation] Voando para [${lat}, ${lng}] com configurações:`,
    { zoom, pitch, bearing, duration }
  );
}

/**
 * Cria um popup de "Você está aqui!" em uma localização específica
 * @param {Object} map - Instância do mapa Mapbox
 * @param {number} lng - Longitude
 * @param {number} lat - Latitude
 * @returns {Object} Objeto popup criado
 */
export function createUserLocationPopup(map, lng, lat) {
  try {
    // Remover popup existente, se houver
    if (window.userLocationPopup) {
      window.userLocationPopup.remove();
    }

    // Criar novo popup
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: "you-are-here-popup",
      offset: [0, -15],
    })
      .setLngLat([lng, lat])
      .setHTML('<div class="you-are-here-content">Você está aqui!</div>')
      .addTo(map);

    // Armazenar referência ao popup para poder removê-lo depois
    window.userLocationPopup = popup;

    // Remover popup após 5 segundos
    setTimeout(() => {
      if (popup) popup.remove();
    }, 5000);

    return popup;
  } catch (error) {
    console.error("[createUserLocationPopup] Erro:", error);
    return null;
  }
}
