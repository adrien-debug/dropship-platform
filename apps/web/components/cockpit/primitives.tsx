/**
 * Cockpit Primitives — mapping 1:1 sur les classes .ct-* de la SPEC §3.
 * Tous les composants sont de purs wrappers de présentation, sans logique.
 * Utiliser ces composants dans les pages à la place des éléments HTML bruts.
 */

import React from 'react';

// ── Typographie ──────────────────────────────────────────────────────────────

interface EyebrowProps {
  children: React.ReactNode;
  className?: string;
}

export function Eyebrow({ children, className = '' }: EyebrowProps) {
  return (
    <p className={`ct-eyebrow${className ? ` ${className}` : ''}`}>{children}</p>
  );
}

interface TitleProps {
  children: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
}

export function Title({ children, as: Tag = 'h1', className = '' }: TitleProps) {
  return (
    <Tag className={`ct-title${className ? ` ${className}` : ''}`}>{children}</Tag>
  );
}

interface SubProps {
  children: React.ReactNode;
  className?: string;
}

export function Sub({ children, className = '' }: SubProps) {
  return (
    <p className={`ct-sub${className ? ` ${className}` : ''}`}>{children}</p>
  );
}

// ── KPI Grid ─────────────────────────────────────────────────────────────────

interface KpiGridProps {
  children: React.ReactNode;
  className?: string;
}

export function KpiGrid({ children, className = '' }: KpiGridProps) {
  return (
    <div className={`ct-kpi-grid${className ? ` ${className}` : ''}`}>{children}</div>
  );
}

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  className?: string;
}

export function KpiCard({ label, value, accent = false, className = '' }: KpiCardProps) {
  return (
    <div
      className={[
        'ct-kpi-card',
        accent ? 'accent' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="ct-kpi-label">{label}</div>
      <div className="ct-kpi-value">{value}</div>
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, children, className = '' }: CardProps) {
  return (
    <div className={`ct-card${className ? ` ${className}` : ''}`}>
      {title && <div className="ct-card-title">{title}</div>}
      <div className="ct-card-body">{children}</div>
    </div>
  );
}
