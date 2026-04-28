import "./globals.css";

export const metadata = {
  title: "AI Content System",
  description: "Automated AI content generation and management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
