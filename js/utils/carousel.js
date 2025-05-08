// Declaração da variável swiperInstance

// Adicionar no topo do arquivo
import { saveCarouselState, clearCarouselState } from "./carousel-state.js";

export function startCarousel(locationName) {
  const images = getImagesForLocation(locationName);
  if (!images || images.length === 0) {
    alert("Nenhuma imagem disponível para o carrossel.");
    return;
  }

  const swiperWrapper = document.querySelector(".swiper-wrapper");
  swiperWrapper.innerHTML = ""; // Limpa os slides existentes

  images.forEach((src) => {
    const slide = document.createElement("div");
    slide.className = "swiper-slide";
    slide.innerHTML = `<img src="${src}" alt="${locationName}" style="width: 100%; height: 100%;">`;
    swiperWrapper.appendChild(slide);
  });

  showModal("carousel-modal"); // Exibe o modal

  // Destroi a instância anterior do Swiper, se existir
  if (swiperInstance) {
    swiperInstance.destroy(true, true);
  }

  // Inicializa o Swiper
  swiperInstance = new Swiper(".swiper-container", {
    slidesPerView: 1,
    spaceBetween: 10,
    loop: images.length > 1, // Ativa o loop apenas se houver mais de 1 slide
    pagination: {
      el: ".swiper-pagination",
      clickable: true,
    },
    navigation: {
      nextEl: ".swiper-button-next",
      prevEl: ".swiper-button-prev",
    },
    autoplay: {
      delay: 2500,
      disableOnInteraction: false,
    },
  });

  console.log("startCarousel: Carrossel iniciado para", locationName);
}

// Melhoria da função getImagesForLocation para tratar diferentes variações de nomes
export function getImagesForLocation(locationName) {
  if (!locationName) {
    console.error("[carousel] Nome de local vazio");
    return [];
  }

  // Log para debug
  console.log(`[carousel] Buscando imagens para: "${locationName}"`);

  // 1. Tentativa de correspondência exata
  const normalized = normalizeName(locationName);
  console.log(`[carousel] Nome normalizado: "${normalized}"`);

  // Busca exata no mapa normalizado
  if (normalizedMap[normalized]) {
    console.log(
      `[carousel] Encontrado exato: ${normalizedMap[normalized].length} imagens`
    );
    return normalizedMap[normalized];
  }

  // 2. Busca por correspondência parcial - tenta encontrar um local que contenha o nome buscado
  const matchingKey = Object.keys(normalizedMap).find(
    (key) => key.includes(normalized) || normalized.includes(key)
  );

  if (matchingKey) {
    console.log(
      `[carousel] Encontrado por inclusão parcial (${matchingKey}): ${normalizedMap[matchingKey].length} imagens`
    );
    return normalizedMap[matchingKey];
  }

  // 3. Mapeamento de apelidos comuns
  const aliasMap = {
    toca: "toca do morcego",
    farol: "farol do morro",
    mirante: "mirante da tirolesa",
    fortaleza: "fortaleza de morro de sao paulo",
    paredao: "paredao da argila",
    primeira: "primeira praia",
    segunda: "segunda praia",
    terceira: "terceira praia",
    quarta: "quarta praia",
    encanto: "praia do encanto",
    porto: "praia do porto",
    gamboa: "praia da gamboa",
  };

  if (aliasMap[normalized]) {
    const aliasNormalized = normalizeName(aliasMap[normalized]);
    if (normalizedMap[aliasNormalized]) {
      console.log(
        `[carousel] Encontrado por alias (${aliasNormalized}): ${normalizedMap[aliasNormalized].length} imagens`
      );
      return normalizedMap[aliasNormalized];
    }
  }

  // 4. Busca pelo início da string
  const prefixMatch = Object.keys(normalizedMap).find(
    (key) => key.startsWith(normalized) || normalized.startsWith(key)
  );

  if (prefixMatch) {
    console.log(
      `[carousel] Encontrado por prefixo (${prefixMatch}): ${normalizedMap[prefixMatch].length} imagens`
    );
    return normalizedMap[prefixMatch];
  }

  // 5. Busca por similaridade - qualquer palavra em comum
  const words = normalized.split(" ");
  for (const word of words) {
    if (word.length < 3) continue; // Ignorar palavras muito curtas

    const similarMatch = Object.keys(normalizedMap).find((key) =>
      key.includes(word)
    );

    if (similarMatch) {
      console.log(
        `[carousel] Encontrado por similaridade (${similarMatch}): ${normalizedMap[similarMatch].length} imagens`
      );
      return normalizedMap[similarMatch];
    }
  }

  // Nada encontrado
  console.error(
    `[carousel] NENHUMA IMAGEM ENCONTRADA para: "${locationName}" (norm: "${normalized}")`
  );
  return [];
}

// Melhoria da função normalizeName para ser mais robusta
function normalizeName(name) {
  if (!name) return "";

  return name
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^\w\s]/g, "") // Remove pontuação
    .replace(/\s+/g, " ") // Normaliza espaços
    .trim()
    .toLowerCase();
}

