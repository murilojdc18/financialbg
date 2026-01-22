import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lipvstajrfjjxddtypnv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcHZzdGFqcmZqanhkZHR5cG52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc1NzE2NzcsImV4cCI6MjA1MzE0NzY3N30.sb_publishable_cwS4OSYkXUoUnbXjqIj4DQ_OFd2XgYN';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
