/**
 * Ferramenta para verificar a disponibilidade dos plugins necessários
 */
export function validateNavigationPlugins() {
  console.group("Validação de Plugins de Navegação");

  // Verificar Leaflet
  console.log(
    "Leaflet:",
    typeof L !== "undefined" ? "Disponível ✅" : "Não carregado ❌"
  );

  // Verificar plugins específicos se Leaflet estiver disponível
  if (typeof L !== "undefined") {
    console.log(
      "Marker Rotation:",
      typeof L.Marker.prototype.setRotationAngle === "function"
        ? "Disponível ✅"
        : "Não carregado ❌"
    );

    console.log(
      "Map Bearing:",
      typeof L.Map.prototype.setBearing === "function"
        ? "Disponível ✅"
        : "Não carregado ❌"
    );

    console.log(
      "Polyline Decorator:",
      typeof L.PolylineDecorator === "function"
        ? "Disponível ✅"
        : "Não carregado ❌"
    );
  }

  console.groupEnd();
}
