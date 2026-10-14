import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { colors, layout, radius, space } from "../theme/tokens";
import { IconButton } from "./Button";
import { Text } from "./Text";

/**
 * Bottom sheet used for action menus and short forms. Native apps put secondary
 * actions here rather than in the side rail the web dashboard can afford.
 */
export const Sheet = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.root}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SafeAreaView edges={["bottom"]} style={styles.panel}>
          <View style={styles.handle} />

          {title ? (
            <View style={styles.header}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="h3" weight="bold" numberOfLines={1}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text variant="micro" color={colors.textMuted} numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <IconButton accessibilityLabel="Close" onPress={onClose} size={34}>
                <X size={18} color={colors.textSecondary} />
              </IconButton>
            </View>
          ) : null}

          {scroll ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={styles.content}>{children}</View>
          )}

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  </Modal>
);

/** Single tappable line inside a Sheet, e.g. "Pause account" / "Delete". */
export const SheetAction = ({
  label,
  hint,
  icon,
  onPress,
  destructive,
}: {
  label: string;
  hint?: string;
  icon?: ReactNode;
  onPress: () => void;
  destructive?: boolean;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
  >
    {icon ? <View style={styles.actionIcon}>{icon}</View> : null}
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text variant="bodySm" weight="semibold" color={destructive ? colors.dangerText : colors.text}>
        {label}
      </Text>
      {hint ? (
        <Text variant="micro" color={colors.textMuted} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  scrim: { flex: 1, backgroundColor: colors.overlay },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    maxHeight: "88%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.gray300,
    marginTop: space.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: layout.hairline,
    borderBottomColor: colors.border,
  },
  scroll: { flexGrow: 0 },
  content: { padding: space.lg, gap: space.md },
  footer: {
    padding: space.lg,
    gap: space.sm,
    borderTopWidth: layout.hairline,
    borderTopColor: colors.border,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: layout.minTouch,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
  },
  actionPressed: { backgroundColor: colors.gray100 },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
});
