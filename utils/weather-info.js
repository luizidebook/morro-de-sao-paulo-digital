/**
 * Sistema de informações de clima e maré para o Mapa Morro Digital
 */

// Importar o sistema de tradução
import {
  getGeneralText,
  formatText,
  currentLang,
} from "../i18n/translatePageContent.js";

const VC_API_KEY = "CVF62BGYYXRNK2Y8AZT7RQEM8";
const VC_BASE_URL =
  "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline";
const LAT = -13.3769; // Morro de São Paulo
const LON = -38.9146;
const WORLDTIDES_API_KEY = "3ff9fcc7-0482-419f-a597-677df609592d"; // Substitua pela sua chave

// Verificação para garantir que o mapa foi carregado antes de adicionar o widget
export async function showWeatherWidget() {
  // Aguardar a renderização do mapa
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const weatherWidget = document.createElement("div");
  weatherWidget.id = "weather-widget";
  weatherWidget.className = "weather-widget compact";
  const mapContainer = document.getElementById("map-container");

  // Log para depuração
  console.log("[showWeatherWidget] Procurando map-container:", mapContainer);

  if (!mapContainer) {
    console.error("[showWeatherWidget] Elemento map-container não encontrado");
    // Tentar adicionar ao body como fallback
    document.body.appendChild(weatherWidget);
  } else {
    mapContainer.appendChild(weatherWidget);
  }

  // Atualizar widget periodicamente a cada 10 minutos
  await updateWidget(); // Executa imediatamente na primeira vez
  setInterval(updateWidget, 10 * 60 * 1000);

  // Adicionar listener para o evento de mudança de idioma
  document.addEventListener("languageChanged", async (e) => {
    console.log("[weather-info.js] Idioma alterado, atualizando widget...");
    await updateWidget();
  });

  // Expande ao clicar
  weatherWidget.addEventListener("click", function () {
    console.log(
      "[showWeatherWidget] Widget clicado, exibindo previsão completa"
    );
    showFullForecast(weatherWidget._current, weatherWidget._forecast);
  });

  async function updateWidget() {
    try {
      console.log("[showWeatherWidget] Atualizando widget...");
      const { current, forecast } = await fetchVisualCrossingWeather();
      console.log("[showWeatherWidget] Dados obtidos:", current);

      let iconClass = getWeatherIconClass(current);
      let emoji = getWeatherEmoji(current);

      // Obter o texto traduzido para "Clique aqui" no idioma atual
      const clickHereText = getGeneralText("weather_click_here");

      weatherWidget.innerHTML = `
        <div class="weather-compact-main">
          <div class="weather-emoji">${emoji}</div>
          <span class="weather-temp">${current.temp}°C</span>
          <div class="weather-compact-footer">
            <span class="click-here-text">${clickHereText}</span>
          </div>
        </div>
      `;
      weatherWidget._current = current;
      weatherWidget._forecast = forecast;
    } catch (e) {
      console.error("[showWeatherWidget] Erro ao atualizar widget:", e);
      const errorText = getGeneralText("weather_update_error");
      weatherWidget.innerHTML = `<div class="weather-error">${errorText}</div>`;
    }
  }
}

/**
 * Mapeia condições meteorológicas para classes de ícones
 */
function getWeatherIconClass(weatherData) {
  if (!weatherData || !weatherData.condition) {
    return "wi-day-sunny"; // Ícone padrão se não houver dados
  }

  // Detecta dia/noite
  let isDay = true;
  if (typeof weatherData.isDay !== "undefined") {
    isDay = weatherData.isDay;
  } else {
    const hour = new Date().getHours();
    isDay = hour >= 6 && hour < 18;
  }

  const cond = weatherData.condition.toLowerCase();

  // Mapeamento de condições para ícones
  if (cond.includes("thunder"))
    return isDay ? "wi-day-thunderstorm" : "wi-night-alt-thunderstorm";
  if (cond.includes("rain") && cond.includes("heavy"))
    return isDay ? "wi-day-rain" : "wi-night-alt-rain";
  if (cond.includes("rain") || cond.includes("drizzle"))
    return isDay ? "wi-day-showers" : "wi-night-alt-showers";
  if (cond.includes("snow")) return isDay ? "wi-day-snow" : "wi-night-alt-snow";
  if (cond.includes("sleet"))
    return isDay ? "wi-day-sleet" : "wi-night-alt-sleet";
  if (cond.includes("fog") || cond.includes("mist"))
    return isDay ? "wi-day-fog" : "wi-night-fog";
  if (cond.includes("cloud"))
    return isDay ? "wi-day-cloudy" : "wi-night-alt-cloudy";
  if (cond.includes("partly cloudy"))
    return isDay ? "wi-day-cloudy" : "wi-night-alt-cloudy";
  if (cond.includes("clear")) return isDay ? "wi-day-sunny" : "wi-night-clear";

  // Retorna ícone genérico para o dia ou noite
  return isDay ? "wi-day-sunny" : "wi-night-clear";
}

