import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kezoejzvljpollddddsv.supabase.co/'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtlem9lanp2bGpwb2xsZGRkZHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NDcwNjAsImV4cCI6MjA5NzAyMzA2MH0.DC62O0WBUrkNaKgLJVuNWYttZOzzpjrjcstjsa_bhVw'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)