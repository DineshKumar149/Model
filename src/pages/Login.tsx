import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user && !authLoading) {
      navigate("/gallery");
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setLoading(true);
    
    let loginEmail = email;
    
    // If it's a username (no @ symbol), try to find the associated email
    if (!email.includes("@")) {
      const { data, error } = await supabase
        .from("profiles")
        .select("email")
        .eq("username", email.toLowerCase())
        .maybeSingle();
        
      if (data && data.email) {
        loginEmail = data.email;
      } else {
        toast({ title: "Login failed", description: "Username not found.", variant: "destructive" });
        setLoading(false);
        return;
      }
    }

    const { error } = await signIn(loginEmail, password);
    setLoading(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Welcome back!" });
      navigate("/gallery");
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
          <h1 className="text-4xl font-bold font-sans text-slate-800">Welcome Back</h1>
          <p className="text-slate-800/70 font-sans">
            Sign in to your account to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-semibold text-slate-800 font-sans">
              Email or Username
            </Label>
            <Input
              id="email"
              type="text"
              placeholder="Enter your email or username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-white/50 bg-white/30 placeholder:text-slate-800/50 text-slate-900 py-6 text-base focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent focus-visible:bg-white/40 transition-all duration-200 rounded-xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-semibold text-slate-800 font-sans">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-white/50 bg-white/30 placeholder:text-slate-800/50 text-slate-900 py-6 text-base focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent focus-visible:bg-white/40 transition-all duration-200 rounded-xl"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading || !email || password.length < 6}
            className="w-full font-sans font-bold py-6 text-base rounded-xl transition-all duration-300 hover:-translate-y-0.5 mt-2"
            style={{ backgroundColor: "#0C115B", color: "white" }}
          >
            {loading ? "Signing In..." : "Sign In"}
          </Button>
        </form>

        <div className="mt-8 text-center space-y-4">
          <Link
            to="/forgot-password"
            className="text-sm text-slate-800/80 hover:text-slate-900 font-sans font-medium transition-colors block"
          >
            Forgot your password?
          </Link>
          
          <div className="pt-4 border-t border-white/30">
            <p className="text-sm text-slate-800 font-sans font-medium">
              Don't have an account?{" "}
              <Link to="/signup" className="text-blue-700 font-bold hover:text-blue-800 ml-1">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
