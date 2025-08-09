"use client"

import * as React from "react"

type Toast = {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  duration?: number
}

const VIEWPORT_PADDING = 32

interface ToastContextProps {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, "id">) => void
  updateToast: (toast: Partial<Toast> & { id: string }) => void
  removeToast: (toastId: string) => void
}

const ToastContext = React.createContext<ToastContextProps>({
  toasts: [],
  addToast: () => {},
  updateToast: () => {},
  removeToast: () => {},
})

function useToast() {
  return React.useContext(ToastContext)
}

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = React.useId()
    setToasts((prev) => [...prev, { id, ...toast }])
  }, [])

  const updateToast = React.useCallback((toast: Partial<Toast> & { id: string }) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === toast.id ? { ...t, ...toast } : t))
    )
  }, [])

  const removeToast = React.useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId))
  }, [])

  const value = React.useMemo(
    () => ({
      toasts,
      addToast,
      updateToast,
      removeToast,
    }),
    [toasts, addToast, updateToast, removeToast]
  )

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

const ToastViewport = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={className}
    style={{
      "--viewport-padding": `${VIEWPORT_PADDING}px`,
    } as React.CSSProperties}
    {...props}
  />
))
ToastViewport.displayName = "ToastViewport"

export {
  ToastProvider,
  ToastViewport,
  useToast,
}