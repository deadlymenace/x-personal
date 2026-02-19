import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { handleAuthCallback } from "../lib/api";

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      setError("Missing authorization code or state parameter.");
      setProcessing(false);
      return;
    }

    (async () => {
      try {
        const result = await handleAuthCallback(code, state);
        if (result.success) {
          navigate("/", {
            replace: true,
            state: {
              message: `Successfully connected as @${result.username}`,
            },
          });
        } else {
          setError("Authentication failed. Please try again.");
          setProcessing(false);
        }
      } catch (err) {
        setError(
          (err as Error).message || "Authentication failed. Please try again."
        );
        setProcessing(false);
      }
    })();
  }, [searchParams, navigate]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-surface rounded-xl border border-border p-8 max-w-md w-full text-center space-y-4">
        {processing ? (
          <>
            <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto" />
            <p className="text-text-primary font-medium">
              Completing authentication...
            </p>
            <p className="text-text-secondary text-sm">
              Please wait while we connect your X account.
            </p>
          </>
        ) : error ? (
          <>
            <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mx-auto">
              <span className="text-error text-xl font-bold">!</span>
            </div>
            <p className="text-text-primary font-medium">
              Authentication Failed
            </p>
            <p className="text-error text-sm">{error}</p>
            <Link
              to="/settings"
              className="inline-block bg-surface-hover text-text-primary rounded-lg px-4 py-2 text-sm font-medium hover:bg-border-hover transition-colors border border-border mt-2"
            >
              Back to Settings
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
