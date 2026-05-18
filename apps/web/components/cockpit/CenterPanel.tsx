import BottomBar from '@/components/cockpit/BottomBar';

interface CenterPanelProps {
  children: React.ReactNode;
}

/**
 * CenterPanel — zone centrale flexible.
 * Structure : .ct-center-panel > .ct-page-area (children) + <BottomBar/> flottante.
 * Server component (pas de state propre) — BottomBar est client.
 */
export default function CenterPanel({ children }: CenterPanelProps) {
  return (
    <div className="ct-center-panel">
      <div className="ct-page-area">{children}</div>
      <BottomBar />
    </div>
  );
}
