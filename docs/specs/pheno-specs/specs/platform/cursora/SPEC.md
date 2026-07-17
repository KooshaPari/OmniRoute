# Cursora Specification

**Version**: 1.0.0 | **Status**: Active | **Last Updated**: 2026-04-06

---

## 1. Executive Summary

Cursora is an AI-powered IDE integration framework for the Phenotype ecosystem. Built in TypeScript, it provides comprehensive tools for integrating AI-assisted development capabilities into code editors, with support for intelligent code completion, refactoring suggestions, and context-aware code generation.

This specification defines the complete architecture, API surface, data models, and operational characteristics of the Cursora system.

---

## 2. Architecture Overview

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              CURSORA ARCHITECTURE                                          │
│                        (IDE Integration Framework)                                         │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                           IDE ADAPTER LAYER                                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐ │  │
│  │  │   VSCode    │  │   IntelliJ  │  │   Neovim    │  │   Emacs                     │ │  │
│  │  │   Extension │  │   Plugin    │  │   Plugin    │  │   Mode                      │ │  │
│  │  │             │  │             │  │             │  │                             │ │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────────────┬───────────────┘ │  │
│  │         │                │                │                       │                 │  │
│  └─────────┼────────────────┼────────────────┼───────────────────────┼─────────────────┘  │
│            │                │                │                       │                    │
│  ┌─────────▼────────────────▼────────────────▼───────────────────────▼────────────────┐  │
│  │                           CORE API LAYER                                             │  │
│  │                                                                                       │  │
│  │   ┌─────────────────────────────────────────────────────────────────────────────┐   │  │
│  │   │                        EDITOR SERVICE                                          │   │  │
│  │   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │  │
│  │   │  │   Buffer    │  │   Cursor    │  │   Selection │  │   Document  │    │   │  │
│  │   │  │   Manager   │  │   Tracker   │  │   Manager   │  │   Service   │    │   │  │
│  │   │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │   │  │
│  │   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │  │
│  │   │  │   Syntax    │  │   Semantic  │  │   Symbol    │  │   Reference │    │   │  │
│  │   │  │   Analyzer  │  │   Analyzer  │  │   Provider  │  │   Provider  │    │   │  │
│  │   │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │   │  │
│  │   └─────────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                       │  │
│  │   ┌─────────────────────────────────────────────────────────────────────────────┐   │  │
│  │   │                        AI SERVICE                                              │   │  │
│  │   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │  │
│  │   │  │   Context   │  │   Prompt    │  │   Completion│  │   Suggestion│    │   │  │
│  │   │  │   Builder   │  │   Builder   │  │   Engine    │  │   Engine    │    │   │  │
│  │   │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │   │  │
│  │   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │  │
│  │   │  │   Code      │  │   Refactor  │  │   Explain   │  │   Test      │    │   │  │
│  │   │  │   Generator │  │   Engine    │  │   Engine    │  │   Generator │    │   │  │
│  │   │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │   │  │
│  │   └─────────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                       │  │
│  │   ┌─────────────────────────────────────────────────────────────────────────────┐   │  │
│  │   │                        LSP SERVICE                                             │   │  │
│  │   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │  │
│  │   │  │   Server    │  │   Protocol  │  │   Capabilities│  │   Diagnostics│   │   │  │
│  │   │  │   Handler   │  │   Adapter   │  │   Manager   │  │   Provider  │    │   │  │
│  │   │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │   │  │
│  │   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │  │
│  │   │  │   Hover     │  │   Definition│  │   Completion│  │   Signature │    │   │  │
│  │   │  │   Provider  │  │   Provider  │  │   Provider  │  │   Help      │    │   │  │
│  │   │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │   │  │
│  │   └─────────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                       │  │
│  │   ┌─────────────────────────────────────────────────────────────────────────────┐   │  │
│  │   │                        PROJECT SERVICE                                         │   │  │
│  │   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │  │
│  │   │  │   Workspace │  │   Indexer   │  │   Search    │  │   Navigation│    │   │  │
│  │   │  │   Manager   │  │   Service   │  │   Service   │  │   Service   │    │   │  │
│  │   │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │   │  │
│  │   └─────────────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────────────────────┘  │
│            │                │                │                       │                  │
│  ┌─────────▼────────────────▼────────────────▼───────────────────────▼────────────────┐  │
│  │                           AI BACKEND LAYER                                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐ │  │
│  │  │   OpenAI    │  │   Anthropic │  │   Local     │  │   Custom                    │ │  │
│  │  │   API       │  │   Claude    │  │   Models    │  │   Models                  │ │  │
│  │  │             │  │             │  │             │  │                             │ │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────────────┘ │  │
│  │                                                                                      │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 AI Feature Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │────▶│   Context   │────▶│   Prompt    │────▶│   AI        │
│   Action    │     │   Builder   │     │   Builder   │     │   Model     │
└─────────────┘     └──────┬──────┘     └─────────────┘     └──────┬──────┘
                           │                                        │
                           │ 1. Get current file                    │
                           │ 2. Get surrounding files               │
                           │ 3. Get project context                 │
                           │ 4. Get cursor position                 │
                           │ 5. Get relevant imports                  │
                           │ 6. Build dependency graph              │
                           │                                        │
                           ▼                                        ▼
                  ┌─────────────────────────────────────────────────────────────────┐
                  │                     CONTEXT WINDOW                                 │
                  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
                  │  │   Current   │  │   Related   │  │   System    │              │
                  │  │   File      │  │   Files     │  │   Prompt    │              │
                  │  └─────────────┘  └─────────────┘  └─────────────┘              │
                  └─────────────────────────────────────────────────────────────────┘
                                                                                    │
                                                                                    ▼
                                                                          ┌─────────────────┐
                                                                          │   Response      │
                                                                          │   Processing    │
                                                                          │                 │
                                                                          │ • Parse output    │
                                                                          │ • Validate        │
                                                                          │ • Format          │
                                                                          │ • Apply edits     │
                                                                          └────────┬────────┘
                                                                                   │
                                                                                   ▼
                                                                          ┌─────────────────┐
                                                                          │   IDE Display   │
                                                                          │                 │
                                                                          │ • Inline diffs  │
                                                                          │ • Suggestions   │
                                                                          │ • Hovers        │
                                                                          └─────────────────┘
