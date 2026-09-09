import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/sign-in")({
  head: () => ({ meta: [{ title: "Sign in — BHUMITRA" }] }),
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({ to: "/", replace: true });
  }, [navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-surface px-4">
      <div className="text-center">
        <p className="text-[14px] text-muted-foreground">Redirecting to Bhumitra Dashboard...</p>
      </div>
    </div>
  );
}

