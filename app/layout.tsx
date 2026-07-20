import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Instrument_Serif, Geist_Mono } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Instrument Serif is not a variable font, so a weight is required. 400 is the
// only one it ships, which suits the role — it is display-only here, never body.
const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Track — Personal Cost Management",
  description:
    "Track your daily, monthly, and other expenses with a natural, premium visual experience.",
};

/**
 * Resolves the theme before first paint.
 *
 * This must be blocking and inline. Any deferred alternative — an effect, a
 * module script — runs after the first paint, so the user sees a flash of the
 * wrong theme on every load. localStorage is the user's explicit choice and
 * wins; the media query is only the first-visit default.
 */
const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // suppressHydrationWarning: the script above mutates data-theme before
      // React hydrates, so the server and client values legitimately differ.
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} ${instrumentSerif.variable} ${geistMono.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