```

---

## 3. Data Models

### 3.1 Core Domain Models (TypeScript)

```typescript
/**
 * Core domain models for Cursora
 * @module models
 */

// ============================================================================
// BASE TYPES
// ============================================================================

export type UUID = string;
export type FilePath = string;
export type Position = { line: number; character: number };
export type Range = { start: Position; end: Position };
export type URI = string;

// ============================================================================
// EDITOR MODELS
// ============================================================================

export interface Document {
  uri: URI;
  version: number;
  languageId: string;
  content: string;
  lineCount: number;
  isDirty: boolean;
  isUntitled: boolean;
  lastModified: Date;
}

export interface TextEdit {
  range: Range;
  newText: string;
  oldText?: string;
}

export interface WorkspaceEdit {
  changes: Map<URI, TextEdit[]>;
  documentChanges?: DocumentChange[];
}

export type DocumentChange =
  | { kind: 'create'; uri: URI }
  | { kind: 'rename'; oldUri: URI; newUri: URI; options?: { overwrite?: boolean; ignoreIfExists?: boolean } }
  | { kind: 'delete'; uri: URI; options?: { recursive?: boolean; ignoreIfNotExists?: boolean } };

export interface PositionInfo {
  uri: URI;
  position: Position;
  lineText: string;
  wordRange: Range;
  word: string;
}

export interface Selection {
  uri: URI;
  anchor: Position;
  active: Position;
  isReversed: boolean;
}

