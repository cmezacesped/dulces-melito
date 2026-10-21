import type { Metadata, Viewport } from 'next';
import './globals.css';
import { BakeryProvider } from '@/context/BakeryContext';
import { FeedbackProvider } from '@/context/FeedbackContext';

export const metadata: Metadata = {
  title: 'Dulces Melito — Costeo, Recetario y Pedidos',
  description:
    'Sistema privado de gestión de ingredientes, recetario, armador de cajas, calendario de pedidos y producción en $ CLP.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#d97706',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased">
        <FeedbackProvider>
          <BakeryProvider>{children}</BakeryProvider>
        </FeedbackProvider>
      </body>
    </html>
  );
}