// Correção na função showFullForecast
async function showFullForecast(current, forecast) {
  // Verificar se temos dados meteorológicos válidos logo no início
  if (
    !current ||
    !forecast ||
    !Array.isArray(forecast) ||
    forecast.length === 0
  ) {
    console.error("Dados meteorológicos ausentes ou inválidos");
    alert(getGeneralText("weather_error_fetch"));
    return;
  }

  // Buscar marés - com tratamento de erro melhorado
  let tides = [];
  try {
    console.log("Iniciando busca de marés...");
    tides = await fetchWorldTidesTides();
    console.log(`Dados de marés obtidos: ${tides.length} registros`);
  } catch (e) {
    console.error("Erro ao buscar marés:", e);
    console.log("Usando dados simulados de maré devido a erro");
    tides = generateSimulatedTides();
  }

  // Garantir que temos marés, mesmo que seja dados simulados
  if (!tides || !Array.isArray(tides) || tides.length === 0) {
    console.warn("Nenhum dado de maré disponível, gerando dados simulados");
    tides = generateSimulatedTides();
  }

  // Organizar as marés por dia
  console.log("Organizando marés por dia...");
  const tidesByDay = organizeTidesByDay(tides);

  // Obter data atual de forma confiável
  const today = new Date();
  const todayISODate = today.toISOString().split("T")[0];

  // Formatar a data atual para exibição no idioma atual
  const formattedDate = formatDateForDisplay(today);

  // Índice da semana para o dia atual (0 = domingo, 1 = segunda, etc)
  const currentDayOfWeek = today.getDay();

  // IMPORTANTE: Não reordenamos os dias - mantemos a ordem natural de calendar
  // Criar array de dias ordenados para exibição, começando pelo dia atual
  const allDays = [];

  // Adicionar o dia atual primeiro para processar os dados
  const currentDayData = {
    date: todayISODate,
    high: Math.max(current.temp + 2, forecast[0]?.high || current.temp + 4),
    low: Math.min(current.temp - 2, forecast[0]?.low || current.temp - 4),
    condition: current.condition,
    current: true,
    temp: current.temp,
    humidity: current.humidity,
    wind: current.wind || 5,
    precipprob: current.precipprob || forecast[0]?.precipprob || 0,
    hourlyTemp: forecast[0]?.hourlyTemp || generateHourlyTempData(current.temp),
    description: translateWeatherCondition(current.condition),
    dayOfWeek: currentDayOfWeek,
  };

  allDays.push(currentDayData);

  // Criar um mapa dos dias da previsão por data
  const forecastByDate = {};
  forecast.forEach((day) => {
    const date = new Date(day.date);
    forecastByDate[day.date] = {
      ...day,
      temp: Math.round((day.high + day.low) / 2),
      humidity: day.humidity || 70 + Math.round(Math.random() * 20),
      wind: day.wind || 5 + Math.round(Math.random() * 15),
      precipprob: day.precipprob || 0,
      hourlyTemp:
        day.hourlyTemp ||
        generateHourlyTempData(
          Math.round((day.high + day.low) / 2),
          day.high,
          day.low
        ),
      description: day.description || translateWeatherCondition(day.condition),
      dayOfWeek: date.getDay(),
    };
  });

  // Adicionar os próximos 6 dias na ordem natural do calendário
  for (let i = 1; i <= 6; i++) {
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + i);
    const nextDateStr = nextDate.toISOString().split("T")[0];
    const nextDayOfWeek = nextDate.getDay();

    // Verifica se temos dados de previsão para esta data
    if (forecastByDate[nextDateStr]) {
      allDays.push(forecastByDate[nextDateStr]);
    } else {
      // Criar dia simulado baseado no último dia
      const lastDay = allDays[allDays.length - 1];
      allDays.push({
        date: nextDateStr,
        high: lastDay.high + Math.floor(Math.random() * 3) - 1,
        low: lastDay.low + Math.floor(Math.random() * 3) - 1,
        condition: lastDay.condition,
        temp: lastDay.temp,
        humidity: lastDay.humidity,
        wind: lastDay.wind,
        precipprob: lastDay.precipprob,
        hourlyTemp: generateHourlyTempData(
          lastDay.temp,
          lastDay.high + Math.floor(Math.random() * 2),
          lastDay.low - Math.floor(Math.random() * 2)
        ),
        description: lastDay.description,
        dayOfWeek: nextDayOfWeek,
      });
    }
  }

  // Importante: Após ordenar, encontrar o índice do dia atual usando data exata
  const todayIndex = allDays.findIndex((day) => {
    return day.date === todayISODate;
  });

  // Verificar se encontramos o dia atual
  if (todayIndex === -1) {
    console.error("Dia atual não encontrado na previsão!");
  }

  console.log("Hoje é:", todayISODate, "Índice encontrado:", todayIndex);

  // Obter dados de maré para o dia atual
  const todayTides = tidesByDay[todayISODate] || [];

  // Extrair informações relevantes de marés para o dia atual
  const tideInfo = extractTideInfo(todayTides);

  // Resto do código usando allDays para criar o modalHTML - com tradução
  let modalHTML = `
  <div class="forecast-header">
    <h4>Morro de São Paulo</h4>
    <button class="forecast-close-btn">&times;</button>
  </div>
  
  <div class="weather-forecast-modal-content">
    <div class="current-weather">
      <div class="current-weather-main">
        <div class="current-emoji">${getWeatherEmoji(currentDayData)}</div>
        <div class="current-temp">${currentDayData.temp}°</div>
      </div>
      <div class="day-full-date">${formattedDate}</div>
      <div class="current-condition">${currentDayData.description}</div>
      
      <div class="day-conditions">
        <div class="condition-item">
          <span class="condition-label">${getGeneralText("weather_high")}</span>
          <span class="condition-value">${currentDayData.high}°C</span>
        </div>
        <div class="condition-item">
          <span class="condition-label">${getGeneralText("weather_low")}</span>
          <span class="condition-value">${currentDayData.low}°C</span>
        </div>
        <div class="condition-item">
          <span class="condition-label">${getGeneralText("weather_rain")}</span>
          <span class="condition-value" style="color: ${
            currentDayData.precipprob > 50 ? "#3e95cd" : "inherit"
          }">${currentDayData.precipprob || 0}%</span>
        </div>
        <div class="condition-item">
          <span class="condition-label">${getGeneralText(
            "weather_humidity"
          )}</span>
          <span class="condition-value">${currentDayData.humidity}%</span>
        </div>
        <div class="condition-item">
          <span class="condition-label">${getGeneralText("weather_wind")}</span>
          <span class="condition-value">${currentDayData.wind} ${getGeneralText(
    "weather_wind_unit"
  )}</span>
        </div>
        <div class="condition-item">
          <span class="condition-label">${getGeneralText(
            "weather_visibility"
          )}</span>
          <span class="condition-value">${getGeneralText(
            "weather_visibility_good"
          )}</span>
        </div>
      </div>
      
      <div class="day-tip">
        ${getWeatherTip(currentDayData)}
      </div>
    </div>

    <div class="day-selector">
      ${allDays
        .map((day, index) => {
          const date = new Date(day.date);
          const weekday = getTranslatedWeekday(date, "short");

          // Verifica SOMENTE pela data ISO, não pela posição
          const isCurrentDay = day.date === todayISODate;

          // Adiciona console log para debug
          if (isCurrentDay) {
            console.log("Dia marcado como atual:", weekday, day.date);
          }

          return `
          <div class="day-option ${
            isCurrentDay ? "active" : ""
          }" data-index="${index}" data-date="${day.date}">
            <div class="day-name">${weekday}</div>
            <div class="day-emoji">${getWeatherEmoji(day)}</div>
            <div class="day-temp">
              <span class="high-temp">${day.high}°</span>
              <span class="temp-separator">/</span>
              <span class="low-temp">${day.low}°</span>
            </div>
            ${
              isCurrentDay
                ? `<div class="current-day-indicator">${getGeneralText(
                    "weather_today"
                  )}</div>`
                : ""
            }
          </div>
        `;
        })
        .join("")}
    </div>

    <div class="temp-chart-container">
      <canvas id="tempChart"></canvas>
    </div>

    <div class="day-details-container"></div>
  </div>
`;

  // Renderiza o modal
  const forecastModal = document.createElement("div");
  forecastModal.id = "forecast-modal";
  forecastModal.className = "weather-forecast-modal";
  forecastModal.innerHTML = modalHTML;
  document.body.appendChild(forecastModal);

  console.log("Modal renderizado, atualizando detalhes do dia");

  // Adicionar debug para garantir que o todayIndex está correto
  console.log(
    `Atualizando detalhes para o dia ${
      allDays[todayIndex]?.date || "desconhecido"
    }`
  );

  // Cria os detalhes do dia selecionado, usando o todayIndex diretamente
  const selectedInitialDay =
    todayIndex !== -1 ? allDays[todayIndex] : allDays[0];
  updateDayDetails(forecastModal, selectedInitialDay, tidesByDay, true);

  console.log("Inicializando gráfico de temperatura");

  // Inicializa o gráfico de temperatura
  initTempChart(forecastModal, selectedInitialDay.hourlyTemp);

  // Adiciona eventos aos seletores de dia com verificação aprimorada
  const dayOptions = forecastModal.querySelectorAll(".day-option");
  dayOptions.forEach((option) => {
    option.addEventListener("click", () => {
      // Remove classe ativa de todos
      dayOptions.forEach((opt) => opt.classList.remove("active"));
      // Adiciona classe ativa ao selecionado
      option.classList.add("active");

      // Obtém o índice do dia selecionado
      const dayIndex = parseInt(option.dataset.index);
      const selectedDay = allDays[dayIndex];
      const selectedDate = option.dataset.date;

      // Verifica se é o dia atual comparando as datas diretamente
      const isCurrentDay = selectedDate === todayISODate;

      // Atualizar informações de marés para o dia selecionado
      const selectedTides = tidesByDay[selectedDate] || [];
      const selectedTideInfo = extractTideInfo(selectedTides);
      updateTideInfo(forecastModal, selectedTideInfo);

      // Atualiza detalhes e gráfico
      updateDayDetails(forecastModal, selectedDay, tidesByDay, isCurrentDay);
      initTempChart(forecastModal, selectedDay.hourlyTemp);
    });
  });

  // Fechar modal com melhor tratamento
  forecastModal.querySelector(".forecast-close-btn").onclick = () => {
    try {
      if (window.tempChart) {
        // Verifica se destroy é uma função antes de chamar
        if (typeof window.tempChart.destroy === "function") {
          window.tempChart.destroy();
        }
        window.tempChart = null;
      }
    } catch (e) {
      console.warn("Erro ao destruir gráfico:", e);
    }

    if (document.body.contains(forecastModal)) {
      document.body.removeChild(forecastModal);
    }
  };
}

