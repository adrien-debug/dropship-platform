import { NextResponse } from 'next/server';
import { listDesignSystems, suggestDesignSystem } from '@dropship/design-systems';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const audience = searchParams.get('audience');

  const all = listDesignSystems().map((ds) => ({
    id: ds.id,
    num: ds.num,
    name: ds.name,
    category: ds.category,
    description: ds.description,
    audience: ds.audience,
    darkMode: ds.darkMode,
    accentColor: ds.colors.accent,
    bgColor: ds.colors.bg,
    textColor: ds.colors.text,
  }));

  if (audience) {
    const suggested = suggestDesignSystem(audience).map((ds) => ds.id);
    return NextResponse.json({
      designSystems: all,
      suggested,
    });
  }

  return NextResponse.json({ designSystems: all });
}
