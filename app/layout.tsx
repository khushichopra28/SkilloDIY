import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'EventOps — Event Workforce Operations',
  description: 'A clearer command center for every event.',
  icons: {
    icon: '/skillo.png',
    apple: '/skillo.png',
  },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
