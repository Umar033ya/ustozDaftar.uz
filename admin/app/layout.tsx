import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: {
    default: "UstozDaftar.uz — Admin",
    template: "%s | UstozDaftar.uz Admin",
  },
  description: "UstozDaftar.uz boshqaruv paneli — foydalanuvchilar, to'lovlar va obunalar",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb",
};

/**
 * Applies the saved theme BEFORE React hydrates, avoiding a flash of the wrong
 * theme. Rendered as a real <script> element (not via dangerouslySetInnerHTML on
 * <head>), which is the React-supported pattern and avoids hydration mismatches.
 */
const themeInitScript = `
try {
  var stored = localStorage.getItem("ud-admin-theme");
  var dark = stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}