import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  CheckCircle2,
  Copy,
  Headphones,
  HelpCircle,
  MessageSquare,
  Plus,
  Send,
  Ticket,
} from "lucide-react-native";
import { useAuth } from "../../../src/context/AuthContext";
import { useLanguage } from "../../../src/context/LanguageContext";
import { DashboardShell } from "../../../src/navigation/DashboardShell";
import {
  createTicket,
  listMyTickets,
  listTicketResponses,
  replyToTicket,
  type SupportTicket,
  type TicketPriority,
  type TicketResponse,
} from "../../../src/services/support";
import { colors, layout, radius, space } from "../../../src/theme/tokens";
import {
  Accordion,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  IconTile,
  Input,
  Select,
  Sheet,
  StatStrip,
  Text,
  showError,
  showSuccess,
} from "../../../src/ui";
import type { BadgeTone } from "../../../src/ui";

type Tab = "open" | "resolved";

const CATEGORY_KEYS = [
  "general",
  "technical",
  "account",
  "feature_request",
  "bug_report",
  "other",
] as const;

const PRIORITIES: TicketPriority[] = ["low", "medium", "high", "urgent"];
const FAQ_IDS = ["1", "2", "3", "4", "5"] as const;

const RESOLVED = ["resolved", "closed"];

const statusTone: Record<string, BadgeTone> = {
  open: "warning",
  in_progress: "info",
  waiting_response: "brand",
  resolved: "success",
  closed: "neutral",
};

const priorityTone: Record<TicketPriority, BadgeTone> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "danger",
};

