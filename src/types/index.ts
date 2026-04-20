// ============================================================
// All Your Handover — Shared Type Definitions
// ============================================================

// --- User ---

export interface UserInfo {
  id: string;       // channel user id (e.g. Feishu open_id)
  name: string;     // display name
}

// --- Message & Content ---

export type ContentType = 'text' | 'image' | 'audio' | 'unknown';

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: Buffer;
  path?: string;     // local storage path after saving
}

export interface AudioContent {
  type: 'audio';
  data: Buffer;
  path?: string;    // local storage path after saving
}

export interface UnknownContent {
  type: 'unknown';
}

export type Content = TextContent | ImageContent | AudioContent | UnknownContent;

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  sender: UserInfo;
  content: Content;
  type: ContentType;
  timestamp: number;
  mentionsBot: boolean;
  mentionsSelf: boolean;
  mentionList: string[];
  parentId?: string;
}

// --- Commands ---

export type CommandType = 'HANDOVER_START';

export interface Command {
  type: CommandType;
  sender: UserInfo;
}

// --- Channel ---

export interface ChannelSettings {
  requireAccept: boolean;
  messageFilter: 'all' | 'mention';
}

export interface ChannelConfig {
  code: string;
  type: string;
  name: string;
  chatId: string;
  settings: ChannelSettings;
  isEnabled: boolean;
}

export interface FeishuPlatformConfig {
  appId: string;
  appSecret: string;
  verificationToken: string;
  encryptKey?: string;
}

export type PlatformConfig = FeishuPlatformConfig;

export interface ChannelsConfig {
  platforms: {
    feishu?: FeishuPlatformConfig;
    wecom?: Record<string, string>;
    dingtalk?: Record<string, string>;
  };
  channels: ChannelConfig[];
}

// --- Channel Adapter ---

export interface MessageContent {
  type: 'text';
  text: string;
}

export interface CardContent {
  title?: string;
  content: string;
  footer?: string;
  config?: Record<string, unknown>;
  elements?: CardElement[];
}

export interface CardElement {
  tag: string;
  content?: string;
  elements?: CardElement[];
  text?: string;
  type?: string;
  value?: Record<string, string>;
  confirm?: { title: string; content: string };
  actions?: CardElement[];
  folded?: boolean;
}

export interface ChannelAdapter {
  readonly type: string;
  readonly code: string;
  readonly name: string;

  initialize(config: { platform: PlatformConfig; chatId: string }): Promise<void>;
  receiveMessage(event: unknown): Promise<Message | null>;
  sendMessage(chatId: string, message: MessageContent): Promise<void>;
  sendCard(chatId: string, card: CardContent): Promise<string>;
  parseCommand(message: Message): Command | null;
  getUserInfo(userId: string): Promise<UserInfo>;
  getChatMembers(chatId: string): Promise<UserInfo[]>;
  fetchMessageContent(messageId: string): Promise<string | null>;
  addReaction?(messageId: string, emoji: string): Promise<void>;
}

// --- LLM ---

export interface AnalyzeTextParams {
  text: string;
  prompt: string;
}

export interface AnalyzeImageParams {
  imagePath: string;
  prompt: string;
}

export interface TranscribeParams {
  audioPath: string;
  prompt: string;
}

export interface GenerateHandoverParams {
  draft: string;
  template: string;
  previousHandover?: { id: string; date: string; body: string };
  systemPrompt?: string;
  soulPrompt?: string;
  experiencePrompt?: string;
}

export interface AnalyzeResult {
  category: string;
  content: string;
  urgency: 'high' | 'normal' | 'low';
}

export interface LLMProvider {
  readonly id: string;
  readonly type: string;
  readonly name: string;

  initialize(config: LLMProviderConfig): Promise<void>;
  analyzeText(params: AnalyzeTextParams & { soulPrompt?: string }): Promise<AnalyzeResult>;
  analyzeImage(params: AnalyzeImageParams & { soulPrompt?: string }): Promise<AnalyzeResult>;
  transcribeAudio(params: TranscribeParams & { soulPrompt?: string }): Promise<string>;
  generateHandover(params: GenerateHandoverParams): Promise<string>;
  chatCompletion(messages: Array<{ role: string; content: string | unknown[] }>, thinkingMode?: ThinkingMode): Promise<string>;
}

export interface LLMProviderConfig {
  id: string;
  name: string;
  type: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  isDefault: boolean;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LLMProvidersConfig {
  providers: LLMProviderConfig[];
  defaultProviderId: string | null;
}

export interface LLMTask {
  execute: () => Promise<unknown>;
  onSuccess: (result: unknown) => Promise<void> | void;
  onFailure: (error: Error) => Promise<void> | void;
  thinkingMode?: ThinkingMode;
}

// --- Draft (legacy, used by draft-service.ts) ---

export interface DraftRecord {
  messageId: string;
  type: ContentType;
  sender: UserInfo;
  rawContent: string;
  analysis: AnalyzeResult | null;
  status: 'pending_analysis' | 'analyzed';
  timestamp: Date;
}

// --- Draft Storage (new Harness structure) ---

export interface RawRecord {
  id: string;
  ts: string;
  sender: string;
  sender_name: string;
  type: ContentType;
  content: string;
  quoted_context: string | null;
}

export interface AnalysisItem {
  msgId: string;
  category: string;
  content: string;
  urgency: 'high' | 'normal' | 'low';
}

export interface AnalysisFile {
  lastUpdated: string;
  messageCount: number;
  items: AnalysisItem[];
}

export interface CompletenessCheckResult {
  totalRaw: number;
  totalAnalyzed: number;
  missing: number;
}

// --- Handover ---

export interface PendingHandover {
  channelCode: string;
  sender: {
    id: string;
    name: string;
  };
  content: string;
  createdAt: string;
}

export interface HandoverMeta {
  requireAccept: boolean;
  createdAt: string;
  completedAt?: string;
}

// --- Channel Runtime State ---

export interface ChannelRuntimeState {
  lastMessageAt: string | null;
  draftMessageCount: number;
}

// --- Card Callback ---

export interface CardAction {
  action: string;
  channelCode: string;
  operator: {
    open_id: string;
  };
  formValue?: Record<string, string>;
  chatId: string;
  messageId?: string;
}

// --- API Response ---

export interface ApiResponse {
  code: number;
  message?: string;
  data?: unknown;
}

// --- Agent Soul ---

export interface AgentSoul {
  persona: string;
  scenario?: string;
  customScenario?: string;
  constraints: string[];
  tone?: string;
}

export interface AgentSoulTemplate {
  id: string;
  name: string;
  description: string;
  soul: AgentSoul;
}

// --- Thinking Mode ---

export type ThinkingMode = 'quick' | 'standard' | 'deep';

// --- Experience (Agent Memory) ---

export interface ExperienceEntry {
  id: string;
  createdAt: string;
  source: 'edit' | 'dream';
  rule: string;
  context?: string;
}

export interface ExperienceFile {
  entries: ExperienceEntry[];
  lastDreamAt?: string;
}

// --- Dream ---

export interface DreamConfig {
  enabled: boolean;
  cronHour: number;
}