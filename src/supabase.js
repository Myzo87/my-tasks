import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://my-tasks-weld.vercel.app/'
const SUPABASE_KEY = '6PD4NIvTRyz3uKWz'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)