import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  Phone, 
  Mail, 
  Heart, 
  MessageCircle, 
  Bookmark, 
  LogOut, 
  Loader2, 
  Camera, 
  Trash2, 
  ArrowLeft,
  Settings as SettingsIcon,
  Image as ImageIcon,
  Moon,
  Sun,
  Monitor,
  Palette,
  Lock
} from "lucide-react";
import FeedPostItem from "@/components/gallery/FeedPostItem";
import { useTheme } from "@/components/shared/ThemeProvider";
import { Switch } from "@/components/ui/switch";

const Settings = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<"edit" | "privacy" | "appearance" | "likes" | "comments" | "saved" | "logout">("edit");
  const [loading, setLoading] = useState(false);

  // Edit Profile States
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // List States
  const [likedPosts, setLikedPosts] = useState<any[]>([]);
  const [commentedPosts, setCommentedPosts] = useState<any[]>([]);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  
  const [loadingLists, setLoadingLists] = useState({
    likes: false,
    comments: false,
    saved: false,
  });

  // Sync profile data
  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setDisplayName(user.user_metadata?.display_name || data.display_name || "");
        setPhone(data.phone || user.user_metadata?.phone || "");
        setAvatarUrl(user.user_metadata?.avatar_url || data.avatar_url || "");
        setIsPrivate(data.is_private || false);
      }
    };
    fetchProfile();
  }, [user]);

  // Fetch Liked Posts
  const fetchLikedPosts = async () => {
    if (!user) return;
    setLoadingLists(prev => ({ ...prev, likes: true }));
    try {
      const { data: likes } = await supabase
        .from("post_likes")
        .select("post_id")
        .eq("user_id", user.id);

      if (likes && likes.length > 0) {
        const postIds = likes.map(l => l.post_id);
        const { data: posts } = await supabase
          .from("posts")
          .select("*")
          .in("id", postIds)
          .order("created_at", { ascending: false });
        setLikedPosts(posts || []);
      } else {
        setLikedPosts([]);
      }
    } catch (err) {
      console.error("Error fetching liked posts:", err);
    } finally {
      setLoadingLists(prev => ({ ...prev, likes: false }));
    }
  };

  // Fetch Commented Posts
  const fetchCommentedPosts = async () => {
    if (!user) return;
    setLoadingLists(prev => ({ ...prev, comments: true }));
    try {
      const { data: comments } = await supabase
        .from("post_comments")
        .select("post_id")
        .eq("user_id", user.id);

      if (comments && comments.length > 0) {
        const postIds = Array.from(new Set(comments.map(c => c.post_id)));
        const { data: posts } = await supabase
          .from("posts")
          .select("*")
          .in("id", postIds)
          .order("created_at", { ascending: false });
        setCommentedPosts(posts || []);
      } else {
        setCommentedPosts([]);
      }
    } catch (err) {
      console.error("Error fetching commented posts:", err);
    } finally {
      setLoadingLists(prev => ({ ...prev, comments: false }));
    }
  };

  // Fetch Saved Posts
  const fetchSavedPosts = async () => {
    if (!user) return;
    setLoadingLists(prev => ({ ...prev, saved: true }));
    try {
      const savedIds = user.user_metadata?.saved_posts || [];
      if (savedIds.length > 0) {
        const { data: posts } = await supabase
          .from("posts")
          .select("*")
          .in("id", savedIds)
          .order("created_at", { ascending: false });
        setSavedPosts(posts || []);
      } else {
        setSavedPosts([]);
      }
    } catch (err) {
      console.error("Error fetching saved posts:", err);
    } finally {
      setLoadingLists(prev => ({ ...prev, saved: false }));
    }
  };

  // Load lists on tab switch
  useEffect(() => {
    if (activeTab === "likes") fetchLikedPosts();
    if (activeTab === "comments") fetchCommentedPosts();
    if (activeTab === "saved") fetchSavedPosts();
  }, [activeTab]);

  // Real-time subscriptions for Likes, Comments
  useEffect(() => {
    if (!user) return;

    const likesChannel = supabase
      .channel(`liked-posts-settings-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_likes", filter: `user_id=eq.${user.id}` },
        () => {
          fetchLikedPosts();
        }
      )
      .subscribe();

    const commentsChannel = supabase
      .channel(`commented-posts-settings-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_comments", filter: `user_id=eq.${user.id}` },
        () => {
          fetchCommentedPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(commentsChannel);
    };
  }, [user]);

  // Fetch saved posts dynamically when user metadata updates
  useEffect(() => {
    if (user && activeTab === "saved") {
      fetchSavedPosts();
    }
  }, [user?.user_metadata?.saved_posts]);

  // Handle profile image upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/${user.id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", user.id);

      setAvatarUrl(publicUrl);
      toast({ title: "Profile picture updated!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setUploading(true);
    try {
      await supabase.auth.updateUser({ data: { avatar_url: null } });
      await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", user.id);
      setAvatarUrl("");
      toast({ title: "Profile picture removed!" });
    } catch (err: any) {
      toast({ title: "Failed to remove", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // Save profile modifications
  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: { display_name: displayName, phone: phone }
      });

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ display_name: displayName, phone: phone, is_private: isPrivate })
        .eq("user_id", user.id);

      if (authError || profileError) {
        throw new Error(authError?.message || profileError?.message || "Error updating profiles");
      }

      toast({ title: "Profile updated successfully!" });
    } catch (err: any) {
      toast({ title: "Failed to update profile", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      navigate("/login");
      toast({ title: "Signed out successfully!" });
    } catch (err: any) {
      toast({ title: "Failed to sign out", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const displayFallback = displayName ? displayName.slice(0, 2).toUpperCase() : "U";

  const renderTabContent = () => {
    switch (activeTab) {
      case "edit":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Edit Profile</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Manage your public information and avatar</p>
            </div>

            {/* Profile Pic Upload */}
            <div className="flex flex-col items-center sm:flex-row gap-6 p-6 bg-white/30 dark:bg-black/20 rounded-2xl border border-white/40 dark:border-white/10">
              <div className="relative group">
                <Avatar className="w-24 h-24 ring-4 ring-white dark:ring-white/10 shadow-lg">
                  <AvatarImage src={avatarUrl || ""} className="object-cover" />
                  <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-3xl font-bold">
                    {displayFallback}
                  </AvatarFallback>
                </Avatar>
                {uploading && (
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center backdrop-blur-xs">
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2.5 w-full sm:w-auto">
                <span className="text-sm font-semibold text-foreground text-center sm:text-left">Profile Image</span>
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl font-bold gap-1.5 h-9 bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 border-border/40"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Upload Photo
                  </Button>
                  {avatarUrl && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="rounded-xl font-bold gap-1.5 h-9"
                      onClick={handleRemoveAvatar}
                      disabled={uploading}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Details Form */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Display Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Enter your name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="pl-11 h-12 bg-white/50 dark:bg-black/20 border-white/40 dark:border-white/10 focus-visible:ring-1 focus-visible:ring-primary rounded-2xl font-medium shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Mobile Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Enter your mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-11 h-12 bg-white/50 dark:bg-black/20 border-white/40 dark:border-white/10 focus-visible:ring-1 focus-visible:ring-primary rounded-2xl font-medium shadow-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground/55" />
                  <Input
                    value={user?.email || ""}
                    disabled
                    className="pl-11 h-12 bg-black/5 dark:bg-white/5 border-white/30 dark:border-white/10 text-muted-foreground select-none cursor-not-allowed rounded-2xl font-medium"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground/70 pl-1">Email address is associated with your account and cannot be modified.</p>
              </div>
            </div>

            <Button
              className="w-full h-12 rounded-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-200/50 dark:shadow-none transition-all hover:scale-[1.01] active:scale-[0.99] mt-6"
              onClick={handleSaveProfile}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving updates...
                </>
              ) : (
                "Save Profile Updates"
              )}
            </Button>
          </div>
        );

      case "privacy":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Account privacy</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Control who can see your profile and posts</p>
            </div>
            
            <div className="flex flex-col gap-6 p-6 bg-white/30 dark:bg-black/20 rounded-2xl border border-white/40 dark:border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-base font-bold text-foreground">Private account</span>
                  <span className="text-sm text-muted-foreground max-w-[80%]">When your account is private, only the followers you approve can see what you share, including your photos or videos on hashtag and location pages.</span>
                </div>
                <Switch 
                  checked={isPrivate} 
                  onCheckedChange={async (checked) => {
                    setIsPrivate(checked);
                    if (user) {
                      setSaving(true);
                      await supabase.from("profiles").update({ is_private: checked }).eq("user_id", user.id);
                      setSaving(false);
                      toast({ title: checked ? "Account is now private" : "Account is now public" });
                    }
                  }} 
                />
              </div>
            </div>
          </div>
        );

      case "appearance":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Appearance</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Customize how Atome looks on your device</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Light Theme Card */}
              <button
                onClick={() => setTheme("light")}
                className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all ${
                  theme === "light" 
                    ? "border-primary bg-primary/5 shadow-md scale-[1.02]" 
                    : "border-border/40 bg-white/30 dark:bg-black/20 hover:bg-white/50 dark:hover:bg-black/40"
                }`}
              >
                <div className={`p-3 rounded-full mb-3 ${theme === "light" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                  <Sun className="w-6 h-6" />
                </div>
                <span className={`font-semibold ${theme === "light" ? "text-foreground" : "text-muted-foreground"}`}>Light</span>
              </button>

              {/* Dark Theme Card */}
              <button
                onClick={() => setTheme("dark")}
                className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all ${
                  theme === "dark" 
                    ? "border-primary bg-primary/5 shadow-md scale-[1.02]" 
                    : "border-border/40 bg-white/30 dark:bg-black/20 hover:bg-white/50 dark:hover:bg-black/40"
                }`}
              >
                <div className={`p-3 rounded-full mb-3 ${theme === "dark" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                  <Moon className="w-6 h-6" />
                </div>
                <span className={`font-semibold ${theme === "dark" ? "text-foreground" : "text-muted-foreground"}`}>Dark</span>
              </button>

              {/* System Theme Card */}
              <button
                onClick={() => setTheme("system")}
                className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all ${
                  theme === "system" 
                    ? "border-primary bg-primary/5 shadow-md scale-[1.02]" 
                    : "border-border/40 bg-white/30 dark:bg-black/20 hover:bg-white/50 dark:hover:bg-black/40"
                }`}
              >
                <div className={`p-3 rounded-full mb-3 ${theme === "system" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                  <Monitor className="w-6 h-6" />
                </div>
                <span className={`font-semibold ${theme === "system" ? "text-foreground" : "text-muted-foreground"}`}>System</span>
              </button>
            </div>
          </div>
        );

      case "likes":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Liked Posts</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Posts you have interacted with and liked</p>
            </div>

            {loadingLists.likes ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/60" />
              </div>
            ) : likedPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-white/30 dark:bg-black/20 rounded-[24px] border border-dashed border-border/40 px-6">
                <Heart className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-bold text-foreground">No liked posts</h3>
                <p className="text-sm text-muted-foreground mt-1">Posts you like from the feed will appear here instantly.</p>
                <Button size="sm" variant="outline" className="mt-4 rounded-xl font-bold border-border/60 hover:bg-secondary" onClick={() => navigate("/gallery")}>
                  Explore Feed
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-6 max-w-lg mx-auto">
                {likedPosts.map((post) => (
                  <FeedPostItem key={post.id} item={post} currentUser={user} />
                ))}
              </div>
            )}
          </div>
        );

      case "comments":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Commented Posts</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Posts where you have shared your thoughts</p>
            </div>

            {loadingLists.comments ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/60" />
              </div>
            ) : commentedPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-white/30 dark:bg-black/20 rounded-[24px] border border-dashed border-border/40 px-6">
                <MessageCircle className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-bold text-foreground">No commented posts</h3>
                <p className="text-sm text-muted-foreground mt-1">Posts you comment on will display here.</p>
                <Button size="sm" variant="outline" className="mt-4 rounded-xl font-bold border-border/60 hover:bg-secondary" onClick={() => navigate("/gallery")}>
                  Explore Feed
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-6 max-w-lg mx-auto">
                {commentedPosts.map((post) => (
                  <FeedPostItem key={post.id} item={post} currentUser={user} />
                ))}
              </div>
            )}
          </div>
        );

      case "saved":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Saved Posts</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Posts you have bookmarked or saved</p>
            </div>

            {loadingLists.saved ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/60" />
              </div>
            ) : savedPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-white/30 dark:bg-black/20 rounded-[24px] border border-dashed border-border/40 px-6">
                <Bookmark className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-bold text-foreground">No saved posts</h3>
                <p className="text-sm text-muted-foreground mt-1">Saves from the feed show up here instantly.</p>
                <Button size="sm" variant="outline" className="mt-4 rounded-xl font-bold border-border/60 hover:bg-secondary" onClick={() => navigate("/gallery")}>
                  Explore Feed
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-6 max-w-lg mx-auto">
                {savedPosts.map((post) => (
                  <FeedPostItem key={post.id} item={post} currentUser={user} />
                ))}
              </div>
            )}
          </div>
        );

      case "logout":
        return (
          <div className="space-y-6 max-w-md mx-auto text-center py-8">
            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-4 border border-destructive/20 shadow-sm animate-pulse">
              <LogOut className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-extrabold text-foreground">Confirm Sign Out</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">Are you sure you want to sign out from Atome? You will need to enter your credentials to log back in.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-2xl font-bold border-border/60 hover:bg-secondary transition-all"
                disabled={loading}
                onClick={() => setActiveTab("edit")}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 h-12 rounded-2xl font-bold bg-destructive hover:bg-destructive/95 text-destructive-foreground shadow-lg shadow-red-200/50 dark:shadow-none transition-all hover:scale-[1.01] active:scale-[0.99]"
                disabled={loading}
                onClick={handleSignOut}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Signing out...
                  </>
                ) : (
                  "Sign Out Account"
                )}
              </Button>
            </div>
          </div>
        );
    }
  };

  const menuItems = [
    { id: "edit", label: "Edit Profile", icon: User },
    { id: "privacy", label: "Account Privacy", icon: Lock },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "likes", label: "Liked Posts", icon: Heart },
    { id: "comments", label: "Commented Posts", icon: MessageCircle },
    { id: "saved", label: "Saved Posts", icon: Bookmark },
    { id: "logout", label: "Sign Out", icon: LogOut, variant: "destructive" as const },
  ];

  return (
    <div className="flex-1 w-full min-h-screen relative font-sans">
      {/* Background gradients */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
      <div className="fixed inset-0 -z-10 backdrop-blur-[1px]" />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back navigation header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)} 
            className="rounded-full bg-white/60 dark:bg-black/40 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-sm hover:bg-white/80 dark:hover:bg-black/60 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <SettingsIcon className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Settings & Dashboard
            </h1>
          </div>
        </div>

        {/* Dashboard Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Settings Sidebar Nav */}
          <div className="md:col-span-4 bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-[28px] shadow-xl p-4 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 pb-2 block">Account Preferences</span>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md scale-[1.02]"
                      : item.variant === "destructive"
                      ? "text-destructive hover:bg-destructive/10"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Main Setting View Card */}
          <div className="md:col-span-8 bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-[32px] shadow-xl p-6 sm:p-8 min-h-[480px]">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
