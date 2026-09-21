import { CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackground } from '../../components/AppBackground';
import { GhostButton, PrimaryButton } from '../../components/Buttons';
import { Icon } from '../../components/Icon';
import { PressableScale } from '../../components/PressableScale';
import { ProductResultSheet } from '../../components/ProductResultSheet';
import { ShimmerText } from '../../components/ShimmerText';
import { SilverText } from '../../components/SilverText';
import { FoodProduct, lookupFood, verdictLabel } from '../../lib/food';
import { addHistory, toggleFavorite, useHistory } from '../../lib/history';
import { useReducedMotion } from '../../lib/motion';
import { playScanBeep } from '../../lib/scanBeep';
import { useSettings } from '../../lib/settings';
import { colors, font, radius, spacing } from '../../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const FRAME = Math.min(SCREEN_W * 0.72, 300);

const BARCODE_TYPES = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code39',
  'code93',
  'code128',
  'codabar',
  'itf14',
] as const;

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const history = useHistory();
  const reduced = useReducedMotion();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [product, setProduct] = useState<FoodProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const lockRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());

  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const lockFlash = useRef(new Animated.Value(0)).current;
  const frameGlow = useRef(new Animated.Value(0.35)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;

  const favorite = product
    ? !!history.items.find((h) => h.barcode === product.barcode)?.favorite
    : false;

  // Defer camera mount one tick — avoids a native race that can kill Expo on cold start.
  useEffect(() => {
    const t = setTimeout(() => setCameraReady(true), 150);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (product || loading || reduced || manualOpen) {
      scanAnim.setValue(0);
      pulseAnim.setValue(0);
      return;
    }
    const beam = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 2200,
          easing: Easing.bezier(0.4, 0.0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.bezier(0.4, 0.0, 0.2, 1),
          useNativeDriver: true,
        }),
      ])
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(frameGlow, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(frameGlow, {
          toValue: 0.4,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    beam.start();
    pulse.start();
    glow.start();
    return () => {
      beam.stop();
      pulse.stop();
      glow.stop();
    };
  }, [scanAnim, pulseAnim, frameGlow, product, loading, reduced, manualOpen]);

  useEffect(() => {
    seenRef.current.clear();
  }, [settings.continuousScan]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        seenRef.current.clear();
        lockRef.current = false;
      };
    }, [])
  );

  const feedback = useCallback(() => {
    if (settings.haptics && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    if (settings.sound) {
      playScanBeep();
    }
  }, [settings.haptics, settings.sound]);

  const showBanner = useCallback(
    (msg: string) => {
      setBanner(msg);
      Animated.sequence([
        Animated.timing(bannerOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(1100),
        Animated.timing(bannerOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setBanner(null);
      });
    },
    [bannerOpacity]
  );

  const fireLockFlash = useCallback(() => {
    lockFlash.setValue(0);
    Animated.sequence([
      Animated.timing(lockFlash, { toValue: 1, duration: 90, useNativeDriver: true }),
      Animated.timing(lockFlash, { toValue: 0, duration: 420, useNativeDriver: true }),
    ]).start();
  }, [lockFlash]);

  const resolveBarcode = useCallback(
    async (code: string) => {
      setLoading(true);
      setProduct(null);
      try {
        const result = await lookupFood(code);
        setProduct(result);
        if (settings.saveScans && result.found) {
          await addHistory({
            barcode: result.barcode,
            name: result.name,
            brand: result.brand,
            verdict: result.verdict,
            rating: result.rating,
            nutriscore: result.nutriscore,
            nova: result.nova,
            imageUrl: result.imageUrl,
          });
        }
        AccessibilityInfo.announceForAccessibility(
          `${result.name}. ${verdictLabel(result.verdict, result.rating)}.`
        );
      } finally {
        setLoading(false);
      }
    },
    [settings.saveScans]
  );

  const handleBarcode = useCallback(
    (data: string) => {
      const code = data.trim();
      if (!code) return;

      if (settings.continuousScan) {
        if (seenRef.current.has(code)) return;
        seenRef.current.add(code);
        feedback();
        fireLockFlash();
        lookupFood(code).then((result) => {
          if (settings.saveScans && result.found) {
            addHistory({
              barcode: result.barcode,
              name: result.name,
              brand: result.brand,
              verdict: result.verdict,
              rating: result.rating,
              nutriscore: result.nutriscore,
              nova: result.nova,
              imageUrl: result.imageUrl,
            }).catch(() => {});
          }
          showBanner(result.name);
        });
        return;
      }

      if (lockRef.current) return;
      lockRef.current = true;
      feedback();
      fireLockFlash();
      resolveBarcode(code).catch(() => {
        lockRef.current = false;
      });
    },
    [settings.continuousScan, settings.saveScans, feedback, resolveBarcode, showBanner, fireLockFlash]
  );

  const closeSheet = () => {
    setProduct(null);
    setLoading(false);
    lockRef.current = false;
  };

  const pickImage = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (picked.canceled || !picked.assets?.[0]?.uri) return;
    try {
      const scanned = await scanFromURLAsync(picked.assets[0].uri, [...BARCODE_TYPES]);
      const hit = scanned?.[0];
      if (!hit?.data) {
        showBanner('No barcode found');
        return;
      }
      handleBarcode(hit.data);
    } catch {
      showBanner('Could not read image');
    }
  };

  const submitManual = () => {
    const code = manualCode.replace(/\D/g, '');
    if (code.length < 8) {
      Alert.alert('Invalid barcode', 'Enter at least 8 digits (EAN/UPC).');
      return;
    }
    setManualOpen(false);
    setManualCode('');
    handleBarcode(code);
  };

  const beamY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, FRAME - 20],
  });
  const beamOpacity = scanAnim.interpolate({
    inputRange: [0, 0.12, 0.5, 0.88, 1],
    outputRange: [0.35, 1, 1, 1, 0.35],
  });
  const trailOpacity = scanAnim.interpolate({
    inputRange: [0, 0.15, 0.5, 0.85, 1],
    outputRange: [0.12, 0.32, 0.4, 0.32, 0.12],
  });
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.035],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.08, 0.28],
  });
  const cornerOpacity = frameGlow;

  if (!permission) {
    return <AppBackground />;
  }

  if (!permission.granted) {
    return (
      <AppBackground>
        <View style={[styles.center, { paddingTop: insets.top + 40 }]}>
          <ShimmerText style={styles.brand}>CERES</ShimmerText>
          <SilverText style={styles.permTitle}>Camera access</SilverText>
          <Text style={styles.permBody}>
            Ceres needs the camera to read product barcodes at the shelf.
          </Text>
          <PrimaryButton label="Allow camera" icon="scan" onPress={requestPermission} />
          <GhostButton label="Enter barcode" icon="tag" onPress={() => setManualOpen(true)} />
        </View>
        {manualOpen ? (
          <ManualEntry
            value={manualCode}
            onChange={setManualCode}
            onSubmit={submitManual}
            onClose={() => setManualOpen(false)}
          />
        ) : null}
      </AppBackground>
    );
  }

  return (
    <View style={styles.root}>
      {cameraReady ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={
            product || loading || manualOpen
              ? undefined
              : ({ data }) => {
                  handleBarcode(data);
                }
          }
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.void }]} />
      )}
      <LinearGradient
        colors={['rgba(4,4,5,0.72)', 'transparent', 'rgba(4,4,5,0.85)']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <ShimmerText style={styles.brand}>CERES</ShimmerText>
        <View style={styles.topActions}>
          <PressableScale
            onPress={() => setManualOpen(true)}
            style={styles.iconBtn}
            accessibilityLabel="Enter barcode manually"
          >
            <Icon name="tag" size={20} color={colors.silver} />
          </PressableScale>
          <PressableScale onPress={pickImage} style={styles.iconBtn} accessibilityLabel="Scan from photo">
            <Icon name="image" size={20} color={colors.silver} />
          </PressableScale>
          <PressableScale
            onPress={() => setTorch((t) => !t)}
            style={styles.iconBtn}
            accessibilityLabel={torch ? 'Turn torch off' : 'Turn torch on'}
          >
            <Icon name={torch ? 'flash' : 'flashOff'} size={20} color={colors.silver} />
          </PressableScale>
        </View>
      </View>

      <View style={styles.frameWrap} pointerEvents="none">
        <View style={[styles.frame, { width: FRAME, height: FRAME }]}>
          {!product && !loading && !reduced && !manualOpen ? (
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  opacity: pulseOpacity,
                  transform: [{ scale: pulseScale }],
                },
              ]}
            />
          ) : null}
          <View style={styles.frameGrid} pointerEvents="none">
            <View style={[styles.gridLine, styles.gridH, { top: '33%' }]} />
            <View style={[styles.gridLine, styles.gridH, { top: '66%' }]} />
            <View style={[styles.gridLine, styles.gridV, { left: '33%' }]} />
            <View style={[styles.gridLine, styles.gridV, { left: '66%' }]} />
          </View>
          <Animated.View style={[styles.corner, styles.tl, { opacity: cornerOpacity }]} />
          <Animated.View style={[styles.corner, styles.tr, { opacity: cornerOpacity }]} />
          <Animated.View style={[styles.corner, styles.bl, { opacity: cornerOpacity }]} />
          <Animated.View style={[styles.corner, styles.br, { opacity: cornerOpacity }]} />
          {!product && !loading && !reduced && !manualOpen ? (
            <>
              <Animated.View
                style={[
                  styles.beamTrail,
                  { opacity: trailOpacity, transform: [{ translateY: beamY }] },
                ]}
              >
                <LinearGradient
                  colors={[
                    'transparent',
                    'rgba(214,217,223,0.08)',
                    'rgba(214,217,223,0.28)',
                    'rgba(255,255,255,0.55)',
                    'rgba(214,217,223,0.28)',
                    'rgba(214,217,223,0.08)',
                    'transparent',
                  ]}
                  locations={[0, 0.18, 0.38, 0.5, 0.62, 0.82, 1]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              <Animated.View
                style={[
                  styles.beamCoreWrap,
                  { opacity: beamOpacity, transform: [{ translateY: beamY }] },
                ]}
              >
                <LinearGradient
                  colors={['transparent', colors.silverBright, 'transparent']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.beamCore}
                />
              </Animated.View>
            </>
          ) : null}
          <Animated.View
            pointerEvents="none"
            style={[styles.lockFlash, { opacity: lockFlash }]}
          />
        </View>
        <Text style={styles.hint}>
          {loading ? 'Reading label…' : 'Align a food barcode inside the frame'}
        </Text>
      </View>

      {banner ? (
        <Animated.View style={[styles.banner, { opacity: bannerOpacity, bottom: insets.bottom + 110 }]}>
          <Text style={styles.bannerText} numberOfLines={1}>
            {banner}
          </Text>
        </Animated.View>
      ) : null}

      {manualOpen ? (
        <ManualEntry
          value={manualCode}
          onChange={setManualCode}
          onSubmit={submitManual}
          onClose={() => setManualOpen(false)}
        />
      ) : null}

      <ProductResultSheet
        product={product}
        loading={loading}
        onClose={closeSheet}
        onRescan={closeSheet}
        favorite={favorite}
        onToggleFavorite={
          product
            ? () => {
                const item = history.items.find((h) => h.barcode === product.barcode);
                if (item) toggleFavorite(item.id).catch(() => {});
              }
            : undefined
        }
      />
    </View>
  );
}