// ============================================================================
// AI MODELS
// ============================================================================

export interface AIRequest {
  id: UUID;
  type: AIRequestType;
  context: AIContext;
  prompt: string;
  options: AIOptions;
  timestamp: Date;
}

export type AIRequestType =
  | 'inline_completion'
  | 'chat_completion'
  | 'code_generation'
  | 'code_refactoring'
  | 'code_explanation'
  | 'test_generation'
  | 'documentation'
  | 'error_explanation';

export interface AIContext {
  document: Document;
  cursorPosition: Position;
  selection?: Selection;
  visibleRange?: Range;
  projectContext?: ProjectContext;
  recentEdits?: TextEdit[];
  relatedFiles?: RelatedFile[];
  imports?: ImportInfo[];
  symbols?: SymbolInfo[];
}

export interface ProjectContext {
  workspaceFolders: WorkspaceFolder[];
  activeProject?: ProjectInfo;
  dependencies: DependencyInfo[];
  languageConfig: LanguageConfiguration;
}

export interface WorkspaceFolder {
  uri: URI;
  name: string;
  index: number;
}

export interface ProjectInfo {
  name: string;
  type: ProjectType;
  rootPath: string;
  configFiles: string[];
}

export type ProjectType =
  | 'typescript'
  | 'javascript'
  | 'rust'
  | 'go'
  | 'python'
  | 'java'
  | 'kotlin'
  | 'cpp'
  | 'csharp'
  | 'ruby'
  | 'php'
  | 'swift'
  | 'other';

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'production' | 'development' | 'peer';
}

export interface LanguageConfiguration {
  languageId: string;
  fileExtensions: string[];
  commentSyntax: { line?: string; block?: { start: string; end: string } };
  stringSyntax: string[];
  importSyntax: string[];
}

export interface RelatedFile {
  uri: URI;
  relevanceScore: number;
  relationship: 'import' | 'export' | 'reference' | 'similar';
  content?: string;
}

export interface ImportInfo {
  source: string;
  symbols: string[];
  isDefault: boolean;
  uri?: URI;
}

export interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  range: Range;
  uri: URI;
  documentation?: string;
}

export type SymbolKind =
  | 'file'
  | 'module'
  | 'namespace'
  | 'package'
  | 'class'
  | 'method'
  | 'property'
  | 'field'
  | 'constructor'
  | 'enum'
  | 'interface'
  | 'function'
  | 'variable'
  | 'constant'
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'key'
  | 'null'
  | 'enumMember'
  | 'struct'
  | 'event'
  | 'operator'
  | 'typeParameter';

export interface AIOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  stream?: boolean;
}

export interface AIResponse {
  id: UUID;
  requestId: UUID;
  content: string;
  edits?: TextEdit[];
  explanation?: string;
  confidence: number;
  tokensUsed: TokenUsage;
  model: string;
  finishReason: 'stop' | 'length' | 'content_filter';
  timestamp: Date;
}

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface InlineCompletion {
  items: InlineCompletionItem[];
  isIncomplete: boolean;
}

export interface InlineCompletionItem {
  insertText: string;
  filterText?: string;
  range?: Range;
  command?: Command;
}

export interface Command {
  title: string;
  command: string;
  arguments?: unknown[];
}

// ============================================================================
// LSP MODELS
// ============================================================================

