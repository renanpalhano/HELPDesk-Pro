const SUPABASE_URL = 'https://kstbdvrarhylmtzssaef.supabase.co';

const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_sa9BOuUZzC8mYkkwv10P2A_dt-gHIH9';

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);