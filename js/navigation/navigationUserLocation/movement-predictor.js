/**
 * Sistema preditor de movimento para navegação
 * Fornece algoritmos avançados para prever movimento do usuário e melhorar precisão
 */

import { navigationState } from "../navigationState/navigationStateManager.js";

// Histórico de posições para análise de padrão
const movementHistory = {
  positions: [],
  maxSamples: 10,
  lastPrediction: null,
  confidenceLevel: 0,
  lastUpdateTime: 0,
};

/**
 * Adiciona uma nova posição ao histórico
 * @param {Object} position - Posição do usuário
 */
export function trackPosition(position) {
  if (!position || !position.latitude || !position.longitude) return;

  // Adicionar timestamp se não existir
  if (!position.timestamp) position.timestamp = Date.now();

  // Adicionar ao histórico
  movementHistory.positions.push(position);

  // Limitar tamanho do histórico
  if (movementHistory.positions.length > movementHistory.maxSamples) {
    movementHistory.positions.shift();
  }

  // Atualizar timestamp
  movementHistory.lastUpdateTime = Date.now();
}

/**
 * Prediz a próxima posição do usuário com base no histórico de movimento
 * @param {number} timeAhead - Tempo em ms para predizer à frente
 * @returns {Object|null} - Posição prevista
 */
export function predictNextPosition(timeAhead = 1000) {
  // Verificar se temos posições suficientes
  if (movementHistory.positions.length < 3) return null;

  // Obter posições recentes
  const positions = [...movementHistory.positions].slice(-5);

  // Verificar se o usuário está em movimento
  const isMoving = analyzeMovement(positions);
  if (!isMoving) return null;

  // Calcular velocidade e direção médias
  const speedAndDirection = calculateSpeedAndDirection(positions);
  if (!speedAndDirection || speedAndDirection.speed < 0.5) return null;

  // Calcular quanto tempo avançar (converter para segundos)
  const timeInSeconds = timeAhead / 1000;

  // Obter posição mais recente
  const currentPos = positions[positions.length - 1];

  // Calcular deslocamento
  const distance = speedAndDirection.speed * timeInSeconds;
  const direction = speedAndDirection.direction;

  // Calcular nova posição
  const predictedPos = calculateDestinationPoint(
    currentPos.latitude,
    currentPos.longitude,
    direction,
    distance
  );

  // Adicionar metadados
  predictedPos.timestamp = currentPos.timestamp + timeAhead;
  predictedPos.predicted = true;
  predictedPos.basedOn = currentPos.timestamp;
  predictedPos.confidence = movementHistory.confidenceLevel;

  // Armazenar predição
  movementHistory.lastPrediction = predictedPos;

  return predictedPos;
}

/**
 * Analisa se o usuário está em movimento
 * @param {Array} positions - Histórico de posições
 * @returns {boolean} - Se o usuário está em movimento
 */
function analyzeMovement(positions) {
  if (positions.length < 2) return false;

  // Calcular distância total percorrida
  let totalDistance = 0;

  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1];
    const curr = positions[i];

    const distance = calculateDistanceBetweenPositions(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );

    totalDistance += distance;
  }

  // Calcular tempo total
  const timeSpan =
    positions[positions.length - 1].timestamp - positions[0].timestamp;
  const timeSpanSeconds = timeSpan / 1000;

  // Calcular velocidade média em m/s
  const avgSpeed = timeSpanSeconds > 0 ? totalDistance / timeSpanSeconds : 0;

  // Definir limite de velocidade para considerar em movimento (0.5 m/s ≈ 1.8 km/h)
  return avgSpeed > 0.5;
}

/**
 * Calcula velocidade e direção médias com base no histórico
 * @param {Array} positions - Histórico de posições
 * @returns {Object|null} - Velocidade (m/s) e direção (graus)
 */