export interface ServerCapabilities {
  textDocumentSync?: TextDocumentSyncOptions;
  completionProvider?: CompletionOptions;
  hoverProvider?: boolean | HoverOptions;
  signatureHelpProvider?: SignatureHelpOptions;
  definitionProvider?: boolean | DefinitionOptions;
  typeDefinitionProvider?: boolean | TypeDefinitionOptions;
  implementationProvider?: boolean | ImplementationOptions;
  referencesProvider?: boolean | ReferenceOptions;
  documentHighlightProvider?: boolean | DocumentHighlightOptions;
  documentSymbolProvider?: boolean | DocumentSymbolOptions;
  codeActionProvider?: boolean | CodeActionOptions;
  codeLensProvider?: CodeLensOptions;
  formattingProvider?: boolean | DocumentFormattingOptions;
  rangeFormattingProvider?: boolean | DocumentRangeFormattingOptions;
  documentOnTypeFormattingProvider?: DocumentOnTypeFormattingOptions;
  renameProvider?: boolean | RenameOptions;
  documentLinkProvider?: DocumentLinkOptions;
  colorProvider?: boolean | DocumentColorOptions;
  foldingRangeProvider?: boolean | FoldingRangeOptions;
  executeCommandProvider?: ExecuteCommandOptions;
  selectionRangeProvider?: boolean | SelectionRangeOptions;
  semanticTokensProvider?: SemanticTokensOptions;
  linkedEditingRangeProvider?: boolean | LinkedEditingRangeOptions;
  callHierarchyProvider?: boolean | CallHierarchyOptions;
  monikerProvider?: boolean | MonikerOptions;
  workspaceSymbolProvider?: boolean | WorkspaceSymbolOptions;
}

export interface TextDocumentSyncOptions {
  openClose?: boolean;
  change?: TextDocumentSyncKind;
  willSave?: boolean;
  willSaveWaitUntil?: boolean;
  save?: boolean | SaveOptions;
}

export type TextDocumentSyncKind = 0 | 1 | 2;

export interface CompletionOptions {
  resolveProvider?: boolean;
  triggerCharacters?: string[];
  allCommitCharacters?: string[];
  workDoneProgress?: boolean;
}

export interface HoverOptions {
  workDoneProgress?: boolean;
}

export interface SignatureHelpOptions {
  triggerCharacters?: string[];
  retriggerCharacters?: string[];
  workDoneProgress?: boolean;
}

export interface DefinitionOptions {
  workDoneProgress?: boolean;
}

export type TypeDefinitionOptions = DefinitionOptions;
export type ImplementationOptions = DefinitionOptions;
export type ReferenceOptions = DefinitionOptions;
export type DocumentHighlightOptions = DefinitionOptions;
export type DocumentSymbolOptions = DefinitionOptions;

export interface CodeActionOptions {
  codeActionKinds?: CodeActionKind[];
  workDoneProgress?: boolean;
}

export type CodeActionKind =
  | ''
  | 'quickfix'
  | 'refactor'
  | 'refactor.extract'
  | 'refactor.inline'
  | 'refactor.rewrite'
  | 'source'
  | 'source.organizeImports';

export interface CodeLensOptions {
  resolveProvider?: boolean;
  workDoneProgress?: boolean;
}

export interface DocumentFormattingOptions {
  workDoneProgress?: boolean;
}

export type DocumentRangeFormattingOptions = DocumentFormattingOptions;

export interface DocumentOnTypeFormattingOptions {
  firstTriggerCharacter: string;
  moreTriggerCharacter?: string[];
}

export interface RenameOptions {
  prepareProvider?: boolean;
  workDoneProgress?: boolean;
}

export interface DocumentLinkOptions {
  resolveProvider?: boolean;
  workDoneProgress?: boolean;
}

export interface DocumentColorOptions {
  workDoneProgress?: boolean;
}

export interface FoldingRangeOptions {
  workDoneProgress?: boolean;
}

export interface ExecuteCommandOptions {
  commands: string[];
  workDoneProgress?: boolean;
}

export interface SelectionRangeOptions {
  workDoneProgress?: boolean;
}

export interface SemanticTokensOptions {
  legend: SemanticTokensLegend;
  range?: boolean | object;
  full?: boolean | { delta?: boolean };
  workDoneProgress?: boolean;
}

export interface SemanticTokensLegend {
  tokenTypes: string[];
  tokenModifiers: string[];
}

export interface LinkedEditingRangeOptions {
  workDoneProgress?: boolean;
}

