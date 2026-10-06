import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Toast as ToastPrimitive } from 'radix-ui';
import { Check, X } from 'lucide-react';

type ToastKind = 'success' | 'error';
type ToastMessage = { id: number; message: string; kind: ToastKind };
type ToastContextValue = { toast: (message: string, kind?: ToastKind) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const nextId = useRef(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = ++nextId.current;
    setToasts((current) => [...current, { id, message, kind }]);
  }, []);
  const dismiss = (id: number) => setToasts((current) => current.filter((item) => item.id !== id));

  return <ToastContext.Provider value={{ toast }}>
    <ToastPrimitive.Provider duration={5000} swipeDirection="right">
      {children}
      {toasts.map((item) => <ToastPrimitive.Root
        key={item.id}
        open
        onOpenChange={(open) => { if (!open) dismiss(item.id); }}
        data-kind={item.kind}
        className="admin-toast"
      >
        <span className="admin-toast__icon" aria-hidden="true">{item.kind === 'success' ? <Check size={17} /> : <X size={17} />}</span>
        <ToastPrimitive.Title className="admin-toast__title">{item.message}</ToastPrimitive.Title>
        <ToastPrimitive.Close className="admin-action admin-toast__close" aria-label="Dismiss notification"><X size={16} /></ToastPrimitive.Close>
      </ToastPrimitive.Root>)}
      <ToastPrimitive.Viewport className="admin-toast-viewport" aria-label="Notifications" />
    </ToastPrimitive.Provider>
  </ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
