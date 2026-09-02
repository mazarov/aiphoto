import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { GenerationProvider } from "@/context/GenerationContext";
import { PromptCardModalProvider } from "@/context/PromptCardModalContext";
import { PricingModalProvider } from "@/context/PricingModalContext";
import { FotoVPromtMobileModalProvider } from "@/context/FotoVPromtMobileModalContext";
import { GenerateMobileModalProvider } from "@/context/GenerateMobileModalContext";
import { GenerateDockProvider } from "@/context/GenerateDockContext";
import { AuthReturnScreenRestorer } from "@/components/AuthReturnScreenRestorer";
import { DeferredAppOverlays } from "@/components/DeferredAppOverlays";
import { UnpaidCheckoutBanner } from "@/components/UnpaidCheckoutBanner";
import { YooKassaReturnStatus } from "@/components/YooKassaReturnStatus";
import { RobokassaPaymentStatus } from "@/components/RobokassaPaymentStatus";
import { YandexMetrikaRouteTracker } from "@/components/YandexMetrikaRouteTracker";
import { YandexMetrikaTagLoader } from "@/components/YandexMetrikaTagLoader";
import { HOMEPAGE_SEO } from "@/lib/homepage-seo-copy";
import { YANDEX_METRIKA_COUNTER_ID } from "@/lib/yandex-metrika";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  preload: true,
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: HOMEPAGE_SEO.title,
  description: HOMEPAGE_SEO.description,
  manifest: "/site.webmanifest",
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large" as const,
    "max-snippet": -1,
    "max-video-preview": -1,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Keyboard opens in top sheet — avoid shrinking layout viewport (stale dvh dock gap on iOS).
  interactiveWidget: "overlays-content",
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={inter.className}>
      <head>
        <Script id="yandex-metrika-queue" strategy="beforeInteractive">{`
          (function(m,i,max){
            if(typeof m[i]!=="function"){
              var queue=function(){
                var items=queue.a=queue.a||[];
                items.push(arguments);
                if(items.length>max+1){items.splice(1,items.length-(max+1));}
              };
              queue.a=[];
              queue.l=1*new Date();
              m[i]=queue;
            }
          })(window,"ym",100);
          ym(${YANDEX_METRIKA_COUNTER_ID},"init",{ssr:true,webvisor:true,clickmap:true,ecommerce:"dataLayer",referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});
        `}</Script>
      </head>
      <body className="min-h-screen bg-white text-zinc-900 antialiased">
        <AuthProvider>
          <GenerationProvider>
            <PromptCardModalProvider>
              <PricingModalProvider>
                <FotoVPromtMobileModalProvider>
                  <GenerateMobileModalProvider>
                    <GenerateDockProvider>
                      <UnpaidCheckoutBanner />
                      <Suspense fallback={null}>
                        <YandexMetrikaRouteTracker />
                      </Suspense>
                      {children}
                      {modal}
                      <AuthReturnScreenRestorer />
                      <DeferredAppOverlays />
                      <YooKassaReturnStatus />
                      <RobokassaPaymentStatus />
                    </GenerateDockProvider>
                  </GenerateMobileModalProvider>
                </FotoVPromtMobileModalProvider>
              </PricingModalProvider>
            </PromptCardModalProvider>
          </GenerationProvider>
        </AuthProvider>
        <YandexMetrikaTagLoader />
        <noscript>
          <div>
            {/* Yandex noscript pixel — must stay a raw <img>, not next/image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://mc.yandex.ru/watch/${YANDEX_METRIKA_COUNTER_ID}`} style={{position:"absolute",left:"-9999px"}} alt="" />
          </div>
        </noscript>
      </body>
    </html>
  );
}