export function showCarouselInAssistant(locationName) {
  console.log(
    `[carousel] showCarouselInAssistant chamado para: "${locationName}"`
  );

  // Garantir que locationName seja uma string e limpar texto adicional
  let locationNameStr = String(locationName || "");

  // Limpar texto: remover mensagem padrão de feedback se estiver presente
  if (locationNameStr.includes("Gostou? Deseja mais informações")) {
    locationNameStr = locationNameStr.split("\n")[0].trim();
    console.log(`[carousel] Nome limpo: "${locationNameStr}"`);
  }

  // Salvar o estado logo no início da função
  saveCarouselState(locationNameStr);

  // Obter imagens
  const images = getImagesForLocation(locationNameStr);
  if (!images || images.length === 0) {
    console.error(
      `[carousel] Nenhuma imagem disponível para: "${locationNameStr}"`
    );
    return false;
  }

  console.log(
    `[carousel] Encontradas ${images.length} imagens para: "${locationNameStr}"`
  );

  // Obter referência ao container do assistente
  const assistantMessages = document.getElementById("assistant-messages");
  if (!assistantMessages) {
    console.error("[carousel] Elemento #assistant-messages não encontrado");
    return false;
  }

  // IMPORTANTE: Limpar completamente a área de mensagens antes de continuar
  const messagesArea = assistantMessages.querySelector(".messages-area");
  if (messagesArea) {
    console.log("[carousel] Limpando completamente a área de mensagens");
    messagesArea.innerHTML = ""; // Limpar tudo para evitar duplicações
  } else {
    console.error("[carousel] Área de mensagens não encontrada");
    return false;
  }

  // Criar wrapper para o carrossel
  const wrapper = document.createElement("div");
  wrapper.classList.add("carousel-container");

  // Verificar se as imagens existem
  console.log("[carousel] Verificando URLs das imagens:");
  images.forEach((src, i) => console.log(`[carousel] Imagem ${i + 1}: ${src}`));

  // Gerar HTML com texto de feedback integrado e botão de minimizar
  wrapper.innerHTML = `
    <div class="carousel-header">
      <button class="carousel-minimize-button" aria-label="Minimizar carrossel">✕</button>
    </div>
    <div class="swiper-container">
      <div class="swiper-wrapper">
        ${images
          .map(
            (src) =>
              `<div class="swiper-slide">
               <img src="${src}" alt="${locationName}" loading="lazy" 
                    onload="this.classList.add('loaded'); console.log('[carousel] Imagem carregada')" 
                    onerror="this.onerror=null; this.src='images/placeholders/image-not-found.jpg'; console.error('[carousel] Erro ao carregar imagem')">
             </div>`
          )
          .join("")}
      </div>
      <div class="swiper-pagination"></div>
      <div class="swiper-button-next"></div>
      <div class="swiper-button-prev"></div>
    </div>
    <div class="carousel-info-text">
      ${locationName}<br>
      <span class="feedback-text">Gostou? Deseja mais informações, saber como chegar ou conhecer outro local?</span>
    </div>
  `;

  // Adicionar ao container, sem criar nenhuma div.message.assistant extra
  messagesArea.appendChild(wrapper);
  console.log(
    "[carousel] Carrossel adicionado ao DOM diretamente na messagesArea"
  );

  // Adicionar classe para ajustar estilos
  assistantMessages.classList.add("showing-carousel");

  // Configurar evento de clique para o botão minimizar
  const minimizeButton = wrapper.querySelector(".carousel-minimize-button");
  if (minimizeButton) {
    minimizeButton.addEventListener("click", () => {
      console.log(
        "[carousel] Botão minimizar clicado, removendo carrossel e assistente"
      );
      // Chamar minimizeCarousel com true para esconder também o assistente
      minimizeCarousel(true);
    });
  }

  // Inicializar Swiper após pequeno delay
  setTimeout(() => {
    const swiperContainer = wrapper.querySelector(".swiper-container");
    if (swiperContainer) {
      console.log(
        `[carousel] Inicializando Swiper para ${images.length} imagens`
      );

      try {
        new Swiper(swiperContainer, {
          slidesPerView: 1,
          spaceBetween: 10,
          loop: images.length > 1,
          pagination: {
            el: swiperContainer.querySelector(".swiper-pagination"),
            clickable: true,
          },
          navigation: {
            nextEl: swiperContainer.querySelector(".swiper-button-next"),
            prevEl: swiperContainer.querySelector(".swiper-button-prev"),
          },
          autoplay: {
            delay: 2500,
            disableOnInteraction: false,
          },
          on: {
            init: function () {
              console.log("[carousel] Swiper inicializado com sucesso");
            },
            slideChange: function () {
              console.log(
                `[carousel] Slide alterado para: ${this.activeIndex}`
              );
            },
          },
        });
      } catch (error) {
        console.error("[carousel] Erro ao inicializar Swiper:", error);
      }
    }
  }, 100);

  return true;
}

