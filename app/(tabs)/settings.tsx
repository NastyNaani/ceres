import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackground } from '../../components/AppBackground';
import { Icon, IconName } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { PressableScale } from '../../components/PressableScale';
import { Toggle } from '../../components/Toggle';
import { clearHistory, exportHistory, importHistory, useHistory } from '../../lib/history';
import { ALLERGEN_PRESETS, Settings, useSettings } from '../../lib/settings';
import { colors, font, radius, spacing } from '../../theme';

type BoolKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

const ROWS: { key: BoolKey; icon: IconName; label: string; hint: string }[] = [
  { key: 'haptics', icon: 'sparkle', label: 'Haptics', hint: 'Vibrate on a successful scan' },
  { key: 'sound', icon: 'flash', label: 'Scan sound', hint: 'Soft tone when a barcode locks' },
  { key: 'continuousScan', icon: 'scan', label: 'Continuous scan', hint: 'Keep reading without opening results' },
  { key: 'saveScans', icon: 'history', label: 'Save scans', hint: 'Store products in History on-device' },
];

const CAPS = [100, 300, 1000];

async function writeExportFile(json: string) {
  const file = new File(Paths.cache, 'ceres-history.json');
  if (!file.exists) file.create();
  file.write(json);
  return file;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { settings, update, toggleAllergen } = useSettings();
  const history = useHistory();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const onExport = async () => {
    try {
      const json = await exportHistory();
      try {
        const file = await writeExportFile(json);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'application/json',
            dialogTitle: 'Export Ceres history',
            UTI: 'public.json',
          });
          return;
        }
      } catch {
        /* fall through */
      }
      await Share.share({ message: json });
    } catch {
      Alert.alert('Export failed', 'Could not read your history.');
    }
  };

  const onImportFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', 'public.json'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = new File(result.assets[0].uri);
      const raw = await file.text();
      const added = await importHistory(raw);
      Alert.alert(
        'Import complete',
        added > 0
          ? `Added ${added} product${added === 1 ? '' : 's'}.`
          : 'Everything in that export is already in History.'
      );
    } catch {
      Alert.alert('Import failed', 'That file does not look like a Ceres export.');
    }
  };

  const onClear = () => {
    Alert.alert('Clear history?', 'This removes every saved product from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => clearHistory().catch(() => {}),
      },
    ]);
  };

  return (
    <AppBackground>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: spacing.xl,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          kicker="CERES"
          title="Settings"
          subtitle={`v${version}`}
          right={
            <View style={styles.headerBadge}>
              <Icon name="settings" size={18} color={colors.silver} />
            </View>
          }
        />

        <Section title="Scanning" subtitle="How Ceres behaves at the shelf">
          {ROWS.map((row, i) => (
            <Row
              key={row.key}
              icon={row.icon}
              label={row.label}
              hint={row.hint}
              last={i === ROWS.length - 1}
            >
              <Toggle value={settings[row.key]} onChange={(v) => update(row.key, v)} />
            </Row>
          ))}
        </Section>

        <Section title="Allergen watch" subtitle="Highlight matches on the label — not a diagnosis">
          <View style={styles.allergenWrap}>
            {ALLERGEN_PRESETS.map((name) => {
              const on = settings.allergenWatch.includes(name);
              return (
                <PressableScale
                  key={name}
                  onPress={() => toggleAllergen(name)}
                  style={[styles.allergenChip, on && styles.allergenChipOn]}
                >
                  {on ? <Icon name="check" size={12} color={colors.danger} /> : null}
                  <Text style={[styles.allergenText, on && styles.allergenTextOn]}>{name}</Text>
                </PressableScale>
              );
            })}
          </View>
        </Section>

        <Section title="History" subtitle={`${history.items.length} saved · keep up to ${settings.historyCap}`}>
          <View style={styles.caps}>
            {CAPS.map((n) => {
              const active = settings.historyCap === n;
              return (
                <PressableScale
                  key={n}
                  onPress={() => update('historyCap', n)}
                  style={[styles.cap, active && styles.capActive]}
                >
                  <Text style={[styles.capText, active && styles.capTextActive]}>{n}</Text>
                  <Text style={[styles.capSub, active && styles.capSubActive]}>items</Text>
                </PressableScale>
              );
            })}
          </View>
        </Section>

        <Section title="Library">
          <Action icon="download" label="Export history" hint="JSON backup of this device" onPress={onExport} />
          <Action icon="plus" label="Import history" hint="Merge from a Ceres export" onPress={onImportFile} />
          <Action
            icon="trash"
            label="Clear history"
            hint="Removes every saved product"
            onPress={onClear}
            danger
            last
          />
        </Section>

        <Section title="About">
          <Action
            icon="shield"
            label="Privacy"
            hint="What Ceres stores and shares"
            onPress={() => router.push('/privacy')}
            last
          />
          <Text style={styles.about}>
            Product data from Open Food Facts. Scores combine Nutri-Score, NOVA, additives, macros,
            and a local ingredient read — not medical advice.
          </Text>
        </Section>
      </ScrollView>
    </AppBackground>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  hint,
  children,
  last,
}: {
  icon: IconName;
  label: string;
  hint: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={17} color={colors.silver} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      {children}
    </View>
  );
}

function Action({
  icon,
  label,
  hint,
  onPress,
  danger,
  last,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.action, last && styles.rowLast]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Icon name={icon} size={17} color={danger ? colors.danger : colors.silver} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Icon name="chevron" size={16} color={colors.textTertiary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
  },
  section: { gap: 10 },
  sectionHead: { gap: 4, paddingHorizontal: 4 },
  sectionTitle: {
    fontFamily: font.bodySemi,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  sectionSub: {
    fontFamily: font.bodyReg,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  rowIconDanger: {
    backgroundColor: colors.dangerDim,
    borderColor: 'rgba(224,138,146,0.28)',
  },
  rowLabel: {
    fontFamily: font.bodySemi,
    fontSize: 15,
    color: colors.textPrimary,
  },
  rowHint: {
    fontFamily: font.bodyReg,
    fontSize: 12.5,
    color: colors.textTertiary,
    lineHeight: 17,
  },
  caps: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  cap: {
    flex: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 2,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.elevated,
  },
  capActive: {
    borderColor: colors.hairlineStrong,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  capText: {
    fontFamily: font.displayMed,
    fontSize: 18,
    color: colors.textSecondary,
  },
  capTextActive: { color: colors.silverBright },
  capSub: {
    fontFamily: font.body,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  capSubActive: { color: colors.silverMid },
  allergenWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 14,
  },
  allergenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.elevated,
  },
  allergenChipOn: {
    borderColor: 'rgba(224,138,146,0.45)',
    backgroundColor: colors.dangerDim,
  },
  allergenText: {
    fontFamily: font.bodySemi,
    fontSize: 12.5,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  allergenTextOn: {
    color: colors.danger,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  about: {
    fontFamily: font.bodyReg,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 14,
  },
});
