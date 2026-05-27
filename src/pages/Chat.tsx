import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import ConversationList from "@/components/chat/ConversationList";
import ChatRoom from "@/components/chat/ChatRoom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { setActiveConversationId } from "@/lib/active-conversation";

const Chat = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get("c");
  const [activeConv, setActiveConv] = useState<string | null>(initial);

  // Broadcast active conversation to global notifier
  useEffect(() => {
    setActiveConversationId(activeConv);
    return () => { setActiveConversationId(null); };
  }, [activeConv]);

  // Sync active conversation -> URL
  useEffect(() => {
    const current = searchParams.get("c");
    if (activeConv && current !== activeConv) {
      const next = new URLSearchParams(searchParams);
      next.set("c", activeConv);
      setSearchParams(next, { replace: true });
    } else if (!activeConv && current) {
      const next = new URLSearchParams(searchParams);
      next.delete("c");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConv]);

  // React to URL changes from outside
  useEffect(() => {
    const c = searchParams.get("c");
    setActiveConv((prev) => (c !== prev ? c : prev));
  }, [searchParams]);

  return (
    <div className="h-screen bg-background flex flex-col">
      <div className="flex-1 min-h-0 max-w-6xl w-full mx-auto flex overflow-hidden">
        <aside
          className={`${
            activeConv ? "hidden md:flex" : "flex"
          } flex-col w-full md:w-80 border-r border-border/50`}
        >
          <ConversationList activeId={activeConv} onSelect={(id) => setActiveConv(id)} />
        </aside>

        <main
          className={`${
            activeConv ? "flex" : "hidden md:flex"
          } flex-col flex-1 min-w-0`}
        >
          {activeConv ? (
            <>
              <div className="md:hidden p-2 border-b border-border/50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveConv(null)}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </Button>
              </div>
              <ChatRoom conversationId={activeConv} />
            </>
          ) : (
            <div className="flex-1 hidden md:flex flex-col items-center justify-center text-muted-foreground gap-4">
              <div className="w-20 h-20 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                <svg
                  aria-label="Direct"
                  className="x1lliihq x1n2onr6 x5n08af"
                  fill="currentColor"
                  height="48"
                  role="img"
                  viewBox="0 0 96 96"
                  width="48"
                >
                  <title>Direct</title>
                  <path
                    clipRule="evenodd"
                    d="M48 0C21.532 0 0 21.533 0 48s21.532 48 48 48 48-21.532 48-48S74.468 0 48 0zm23.769 27.955l-6.897 32.4c-.518 2.316-1.884 2.878-3.816 1.792l-10.557-7.784-5.098 4.905c-.564.564-1.038.777-2.126.777l-.757-10.782 19.574-17.676c.85-.754-.185-1.17-1.308-.416l-24.198 15.233-10.425-3.258c-2.265-.708-2.311-2.265.474-3.351l40.657-15.679c1.885-.679 3.534.415 2.477 3.839z"
                    fillRule="evenodd"
                  />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-bold text-foreground text-lg mb-1">Your messages</p>
                <p className="text-[14px] text-muted-foreground">
                  Send private messages to a friend or group.
                </p>
              </div>
              <button
                onClick={() => {}}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-xl font-semibold text-[14px] hover:bg-primary/90 transition-colors"
              >
                Send message
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Chat;
