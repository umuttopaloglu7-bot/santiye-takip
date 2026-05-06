import './globals.css'; // BU SATIR EKSİK OLDUĞU İÇİN TASARIM BOZUK

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  )
}