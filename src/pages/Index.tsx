import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getFlag } from "@/lib/storage";
import { supabase } from "@/lib/supabaseClient";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const onboarded = getFlag("onboarded");

      if (onboarded) {
        navigate("/home", { replace: true });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/home", { replace: true });
      } else {
        navigate("/onboarding", { replace: true });
      }
    };

    checkAuth();
  }, [navigate]);

  return null;
};

export default Index;