/**
 * Gera uma dica baseada nas condições climáticas
 */
function getWeatherTip(weatherData) {
  if (!weatherData) return "";

  const cond = weatherData.condition?.toLowerCase() || "";
  const high = weatherData.high || 0;
  const low = weatherData.low || 0;
  const precipProb = weatherData.precipprob || 0;

  // Dicas baseadas na chuva
  if (precipProb >= 70) {
    if (cond.includes("thunder") || cond.includes("storm")) {
      return getGeneralText("weather_tip_storm");
    }
    return getGeneralText("weather_tip_heavy_rain");
  } else if (precipProb >= 40) {
    return getGeneralText("weather_tip_rain_chance");
  }

  // Dicas baseadas na temperatura
  if (high > 30) {
    return getGeneralText("weather_tip_hot");
  } else if (low < 15) {
    return getGeneralText("weather_tip_cool");
  }

  // Dicas baseadas na condição
  if (cond.includes("clear") || cond.includes("sunny")) {
    return getGeneralText("weather_tip_sunny");
  } else if (cond.includes("cloudy") || cond.includes("overcast")) {
    return getGeneralText("weather_tip_cloudy");
  } else if (cond.includes("fog") || cond.includes("mist")) {
    return getGeneralText("weather_tip_fog");
  }

  // Dica padrão
  return getGeneralText("weather_tip_default");
}

/**
 * Atualiza os detalhes do dia selecionado com todos os dados disponíveis
 */
function updateDayDetails(modal, dayData, tidesByDay, isCurrentDay = false) {
  // Verificação de segurança para garantir que dayData existe
  if (!dayData) {
    console.error("Dados do dia não disponíveis para atualização");
    return;
  }

  const container = modal.querySelector(".day-details-container");
  if (!container) {
    console.error("Container para detalhes do dia não encontrado");
    return;
  }

  // Obtém dados das marés do dia
  const dayTides = tidesByDay[dayData.date] || [];

  // Simplificar o HTML gerado - APENAS mostre a seção de marés com texto traduzido
  let detailsHTML = "";

  // SOMENTE adicionamos a seção de marés, sem duplicar as informações meteorológicas
  detailsHTML += `    
    <div class="tide-section">
      <h5>${getGeneralText("tide_forecast")}</h5>
      ${
        dayTides.length > 0
          ? formatTideGraph(dayTides)
          : `<p>${getGeneralText("tide_data_unavailable")}</p>`
      }
    </div>
  `;

  container.innerHTML = detailsHTML;

  // Atualizar também o emoji e descrição no topo se não for o dia atual
  if (!isCurrentDay) {
    const weatherDescription = translateWeatherCondition(dayData.condition);
    const currentEmoji = modal.querySelector(".current-emoji");
    const currentTemp = modal.querySelector(".current-temp");
    const currentCondition = modal.querySelector(".current-condition");
    const currentDate = modal.querySelector(".day-full-date");

    if (currentEmoji) currentEmoji.innerHTML = getWeatherEmoji(dayData);
    if (currentTemp) currentTemp.innerHTML = `${dayData.temp}°`;
    if (currentCondition) currentCondition.innerHTML = weatherDescription;

    // Atualizar a data no topo com o idioma correto
    if (currentDate) {
      const date = new Date(dayData.date);
      const formattedDate = formatDateForDisplay(date);
      currentDate.innerHTML = formattedDate;
    }

    // Atualizar também os valores nas condições do dia quando mudamos de dia
    const maxTemp = modal.querySelector(
      ".condition-item:nth-child(1) .condition-value"
    );
    const minTemp = modal.querySelector(
      ".condition-item:nth-child(2) .condition-value"
    );
    const rainChance = modal.querySelector(
      ".condition-item:nth-child(3) .condition-value"
    );
    const humidity = modal.querySelector(
      ".condition-item:nth-child(4) .condition-value"
    );
    const wind = modal.querySelector(
      ".condition-item:nth-child(5) .condition-value"
    );

    if (maxTemp) maxTemp.textContent = `${dayData.high}°C`;
    if (minTemp) minTemp.textContent = `${dayData.low}°C`;
    if (rainChance) {
      rainChance.textContent = `${dayData.precipprob || 0}%`;
      rainChance.style.color = dayData.precipprob > 50 ? "#3e95cd" : "inherit";
    }
    if (humidity) humidity.textContent = `${dayData.humidity}%`;
    if (wind)
      wind.textContent = `${dayData.wind} ${getGeneralText(
        "weather_wind_unit"
      )}`;
  }
}

/**
 * Gera dados de temperatura por hora para o gráfico
 */
function generateHourlyTempData(avgTemp, maxTemp = null, minTemp = null) {
  const hourlyData = [];
  const now = new Date();
  const startHour = 0; // Começa na hora 0 (meia-noite)

  // Usa max e min se fornecidos, ou estima com base na média
  const max = maxTemp || avgTemp + 4;
  const min = minTemp || avgTemp - 4;

  // Gera 24 pontos de dados (um para cada hora)
  for (let i = 0; i < 24; i++) {
    // Simula variação de temperatura ao longo do dia
    let tempVariation;

    if (i >= 6 && i <= 14) {
      // Manhã até tarde: subindo
      const progress = (i - 6) / 8;
      tempVariation = min + (max - min) * progress;
    } else if (i > 14 && i <= 20) {
      // Tarde até noite: descendo
      const progress = (i - 14) / 6;
      tempVariation = max - (max - (min + max) / 2) * progress;
    } else {
      // Noite até manhã: estável ou levemente descendo
      tempVariation = min + (max - min) * 0.2;
    }

    hourlyData.push({
      hour: i,
      temp: Math.round(tempVariation),
    });
  }

  return hourlyData;
}

/**
 * Implementação interna do gráfico de temperatura
 */
