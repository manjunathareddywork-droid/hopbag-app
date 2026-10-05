import Tabs, { type BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { t, type StringKey } from '@/i18n';
import { colors, fonts, radius, spacing } from '@/theme';

const TABS: { name: string; icon: IconName; label: StringKey }[] = [
  { name: 'index', icon: 'home', label: 'tabs.home' },
  { name: 'requests', icon: 'box', label: 'tabs.requests' },
  { name: 'trips', icon: 'navigation', label: 'tabs.trips' },
  { name: 'chat', icon: 'message-square', label: 'tabs.chat' },
  { name: 'me', icon: 'user', label: 'tabs.me' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
      tabBar={(props) => <TabBar {...props} />}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: t(tab.label) }} />
      ))}
    </Tabs>
  );
}

/** White bar; the current tab's icon sits on a peach pill, as in the designs. */
function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {state.routes.map((route, index) => {
        const tab = TABS.find((x) => x.name === route.name);
        if (!tab) return null;
        const focused = state.index === index;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={t(tab.label)}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={styles.tab}
          >
            <View style={[styles.pill, focused && styles.pillOn]}>
              <Icon name={tab.icon} size={22} />
            </View>
            <Text style={[styles.label, focused && styles.labelOn]}>{t(tab.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, minHeight: 56 },
  pill: {
    width: 60,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOn: { backgroundColor: colors.peachTint },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  labelOn: { fontFamily: fonts.bold, color: colors.text },
});
