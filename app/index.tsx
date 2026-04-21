import Slider from '@react-native-community/slider';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type LightColor = { name: string; value: string };

const COLORS: LightColor[] = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Warm White', value: '#FFE8BA' },
  { name: 'Amber', value: '#FFC26F' },
  { name: 'Orange', value: '#FF8833' },
  { name: 'Red', value: '#E61919' },
];

function scaleColor(hex: string, brightness: number): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * brightness);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * brightness);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * brightness);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function ScreenLight() {
  const [selectedColor, setSelectedColor] = useState<string>(COLORS[0].value);
  const [brightness, setBrightness] = useState<number>(1);

  const displayColor = scaleColor(selectedColor, brightness);

  return (
    <View style={[styles.container, { backgroundColor: displayColor }]}>
      <StatusBar hidden />
      <SafeAreaView style={styles.controlsWrapper} edges={['bottom']}>
        <View style={styles.controls}>
          <View style={styles.colorRow}>
            {COLORS.map((color) => {
              const isSelected = selectedColor === color.value;
              return (
                <Pressable
                  key={color.value}
                  onPress={() => setSelectedColor(color.value)}
                  accessibilityLabel={color.name}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.colorButton,
                    { backgroundColor: color.value },
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
            minimumTrackTintColor="#FFFFFF"
            maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
            thumbTintColor="#FFFFFF"
          />
        </View>
      </SafeAreaView>
    </View>
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
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  colorButtonSelected: {
    borderColor: '#FFFFFF',
    borderWidth: 3,
    transform: [{ scale: 1.15 }],
  },
  slider: {
    width: '100%',
    height: 40,
  },
});
