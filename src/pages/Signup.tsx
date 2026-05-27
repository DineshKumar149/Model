import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user && !authLoading) {
      navigate("/gallery");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const checkUsername = async () => {
      if (!username || username.length < 3) {
        setUsernameAvailable(null);
        return;
      }
      
      setIsCheckingUsername(true);
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username.toLowerCase())
        .maybeSingle();
        
      setUsernameAvailable(!data);
      setIsCheckingUsername(false);
    };

    const timeoutId = setTimeout(checkUsername, 500);
    return () => clearTimeout(timeoutId);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName || !username) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    
    setLoading(true);

    if (!usernameAvailable) {
      toast({ title: "Username is not available", variant: "destructive" });
      setLoading(false);
      return;
    }

    const { error } = await signUp(email, password, {
      display_name: displayName,
      username: username.toLowerCase()
    });
    
    setLoading(false);
    
    if (error) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Account created! You can now log in." });
      navigate("/login");
    }
  };

  if (authLoading) return null;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: "url('/images/gradient-background.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div
        className="absolute inset-0 opacity-0"
        style={{
          background: "rgba(0, 0, 0, 0.15)",
        }}
      ></div>

      {/* Floating glass orbs for visual interest */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full opacity-50 animate-pulse"
          style={{
            background: "rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(20px) saturate(180%)",
            border: "2px solid rgba(255, 255, 255, 0.3)",
            boxShadow: "0 8px 32px rgba(255, 255, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
          }}
        ></div>
        <div
          className="absolute top-3/4 right-1/4 w-24 h-24 rounded-full opacity-40 animate-pulse delay-1000"
          style={{
            background: "rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(20px) saturate(180%)",
            border: "2px solid rgba(255, 255, 255, 0.3)",
            boxShadow: "0 8px 32px rgba(255, 255, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
          }}
        ></div>
        <div
          className="absolute top-1/2 right-1/3 w-16 h-16 rounded-full opacity-45 animate-pulse delay-500"
          style={{
            background: "rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(20px) saturate(180%)",
            border: "2px solid rgba(255, 255, 255, 0.3)",
            boxShadow: "0 8px 32px rgba(255, 255, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.4)",
          }}
        ></div>
      </div>

      <div
        className="w-full max-w-md relative z-10 p-8 sm:p-10 rounded-[24px] shadow-2xl transition-all hover:-translate-y-1 duration-300"
        style={{
          background: "rgba(255, 255, 255, 0.25)",
          backdropFilter: "blur(40px) saturate(250%)",
          border: "1px solid rgba(255, 255, 255, 0.4)",
          boxShadow:
            "0 32px 80px rgba(0, 0, 0, 0.3), 0 16px 64px rgba(255, 255, 255, 0.2), inset 0 3px 0 rgba(255, 255, 255, 0.6), inset 0 -1px 0 rgba(255, 255, 255, 0.3)",
        }}
      >
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-4xl font-bold font-sans text-slate-800">Create Account</h1>
          <p className="text-slate-800/70 font-sans text-sm">
            Sign up to see photos and videos from your friends.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email" className="text-xs font-semibold text-slate-800 font-sans ml-1">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-white/50 bg-white/30 placeholder:text-slate-800/50 text-slate-900 py-5 text-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent focus-visible:bg-white/40 transition-all duration-200 rounded-xl"
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="displayName" className="text-xs font-semibold text-slate-800 font-sans ml-1">
              Full Name
            </Label>
            <Input
              id="displayName"
              type="text"
              placeholder="Enter your full name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="border-white/50 bg-white/30 placeholder:text-slate-800/50 text-slate-900 py-5 text-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent focus-visible:bg-white/40 transition-all duration-200 rounded-xl"
              required
            />
          </div>

          <div className="space-y-1 relative">
            <Label htmlFor="username" className="text-xs font-semibold text-slate-800 font-sans ml-1">
              Username
            </Label>
            <Input
              id="username"
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`border-white/50 bg-white/30 placeholder:text-slate-800/50 text-slate-900 py-5 text-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent focus-visible:bg-white/40 transition-all duration-200 rounded-xl ${usernameAvailable === false ? 'border-red-500 focus-visible:ring-red-500' : ''} ${usernameAvailable === true ? 'border-green-500 focus-visible:ring-green-500' : ''}`}
              required
            />
            {username.length >= 3 && (
              <div className="absolute right-3 top-9 text-sm">
                {isCheckingUsername ? (
                  <span className="text-slate-500">...</span>
                ) : usernameAvailable ? (
                  <span className="text-green-600 font-bold">✓</span>
                ) : (
                  <span className="text-red-600 font-bold">✗</span>
                )}
              </div>
            )}
            {usernameAvailable === false && (
              <p className="text-xs text-red-600 ml-1 mt-1">This username is taken.</p>
            )}
            {usernameAvailable === true && (
              <p className="text-xs text-green-600 ml-1 mt-1">Username is available!</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="password" className="text-xs font-semibold text-slate-800 font-sans ml-1">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-white/50 bg-white/30 placeholder:text-slate-800/50 text-slate-900 py-5 text-sm focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent focus-visible:bg-white/40 transition-all duration-200 rounded-xl"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading || !email || password.length < 6 || !displayName || !username || usernameAvailable === false}
            className="w-full font-sans font-bold py-6 text-base rounded-xl transition-all duration-300 hover:-translate-y-0.5 mt-4"
            style={{ backgroundColor: "#0C115B", color: "white" }}
          >
            {loading ? "Signing up..." : "Sign Up"}
          </Button>
        </form>

        <div className="mt-8 text-center space-y-4">
          <div className="pt-4 border-t border-white/30">
            <p className="text-sm text-slate-800 font-sans font-medium">
              Have an account?{" "}
              <Link to="/login" className="text-blue-700 font-bold hover:text-blue-800 ml-1">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