// Adicionar nova função para minimizar o carrossel
export function minimizeCarousel(shouldHideAssistant = true) {
  console.log("[carousel] Executando minimizeCarousel()", {
    shouldHideAssistant,
  });

  const assistantMessages = document.getElementById("assistant-messages");
  if (!assistantMessages) return;

  // Limpar o estado do carrossel
  clearCarouselState();

  // IMPORTANTE: Sinalizar que o carrossel foi minimizado explicitamente
  localStorage.setItem("carouselForciblyMinimized", "true");

  // Remover classe que controla a exibição do carrossel
  assistantMessages.classList.remove("showing-carousel");

  // Remover quaisquer alturas fixas definidas por JavaScript
  assistantMessages.style.height = "";

  // Obter a área de mensagens
  const messagesArea = assistantMessages.querySelector(".messages-area");
  if (!messagesArea) return;

  // Remover o carrossel
  const carouselContainer = messagesArea.querySelector(".carousel-container");
  if (carouselContainer) {
    carouselContainer.remove();
    console.log("[carousel] Carrossel removido do DOM");
  }

  // Restaurar a altura padrão do assistente
  assistantMessages.style.height = "";
  messagesArea.style.height = "";

  // Adicionar mensagem padrão para não deixar o assistente vazio
  const defaultMessage = document.createElement("div");
  defaultMessage.classList.add("message", "assistant");
  defaultMessage.textContent =
    "O que mais gostaria de saber sobre Morro de São Paulo?";
  messagesArea.appendChild(defaultMessage);
  console.log("[carousel] Mensagem padrão adicionada após fechar carrossel");

  // Se shouldHideAssistant for true, esconde também o assistente
  if (shouldHideAssistant) {
    console.log("[carousel] Escondendo também o modal do assistente");
    assistantMessages.classList.add("hidden");

    // Notificar que o assistente foi minimizado
    document.dispatchEvent(new CustomEvent("assistantMinimized"));
  } else {
    // Se desejar, pode focar no input do assistente após minimizar
    const assistantInput = document.getElementById("assistantInput");
    if (assistantInput) {
      setTimeout(() => {
        assistantInput.focus();
      }, 100);
    }
  }

  // Retornar flag indicando sucesso
  return true;
}

// Adicionar esta função para sincronização de dimensões
export function syncCarouselDimensions() {
  const carouselContainers = document.querySelectorAll(".carousel-container"); // Adicionar o ponto

  carouselContainers.forEach((container) => {
    // Garantir que o Swiper está inicializado corretamente
    const swiperContainer = container.querySelector(".swiper-container");
    if (!swiperContainer) return;

    // Verificar se o Swiper já está inicializado
    let swiperInstance = swiperContainer.swiper;
    if (swiperInstance) {
      // Se já estiver inicializado, apenas atualizar
      swiperInstance.update();
    }

    // Adicionar efeito de carregamento nas imagens
    const images = container.querySelectorAll("img:not(.loaded)");
    images.forEach((img) => {
      if (img.complete) {
        img.classList.add("loaded");
      } else {
        img.onload = () => img.classList.add("loaded");
      }
    });
  });
}

