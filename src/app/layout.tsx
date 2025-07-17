
import * as React from 'react'; // Usar namespace completo
import type {Metadata} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/auth-context'; // Importación nombrada

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ClaveCRM',
  description: 'CRM ultraligero para pequeñas empresas, ahora con tu marca ClaveCRM.',
  icons: {
    icon: '/clave-crm-logo.png', // Ruta al logo en la carpeta public
    // apple: '/clave-crm-logo.png', // Opcional: para Apple touch icon
    // shortcut: '/clave-crm-logo.png' // Opcional: para shortcut icon
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}

    