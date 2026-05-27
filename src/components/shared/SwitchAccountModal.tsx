import { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "@/components/shared/ThemeProvider";

interface SavedAccount {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  sessionToken?: string | null;
}

const STORAGE_KEY = "atome_saved_accounts";

const getSaved = (): SavedAccount[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
};
const upsertSaved = (acc: SavedAccount) => {
  const list = getSaved();
  const idx = list.findIndex(a => a.userId === acc.userId);
  if (idx >= 0) {
    list[idx] = { 
      ...list[idx], 
      ...acc, 
      sessionToken: acc.sessionToken || list[idx].sessionToken 
    };
  } else {
    list.push(acc);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
};

interface Props { isOpen: boolean; onClose: () => void; }

export default function SwitchAccountModal({ isOpen, onClose }: Props) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [view, setView] = useState<"accounts" | "login">("accounts");
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);

  // login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [saveInfo, setSaveInfo] = useState(true);
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState("");

  // Sync current user into saved accounts
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      
      const tokenKey = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
      const sessionToken = tokenKey ? localStorage.getItem(tokenKey) : null;

      upsertSaved({
        userId: user.id,
        email: user.email || "",
        displayName: data?.display_name || user.email?.split("@")[0] || "User",
        avatarUrl: data?.avatar_url || "",
        sessionToken,
      });
      setAccounts(getSaved());
    })();
  }, [user]);

  useEffect(() => {
    if (isOpen) { setAccounts(getSaved()); setView("accounts"); setError(""); }
  }, [isOpen]);

  const openLogin = (acc?: SavedAccount) => {
    setEmail(acc?.email || "");
    setPassword("");
    setError("");
    setView("login");
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setLogging(true);
    setError("");
    const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) { setError(err.message); setLogging(false); return; }
    
    if (saveInfo && data.user) {
      const { data: prof } = await supabase.from("profiles").select("display_name, avatar_url").eq("user_id", data.user.id).maybeSingle();
      
      const tokenKey = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
      let sessionToken = tokenKey ? localStorage.getItem(tokenKey) : null;
      if (!sessionToken && data.session) {
        sessionToken = JSON.stringify(data.session);
      }

      upsertSaved({ 
        userId: data.user.id, 
        email: data.user.email || email, 
        displayName: prof?.display_name || email.split("@")[0], 
        avatarUrl: prof?.avatar_url || "",
        sessionToken,
      });
    }
    setLogging(false);
    onClose();
    window.location.href = "/gallery";
  };

  const handleAccountClick = (acc: SavedAccount) => {
    if (acc.userId === user?.id) { onClose(); return; }
    
    if (acc.sessionToken) {
      const tokenKey = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
      if (tokenKey) {
        localStorage.setItem(tokenKey, acc.sessionToken);
        onClose();
        window.location.reload();
        return;
      }
    }
    
    openLogin(acc);
  };

  if (!isOpen) return null;

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 400,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: isDark ? "rgba(0,0,0,0.75)" : "rgba(0,0,0,0.45)",
  };
  const card: React.CSSProperties = {
    background: isDark ? "#1c1c1e" : "#fff", borderRadius: 20, overflow: "hidden",
    boxShadow: isDark ? "0 24px 80px rgba(0,0,0,0.8)" : "0 8px 32px rgba(0,0,0,0.15)",
    border: isDark ? "none" : "1px solid #e5e5e5",
    animation: "fadeScaleIn 0.2s ease forwards",
  };

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      {/* ── ACCOUNTS VIEW ── */}
      {view === "accounts" && (
        <div style={{ ...card, width: 380 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 20px 16px", position: "relative" }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: isDark ? "#fff" : "#000" }}>Switch accounts</span>
            <button onClick={onClose} style={{ position: "absolute", right: 16, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%" }}>
              <X style={{ width: 18, height: 18, color: isDark ? "#fff" : "#000" }} />
            </button>
          </div>

          {/* Accounts */}
          {accounts.map(acc => (
            <button
              key={acc.userId}
              onClick={() => handleAccountClick(acc)}
              style={{ display: "flex", alignItems: "center", width: "100%", padding: "14px 20px", background: "transparent", border: "none", borderTop: isDark ? "1px solid #2c2c2e" : "1px solid #e5e5e5", cursor: "pointer" }}
              className={`transition-colors ${isDark ? "hover:bg-[#2a2a2c]" : "hover:bg-[#f3f4f6]"}`}
            >
              <Avatar style={{ width: 44, height: 44, marginRight: 14, flexShrink: 0 }}>
                <AvatarImage src={acc.avatarUrl} className="object-cover" />
                <AvatarFallback style={{ background: isDark ? "#555" : "#e5e5e5", color: isDark ? "#fff" : "#000", fontWeight: 700, fontSize: 16 }}>{acc.displayName[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <span style={{ flex: 1, textAlign: "left", fontSize: 15, fontWeight: 600, color: isDark ? "#fff" : "#000" }}>
                {acc.email?.split("@")[0] || acc.displayName}
              </span>
              {acc.userId === user?.id && (
                <div style={{ width: 26, height: 26, borderRadius: "50%", border: isDark ? "2px solid #fff" : "2px solid #000", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Check style={{ width: 14, height: 14, color: isDark ? "#fff" : "#000" }} strokeWidth={2.5} />
                </div>
              )}
            </button>
          ))}

          {/* Log into an Existing Account */}
          <button
            onClick={() => openLogin()}
            style={{ display: "block", width: "100%", padding: "18px 20px", background: "transparent", border: "none", borderTop: isDark ? "1px solid #2c2c2e" : "1px solid #e5e5e5", cursor: "pointer", fontSize: 15, fontWeight: 600, color: "#0095f6", textAlign: "center" }}
          >
            Log into an Existing Account
          </button>
        </div>
      )}

      {/* ── LOGIN VIEW ── */}
      {view === "login" && (
        <div style={{ ...card, width: 420, padding: "40px 36px 32px", position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", right: 20, top: 20, background: "transparent", border: "none", cursor: "pointer", display: "flex" }}>
            <X style={{ width: 20, height: 20, color: isDark ? "#fff" : "#000" }} />
          </button>

          {/* App name */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <span style={{ fontSize: 44, fontWeight: 700, color: isDark ? "#fff" : "#000", fontFamily: "'Billabong','Dancing Script',cursive" }}>Atome</span>
          </div>

          {/* Email input */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ position: "relative" }}>
              <label style={{ position: "absolute", top: 8, left: 14, fontSize: 11, color: isDark ? "#999" : "#666" }}>Phone number, username, or email</label>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: "100%", padding: "26px 14px 10px", background: isDark ? "#2c2c2e" : "#f3f4f6", border: isDark ? "1px solid #444" : "1px solid #d1d5db", borderRadius: 10, color: isDark ? "#fff" : "#000", fontSize: 15, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>

          {/* Password input */}
          <div style={{ position: "relative", marginBottom: 16 }}>
            <div style={{ position: "relative" }}>
              <label style={{ position: "absolute", top: 8, left: 14, fontSize: 11, color: isDark ? "#999" : "#666" }}>Password</label>
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
                style={{ width: "100%", padding: "26px 80px 10px 14px", background: isDark ? "#2c2c2e" : "#f3f4f6", border: isDark ? "1px solid #444" : "1px solid #d1d5db", borderRadius: 10, color: isDark ? "#fff" : "#000", fontSize: 15, outline: "none", boxSizing: "border-box" }}
              />
              <button
                onClick={() => setShowPwd(!showPwd)}
                style={{ position: "absolute", right: 0, top: 0, height: "100%", padding: "0 16px", background: "transparent", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: isDark ? "#fff" : "#000" }}
              >
                {showPwd ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Save login info */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
            <input
              type="checkbox" id="saveLogin" checked={saveInfo}
              onChange={e => setSaveInfo(e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#0095f6" }}
            />
            <label htmlFor="saveLogin" style={{ fontSize: 14, color: isDark ? "#ccc" : "#444", cursor: "pointer" }}>Save login info</label>
          </div>

          {error && <p style={{ color: "#f47067", fontSize: 13, textAlign: "center", marginBottom: 12 }}>{error}</p>}

          {/* Log in button */}
          <button
            onClick={handleLogin}
            disabled={logging || !email.trim() || !password.trim()}
            style={{ width: "100%", padding: "15px", background: "#4f46e5", border: "none", borderRadius: 12, color: "#fff", fontSize: 16, fontWeight: 700, cursor: logging ? "not-allowed" : "pointer", marginBottom: 22, opacity: logging ? 0.75 : 1, transition: "opacity 150ms" }}
          >
            {logging ? "Logging in…" : "Log in"}
          </button>

          {/* Forgot password */}
          <div style={{ textAlign: "center" }}>
            <button
              onClick={() => { onClose(); window.location.href = "/forgot-password"; }}
              style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: isDark ? "#fff" : "#737373" }}
            >
              Forgot password?
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes fadeScaleIn { from { opacity:0; transform:scale(0.95) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>
    </div>
  );
}
