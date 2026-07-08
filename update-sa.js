const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.xzqjkkoxwmvkzrkldhqc:HflWaotFsNt5o264@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres'
});
client.connect().then(() => {
  return client.query('UPDATE users SET "baseLevel" = \'SUPERADMIN\' WHERE email = \'admin@assort1.com\'');
}).then(res => {
  console.log('Update result:', res.rowCount);
  client.end();
}).catch(console.error);
