import type { Metadata } from "next";
import { Archivo, Be_Vietnam_Pro, IBM_Plex_Mono } from "next/font/google";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@/theme/sum-theme.ts/sum-workspace.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

// Chosen for its Vietnamese diacritics: every caption this tool produces is
// Vietnamese, and most grotesques set the stacked marks badly.
const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SUM Editorial — Motorsport Content Desk",
  description:
    "Lấy tin F1 và mô tô thể thao mới nhất, soạn thành caption Facebook tiếng Việt theo văn phong SUM để admin chỉnh và đăng.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      data-theme="dark"
      className={`${archivo.variable} ${beVietnam.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
