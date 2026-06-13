// Quick debug to understand the permission values
console.log('SendMessages flag:', 2048n);  // PermissionsBitField.Flags.SendMessages
console.log('ReadMessageHistory flag:', 65536n);  // PermissionsBitField.Flags.ReadMessageHistory  
console.log('Combined:', 2048n | 65536n);
console.log('Combined as string:', (2048n | 65536n).toString());
console.log('Admin flag:', 8n);

// Quick debug to understand the auth failure
const createDebugInteraction = () => ({
  user: { id: "user_abc", username: "user", bot: false, verified: true, mfaEnabled: true },
  member: { 
    permissions: (2048n | 65536n).toString(), // SendMessages + ReadMessageHistory but not Administrator (which is "8")
    roles: ["user_role_789"] 
  },
  commandName: "status",
  reply: (options) => {
    console.log('Reply called with:', JSON.stringify(options, null, 2));
    return Promise.resolve({ id: "message_123456" });
  }
});

const debugAuth = async () => {
  const interaction = createDebugInteraction();
  
  // Inline version of preCommandAuth logic
  const opts = { command: 'status', sensitive: true };
  const user = interaction.user || {};
  const member = interaction.member || {};
  
  console.log('User:', user);
  console.log('Member:', member);
  console.log('Options:', opts);
  
  // Check admin permissions
  const p = member.permissions;
  console.log('Raw permissions:', p, typeof p);
  
  let isAdmin = false;
  if (typeof p === 'string') {
    try { 
      const result = (BigInt(p) & BigInt(8)) !== BigInt(0);
      console.log(`Permission check: BigInt(${p}) & 8n = ${BigInt(p) & BigInt(8)} -> ${result}`);
      isAdmin = result;
    } catch (e) {
      console.log('BigInt conversion failed:', e.message);
    }
  }
  
  console.log('isAdmin:', isAdmin);
  console.log('opts.sensitive:', opts.sensitive);
  console.log('Should deny?:', opts.sensitive && !isAdmin);
  
  if (opts.sensitive && !isAdmin) {
    console.log('About to call reply with permission denied');
    await interaction.reply({ content: '❌ Permission denied.', flags: 64 });
    return { allowed: false };
  }
  
  return { allowed: true };
};

debugAuth().then(result => {
  console.log('Auth result:', result);
}).catch(console.error);