function initTempChart(modal, hourlyData) {
  const canvas = modal.querySelector("#tempChart");
  if (!canvas) {
    console.error("Canvas para o gráfico não encontrado");
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("Não foi possível obter contexto 2D do canvas");
    return;
  }

  // Destrói gráfico anterior se existir
  if (window.tempChart) {
    try {
      if (typeof window.tempChart.destroy === "function") {
        window.tempChart.destroy();
      }
    } catch (e) {
      console.warn("Falha ao destruir gráfico anterior:", e);
    }
    window.tempChart = null;
  }

  // Verifica se temos dados horários suficientes
  if (!hourlyData || hourlyData.length === 0) {
    console.error("Dados horários de temperatura não disponíveis");
    displayAlternativeTemperatureView(modal, generateHourlyTempData(22)); // Temperatura padrão de fallback
    return;
  }

  // Filtra os dados para exibir menos pontos em telas pequenas
  let filteredHours = hourlyData;
  if (window.innerWidth < 500) {
    // Em telas pequenas, mostra apenas a cada 3 horas
    filteredHours = hourlyData.filter((data, index) => index % 3 === 0);
  } else if (window.innerWidth < 768) {
    // Em telas médias, mostra apenas a cada 2 horas
    filteredHours = hourlyData.filter((data, index) => index % 2 === 0);
  }

  // Prepara dados para o gráfico
  const hours = filteredHours.map((d) => `${d.hour}:00`);
  const temps = filteredHours.map((d) => d.temp);

  // Determinar gradiente de cores baseado na temperatura
  const gradientColors = getTemperatureGradient(temps, ctx);

  console.log("Criando gráfico de temperatura com", temps.length, "pontos");

  try {
    // Cria o gráfico
    window.tempChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: hours,
        datasets: [
          {
            label: "Temperatura (°C)",
            data: temps,
            borderColor: "#FFA500",
            backgroundColor: gradientColors,
            borderWidth: window.innerWidth < 500 ? 2 : 3,
            fill: true,
            tension: 0.4,
            pointRadius: window.innerWidth < 500 ? 2 : 3,
            pointBackgroundColor: function (context) {
              const value = context.dataset.data[context.dataIndex];
              return value > 28
                ? "#FF6384"
                : value < 15
                ? "#36A2EB"
                : "#FFCE56";
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            backgroundColor: "rgba(0,0,0,0.7)",
            titleFont: {
              size: window.innerWidth < 500 ? 12 : 14,
            },
            bodyFont: {
              size: window.innerWidth < 500 ? 11 : 13,
            },
            callbacks: {
              title: function (tooltipItems) {
                return tooltipItems[0].label;
              },
              label: function (context) {
                const value = context.parsed.y;
                let feelingText = "";

                if (value >= 30) feelingText = " (Muito quente)";
                else if (value >= 25) feelingText = " (Quente)";
                else if (value >= 20) feelingText = " (Agradável)";
                else if (value >= 15) feelingText = " (Ameno)";
                else if (value >= 10) feelingText = " (Frio)";
                else feelingText = " (Muito frio)";

                return `${value}°C${feelingText}`;
              },
            },
          },
        },
        scales: {
          y: {
            min: Math.min(...temps) - 2,
            max: Math.max(...temps) + 2,
            ticks: {
              color: "#666",
              font: {
                size: window.innerWidth < 500 ? 10 : 12,
              },
              callback: function (value) {
                return value + "°";
              },
            },
            grid: {
              color: "rgba(0,0,0,0.05)",
            },
          },
          x: {
            ticks: {
              color: "#666",
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: window.innerWidth < 500 ? 6 : 8,
              font: {
                size: window.innerWidth < 500 ? 9 : 11,
              },
            },
            grid: {
              color: "rgba(0,0,0,0.05)",
            },
          },
        },
      },
    });
  } catch (e) {
    console.error("Erro ao criar gráfico:", e);
    displayAlternativeTemperatureView(modal, hourlyData);
  }
}

/**
 * Cria um gradiente de cores para a área do gráfico baseado na temperatura
 */
function getTemperatureGradient(temperatures, ctx) {
  if (!ctx) return "rgba(255, 165, 0, 0.1)";

  const minTemp = Math.min(...temperatures);
  const maxTemp = Math.max(...temperatures);
  const avgTemp = (minTemp + maxTemp) / 2;

  // Determinar cores baseadas na temperatura média
  let gradient;
  try {
    gradient = ctx.createLinearGradient(0, 0, 0, 200);

    if (avgTemp >= 28) {
      // Clima quente - vermelho/laranja
      gradient.addColorStop(0, "rgba(255, 99, 132, 0.5)");
      gradient.addColorStop(1, "rgba(255, 99, 132, 0.05)");
    } else if (avgTemp >= 20) {
      // Clima agradável - laranja/amarelo
      gradient.addColorStop(0, "rgba(255, 165, 0, 0.4)");
      gradient.addColorStop(1, "rgba(255, 165, 0, 0.05)");
    } else if (avgTemp >= 15) {
      // Clima ameno - amarelo/verde
      gradient.addColorStop(0, "rgba(255, 206, 86, 0.4)");
      gradient.addColorStop(1, "rgba(255, 206, 86, 0.05)");
    } else {
      // Clima frio - azul
      gradient.addColorStop(0, "rgba(54, 162, 235, 0.4)");
      gradient.addColorStop(1, "rgba(54, 162, 235, 0.05)");
    }
  } catch (e) {
    return "rgba(255, 165, 0, 0.1)";
  }

  return gradient;
}

/**
 * Exibe uma visualização alternativa da temperatura quando o gráfico falha
 */