const basePath = "images/fotos/"; // Caminho base para as imagens
const imageDatabase = {
  "Farol do Morro": [
    `${basePath}farol_do_morro1.jpg`,
    `${basePath}farol_do_morro2.jpg`,
    `${basePath}farol_do_morro3.jpg`,
  ],
  "Toca do Morcego": [
    `${basePath}toca_do_morcego1.jpg`,
    `${basePath}toca_do_morcego2.jpg`,
    `${basePath}toca_do_morcego3.jpg`,
  ],
  "Mirante da Tirolesa": [
    `${basePath}mirante_da_tirolesa1.jpg`,
    `${basePath}mirante_da_tirolesa2.jpg`,
    `${basePath}mirante_da_tirolesa3.jpg`,
  ],
  "Fortaleza de Morro de São Paulo": [
    `${basePath}fortaleza_de_morro1.jpg`,
    `${basePath}fortaleza_de_morro2.jpg`,
    `${basePath}fortaleza_de_morro3.jpg`,
  ],
  "Paredão da Argila": [
    `${basePath}paredao_da_argila1.jpg`,
    `${basePath}paredao_da_argila2.jpg`,
    `${basePath}paredao_da_argila3.jpg`,
  ],
  "Passeio de lancha Volta a Ilha de Tinharé": [
    `${basePath}passeio_lancha_ilha_tinhare1.jpg`,
    `${basePath}passeio_lancha_ilha_tinhare2.jpg`,
    `${basePath}passeio_lancha_ilha_tinhare3.jpg`,
  ],
  "Passeio de Quadriciclo para Garapuá": [
    `${basePath}passeio_quadriciclo_garapua1.jpg`,
    `${basePath}passeio_quadriciclo_garapua2.jpg`,
    `${basePath}passeio_quadriciclo_garapua3.jpg`,
  ],
  "Passeio 4X4 para Garapuá": [
    `${basePath}passeio_4x4_garapua1.jpg`,
    `${basePath}passeio_4x4_garapua2.jpg`,
    `${basePath}passeio_4x4_garapua3.jpg`,
  ],
  "Passeio de Barco para Gamboa": [
    `${basePath}passeio_barco_gamboa1.jpg`,
    `${basePath}passeio_barco_gamboa2.jpg`,
    `${basePath}passeio_barco_gamboa3.jpg`,
  ],
  "Primeira Praia": [
    `${basePath}primeira_praia1.jpg`,
    `${basePath}primeira_praia2.jpg`,
    `${basePath}primeira_praia3.jpg`,
  ],
  "Segunda Praia": [
    `${basePath}segunda_praia1.jpg`,
    `${basePath}segunda_praia2.jpg`,
    `${basePath}segunda_praia3.jpg`,
  ],
  "Terceira Praia": [
    `${basePath}terceira_praia1.jpg`,
    `${basePath}terceira_praia2.jpg`,
    `${basePath}terceira_praia3.jpg`,
  ],
  "Quarta Praia": [
    `${basePath}quarta_praia1.jpg`,
    `${basePath}quarta_praia2.jpg`,
    `${basePath}quarta_praia3.jpg`,
  ],
  "Praia do Encanto": [
    `${basePath}praia_do_encanto1.jpg`,
    `${basePath}praia_do_encanto2.jpg`,
    `${basePath}praia_do_encanto3.jpg`,
  ],
  "Praia do Pôrto": [
    `${basePath}praia_do_porto1.jpg`,
    `${basePath}praia_do_porto2.jpg`,
    `${basePath}praia_do_porto3.jpg`,
  ],
  "Praia da Gamboa": [
    `${basePath}praia_da_gamboa1.jpg`,
    `${basePath}praia_da_gamboa2.jpg`,
    `${basePath}praia_da_gamboa3.jpg`,
  ],
  "Toca do Morcego Festas": [
    `${basePath}toca_do_morcego_festas1.jpg`,
    `${basePath}toca_do_morcego_festas2.jpg`,
    `${basePath}toca_do_morcego_festas3.jpg`,
  ],
  "One Love": [
    `${basePath}one_love1.jpg`,
    `${basePath}one_love2.jpg`,
    `${basePath}one_love3.jpg`,
  ],
  Pulsar: [
    `${basePath}pulsar1.jpg`,
    `${basePath}pulsar2.jpg`,
    `${basePath}pulsar3.jpg`,
  ],
  "Mama Iate": [
    `${basePath}mama_iate1.jpg`,
    `${basePath}mama_iate2.jpg`,
    `${basePath}mama_iate3.jpg`,
  ],
  "Teatro do Morro": [
    `${basePath}teatro_do_morro1.jpg`,
    `${basePath}teatro_do_morro2.jpg`,
    `${basePath}teatro_do_morro3.jpg`,
  ],
  "Morena Bela": [
    `${basePath}morena_bela1.jpg`,
    `${basePath}morena_bela2.jpg`,
    `${basePath}morena_bela3.jpg`,
  ],
  Basílico: [
    `${basePath}basilico1.jpg`,
    `${basePath}basilico2.jpg`,
    `${basePath}basilico3.jpg`,
  ],
  "Ki Massa": [
    `${basePath}ki_massa1.jpg`,
    `${basePath}ki_massa2.jpg`,
    `${basePath}ki_massa3.jpg`,
  ],
  "Tempeiro Caseiro": [
    `${basePath}tempeiro_caseiro1.jpg`,
    `${basePath}tempeiro_caseiro2.jpg`,
    `${basePath}tempeiro_caseiro3.jpg`,
  ],
  Bizu: [
    `${basePath}bizu1.jpg`,
    `${basePath}bizu2.jpg`,
    `${basePath}bizu3.jpg`,
  ],
  "Pedra Sobre Pedra": [
    `${basePath}pedra_sobre_pedra1.jpg`,
    `${basePath}pedra_sobre_pedra2.jpg`,
    `${basePath}pedra_sobre_pedra3.jpg`,
  ],
  "Forno a Lenha de Mercedes": [
    `${basePath}forno_a_lenha1.jpg`,
    `${basePath}forno_a_lenha2.jpg`,
    `${basePath}forno_a_lenha3.jpg`,
  ],
  "Ponto G": [
    `${basePath}ponto_g1.jpg`,
    `${basePath}ponto_g2.jpg`,
    `${basePath}ponto_g3.jpg`,
  ],
  "Ponto 9,99": [
    `${basePath}ponto_9991.jpg`,
    `${basePath}ponto_9992.jpg`,
    `${basePath}ponto_9993.jpg`,
  ],
  Patricia: [
    `${basePath}patricia1.jpg`,
    `${basePath}patricia2.jpg`,
    `${basePath}patricia3.jpg`,
  ],
  "dizi 10": [
    `${basePath}dizi_101.jpg`,
    `${basePath}dizi_102.jpg`,
    `${basePath}dizi_103.jpg`,
  ],
  Papoula: [
    `${basePath}papoula1.jpg`,
    `${basePath}papoula2.jpg`,
    `${basePath}papoula3.jpg`,
  ],
  "Sabor da terra": [
    `${basePath}sabor_da_terra1.jpg`,
    `${basePath}sabor_da_terra2.jpg`,
    `${basePath}sabor_da_terra3.jpg`,
  ],
  "Branco&Negro": [
    `${basePath}branco_negro1.jpg`,
    `${basePath}branco_negro2.jpg`,
    `${basePath}branco_negro3.jpg`,
  ],
  "Six Club": [
    `${basePath}six_club1.jpg`,
    `${basePath}six_club2.jpg`,
    `${basePath}six_club3.jpg`,
  ],
  "Santa Villa": [
    `${basePath}santa_villa1.jpg`,
    `${basePath}santa_villa2.jpg`,
    `${basePath}santa_villa3.jpg`,
  ],
  "Recanto do Aviador": [
    `${basePath}recanto_do_aviador1.jpg`,
    `${basePath}recanto_do_aviador2.jpg`,
    `${basePath}recanto_do_aviador3.jpg`,
  ],
  Sambass: [
    `${basePath}sambass1.jpg`,
    `${basePath}sambass2.jpg`,
    `${basePath}sambass3.jpg`,
  ],
  "Bar e Restaurante da Morena": [
    `${basePath}bar_restaurante_morena1.jpg`,
    `${basePath}bar_restaurante_morena2.jpg`,
    `${basePath}bar_restaurante_morena3.jpg`,
  ],
  "Restaurante Alecrim": [
    `${basePath}restaurante_alecrim1.jpg`,
    `${basePath}restaurante_alecrim2.jpg`,
    `${basePath}restaurante_alecrim3.jpg`,
  ],
  "Andina Cozinha Latina": [
    `${basePath}andina_cozinha_latina1.jpg`,
    `${basePath}andina_cozinha_latina2.jpg`,
    `${basePath}andina_cozinha_latina3.jpg`,
  ],
  "Papoula Culinária Artesanal": [
    `${basePath}papoula_culinaria_artesanal1.jpg`,
    `${basePath}papoula_culinaria_artesanal2.jpg`,
    `${basePath}papoula_culinaria_artesanal3.jpg`,
  ],
  "Minha Louca Paixão": [
    `${basePath}minha_louca_paixao1.jpg`,
    `${basePath}minha_louca_paixao2.jpg`,
    `${basePath}minha_louca_paixao3.jpg`,
  ],
  "Café das Artes": [
    `${basePath}cafe_das_artes1.jpg`,
    `${basePath}cafe_das_artes2.jpg`,
    `${basePath}cafe_das_artes3.jpg`,
  ],
  Canoa: [
    `${basePath}canoa1.jpg`,
    `${basePath}canoa2.jpg`,
    `${basePath}canoa3.jpg`,
  ],
  "Restaurante do Francisco": [
    `${basePath}restaurante_francisco1.jpg`,
    `${basePath}restaurante_francisco2.jpg`,
    `${basePath}restaurante_francisco3.jpg`,
  ],
  "La Tabla": [
    `${basePath}la_tabla1.jpg`,
    `${basePath}la_tabla2.jpg`,
    `${basePath}la_tabla3.jpg`,
  ],
  "Santa Luzia": [
    `${basePath}santa_luzia1.jpg`,
    `${basePath}santa_luzia2.jpg`,
    `${basePath}santa_luzia3.jpg`,
  ],
  "Chez Max": [
    `${basePath}chez_max1.jpg`,
    `${basePath}chez_max2.jpg`,
    `${basePath}chez_max3.jpg`,
  ],
  "Barraca da Miriam": [
    `${basePath}barraca_miriam1.jpg`,
    `${basePath}barraca_miriam2.jpg`,
    `${basePath}barraca_miriam3.jpg`,
  ],
  "O Casarão restaurante": [
    `${basePath}casarao_restaurante1.jpg`,
    `${basePath}casarao_restaurante2.jpg`,
    `${basePath}casarao_restaurante3.jpg`,
  ],
  "Hotel Fazenda Parque Vila": [
    `${basePath}hotel_fazenda_parque_vila1.jpg`,
    `${basePath}hotel_fazenda_parque_vila2.jpg`,
    `${basePath}hotel_fazenda_parque_vila3.jpg`,
  ],
  Guaiamu: [
    `${basePath}guaiamu1.jpg`,
    `${basePath}guaiamu2.jpg`,
    `${basePath}guaiamu3.jpg`,
  ],
  "Pousada Fazenda Caeiras": [
    `${basePath}pousada_fazenda_caeiras1.jpg`,
    `${basePath}pousada_fazenda_caeiras2.jpg`,
    `${basePath}pousada_fazenda_caeiras3.jpg`,
  ],
  "Amendoeira Hotel": [
    `${basePath}amendoeira_hotel1.jpg`,
    `${basePath}amendoeira_hotel2.jpg`,
    `${basePath}amendoeira_hotel3.jpg`,
  ],
  "Pousada Natureza": [
    `${basePath}pousada_natureza1.jpg`,
    `${basePath}pousada_natureza2.jpg`,
    `${basePath}pousada_natureza3.jpg`,
  ],
  "Pousada dos Pássaros": [
    `${basePath}pousada_dos_passaros1.jpg`,
    `${basePath}pousada_dos_passaros2.jpg`,
    `${basePath}pousada_dos_passaros3.jpg`,
  ],
  "Hotel Morro de São Paulo": [
    `${basePath}hotel_morro_sao_paulo1.jpg`,
    `${basePath}hotel_morro_sao_paulo2.jpg`,
    `${basePath}hotel_morro_sao_paulo3.jpg`,
  ],
  "Uma Janela para o Sol": [
    `${basePath}uma_janela_para_sol1.jpg`,
    `${basePath}uma_janela_para_sol2.jpg`,
    `${basePath}uma_janela_para_sol3.jpg`,
  ],
  Portaló: [
    `${basePath}portalo1.jpg`,
    `${basePath}portalo2.jpg`,
    `${basePath}portalo3.jpg`,
  ],
  "Pérola do Morro": [
    `${basePath}perola_do_morro1.jpg`,
    `${basePath}perola_do_morro2.jpg`,
    `${basePath}perola_do_morro3.jpg`,
  ],
  "Safira do Morro": [
    `${basePath}safira_do_morro1.jpg`,
    `${basePath}safira_do_morro2.jpg`,
    `${basePath}safira_do_morro3.jpg`,
  ],
  "Xerife Hotel": [
    `${basePath}xerife_hotel1.jpg`,
    `${basePath}xerife_hotel2.jpg`,
    `${basePath}xerife_hotel3.jpg`,
  ],
  "Ilha da Saudade": [
    `${basePath}ilha_da_saudade1.jpg`,
    `${basePath}ilha_da_saudade2.jpg`,
    `${basePath}ilha_da_saudade3.jpg`,
  ],
  "Porto dos Milagres": [
    `${basePath}porto_dos_milagres1.jpg`,
    `${basePath}porto_dos_milagres2.jpg`,
    `${basePath}porto_dos_milagres3.jpg`,
  ],
  Passarte: [
    `${basePath}passarte1.jpg`,
    `${basePath}passarte2.jpg`,
    `${basePath}passarte3.jpg`,
  ],
  "Pousada da Praça": [
    `${basePath}pousada_da_praca1.jpg`,
    `${basePath}pousada_da_praca2.jpg`,
    `${basePath}pousada_da_praca3.jpg`,
  ],
  "Pousada Colibri": [
    `${basePath}pousada_colibri1.jpg`,
    `${basePath}pousada_colibri2.jpg`,
    `${basePath}pousada_colibri3.jpg`,
  ],
  "Pousada Porto de Cima": [
    `${basePath}pousada_porto_de_cima1.jpg`,
    `${basePath}pousada_porto_de_cima2.jpg`,
    `${basePath}pousada_porto_de_cima3.jpg`,
  ],
  "Vila Guaiamu": [
    `${basePath}vila_guaiamu1.jpg`,
    `${basePath}vila_guaiamu2.jpg`,
    `${basePath}vila_guaiamu3.jpg`,
  ],
  "Villa dos Corais pousada": [
    `${basePath}villa_dos_corais1.jpg`,
    `${basePath}villa_dos_corais2.jpg`,
    `${basePath}villa_dos_corais3.jpg`,
  ],
  "Hotel Anima": [
    `${basePath}hotel_anima1.jpg`,
    `${basePath}hotel_anima2.jpg`,
    `${basePath}hotel_anima3.jpg`,
  ],
  "Vila dos Orixás Boutique Hotel & Spa": [
    `${basePath}vila_dos_orixas1.jpg`,
    `${basePath}vila_dos_orixas2.jpg`,
    `${basePath}vila_dos_orixas3.jpg`,
  ],
  "Hotel Karapitangui": [
    `${basePath}hotel_karapitangui1.jpg`,
    `${basePath}hotel_karapitangui2.jpg`,
    `${basePath}hotel_karapitangui3.jpg`,
  ],
  "Pousada Timbalada": [
    `${basePath}pousada_timbalada1.jpg`,
    `${basePath}pousada_timbalada2.jpg`,
    `${basePath}pousada_timbalada3.jpg`,
  ],
  "Casa Celestino Residence": [
    `${basePath}casa_celestino_residence1.jpg`,
    `${basePath}casa_celestino_residence2.jpg`,
    `${basePath}casa_celestino_residence3.jpg`,
  ],
  "Bahia Bacana Pousada": [
    `${basePath}bahia_bacana_pousada1.jpg`,
    `${basePath}bahia_bacana_pousada2.jpg`,
    `${basePath}bahia_bacana_pousada3.jpg`,
  ],
  "Hotel Morro da Saudade": [
    `${basePath}hotel_morro_da_saudade1.jpg`,
    `${basePath}hotel_morro_da_saudade2.jpg`,
    `${basePath}hotel_morro_da_saudade3.jpg`,
  ],
  "Bangalô dos sonhos": [
    `${basePath}bangalo_dos_sonhos1.jpg`,
    `${basePath}bangalo_dos_sonhos2.jpg`,
    `${basePath}bangalo_dos_sonhos3.jpg`,
  ],
  "Cantinho da Josete": [
    `${basePath}cantinho_da_josete1.jpg`,
    `${basePath}cantinho_da_josete2.jpg`,
    `${basePath}cantinho_da_josete3.jpg`,
  ],
  "Vila Morro do Sao Paulo": [
    `${basePath}vila_morro_sao_paulo1.jpg`,
    `${basePath}vila_morro_sao_paulo2.jpg`,
    `${basePath}vila_morro_sao_paulo3.jpg`,
  ],
  "Casa Rossa": [
    `${basePath}casa_rossa1.jpg`,
    `${basePath}casa_rossa2.jpg`,
    `${basePath}casa_rossa3.jpg`,
  ],
  "Village Paraíso Tropical": [
    `${basePath}village_paraiso_tropical1.jpg`,
    `${basePath}village_paraiso_tropical2.jpg`,
    `${basePath}village_paraiso_tropical3.jpg`,
  ],
  Absolute: [
    `${basePath}absolute1.jpg`,
    `${basePath}absolute2.jpg`,
    `${basePath}absolute3.jpg`,
  ],
  "Local Brasil": [
    `${basePath}local_brasil1.jpg`,
    `${basePath}local_brasil2.jpg`,
    `${basePath}local_brasil3.jpg`,
  ],
  "Super Zimbo": [
    `${basePath}super_zimbo1.jpg`,
    `${basePath}super_zimbo2.jpg`,
    `${basePath}super_zimbo3.jpg`,
  ],
  "Mateus Esquadrais": [
    `${basePath}mateus_esquadrais1.jpg`,
    `${basePath}mateus_esquadrais2.jpg`,
    `${basePath}mateus_esquadrais3.jpg`,
  ],
  "São Pedro Imobiliária": [
    `${basePath}sao_pedro_imobiliaria1.jpg`,
    `${basePath}sao_pedro_imobiliaria2.jpg`,
    `${basePath}sao_pedro_imobiliaria3.jpg`,
  ],
  "Imóveis Brasil Bahia": [
    `${basePath}imoveis_brasil_bahia1.jpg`,
    `${basePath}imoveis_brasil_bahia2.jpg`,
    `${basePath}imoveis_brasil_bahia3.jpg`,
  ],
  Coruja: [
    `${basePath}coruja1.jpg`,
    `${basePath}coruja2.jpg`,
    `${basePath}coruja3.jpg`,
  ],
  "Zimbo Dive": [
    `${basePath}zimbo_dive1.jpg`,
    `${basePath}zimbo_dive2.jpg`,
    `${basePath}zimbo_dive3.jpg`,
  ],
  Havaianas: [
    `${basePath}havaianas1.jpg`,
    `${basePath}havaianas2.jpg`,
    `${basePath}havaianas3.jpg`,
  ],
  Ambulância: [
    `${basePath}ambulancia1.jpg`,
    `${basePath}ambulancia2.jpg`,
    `${basePath}ambulancia3.jpg`,
  ],
  "Unidade de Saúde": [
    `${basePath}unidade_de_saude1.jpg`,
    `${basePath}unidade_de_saude2.jpg`,
    `${basePath}unidade_de_saude3.jpg`,
  ],
  "Polícia Civil": [
    `${basePath}policia_civil1.jpg`,
    `${basePath}policia_civil2.jpg`,
    `${basePath}policia_civil3.jpg`,
  ],
  "Polícia Militar": [
    `${basePath}policia_militar1.jpg`,
    `${basePath}policia_militar2.jpg`,
    `${basePath}policia_militar3.jpg`,
  ],
  "Melhores Pontos Turísticos": [
    `${basePath}melhores_pontos_turisticos1.jpg`,
    `${basePath}melhores_pontos_turisticos2.jpg`,
    `${basePath}melhores_pontos_turisticos3.jpg`,
  ],
  "Melhores Passeios": [
    `${basePath}melhores_passeios1.jpg`,
    `${basePath}melhores_passeios2.jpg`,
    `${basePath}melhores_passeios3.jpg`,
  ],
  "Melhores Praias": [
    `${basePath}melhores_praias1.jpg`,
    `${basePath}melhores_praias2.jpg`,
    `${basePath}melhores_praias3.jpg`,
  ],
  "Melhores Restaurantes": [
    `${basePath}melhores_restaurantes1.jpg`,
    `${basePath}melhores_restaurantes2.jpg`,
    `${basePath}melhores_restaurantes3.jpg`,
  ],
  "Melhores Pousadas": [
    `${basePath}melhores_pousadas1.jpg`,
    `${basePath}melhores_pousadas2.jpg`,
    `${basePath}melhores_pousadas3.jpg`,
  ],
  "Melhores Lojas": [
    `${basePath}melhores_lojas1.jpg`,
    `${basePath}melhores_lojas2.jpg`,
    `${basePath}melhores_lojas3.jpg`,
  ],
  Missão: [
    `${basePath}missao1.jpg`,
    `${basePath}missao2.jpg`,
    `${basePath}missao3.jpg`,
  ],
  Serviços: [
    `${basePath}servicos1.jpg`,
    `${basePath}servicos2.jpg`,
    `${basePath}servicos3.jpg`,
  ],
  "Benefícios para Turistas": [
    `${basePath}beneficios_turistas1.jpg`,
    `${basePath}beneficios_turistas2.jpg`,
    `${basePath}beneficios_turistas3.jpg`,
  ],
  "Benefícios para Moradores": [
    `${basePath}beneficios_moradores1.jpg`,
    `${basePath}beneficios_moradores2.jpg`,
    `${basePath}beneficios_moradores3.jpg`,
  ],
  "Benefícios para Pousadas": [
    `${basePath}beneficios_pousadas1.jpg`,
    `${basePath}beneficios_pousadas2.jpg`,
    `${basePath}beneficios_pousadas3.jpg`,
  ],
  "Benefícios para Restaurantes": [
    `${basePath}beneficios_restaurantes1.jpg`,
    `${basePath}beneficios_restaurantes2.jpg`,
    `${basePath}beneficios_restaurantes3.jpg`,
  ],
  "Benefícios para Agências de Turismo": [
    `${basePath}beneficios_agencias_turismo1.jpg`,
    `${basePath}beneficios_agencias_turismo2.jpg`,
    `${basePath}beneficios_agencias_turismo3.jpg`,
  ],
  "Benefícios para Lojas e Comércios": [
    `${basePath}beneficios_lojas_comercios1.jpg`,
    `${basePath}beneficios_lojas_comercios2.jpg`,
    `${basePath}beneficios_lojas_comercios3.jpg`,
  ],
  "Benefícios para Transportes": [
    `${basePath}beneficios_transportes1.jpg`,
    `${basePath}beneficios_transportes2.jpg`,
    `${basePath}beneficios_transportes3.jpg`,
  ],
  "Impacto em MSP": [
    `${basePath}impacto_msp1.jpg`,
    `${basePath}impacto_msp2.jpg`,
    `${basePath}impacto_msp3.jpg`,
  ],
  "Iniciar Tutorial": [
    `${basePath}iniciar_tutorial1.jpg`,
    `${basePath}iniciar_tutorial2.jpg`,
    `${basePath}iniciar_tutorial3.jpg`,
  ],
  "Planejar Viagem com IA": [
    `${basePath}planejar_viagem_ia1.jpg`,
    `${basePath}planejar_viagem_ia2.jpg`,
    `${basePath}planejar_viagem_ia3.jpg`,
  ],
  "Falar com IA": [
    `${basePath}falar_com_ia1.jpg`,
    `${basePath}falar_com_ia2.jpg`,
    `${basePath}falar_com_ia3.jpg`,
  ],
  "Falar com Suporte": [
    `${basePath}falar_com_suporte1.jpg`,
    `${basePath}falar_com_suporte2.jpg`,
    `${basePath}falar_com_suporte3.jpg`,
  ],
  Configurações: [
    `${basePath}configuracoes1.jpg`,
    `${basePath}configuracoes2.jpg`,
    `${basePath}configuracoes3.jpg`,
  ],
};

