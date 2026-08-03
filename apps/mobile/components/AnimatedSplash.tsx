import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { LighthouseMark } from '@/components/LighthouseMark';
import { Lighthouse } from '@/theme/lighthouse';

const MIN_MS = 2200;
const FADE_MS = 520;

type Props = {
  ready: boolean;
  children: ReactNode;
};

const AnimatedView = Animated.View;

/** Night-sea splash with Joliguet mark + sweeping lantern beams. */
export function AnimatedSplash({ ready, children }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const progress = useSharedValue(0);
  const beam = useSharedValue(0);
  const glow = useSharedValue(0.55);
  const exit = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 1100,
      easing: Easing.out(Easing.cubic),
    });
    beam.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.45, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [beam, glow, progress]);

  useEffect(() => {
    if (!ready || dismissed) return;

    void SplashScreen.hideAsync().catch(() => undefined);

    const t = setTimeout(() => {
      exit.value = withTiming(
        1,
        { duration: FADE_MS, easing: Easing.inOut(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setDismissed)(true);
        },
      );
    }, MIN_MS);

    const hard = setTimeout(() => setDismissed(true), MIN_MS + FADE_MS + 400);
    return () => {
      clearTimeout(t);
      clearTimeout(hard);
    };
  }, [ready, dismissed, exit]);

  const shellStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [{ scale: interpolate(exit.value, [0, 1], [1, 1.04]) }],
  }));

  const markStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.35, 1], [0, 0.85, 1]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [36, 0]) },
      { scale: interpolate(progress.value, [0, 1], [0.88, 1]) },
    ],
  }));

  const wordStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.45, 0.85, 1], [0, 0.7, 1]),
    transform: [{ translateY: interpolate(progress.value, [0.45, 1], [14, 0]) }],
  }));

  const beamStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(beam.value, [0, 1], [-38, 38])}deg` }],
    opacity: interpolate(glow.value, [0.45, 1], [0.35, 0.75]),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.28,
    transform: [{ scale: interpolate(glow.value, [0.45, 1], [0.92, 1.12]) }],
  }));

  if (dismissed) {
    return <>{children}</>;
  }

  return (
    <View style={styles.root}>
      {ready ? children : null}
      <AnimatedView pointerEvents="none" style={[StyleSheet.absoluteFill, shellStyle]}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={Lighthouse.night} />
              <Stop offset="0.42" stopColor={Lighthouse.nightMid} />
              <Stop offset="0.78" stopColor={Lighthouse.seaDeep} />
              <Stop offset="1" stopColor={Lighthouse.sea} />
            </LinearGradient>
            <RadialGradient id="horizon" cx="50%" cy="62%" rx="70%" ry="28%">
              <Stop offset="0" stopColor={Lighthouse.seaFoam} stopOpacity={0.35} />
              <Stop offset="1" stopColor={Lighthouse.seaFoam} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#bg)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#horizon)" />
          <Circle cx="12%" cy="14%" r="1.4" fill="#E8F6F5" opacity={0.7} />
          <Circle cx="28%" cy="8%" r="1.1" fill="#E8F6F5" opacity={0.45} />
          <Circle cx="72%" cy="12%" r="1.6" fill="#E8F6F5" opacity={0.8} />
          <Circle cx="86%" cy="22%" r="1.1" fill="#E8F6F5" opacity={0.4} />
          <Circle cx="58%" cy="6%" r="1.2" fill="#E8F6F5" opacity={0.55} />
          <Circle cx="40%" cy="18%" r="1" fill="#E8F6F5" opacity={0.35} />
        </Svg>

        <View style={styles.stage}>
          <AnimatedView style={[styles.glowBlob, glowStyle]} />
          <AnimatedView style={[styles.beamPivot, beamStyle]}>
            <Svg width={420} height={220} viewBox="0 0 420 220">
              <Defs>
                <LinearGradient
                  id="beam"
                  x1="210"
                  y1="20"
                  x2="210"
                  y2="220"
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0" stopColor={Lighthouse.beaconSoft} stopOpacity={0.85} />
                  <Stop offset="0.55" stopColor={Lighthouse.beacon} stopOpacity={0.22} />
                  <Stop offset="1" stopColor={Lighthouse.beacon} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Path d="M210 18 L320 220 L100 220 Z" fill="url(#beam)" />
              <Path d="M210 18 L250 220 L170 220 Z" fill={Lighthouse.beaconSoft} opacity={0.35} />
            </Svg>
          </AnimatedView>

          <AnimatedView style={markStyle}>
            <LighthouseMark width={260} height={342} />
          </AnimatedView>

          <AnimatedView style={[styles.wordBlock, wordStyle]}>
            <Text style={styles.brand}>Portclos</Text>
            <Text style={styles.tag}>la maison, en partage</Text>
          </AnimatedView>
        </View>
      </AnimatedView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Lighthouse.night,
  },
  stage: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 36,
  },
  glowBlob: {
    position: 'absolute',
    top: '20%',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Lighthouse.beacon,
  },
  beamPivot: {
    position: 'absolute',
    top: '16%',
    width: 420,
    height: 220,
    alignItems: 'center',
    transformOrigin: '50% 0%',
  },
  wordBlock: {
    marginTop: 8,
    alignItems: 'center',
  },
  brand: {
    color: Lighthouse.foam,
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  tag: {
    marginTop: 6,
    color: 'rgba(232,246,245,0.72)',
    fontSize: 15,
    letterSpacing: 0.4,
  },
});
