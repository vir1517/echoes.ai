import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'Echoes | Living Memory',
  description: 'Preserve the voices and stories of your loved ones for generations to come.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap" rel="stylesheet" />
        {/* Puter.js — free anonymous AI inference */}
        <script src="https://js.puter.com/v2/" async></script>
      </head>
      <body className="antialiased bg-background text-foreground selection:bg-accent/20 selection:text-white">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