function displayAlternativeTemperatureView(modal, hourlyData) {
  const container = modal.querySelector(".temp-chart-container");
  if (!container) return;

  // Verificação adicional para garantir que temos dados
  if (!hourlyData || !Array.isArray(hourlyData) || hourlyData.length === 0) {
    container.innerHTML = "<p>Dados de temperatura não disponíveis</p>";
    return;
  }

  // Limpa o contêiner
  container.innerHTML = "";

  // Cria uma tabela/visualização simples de temperaturas
  const tempView = document.createElement("div");
  tempView.className = "temp-table-view";

  // Filtra para mostrar apenas algumas horas
  const displayHours = hourlyData.filter((_, i) => i % 3 === 0);

  let tableHTML = `
    <div class="temp-table-header">Temperatura ao longo do dia</div>
    <div class="temp-table-container">
      <div class="temp-table-row temp-table-labels">
        ${displayHours
          .map((h) => `<div class="temp-hour">${h.hour}h</div>`)
          .join("")}
      </div>
      <div class="temp-table-row temp-table-values">
        ${displayHours
          .map((h) => `<div class="temp-value">${h.temp}°</div>`)
          .join("")}
      </div>
    </div>
  `;

  tempView.innerHTML = tableHTML;
  container.appendChild(tempView);

  // Adiciona estilos básicos para a visualização alternativa
  const style = document.createElement("style");
  style.textContent = `
    .temp-table-view {
      width: 100%;
      padding: 10px 0;
    }
    .temp-table-header {
      text-align: center;
      font-weight: 500;
      margin-bottom: 10px;
      color: #202124;
    }
    .temp-table-container {
      overflow-x: auto;
    }
    .temp-table-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
    }
    .temp-hour, .temp-value {
      flex: 1;
      text-align: center;
      min-width: 40px;
    }
    .temp-table-labels {
      color: #5f6368;
      font-size: 12px;
    }
    .temp-table-values {
      font-weight: 500;
      font-size: 14px;
      color: #FF8C00;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Formata as marés em um gráfico visual responsivo com textos traduzidos
 */
function formatTideGraph(tides) {
  if (!tides || tides.length === 0) {
    return `<p>${getGeneralText("tide_data_unavailable")}</p>`;
  }

  // Organiza as marés por tipo (alta/baixa)
  const highTides = tides.filter((tide) => tide.type === "high");
  const lowTides = tides.filter((tide) => tide.type === "low");

  let tideHTML = `
    <div class="tide-graph-container">
      <div class="tide-timeline">
        ${
          window.innerWidth < 480
            ? // Em telas pequenas, mostra apenas algumas horas
              [0, 6, 12, 18, 23]
                .map(
                  (i) =>
                    `<div class="tide-hour" style="left: ${(i / 24) * 100}%">${i
                      .toString()
                      .padStart(2, "0")}:00</div>`
                )
                .join("")
            : // Em telas maiores, mostra todas as horas pares
              Array.from({ length: 12 }, (_, i) => i * 2)
                .map(
                  (i) =>
                    `<div class="tide-hour" style="left: ${(i / 24) * 100}%">${i
                      .toString()
                      .padStart(2, "0")}:00</div>`
                )
                .join("")
        }
      </div>
      
      <div class="tide-visualization">
        ${renderTideMarkers(tides)}
      </div>
      
      <div class="tide-summary">
        <div class="tide-summary-item high">
          <span class="tide-summary-label">${getGeneralText("tide_high")}</span>
          <span class="tide-summary-times">
            ${formatTideSummaryTimes(tides, "high")}
          </span>
        </div>
        <div class="tide-summary-item low">
          <span class="tide-summary-label">${getGeneralText("tide_low")}</span>
          <span class="tide-summary-times">
            ${formatTideSummaryTimes(tides, "low")}
          </span>
        </div>
      </div>
    </div>
  `;

  return tideHTML;
}

/**
 * Renderiza marcadores de maré com posicionamento responsivo e textos traduzidos
 */
function renderTideMarkers(tides) {
  let markers = "";

  // Se não houver marés, retorne apenas a linha base
  if (!tides || tides.length === 0) {
    return `<div class="tide-line"></div>`;
  }

  // Encontra os valores mínimos e máximos para normalização
  const levels = tides.map((t) => parseFloat(t.level));
  const minLevel = Math.min(...levels);
  const maxLevel = Math.max(...levels);

  // Adiciona uma margem para evitar que os pontos fiquem colados nas bordas
  const range = Math.max(0.1, maxLevel - minLevel);

  // Limita o número de marcadores em telas pequenas
  let displayTides = tides;

  if (window.innerWidth < 480) {
    // Em telas pequenas, mostra apenas as marés extremas ou alguns pontos
    const extremeTides = tides.filter((tide) => tide.isExtreme);
    displayTides = extremeTides.length
      ? extremeTides
      : tides.filter((_, i) => i % 3 === 0).slice(0, 6);
  } else if (tides.length > 20) {
    // Em qualquer tela, se houver muitos pontos, filtra alguns
    displayTides = tides.filter((tide, i) => tide.isExtreme || i % 2 === 0);
  }

  displayTides.forEach((tide) => {
    // Calcula posição horizontal (hora) e vertical (nível)
    const timeMatch = tide.time.match(/(\d+):(\d+)/);
    if (!timeMatch) return;

    const hour = parseInt(timeMatch[1]);
    const minute = parseInt(timeMatch[2]);
    const position = ((hour * 60 + minute) / (24 * 60)) * 100;

    // Normaliza o nível entre 10-90% para melhor visualização
    const level = parseFloat(tide.level);
    const normalizedLevel =
      range === 0
        ? 50 // Se todos os níveis são iguais, coloca no meio
        : 10 + 80 * ((level - minLevel) / range);

    // Invertemos a posição vertical: valores maiores = mais altos no gráfico
    const bottomPosition = 100 - normalizedLevel;

    // Adiciona classe para telas pequenas
    const smallScreenClass = window.innerWidth < 480 ? " small-screen" : "";
    const extremeClass = tide.isExtreme ? " extreme" : "";

    // Traduzir o tipo de maré para o título
    const tideTypeTranslated =
      tide.type === "high"
        ? getGeneralText("tide_high_single")
        : getGeneralText("tide_low_single");

    markers += `
      <div class="tide-marker ${tide.type}${smallScreenClass}${extremeClass}" 
           style="left: ${position}%; bottom: ${bottomPosition}%;"
           title="${tide.time} - ${level}m - ${tideTypeTranslated}">
        <div class="tide-dot"></div>
        <div class="tide-label">${
          window.innerWidth < 400 ? "" : tide.time
        }</div>
      </div>
    `;
  });

  return `
    <div class="tide-line"></div>
    ${markers}
  `;
}

/**
 * Formata o resumo das marés com tradução
 */
function formatTideSummaryTimes(tides, type) {
  if (!tides || tides.length === 0) {
    return getGeneralText("not_available");
  }

  const filteredTides = tides.filter((t) => t.type === type);

  if (filteredTides.length === 0) {
    return getGeneralText("not_available");
  }

  // Em telas muito pequenas, mostra apenas os horários sem os níveis
  if (window.innerWidth < 360) {
    return filteredTides.map((t) => t.time).join(", ");
  }

  // Em telas pequenas, limita o número de marés exibidas
  if (window.innerWidth < 480 && filteredTides.length > 2) {
    return filteredTides
      .slice(0, 2)
      .map((t) => `${t.time} (${t.level}m)`)
      .join(", ");
  }

  return filteredTides.map((t) => `${t.time} (${t.level}m)`).join(", ");
}

/**
 * Retorna descrição em português da condição meteorológica
 */
function getWeatherDescription(condition) {
  if (!condition) return "Sem informações";

  const cond = condition.toLowerCase();

  if (cond.includes("thunderstorm")) return "Tempestades com trovoadas";

  if (cond.includes("rain") && cond.includes("thunder"))
    return "Tempestades com chuva";

  if (cond.includes("heavy rain")) return "Chuva forte";

  if (cond.includes("light rain") || cond.includes("drizzle"))
    return "Chuva leve";

  if (cond.includes("rain")) return "Chuva";

  if (cond.includes("shower")) return "Pancadas de chuva";

  if (cond.includes("partly cloudy")) return "Parcialmente nublado";

  if (cond.includes("mostly cloudy")) return "Majoritariamente nublado";

  if (cond.includes("overcast")) return "Encoberto";

  if (cond.includes("cloudy")) return "Nublado";

  if (cond.includes("fog") || cond.includes("mist")) return "Névoa ou neblina";

  if (cond.includes("clear") || cond.includes("sunny")) return "Céu limpo";

  if (cond.includes("snow")) return "Neve";

  if (cond.includes("hail")) return "Granizo";

  if (cond.includes("sleet")) return "Aguaneve";

  if (cond.includes("fair")) return "Bom tempo";

  // Retorna a própria condição como fallback
  return condition;
}

/**
 * Organiza as marés por dia
  if (cond.includes("snow")) return "Neve";

  if (cond.includes("hail")) return "Granizo";

  if (cond.includes("sleet")) return "Aguaneve";

  if (cond.includes("fair")) return "Bom tempo";

  // Retorna a própria condição como fallback
  return condition;
}

/**
 * Organiza as marés por dia
 */
function organizeTidesByDay(tides) {
  const tidesByDay = {};

  if (!tides || !Array.isArray(tides) || tides.length === 0) {
    console.warn("Nenhum dado de maré para organizar");
    return tidesByDay;
  }

  tides.forEach((tide) => {
    if (!tide || !tide.timestamp) {
      console.warn("Maré sem timestamp:", tide);
      return;
    }

    const tideDate = new Date(tide.timestamp);
    const dateKey = tideDate.toISOString().split("T")[0]; // YYYY-MM-DD

    if (!tidesByDay[dateKey]) {
      tidesByDay[dateKey] = [];
    }

    tidesByDay[dateKey].push(tide);
  });

  return tidesByDay;
}

/**
 * Formata a previsão das marés para exibição
 */
function formatTideForecast(tides) {
  if (!tides || tides.length === 0) {
    return "";
  }

  return `
    <div class="tides-container">
      ${tides
        .slice(0, 4)
        .map(
          (tide) => `
          <div class="tide-time">
            <span class="tide-hour">${tide.time}</span>
            <span class="tide-type ${
              tide.type === "high" ? "high-tide" : "low-tide"
            }">
              ${tide.type === "high" ? "🌊 Alta" : "🌊 Baixa"}
            </span>
            <span class="tide-level">${tide.level}m</span>
          </div>
        `
        )
        .join("")}
    </div>
  `;
}

/**
 * Mostra a previsão matinal como notificação
 */
export function showMorningForecast() {
  const today = weatherData.forecast[0];
  const notification = {
    title: getGeneralText("weather_morning_forecast_title"),
    message: formatText("weather_morning_forecast", {
      high: today.high,
      low: today.low,
      condition: translateWeatherCondition(today.condition),
    }),
    type: "info",
    duration: 10000,
  };

  showNotification(
    notification.title,
    notification.message,
    notification.type,
    notification.duration
  );
}

/**
 * Verifica a tabela de marés e mostra notificações relevantes
 */
export function checkTideSchedule() {
  // Obter hora atual
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Converter para formato de comparação
  const currentTimeValue = currentHour * 60 + currentMinute;

  // Verifica as marés do dia
  const todayTides = tideData[0].times;

  // Encontrar a próxima maré
  let nextTide = null;
  let minutesToNextTide = Infinity;

  todayTides.forEach((tide) => {
    const [hours, minutes] = tide.time.split(":").map(Number);
    const tideTimeValue = hours * 60 + minutes;

    // Calcular diferença (em minutos)
    let diff = tideTimeValue - currentTimeValue;
    if (diff < 0) diff += 24 * 60; // Se for no dia seguinte

    if (diff < minutesToNextTide) {
      minutesToNextTide = diff;
      nextTide = tide;
    }
  });

  // Se a próxima maré estiver a menos de 60 minutos, mostrar notificação
  if (minutesToNextTide <= 60 && nextTide) {
    const hoursToTide = Math.floor(minutesToNextTide / 60);
    const minsToTide = minutesToNextTide % 60;

    // Usar formatText para gerar mensagem de tempo até a maré com formato correto para cada idioma
    let timeMessage = "";
    if (hoursToTide > 0) {
      timeMessage = formatText("tide_time_hours_minutes", {
        hours: hoursToTide,
        minutes: minsToTide,
      });
    } else {
      timeMessage = formatText("tide_time_minutes", { minutes: minsToTide });
    }

    // Título traduzido para o alerta de maré
    const tideType =
      nextTide.type === "high"
        ? getGeneralText("tide_high_single")
        : getGeneralText("tide_low_single");

    const title = formatText("tide_alert_title", { type: tideType });

    // Mensagem traduzida para o alerta de maré
    const message = formatText("tide_alert_message", {
      type:
        nextTide.type === "high"
          ? getGeneralText("tide_high_type")
          : getGeneralText("tide_low_type"),
      time: timeMessage,
      hour: nextTide.time,
      level: nextTide.level,
    });

    const notification = {
      title: title,
      message: message,
      type: "info",
      duration: 8000,
    };

    showNotification(
      notification.title,
      notification.message,
      notification.type,
      notification.duration
    );
  }
}

/**
 * Converte condição de clima para texto em português
 */
function getConditionText(condition) {
  const conditions = {
    sunny: "ensolarado",
    "partly-cloudy": "parcialmente nublado",
    cloudy: "nublado",
    rainy: "chuvoso",
    stormy: "tempestuoso",
  };

  return conditions[condition] || condition;
}

/**
 * Mostra uma notificação na interface
 */
function showNotification(title, message, type = "info", duration = 5000) {
  // Verificar se a função já existe no escopo global
  if (typeof window.showNotification === "function") {
    window.showNotification(message, type, duration);
    return;
  }

  // Implementação própria caso a função global não exista
  const container =
    document.getElementById("notification-container") ||
    createNotificationContainer();

  const notification = document.createElement("div");
  notification.className = `notification ${type}`;

  notification.innerHTML = `
    <div class="notification-title">${title}</div>
    <div class="notification-message">${message}</div>
    <button class="notification-close">&times;</button>
  `;

  container.appendChild(notification);

  // Adicionar evento de fechar
  const closeBtn = notification.querySelector(".notification-close");
  closeBtn.addEventListener("click", () => {
    container.removeChild(notification);
  });

  // Auto remover após duração especificada
  setTimeout(() => {
    if (notification.parentNode === container) {
      container.removeChild(notification);
    }
  }, duration);
}

/**
 * Cria container de notificações se não existir
 */
function createNotificationContainer() {
  const container = document.createElement("div");
  container.id = "notification-container";
  container.className = "notification-container";
  document.body.appendChild(container);
  return container;
}

async function fetchVisualCrossingWeather() {
  const url = `${VC_BASE_URL}/${LAT},${LON}?unitGroup=metric&key=${VC_API_KEY}&contentType=json&include=days,hours,current&lang=pt`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);

    const data = await res.json();

    // Verificar se a resposta contém os dados necessários
    if (
      !data ||
      !data.currentConditions ||
      !data.days ||
      data.days.length === 0
    ) {
      throw new Error("Resposta da API não contém os dados necessários");
    }

    // Clima atual
    const current = {
      temp: Math.round(data.currentConditions.temp),
      condition: data.currentConditions.conditions?.toLowerCase() || "clear",
      humidity: data.currentConditions.humidity || 70,
      wind: Math.round(data.currentConditions.windspeed || 5),
      precipprob: data.currentConditions.precipprob || 0,
      isDay:
        data.currentConditions.isDaytime ||
        (new Date().getHours() >= 6 && new Date().getHours() < 18),
    };

    // Previsão diária com dados horários para o gráfico
    const forecast = data.days.slice(0, 7).map((day) => {
      // Extrair dados horários para o gráfico de temperatura
      const hourlyTemp = day.hours.map((hour) => ({
        hour: parseInt(hour.datetime.split(":")[0]),
        temp: Math.round(hour.temp),
        // Dados adicionais que podem ser úteis para tooltips no gráfico
        feelsLike: Math.round(hour.feelslike),
        humidity: hour.humidity,
        conditions: hour.conditions,
        precipprob: hour.precipprob || 0,
      }));

      return {
        date: day.datetime,
        high: Math.round(day.tempmax),
        low: Math.round(day.tempmin),
        condition: day.conditions.toLowerCase(),
        humidity: day.humidity,
        wind: Math.round(day.windspeed),
        description: day.description,
        precipprob: day.precipprob || 0,
        hourlyTemp: hourlyTemp, // Dados reais por hora
      };
    });

    return { current, forecast };
  } catch (error) {
    console.error("Erro ao buscar dados climáticos:", error);

    // Fornecer dados simulados em vez de rejeitar a promessa
    return {
      current: {
        temp: 27,
        condition: "clear",
        humidity: 70,
        wind: 10,
        precipprob: 0,
        isDay: new Date().getHours() >= 6 && new Date().getHours() < 18,
      },
      forecast: Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() + i);
        return {
          date: date.toISOString().split("T")[0],
          high: 28 + Math.floor(Math.random() * 5),
          low: 22 - Math.floor(Math.random() * 3),
          condition: "partly cloudy",
          humidity: 70 + Math.floor(Math.random() * 20),
          wind: 5 + Math.floor(Math.random() * 15),
          precipprob: Math.floor(Math.random() * 30),
          hourlyTemp: generateHourlyTempData(25), // Temperatura média simulada
        };
      }),
    };
  }
}

// Correção na função fetchWorldTidesTides
async function fetchWorldTidesTides() {
  try {
    const now = new Date();
    const startTimestamp = Math.floor(now.getTime() / 1000);
    const duration = 168; // 168 horas = 7 dias

    // Solicitar tanto heights (alturas) quanto extremes (marés altas/baixas)
    const url = `https://www.worldtides.info/api/v3?heights&extremes&lat=${LAT}&lon=${LON}&key=${WORLDTIDES_API_KEY}&start=${startTimestamp}&length=${duration}`;

    console.log("Buscando marés com URL:", url);

    // Tente fazer a solicitação à API
    const res = await fetch(url);
    let data;

    try {
      // Tente analisar a resposta como JSON
      data = await res.json();
    } catch (e) {
      console.error("Erro ao analisar resposta como JSON:", e);
      // Se não for JSON, gere dados simulados
      console.warn("Usando dados simulados devido a erro na resposta");
      return generateSimulatedTides();
    }

    // Se temos um objeto de dados com um erro, trate-o
    if (data && data.error) {
      console.error("Erro retornado pela API WorldTides:", data.error);

      if (data.error === "Not enough credits") {
        console.warn("Sem créditos na API WorldTides, usando dados simulados");
        return generateSimulatedTides();
      }

      // Qualquer outro erro, também use dados simulados
      console.warn("Erro na API, usando dados simulados");
      return generateSimulatedTides();
    }

    // Se não temos dados válidos, vá para o tratamento de erro
    if (!res.ok || !data || (!data.extremes && !data.heights)) {
      console.warn("Dados de maré inválidos, usando dados simulados");
      return generateSimulatedTides();
    }

    let tideData = [];

    // Processar extremos (marés altas e baixas)
    if (data.extremes && data.extremes.length > 0) {
      const extremesTides = data.extremes.map((e) => ({
        time: new Date(e.dt * 1000).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        level: e.height.toFixed(1),
        type: e.type, // "high" ou "low" já vem da API
        timestamp: new Date(e.dt * 1000).toISOString(),
        isExtreme: true,
      }));

      tideData = [...tideData, ...extremesTides];
    }

    // Adicionar dados de altura para ter pontos intermediários
    if (data.heights && data.heights.length > 0) {
      // Usamos apenas alguns pontos de altura para não sobrecarregar o gráfico
      const heightStep = Math.max(1, Math.floor(data.heights.length / 100));

      const heightsTides = data.heights
        .filter((_, index) => index % heightStep === 0)
        .map((h) => ({
          time: new Date(h.dt * 1000).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          level: h.height.toFixed(1),
          type: h.height > 0.7 ? "high" : "low",
          timestamp: new Date(h.dt * 1000).toISOString(),
          isExtreme: false,
        }));

      tideData = [...tideData, ...heightsTides];
    }

    // Ordenar por timestamp
    tideData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return tideData;
  } catch (error) {
    console.error("Erro ao buscar dados de marés:", error);
    console.warn("Usando dados simulados de marés devido a erro na API");
    return generateSimulatedTides();
  }
}

