import fs from "fs";

// Carrega o arquivo GeoJSON
const geojson = JSON.parse(fs.readFileSync("dados.geojson", "utf8"));

// Estrutura inicial do arquivo locations.js
const locations = {
  beaches: [],
  restaurants: [],
  hotels: [],
  shops: [],
  attractions: [],
};

// Processa cada feature do GeoJSON
geojson.features.forEach((feature) => {
  const { properties, geometry } = feature;
  const { name, description } = properties || {};
  const [lon, lat] = geometry.coordinates;

  // Classifica os locais com base nas propriedades
  if (properties.natural === "beach") {
    locations.beaches.push({ name, lat, lon, description });
  } else if (properties.amenity === "restaurant") {
    locations.restaurants.push({ name, lat, lon, description });
  } else if (properties.tourism === "hotel") {
    locations.hotels.push({ name, lat, lon, description });
  } else if (properties.shop) {
    locations.shops.push({ name, lat, lon, description });
  } else if (
    properties.tourism === "attraction" ||
    properties.historic === "monument"
  ) {
    locations.attractions.push({ name, lat, lon, description });
  }
});

// Salva o resultado no formato do arquivo locations.js
fs.writeFileSync(
  "locations.js",
  `export const locations = ${JSON.stringify(locations, null, 2)};`
);

console.log("Arquivo locations.js gerado com sucesso!");
