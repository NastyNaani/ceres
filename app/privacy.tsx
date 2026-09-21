import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackground } from '../components/AppBackground';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { colors, font, radius, spacing } from '../theme';

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();

  return (
    <AppBackground>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: spacing.xl,
          gap: spacing.xl,
        }}
      >
        <View style={styles.top}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
            <View style={{ transform: [{ scaleX: -1 }] }}>
              <Icon name="chevron" size={22} color={colors.silver} />
            </View>
          </Pressable>
          <PageHeader kicker="CERES" title="Privacy" />
        </View>

        <Card title="On device first">
          History, favorites, and settings stay on your phone. Ceres does not require an account.
        </Card>
        <Card title="Camera">
          The camera is used only to read barcodes. Frames are not uploaded; only the decoded
          barcode digits are sent when looking up a product.
        </Card>
        <Card title="Open Food Facts">
          When you scan (or reopen) a product, the barcode is sent to Open Food Facts
          (openfoodfacts.org) to fetch name, Nutri-Score, NOVA, ingredients, and related fields.
          See their privacy policy for how they handle requests.
        </Card>
        <Card title="No ads or trackers">
          Ceres does not include analytics SDKs, ad networks, or crash reporters in this build.
        </Card>
      </ScrollView>
    </AppBackground>
  );
}

function Card({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { gap: spacing.lg },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: 8,
  },
  title: {
    fontFamily: font.bodySemi,
    fontSize: 15,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: font.bodyReg,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
});
