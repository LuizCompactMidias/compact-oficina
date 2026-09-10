import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw redirect({ to: "/login" });
    } catch (error) {
      if (error && typeof error === "object" && "isRedirect" in error) throw error;
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