/**
 * Determina se uma maré é alta ou baixa analisando dados vizinhos
 */
function determineHighOrLowTide(current, allHeights) {
  // Encontra o índice atual
  const index = allHeights.findIndex((h) => h.dt === current.dt);
  if (index <= 0 || index >= allHeights.length - 1) {
    // Se estivermos nas extremidades, usamos apenas o valor absoluto
    return current.height > 0.7 ? "high" : "low";
  }

  const prev = allHeights[index - 1].height;
  const next = allHeights[index + 1].height;

  // É um ponto alto se for maior que os vizinhos
  if (current.height > prev && current.height > next) {
    return "high";
  }

  // É um ponto baixo se for menor que os vizinhos
  if (current.height < prev && current.height < next) {
    return "low";
  }

  // Se não for claramente alto ou baixo, usa o valor absoluto
  return current.height > 0.7 ? "high" : "low";
}

/**
 * Gera dados simulados quando a API de marés falha
 */
function generateSimulatedTides() {
  console.warn("Gerando dados simulados de maré");
  const tides = [];
  const now = new Date();

  // Para cada um dos próximos 7 dias
  for (let day = 0; day < 7; day++) {
    const currentDate = new Date(now);
    currentDate.setDate(now.getDate() + day);

    // Duas marés altas e duas baixas por dia (padrão típico)
    const highTideHours = [3, 15]; // Marés altas às 3h e 15h
    const lowTideHours = [9, 21]; // Marés baixas às 9h e 21h

    // Adiciona marés altas
    for (const hour of highTideHours) {
      const tideTime = new Date(currentDate);
      tideTime.setHours(hour, 0, 0, 0);

      tides.push({
        time: tideTime.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        level: (1.2 + Math.random() * 0.6).toFixed(1),
        type: "high",
        timestamp: tideTime.toISOString(),
        isExtreme: true,
      });
    }

    // Adiciona marés baixas
    for (const hour of lowTideHours) {
      const tideTime = new Date(currentDate);
      tideTime.setHours(hour, 0, 0, 0);

      tides.push({
        time: tideTime.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        level: (0.2 + Math.random() * 0.3).toFixed(1),
        type: "low",
        timestamp: tideTime.toISOString(),
        isExtreme: true,
      });
    }

    // Adiciona pontos intermediários para melhorar o gráfico
    for (let h = 0; h < 24; h += 2) {
      if (highTideHours.includes(h) || lowTideHours.includes(h)) continue;

      const tideTime = new Date(currentDate);
      tideTime.setHours(h, 0, 0, 0);

      // Calcular um valor intermediário baseado na proximidade das marés
      const hoursSinceLastLow =
        h - lowTideHours.filter((lh) => lh < h).pop() ||
        24 + h - lowTideHours.filter((lh) => lh < 24).pop();
      const hoursUntilNextLow =
        lowTideHours.find((lh) => lh > h) || 24 + lowTideHours[0] - h;

      let level;
      // Se estamos mais perto de uma maré baixa, o nível é mais baixo
      if (hoursSinceLastLow < hoursUntilNextLow) {
        const progress =
          hoursSinceLastLow / (hoursSinceLastLow + hoursUntilNextLow);
        level = (0.2 + progress * 1.0).toFixed(1);
      } else {
        const progress =
          hoursUntilNextLow / (hoursSinceLastLow + hoursUntilNextLow);
        level = (1.2 - progress * 1.0).toFixed(1);
      }

      tides.push({
        time: tideTime.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        level: level,
        type: parseFloat(level) > 0.7 ? "high" : "low",
        timestamp: tideTime.toISOString(),
        isExtreme: false,
      });
    }
  }

  // Ordenar as marés por timestamp para garantir a ordem cronológica
  tides.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return tides;
}

