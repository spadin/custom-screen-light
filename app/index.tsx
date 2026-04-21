import Slider from '@react-native-community/slider';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

type LightColor = { name: string; value: string };

const COLORS: LightColor[] = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Warm White', value: '#FFE8BA' },
  { name: 'Amber', value: '#FFC26F' },
  { name: 'Orange', value: '#FF8833' },
  { name: 'Red', value: '#E61919' },
];

const CONTROLS_MIN_BRIGHTNESS = 0.5;
const BRIGHTNESS_STEP = 0.1;
const FADE_DURATION = 220;

function scaleColor(hex: string, brightness: number): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * brightness);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * brightness);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * brightness);
  return `rgb(${r}, ${g}, ${b})`;
}

function dimmedWhite(brightness: number, alpha: number): string {
  const c = Math.round(255 * brightness);
  return `rgba(${c}, ${c}, ${c}, ${alpha})`;
}

export default function ScreenLight() {
  const [colorIndex, setColorIndex] = useState<number>(0);
  const [brightness, setBrightness] = useState<number>(1);
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: controlsVisible ? 1 : 0,
      duration: FADE_DURATION,
      useNativeDriver: true,
    }).start();
  }, [controlsVisible, opacity]);

  const selectedColor = COLORS[colorIndex].value;
  const displayColor = scaleColor(selectedColor, brightness);
  const controlsBrightness =
    CONTROLS_MIN_BRIGHTNESS + (1 - CONTROLS_MIN_BRIGHTNESS) * brightness;
  const selectedRing = dimmedWhite(controlsBrightness, 1);
  const unselectedRing = dimmedWhite(controlsBrightness, 0.25);
  const sliderMaxTrack = dimmedWhite(controlsBrightness, 0.3);

  const gesture = useMemo(() => {
    const cycleBy = (step: number) =>
      setColorIndex((i) => (i + step + COLORS.length) % COLORS.length);
    const adjustBrightness = (delta: number) =>
      setBrightness((b) => Math.max(0, Math.min(1, b + delta)));

    return Gesture.Race(
      Gesture.Fling()
        .direction(Directions.LEFT)
        .runOnJS(true)
        .onStart(() => cycleBy(1)),
      Gesture.Fling()
        .direction(Directions.RIGHT)
        .runOnJS(true)
        .onStart(() => cycleBy(-1)),
      Gesture.Fling()
        .direction(Directions.UP)
        .runOnJS(true)
        .onStart(() => adjustBrightness(BRIGHTNESS_STEP)),
      Gesture.Fling()
        .direction(Directions.DOWN)
        .runOnJS(true)
        .onStart(() => adjustBrightness(-BRIGHTNESS_STEP)),
    );
  }, []);

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.container, { backgroundColor: displayColor }]}>
        <StatusBar hidden />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setControlsVisible((v) => !v)}
        />
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
  slider: {
    width: '100%',
    height: 40,
  },
});
