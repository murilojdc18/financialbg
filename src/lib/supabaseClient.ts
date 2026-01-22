import { createClient } from '@supabase/supabase-js';

// Chaves públicas do Supabase (publishable - seguras para o cliente)
// Substitua pelos valores do seu projeto Supabase
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
