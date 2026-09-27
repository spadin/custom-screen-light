import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import * as Brightness from 'expo-brightness';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import ColorPicker from 'react-native-wheel-color-picker';

type LightColor = { name: string; value: string };

const COLORS: LightColor[] = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Warm White', value: '#FFE8BA' },
  { name: 'Amber', value: '#FFC26F' },
  { name: 'Orange', value: '#FF8833' },
  { name: 'Red', value: '#E61919' },
];

const CUSTOM_INDEX = COLORS.length;
const TOTAL_COLORS = COLORS.length + 1;
const DEFAULT_CUSTOM_COLOR = '#FF00FF';
const RAINBOW = [
  '#FF0000',
  '#FF8800',
  '#FFFF00',
  '#00CC00',
  '#0088FF',
  '#AA00FF',
  '#FF0000',
] as const;
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

SplashScreen.preventAutoHideAsync();

const CONTROLS_MIN_BRIGHTNESS = 0.5;
const BRIGHTNESS_PAN_SENSITIVITY = 300;
const FADE_DURATION = 220;
const STORAGE_KEY = 'screen-light:state:v1';
const PERSIST_DEBOUNCE_MS = 300;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function scaleColor(hex: string, brightness: number): string {
  const b = clamp01(brightness);
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * b);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * b);
  const bl = Math.round(parseInt(hex.slice(5, 7), 16) * b);
  return `rgb(${r}, ${g}, ${bl})`;
}

function dimmedWhite(brightness: number, alpha: number): string {
  const c = Math.round(255 * clamp01(brightness));
  return `rgba(${c}, ${c}, ${c}, ${alpha})`;
}

