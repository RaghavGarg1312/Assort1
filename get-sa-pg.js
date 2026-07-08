const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.xzqjkkoxwmvkzrkldhqc:HflWaotFsNt5o264@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres'
});
client.connect().then(() => {
  return client.query('SELECT * FROM users WHERE "companyId" IS NULL');
}).then(res => {
  console.log(JSON.stringify(res.rows, null, 2));
  client.end();
}).catch(console.error);
