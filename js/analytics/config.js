export const ANALYTICS_CONFIG = {
  API_URL: {
    production: "https://api.morrodigital.com/analytics/track",
    development: "http://localhost:3000/analytics/track",
  },
  VERSION: "1.0.0",
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // Base delay in ms
};
