# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

- `npm run ios` / `npm run android` — build and launch a native dev client (`expo run:*`). Required for this project: AsyncStorage and `@react-native-community/slider` are native modules, so Expo Go will not work.
- `npm start` — start the Metro bundler against an already-installed dev client.
- `npm run lint` — `expo lint` (flat config extending `eslint-config-expo`).
- `npx tsc --noEmit` — typecheck. `strict: true`, no test framework is configured.
- EAS builds are configured in `eas.json` (development / preview / production profiles).

## Architecture

Single-screen Expo app. Entry is `expo-router/entry` (package.json `main`), which discovers routes from the `app/` directory.

- `app/_layout.tsx` — root layout wrapping the router `Stack` in `GestureHandlerRootView`. Required so gestures in `index.tsx` actually receive touches.
- `app/index.tsx` — the only screen (`ScreenLight`). Holds all state, gesture logic, and rendering.

State model in `index.tsx`:
- `colorIndex` (0–4 into `COLORS`) + `brightness` (0–1 float) drive the screen background and control-panel styling via two helpers, `scaleColor` (RGB multiply) and `dimmedWhite` (grayscale rgba).
- The controls panel never goes fully dark — its brightness is remapped through `CONTROLS_MIN_BRIGHTNESS` (0.5) so swatches and slider stay visible when the screen itself is near black.
- Persistence: both values are loaded from AsyncStorage on mount under `STORAGE_KEY` behind a `hydrated` flag (prevents the default state from clobbering the saved state), and written back on change debounced by `PERSIST_DEBOUNCE_MS` (300ms) — important because the pan gesture fires at ~60fps.
- Control fade: `controlsVisible` drives an `Animated.Value` opacity via `useEffect`, plus a `pointerEvents` toggle so the hidden panel doesn't swallow taps.

Gesture layout (`react-native-gesture-handler` v2):
- **Outer** `GestureDetector` runs `Gesture.Race(flingLeft, flingRight, verticalPan)`:
  - Flings cycle color. Note the mapping: swipe left → next color, swipe right → previous.
  - `verticalPan` adjusts brightness continuously. It uses `translationY` with a `panStartBrightnessRef` captured in `onStart` — **do not switch this back to `event.changeY`**: on the first update frame `changeY` can be `undefined`, producing `NaN` brightness, which then renders as invalid `rgb(NaN,NaN,NaN)` (transparent) and makes every color on screen disappear. `clamp01` is used everywhere brightness touches a color as a second line of defense.
- **Inner** `GestureDetector` sits on an `absoluteFill` view *behind* the controls and holds a strict `Gesture.Tap().maxDistance(10).maxDuration(300)` that toggles `controlsVisible`. The tight thresholds are deliberate: a looser tap (or a plain `Pressable`) fires on swipe releases.

Non-obvious gotcha — **`.runOnJS(true)` on every gesture is required**. `react-native-reanimated` + `react-native-worklets` are installed, so gesture callbacks auto-worklet-ize and crash when they touch React state setters. Any new gesture added here must call `.runOnJS(true)` before its callback.

## Config notes

- `app.json`: `experiments.reactCompiler: true`, `experiments.typedRoutes: true`. iOS bundle id `com.sandropadin.screenlight`; `ITSAppUsesNonExemptEncryption: false` is set for App Store submission. The new architecture and Android edge-to-edge are always on in SDK 57, so the old `newArchEnabled` / `edgeToEdgeEnabled` keys are gone.
- `tsconfig.json`: path alias `@/*` → project root.
- `ios/` and `android/` are generated prebuild output and are **gitignored** — never hand-edit them, the next `expo prebuild` wipes it. Durable native changes belong in a config plugin under `plugins/`.
- `plugins/withUISceneLifecycle.js` adopts the UIScene life cycle (scene manifest + `SceneDelegate`). iOS 27 refuses to launch without it, and the SDK 57 prebuild template doesn't wire it up. **This is temporary — delete it when upgrading to SDK 58**, whose template ships the same wiring; the file's header comment has the removal steps and what to verify afterwards. The plugin throws rather than silently no-op if the template's AppDelegate shape changes, so if prebuild fails there after an SDK bump, re-check it against the new template.
