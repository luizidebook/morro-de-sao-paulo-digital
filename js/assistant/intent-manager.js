import { openSubmenu } from "../ui/submenu.js";

export const intents = [
  {
    keywords: ["praias", "mar"],
    response: "Aqui estão todas as praias disponíveis. Estou exibindo no mapa.",
    action: (context) => showAllLocationsOnMap(locations.beaches),
  },
  {
    keywords: ["restaurantes", "comida"],
    response:
      "Aqui estão todos os restaurantes disponíveis. Estou exibindo no mapa.",
    action: (context) => showAllLocationsOnMap(locations.restaurants),
  },
  {
    keywords: ["hotéis", "pousadas"],
    response:
      "Aqui estão todos os hotéis e pousadas disponíveis. Estou exibindo no mapa.",
    action: (context) => showAllLocationsOnMap(locations.hotels),
  },
  {
    keywords: ["lojas", "compras"],
    response: "Aqui estão todas as lojas disponíveis. Estou exibindo no mapa.",
    action: (context) => showAllLocationsOnMap(locations.shops),
  },
  {
    keywords: ["atrações", "pontos turísticos"],
    response:
      "Aqui estão todas as atrações disponíveis. Estou exibindo no mapa.",
    action: (context) => showAllLocationsOnMap(locations.attractions),
  },
];
