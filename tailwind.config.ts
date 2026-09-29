import type { Config } from 'tailwindcss';
export default { content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'], theme: { extend: { colors: { ink: '#172a3a', muted: '#718096', canvas: '#f5f7f8', accent: '#bc5a3c', line: '#e6eaed' }, fontFamily: { sans: ['var(--font-inter)', 'Arial', 'sans-serif'] } } }, plugins: [] } satisfies Config;