/**
 * Mapeia condições meteorológicas para emojis mais precisos
 */
function getWeatherEmoji(weatherData) {
  if (!weatherData || !weatherData.condition) {
    return "☀️"; // Emoji padrão se não houver dados
  }

  // Detecta dia/noite
  let isDay = true;
  if (typeof weatherData.isDay !== "undefined") {
    isDay = weatherData.isDay;
  } else {
    // Se estamos olhando para hoje, use a hora atual
    // Para dias futuros, assuma que é dia
    const isToday =
      new Date(weatherData.date).toDateString() === new Date().toDateString();
    if (isToday) {
      const hour = new Date().getHours();
      isDay = hour >= 6 && hour < 18;
    }
  }

  const cond = weatherData.condition.toLowerCase();
  const precipProb = weatherData.precipprob || 0;

  // Considerar probabilidade de precipitação
  if (precipProb >= 70) {
    if (cond.includes("thunder") || cond.includes("storm")) return "⛈️"; // Tempestade forte
    if (cond.includes("heavy") || cond.includes("rain")) return "🌧️"; // Chuva forte
    return "🌦️"; // Chuva provável
  } else if (precipProb >= 40) {
    if (cond.includes("thunder")) return "🌩️"; // Possibilidade de trovoada
    return "🌦️"; // Possibilidade de chuva
  }

  // Mapeamento detalhado por condição
  if (cond.includes("rain") && cond.includes("thunder")) return "⛈️"; // Tempestade com chuva
  if (cond.includes("thunder") || cond.includes("lightning")) return "🌩️"; // Trovoada
  if (cond.includes("heavy rain") || cond.includes("downpour")) return "🌧️"; // Chuva forte
  if (cond.includes("light rain") || cond.includes("drizzle")) return "🌦️"; // Chuva leve com sol
  if (cond.includes("rain")) return "🌧️"; // Chuva
  if (cond.includes("shower")) return "🌦️"; // Pancadas
  if (cond.includes("partly cloudy")) return isDay ? "⛅️" : "☁️"; // Parcialmente nublado
  if (cond.includes("mostly cloudy") || cond.includes("overcast"))
    return isDay ? "🌥️" : "☁️"; // Muito nublado
  if (cond.includes("cloud")) return "☁️"; // Nublado
  if (cond.includes("fog") || cond.includes("mist")) return "🌫️"; // Neblina
  if (cond.includes("snow")) return "❄️"; // Neve
  if (cond.includes("clear")) return isDay ? "☀️" : "🌙"; // Céu limpo
  if (cond.includes("sun")) return "☀️"; // Ensolarado
  if (cond.includes("fair") && isDay) return "🌤️"; // Bom tempo durante o dia
  if (cond.includes("fair") && !isDay) return "🌙"; // Bom tempo à noite
  if (cond.includes("hail")) return "🌨️"; // Granizo
  if (cond.includes("sleet")) return "🌨️"; // Aguaneve
  if (cond.includes("windy") || cond.includes("breezy")) return "💨"; // Ventoso

  // Quando a temperatura é extrema
  if (weatherData.high && weatherData.high > 32) return "🔥"; // Muito quente
  if (weatherData.low && weatherData.low < 10) return "❄️"; // Muito frio

  // Default
  return isDay ? "☀️" : "🌙";
}

