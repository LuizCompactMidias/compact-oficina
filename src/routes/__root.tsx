import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeadContent, Link, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "../styles.css?url";
import { BRAND } from "../lib/brand";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: BRAND.name },
      { name: "description", content: BRAND.slogan },
      { property: "og:title", content: BRAND.name },
      { property: "og:description", content: BRAND.slogan },
      { property: "og:type", content: "website" },
      { property: "og:image", content: BRAND.logoUrl },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: BRAND.iconUrl, type: "image/webp" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-[#070707] px-4 text-white">
      <div className="text-center"><img src={BRAND.iconUrl} className="mx-auto size-20 rounded-3xl" alt="" /><p className="mt-6 text-7xl font-black compact-gold-text">404</p><h1 className="mt-3 text-2xl font-black">Página não encontrada</h1><Link to="/" className="mt-6 inline-flex rounded-xl bg-[#F0B323] px-5 py-3 font-black text-black">Voltar ao início</Link></div>
    </div>
  ),
});

function RootShell({ children }: { children: ReactNode }) {
  return <html lang="pt-BR"><head><HeadContent /></head><body>{children}<Scripts /></body></html>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return <QueryClientProvider client={queryClient}><Outlet /></QueryClientProvider>;
}
