import { Suspense } from "react";
import { SplashScreen } from "@/components/splash-screen";

/** useSearchParams exige Suspense no App Router */
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<SplashScreen />}>{children}</Suspense>;
}
