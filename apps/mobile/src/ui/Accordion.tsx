import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { colors, layout, space } from "../theme/tokens";
import { Text } from "./Text";

export interface AccordionItem {
  id: string;
  question: string;
  answer: string;
}

const Chevron = ({ open }: { open: boolean }) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [open, progress]);

  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <ChevronDown size={16} color={colors.textMuted} />
    </Animated.View>
  );
};

const Answer = ({ children }: { children: string }) => {
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [fade]);

  return (
    <Animated.View
      style={{
        opacity: fade,
        transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] }) }],
      }}
    >
      <Text variant="caption" color={colors.textSecondary} style={styles.answer}>
        {children}
      </Text>
    </Animated.View>
  );
};

/** Collapsible question list, the native counterpart of the web FAQ accordion. */
export const Accordion = ({ items }: { items: AccordionItem[] }) => {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <View>
      {items.map((item, index) => {
        const open = openId === item.id;
        return (
          <View key={item.id} style={index > 0 ? styles.divider : undefined}>
            <Pressable
              onPress={() => setOpenId((current) => (current === item.id ? null : item.id))}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              hitSlop={layout.hitSlop}
              style={styles.trigger}
            >
              <Text variant="bodySm" weight="semibold" style={{ flex: 1 }}>
                {item.question}
              </Text>
              <Chevron open={open} />
            </Pressable>
            {open ? <Answer>{item.answer}</Answer> : null}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  divider: { borderTopWidth: layout.hairline, borderTopColor: colors.border },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
  },
  answer: { paddingBottom: space.md, lineHeight: 20 },
});
