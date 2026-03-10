import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "elevenlabs-convai": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          url?: string;
          "agent-id"?: string;
          "signed-url"?: string;
          "server-location"?: string;
          variant?: string;
          placement?: string;
          dismissible?: string;
          language?: string;
          "avatar-image-url"?: string;
          "avatar-orb-color-1"?: string;
          "avatar-orb-color-2"?: string;
          "action-text"?: string;
          "start-call-text"?: string;
          "end-call-text"?: string;
          "expand-text"?: string;
          "listening-text"?: string;
          "speaking-text"?: string;
          "markdown-link-allowed-hosts"?: string;
          "markdown-link-include-www"?: string;
          "markdown-link-allow-http"?: string;
          "syntax-highlight-theme"?: string;
          "override-language"?: string;
          "override-prompt"?: string;
          "override-first-message"?: string;
          "override-voice-id"?: string;
          "dynamic-variables"?: string;
          "default-expanded"?: string;
          "always-expanded"?: string;
          "text-input"?: string;
          transcript?: string;
          "user-id"?: string;
          "collect-feedback"?: string;
        },
        HTMLElement
      >;
    }
  }
}
