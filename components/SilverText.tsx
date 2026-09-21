import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleProp, Text, TextStyle, View } from 'react-native';
import { silverGradient } from '../theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  colors?: readonly string[];
};

/**
 * Renders text filled with a brushed-metal silver gradient.
 */
export function SilverText({ children, style, colors = silverGradient }: Props) {
  return (
    <MaskedView
      maskElement={
        <View style={{ backgroundColor: 'transparent' }}>
          <Text style={style}>{children}</Text>
        </View>
      }
    >
      <LinearGradient
        colors={colors as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}
