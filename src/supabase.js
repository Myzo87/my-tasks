import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://kezoejzvljpollddddsv.supabase.co/rest/v1/'
const SUPABASE_KEY = 'sb_publishable_JoophiA_j6v7j8Tcq3bQGg_A6_toMOl'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)