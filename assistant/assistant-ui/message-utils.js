/**
 * Obtém uma mensagem de forma segura, com fallback para caso de erro
 *
 * @param {Object} messageObj - O objeto de mensagens
 * @param {string} path - Caminho da mensagem (ex: "navigation.routeCreated")
 * @param {Array} args - Argumentos para passar para a função de mensagem
 * @param {string} fallback - Mensagem de fallback
 * @returns {string} A mensagem formatada
 */
export function safeGetMessage(messageObj, path, args = [], fallback = "") {
  try {
    // Dividir o caminho em partes
    const parts = path.split(".");

    // Navegar pelo objeto
    let current = messageObj;
    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        return formatFallback(fallback, args);
      }
    }

    // Se chegou em uma função, chamar com os argumentos
    if (typeof current === "function") {
      return current(...args);
    }

    // Se é string, usar como template
    if (typeof current === "string") {
      return formatStringTemplate(current, args);
    }

    // Fallback se não for função nem string
    return formatFallback(fallback, args);
  } catch (error) {
    console.error(`Erro ao obter mensagem "${path}":`, error);
    return formatFallback(fallback, args);
  }
}

/**
 * Formata uma string de template substituindo %s, %d etc. pelos argumentos
 */
function formatStringTemplate(template, args) {
  return template.replace(/%([sdfo])/g, (_, type, index) => {
    const arg = args.shift();
    if (arg === undefined) return "";

    switch (type) {
      case "s":
        return String(arg);
      case "d":
        return Number(arg);
      case "f":
        return parseFloat(arg);
      case "o":
        return JSON.stringify(arg);
      default:
        return arg;
    }
  });
}

/**
 * Formata o texto de fallback com os argumentos
 */
function formatFallback(fallback, args) {
  if (typeof fallback === "function") {
    return fallback(...args);
  }
  if (typeof fallback === "string") {
    return formatStringTemplate(fallback, args);
  }
  return String(fallback);
}