export default function TeacherSupportScreen() {
  const { user, profile } = useAuth();
  const { t, language } = useLanguage();
  const locale = language === "fr" ? "fr-FR" : "en-GB";

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("open");

  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [open, setOpen] = useState<SupportTicket | null>(null);
  const [thread, setThread] = useState<TicketResponse[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const openedRef = useRef<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    setTickets(await listMyTickets(user.id));
  }, [user]);

  useEffect(() => {
    reload()
      .catch((e) => showError(t("support.loadFailed"), e))
      .finally(() => setLoading(false));
  }, [reload, t]);

  const stats = useMemo(
    () => ({
      total: tickets.length,
      open: tickets.filter((x) => !RESOLVED.includes(x.status)).length,
      resolved: tickets.filter((x) => RESOLVED.includes(x.status)).length,
    }),
    [tickets],
  );

  const visible = tickets.filter((x) =>
    tab === "open" ? !RESOLVED.includes(x.status) : RESOLVED.includes(x.status),
  );

  const categoryLabel = (value: string) =>
    CATEGORY_KEYS.includes(value as (typeof CATEGORY_KEYS)[number])
      ? t(`support.category.${value}`)
      : value;

  const submit = async () => {
    if (!user) return;
    if (!subject.trim() || !description.trim()) {
      setFormError(t("support.fieldsRequired"));
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await createTicket({
        userId: user.id,
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
      });
      setComposing(false);
      setSubject("");
      setDescription("");
      setCategory("general");
      setPriority("medium");
      setTab("open");
      await reload();
      showSuccess(t("support.created"), t("support.createdHint"));
    } catch (e) {
      showError(t("support.createFailed"), e);
    } finally {
      setSubmitting(false);
    }
  };

  const openTicket = async (ticket: SupportTicket) => {
    setOpen(ticket);
    setReply("");
    setThread([]);
    setThreadLoading(true);
    openedRef.current = ticket.id;
    try {
      const responses = await listTicketResponses(ticket.id);
      // Drop the result if the reader already moved to another ticket.
      if (openedRef.current !== ticket.id) return;
      setThread(responses);
    } catch (e) {
      showError(t("support.threadFailed"), e);
    } finally {
      if (openedRef.current === ticket.id) setThreadLoading(false);
    }
  };

  const send = async () => {
    if (!open || !user || !reply.trim()) return;
    setSending(true);
    try {
      await replyToTicket(open.id, user.id, reply.trim());
      setReply("");
      setThread(await listTicketResponses(open.id));
      await reload();
    } catch (e) {
      showError(t("support.replyFailed"), e);
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardShell
      title={t("sidebar.support")}
      subtitle={t("support.tagline")}
      loading={loading}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        try {
          await reload();
        } catch (e) {
          showError(t("support.loadFailed"), e);
        } finally {
          setRefreshing(false);
        }
      }}
      footer={
        <Button
          label={t("support.newTicket")}
          onPress={() => setComposing(true)}
          icon={<Plus size={18} color={colors.white} />}
        />
      }
    >
      <StatStrip
        items={[
          { label: t("common.all"), value: stats.total },
          { label: t("support.openTab"), value: stats.open },
          { label: t("support.resolvedTab"), value: stats.resolved },
        ]}
      />

      <View style={styles.tabs}>
        {(["open", "resolved"] as Tab[]).map((value) => (
          <Button
            key={value}
            label={`${value === "open" ? t("support.openTab") : t("support.resolvedTab")} (${
              value === "open" ? stats.open : stats.resolved
            })`}
            variant={tab === value ? "primary" : "outline"}
            size="sm"
            onPress={() => setTab(value)}
            style={{ flex: 1 }}
          />
        ))}
      </View>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Ticket size={24} color={colors.brandDeep} />}
          title={t("support.noTickets")}
          subtitle={tab === "open" ? t("support.noTicketsHint") : undefined}
        />
      ) : (
        visible.map((ticket) => (
          <Card
            key={ticket.id}
            accent={ticket.status === "waiting_response" ? colors.brand : undefined}
            onPress={() => void openTicket(ticket)}
          >
            <View style={styles.ticketHead}>
              <Text variant="bodySm" weight="bold" style={{ flex: 1 }} numberOfLines={2}>
                {ticket.subject}
              </Text>
              {ticket.response_count > 0 ? (
                <View style={styles.replies}>
                  <MessageSquare size={11} color={colors.textSecondary} />
                  <Text variant="micro" weight="bold" tabular color={colors.textSecondary}>
                    {`${ticket.response_count}`}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="micro" color={colors.textSecondary} numberOfLines={2}>
              {ticket.description}
            </Text>
            <View style={styles.badges}>
              <Badge label={t(`support.status.${ticket.status}`)} tone={statusTone[ticket.status] ?? "neutral"} />
              <Badge label={t(`support.priority.${ticket.priority}`)} tone={priorityTone[ticket.priority]} />
              <Badge label={categoryLabel(ticket.category)} tone="neutral" />
            </View>
            <Text variant="micro" color={colors.textMuted} style={{ marginTop: 6 }}>
              {new Date(ticket.created_at).toLocaleString(locale)}
            </Text>
          </Card>
        ))
      )}

      <Card>
        <CardHeader
          title={t("support.faq")}
          subtitle={t("support.faqHint")}
          icon={
            <IconTile size={40}>
              <HelpCircle size={19} color={colors.brandDeep} />
            </IconTile>
          }
        />
        <Accordion
          items={FAQ_IDS.map((id) => ({
            id,
            question: t(`support.faq${id}.q`),
            answer: t(`support.faq${id}.a`),
          }))}
        />
      </Card>

      <Sheet
        visible={composing}
        onClose={() => setComposing(false)}
        title={t("support.newTicket")}
        subtitle={t("support.newTicketHint")}
        footer={
          <Button
            label={t("support.submit")}
            onPress={submit}
            loading={submitting}
            icon={<Send size={17} color={colors.white} />}
          />
        }
      >
        <Input
          label={t("support.subject")}
          value={subject}
          onChangeText={(v) => {
            setSubject(v);
            if (formError) setFormError(null);
          }}
          placeholder={t("support.subjectPlaceholder")}
          required
        />
        <Select
          label={t("support.categoryLabel")}
          value={category}
          onChange={setCategory}
          options={CATEGORY_KEYS.map((value) => ({ value, label: t(`support.category.${value}`) }))}
        />
        <Select<TicketPriority>
          label={t("support.priorityLabel")}
          value={priority}
          onChange={setPriority}
          options={PRIORITIES.map((value) => ({ value, label: t(`support.priority.${value}`) }))}
        />
        <Input
          label={t("support.description")}
          value={description}
          onChangeText={(v) => {
            setDescription(v);
            if (formError) setFormError(null);
          }}
          placeholder={t("support.descriptionPlaceholder")}
          hint={t("support.descriptionHint")}
          error={formError}
          multiline
          required
        />
      </Sheet>

      <Sheet
        visible={!!open}
        onClose={() => setOpen(null)}
        title={open?.subject}
        subtitle={open ? `#${open.id.slice(0, 8)}` : undefined}
        footer={
          open && open.status !== "closed" ? (
            <View style={styles.replyRow}>
              <View style={{ flex: 1 }}>
                <Input
                  value={reply}
                  onChangeText={setReply}
                  placeholder={t("support.replyPlaceholder")}
                  multiline
                />
              </View>
              <Button
                label={t("common.send")}
                size="sm"
                loading={sending}
                disabled={!reply.trim()}
                icon={<Send size={16} color={colors.white} />}
                onPress={send}
              />
            </View>
          ) : open ? (
            <Text variant="micro" color={colors.textMuted} center>
              {t("support.closedHint")}
            </Text>
          ) : undefined
        }
      >
        {open ? (
          <>
            <View style={styles.metaRow}>
              <Badge label={t(`support.status.${open.status}`)} tone={statusTone[open.status] ?? "neutral"} />
              <Badge label={t(`support.priority.${open.priority}`)} tone={priorityTone[open.priority]} />
              <Button
                label={`#${open.id.slice(0, 8)}`}
                variant="ghost"
                size="sm"
                fullWidth={false}
                icon={<Copy size={14} color={colors.brandDark} />}
                onPress={async () => {
                  await Clipboard.setStringAsync(open.id);
                  showSuccess(t("students.copied"), t("support.idCopied"));
                }}
              />
            </View>

            <Bubble
              author={profile?.full_name ?? t("support.you")}
              badge={t("support.you")}
              message={open.description}
              timestamp={new Date(open.created_at).toLocaleString(locale)}
              mine
            />

            {threadLoading ? (
              <Text variant="micro" color={colors.textMuted} center>
                {t("support.loadingThread")}
              </Text>
            ) : thread.length === 0 ? (
              <View style={styles.waiting}>
                <IconTile size={44}>
                  <Headphones size={20} color={colors.brandDeep} />
                </IconTile>
                <Text variant="bodySm" weight="bold" center style={{ marginTop: space.sm }}>
                  {t("support.waitingTitle")}
                </Text>
                <Text variant="micro" color={colors.textMuted} center>
                  {t("support.waitingBody")}
                </Text>
              </View>
            ) : (
              thread.map((message) => {
                const fromSupport = message.user_role === "admin";
                return (
                  <Bubble
                    key={message.id}
                    author={fromSupport ? t("support.staff") : message.user_name || t("support.you")}
                    badge={fromSupport ? t("support.staff") : t("support.you")}
                    message={message.message}
                    timestamp={new Date(message.created_at).toLocaleString(locale)}
                    mine={!fromSupport}
                  />
                );
              })
            )}

            {open.resolution ? (
              <View style={styles.resolution}>
                <View style={styles.resolutionHead}>
                  <CheckCircle2 size={15} color={colors.emeraldText} />
                  <Text variant="micro" weight="bold" color={colors.emeraldText} uppercase>
                    {t("support.resolved")}
                  </Text>
                </View>
                <Text variant="caption" color={colors.text} style={{ marginTop: 4 }}>
                  {open.resolution}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </DashboardShell>
  );
}

const Bubble = ({
  author,
  badge,
  message,
  timestamp,
  mine,
}: {
  author: string;
  badge: string;
  message: string;
  timestamp: string;
  mine: boolean;
}) => (
  <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
    {mine ? (
      <Avatar name={author} size={32} letters={2} />
    ) : (
      <IconTile size={32}>
        <Headphones size={15} color={colors.brandDeep} />
      </IconTile>
    )}
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={[styles.bubbleMeta, mine && styles.bubbleMetaMine]}>
        <Text variant="micro" weight="bold" numberOfLines={1}>
          {author}
        </Text>
        <Badge label={badge} tone={mine ? "info" : "success"} />
      </View>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text variant="caption" color={colors.text} style={{ lineHeight: 20 }}>
          {message}
        </Text>
      </View>
      <Text
        variant="micro"
        color={colors.textMuted}
        style={[styles.stamp, mine && styles.stampMine]}
      >
        {timestamp}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: space.sm },
  ticketHead: { flexDirection: "row", alignItems: "flex-start", gap: space.sm, marginBottom: 4 },
  replies: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
  },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.md },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  replyRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  waiting: { alignItems: "center", paddingVertical: space.lg },
  bubbleRow: { flexDirection: "row", gap: space.sm },
  bubbleRowMine: { flexDirection: "row-reverse" },
  bubbleMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  bubbleMetaMine: { flexDirection: "row-reverse" },
  bubble: {
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: layout.hairline,
  },
  bubbleMine: {
    backgroundColor: colors.blueSoft,
    borderColor: colors.blueBorder,
    borderTopRightRadius: radius.xs,
  },
  bubbleTheirs: {
    backgroundColor: colors.emeraldSoft,
    borderColor: colors.emeraldBorder,
    borderTopLeftRadius: radius.xs,
  },
  stamp: { marginTop: 3 },
  stampMine: { textAlign: "right" },
  resolution: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.emeraldSoft,
    borderWidth: layout.hairline,
    borderColor: colors.emeraldBorder,
  },
  resolutionHead: { flexDirection: "row", alignItems: "center", gap: 6 },
});
