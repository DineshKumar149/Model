import { useState, useRef, useEffect } from "react";
import { 
  X, Camera, Loader2, Link as LinkIcon, User, AtSign, 
  FileText, Plus, Trash, Shield, Phone, Mail, Lock, 
  CheckCircle2, XCircle
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface EditProfileModalProps {
  profile: any;
  onClose: () => void;
  onSaved: (updatedProfile: any) => void;
}

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "contact", label: "Contact Info", icon: Phone },
  { id: "security", label: "Security", icon: Shield },
] as const;

type TabType = typeof tabs[number]["id"];

const EditProfileModal = ({ profile, onClose, onSaved }: EditProfileModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tabs state
  const [activeTab, setActiveTab] = useState<TabType>("profile");

  // Profile Section State
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    profile?.avatar_url || user?.user_metadata?.avatar_url || null
  );

  // Username Availability State
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [usernameDebounce, setUsernameDebounce] = useState(username);

  // Contact Info Section State
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number || profile?.phone || "");
  const [websites, setWebsites] = useState<string[]>(
    Array.isArray(profile?.websites) ? profile.websites : (profile?.website ? [profile.website] : [])
  );

  // Security Section State
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const initials = displayName.slice(0, 2).toUpperCase() || "U";

  // Debounce username input
  useEffect(() => {
    const timer = setTimeout(() => {
      setUsernameDebounce(username);
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  // Check username availability
  useEffect(() => {
    if (usernameDebounce === profile?.username) {
      setUsernameStatus("idle");
      return;
    }
    if (!usernameDebounce) {
      setUsernameStatus("idle");
      return;
    }
    
    const checkUsername = async () => {
      setUsernameStatus("checking");
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", usernameDebounce)
          .maybeSingle();
          
        if (error) throw error;
        if (data) {
          setUsernameStatus("taken");
        } else {
          setUsernameStatus("available");
        }
      } catch (err) {
        setUsernameStatus("idle");
      }
    };
    checkUsername();
  }, [usernameDebounce, profile?.username]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setAvatarUrl(urlData.publicUrl);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
  };

  const addWebsite = () => setWebsites([...websites, ""]);
  const updateWebsite = (index: number, value: string) => {
    const newWebsites = [...websites];
    newWebsites[index] = value;
    setWebsites(newWebsites);
  };
  const removeWebsite = (index: number) => {
    setWebsites(websites.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!user) return;

    if (usernameStatus === "taken") {
      toast({ title: "Username is taken", description: "Please choose another username.", variant: "destructive" });
      return;
    }

    if (newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) {
        toast({ title: "Passwords do not match", variant: "destructive" });
        return;
      }
      setSaving(true);
      const { error: pwdError } = await supabase.auth.updateUser({ password: newPassword });
      if (pwdError) {
        toast({ title: "Failed to update password", description: pwdError.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    setSaving(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          display_name: displayName,
          avatar_url: avatarUrl,
        },
      });
      if (authError) throw authError;

      const validWebsites = websites.filter(w => w.trim() !== "");

      const updateData: any = {
        display_name: displayName,
        username: username || null,
        bio: bio || null,
        websites: validWebsites,
        phone_number: phoneNumber || null,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedProfile, error: profileError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", user.id)
        .select()
        .single();

      if (profileError) {
        // Fallback if schema doesn't have websites or phone_number, though requirements say they do.
        // It will throw if columns are entirely missing, but user says they exist.
        throw profileError;
      }

      toast({ title: "Profile updated successfully!" });
      onSaved(updatedProfile);
      onClose();
    } catch (err: any) {
      toast({ title: "Failed to update profile", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" />
      <div
        className="relative z-10 w-full max-w-lg animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[28px] shadow-2xl flex flex-col overflow-hidden h-full">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/40 shrink-0 bg-background/50">
            <h2 className="text-xl font-bold text-foreground tracking-tight">Edit Profile</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary/80 transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="px-6 py-6 overflow-y-auto flex-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            
            {/* Tabs List */}
            <div className="flex p-1.5 bg-secondary/40 rounded-2xl gap-1 mb-6 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap",
                    activeTab === tab.id 
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border/50" 
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="min-h-[300px]">
              {activeTab === "profile" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Avatar */}
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <Avatar className="w-24 h-24 ring-4 ring-background shadow-xl">
                        <AvatarImage src={avatarUrl || ""} className="object-cover" />
                        <AvatarFallback className="bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-3xl font-bold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                        {uploading ? (
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        ) : (
                          <Camera className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleAvatarChange}
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors"
                      >
                        Change photo
                      </button>
                      {avatarUrl && (
                        <button
                          onClick={handleRemoveAvatar}
                          disabled={uploading}
                          className="text-sm font-semibold text-red-500 hover:text-red-600 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Profile Inputs */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" /> Full Name
                      </label>
                      <Input
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your full name"
                        className="h-12 bg-secondary/30 border-border/40 focus-visible:ring-2 focus-visible:ring-indigo-500/50 rounded-xl font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <AtSign className="w-3.5 h-3.5" /> Username
                        </div>
                        {usernameStatus === "checking" && <span className="flex items-center gap-1 text-muted-foreground capitalize"><Loader2 className="w-3 h-3 animate-spin" /> Checking</span>}
                        {usernameStatus === "available" && <span className="text-green-500 flex items-center gap-1 capitalize"><CheckCircle2 className="w-3.5 h-3.5"/> Available</span>}
                        {usernameStatus === "taken" && <span className="text-red-500 flex items-center gap-1 capitalize"><XCircle className="w-3.5 h-3.5"/> Taken</span>}
                      </label>
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value.replace(/\s/g, "").toLowerCase())}
                        placeholder="username"
                        className={cn(
                          "h-12 bg-secondary/30 border-border/40 focus-visible:ring-2 rounded-xl font-medium",
                          usernameStatus === "available" ? "focus-visible:ring-green-500/50 border-green-500/30" : 
                          usernameStatus === "taken" ? "focus-visible:ring-red-500/50 border-red-500/30" : 
                          "focus-visible:ring-indigo-500/50"
                        )}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> Bio
                      </label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell something about yourself…"
                        rows={4}
                        className="w-full bg-secondary/30 border border-border/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded-xl font-medium text-sm px-3.5 py-3 resize-none text-foreground placeholder:text-muted-foreground transition-shadow"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "contact" && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" /> Email ID
                    </label>
                    <Input
                      value={user?.email || ""}
                      disabled
                      className="h-12 bg-secondary/50 border-border/40 cursor-not-allowed opacity-70 rounded-xl font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> Mobile Number
                    </label>
                    <Input
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+1 234 567 8900"
                      type="tel"
                      className="h-12 bg-secondary/30 border-border/40 focus-visible:ring-2 focus-visible:ring-indigo-500/50 rounded-xl font-medium"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5" /> Websites
                    </label>
                    
                    <div className="space-y-3">
                      {websites.map((web, index) => (
                        <div key={index} className="flex items-center gap-2 group">
                          <Input
                            value={web}
                            onChange={(e) => updateWebsite(index, e.target.value)}
                            placeholder="https://yourwebsite.com"
                            type="url"
                            className="h-12 bg-secondary/30 border-border/40 focus-visible:ring-2 focus-visible:ring-indigo-500/50 rounded-xl font-medium flex-1"
                          />
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeWebsite(index)}
                            className="h-12 w-12 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-500/10 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    
                    <Button 
                      variant="outline" 
                      onClick={addWebsite}
                      className="w-full h-12 border-dashed border-2 border-border/60 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 gap-2 transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Add Website
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === "security" && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <p className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">
                      Leave fields blank if you don't want to change your password.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" /> Old Password
                    </label>
                    <Input
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      type="password"
                      placeholder="Enter current password"
                      className="h-12 bg-secondary/30 border-border/40 focus-visible:ring-2 focus-visible:ring-indigo-500/50 rounded-xl font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" /> New Password
                    </label>
                    <Input
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      type="password"
                      placeholder="Enter new password"
                      className="h-12 bg-secondary/30 border-border/40 focus-visible:ring-2 focus-visible:ring-indigo-500/50 rounded-xl font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" /> Confirm New Password
                    </label>
                    <Input
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      type="password"
                      placeholder="Confirm new password"
                      className={cn(
                        "h-12 bg-secondary/30 border-border/40 focus-visible:ring-2 rounded-xl font-medium",
                        confirmPassword && newPassword !== confirmPassword 
                          ? "border-red-500/50 focus-visible:ring-red-500/50" 
                          : "focus-visible:ring-indigo-500/50"
                      )}
                    />
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-red-500 font-medium mt-1">Passwords do not match</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-5 border-t border-border/40 shrink-0 bg-background/50 flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="flex-1 h-12 rounded-xl font-bold border-border/60 hover:bg-secondary/60"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || uploading || usernameStatus === "checking" || usernameStatus === "taken"}
              className="flex-1 h-12 rounded-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 transition-all"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default EditProfileModal;
