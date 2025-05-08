// Novo módulo completo: Sistema de Mensagens Inteligentes de Boas-Vindas - Morro Digital

// Funções utilitárias para controle de visita
export function isFirstVisit() {
  const visited = localStorage.getItem("visitedMorroDigital");
  const isFirst = !visited;
  console.log(
    `[welcome.js] isFirstVisit(): ${isFirst} (localStorage: ${visited})`
  );
  return isFirst;
}

export function markVisit() {
  console.log(`[welcome.js] markVisit(): Marcando primeira visita`);
  localStorage.setItem("visitedMorroDigital", "true");
}

// Função que retorna o período preciso do dia
export function getPrecisePeriodOfDay() {
  const now = new Date();
  const hour = now.getHours();

  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 15 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 20) return "pre_dinner";
  if (hour >= 20 && hour < 23) return "night";
  return "late_night";
}

// Mensagens por idioma, período e variações
const welcomeMessages = {
  pt: {
    morning: [
      "🌞 Bom dia! Hoje está perfeito para explorar praias incríveis e descobrir pontos turísticos em Morro de São Paulo. Como posso te ajudar?",
      "🌅 Bom dia! O sol já brilha e Morro de São Paulo te espera com aventuras inesquecíveis. Como posso te ajudar?",
      "🌞 Bom dia! Um ótimo momento para curtir a natureza e conhecer lugares especiais. Como posso te ajudar?",
    ],
    lunch: [
      "🍽️ Boa tarde! Que tal conhecer a culinária local e relaxar em uma praia próxima? Como posso te ajudar?",
      "☀️ Boa tarde! Momento perfeito para almoçar e depois explorar praias ou atrações. Como posso te ajudar?",
      "🍴 Boa tarde! Um bom almoço e uma praia tranquila combinam perfeitamente. Como posso te ajudar?",
    ],
    afternoon: [
      "☀️ Boa tarde! O sol está perfeito para curtir praias, fazer passeios e ver o pôr do sol. Como posso te ajudar?",
      "🌞 Boa tarde! Ainda há muito para explorar: praias, trilhas e muito mais! Como posso te ajudar?",
      "🌤️ Boa tarde! Que tal descobrir novas praias e relaxar sob o sol? Como posso te ajudar?",
    ],
    pre_dinner: [
      "🌇 Boa noite! Que tal encontrar um restaurante especial e planejar suas próximas aventuras? Como posso te ajudar?",
      "🌆 Boa noite! Ótimo momento para aproveitar a gastronomia local e planejar novas experiências. Como posso te ajudar?",
      "🌃 Boa noite! Vamos escolher um lugar aconchegante para jantar ou preparar o passeio de amanhã? Como posso te ajudar?",
    ],
    night: [
      "🌙 Boa noite! Hora de jantares especiais, festas animadas ou planejar a aventura de amanhã. Como posso te ajudar?",
      "✨ Boa noite! Vamos explorar a vida noturna ou organizar os melhores passeios para amanhã? Como posso te ajudar?",
      "🌌 Boa noite! Momento ideal para aproveitar, dançar ou sonhar com novas aventuras. Como posso te ajudar?",
    ],
    late_night: [
      "🌌 Boa noite! Já é tarde, mas ainda podemos planejar suas experiências para amanhã. Como posso te ajudar?",
      "🌙 Boa noite! Descanse bem e prepare-se para um novo dia cheio de aventuras. Como posso te ajudar?",
      "🌃 Boa noite! Hora perfeita para relaxar e planejar os próximos passeios. Como posso te ajudar?",
    ],
  },
  en: {
    morning: [
      "🌞 Good morning! Today is perfect for discovering beautiful beaches, hiking trails, and stunning sights around Morro de São Paulo. How can I help you?",
      "🌅 Good morning! The sun is shining and Morro de São Paulo is ready to offer you incredible adventures. How can I help you?",
      "🌞 Good morning! A perfect time to enjoy the beaches and explore the best places. How can I help you?",
    ],
    lunch: [
      "🍽️ Good afternoon! How about tasting the local cuisine and relaxing by a nearby beach? How can I help you?",
      "☀️ Good afternoon! It's a perfect time to enjoy a great meal and explore beaches or tourist spots. How can I help you?",
      "🍴 Good afternoon! A delicious lunch and a calm beach sound perfect right now. How can I help you?",
    ],
    afternoon: [
      "☀️ Good afternoon! The sun is perfect for visiting beaches, joining tours, or enjoying the sunset. How can I help you?",
      "🌞 Good afternoon! There's still plenty of time to explore beaches, trails, and enjoy Morro de São Paulo. How can I help you?",
      "🌤️ Good afternoon! How about discovering new places and relaxing at wonderful beaches? How can I help you?",
    ],
    pre_dinner: [
      "🌇 Good evening! How about finding a great restaurant and planning your next adventures? How can I help you?",
      "🌆 Good evening! It's a great time to enjoy the local cuisine and explore new experiences. How can I help you?",
      "🌃 Good evening! Let’s choose a cozy restaurant or plan a tour for tomorrow. How can I help you?",
    ],
    night: [
      "🌙 Good evening! Time for special dinners, lively parties, or planning tomorrow’s adventure. How can I help you?",
      "✨ Good evening! Let's explore restaurants, nightlife, or organize tomorrow’s tours. How can I help you?",
      "🌌 Good evening! Great time to enjoy local food, dance, and dream about the next adventures. How can I help you?",
    ],
    late_night: [
      "🌌 Good evening! It’s late, but we can still plan your experiences for tomorrow. How can I help you?",
      "🌙 Good evening! Rest well and get ready for an exciting new day in Morro de São Paulo. How can I help you?",
      "🌃 Good evening! Perfect moment to relax and plan your next adventures. How can I help you?",
    ],
  },
  es: {
    morning: [
      "🌞 ¡Buenos días! Hoy es un día perfecto para explorar playas hermosas, rutas y lugares turísticos en Morro de São Paulo. ¿En qué puedo ayudarte?",
      "🌅 ¡Buenos días! El sol brilla y Morro de São Paulo te espera con aventuras increíbles. ¿En qué puedo ayudarte?",
      "🌞 ¡Buenos días! Es un excelente momento para disfrutar de la naturaleza y descubrir lugares especiales. ¿En qué puedo ayudarte?",
    ],
    lunch: [
      "🍽️ ¡Buenas tardes! ¿Qué tal probar la gastronomía local y relajarte en una playa cercana? ¿En qué puedo ayudarte?",
      "☀️ ¡Buenas tardes! Momento perfecto para almorzar y luego explorar playas o atracciones turísticas. ¿En qué puedo ayudarte?",
      "🍴 ¡Buenas tardes! Un buen almuerzo y una playa tranquila son una excelente combinación. ¿En qué puedo ayudarte?",
    ],
    afternoon: [
      "☀️ ¡Buenas tardes! El sol está ideal para disfrutar de playas, paseos y un atardecer increíble. ¿En qué puedo ayudarte?",
      "🌞 ¡Buenas tardes! ¡Aún hay mucho por explorar: playas, senderos y más! ¿En qué puedo ayudarte?",
      "🌤️ ¡Buenas tardes! ¿Qué tal descubrir nuevas playas y relajarte bajo el sol? ¿En qué puedo ayudarte?",
    ],
    pre_dinner: [
      "🌇 ¡Buenas noches! ¿Qué tal elegir un restaurante especial o planificar la próxima aventura? ¿En qué puedo ayudarte?",
      "🌆 ¡Buenas noches! Un excelente momento para saborear la gastronomía local y planificar nuevas experiencias. ¿En qué puedo ayudarte?",
      "🌃 ¡Buenas noches! ¿Vamos a encontrar un buen lugar para cenar o preparar el paseo de mañana? ¿En qué puedo ayudarte?",
    ],
    night: [
      "🌙 ¡Buenas noches! Perfecto para cenas especiales, fiestas y programar las aventuras de mañana. ¿En qué puedo ayudarte?",
      "✨ ¡Buenas noches! Podemos explorar la vida nocturna o planificar las mejores rutas para mañana. ¿En qué puedo ayudarte?",
      "🌌 ¡Buenas noches! Un momento ideal para disfrutar, bailar o soñar con nuevas aventuras. ¿En qué puedo ayudarte?",
    ],
    late_night: [
      "🌌 ¡Buenas noches! Es tarde, pero aún podemos planificar tus experiencias para mañana. ¿En qué puedo ayudarte?",
      "🌙 ¡Buenas noches! Descansa bien y prepárate para un nuevo día lleno de aventuras. ¿En qué puedo ayudarte?",
      "🌃 ¡Buenas noches! Es un buen momento para relajarse y soñar con los próximos paseos. ¿En qué puedo ayudarte?",
    ],
  },
  he: {
    morning: [
      "🌞 בוקר טוב! יום מושלם לחקור חופים יפים ולגלות את הקסם של מורו דה סאו פאולו. איך אני יכול לעזור לך?",
      "🌅 בוקר טוב! השמש זורחת ומחכה לך יום מלא בהרפתקאות. איך אני יכול לעזור לך?",
      "🌞 בוקר טוב! הזמן הטוב ביותר לטיולים על החוף ולגילוי מקומות מיוחדים. איך אני יכול לעזור לך?",
    ],
    lunch: [
      "🍽️ צהריים טובים! רוצה להכיר את המסעדות המקומיות ולנוח על החוף? איך אני יכול לעזור לך?",
      "☀️ צהריים טובים! זמן מצוין ליהנות מארוחה טובה ואז להמשיך לטייל. איך אני יכול לעזור לך?",
      "🍴 צהריים טובים! זמן מושלם ליהנות ממסעדה טובה ולאחר מכן לחקור את האזור. איך אני יכול לעזור לך?",
    ],
    afternoon: [
      "☀️ צהריים טובים! מזג האוויר מושלם להנות מהחופים ומהנופים היפים. איך אני יכול לעזור לך?",
      "🌞 צהריים טובים! יש עוד הרבה מה לגלות — חופים, טיולים, וכל מה שתרצה. איך אני יכול לעזור לך?",
      "🌤️ צהריים טובים! רוצה לגלות חופים חדשים ולהירגע בשמש? איך אני יכול לעזור לך?",
    ],
    pre_dinner: [
      "🌇 ערב טוב! רוצה למצוא מסעדה מיוחדת או לתכנן הרפתקה חדשה? איך אני יכול לעזור לך?",
      "🌆 ערב טוב! זמן מצוין להנות מהאוכל המקומי ולהתחיל לתכנן את מחר. איך אני יכול לעזור לך?",
      "🌃 ערב טוב! בוא נבחר מקום נחמד לארוחת ערב או נתכנן את הטיול הבא. איך אני יכול לעזור לך?",
    ],
    night: [
      "🌙 ערב טוב! זה הזמן לארוחה טעימה, מסיבות או לתכנון מחר. איך אני יכול לעזור לך?",
      "✨ ערב טוב! אפשר לגלות את חיי הלילה או להתחיל לארגן טיולים למחר. איך אני יכול לעזור לך?",
      "🌌 ערב טוב! הזדמנות מצוינת ליהנות, לרקוד ולחלום על ההרפתקה הבאה. איך אני יכול לעזור לך?",
    ],
    late_night: [
      "🌌 ערב טוב! זה מאוחר, אבל נוכל לתכנן הרפתקאות למחר. איך אני יכול לעזור לך?",
      "🌙 ערב טוב! זמן מצוין לנוח ולהתכונן ליום מלא חוויות. איך אני יכול לעזור לך?",
      "🌃 ערב טוב! זה הזמן להירגע ולתכנן את המסלול הבא. איך אני יכול לעזור לך?",
    ],
  },
};

