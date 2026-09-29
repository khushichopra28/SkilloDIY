import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'EventOps — Event Workforce Operations', description: 'A clearer command center for every event.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
