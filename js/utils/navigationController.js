/**
 * Atualiza a navegação em tempo real com base na posição do usuário
 * @param {Object} [userPos=null] - Posição atual do usuário (opcional)
 */
export function updateRealTimeNavigation(userPos = null) {
  try {
    // Validate the navigation state
    if (!navigationState.isActive || !navigationState.instructions) {
      return false;
    }

    // Get current user position
    const currentPos = userPos || userLocation;
    if (
      !currentPos ||
      !isValidCoordinate(currentPos.latitude, currentPos.longitude)
    ) {
      console.warn("[updateRealTimeNavigation] Invalid user position");
      return false;
    }

    // CRITICAL FIX: Use currentStepIndex from navigationState
    const currentStepIndex = navigationState.currentStepIndex || 0;

    // Find next step coordinates - Fix the reference to use currentStepIndex
    const nextStep = navigationState.instructions[currentStepIndex];

    // Verify we have a valid nextStep
    if (!nextStep) {
      console.warn(
        "[updateRealTimeNavigation] No valid step at index",
        currentStepIndex
      );
      return false;
    }

    const nextStepLat = nextStep.latitude || nextStep.lat;
    const nextStepLon = nextStep.longitude || nextStep.lon || nextStep.lng;

    // Check if coordinates are valid
    if (!isValidCoordinate(nextStepLat, nextStepLon)) {
      console.warn(
        "[updateRealTimeNavigation] Invalid step coordinates:",
        nextStep
      );
      return false;
    }

    // Calculate bearing to next step
    const bearing = calculateBearing(
      parseFloat(currentPos.latitude),
      parseFloat(currentPos.longitude),
      parseFloat(nextStepLat),
      parseFloat(nextStepLon)
    );

    // The SVG is pointing up (north), so we need to add 180 to make it point
    // in the direction of travel. This is the ONLY place we should adjust the angle.
    const correctedBearing = (bearing + 180) % 360;

    // 1. Update user marker with correct orientation
    updateUserMarker(
      currentPos.latitude,
      currentPos.longitude,
      correctedBearing, // Use corrected bearing
      currentPos.accuracy || 15
    );

    console.log(
      `[updateRealTimeNavigation] User marker oriented toward next step: ${correctedBearing.toFixed(
        1
      )}° (original: ${bearing.toFixed(1)}°)`
    );

    // 2. Rotate map if rotation is enabled
    if (navigationState.isRotationEnabled) {
      rotateMap(bearing); // Use original bearing for map rotation
    }

    // 3. Center map on user with appropriate offset
    centerMapOnUser(
      currentPos.latitude,
      currentPos.longitude,
      bearing, // Original bearing for calculating offset
      null // Use current zoom
    );

    // Rest of your function code...

    // IMPORTANT: Use navigationState.currentStepIndex consistently throughout the function
    // instead of mixing currentStep (which doesn't exist) and currentStepIndex

    return true;
  } catch (error) {
    console.error("[updateRealTimeNavigation] Error:", error);
    return false;
  }
}
