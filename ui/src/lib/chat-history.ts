import type { ChatHistory, ChatMessage } from './ipc'

export function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...new Map(messages.map(message => [message.id, message])).values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

// Preserve loaded pages only if the newest query reaches the previous query's
// newest message. Otherwise start a contiguous page with a usable older cursor.
export function mergeChatHistory(previous: ChatHistory, next: ChatHistory, newestLoadedId: string): ChatHistory {
  if (!newestLoadedId || !next.messages.some(message => message.id === newestLoadedId)) return next
  return { ...next, hasMore: previous.hasMore, messages: sortMessages([...previous.messages, ...next.messages]) }
}
