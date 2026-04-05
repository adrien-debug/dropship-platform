'use client';

import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  panelClassName?: string;
}

export function Modal({ open, onClose, title, children, className, panelClassName }: ModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className={cn('relative z-50', className)}>
      <DialogBackdrop
        transition
        className="fixed inset-0 z-[100001] bg-[var(--dashboard-page)]/80 backdrop-blur-sm transition duration-200 ease-out data-closed:opacity-0"
      />
      <div className="fixed inset-0 z-[100002] flex w-screen items-center justify-center overflow-y-auto p-4 sm:p-6">
        <DialogPanel
          transition
          className={cn(
            'relative z-[100003] w-full max-w-lg rounded-card border border-border bg-card p-6 shadow-dashboard-lg transition duration-200 ease-out data-closed:scale-95 data-closed:opacity-0',
            panelClassName,
          )}
        >
          {title ? (
            <DialogTitle className="mb-4 text-lg font-semibold text-text-bright">{title}</DialogTitle>
          ) : null}
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