export interface CallHierarchyOptions {
  workDoneProgress?: boolean;
}

export interface MonikerOptions {
  workDoneProgress?: boolean;
}

export interface WorkspaceSymbolOptions {
  workDoneProgress?: boolean;
}

export interface SaveOptions {
  includeText?: boolean;
}

// ============================================================================
// SUGGESTION MODELS
// ============================================================================

export interface Suggestion {
  id: UUID;
  type: SuggestionType;
  title: string;
  description?: string;
  edits: TextEdit[];
  confidence: number;
  category: SuggestionCategory;
  action?: Command;
}

export type SuggestionType =
  | 'completion'
  | 'refactoring'
  | 'optimization'
  | 'fix'
  | 'enhancement'
  | 'documentation'
  | 'test';

export type SuggestionCategory =
  | 'performance'
  | 'security'
  | 'maintainability'
  | 'correctness'
  | 'style'
  | 'best_practice';

export interface SuggestionContext {
  document: Document;
  range: Range;
  code: string;
  language: string;
  surroundingCode: string;
  imports: string[];
}

// ============================================================================
// CONFIGURATION MODELS
// ============================================================================

export interface CursoraConfig {
  version: string;
  ai: AIConfig;
  editor: EditorConfig;
  features: FeatureConfig;
  keybindings: KeybindingConfig;
  appearance: AppearanceConfig;
}

export interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  apiEndpoint?: string;
  temperature: number;
  maxTokens: number;
  contextWindow: number;
  enabledFeatures: AIFeature[];
  customPrompts?: Record<string, string>;
}

export type AIProvider = 'openai' | 'anthropic' | 'local' | 'custom';

export type AIFeature =
  | 'inline_completion'
  | 'chat'
  | 'code_generation'
  | 'refactoring'
  | 'explanation'
  | 'documentation'
  | 'test_generation'
  | 'error_help';

export interface EditorConfig {
  enableCodeLens: boolean;
  enableInlineHints: boolean;
  showInlineCompletions: boolean;
  acceptSuggestionOnEnter: boolean;
  suggestionDelay: number;
  debounceDelay: number;
  maxSuggestions: number;
}

export interface FeatureConfig {
  autoImport: boolean;
  formatOnSave: boolean;
  organizeImports: boolean;
  removeUnusedImports: boolean;
  addMissingImports: boolean;
  generateDocumentation: boolean;
  inlineVariableValues: boolean;
  showParameterHints: boolean;
}

export interface KeybindingConfig {
  acceptSuggestion: string;
  dismissSuggestion: string;
  triggerCompletion: string;
  triggerParameterHints: string;
  triggerInlineChat: string;
  openChatPanel: string;
  explainCode: string;
  generateTests: string;
  refactorCode: string;
}

export interface AppearanceConfig {
  theme: 'light' | 'dark' | 'auto';
  suggestionColor: string;
  highlightColor: string;
  fontSize: number;
  lineHeight: number;
}
```

---

## 4. API Specifications

### 4.1 TypeScript Library API

```typescript
/**
 * Cursora Public API
 */

import {
  Document, Position, Range, URI,
  AIRequest, AIResponse, InlineCompletion,
  Suggestion, WorkspaceEdit, ServerCapabilities
} from './models';

/**
 * Main Cursora client
 */
export class CursoraClient {
  /**
   * Initialize the Cursora client
   */
  constructor(config: CursoraConfig);

  /**
   * Get inline completion at position
   */
  getInlineCompletion(
    document: Document,
    position: Position,
    context?: Partial<AIContext>
  ): Promise<InlineCompletion>;

  /**
   * Get chat completion
   */
  chat(
    message: string,
    context?: AIContext,
    history?: ChatMessage[]
  ): Promise<AIResponse>;

  /**
   * Generate code from natural language description
   */
  generateCode(
    description: string,
    context: AIContext,
    options?: CodeGenerationOptions
  ): Promise<AIResponse>;

