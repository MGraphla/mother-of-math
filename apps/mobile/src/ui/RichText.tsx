import { StyleSheet, View } from "react-native";
import { colors, radius, space } from "../theme/tokens";
import { Text } from "./Text";

type Block =
  | { kind: "h1" | "h2" | "h3" | "p"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "number"; text: string; index: string }
  | { kind: "rule" };

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*(\d+)[.)]\s+/;

const parse = (source: string): Block[] => {
  const blocks: Block[] = [];

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;

    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      blocks.push({ kind: "rule" });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      blocks.push({ kind: level === 1 ? "h1" : level === 2 ? "h2" : "h3", text: heading[2] });
      continue;
    }

    if (BULLET.test(line)) {
      blocks.push({ kind: "bullet", text: line.replace(BULLET, "") });
      continue;
    }

    const numbered = NUMBERED.exec(line);
    if (numbered) {
      blocks.push({ kind: "number", index: numbered[1], text: line.replace(NUMBERED, "") });
      continue;
    }

    // A short line wrapped in ** on both ends reads as a heading in AI output.
    const bold = /^\*\*(.+)\*\*:?$/.exec(line.trim());
    if (bold) {
      blocks.push({ kind: "h3", text: bold[1] });
      continue;
    }

    blocks.push({ kind: "p", text: line });
  }

  return blocks;
};

/** Strips the inline emphasis markers Markdown uses; RN has no inline parser. */
const clean = (text: string) =>
  text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(?<!\*)\*(?!\s)(.+?)(?<!\s)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();

/**
 * Renders the light Markdown the AI endpoints return: headings, bullets,
 * numbered steps and paragraphs. Keeps lesson plans and analyses readable
 * without pulling in a full Markdown engine.
 */
export const RichText = ({ source }: { source: string }) => {
  const blocks = parse(source);

  if (blocks.length === 0) {
    return (
      <Text variant="bodySm" color={colors.textMuted}>
        {source.trim()}
      </Text>
    );
  }

  return (
    <View style={styles.root}>
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "rule":
            return <View key={i} style={styles.rule} />;
          case "h1":
            return (
              <Text key={i} variant="h2" weight="extrabold" style={styles.h1}>
                {clean(block.text)}
              </Text>
            );
          case "h2":
            return (
              <Text key={i} variant="h3" weight="bold" style={styles.h2}>
                {clean(block.text)}
              </Text>
            );
          case "h3":
            return (
              <Text
                key={i}
                variant="caption"
                weight="bold"
                color={colors.brandDeep}
                uppercase
                style={styles.h3}
              >
                {clean(block.text)}
              </Text>
            );
          case "bullet":
            return (
              <View key={i} style={styles.listRow}>
                <View style={styles.dot} />
                <Text variant="bodySm" style={styles.listText}>
                  {clean(block.text)}
                </Text>
              </View>
            );
          case "number":
            return (
              <View key={i} style={styles.listRow}>
                <View style={styles.numberChip}>
                  <Text variant="micro" weight="bold" color={colors.brandDeep} tabular>
                    {block.index}
                  </Text>
                </View>
                <Text variant="bodySm" style={styles.listText}>
                  {clean(block.text)}
                </Text>
              </View>
            );
          default:
            return (
              <Text key={i} variant="bodySm" style={styles.paragraph}>
                {clean(block.text)}
              </Text>
            );
        }
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { gap: space.sm },
  h1: { marginTop: space.sm },
  h2: { marginTop: space.sm },
  h3: { marginTop: space.sm, letterSpacing: 0.6 },
  paragraph: { lineHeight: 22, color: colors.textSecondary },
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  listText: { flex: 1, lineHeight: 22, color: colors.textSecondary },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.brand,
    marginTop: 8,
  },
  numberChip: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: radius.full,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  rule: { height: 1, backgroundColor: colors.border, marginVertical: space.sm },
});
