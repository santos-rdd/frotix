<<<<<<< HEAD
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
=======
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  user: 'postgres',      
  host: 'localhost',
  database: 'frotix',         
  password: '7688',
  port: 5432,                          
});

export default pool;
>>>>>>> e110326ceb7b63258327fd89dc1b2591e7a009b4