// Crie o normalizedMap uma única vez, no topo do arquivo
const normalizedMap = {};
Object.keys(imageDatabase).forEach((key) => {
  normalizedMap[normalizeName(key)] = imageDatabase[key];
});

/**
 * closeCarouselModal - Fecha o modal do carrossel.
 */
export function closeCarouselModal() {
  const carouselModal = document.getElementById("carousel-modal");
  if (carouselModal) {
    carouselModal.style.display = "none";
    carouselModal.classList.add("hidden"); // Adiciona a classe 'hidden' novamente
  }
}

// Adiciona o evento de clique para fechar o modal (só se o elemento existir)
const closeBtn = document.getElementById("carousel-modal-close");
if (closeBtn) {
  closeBtn.addEventListener("click", closeCarouselModal);
}

// Adicionar função para inserir mensagem de seguimento sem espaços
export function addFollowUpMessage(text, parentContainer) {
  // Verificar se já existe mensagem de seguimento e removê-la
  const existingFollowUp = parentContainer.querySelector(".carousel-follow-up");
  if (existingFollowUp) {
    existingFollowUp.remove();
  }

  const followUpMsg = document.createElement("div");
  followUpMsg.className = "message assistant carousel-follow-up";
  followUpMsg.textContent = text;

  // Inserir imediatamente após o container do carrossel
  parentContainer.appendChild(followUpMsg);
}
