import { EventEmitter } from 'events';

// SSE event bus for real-time draft updates
const draftEvents = new EventEmitter();
draftEvents.setMaxListeners(200);

/** Notify SSE clients that draft data changed for a channel */
export function notifyDraftUpdate(channelCode: string): void {
  draftEvents.emit(`update:${channelCode}`);
}

/** Register a listener for draft update events on a specific channel */
export function onDraftUpdate(channelCode: string, handler: () => void): void {
  draftEvents.on(`update:${channelCode}`, handler);
}

/** Remove a listener for draft update events on a specific channel */
export function offDraftUpdate(channelCode: string, handler: () => void): void {
  draftEvents.off(`update:${channelCode}`, handler);
}