function ManualEntry({
  value,
  onChange,
  onSubmit,
  onClose,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.manualRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <Pressable style={styles.manualScrim} onPress={onClose} accessibilityLabel="Dismiss" />
        <View
          style={[
            styles.manualSheet,
            { paddingBottom: Math.max(insets.bottom, 16) + 12 },
          ]}
        >
          <View style={styles.manualGrab} />
          <Text style={styles.manualTitle}>Enter barcode</Text>
          <Text style={styles.manualHint}>Useful when the camera can’t lock on.</Text>
          <TextInput
            value={value}
            onChangeText={(t) => onChange(t.replace(/[^\d]/g, '').slice(0, 18))}
            keyboardType="number-pad"
            placeholder="e.g. 3017620422003"
            placeholderTextColor={colors.textTertiary}
            style={styles.manualInput}
            autoFocus
            selectionColor={colors.silver}
          />
          <View style={styles.manualActions}>
            <PrimaryButton label="Look up" icon="search" onPress={onSubmit} style={{ flex: 1 }} />
            <GhostButton icon="close" onPress={onClose} compact />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const CORNER = 22;
const THICK = 2.5;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.void },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    gap: spacing.lg,
  },
  brand: {
    fontFamily: font.displayBold,
    fontSize: 18,
    letterSpacing: 6,
  },
  permTitle: {
    fontFamily: font.display,
    fontSize: 26,
    textAlign: 'center',
  },
  permBody: {
    fontFamily: font.bodyReg,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topActions: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: 'rgba(8,8,10,0.55)',
  },
  frameWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  frame: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  pulseRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.silverMid,
  },
  frameGrid: {
    ...StyleSheet.absoluteFill,
    opacity: 0.18,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: colors.silverDim,
  },
  gridH: {
    left: 12,
    right: 12,
    height: StyleSheet.hairlineWidth,
  },
  gridV: {
    top: 12,
    bottom: 12,
    width: StyleSheet.hairlineWidth,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: colors.silverBright,
  },
  tl: { top: 0, left: 0, borderTopWidth: THICK, borderLeftWidth: THICK },
  tr: { top: 0, right: 0, borderTopWidth: THICK, borderRightWidth: THICK },
  bl: { bottom: 0, left: 0, borderBottomWidth: THICK, borderLeftWidth: THICK },
  br: { bottom: 0, right: 0, borderBottomWidth: THICK, borderRightWidth: THICK },
  beamTrail: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 56,
    marginTop: -28,
  },
  beamCoreWrap: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 14,
    marginTop: -7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beamCore: {
    width: '100%',
    height: 2,
    borderRadius: 1,
  },
  lockFlash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(214,218,224,0.22)',
  },
  hint: {
    fontFamily: font.body,
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  banner: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(14,14,17,0.88)',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  bannerText: {
    fontFamily: font.bodySemi,
    fontSize: 13,
    color: colors.silver,
  },
  manualRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  manualScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  manualSheet: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: 10,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: 'rgba(12,12,15,0.98)',
  },
  manualGrab: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.steel,
    marginBottom: 4,
  },
  manualTitle: {
    fontFamily: font.display,
    fontSize: 18,
    color: colors.textPrimary,
  },
  manualHint: {
    fontFamily: font.bodyReg,
    fontSize: 13,
    color: colors.textSecondary,
  },
  manualInput: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontFamily: font.bodySemi,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.textPrimary,
  },
  manualActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
});
