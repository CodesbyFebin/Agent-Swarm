import './globals.css';
import { useEffect } from 'react';

export const metadata = {
  title: 'AgentSwarm Command Centre',
  robots: { index: false, follow: false },
  manifest: '/manifest.json',
};

export default function RootLayout({ children }) {
  useEffect(() => {
    // Register service worker for PWA support
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
          })
          .catch((error) => {
            console.log('ServiceWorker registration failed: ', error);
          });
      });
    }
  }, []);

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
