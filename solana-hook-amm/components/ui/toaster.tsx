"use client"

import * as React from "react"
import { ToastProvider, ToastViewport } from "@/components/ui/use-toast"
import { Toast, ToastClose, ToastDescription, ToastTitle } from "@/components/ui/toast"

export function Toaster() {
  return (
    <ToastProvider>
      <ToastViewport />
    </ToastProvider>
  )
}

export { Toast, ToastClose, ToastDescription, ToastTitle }
