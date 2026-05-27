import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY; // Actually a service role key

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const DUMMY_UUID = '00000000-0000-0000-0000-000000000000';

async function wipeUsers() {
  console.log("Wiping child tables...");
  
  const tables = [
    'post_likes',
    'post_comments',
    'story_views',
    'user_follows',
    'notifications',
    'messages',
    'stories',
    'posts',
    'profiles'
  ];

  for (const table of tables) {
    let pk = 'id';
    if (table === 'profiles' || table === 'user_follows') pk = 'id'; // Actually profiles PK might be user_id, let's use not.is.null
    
    const { error } = await supabase.from(table).delete().not('created_at', 'is', null);
    console.log(`Cleared ${table} by created_at:`, error ? error.message : "Success");
    
    // Fallback if created_at doesn't exist
    if (error) {
       const { error: err2 } = await supabase.from(table).delete().neq('id', DUMMY_UUID);
       console.log(`Cleared ${table} by id:`, err2 ? err2.message : "Success");
       if (err2 && table === 'profiles') {
         await supabase.from('profiles').delete().neq('user_id', DUMMY_UUID);
       }
    }
  }

  console.log("Fetching users...");
  let page = 1;
  while (true) {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("Error listing users:", error);
      break;
    }
    if (!users || users.length === 0) {
      break;
    }
    console.log(`Found ${users.length} users. Deleting...`);
    for (const user of users) {
      const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
      if (delError) {
        console.error("Error deleting user", user.id, delError.message);
      } else {
        console.log("Deleted auth.user", user.id, user.email);
      }
    }
    break; // Break since we should have deleted them all
  }
  
  console.log("Wipe complete!");
}

wipeUsers();