export default function ScreenLight() {
  const [colorIndex, setColorIndex] = useState<number>(0);
  const [brightness, setBrightness] = useState<number>(1);
  const [customColor, setCustomColor] = useState<string>(DEFAULT_CUSTOM_COLOR);
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [pickerDraft, setPickerDraft] = useState<string>(DEFAULT_CUSTOM_COLOR);
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [opacity] = useState(() => new Animated.Value(1));
  const brightnessRef = useRef<number>(1);
  const panStartBrightnessRef = useRef<number>(1);

  useEffect(() => {
    brightnessRef.current = brightness;
    Brightness.setBrightnessAsync(brightness).catch(() => {});
  }, [brightness]);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (
              typeof parsed?.colorIndex === 'number' &&
              Number.isInteger(parsed.colorIndex) &&
              parsed.colorIndex >= 0 &&
              parsed.colorIndex < TOTAL_COLORS
            ) {
              setColorIndex(parsed.colorIndex);
            }
            if (
              typeof parsed?.brightness === 'number' &&
              Number.isFinite(parsed.brightness)
            ) {
              setBrightness(clamp01(parsed.brightness));
            }
            if (
              typeof parsed?.customColor === 'string' &&
              HEX_COLOR_RE.test(parsed.customColor)
            ) {
              setCustomColor(parsed.customColor);
            }
          } catch {
            // ignore malformed JSON
          }
        }
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ colorIndex, brightness, customColor })
      ).catch(() => {});
    }, PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [hydrated, colorIndex, brightness, customColor]);

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync();
  }, [hydrated]);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: controlsVisible ? 1 : 0,
      duration: FADE_DURATION,
      useNativeDriver: true,
    }).start();
  }, [controlsVisible, opacity]);

  const selectedHex =
    colorIndex < COLORS.length ? COLORS[colorIndex].value : customColor;
  const effectiveHex = pickerOpen ? pickerDraft : selectedHex;
  const displayColor = scaleColor(effectiveHex, brightness);
  const controlsBrightness =
    CONTROLS_MIN_BRIGHTNESS + (1 - CONTROLS_MIN_BRIGHTNESS) * clamp01(brightness);
  const selectedRing = dimmedWhite(controlsBrightness, 1);
  const unselectedRing = dimmedWhite(controlsBrightness, 0.25);
  const sliderMaxTrack = dimmedWhite(controlsBrightness, 0.3);

  const { swipeAndPan, backgroundTap } = useMemo(() => {
    const cycleBy = (step: number) =>
      setColorIndex((i) => (i + step + TOTAL_COLORS) % TOTAL_COLORS);

    const flingLeft = Gesture.Fling()
      .direction(Directions.LEFT)
      .runOnJS(true)
      .onStart(() => cycleBy(1));

    const flingRight = Gesture.Fling()
      .direction(Directions.RIGHT)
      .runOnJS(true)
      .onStart(() => cycleBy(-1));

    const verticalPan = Gesture.Pan()
      .activeOffsetY([-10, 10])
      .failOffsetX([-30, 30])
      .runOnJS(true)
      // These callbacks read refs, but they run on gesture events after render,
      // never during it. The rule can't see through the deferred closure.
      // eslint-disable-next-line react-hooks/refs
      .onStart(() => {
        panStartBrightnessRef.current = brightnessRef.current;
      })
      // eslint-disable-next-line react-hooks/refs
      .onUpdate((event) => {
        const dy = event.translationY;
        if (typeof dy !== 'number' || !Number.isFinite(dy)) return;
        const next = panStartBrightnessRef.current - dy / BRIGHTNESS_PAN_SENSITIVITY;
        setBrightness(clamp01(next));
      });

    const tap = Gesture.Tap()
      .maxDistance(10)
      .maxDuration(300)
      .runOnJS(true)
      .onStart(() => setControlsVisible((v) => !v));

    return {
      swipeAndPan: Gesture.Race(flingLeft, flingRight, verticalPan),
      backgroundTap: tap,
    };
  }, []);

  const isCustomSelected = colorIndex === CUSTOM_INDEX;

  return (
    <GestureDetector gesture={swipeAndPan}>
      <View style={[styles.container, { backgroundColor: displayColor }]}>
        {Platform.OS !== 'ios' && <StatusBar hidden />}
        <GestureDetector gesture={backgroundTap}>
          <View style={StyleSheet.absoluteFill} />
        </GestureDetector>
        <SafeAreaView
          style={[styles.controlsWrapper, { pointerEvents: 'box-none' }]}
          edges={['bottom']}
        >
          <Animated.View
            style={[
              styles.controls,
              {
                opacity,
                pointerEvents: controlsVisible ? 'auto' : 'none',
              },
            ]}
          >
            <View style={styles.colorRow}>
              {COLORS.map((color, index) => {
                const isSelected = colorIndex === index;
                return (
                  <Pressable
                    key={color.value}
                    onPress={() => setColorIndex(index)}
                    accessibilityLabel={color.name}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.colorButton,
                      {
                        backgroundColor: scaleColor(color.value, controlsBrightness),
                        borderColor: isSelected ? selectedRing : unselectedRing,
                      },
                      isSelected && styles.colorButtonSelected,
                    ]}
                  />
                );
              })}
              <Pressable
                onPress={() => setColorIndex(CUSTOM_INDEX)}
                onLongPress={() => {
                  setPickerDraft(customColor);
                  setPickerOpen(true);
                }}
                delayLongPress={400}
                accessibilityLabel="Custom color"
                accessibilityHint="Long press to choose a custom color"
                accessibilityRole="button"
                accessibilityState={{ selected: isCustomSelected }}
              >
                <LinearGradient
                  colors={RAINBOW}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.customRing,
                    isCustomSelected
                      ? styles.customRingSelected
                      : styles.customRingUnselected,
                  ]}
                >
                  <View
                    style={[
                      styles.customInner,
                      {
                        backgroundColor: scaleColor(customColor, controlsBrightness),
                      },
                    ]}
                  />
                </LinearGradient>
              </Pressable>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={brightness}
              onValueChange={setBrightness}
              minimumTrackTintColor={selectedRing}
              maximumTrackTintColor={sliderMaxTrack}
              thumbTintColor={selectedRing}
            />
          </Animated.View>
        </SafeAreaView>
        <Modal
          visible={pickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setPickerOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Custom Color</Text>
              <View style={styles.pickerWrapper}>
                <ColorPicker
                  color={pickerDraft}
                  onColorChange={setPickerDraft}
                  thumbSize={32}
                  sliderSize={28}
                  noSnap
                  row={false}
                  swatches={false}
                />
              </View>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setPickerOpen(false)}
                  style={[styles.modalBtn, styles.modalBtnSecondary]}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setCustomColor(pickerDraft);
                    setColorIndex(CUSTOM_INDEX);
                    setPickerOpen(false);
                  }}
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                >
                  <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>
                    Done
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  controlsWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  controls: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  colorRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 12,
  },
  colorButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
  },
  colorButtonSelected: {
    borderWidth: 3,
    transform: [{ scale: 1.15 }],
  },
  customRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customRingUnselected: {
    padding: 3,
    opacity: 0.7,
  },
  customRingSelected: {
    padding: 4,
    transform: [{ scale: 1.15 }],
  },
  customInner: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: 22,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1c1c1e',
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  pickerWrapper: {
    height: 320,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  modalBtnPrimary: {
    backgroundColor: '#fff',
  },
  modalBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalBtnTextPrimary: {
    color: '#000',
  },
});
