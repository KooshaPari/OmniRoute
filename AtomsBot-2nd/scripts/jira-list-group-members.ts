import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const host = process.env.JIRA_HOST;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  const group = process.argv[2];
  if (!host || !email || !token) {
    console.error('Missing JIRA_HOST/JIRA_EMAIL/JIRA_API_TOKEN');
    process.exit(1);
  }
  if (!group) {
    console.error('Usage: tsx scripts/jira-list-group-members.ts "<group name>"');
    process.exit(1);
  }
  let startAt = 0;
  const out: any[] = [];
  while (true) {
    const url = `https://${host}/rest/api/3/group/member?groupname=${encodeURIComponent(group)}&startAt=${startAt}&maxResults=50`;
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
    const values = Array.isArray(data?.values) ? data.values : [];
    out.push(...values);
    if (data?.isLast || values.length === 0) break;
    startAt = (data?.startAt || 0) + (data?.maxResults || values.length);
  }
  for (const u of out) {
    console.log(`${u.displayName}${u.emailAddress ? ' • ' + u.emailAddress : ''} (${u.accountId}) ${u.active ? '' : '[inactive]'}`);
  }
  console.log(`\nTotal: ${out.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });

