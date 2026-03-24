import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { saveAuthUser, setFlag } from "@/lib/storage";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          const user = session.user;

          saveAuthUser({
            provider: user.app_metadata.provider || "email",
            name:
              user.user_metadata.full_name ||
              user.user_metadata.name ||
              "User",
            loggedIn: true,
            id: user.id,
            email: user.email,
          });
          setFlag("authProvider", user.app_metadata.provider || "email");
          setFlag("onboarded", "true");

          try {
            const { migrateLocalDataToServer } = await import(
              "@/lib/migrateLocalData"
            );
            await migrateLocalDataToServer();
          } catch {
            // Migration is best-effort; proceed even if it fails
          }

          navigate("/home", { replace: true });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground font-body text-sm">Signing in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