  /**
   * Refactor code at range
   */
  refactor(
    document: Document,
    range: Range,
    instruction: string
  ): Promise<WorkspaceEdit>;

  /**
   * Explain code at range
   */
  explain(
    document: Document,
    range: Range,
    detailLevel: 'brief' | 'detailed' | 'comprehensive'
  ): Promise<string>;

  /**
   * Generate tests for code at range
   */
  generateTests(
    document: Document,
    range: Range,
    framework?: string
  ): Promise<AIResponse>;

  /**
   * Get suggestions for current context
   */
  getSuggestions(context: SuggestionContext): Promise<Suggestion[]>;

  /**
   * Apply suggestion
   */
  applySuggestion(suggestion: Suggestion): Promise<boolean>;

  /**
   * Register custom command
   */
  registerCommand(
    name: string,
    handler: CommandHandler
  ): void;

  /**
   * Dispose of resources
   */
  dispose(): void;
}

/**
 * LSP Server for Cursora
 */
export class CursoraServer {
  /**
   * Create LSP server instance
   */
  constructor(client: CursoraClient);

  /**
   * Get server capabilities
   */
  getCapabilities(): ServerCapabilities;

  /**
   * Handle LSP initialize request
   */
  initialize(params: InitializeParams): InitializeResult;

  /**
   * Handle document open
   */
  onDidOpenTextDocument(params: DidOpenTextDocumentParams): void;

  /**
   * Handle document change
   */
  onDidChangeTextDocument(params: DidChangeTextDocumentParams): void;

  /**
   * Handle completion request
   */
  onCompletion(params: CompletionParams): Promise<CompletionItem[]>;

  /**
   * Handle hover request
   */
  onHover(params: HoverParams): Promise<Hover | null>;

  /**
   * Handle definition request
   */
  onDefinition(params: DefinitionParams): Promise<Location[]>;

  /**
   * Handle code action request
   */
  onCodeAction(params: CodeActionParams): Promise<(Command | CodeAction)[]>;

  /**
   * Start listening for connections
   */
  listen(connection: Connection): void;

  /**
   * Dispose of server
   */
  dispose(): void;
}

/**
 * Extension API for IDE integrations
 */
export interface ExtensionAPI {
  /**
   * Get the Cursora client instance
   */
  readonly client: CursoraClient;

  /**
   * Register a suggestion provider
   */
  registerSuggestionProvider(
    provider: SuggestionProvider
  ): Disposable;

  /**
   * Register an AI feature handler
   */
  registerAIFeature(
    feature: AIFeature,
    handler: AIFeatureHandler
  ): Disposable;

  /**
   * Trigger inline completion
   */
  triggerInlineCompletion(): Promise<void>;

  /**
   * Open chat panel
   */
  openChatPanel(): void;

  /**
   * Show explanation for selection
   */
  showExplanation(): Promise<void>;
}

/**
 * Suggestion provider interface
 */
export interface SuggestionProvider {
  readonly name: string;
  readonly supportedLanguages: string[];

  provideSuggestions(
    context: SuggestionContext,
    token: CancellationToken
  ): ProviderResult<Suggestion[]>;
}

/**
 * AI feature handler interface
 */
