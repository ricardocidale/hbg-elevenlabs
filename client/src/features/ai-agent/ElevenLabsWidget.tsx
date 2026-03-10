import { useEffect, useRef } from "react";
import { useGlobalAssumptions } from "@/lib/api/admin";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useAdminSignedUrl } from "@/features/ai-agent/hooks/use-signed-url";

export default function ElevenLabsWidget({ enabled = false }: { enabled?: boolean }) {
  const { data: global } = useGlobalAssumptions();
  const { user } = useAuth();
  const [location] = useLocation();
  const { data: signedUrl, error: signedUrlError } = useAdminSignedUrl();

  const agentId = (global as any)?.marcelaAgentId;
  const avatarUrl = (global as any)?.marcelaAvatarUrl as string | undefined;

  const shouldActivate = !!(enabled && agentId);

  useEffect(() => {
    if (!enabled && global) {
      const reasons: string[] = [];
      if (!(global as any)?.showAiAssistant) reasons.push("showAiAssistant is off");
      if (!(global as any)?.marcelaEnabled) reasons.push("marcelaEnabled is off");
      if (!agentId) reasons.push("marcelaAgentId is empty");
      if (reasons.length > 0) {
        console.info("[Marcela] Widget inactive:", reasons.join(", "));
      }
    }
    if (signedUrlError) {
      console.warn("[Marcela] Signed URL error:", (signedUrlError as Error).message);
    }
  }, [enabled, global, agentId, signedUrlError]);

  if (!shouldActivate) return null;

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "User";
  const dynamicVars: Record<string, string> = {
    user_name: fullName,
    user_role: user?.role || "partner",
    current_page: location,
  };

  return (
    <NativeElevenLabsWidget
      agentId={agentId}
      signedUrl={signedUrl}
      avatarUrl={avatarUrl}
      dynamicVars={dynamicVars}
    />
  );
}

function NativeElevenLabsWidget({
  agentId,
  signedUrl,
  avatarUrl,
  dynamicVars,
}: {
  agentId: string;
  signedUrl?: string;
  avatarUrl?: string;
  dynamicVars: Record<string, string>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || !signedUrl) return;
    let cancelled = false;

    customElements.whenDefined("elevenlabs-convai").then(() => {
      if (cancelled || !containerRef.current) return;

      if (widgetRef.current) {
        widgetRef.current.remove();
        widgetRef.current = null;
      }

      const widget = document.createElement("elevenlabs-convai");
      widget.setAttribute("agent-id", agentId);
      widget.setAttribute("signed-url", signedUrl);
      if (avatarUrl) widget.setAttribute("avatar-image-url", avatarUrl);
      widget.setAttribute("dynamic-variables", JSON.stringify(dynamicVars));

      containerRef.current!.appendChild(widget);
      widgetRef.current = widget;
    });

    return () => {
      cancelled = true;
      widgetRef.current?.remove();
      widgetRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, signedUrl]);

  const dynamicVarsJson = JSON.stringify(dynamicVars);
  useEffect(() => {
    if (widgetRef.current) {
      widgetRef.current.setAttribute("dynamic-variables", dynamicVarsJson);
    }
  }, [dynamicVarsJson]);

  return <div ref={containerRef} data-testid="elevenlabs-native-widget" />;
}
