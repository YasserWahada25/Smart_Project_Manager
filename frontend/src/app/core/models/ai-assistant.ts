<<<<<<< HEAD
/** AI-04 — manager assistant (docs/api.md § 1.17). The conversation lives in the page only. */
=======
/** AI-04 — manager assistant (docs/api.md § 1.17). The conversation is saved per manager and project. */
>>>>>>> 1703821937e40442e522b5f7a255b6c3c63d056b
export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type AssistantTool =
  'create_task' | 'update_task' | 'assign_task' | 'change_task_status' | 'create_sprint';

/** A change prepared by the assistant: applied only when the manager confirms it. */
export interface AssistantProposal {
  id: string;
  tool: AssistantTool;
  arguments: Record<string, unknown>;
  summary: string;
}

/** POST /projects/:id/ai/assistant/chat */
export interface AssistantReply {
  reply: string;
  proposals: AssistantProposal[];
  /** Tools the assistant used to answer (read data, prepared changes). */
  toolsUsed: string[];
  model: string | null;
}

<<<<<<< HEAD
=======
export type AssistantProposalState = 'PENDING' | 'APPLIED' | 'DISMISSED' | 'FAILED';

/** GET /projects/:id/ai/assistant/conversation: the saved messages, oldest first. */
export interface AssistantConversation {
  messages: SavedAssistantMessage[];
}

export interface SavedAssistantMessage extends AssistantMessage {
  proposals: SavedAssistantProposal[];
  createdAt: string;
}

export interface SavedAssistantProposal extends AssistantProposal {
  state: AssistantProposalState;
  /** Result or error message once applied or failed. */
  result?: string;
}

>>>>>>> 1703821937e40442e522b5f7a255b6c3c63d056b
/** POST /projects/:id/ai/assistant/actions (201) */
export interface AssistantActionResult {
  tool: AssistantTool;
  message: string;
}

export const ASSISTANT_LIMITS = { maxMessages: 20, messageMaxLength: 4000 } as const;