function calculateSpeedAndDirection(positions) {
  if (positions.length < 2) return null;

  // Calcular todos os segmentos
  const segments = [];

  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1];
    const curr = positions[i];

    const distance = calculateDistanceBetweenPositions(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );

    const direction = calculateBearing(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );

    const timeSpan = (curr.timestamp - prev.timestamp) / 1000;
    const speed = timeSpan > 0 ? distance / timeSpan : 0;

    segments.push({ distance, direction, speed, timeSpan });
  }

  // Calcular médias ponderadas pelo tempo
  let totalWeight = 0;
  let speedSum = 0;
  let sinSum = 0;
  let cosSum = 0;

  segments.forEach((segment) => {
    // Peso maior para segmentos mais recentes
    const weight = segment.timeSpan;
    totalWeight += weight;

    speedSum += segment.speed * weight;
    sinSum += Math.sin((segment.direction * Math.PI) / 180) * weight;
    cosSum += Math.cos((segment.direction * Math.PI) / 180) * weight;
  });

  if (totalWeight === 0) return null;

  const avgSpeed = speedSum / totalWeight;
  const avgDirection = (Math.atan2(sinSum, cosSum) * 180) / Math.PI;

  // Normalizar direção para 0-360
  const normalizedDirection = (avgDirection + 360) % 360;

  // Calcular nível de confiança
  // A confiança depende de quão consistente é a velocidade e direção
  let consistencyFactor = calculateConsistencyFactor(segments);
  movementHistory.confidenceLevel = Math.min(0.95, consistencyFactor);

  return {
    speed: avgSpeed,
    direction: normalizedDirection,
    confidence: movementHistory.confidenceLevel,
  };
}

/**
 * Calcula o fator de consistência dos segmentos de movimento
 * @param {Array} segments - Segmentos de movimento
 * @returns {number} - Fator de consistência (0-1)
 */
function calculateConsistencyFactor(segments) {
  if (segments.length <= 1) return 0.5;

  // Calcular desvio padrão de velocidade e direção
  const speeds = segments.map((s) => s.speed);
  const directions = segments.map((s) => s.direction);

  const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;

  // Desvio padrão de velocidade
  const speedVariance =
    speeds.reduce((sum, speed) => {
      return sum + Math.pow(speed - avgSpeed, 2);
    }, 0) / speeds.length;

  const speedStdDev = Math.sqrt(speedVariance);

  // Consistência de direção (usando estatística circular)
  const sinSum = directions.reduce(
    (sum, dir) => sum + Math.sin((dir * Math.PI) / 180),
    0
  );
  const cosSum = directions.reduce(
    (sum, dir) => sum + Math.cos((dir * Math.PI) / 180),
    0
  );

  // R é uma medida de dispersão direcional
  const R =
    Math.sqrt(Math.pow(sinSum, 2) + Math.pow(cosSum, 2)) / directions.length;

  // Converter para um fator de consistência (0-1)
  const speedConsistency = 1 / (1 + speedStdDev);

  // Combinar os fatores (R já está entre 0 e 1)
  // Dar mais peso à consistência de direção
  const consistencyFactor = 0.3 * speedConsistency + 0.7 * R;

  return consistencyFactor;
}

/**
 * Calcula a distância entre duas posições
 * @param {number} lat1 - Latitude da primeira posição
 * @param {number} lon1 - Longitude da primeira posição
 * @param {number} lat2 - Latitude da segunda posição
 * @param {number} lon2 - Longitude da segunda posição
 * @returns {number} - Distância em metros
 */
function calculateDistanceBetweenPositions(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Raio da Terra em metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calcula o bearing (direção) entre dois pontos
 * @param {number} lat1 - Latitude inicial
 * @param {number} lon1 - Longitude inicial
 * @param {number} lat2 - Latitude final
 * @param {number} lon2 - Longitude final
 * @returns {number} - Direção em graus (0-359)
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const λ1 = (lon1 * Math.PI) / 180;
  const λ2 = (lon2 * Math.PI) / 180;

  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);

  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  if (bearing < 0) {
    bearing += 360;
  }

  return bearing;
}

/**
 * Calcula um ponto de destino dado origem, bearing e distância
 * @param {number} lat - Latitude inicial
 * @param {number} lon - Longitude inicial
 * @param {number} bearing - Direção em graus
 * @param {number} distance - Distância em metros
 * @returns {Object} - Ponto calculado {latitude, longitude}
 */
