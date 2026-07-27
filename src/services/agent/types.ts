/**
 * Teacher Agent — shared types
 *
 * The Teacher Agent uses an MCP-style "tool" abstraction:
 *   - Each tool has a JSON-schema parameter spec (compatible with
 *     OpenRouter / OpenAI function calling AND with the Model Context
 *     Protocol tool format).
 *   - Tools execute via existing application services (studentService,
 *     announcementService, resourceService, aiGrading, lessonPlan, ...).
 *   - The teacher's Supabase session enforces RLS, so the agent can only
 *     touch what that teacher is allowed to see/change in the dashboard.
 */

export type ToolCategory = 'read' | 'write' | 'navigate' | 'ai';

/**
 * - safe        : auto-execute (read-only, navigation helpers, draft-only AI)
 * - write       : requires teacher approval (creates / updates DB rows, triggers AI grading)
 * - destructive : requires teacher approval; UI emphasizes the danger
 */
export type ToolRiskLevel = 'safe' | 'write' | 'destructive';

export interface JsonSchemaProp {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: readonly (string | number)[];
  items?: JsonSchemaProp;
  properties?: Record<string, JsonSchemaProp>;
  required?: string[];
  /** UI hint for textarea fields (purely informational). */
  format?: string;
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, JsonSchemaProp>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  risk: ToolRiskLevel;
  parameters: ToolParameters;
  /** Human-readable label rendered above tool cards. */
  displayName?: string;
  /** Returns a short sentence summarising the call (e.g. "Create announcement: Math test Friday"). */
  summarize?: (args: Record<string, unknown>) => string;
}

export interface ToolContext {
  teacherId: string;
  teacherName: string;
  /** Optional language preference for AI sub-tools (e.g. lesson plan generator). */
  language?: 'english' | 'french' | 'pidgin' | 'hausa' | 'yoruba';
  /** Optional country preference (drives curriculum framing). */
  country?: 'cameroon' | 'nigeria';
}

export type ToolExecutor = (
  args: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<unknown>;

export interface RegisteredTool extends ToolDefinition {
  execute: ToolExecutor;
}

/* ── Conversation state ──────────────────────────────── */

export type ToolCallStatus =
  | 'pending_confirmation'
  | 'running'
  | 'success'
  | 'error'
  | 'denied';

export interface ToolCallRecord {
  /** id used to correlate with OpenRouter `tool_call_id`. */
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: ToolCallStatus;
  /** Result body (will be stringified to feed back to the model). */
  result?: unknown;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export type AgentRole = 'user' | 'assistant' | 'tool' | 'system';

export interface AgentMessage {
  id: string;
  role: AgentRole;
  /** Visible text. For tool messages this is a short label; the data lives in toolResult. */
  content: string;
  /** Assistant turns may contain one or more tool calls. */
  toolCalls?: ToolCallRecord[];
  /** For role === 'tool': the call id this message answers. */
  toolCallId?: string;
  /** For role === 'tool': the tool name (mirrors registry key). */
  toolName?: string;
  /** True when this row is a protocol placeholder until approve/deny replaces `content`. */
  toolPlaceholder?: boolean;
  createdAt: number;
}

/* ── OpenRouter request/response shapes (subset) ─────── */

export interface OpenRouterTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolParameters;
  };
}

export interface OpenRouterToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    /** Stringified JSON of arguments. */
    arguments: string;
  };
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  /** Required for `role === 'tool'`. */
  tool_call_id?: string;
  /** Set on assistant messages that are calling tools. */
  tool_calls?: OpenRouterToolCall[];
  /** Optional explicit `name` (used for tool messages by some providers). */
  name?: string;
}

export interface OpenRouterChoice {
  index: number;
  finish_reason: string;
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: OpenRouterToolCall[];
  };
}

export interface OpenRouterResponse {
  id: string;
  choices: OpenRouterChoice[];
}