export interface AIFeatureHandler {
  handle(
    request: AIRequest,
    context: AIContext,
    token: CancellationToken
  ): ProviderResult<AIResponse>;
}
```

---

## 5. Configuration

### 5.1 Configuration Schema (JSON)

```json
{
  "$schema": "https://cursora.io/schema/config.json",
  "version": "1.0.0",
  "ai": {
    "provider": "anthropic",
    "model": "claude-3-sonnet-20240229",
    "temperature": 0.2,
    "maxTokens": 4096,
    "contextWindow": 200000,
    "enabledFeatures": [
      "inline_completion",
      "chat",
      "code_generation",
      "refactoring",
      "explanation",
      "documentation",
      "test_generation"
    ],
    "customPrompts": {
      "codeReview": "Review this code for bugs, security issues, and best practices.",
      "documentation": "Generate comprehensive documentation for this code."
    }
  },
  "editor": {
    "enableCodeLens": true,
    "enableInlineHints": true,
    "showInlineCompletions": true,
    "acceptSuggestionOnEnter": true,
    "suggestionDelay": 50,
    "debounceDelay": 150,
    "maxSuggestions": 5
  },
  "features": {
    "autoImport": true,
    "formatOnSave": true,
    "organizeImports": true,
    "removeUnusedImports": true,
    "addMissingImports": true,
    "generateDocumentation": false,
    "inlineVariableValues": true,
    "showParameterHints": true
  },
  "keybindings": {
    "acceptSuggestion": "Tab",
    "dismissSuggestion": "Escape",
    "triggerCompletion": "Ctrl+Space",
    "triggerParameterHints": "Ctrl+Shift+Space",
    "triggerInlineChat": "Ctrl+I",
    "openChatPanel": "Ctrl+Shift+L",
    "explainCode": "Ctrl+Shift+E",
    "generateTests": "Ctrl+Shift+T",
    "refactorCode": "Ctrl+Shift+R"
  },
  "appearance": {
    "theme": "auto",
    "suggestionColor": "#4EC9B0",
    "highlightColor": "#569CD6",
    "fontSize": 14,
    "lineHeight": 1.5
  },
  "languageSpecific": {
    "typescript": {
      "enabled": true,
      "additionalContext": ["*.test.ts", "*.spec.ts"]
    },
    "rust": {
      "enabled": true,
      "cargoIntegration": true
    },
    "python": {
      "enabled": true,
      "typeChecking": "strict"
    }
  }
}
```

---

## 6. Performance Benchmarks

| Metric | Target | Measurement |
|--------|--------|-------------|
| Inline completion latency | < 500ms | Time to first suggestion |
| Chat response time | < 2s | Full response generation |
| LSP initialization | < 1s | Server ready |
| Code action generation | < 300ms | Suggestions available |
| Memory usage | < 200MB | Extension process |
| CPU usage | < 5% | Idle state |
| Concurrent requests | 10+ | Parallel AI requests |

---

## 7. Security Model

| Control | Implementation |
|---------|---------------|
| API Key Storage | OS keychain integration |
| Code Privacy | Local processing first |
| Data Retention | No persistent code storage |
| Transmission | TLS 1.3 for all API calls |
| Sandboxing | Extension isolation |
| Audit Logging | Optional local logs |

---

## 8. Appendices

### Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Inline Completion** | AI-powered code suggestions at cursor |
| **LSP** | Language Server Protocol |
| **Context Window** | Amount of code sent to AI model |
| **Semantic Analysis** | Understanding code meaning beyond syntax |
| **CodeLens** | Inline action buttons in editor |
| **Workspace Edit** | Batch of file modifications |

### Appendix B: Supported Languages

| Language | Completion | Chat | Refactor | Explain | Test Gen |
|----------|:----------:|:----:|:--------:|:-------:|:--------:|
| TypeScript | ✅ | ✅ | ✅ | ✅ | ✅ |
| JavaScript | ✅ | ✅ | ✅ | ✅ | ✅ |
| Python | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rust | ✅ | ✅ | ✅ | ✅ | ✅ |
| Go | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Java | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| C++ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ |

### Appendix C: AI Provider Comparison

| Provider | Models | Speed | Quality | Cost |
|----------|--------|-------|---------|------|
| OpenAI | GPT-4, GPT-3.5 | Fast | High | Medium |
| Anthropic | Claude 3 | Medium | Very High | Medium |
| Local | Various | Variable | Variable | Free |

### Appendix D: Commands Reference

| Command | Keybinding | Description |
|---------|------------|-------------|
| Accept Suggestion | Tab | Insert AI suggestion |
| Dismiss | Esc | Close suggestion |
| Trigger Completion | Ctrl+Space | Force suggestion |
| Open Chat | Ctrl+Shift+L | Open chat panel |
| Explain | Ctrl+Shift+E | Explain selection |
| Generate Tests | Ctrl+Shift+T | Create tests |
| Refactor | Ctrl+Shift+R | Refactor code |

### Appendix E: Troubleshooting

| Issue | Solution |
|-------|----------|
| No suggestions | Check API key, verify language support |
| Slow responses | Reduce context window, check network |
| High memory | Disable unused features, restart extension |
| Conflicts | Check keybindings, disable conflicting extensions |

### Appendix F: Custom Prompts

```typescript
// Example custom prompt configuration
cursora.config.setCustomPrompts({
  codeReview: `
    Review this code for:
    1. Security vulnerabilities
    2. Performance issues
    3. Maintainability concerns
    4. Best practice violations

    Provide actionable fixes for each issue found.
  `,

  commitMessage: `
    Generate a conventional commit message for these changes.
    Follow the format: type(scope): description
    Types: feat, fix, docs, style, refactor, test, chore
  `
});
```

### Appendix G: Integration Example

```typescript
// VSCode extension integration
import * as vscode from 'vscode';
import { CursoraClient } from 'cursora';

