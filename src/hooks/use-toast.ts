// Minimal in-memory toast store (inspired by shadcn's toaster)
import * as React from 'react';
import type { ToastProps } from '@/components/ui/toast';

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
};

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 5000;

type State = { toasts: ToasterToast[] };
const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function dispatch(action: { type: 'ADD' | 'UPDATE' | 'DISMISS' | 'REMOVE'; toast?: ToasterToast; id?: string }) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((l) => l(memoryState));
}

function reducer(state: State, action: { type: string; toast?: ToasterToast; id?: string }): State {
  switch (action.type) {
    case 'ADD':
      return { toasts: [action.toast as ToasterToast, ...state.toasts].slice(0, TOAST_LIMIT) };
    case 'UPDATE':
      return {
        toasts: state.toasts.map((t) => (t.id === action.toast?.id ? { ...t, ...action.toast } : t)),
      };
    case 'DISMISS':
      return {
        toasts: state.toasts.map((t) =>
          !action.id || t.id === action.id ? { ...t, open: false } : t
        ),
      };
    case 'REMOVE':
      return { toasts: state.toasts.filter((t) => t.id !== action.id) };
    default:
      return state;
  }
}

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

export function toast(props: Omit<ToasterToast, 'id'>) {
  const id = genId();
  const update = (next: Partial<ToasterToast>) => dispatch({ type: 'UPDATE', toast: { ...next, id } as ToasterToast });
  const dismiss = () => dispatch({ type: 'DISMISS', id });
  dispatch({
    type: 'ADD',
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open: boolean) => { if (!open) dismiss(); },
    } as ToasterToast,
  });
  setTimeout(() => dispatch({ type: 'REMOVE', id }), TOAST_REMOVE_DELAY);
  return { id, dismiss, update };
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);
  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const i = listeners.indexOf(setState);
      if (i > -1) listeners.splice(i, 1);
    };
  }, []);
  return {
    ...state,
    toast,
    dismiss: (id?: string) => dispatch({ type: 'DISMISS', id }),
  };
}
