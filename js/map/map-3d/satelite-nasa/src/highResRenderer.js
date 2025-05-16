/**
 * highResRenderer.js
 * Pipeline de super-resolução de tiles NASA GIBS com ESRGAN (TensorFlow.js),
 * gerando canvas upscalado + metadata (bbox, resolução espacial).
 */

import * as tf from '@tensorflow/tfjs';
import { tileBBox, meterPerPixel } from './utils/tileUtils.js';
import { loadImageWithRetry } from './data/nasaGibs.js';

let esrganModel = null;

/**
 * Carrega modelo ESRGAN (TensorFlow.js) da pasta local.
 * @param {string} modelPath Caminho para model.json.
 */
export async function loadSuperResolutionModel(modelPath) {
  try {
    esrganModel = await tf.loadGraphModel(modelPath);
    console.info('[highResRenderer] Modelo ESRGAN carregado.');
  } catch (e) {
    console.error('[highResRenderer] Falha ao carregar modelo', e);
    throw e;
  }
}

/**
 * Gera tile super-resolvido + metadata.
 * @param {number} x Coluna do tile
 * @param {number} y Linha do tile
 * @param {number} z Zoom do tile
 * @param {string} urlTemplate URL modelo WMTS com placeholders {z},{y},{x}
 * @returns {Promise<{canvas: HTMLCanvasElement, metadata: Object}>}
 */
export async function generateHighResTile(x, y, z, urlTemplate) {
  if (!esrganModel) {
    throw new Error('Modelo ESRGAN não carregado. Chame loadSuperResolutionModel() primeiro.');
  }

  const url = urlTemplate.replace('{z}', z).replace('{x}', x).replace('{y}', y);
  const img = await loadImageWithRetry(url, 3);

  // Converte imagem para tensor
  const input = tf.browser
    .fromPixels(img)
    .toFloat()
    .div(tf.scalar(255))
    .expandDims(0);

  // Executa super-resolução
  const output = esrganModel.execute(input);
  const tensorOut = output.squeeze().mul(255).clipByValue(0, 255).toInt();

  // Renderiza em canvas
  const [height, width] = tensorOut.shape.slice(0, 2);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  await tf.browser.toPixels(tensorOut, canvas);

  // Limpeza de memória
  tf.dispose([input, output, tensorOut]);

  // Metadata geoespacial
  const bbox = tileBBox(x, y, z);
  const midLat = (bbox[1] + bbox[3]) / 2;
  const resolution = meterPerPixel(midLat, z);

  return { canvas, metadata: { x, y, z, bbox, resolution } };
}
