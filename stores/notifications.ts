import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  durationMs?: number;
  createdAt: string;
}

type NewNotification = Omit<NotificationItem, 'id' | 'createdAt'> & {
  id?: string;
};

interface NotificationsState {
  items: NotificationItem[];
  push: (notification: NewNotification) => string;
  remove: (id: string) => void;
  clear: () => void;
}

function createNotificationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `notify-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  items: [],
  push: (notification) => {
    const id = notification.id ?? createNotificationId();

    set((state) => ({
      items: [
        ...state.items,
        {
          id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          durationMs: notification.durationMs,
          createdAt: new Date().toISOString(),
        },
      ],
    }));

    return id;
  },
  remove: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
  clear: () => set({ items: [] }),
}));
