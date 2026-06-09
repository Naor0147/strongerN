# TODO for Naor
- Verify the new background rest timer syncs correctly when the app is suspended for long periods.
- Test the new empty workout flow (starts with 0 exercises instead of Bench/Squat/Deadlift).
- Check the hitboxes for the Muscle Map (added pointerEvents="none" to the body skeleton overlay).
- The `expo-audio` integration for "My Routines" sounds is fully functional and uses the unified local `soundPlayer.ts` helpers. Verify the custom sound importer works as expected on physical Android devices.
- Ensure the keystore backup is maintained locally (`debug.keystore`).
