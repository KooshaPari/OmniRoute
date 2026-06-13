import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const host = process.env.JIRA_HOST;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!host || !email || !token) {
    console.error('Missing JIRA_HOST/JIRA_EMAIL/JIRA_API_TOKEN');
    process.exit(1);
  }
  const q = process.argv[2] || 'a';
  const url = `https://${host}/rest/api/3/groups/picker?query=${encodeURIComponent(q)}&maxResults=200`;
  const res = await fetch(url, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64'),
      'Accept': 'application/json',
    },
  } as any);
  if (!res.ok) {
    console.error('Failed:', res.status, await res.text());
    process.exit(1);
  }
  const data = await res.json();
  const names = (data?.groups || []).map((g: any) => g.name);
  console.log('Jira groups:', names.join(', '));
}

main().catch(e => { console.error(e); process.exit(1); });