/**
 * Extrai informações relevantes de marés para exibição
 */
function extractTideInfo(tides) {
  // Valores padrão caso não haja dados de marés
  const notAvailable = getGeneralText("not_available");
  let info = {
    nextTideType: notAvailable,
    nextTideTime: notAvailable,
    nextTideLevel: notAvailable,
    timeToNextTide: notAvailable,
    highTide1: notAvailable,
    lowTide1: notAvailable,
    tideRange: notAvailable,
  };

  if (!tides || tides.length === 0) {
    return info;
  }

  // Encontrar marés altas e baixas
  const highTides = tides
    .filter((t) => t.type === "high" && t.isExtreme)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const lowTides = tides
    .filter((t) => t.type === "low" && t.isExtreme)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Calcular amplitude da maré (diferença entre o mais alto e mais baixo)
  let maxLevel = -Infinity;
  let minLevel = Infinity;

  tides.forEach((tide) => {
    const level = parseFloat(tide.level);
    if (level > maxLevel) maxLevel = level;
    if (level < minLevel) minLevel = level;
  });

  // Encontrar a próxima maré a partir de agora
  const now = new Date();
  let nextTide = null;
  let minTimeDiff = Infinity;

  tides.forEach((tide) => {
    if (tide.isExtreme) {
      // Considerar apenas marés extremas (altas/baixas reais)
      const tideTime = new Date(tide.timestamp);
      const diff = tideTime - now;
      if (diff > 0 && diff < minTimeDiff) {
        minTimeDiff = diff;
        nextTide = tide;
      }
    }
  });

  // Formatar tempo até a próxima maré
  let timeToNextTide = notAvailable;
  if (nextTide) {
    const diffMinutes = Math.floor(minTimeDiff / (1000 * 60));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    if (hours > 0) {
      timeToNextTide = formatText("tide_time_hours_minutes", {
        hours,
        minutes,
      });
    } else {
      timeToNextTide = formatText("tide_time_minutes", { minutes });
    }
  }

  // Termos traduzidos para alta/baixa maré
  const highTideTerm = getGeneralText("tide_high_single");
  const lowTideTerm = getGeneralText("tide_low_single");

  // Preencher o objeto de informações com termos traduzidos
  info = {
    nextTideType: nextTide
      ? nextTide.type === "high"
        ? highTideTerm
        : lowTideTerm
      : notAvailable,
    nextTideTime: nextTide ? nextTide.time : notAvailable,
    nextTideLevel: nextTide ? `${nextTide.level}m` : notAvailable,
    timeToNextTide: timeToNextTide,
    highTide1:
      highTides.length > 0
        ? `${highTides[0].time} (${highTides[0].level}m)`
        : notAvailable,
    lowTide1:
      lowTides.length > 0
        ? `${lowTides[0].time} (${lowTides[0].level}m)`
        : notAvailable,
    tideRange:
      maxLevel > -Infinity && minLevel < Infinity
        ? `${(maxLevel - minLevel).toFixed(1)}m`
        : notAvailable,
  };

  return info;
}

/**
 * Atualiza as informações de marés no modal quando o dia selecionado muda
 */
function updateTideInfo(modal, tideInfo) {
  if (!modal) {
    console.error("Modal não fornecido para updateTideInfo");
    return;
  }

  // Selecionando os elementos de maré no modal
  const tideItems = modal.querySelectorAll(".tide-item .tide-value");

  if (!tideItems || tideItems.length < 6) {
    console.error(
      "Elementos de maré não encontrados ou insuficientes no modal"
    );
    return;
  }

  // Atualizar as informações
  tideItems[0].textContent = `${tideInfo.nextTideType} ${tideInfo.nextTideTime}`;
  tideItems[1].textContent = tideInfo.nextTideLevel;
  tideItems[2].textContent = tideInfo.timeToNextTide;
  tideItems[3].textContent = tideInfo.highTide1;
  tideItems[4].textContent = tideInfo.lowTide1;
  tideItems[5].textContent = tideInfo.tideRange;
}

/**
 * Mapeia código de idioma para código de localização para formatação de datas
 * @param {string} lang - Código do idioma (pt, en, es, he)
 * @returns {string} - Código de localização para formatação de datas
 */
function mapLanguageToLocale(lang) {
  const localeMap = {
    pt: "pt-BR",
    en: "en-US",
    es: "es-ES",
    he: "he-IL",
  };
  return localeMap[lang] || "pt-BR";
}

/**
 * Formata uma data para exibição no idioma atual
 * @param {Date} date - Data a ser formatada
 * @returns {string} - Data formatada no idioma atual
 */
function formatDateForDisplay(date) {
  try {
    return date.toLocaleDateString(mapLanguageToLocale(currentLang), {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch (error) {
    console.error("Erro ao formatar data:", error);
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }
}

/**
 * Obtém o nome traduzido do dia da semana
 * @param {Date} date - Data para obter o dia da semana
 * @returns {string} - Nome do dia da semana traduzido
 */
function getTranslatedWeekday(date, format = "short") {
  try {
    const options = { weekday: format };
    return date
      .toLocaleDateString(mapLanguageToLocale(currentLang), options)
      .replace(".", "")
      .toLowerCase(); // Remover ponto final e deixar em minúsculas
  } catch (error) {
    console.error("Erro ao obter dia da semana traduzido:", error);
    return date
      .toLocaleDateString("pt-BR", { weekday: format })
      .replace(".", "")
      .toLowerCase();
  }
}

/**
 * Traduz descrições de condições climáticas
 * @param {string} condition - Condição climática em inglês
 * @returns {string} - Condição traduzida para o idioma atual
 */
function translateWeatherCondition(condition) {
  if (!condition) return getGeneralText("weather_unknown");

  const cond = condition.toLowerCase();

  // Verificar especificamente por "clear conditions" antes do mapeamento geral
  if (cond === "clear conditions") {
    return getGeneralText("weather_clear_conditions");
  }

  // Restante da função permanece igual...
  const translationKey = `weather_${cond
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")}`;
  const translation = getGeneralText(translationKey);

  // Se encontrou tradução específica, retorna
  if (translation !== translationKey) {
    return translation;
  }

  // Caso não encontre tradução específica, usa o mapeamento de fallback
  if (cond.includes("thunderstorm"))
    return getGeneralText("weather_thunderstorm");
  if (cond.includes("rain") && cond.includes("thunder"))
    return getGeneralText("weather_thunderstorm_rain");
  if (cond.includes("heavy rain")) return getGeneralText("weather_heavy_rain");
  if (cond.includes("light rain") || cond.includes("drizzle"))
    return getGeneralText("weather_light_rain");
  if (cond.includes("rain")) return getGeneralText("weather_rain");
  if (cond.includes("shower")) return getGeneralText("weather_shower");
  if (cond.includes("partly cloudy"))
    return getGeneralText("weather_partly_cloudy");
  if (cond.includes("mostly cloudy"))
    return getGeneralText("weather_mostly_cloudy");
  if (cond.includes("overcast")) return getGeneralText("weather_overcast");
  if (cond.includes("cloudy")) return getGeneralText("weather_cloudy");
  if (cond.includes("fog") || cond.includes("mist"))
    return getGeneralText("weather_fog");
  if (cond.includes("clear") || cond.includes("sunny"))
    return getGeneralText("weather_clear");
  if (cond.includes("snow")) return getGeneralText("weather_snow");
  if (cond.includes("hail")) return getGeneralText("weather_hail");
  if (cond.includes("sleet")) return getGeneralText("weather_sleet");
  if (cond.includes("fair")) return getGeneralText("weather_fair");

  // Se nada coincidir, retorna a própria condição
  return condition;
}

// Exportar as funções principais
export { showFullForecast };
