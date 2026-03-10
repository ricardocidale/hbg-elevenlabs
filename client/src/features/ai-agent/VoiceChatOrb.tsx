import { useCallback, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2Icon } from "lucide-react";
import { IconPhoneIcon, IconPhoneOffIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Orb } from "@/features/ai-agent/components/orb";
import { ShimmeringText } from "@/features/ai-agent/components/shimmering-text";
import { useAdminSignedUrl } from "@/features/ai-agent/hooks/use-signed-url";
import { useMarcelaSettings } from "@/features/ai-agent/hooks/use-agent-settings";
import { useAuth } from "@/lib/auth";

type AgentState = "disconnected" | "connecting" | "connected" | "disconnecting" | null;

interface VoiceChatOrbProps {
  className?: string;
  onSessionChange?: (active: boolean) => void;
}

export default function VoiceChatOrb({ className, onSessionChange }: VoiceChatOrbProps) {
  const [agentState, setAgentState] = useState<AgentState>("disconnected");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { refetch: refetchSignedUrl } = useAdminSignedUrl();
  const { data: settings } = useMarcelaSettings();
  const { user } = useAuth();

  const agentName = settings?.aiAgentName ?? "Marcela";

  const conversation = useConversation({
    onConnect: () => {
      setErrorMessage(null);
      onSessionChange?.(true);
    },
    onDisconnect: () => {
      setAgentState("disconnected");
      onSessionChange?.(false);
    },
    onError: (error) => {
      setAgentState("disconnected");
      setErrorMessage(typeof error === "string" ? error : "Session error");
    },
  });

  const startConversation = useCallback(async () => {
    try {
      setErrorMessage(null);
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Signed URLs are single-use — always refetch before starting
      const { data: freshUrl } = await refetchSignedUrl();
      if (!freshUrl) throw new Error("Could not obtain signed URL");

      await conversation.startSession({
        signedUrl: freshUrl,
        dynamicVariables: {
          user_name: user?.name ?? "Guest",
          user_role: user?.role ?? "user",
          current_page: window.location.pathname,
        },
        onStatusChange: (status) => setAgentState(status.status as AgentState),
      });
    } catch (error) {
      console.error("Error starting conversation:", error);
      setAgentState("disconnected");
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setErrorMessage("Please enable microphone permissions in your browser.");
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      }
    }
  }, [conversation, refetchSignedUrl, user]);

  const handleCall = useCallback(() => {
    if (agentState === "disconnected" || agentState === null) {
      setAgentState("connecting");
      startConversation();
    } else if (agentState === "connected") {
      conversation.endSession();
      setAgentState("disconnecting");
    }
  }, [agentState, conversation, startConversation]);

  const isCallActive = agentState === "connected";
  const isTransitioning = agentState === "connecting" || agentState === "disconnecting";

  const getInputVolume = useCallback(() => {
    const raw = conversation.getInputVolume?.() ?? 0;
    return Math.min(1.0, Math.pow(raw, 0.5) * 2.5);
  }, [conversation]);

  const getOutputVolume = useCallback(() => {
    const raw = conversation.getOutputVolume?.() ?? 0;
    return Math.min(1.0, Math.pow(raw, 0.5) * 2.5);
  }, [conversation]);

  return (
    <Card className={cn("flex h-[400px] w-full flex-col items-center justify-center overflow-hidden p-6", className)}>
      <div className="flex flex-col items-center gap-6">
        <div className="relative size-32">
          <div className="bg-muted relative h-full w-full rounded-full p-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]">
            <div className="bg-background h-full w-full overflow-hidden rounded-full shadow-[inset_0_0_12px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_0_12px_rgba(0,0,0,0.3)]">
              <Orb
                className="h-full w-full"
                volumeMode="manual"
                getInputVolume={getInputVolume}
                getOutputVolume={getOutputVolume}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <h2 className="text-xl font-semibold">{agentName}</h2>
          <AnimatePresence mode="wait">
            {errorMessage ? (
              <motion.p
                key="error"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="text-destructive text-center text-sm"
              >
                {errorMessage}
              </motion.p>
            ) : agentState === "disconnected" || agentState === null ? (
              <motion.p
                key="disconnected"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="text-muted-foreground text-sm"
              >
                Tap to start voice chat
              </motion.p>
            ) : (
              <motion.div
                key="status"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex items-center gap-2"
              >
                <div
                  className={cn(
                    "h-2 w-2 rounded-full transition-all duration-300",
                    agentState === "connected" && "bg-green-500",
                    isTransitioning && "bg-primary/60 animate-pulse"
                  )}
                />
                <span className="text-sm capitalize">
                  {isTransitioning ? (
                    <ShimmeringText text={agentState} />
                  ) : (
                    <span className="text-green-600">Connected</span>
                  )}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Button
          onClick={handleCall}
          disabled={isTransitioning}
          size="icon"
          variant={isCallActive ? "secondary" : "default"}
          className="h-12 w-12 rounded-full"
        >
          <AnimatePresence mode="wait">
            {isTransitioning ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, rotate: 0 }}
                animate={{ opacity: 1, rotate: 360 }}
                exit={{ opacity: 0 }}
                transition={{ rotate: { duration: 1, repeat: Infinity, ease: "linear" } }}
              >
                <Loader2Icon className="h-5 w-5" />
              </motion.div>
            ) : isCallActive ? (
              <motion.div
                key="end"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <IconPhoneOffIcon className="h-5 w-5" />
              </motion.div>
            ) : (
              <motion.div
                key="start"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
              >
                <IconPhoneIcon className="h-5 w-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </Card>
  );
}
