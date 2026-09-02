import './globals.css';
import ServiceWorkerRegistration from '../components/ui/ServiceWorkerRegistration';

export const metadata = {
  title: 'AgentSwarm Command Centre',
  robots: { index: false, follow: false },
  manifest: '/manifest.json',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
