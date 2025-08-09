"use client"

// Inspired by react-hot-toast library
import * as React from "react"

type ToastMessage = {
  id: string
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

type ToastContextValue = {
  toasts: ToastMessage[]
  toast: (msg: Omit<ToastMessage, "id">) => void
  dismiss: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([])

  const toast = React.useCallback((msg: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...msg, id }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>{children}</ToastContext.Provider>
  )
}

export function ToastProviderUI({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}

export { useToast }