function calculateDestinationPoint(lat, lon, bearing, distance) {
  const R = 6371000; // Raio da Terra em metros
  const δ = distance / R; // Angular distance
  const θ = (bearing * Math.PI) / 180; // Bearing in radians
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );

  let λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );

  // Normalizar longitude para -180 a 180
  λ2 = ((λ2 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;

  return {
    latitude: (φ2 * 180) / Math.PI,
    longitude: (λ2 * 180) / Math.PI,
  };
}

/**
 * Obtém a posição atual ou uma previsão baseada no histórico
 * @param {number} [tolerance=500] - Tolerância em ms para considerar uma posição "atual"
 * @returns {Object|null} - Posição atual ou prevista
 */
export function getCurrentOrPredictedPosition(tolerance = 500) {
  const now = Date.now();

  // Verificar se temos uma posição recente
  if (movementHistory.positions.length > 0) {
    const latestPosition =
      movementHistory.positions[movementHistory.positions.length - 1];

    // Se a posição for recente o suficiente, retorna-la diretamente
    if (now - latestPosition.timestamp <= tolerance) {
      return latestPosition;
    }

    // Caso contrário, tentar prever para o momento atual
    const timeDifference = now - latestPosition.timestamp;
    return predictNextPosition(timeDifference);
  }

  return null;
}

/**
 * Avalia a qualidade da última predição comparando com a posição real
 * @param {Object} actualPosition - Posição real obtida
 * @returns {number} - Pontuação de precisão (0-1)
 */
export function evaluatePredictionAccuracy(actualPosition) {
  // Verificar se existe uma previsão para avaliar
  if (!movementHistory.lastPrediction || !actualPosition) return 0;

  // Calcular diferença de tempo
  const timeDiff = Math.abs(
    movementHistory.lastPrediction.timestamp - actualPosition.timestamp
  );

  // Se a diferença de tempo for grande, a predição não é comparável
  if (timeDiff > 2000) return 0;

  // Calcular distância entre predição e realidade
  const distance = calculateDistanceBetweenPositions(
    movementHistory.lastPrediction.latitude,
    movementHistory.lastPrediction.longitude,
    actualPosition.latitude,
    actualPosition.longitude
  );

  // Calcular pontuação de precisão
  // Distância = 0m -> 1.0
  // Distância = 50m -> 0.0
  const accuracyScore = Math.max(0, 1 - distance / 50);

  // Atualizar nível de confiança com base na pontuação
  movementHistory.confidenceLevel =
    0.7 * movementHistory.confidenceLevel + 0.3 * accuracyScore;

  return accuracyScore;
}

/**
 * Calcula o ponto à frente na direção atual do movimento
 * @param {number} distance - Distância em metros
 * @returns {Object|null} - Ponto calculado {latitude, longitude}
 */
export function getPointAhead(distance) {
  // Verificar se temos histórico suficiente
  if (movementHistory.positions.length < 2) return null;

  const speedAndDirection = calculateSpeedAndDirection(
    [...movementHistory.positions].slice(-5)
  );

  if (!speedAndDirection) return null;

  // Obter posição mais recente
  const currentPos =
    movementHistory.positions[movementHistory.positions.length - 1];

  return calculateDestinationPoint(
    currentPos.latitude,
    currentPos.longitude,
    speedAndDirection.direction,
    distance
  );
}

/**
 * Avalia se existe uma tendência de curva no movimento recente
 * @returns {Object|null} - Informações sobre a curva ou null se não detectada
 */
export function detectTurnTrend() {
  if (movementHistory.positions.length < 5) return null;

  // Analisar as últimas posições para detectar padrão de curva
  const positions = [...movementHistory.positions].slice(-5);

  // Calcular bearings entre pontos consecutivos
  const bearings = [];
  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1];
    const curr = positions[i];

    const bearing = calculateBearing(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );

    bearings.push(bearing);
  }

  // Analisar variação nos bearings para detectar curva
  // Uma mudança consistente em uma direção indica curva
  const bearingChanges = [];
  for (let i = 1; i < bearings.length; i++) {
    let change = bearings[i] - bearings[i - 1];

    // Normalizar para -180 a +180
    if (change > 180) change -= 360;
    if (change < -180) change += 360;

    bearingChanges.push(change);
  }

  // Calcular soma das mudanças
  const totalChange = bearingChanges.reduce((sum, change) => sum + change, 0);

  // Verificar se há tendência consistente
  const isTurning = Math.abs(totalChange) > 30;

  if (!isTurning) return null;

  // Determinar direção da curva
  const turnDirection = totalChange > 0 ? "right" : "left";

  // Estimar intensidade da curva
  const intensity = Math.min(1, Math.abs(totalChange) / 90);

  return {
    direction: turnDirection,
    intensity: intensity,
    bearingChange: totalChange,
  };
}
