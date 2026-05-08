import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { GlobalNudgeListener } from "@/components/GlobalNudgeListener";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-6xl text-primary">404</h1>
        <p className="mt-3 text-muted-foreground">Lost in the daily quest.</p>
        <Link
          to="/home"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl text-primary">Something hiccuped.</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#3D2A1A" },
      { title: "Daily Duo" },
      {
        name: "description",
        content:
          "A premium daily relationship game. Share one quest a day, prove it together, climb the levels.",
      },
      { property: "og:title", content: "Daily Duo" },
      {
        property: "og:description",
        content: "One quest a day, just for the two of you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Daily Duo" },
      { name: "description", content: "Our Private Side Quest" },
      { property: "og:description", content: "Our Private Side Quest" },
      { name: "twitter:description", content: "Our Private Side Quest" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/m09ZDVN5OdV85JIsifxZQ1990zf1/social-images/social-1778249046894-Green_Orange_Modern_Messaging_App_Logo.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/m09ZDVN5OdV85JIsifxZQ1990zf1/social-images/social-1778249046894-Green_Orange_Modern_Messaging_App_Logo.webp" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "icon", href: "/icon-192.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pb-32">
          <Outlet />
        </main>
        <BottomNav />
        <GlobalNudgeListener />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "var(--card)",
              color: "var(--foreground)",
              border: "1px solid var(--border)",
              borderRadius: "999px",
              padding: "12px 18px",
              fontFamily: "var(--font-sans)",
            },
          }}
        />
      </div>
    </QueryClientProvider>
  );
}
