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