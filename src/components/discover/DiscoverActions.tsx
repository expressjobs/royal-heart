import { Heart, MessageCircle, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DiscoverActions({
  disabled,
  onPass,
  onSuperLike,
  onMessage,
  onLike,
}: {
  disabled?: boolean;
  onPass: () => void;
  onSuperLike: () => void;
  onMessage: () => void;
  onLike: () => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2 pb-[calc(env(safe-area-inset-bottom)+0.25rem)]">
      <Button
        variant="outline"
        className="h-auto flex-col rounded-2xl px-2 py-3 hover:border-destructive hover:text-destructive"
        onClick={onPass}
        disabled={disabled}
        aria-label="Pass"
      >
        <X className="h-5 w-5" />
        <span className="text-xs">Pass</span>
      </Button>
      <Button
        variant="secondary"
        className="h-auto flex-col rounded-2xl px-2 py-3"
        onClick={onSuperLike}
        disabled={disabled}
        aria-label="Super Like"
      >
        <Sparkles className="h-5 w-5" />
        <span className="text-xs">Super</span>
      </Button>
      <Button
        variant="secondary"
        className="h-auto flex-col rounded-2xl px-2 py-3"
        onClick={onMessage}
        disabled={disabled}
        aria-label="Message"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="text-xs">Message</span>
      </Button>
      <Button
        variant="hero"
        className="h-auto flex-col rounded-2xl px-2 py-3"
        onClick={onLike}
        disabled={disabled}
        aria-label="Like"
      >
        <Heart className="h-5 w-5" fill="currentColor" />
        <span className="text-xs">Like</span>
      </Button>
    </div>
  );
}
