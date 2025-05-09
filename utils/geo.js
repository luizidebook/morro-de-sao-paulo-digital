export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Raio da Terra em km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000; // Converte para metros
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

export function calculateEstimatedDuration(distance) {
  const walkingSpeedMps = 1.4; // 5 km/h em metros por segundo
  return distance / walkingSpeedMps;
}
