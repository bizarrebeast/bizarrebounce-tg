export const metadata = {
  title: 'BizarreBounce',
  description: 'BizarreBounce — a BizarreBeasts game',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