export function activate(context: vscode.ExtensionContext) {
  const cursora = new CursoraClient({
    ai: { provider: 'anthropic', model: 'claude-3-sonnet' }
  });

  // Register inline completion provider
  vscode.languages.registerInlineCompletionItemProvider(
    { pattern: '**/*.{ts,js,py,rs}' },
    {
      async provideInlineCompletionItems(document, position) {
        const completion = await cursora.getInlineCompletion(
          document,
          position
        );
        return completion.items;
      }
    }
  );
}
```

### Appendix H: Privacy Settings

```json
{
  "privacy": {
    "sendCodeToAI": true,
    "allowTrainingData": false,
    "localModeOnly": false,
    "encryptTransmissions": true,
    "auditLogging": false
  }
}
```

### Appendix I: Migration from Copilot

```bash
# Export Copilot settings
code --export-settings > copilot-settings.json

# Import to Cursora
cursora migrate --from copilot-settings.json

# Update keybindings
cursora keybindings import --preset copilot
```

### Appendix J: Extension Development

```typescript
// Create custom Cursora extension
import { ExtensionAPI, SuggestionProvider } from 'cursora';

const myProvider: SuggestionProvider = {
  name: 'my-custom-provider',
  supportedLanguages: ['typescript'],

  async provideSuggestions(context, token) {
    // Custom suggestion logic
    return [
      {
        id: 'custom-1',
        type: 'enhancement',
        title: 'Use async/await',
        edits: [...],
        confidence: 0.95
      }
    ];
  }
};

export function activate(api: ExtensionAPI) {
  api.registerSuggestionProvider(myProvider);
}
```

### Appendix K: Performance Profiling

```typescript
// Enable performance logging
const cursora = new CursoraClient({
  debug: {
    enableProfiling: true,
    logLevel: 'verbose'
  }
});

// View metrics
console.log(cursora.getPerformanceMetrics());
```

### Appendix L: Advanced Configuration

```json
{
  "advanced": {
    "semanticAnalysis": {
      "enabled": true,
      "maxDepth": 5,
      "includeDependencies": true
    },
    "cache": {
      "enabled": true,
      "maxSize": "100MB",
      "ttl": 3600
    },
    "network": {
      "timeout": 30000,
      "retries": 3,
      "concurrentRequests": 5
    }
  }
}
```

---

## Document Information

| Field | Value |
|-------|-------|
| **Document ID** | SPEC-CURSORA-001 |
| **Version** | 1.0.0 |
| **Status** | Active |
| **Last Updated** | 2026-04-06 |

---

*This specification defines the canonical behavior of Cursora IDE integration.*
