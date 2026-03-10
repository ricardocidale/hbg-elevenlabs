import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { VoiceSettings, TwilioStatus } from "@/features/ai-agent/types";
import { AI_AGENT_KEYS } from "@/features/ai-agent/query-keys";

export function useMarcelaSettings() {
  return useQuery<VoiceSettings>({
    queryKey: AI_AGENT_KEYS.voiceSettings,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/voice-settings");
      return res.json();
    },
  });
}

export function useSaveMarcelaSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: VoiceSettings) => {
      const res = await apiRequest("POST", "/api/admin/voice-settings", settings);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AI_AGENT_KEYS.voiceSettings });
      queryClient.invalidateQueries({ queryKey: AI_AGENT_KEYS.signedUrl });
      queryClient.invalidateQueries({ queryKey: ["global-assumptions"] });
      toast({ title: "AI Agent settings saved", description: "Voice configuration updated successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useTwilioStatus() {
  return useQuery<TwilioStatus>({
    queryKey: AI_AGENT_KEYS.twilioStatus,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/twilio-status");
      return res.json();
    },
  });
}

export function useSendTestSms() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ to, message }: { to: string; message: string }) => {
      const res = await apiRequest("POST", "/api/admin/send-notification", { to, message });
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast({ title: "Test SMS sent", description: `Message sent to ${variables.to}` });
    },
    onError: (err: Error) => {
      toast({ title: "SMS failed", description: err.message, variant: "destructive" });
    },
  });
}
