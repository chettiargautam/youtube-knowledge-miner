import type { ChannelCandidate } from "@/types/channel";

const SELECTED_CHANNEL_KEY = "ytkb:selected-channel";

export function saveSelectedChannel(channel: ChannelCandidate): void {
  window.localStorage.setItem(SELECTED_CHANNEL_KEY, JSON.stringify(channel));
}

export function readSelectedChannel(): ChannelCandidate | null {
  const raw = window.localStorage.getItem(SELECTED_CHANNEL_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ChannelCandidate;
  } catch {
    window.localStorage.removeItem(SELECTED_CHANNEL_KEY);
    return null;
  }
}

export function clearSelectedChannel(): void {
  window.localStorage.removeItem(SELECTED_CHANNEL_KEY);
}