// Mensagens especiais de primeira visita
const firstVisitMessages = {
  pt: "🎉 Bem-vindo ao Morro Digital! Eu sou o guia virtual oficial de Morro de São Paulo e de um jeito fácil e inteligente vou te ajudar a explorar pontos turísticos, praias, restaurantes, festas, passeios, hospedagens e tudo o que você precisa na palma da mão. Como posso te ajudar? 😄",
  en: "🎉 Welcome to Morro Digital! I am your official virtual guide to Morro de São Paulo, ready to help you easily explore tourist spots, beaches, restaurants, parties, tours, and everything you need at your fingertips. How can I help you? 😄",
  es: "🎉 ¡Bienvenido a Morro Digital! Soy tu guía virtual oficial de Morro de São Paulo y te ayudaré de forma fácil e inteligente a explorar playas, restaurantes, fiestas, paseos y todo lo que necesites en la palma de tu mano. ¿En qué puedo ayudarte? 😄",
  he: "🎉 ברוך הבא ל-Morro Digital! אני המדריך הווירטואלי הרשמי שלך במורו דה סאו פאולו, ואעזור לך בקלות לחקור חופים, מסעדות, טיולים ואטרקציות. איך אני יכול לעזור לך? 😄",
};

// Função para gerar a mensagem de boas-vindas
export function buildWelcomeMessage(lang = "pt") {
  // Normalize o idioma e use fallback para pt se necessário
  const normalizedLang =
    lang && typeof lang === "string" ? lang.toLowerCase() : "pt";

  // First visit message - com verificação de idioma suportado
  if (isFirstVisit()) {
    return firstVisitMessages[normalizedLang] || firstVisitMessages["pt"];
  }

  // Regular welcome message - com verificações de segurança
  const period = getPrecisePeriodOfDay();

  // Verificações de segurança para evitar erros
  if (!welcomeMessages[normalizedLang]) {
    console.warn(
      `[buildWelcomeMessage] Idioma não suportado: ${normalizedLang}, usando português`
    );
    lang = "pt";
  }

  const messages = welcomeMessages[normalizedLang];

  if (!messages[period]) {
    console.warn(
      `[buildWelcomeMessage] Período não encontrado: ${period}, usando morning`
    );
    const fallbackMessages =
      messages["morning"] || welcomeMessages["pt"]["morning"];
    return fallbackMessages[0];
  }

  const variations = messages[period];
  const randomIndex = Math.floor(Math.random() * variations.length);
  return variations[randomIndex];
}
