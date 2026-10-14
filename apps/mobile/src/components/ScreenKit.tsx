import type { ReactNode } from "react";
import { usePathname } from "expo-router";
import type { TextStyle } from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { DashboardShell } from "../navigation/DashboardShell";
import { navItemForPath } from "../navigation/navConfig";
import { Button, Input, ListRow } from "../ui";

/**
 * Compatibility layer over `src/ui` + `DashboardShell`. Feature screens were
 * written against this API, so keeping the surface identical lets every one of
 * them pick up the new design system without touching each file.
 */

export {
  EmptyState,
  SectionLabel,
  StatCard,
  confirmDelete,
  showError,
  showSuccess,
} from "../ui";

export const ScreenShell = ({
  title,
  subtitle,
  loading,
  children,
  rightAction,
  scroll = true,
  padded = true,
  showBack,
  refreshing,
  onRefresh,
  footer,
}: {
  title: string;
  subtitle?: string;
  loading?: boolean;
  children: ReactNode;
  rightAction?: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  showBack?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
}) => {
  // Screens on this layer pass an English title. The drawer already holds a
  // translated label for every console route, so prefer that when one exists.
  const { t } = useLanguage();
  const navItem = navItemForPath(usePathname());
  const translated = navItem ? t(navItem.labelKey) : undefined;
  const heading = translated && translated !== navItem?.labelKey ? translated : title;

  return (
    <DashboardShell
      title={heading}
      subtitle={subtitle}
      loading={loading}
      refreshing={refreshing}
      onRefresh={onRefresh}
      showBack={showBack}
      scroll={scroll}
      padded={padded}
      headerRight={rightAction}
      footer={footer}
    >
      {children}
    </DashboardShell>
  );
};

export const CardRow = ({
  title,
  subtitle,
  onPress,
  onLongPress,
  meta,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  onPress?: () => void;
  onLongPress?: () => void;
}) => (
  <ListRow
    title={title}
    subtitle={subtitle}
    meta={meta}
    onPress={onPress}
    onLongPress={onLongPress}
    chevron={!!onPress}
  />
);

export const PrimaryButton = ({
  label,
  onPress,
  disabled,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) => (
  <Button
    label={label}
    onPress={onPress}
    disabled={disabled}
    variant={variant === "secondary" ? "outline" : variant}
  />
);

export const Field = ({
  value,
  onChangeText,
  placeholder,
  multiline,
  secureTextEntry,
  autoCapitalize = "sentences",
  keyboardType = "default",
  style,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  style?: TextStyle;
}) => (
  <Input
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    multiline={multiline}
    password={secureTextEntry}
    autoCapitalize={autoCapitalize}
    keyboardType={keyboardType}
    inputStyle={style}
  />
);
