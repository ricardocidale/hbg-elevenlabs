import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { useConversation } from "@elevenlabs/react";
import { CheckIcon } from "lucide-react";
import { IconAudioLinesIcon, IconCopyIcon, IconPhoneOffIcon, IconSendIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/features/ai-agent/components/conversation";
import { Input } from "@/components/ui/input";
import { Message, MessageContent } from "@/features/ai-agent/components/message";
import { Orb } from "@/features/ai-agent/components/orb";
import { Response } from "@/features/ai-agent/components/response";
import { ShimmeringText } from "@/features/ai-agent/components/shimmering-text";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAdminSignedUrl } from "@/features/ai-agent/hooks/use-signed-url";
import { useMarcelaSettings } from "@/features/ai-agent/hooks/use-agent-settings";
import { useAuth } from "@/lib/auth";

type AgentState = "disconnected" | "connecting" | "connected" | "disconnecting" | null;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Internal sub-components ──────────────────────────────────────────────────

type ChatActionsProps = ComponentProps<"div">;

const ChatActions = ({ className, children, ...props }: ChatActionsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);

type ChatActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

const ChatAction = ({
  tooltip,
  children,
  label,
  className,
  variant = "ghost",
  size = "sm",
  ...props
}: ChatActionProps) => {
  const button = (
    <Button
      className={cn("text-muted-foreground hover:text-foreground relative size-9 p-1.5", className)}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent><p>{tooltip}</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};

// ── Main component ────────────────────────────────────────────────────────────

interface VoiceChatFullProps {
  className?: string;
  onSessionChange?: (active: boolean) => void;
}

export default function VoiceChatFull({ className, onSessionChange }: VoiceChatFullProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentState, setAgentState] = useState<AgentState>("disconnected");
  const [textInput, setTextInput] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isTextOnlyModeRef = useRef<boolean>(true);
  const pendingFirstMessageRef = useRef<string | null>(null);

  const { data: settings } = useMarcelaSettings();
  const { refetch: refetchSignedUrl } = useAdminSignedUrl();
  const { user } = useAuth();

  const agentName = settings?.aiAgentName ?? "Marcela";

  const conversation = useConversation({
    onConnect: () => {
      const pending = pendingFirstMessageRef.current;
      if (pending) {
        pendingFirstMessageRef.current = null;
        conversation.sendUserMessage(pending);
      }
      onSessionChange?.(true);
    },
    onDisconnect: () => {
      setAgentState("disconnected");
      onSessionChange?.(false);
    },
    onMessage: (message) => {
      if (message.message) {
        setMessages((prev) => [
          ...prev,
          { role: message.source === "user" ? "user" : "assistant", content: message.message },
        ]);
      }
    },
    onError: (error) => {
      setAgentState("disconnected");
      setErrorMessage(typeof error === "string" ? error : "Session error");
    },
  });

  const getMicStream = useCallback(async () => {
    if (mediaStreamRef.current) return mediaStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setErrorMessage(null);
      return stream;
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setErrorMessage("Please enable microphone permissions in your browser.");
      }
      throw error;
    }
  }, []);

  const startConversation = useCallback(
    async (textOnly = true, skipClear = false) => {
      try {
        isTextOnlyModeRef.current = textOnly;
        if (!skipClear) setMessages([]);
        if (!textOnly) await getMicStream();

        // Always refetch — signed URLs are single-use
        const { data: signedUrl } = await refetchSignedUrl();
        if (!signedUrl) throw new Error("Could not obtain signed URL");

        await conversation.startSession({
          signedUrl,
          dynamicVariables: {
            user_name: user?.name ?? "Guest",
            user_role: user?.role ?? "user",
            current_page: window.location.pathname,
          },
          overrides: {
            conversation: { textOnly },
            agent: { firstMessage: textOnly ? "" : undefined },
          },
          onStatusChange: (status) => setAgentState(status.status as AgentState),
        });
      } catch (error) {
        console.error(error);
        setAgentState("disconnected");
        setMessages([]);
      }
    },
    [conversation, getMicStream, refetchSignedUrl, user]
  );

  const handleCall = useCallback(async () => {
    if (agentState === "disconnected" || agentState === null) {
      setAgentState("connecting");
      try {
        await startConversation(false);
      } catch {
        setAgentState("disconnected");
      }
    } else if (agentState === "connected") {
      conversation.endSession();
      setAgentState("disconnecting");
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    }
  }, [agentState, conversation, startConversation]);

  const handleSendText = useCallback(async () => {
    if (!textInput.trim()) return;
    const messageToSend = textInput;

    if (agentState === "disconnected" || agentState === null) {
      setTextInput("");
      setAgentState("connecting");
      pendingFirstMessageRef.current = messageToSend;
      setMessages([{ role: "user", content: messageToSend }]);
      try {
        await startConversation(true, true);
      } catch (error) {
        console.error("Failed to start conversation:", error);
        pendingFirstMessageRef.current = null;
      }
    } else if (agentState === "connected") {
      setMessages((prev) => [...prev, { role: "user", content: messageToSend }]);
      setTextInput("");
      conversation.sendUserMessage(messageToSend);
    }
  }, [textInput, agentState, conversation, startConversation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendText();
      }
    },
    [handleSendText]
  );

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

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
    <Card className={cn("mx-auto flex h-[380px] w-full flex-col gap-0 overflow-hidden", className)}>
      {/* Header */}
      <CardHeader className="flex shrink-0 flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-4">
          <div className="ring-border relative size-10 overflow-hidden rounded-full ring-1">
            <Orb
              className="h-full w-full"
              volumeMode="manual"
              getInputVolume={getInputVolume}
              getOutputVolume={getOutputVolume}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-sm leading-none font-medium">{agentName}</p>
            <div className="flex items-center gap-2">
              {errorMessage ? (
                <p className="text-destructive text-xs">{errorMessage}</p>
              ) : agentState === "disconnected" || agentState === null ? (
                <p className="text-muted-foreground text-xs">Type or tap voice to start</p>
              ) : agentState === "connected" ? (
                <p className="text-xs text-green-600">Connected</p>
              ) : isTransitioning ? (
                <ShimmeringText text={agentState} className="text-xs capitalize" />
              ) : null}
            </div>
          </div>
        </div>
        <div
          className={cn(
            "flex h-2 w-2 rounded-full transition-all duration-300",
            agentState === "connected" && "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]",
            isTransitioning && "animate-pulse bg-card/40"
          )}
        />
      </CardHeader>

      {/* Messages */}
      <CardContent className="flex-1 overflow-hidden p-0">
        <Conversation className="h-full">
          <ConversationContent className="flex min-w-0 flex-col gap-2 p-6 pb-2">
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<Orb className="size-12" />}
                title={
                  agentState === "connecting" ? (
                    <ShimmeringText text="Starting conversation" />
                  ) : agentState === "connected" ? (
                    <ShimmeringText text="Start talking or type" />
                  ) : (
                    "Start a conversation"
                  )
                }
                description={
                  agentState === "connecting"
                    ? "Connecting..."
                    : agentState === "connected"
                      ? "Ready to chat"
                      : "Type a message or tap the voice button"
                }
              />
            ) : (
              messages.map((message, index) => (
                <div key={index} className="flex w-full flex-col gap-1">
                  <Message from={message.role}>
                    <MessageContent className="max-w-full min-w-0">
                      <Response className="w-auto [overflow-wrap:anywhere] whitespace-pre-wrap">
                        {message.content}
                      </Response>
                    </MessageContent>
                    {message.role === "assistant" && (
                      <div className="ring-border size-6 flex-shrink-0 self-end overflow-hidden rounded-full ring-1">
                        <Orb
                          className="h-full w-full"
                          agentState={isCallActive && index === messages.length - 1 ? "talking" : null}
                        />
                      </div>
                    )}
                  </Message>
                  {message.role === "assistant" && (
                    <ChatActions>
                      <ChatAction
                        tooltip={copiedIndex === index ? "Copied!" : "Copy"}
                        onClick={() => {
                          navigator.clipboard.writeText(message.content);
                          setCopiedIndex(index);
                          setTimeout(() => setCopiedIndex(null), 2000);
                        }}
                      >
                        {copiedIndex === index ? (
                          <CheckIcon className="size-4" />
                        ) : (
                          <IconCopyIcon className="size-4" />
                        )}
                      </ChatAction>
                    </ChatActions>
                  )}
                </div>
              ))
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </CardContent>

      {/* Input bar */}
      <CardFooter className="shrink-0 border-t">
        <div className="flex w-full items-center gap-2">
          <Input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="h-9 flex-1 focus-visible:ring-0 focus-visible:ring-offset-0"
            disabled={isTransitioning}
          />
          <Button
            onClick={handleSendText}
            size="icon"
            variant="ghost"
            className="rounded-full"
            disabled={!textInput.trim() || isTransitioning}
          >
            <IconSendIcon className="size-4" />
            <span className="sr-only">Send message</span>
          </Button>
          {!isCallActive ? (
            <Button
              onClick={handleCall}
              size="icon"
              variant="ghost"
              className="relative shrink-0 rounded-full"
              disabled={isTransitioning}
            >
              <IconAudioLinesIcon className="size-4" />
              <span className="sr-only">Start voice call</span>
            </Button>
          ) : (
            <Button
              onClick={handleCall}
              size="icon"
              variant="secondary"
              className="relative shrink-0 rounded-full"
              disabled={isTransitioning}
            >
              <IconPhoneOffIcon className="size-4" />
              <span className="sr-only">End call</span>
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
