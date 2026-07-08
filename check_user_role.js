const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();
  const res = await client.query("SELECT * FROM users u LEFT JOIN roles r ON u.\"roleId\" = r.id WHERE u.email = 'gaurangpatil9@gmail.com'");
  console.log('User role info:', res.rows[0]);
  await client.end();
}
main().catch(console.error);
