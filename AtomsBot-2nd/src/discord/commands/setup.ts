import {
  ChatInputCommandInteraction,
  ChannelType,
  MessageFlags,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { forumManager } from '../components/ForumManager';
import { settingsService } from '../../settings/SettingsService';
import { secretsStore } from '../../settings/SecretsStore';

export const data = {
  name: 'setup',
  description: 'Configure forums, teams, and secrets',
  options: [
    {
      name: 'google',
      type: 2,
      description: 'Configure Google OAuth/Calendar (DB overrides env)',
      options: [
        {
          name: 'set',
          type: 1,
          description: 'Set Google OAuth and Calendar settings',
          options: [
            { name: 'client_id', type: 3, description: 'GOOGLE_CLIENT_ID' },
            { name: 'client_secret', type: 3, description: 'GOOGLE_CLIENT_SECRET' },
            { name: 'redirect_uri', type: 3, description: 'GOOGLE_REDIRECT_URI' },
            { name: 'primary_calendar_id', type: 3, description: 'GCAL_PRIMARY_CALENDAR_ID (default: primary)' },
            { name: 'webhook_address', type: 3, description: 'GOOGLE_WEBHOOK_ADDRESS (public HTTPS URL)' },
            { name: 'enable_drive_readonly', type: 5, description: 'Enable Drive readonly scope' },
            { name: 'atoms_keywords', type: 3, description: 'Comma keywords for atoms filter' },
            { name: 'reminder_offsets', type: 3, description: 'Comma minute offsets for reminders (e.g., 15,5)' }
          ]
        },
        {
          name: 'test',
          type: 1,
          description: 'Validate Google config and show auth URL'
        }
      ]
    },
    {
      name: 'atoms',
      type: 2,
      description: 'Configure Atoms (Supabase) PM provider',
      options: [
        {
          name: 'set',
          type: 1,
          description: 'Set Supabase credentials and project context',
          options: [
            { name: 'supabase_url', type: 3, description: 'ATOMS_SUPABASE_URL' },
            { name: 'service_role_key', type: 3, description: 'ATOMS_SUPABASE_SERVICE_ROLE_KEY' },
            { name: 'anon_key', type: 3, description: 'ATOMS_SUPABASE_ANON_KEY (with RLS)' },
            { name: 'web_url', type: 3, description: 'ATOMS_WEB_URL (for deep links)' },
            { name: 'org_id', type: 3, description: 'Organization ID' },
            { name: 'project_id', type: 3, description: 'Project ID' },
            { name: 'requirements_document_id', type: 3, description: 'Optional: Requirements Document ID' },
            { name: 'requirements_block_id', type: 3, description: 'Optional: Requirements Block ID' },
            { name: 'access_token', type: 3, description: 'Optional: User access token (JWT) for RLS)' },
            { name: 'refresh_token', type: 3, description: 'Optional: Refresh token' },
          ]
        },
        { name: 'test', type: 1, description: 'Validate Atoms (Supabase) configuration' },
        { name: 'show', type: 1, description: 'Show current Atoms config (masked)' },
        { name: 'select', type: 1, description: 'Select Atoms project and document via menus' },
        {
          name: 'login',
          type: 1,
          description: 'Login with email/password to obtain JWT (RLS)',
          options: [
            { name: 'email', type: 3, description: 'Auth email', required: true },
            { name: 'password', type: 3, description: 'Auth password', required: true },
          ]
        },
        { name: 'whoami', type: 1, description: 'Show current JWT user identity' },
        { name: 'status', type: 1, description: 'Show Atoms token status (expiry, refresh)' }
      ]
    },
    {
      name: 'pm',
      type: 2,
      description: 'PM setup moved to /pm (use /pm)',
      options: [ { name: 'info', type: 1, description: 'Learn where PM commands moved' } ]
    },
        {
          name: 'provider',
          type: 2,
          description: 'Configure PM provider (e.g., Linear) and its keys',
          options: [
        {
          name: 'set',
          type: 1,
          description: 'Set PM provider and required keys',
          options: [
            { name: 'pm_provider', type: 3, description: 'e.g., jira|linear|github_projects|coda|atoms' },
            { name: 'linear_api_key', type: 3, description: 'Linear API Key' },
            { name: 'linear_team_id', type: 3, description: 'Linear Team ID (optional)' },
            { name: 'linear_webhook_secret', type: 3, description: 'Linear Webhook Secret (optional)' }
            ,{ name: 'gh_projects_token', type: 3, description: 'GitHub Projects token (optional)' }
            ,{ name: 'gh_projects_org', type: 3, description: 'GitHub org (optional)' }
            ,{ name: 'gh_projects_project_id', type: 3, description: 'Projects v2 board id (optional)' }
            ,{ name: 'gh_projects_status_field_id', type: 3, description: 'Projects v2 status field id (optional)' }
            ,{ name: 'gh_projects_status_options_json', type: 3, description: 'JSON mapping name->optionId for Status (optional)' }
            ,{ name: 'gh_projects_notes_field_id', type: 3, description: 'Projects v2 notes/comment text field id (optional)' }
            ,{ name: 'atoms_api_key', type: 3, description: 'Atoms API key (optional)' }
            ,{ name: 'atoms_endpoint', type: 3, description: 'Atoms API endpoint (optional)' }
            ,{ name: 'sync_jira', type: 5, description: 'Also sync Jira when provider is multi' }
            ,{ name: 'sync_linear', type: 5, description: 'Also sync Linear' }
            ,{ name: 'sync_github_projects', type: 5, description: 'Also sync GitHub Projects' }
            ,{ name: 'sync_coda', type: 5, description: 'Mirror to Coda' }
            ,{ name: 'sync_atoms', type: 5, description: 'Mirror to Atoms' }
          ]
        },
        { name: 'show', type: 1, description: 'Show current PM provider config (masked)' },
        {
          name: 'import-projects-status',
          type: 1,
          description: 'Import GitHub Projects Status options into mapping (JSON)'
        },
        {
          name: 'discover-projects-fields',
          type: 1,
          description: 'List GitHub Projects v2 fields and IDs'
        }
      ]
    },
    {
      name: 'coda',
      type: 2,
      description: 'Configure Coda document and mappings',
      options: [
        { name: 'bind', type: 1, description: 'Bind to a Coda doc (paste URL)', options: [ { name: 'url', type: 3, description: 'Coda doc URL', required: true } ] },
        {
          name: 'set',
          type: 1,
          description: 'Set Coda API token, doc id and table/column mappings',
          options: [
            { name: 'api_token', type: 3, description: 'CODA_API_TOKEN' },
            { name: 'doc_id', type: 3, description: 'CODA_DOC_ID' },
            { name: 'issues_table_id', type: 3, description: 'CODA_ISSUES_TABLE_ID' },
            { name: 'comments_table_id', type: 3, description: 'CODA_COMMENTS_TABLE_ID' },
            { name: 'users_table_id', type: 3, description: 'CODA_USERS_TABLE_ID' },
            { name: 'issue_key_column', type: 3, description: 'CODA_ISSUE_KEY_COLUMN (default: Key)' },
            { name: 'issue_title_column', type: 3, description: 'CODA_ISSUE_TITLE_COLUMN (default: Title)' },
            { name: 'issue_status_column', type: 3, description: 'CODA_ISSUE_STATUS_COLUMN (default: Status)' },
            { name: 'issue_priority_column', type: 3, description: 'CODA_ISSUE_PRIORITY_COLUMN (default: Priority)' },
            { name: 'issue_assignee_column', type: 3, description: 'CODA_ISSUE_ASSIGNEE_COLUMN (default: Assignee)' }
          ]
        },
        {
          name: 'team-doc',
          type: 1,
          description: 'Pick a Coda doc for a team',
          options: [
            { name: 'team_id', type: 3, description: 'Team id (matches /setup team)', required: true },
            { name: 'query', type: 3, description: 'Filter docs by name (optional)' }
          ]
        },
        { name: 'test', type: 1, description: 'Test Coda connection and list tables' }
        ,
        {
          name: 'team-table',
          type: 1,
          description: 'Pick a Coda table for a team (issues table)',
          options: [ { name: 'team_id', type: 3, description: 'Team id', required: true } ]
        },
        {
          name: 'team-columns',
          type: 1,
          description: 'Pick Coda columns for the issues table',
          options: [ { name: 'team_id', type: 3, description: 'Team id', required: true } ]
        },
        { name: 'select', type: 1, description: 'Select Coda doc/tables and columns via menus' }
      ]
    },
    {
      name: 'linear',
      type: 2,
      description: 'Configure Linear team/project',
      options: [
        { name: 'select', type: 1, description: 'Select Linear team and project via menus' }
      ]
    },
    {
      name: 'github',
      type: 2,
      description: 'Configure GitHub owner/repo and Projects v2',
      options: [
        { name: 'select', type: 1, description: 'Select owner/repo and optionally a Projects v2 board' }
      ]
    },
    {
      name: 'discord',
      type: 2,
      description: 'Configure Discord credentials (DB overrides env)',
      options: [
        {
          name: 'set',
          type: 1,
          description: 'Set Discord token, client id, and defaults',
          options: [
            { name: 'token', type: 3, description: 'DISCORD_TOKEN / bot token' },
            { name: 'client_id', type: 3, description: 'DISCORD_CLIENT_ID / application id' },
            { name: 'channel_id', type: 3, description: 'Default forum channel id' },
            { name: 'dev_guild_id', type: 3, description: 'Dev guild id for fast registration' }
          ]
        },
        {
          name: 'show',
          type: 1,
          description: 'Show current Discord config (masked)'
        }
      ]
    },
    {
      name: 'sso',
      type: 2,
      description: 'SSO integration (placeholder)',
      options: [
        { name: 'status', type: 1, description: 'Show SSO status (placeholder)' },
        { name: 'link', type: 1, description: 'Link SSO provider (placeholder)' },
        {
          name: 'set',
          type: 1,
          description: 'Set SSO provider config (stored in DB)',
          options: [
            { name: 'provider', type: 3, description: 'e.g., oidc, okta, auth0, azuread' },
            { name: 'issuer_url', type: 3, description: 'OIDC issuer URL' },
            { name: 'client_id', type: 3, description: 'OIDC client ID' },
            { name: 'client_secret', type: 3, description: 'OIDC client secret' },
            { name: 'redirect_uri', type: 3, description: 'OAuth redirect URI' },
            { name: 'scopes', type: 3, description: 'Space-delimited scopes (optional)' }
          ]
        },
        { name: 'show', type: 1, description: 'Show current SSO config (masked)' }
      ]
    },
    {
      name: 'vercel',
      type: 2,
      description: 'Configure Vercel token and mappings (DB)',
      options: [
        {
          name: 'set',
          type: 1,
          description: 'Set Vercel credentials',
          options: [
            { name: 'token', type: 3, description: 'Vercel API token' },
            { name: 'team_id', type: 3, description: 'Vercel team id' },
            { name: 'project_id', type: 3, description: 'Vercel project id' },
            { name: 'prefer_api', type: 5, description: 'Prefer API over CLI' },
            { name: 'auto_unprotect', type: 5, description: 'Auto-disable preview link protection after deploy' },
            { name: 'unprotect_mode', type: 3, description: 'Protection type to disable (link|password)' }
          ]
        },
        { name: 'test', type: 1, description: 'Test Vercel API token' },
        {
          name: 'lookup-project',
          type: 1,
          description: 'Lookup a Vercel project by name/slug and show its prj_* id',
          options: [
            { name: 'name', type: 3, description: 'Project name or slug (e.g., production)', required: true },
            { name: 'team_id', type: 3, description: 'Vercel team id (optional)' }
          ]
        },
        {
          name: 'group',
          type: 2,
          description: 'Define Vercel deployment groups',
          options: [
            {
              name: 'set', type: 1, description: 'Create/update a group',
              options: [
                { name: 'name', type: 3, description: 'Group name', required: true },
                { name: 'project_ids', type: 3, description: 'Comma-separated project ids', required: true },
                { name: 'team_id', type: 3, description: 'Default team id' },
                { name: 'labels', type: 3, description: 'id=Name,id2=Name2' },
                { name: 'paths', type: 3, description: 'id=path1|path2,id2=pathA' },
                { name: 'providers', type: 3, description: 'id=api|cli,id2=cli' }
              ]
            },
            {
              name: 'remove', type: 1, description: 'Remove a group',
              options: [ { name: 'name', type: 3, description: 'Group name', required: true } ]
            },
            { name: 'list', type: 1, description: 'List groups' }
          ]
        },
        {
          name: 'map',
          type: 2,
          description: 'Map repo to Vercel project',
          options: [
            {
              name: 'set', type: 1, description: 'Set mapping for a repo',
              options: [
                { name: 'owner', type: 3, description: 'GitHub owner', required: true },
                { name: 'repo', type: 3, description: 'GitHub repo', required: true },
                { name: 'project_id', type: 3, description: 'Vercel project id (or name/slug)', required: true },
                { name: 'team_id', type: 3, description: 'Vercel team id' },
                { name: 'prefer', type: 3, description: 'Preferred provider (api|cli)' },
                { name: 'env', type: 3, description: 'Optional env (Production|Staging|Development)' }
              ]
            },
            {
              name: 'remove', type: 1, description: 'Remove mapping',
              options: [
                { name: 'owner', type: 3, description: 'GitHub owner', required: true },
                { name: 'repo', type: 3, description: 'GitHub repo', required: true }
              ]
            },
            { name: 'list', type: 1, description: 'List mappings' }
          ]
        },
        {
          name: 'map-group',
          type: 2,
          description: 'Map repo to a Vercel group',
          options: [
            {
              name: 'set',
              type: 1,
              description: 'Set group mapping for a repo',
              options: [
                { name: 'owner', type: 3, description: 'GitHub owner', required: true },
                { name: 'repo', type: 3, description: 'GitHub repo', required: true },
                { name: 'group', type: 3, description: 'Group name', required: true }
              ]
            },
            {
              name: 'remove',
              type: 1,
              description: 'Remove repo→group mapping',
              options: [
                { name: 'owner', type: 3, description: 'GitHub owner', required: true },
                { name: 'repo', type: 3, description: 'GitHub repo', required: true }
              ]
            },
            { name: 'list', type: 1, description: 'List repo→group mappings' }
          ]
        }
      ]
    },
    {
      name: 'verify',
      type: 1,
      description: 'Show a status report of teams, roles, and forum mappings',
      options: [
        {
          name: 'json',
          type: 5,
          description: 'Return JSON report'
        }
      ]
    },
    {
      name: 'cache',
      type: 1,
      description: 'Refresh in-memory cache from DB (no changes)'
    },
    {
      name: 'forums',
      type: 2,
      description: 'Forum channel mappings',
      options: [
        {
          name: 'set',
          type: 1,
          description: 'Map a forum id to a Discord forum channel',
          options: [
            {
              name: 'forum_id',
              type: 3,
              description: 'Forum ID (e.g., backend-ai-features)',
              required: true
            },
            {
              name: 'channel',
              type: 7,
              description: 'Discord forum channel',
              channel_types: [15],
              required: true
            }
          ]
        },
        {
          name: 'list',
          type: 1,
          description: 'List current forum mappings'
        }
      ]
    },
    {
      name: 'secrets',
      type: 2,
      description: 'Set GitHub/Jira secrets (stored in DB)',
      options: [
        {
          name: 'set',
          type: 1,
          description: 'Set one or more secrets',
          options: [
            {
              name: 'github_access_token',
              type: 3,
              description: 'GitHub PAT'
            },
            {
              name: 'github_username',
              type: 3,
              description: 'GitHub username/owner'
            },
            {
              name: 'github_repository',
              type: 3,
              description: 'GitHub repository name'
            },
            {
              name: 'jira_host',
              type: 3,
              description: 'Jira host (e.g., yourorg.atlassian.net)'
            },
            {
              name: 'jira_email',
              type: 3,
              description: 'Jira account email'
            },
            {
              name: 'jira_api_token',
              type: 3,
              description: 'Jira API token'
            },
            {
              name: 'jira_project_key',
              type: 3,
              description: 'Default Jira project key'
            }
          ]
        }
      ]
    },
    {
      name: 'team',
      type: 2,
      description: 'Manage team settings (DB)',
      options: [
        {
          name: 'list',
          type: 1,
          description: 'List teams from static config + DB'
        },
        {
          name: 'add',
          type: 1,
          description: 'Add or update a team setting',
          options: [
            {
              name: 'id',
              type: 3,
              description: 'Team id (e.g., backend-ai)',
              required: true
            },
            {
              name: 'name',
              type: 3,
              description: 'Team name'
            },
            {
              name: 'description',
              type: 3,
              description: 'Description'
            },
            {
              name: 'color',
              type: 4,
              description: 'Color int (e.g., 0x059669)'
            },
            {
              name: 'emoji',
              type: 3,
              description: 'Emoji'
            },
            {
              name: 'bug_forum_id',
              type: 3,
              description: 'Bug forum id'
            },
            {
              name: 'feature_forum_id',
              type: 3,
              description: 'Feature forum id'
            },
            {
              name: 'github_owner',
              type: 3,
              description: 'GitHub owner'
            },
            {
              name: 'github_repo',
              type: 3,
              description: 'GitHub repo'
            },
            { name: 'pm_provider', type: 3, description: 'jira|linear|github_projects|coda|atoms' },
            { name: 'pm_sync', type: 5, description: 'Enable sync for this team' },
            { name: 'linear_team_id', type: 3, description: 'Linear Team ID' },
            { name: 'linear_project_id', type: 3, description: 'Linear Project ID' },
            { name: 'gh_projects_org', type: 3, description: 'GitHub Projects Org' },
            { name: 'gh_projects_id', type: 3, description: 'GitHub Projects ID' },
            { name: 'gh_projects_number', type: 3, description: 'GitHub Projects Number' },
            { name: 'coda_doc_id', type: 3, description: 'Coda Doc ID' },
            { name: 'coda_issues_table_id', type: 3, description: 'Coda Issues Table ID' },
            { name: 'coda_issue_key_column', type: 3, description: 'Coda Key column (optional)' },
            { name: 'coda_issue_title_column', type: 3, description: 'Coda Title column (optional)' },
            { name: 'coda_issue_status_column', type: 3, description: 'Coda Status column (optional)' },
            { name: 'coda_issue_priority_column', type: 3, description: 'Coda Priority column (optional)' },
            { name: 'coda_issue_assignee_column', type: 3, description: 'Coda Assignee column (optional)' },
            {
              name: 'jira_project_key',
              type: 3,
              description: 'Jira project key'
            },
            {
              name: 'jira_board_id',
              type: 3,
              description: 'Jira board id'
            }
          ]
        },
        {
          name: 'remove',
          type: 1,
          description: 'Remove team settings from DB',
          options: [
            {
              name: 'id',
              type: 3,
              description: 'Team id',
              required: true
            }
          ]
        },
        {
          name: 'role-create',
          type: 1,
          description: 'Create and link a Discord role for a team',
          options: [
            {
              name: 'id',
              type: 3,
              description: 'Team id',
              required: true
            },
            {
              name: 'name',
              type: 3,
              description: 'Role name (defaults to team name)'
            },
            {
              name: 'color',
              type: 4,
              description: 'Role color (int)'
            }
          ]
        },
        {
          name: 'role-set',
          type: 1,
          description: 'Link an existing Discord role to a team',
          options: [
            {
              name: 'id',
              type: 3,
              description: 'Team id',
              required: true
            },
            {
              name: 'role',
              type: 8,
              description: 'Existing role',
              required: true
            }
          ]
        },
        {
          name: 'members-add',
          type: 1,
          description: 'Open a selector to add members to a team',
          options: [
            {
              name: 'id',
              type: 3,
              description: 'Team id',
              required: true
            }
          ]
        },
        {
          name: 'members-remove',
          type: 1,
          description: 'Open a selector to remove members from a team',
          options: [
            {
              name: 'id',
              type: 3,
              description: 'Team id',
              required: true
            }
          ]
        }
      ]
    },
    {
      name: 'sync',
      type: 2,
      description: 'Refresh/rebuild teams/forums/roles from DB',
      options: [
        {
          name: 'teams',
          type: 1,
          description: 'Ensure team roles exist and are linked',
          options: [
            {
              name: 'create_roles',
              type: 5,
              description: 'Create missing roles'
            }
          ]
        },
        {
          name: 'forums',
          type: 1,
          description: 'Ensure forums are mapped and optionally created',
          options: [
            {
              name: 'create_missing',
              type: 5,
              description: 'Create missing forum channels'
            }
          ]
        },
        {
          name: 'all',
          type: 1,
          description: 'Sync teams and forums (rebuild everything)',
          options: [
            {
              name: 'create',
              type: 5,
              description: 'Create missing roles/forums'
            }
          ]
        },
        {
          name: 'verify',
          type: 1,
          description: 'Show a status report of teams, roles, and forum mappings'
        },
        {
          name: 'cache',
          type: 1,
          description: 'Refresh in-memory cache from DB (no changes)'
        }
      ]
    }
  ]
};

export async function execute(interaction: ChatInputCommandInteraction) {
  const subGroup = interaction.options.getSubcommandGroup(false) || '';
  const topSub = interaction.options.getSubcommand(false) || '';
  const guildId = interaction.guildId || 'global';
  const ADMIN_ID = '201372818611372032';
  const isPrivileged = interaction.user.id === ADMIN_ID;

  // Restrict sensitive setup groups to privileged user
  if (['secrets', 'vercel', 'google', 'discord', 'sso', 'provider', 'pm', 'coda'].includes(subGroup) && !isPrivileged) {
    return interaction.reply({ content: '❌ You are not authorized to run this setup command.', flags: MessageFlags.Ephemeral });
  }

  if (topSub === 'verify' || topSub === 'cache') {
    // handled in sync branch (top-level synonyms)
  } else if (subGroup === 'pm') {
    return interaction.reply({ content: 'ℹ️ PM configuration moved to /pm. Use /pm show, /pm audit, /pm sync-teams, etc.', flags: MessageFlags.Ephemeral });
  } else if (subGroup === 'google') {
    const sub = interaction.options.getSubcommand(true);
    if (sub === 'set') {
      const entries: Array<[string,string]> = [];
      const id = interaction.options.getString('client_id') || '';
      const secret = interaction.options.getString('client_secret') || '';
      const redirect = interaction.options.getString('redirect_uri') || '';
      const primary = interaction.options.getString('primary_calendar_id') || '';
      const webhook = interaction.options.getString('webhook_address') || '';
      const drive = interaction.options.getBoolean('enable_drive_readonly');
      const kw = interaction.options.getString('atoms_keywords') || '';
      const rem = interaction.options.getString('reminder_offsets') || '';
      if (id) entries.push(['google_client_id', id]);
      if (secret) entries.push(['google_client_secret', secret]);
      if (redirect) entries.push(['google_redirect_uri', redirect]);
      if (primary) entries.push(['gcal_primary_calendar_id', primary]);
      if (webhook) entries.push(['google_webhook_address', webhook]);
      if (drive !== null && drive !== undefined) entries.push(['google_enable_drive_readonly', drive ? 'true' : 'false']);
      if (kw) entries.push(['atoms_keywords', kw]);
      if (rem) entries.push(['reminder_offsets', rem]);
      for (const [k, v] of entries) await secretsStore.set(k, v);
      const parts = entries.map(([k]) => k).join(', ') || 'no changes';
      return interaction.reply({ content: `✅ Saved Google settings: ${parts}`, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'test') {
      const [cid, cs, ru] = await Promise.all([
        secretsStore.get('google_client_id'),
        secretsStore.get('google_client_secret'),
        secretsStore.get('google_redirect_uri'),
      ]);
      const clientId = cid || process.env.GOOGLE_CLIENT_ID || '';
      const clientSecret = cs || process.env.GOOGLE_CLIENT_SECRET || '';
      const redirectUri = ru || process.env.GOOGLE_REDIRECT_URI || '';
      if (!clientId || !clientSecret || !redirectUri) {
        return interaction.reply({ content: '❌ Missing GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI (in DB or env)', flags: MessageFlags.Ephemeral });
      }
      // Construct an OAuth URL without making API calls
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        access_type: 'offline',
        prompt: 'consent',
        response_type: 'code',
        scope: ['https://www.googleapis.com/auth/calendar'].concat(((await secretsStore.get('google_enable_drive_readonly')) || process.env.GOOGLE_ENABLE_DRIVE_READONLY) === 'true' ? ['https://www.googleapis.com/auth/drive.readonly'] : []).join(' ')
      });
      const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      return interaction.reply({ content: `✅ Google config looks OK. Auth URL:\n${url}`, flags: MessageFlags.Ephemeral });
    }
  } else if (subGroup === 'pm') {
    const sub = interaction.options.getSubcommand(true);
    if (sub === 'set') {
      const providerRaw = (interaction.options.getString('provider') || '').toLowerCase();
      const sync = interaction.options.getBoolean('sync');
      const syncJira = interaction.options.getBoolean('sync_jira');
      const syncLinear = interaction.options.getBoolean('sync_linear');
      const syncGhProj = interaction.options.getBoolean('sync_github_projects');
      const syncCoda = interaction.options.getBoolean('sync_coda');
      const syncAtoms = interaction.options.getBoolean('sync_atoms');
      const allowed = ['jira','linear','github_projects','coda','atoms'];
      const entries: Array<[string,string]> = [];
      if (providerRaw && allowed.includes(providerRaw)) entries.push(['pm_provider', providerRaw]);
      if (sync !== null && sync !== undefined) entries.push(['pm_sync', sync ? 'true' : 'false']);
      if (syncJira !== null && syncJira !== undefined) entries.push(['pm_sync_jira', syncJira ? 'true' : 'false']);
      if (syncLinear !== null && syncLinear !== undefined) entries.push(['pm_sync_linear', syncLinear ? 'true' : 'false']);
      if (syncGhProj !== null && syncGhProj !== undefined) entries.push(['pm_sync_github_projects', syncGhProj ? 'true' : 'false']);
      if (syncCoda !== null && syncCoda !== undefined) entries.push(['pm_sync_coda', syncCoda ? 'true' : 'false']);
      if (syncAtoms !== null && syncAtoms !== undefined) entries.push(['pm_sync_atoms', syncAtoms ? 'true' : 'false']);
      // Provider enable/disable flags (optional)
      try {
        const enJira = interaction.options.getBoolean('enable_jira');
        const enLinear = interaction.options.getBoolean('enable_linear');
        const enGhProj = interaction.options.getBoolean('enable_github_projects');
        const enCoda = interaction.options.getBoolean('enable_coda');
        const enAtoms = interaction.options.getBoolean('enable_atoms');
        if (enJira !== null && enJira !== undefined) entries.push(['pm_enabled_jira', enJira ? 'true' : 'false']);
        if (enLinear !== null && enLinear !== undefined) entries.push(['pm_enabled_linear', enLinear ? 'true' : 'false']);
        if (enGhProj !== null && enGhProj !== undefined) entries.push(['pm_enabled_github_projects', enGhProj ? 'true' : 'false']);
        if (enCoda !== null && enCoda !== undefined) entries.push(['pm_enabled_coda', enCoda ? 'true' : 'false']);
        if (enAtoms !== null && enAtoms !== undefined) entries.push(['pm_enabled_atoms', enAtoms ? 'true' : 'false']);
      } catch {}
      for (const [k,v] of entries) await secretsStore.set(k, v);
      return interaction.reply({ content: `✅ Saved PM settings: ${entries.map(([k]) => k).join(', ') || 'no changes'}\nTip: Restart the bot or re-run to apply.`, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'show') {
      const [sj, sl, sg, sc, sa, ej, el, eg, ec, ea] = await Promise.all([
        secretsStore.get('pm_sync_jira'),
        secretsStore.get('pm_sync_linear'),
        secretsStore.get('pm_sync_github_projects'),
        secretsStore.get('pm_sync_coda'),
        secretsStore.get('pm_sync_atoms'),
        secretsStore.get('pm_enabled_jira'),
        secretsStore.get('pm_enabled_linear'),
        secretsStore.get('pm_enabled_github_projects'),
        secretsStore.get('pm_enabled_coda'),
        secretsStore.get('pm_enabled_atoms'),
      ]);
      const by = {
        jira: (sj || process.env.PM_SYNC_JIRA || '').toLowerCase() === 'true' ? 'on' : 'off',
        linear: (sl || process.env.PM_SYNC_LINEAR || '').toLowerCase() === 'true' ? 'on' : 'off',
        github_projects: (sg || process.env.PM_SYNC_GITHUB_PROJECTS || '').toLowerCase() === 'true' ? 'on' : 'off',
        coda: (sc || process.env.PM_SYNC_CODA || '').toLowerCase() === 'true' ? 'on' : 'off',
        atoms: (sa || process.env.PM_SYNC_ATOMS || '').toLowerCase() === 'true' ? 'on' : 'off',
      } as const;
      const enabled = {
        jira: (ej || process.env.PM_ENABLED_JIRA || '').toLowerCase() === 'true' ? 'on' : 'off',
        linear: (el || process.env.PM_ENABLED_LINEAR || '').toLowerCase() === 'true' ? 'on' : 'off',
        github_projects: (eg || process.env.PM_ENABLED_GITHUB_PROJECTS || '').toLowerCase() === 'true' ? 'on' : 'off',
        coda: (ec || process.env.PM_ENABLED_CODA || '').toLowerCase() === 'true' ? 'on' : 'off',
        atoms: (ea || process.env.PM_ENABLED_ATOMS || '').toLowerCase() === 'true' ? 'on' : 'off',
      } as const;
      return interaction.reply({ content: `Providers\n• Enabled → Jira:${enabled.jira} Linear:${enabled.linear} GH_Projects:${enabled.github_projects} Coda:${enabled.coda} Atoms:${enabled.atoms}\n• Sync → Jira:${by.jira} Linear:${by.linear} GH_Projects:${by.github_projects} Coda:${by.coda} Atoms:${by.atoms}`, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'validate') {
      try {
        const { pmSyncEngine } = await import('../../pm/SyncEngine');
        await pmSyncEngine.runOnce();
        return interaction.reply({ content: '✅ SyncEngine validation pass completed (check logs for details).', flags: MessageFlags.Ephemeral });
      } catch (e) {
        return interaction.reply({ content: `❌ Validation failed: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }
    if (sub === 'report') {
      try {
        const { pmSyncEngine } = await import('../../pm/SyncEngine');
        const rep = (pmSyncEngine as any).getLastReport?.() || { teams: [], totals: { processed: 0, mirrored: 0, teams: 0 } };
        const lines = [
          `Teams: ${rep?.totals?.teams ?? 0}`,
          `Processed: ${rep?.totals?.processed ?? 0}`,
          `Mirrored: ${rep?.totals?.mirrored ?? 0}`,
        ];
        for (const t of rep.teams || []) {
          lines.push(`• ${t.id} [${t.provider}] processed:${t.processed} mirrored:${t.mirrored}${t.skipped?` skipped:${t.skipped}`:''}${t.errors?.length?` errors:${t.errors.length}`:''}`);
        }
        return interaction.reply({ content: `PM Sync Report:\n${lines.join('\n')}`, flags: MessageFlags.Ephemeral });
      } catch (e) {
        return interaction.reply({ content: `❌ Report error: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }
    
    if (sub === 'audit') {
      try {
        const { runParityAudit } = await import('../../pm/ParityAudit');
        const res = await runParityAudit();
        const { EmbedBuilder } = await import('discord.js');
        const { getEnabledProviders } = await import('../../pm/provider');

        const emojiFor = (p: string) => (
          p === 'jira' ? '🎫' : p === 'linear' ? '📈' : p === 'github_projects' ? '🗂️' : p === 'coda' ? '📄' : p === 'atoms' ? '🔷' : '🧩'
        );
        const tf = (b: boolean) => (b ? '✅' : '❌');
        const capIcon = (v?: string) => v === 'supported' ? '✅' : v === 'partial' ? '⚠️' : '❌';
        const nice = (k: string) => (k === 'addComment' ? 'comment' : k === 'getTransitions' ? 'transitions' : k);

        const embed = new EmbedBuilder()
          .setTitle('Provider Parity Audit')
          .setDescription(`Enabled: ${getEnabledProviders().join(', ')}`)
          .setColor(0x5865F2);

        for (const r of res) {
          const head = `${emojiFor(r.provider)} ${r.provider} — cfg:${tf(!!r.configured)} conn:${tf(!!r.connected)}`;
          const capsPairs = Object.entries(r.capabilities || {});
          const parts: string[] = [];
          for (const [k, v] of capsPairs) parts.push(`${nice(k)} ${capIcon(v as string)}`);
          const body = '```' + parts.join('  ') + '```';
          embed.addFields({ name: head.slice(0, 256), value: body.slice(0, 1024) });
        }

        // Coda mapping check by team (doc/table/columns)
        try {
          const teams = await settingsService.listTeamSettings();
          const missing: string[] = [];
          const ok: string[] = [];
          for (const t of teams as any[]) {
            const miss: string[] = [];
            if (!t.codaDocId) miss.push('doc');
            if (!t.codaIssuesTableId) miss.push('issues_table');
            const cols: Array<[string,string|undefined]> = [
              ['key', t.codaIssueKeyColumn],
              ['title', t.codaIssueTitleColumn],
              ['status', t.codaIssueStatusColumn],
              ['priority', t.codaIssuePriorityColumn],
              ['assignee', t.codaIssueAssigneeColumn],
            ];
            const missingCols = cols.filter(([_, v]) => !v).map(([k]) => k);
            if (missingCols.length) miss.push('cols:' + missingCols.join(','));
            if (miss.length) missing.push(`${t.id}: ${miss.join(' | ')}`);
            else ok.push(`${t.id}`);
          }
          const buildBlock = (title: string, arr: string[]) => arr.length ? '```' + arr.join('\n').slice(0, 990) + '```' : '```—```';
          embed.addFields(
            { name: '📄 Coda Mapping — Missing', value: buildBlock('missing', missing).slice(0, 1024) },
            { name: '✅ Coda Mapping — OK', value: buildBlock('ok', ok).slice(0, 1024) },
          );
        } catch {}

        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      } catch (e) {
        return interaction.reply({ content: `❌ Audit error: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }
    else if (sub === 'sync-teams') {
      try {
        const enable = interaction.options.getBoolean('enable', true) === true;
        const teams = await settingsService.listTeamSettings();
        let updated = 0;
        for (const t of teams as any[]) {
          await settingsService.upsertTeamSettings(t.id, { pmSync: enable });
          updated++;
        }
        return interaction.reply({ content: `✅ Set pmSync=${enable ? 'on' : 'off'} for ${updated} teams.`, flags: MessageFlags.Ephemeral });
      } catch (e) {
        return interaction.reply({ content: `❌ Failed to toggle team sync: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }
    if (sub === 'repair') {
      try {
        const teamId = interaction.options.getString('team_id') || undefined;
        const { pmSyncEngine } = await import('../../pm/SyncEngine');
        const rep = await pmSyncEngine.repair(teamId || undefined);
        const lines = [ `Teams: ${rep?.totals?.teams ?? 0}`, `Processed: ${rep?.totals?.processed ?? 0}`, `Mirrored: ${rep?.totals?.mirrored ?? 0}` ];
        for (const t of rep.teams || []) lines.push(`• ${t.id} [${t.provider}] processed:${t.processed} mirrored:${t.mirrored}${t.skipped?` skipped:${t.skipped}`:''}${t.errors?.length?` errors:${t.errors.length}`:''}`);
        return interaction.reply({ content: `PM Repair Report${teamId?` (team ${teamId})`:''}:\n${lines.join('\n')}`, flags: MessageFlags.Ephemeral });
      } catch (e) {
        return interaction.reply({ content: `❌ Repair error: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }
    if (sub === 'policy') {
      try {
        const teamId = interaction.options.getString('team_id', true);
        const policy = (interaction.options.getString('policy', true) || '').toLowerCase();
        if (!['provider_wins','coda_wins','most_recent'].includes(policy)) {
          return interaction.reply({ content: '❌ Invalid policy. Use provider_wins|coda_wins|most_recent', flags: MessageFlags.Ephemeral });
        }
        await settingsService.upsertTeamSettings(teamId, { pmConflictPolicy: policy as any });
        return interaction.reply({ content: `✅ Set policy for ${teamId} → ${policy}`, flags: MessageFlags.Ephemeral });
      } catch (e) {
        return interaction.reply({ content: `❌ Policy error: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }
    if (sub === 'team-linear') {
      const appTeamId = interaction.options.getString('team_id', true);
      try {
        const { linearService } = await import('../../linear/linearClient');
        const teams = await linearService.listTeams(50);
        if (!teams.length) return interaction.reply({ content: '❌ No Linear teams available (check LINEAR_API_KEY).', flags: MessageFlags.Ephemeral });
        const { StringSelectMenuBuilder, ActionRowBuilder } = await import('discord.js');
        const menu = new (StringSelectMenuBuilder as any)()
          .setCustomId(`pm_linear_team_${appTeamId}_${interaction.user.id}`)
          .setPlaceholder('Pick Linear team…')
          .setMinValues(1).setMaxValues(1)
          .addOptions(...teams.slice(0, 25).map(t => ({ label: t.name.slice(0, 100), value: t.id })));
        const row = new (ActionRowBuilder as any)().addComponents(menu);
        return interaction.reply({ content: `Select a Linear team for '${appTeamId}'`, components: [row], flags: MessageFlags.Ephemeral });
      } catch (e) {
        return interaction.reply({ content: `❌ Failed to load Linear teams: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }
    if (sub === 'team-github-projects') {
      const appTeamId = interaction.options.getString('team_id', true);
      try {
        const { githubProjectsService } = await import('../../github/projectsClient');
        const list = await githubProjectsService.listProjects(100);
        if (!list.length) return interaction.reply({ content: '❌ No GitHub Projects found (check GH Projects config).', flags: MessageFlags.Ephemeral });
        const { StringSelectMenuBuilder, ActionRowBuilder } = await import('discord.js');
        const menu = new (StringSelectMenuBuilder as any)()
          .setCustomId(`pm_ghproj_project_${appTeamId}_${interaction.user.id}`)
          .setPlaceholder('Pick a GH Project…')
          .setMinValues(1).setMaxValues(1)
          .addOptions(...list.slice(0, 25).map(p => ({ label: `${p.title}${p.number?` (#${p.number})`:''}`.slice(0, 100), value: p.id })));
        const row = new (ActionRowBuilder as any)().addComponents(menu);
        return interaction.reply({ content: `Select a GitHub Project for '${appTeamId}'`, components: [row], flags: MessageFlags.Ephemeral });
      } catch (e) {
        return interaction.reply({ content: `❌ Failed to load GH Projects: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }
  } else if (subGroup === 'coda') {
    const sub = interaction.options.getSubcommand(true);
    if (sub === 'set') {
      const entries: Array<[string,string]> = [];
      const getS = (name: string) => interaction.options.getString(name) || '';
      const pairs: Array<[string,string]> = [
        ['coda_api_token', getS('api_token')],
        ['coda_doc_id', getS('doc_id')],
        ['coda_issues_table_id', getS('issues_table_id')],
        ['coda_comments_table_id', getS('comments_table_id')],
        ['coda_users_table_id', getS('users_table_id')],
        ['coda_issue_key_column', getS('issue_key_column')],
        ['coda_issue_title_column', getS('issue_title_column')],
        ['coda_issue_status_column', getS('issue_status_column')],
        ['coda_issue_priority_column', getS('issue_priority_column')],
        ['coda_issue_assignee_column', getS('issue_assignee_column')],
      ];
      for (const [k,v] of pairs) if (v) entries.push([k, v]);
      for (const [k,v] of entries) await secretsStore.set(k, v);
      return interaction.reply({ content: `✅ Saved Coda settings: ${entries.map(([k]) => k).join(', ') || 'no changes'}`, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'team-doc') {
      const teamId = interaction.options.getString('team_id', true);
      const query = interaction.options.getString('query') || '';
      try {
        const { codaService } = await import('../../coda/codaClient');
        if (!codaService.isConfigured()) return interaction.reply({ content: '❌ Coda not configured. Run /setup coda set … first.', flags: MessageFlags.Ephemeral });
        const res = await codaService.listDocs(25, undefined, query);
        const docs = res.items;
        if (!docs.length) return interaction.reply({ content: '❌ No accessible Coda docs found for this token.', flags: MessageFlags.Ephemeral });
        const { StringSelectMenuBuilder, ActionRowBuilder } = await import('discord.js');
        const menu = new (StringSelectMenuBuilder as any)()
          .setCustomId(`coda_doc_page_${teamId}_${interaction.user.id}_${Buffer.from(query, 'utf8').toString('base64')}`)
          .setPlaceholder('Pick a Coda doc for the team…')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(...docs.slice(0, 25).map(d => ({ label: d.name.slice(0, 100), value: d.id })), ...(res.nextPageToken ? [{ label: 'Next page →', value: `__NEXT__:${res.nextPageToken}` }] : []));
        const row = new (ActionRowBuilder as any)().addComponents(menu);
        return interaction.reply({ content: `Select a Coda doc for team '${teamId}'`, components: [row], flags: MessageFlags.Ephemeral });
      } catch (e) {
        return interaction.reply({ content: `❌ Failed to load Coda docs: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }
    if (sub === 'team-table') {
      const teamId = interaction.options.getString('team_id', true);
      try {
        const { settingsService } = await import('../../settings/SettingsService');
        const t = await settingsService.getTeamSettings(teamId);
        const docId = (t as any)?.codaDocId || (await settingsService.getTeamCodaMapping(teamId))?.docId;
        if (!docId) return interaction.reply({ content: '❌ Set a team Coda doc first (use /setup coda team-doc).', flags: MessageFlags.Ephemeral });
        const { codaService } = await import('../../coda/codaClient');
        const prevDocs = (codaService as any).docId;
        (codaService as any).docId = docId;
        const tables = await codaService.listTables();
        (codaService as any).docId = prevDocs;
        if (!tables.length) return interaction.reply({ content: '❌ No tables found in the selected doc.', flags: MessageFlags.Ephemeral });
        const { StringSelectMenuBuilder, ActionRowBuilder } = await import('discord.js');
        const menu = new (StringSelectMenuBuilder as any)()
          .setCustomId(`coda_table_pick_${teamId}_${interaction.user.id}`)
          .setPlaceholder('Pick the Issues table…')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(...tables.slice(0, 25).map(t => ({ label: t.name.slice(0, 100), value: t.id })));
        const row = new (ActionRowBuilder as any)().addComponents(menu);
        return interaction.reply({ content: `Select an Issues table for team '${teamId}'`, components: [row], flags: MessageFlags.Ephemeral });
      } catch (e) {
        return interaction.reply({ content: `❌ Failed to load tables: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }
    if (sub === 'team-columns') {
      const teamId = interaction.options.getString('team_id', true);
      try {
        const { settingsService } = await import('../../settings/SettingsService');
        const map = await settingsService.getTeamCodaMapping(teamId);
        const tableId = map?.issuesTableId || undefined;
        const docId = map?.docId || undefined;
        if (!docId || !tableId) return interaction.reply({ content: '❌ Set team doc and issues table first.', flags: MessageFlags.Ephemeral });
        const { codaService } = await import('../../coda/codaClient');
        const prevDoc = (codaService as any).docId; const prevTbl = (codaService as any).issuesTableId;
        (codaService as any).docId = docId; (codaService as any).issuesTableId = tableId;
        const cols = await codaService.listColumns(tableId);
        (codaService as any).docId = prevDoc; (codaService as any).issuesTableId = prevTbl;
        if (!cols.length) return interaction.reply({ content: '❌ No columns found in the issues table.', flags: MessageFlags.Ephemeral });
        const opts = cols.slice(0, 25).map(c => ({ label: c.name.slice(0, 100), value: c.id }));
        const { StringSelectMenuBuilder, ActionRowBuilder } = await import('discord.js');
        const build = (field: string, placeholder: string) => new (StringSelectMenuBuilder as any)()
          .setCustomId(`coda_col_pick_${field}_${teamId}_${interaction.user.id}`)
          .setPlaceholder(placeholder)
          .setMinValues(1).setMaxValues(1).addOptions(...opts);
        const rows = [
          new (ActionRowBuilder as any)().addComponents(build('key', 'Select Key column…')),
          new (ActionRowBuilder as any)().addComponents(build('title', 'Select Title column…')),
          new (ActionRowBuilder as any)().addComponents(build('status', 'Select Status column…')),
          new (ActionRowBuilder as any)().addComponents(build('priority', 'Select Priority column…')),
          new (ActionRowBuilder as any)().addComponents(build('assignee', 'Select Assignee column…')),
          new (ActionRowBuilder as any)().addComponents(build('updatedAt', 'Select Updated At column…')),
        ];
        return interaction.reply({ content: `Pick columns for team '${teamId}'`, components: rows as any, flags: MessageFlags.Ephemeral });
      } catch (e) {
        return interaction.reply({ content: `❌ Failed to load columns: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }
    if (sub === 'test') {
      try {
        const { codaService } = await import('../../coda/codaClient');
        const ok = await codaService.testConnection();
        if (!ok) return interaction.reply({ content: '❌ Coda connection failed. Check token/doc id.', flags: MessageFlags.Ephemeral });
        const tables = await codaService.listTables();
        const list = tables.map(t => `• ${t.name} (${t.id})`).join('\n') || '—';
        return interaction.reply({ content: `✅ Coda connection OK. Tables:\n${list}`, flags: MessageFlags.Ephemeral });
      } catch (e) {
        return interaction.reply({ content: `❌ Coda test error: ${(e as any)?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }
  } else if (subGroup === 'discord') {
    const sub = interaction.options.getSubcommand(true);
    if (sub === 'set') {
      const entries: Array<[string,string]> = [];
      const token = interaction.options.getString('token'); if (token) entries.push(['discord_token', token]);
      const cid = interaction.options.getString('client_id'); if (cid) entries.push(['discord_client_id', cid]);
      const ch = interaction.options.getString('channel_id'); if (ch) entries.push(['discord_channel_id', ch]);
      const gid = interaction.options.getString('dev_guild_id'); if (gid) entries.push(['discord_dev_guild_id', gid]);
      for (const [k,v] of entries) await secretsStore.set(k, v);
      return interaction.reply({ content: `✅ Saved: ${entries.map(([k]) => k).join(', ') || 'no changes'}`, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'show') {
      const [t,cid,ch,gid] = await Promise.all([
        secretsStore.get('discord_token'),
        secretsStore.get('discord_client_id'),
        secretsStore.get('discord_channel_id'),
        secretsStore.get('discord_dev_guild_id'),
      ]);
      const mask = (s?: string) => s ? `${s.slice(0,3)}…${s.slice(-3)}` : '—';
      return interaction.reply({ content: `Discord config:\n• token: ${mask(t || undefined)}\n• client_id: ${cid || '—'}\n• channel_id: ${ch || '—'}\n• dev_guild_id: ${gid || '—'}`, flags: MessageFlags.Ephemeral });
    }
  } else if (subGroup === 'sso') {
    const sub = interaction.options.getSubcommand(true);
    if (sub === 'status') {
      return interaction.reply({ content: 'SSO is not yet configured. Placeholder added; future versions will support SSO providers and role sync.', flags: MessageFlags.Ephemeral });
    }
    if (sub === 'link') {
      return interaction.reply({ content: 'SSO linking is not implemented yet. Track progress in the repo issues.', flags: MessageFlags.Ephemeral });
    }
    if (sub === 'set') {
      const entries: Array<[string,string]> = [];
      const provider = interaction.options.getString('provider'); if (provider) entries.push(['sso_provider', provider]);
      const issuer = interaction.options.getString('issuer_url'); if (issuer) entries.push(['sso_issuer_url', issuer]);
      const cid = interaction.options.getString('client_id'); if (cid) entries.push(['sso_client_id', cid]);
      const secret = interaction.options.getString('client_secret'); if (secret) entries.push(['sso_client_secret', secret]);
      const redirect = interaction.options.getString('redirect_uri'); if (redirect) entries.push(['sso_redirect_uri', redirect]);
      const scopes = interaction.options.getString('scopes'); if (scopes) entries.push(['sso_scopes', scopes]);
      for (const [k,v] of entries) await secretsStore.set(k, v);
      return interaction.reply({ content: `✅ Saved SSO config fields: ${entries.map(([k]) => k).join(', ') || 'no changes'}`, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'show') {
      const [provider, issuer, cid, secret, redirect, scopes] = await Promise.all([
        secretsStore.get('sso_provider'),
        secretsStore.get('sso_issuer_url'),
        secretsStore.get('sso_client_id'),
        secretsStore.get('sso_client_secret'),
        secretsStore.get('sso_redirect_uri'),
        secretsStore.get('sso_scopes'),
      ]);
      const mask = (s?: string) => s ? `${s.slice(0,3)}…${s.slice(-3)}` : '—';
      return interaction.reply({ content: `SSO config:\n• provider: ${provider || '—'}\n• issuer_url: ${issuer || '—'}\n• client_id: ${cid || '—'}\n• client_secret: ${mask(secret || undefined)}\n• redirect_uri: ${redirect || '—'}\n• scopes: ${scopes || '—'}`, flags: MessageFlags.Ephemeral });
    }
  } else if (subGroup === 'provider') {
    const sub = interaction.options.getSubcommand(true);
    if (sub === 'set') {
      const entries: Array<[string,string]> = [];
      const prov = (interaction.options.getString('pm_provider') || '').trim(); if (prov) entries.push(['pm_provider', prov.toLowerCase()]);
      const lapikey = interaction.options.getString('linear_api_key'); if (lapikey) entries.push(['linear_api_key', lapikey]);
      const lteam = interaction.options.getString('linear_team_id'); if (lteam) entries.push(['linear_team_id', lteam]);
      const lwh = interaction.options.getString('linear_webhook_secret'); if (lwh) entries.push(['linear_webhook_secret', lwh]);
      const ghpt = interaction.options.getString('gh_projects_token'); if (ghpt) entries.push(['gh_projects_token', ghpt]);
      const ghpo = interaction.options.getString('gh_projects_org'); if (ghpo) entries.push(['gh_projects_org', ghpo]);
      const ghpp = interaction.options.getString('gh_projects_project_id'); if (ghpp) entries.push(['gh_projects_project_id', ghpp]);
      const atomsKey = interaction.options.getString('atoms_api_key'); if (atomsKey) entries.push(['atoms_api_key', atomsKey]);
      const atomsEp = interaction.options.getString('atoms_endpoint'); if (atomsEp) entries.push(['atoms_endpoint', atomsEp]);
      const ghpsf = interaction.options.getString('gh_projects_status_field_id'); if (ghpsf) entries.push(['gh_projects_status_field_id', ghpsf]);
      const ghpso = interaction.options.getString('gh_projects_status_options_json'); if (ghpso) entries.push(['gh_projects_status_options_json', ghpso]);
      const ghpnf = interaction.options.getString('gh_projects_notes_field_id'); if (ghpnf) entries.push(['gh_projects_notes_field_id', ghpnf]);
      const syncJira = interaction.options.getBoolean('sync_jira'); if (typeof syncJira === 'boolean') entries.push(['pm_sync_jira', syncJira ? 'true' : 'false']);
      const syncLinear = interaction.options.getBoolean('sync_linear'); if (typeof syncLinear === 'boolean') entries.push(['pm_sync_linear', syncLinear ? 'true' : 'false']);
      const syncGhPr = interaction.options.getBoolean('sync_github_projects'); if (typeof syncGhPr === 'boolean') entries.push(['pm_sync_github_projects', syncGhPr ? 'true' : 'false']);
      const syncCoda = interaction.options.getBoolean('sync_coda'); if (typeof syncCoda === 'boolean') entries.push(['pm_sync_coda', syncCoda ? 'true' : 'false']);
      const syncAtoms = interaction.options.getBoolean('sync_atoms'); if (typeof syncAtoms === 'boolean') entries.push(['pm_sync_atoms', syncAtoms ? 'true' : 'false']);
      for (const [k,v] of entries) await secretsStore.set(k, v);
      return interaction.reply({ content: `✅ Saved: ${entries.map(([k]) => k).join(', ') || 'no changes'}`, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'show') {
      const [prov, key, team, wh] = await Promise.all([
        secretsStore.get('pm_provider'),
        secretsStore.get('linear_api_key'),
        secretsStore.get('linear_team_id'),
        secretsStore.get('linear_webhook_secret'),
      ]);
      const [ghpt, ghpo, ghpp, ghpsf, ghpso, ghpnf, atomsKey, atomsEp, sJ, sL, sG, sC, sA] = await Promise.all([
        secretsStore.get('gh_projects_token'),
        secretsStore.get('gh_projects_org'),
        secretsStore.get('gh_projects_project_id'),
        secretsStore.get('gh_projects_status_field_id'),
        secretsStore.get('gh_projects_status_options_json'),
        secretsStore.get('gh_projects_notes_field_id'),
        secretsStore.get('atoms_api_key'),
        secretsStore.get('atoms_endpoint'),
        secretsStore.get('pm_sync_jira'),
        secretsStore.get('pm_sync_linear'),
        secretsStore.get('pm_sync_github_projects'),
        secretsStore.get('pm_sync_coda'),
        secretsStore.get('pm_sync_atoms'),
      ]);
      const mask = (s?: string) => s ? `${s.slice(0,3)}…${s.slice(-3)}` : '—';
      const lines = [
        `PM Provider: ${prov || '—'}`,
        `Linear: key=${mask(key || undefined)} team=${team || '—'} wh=${mask(wh || undefined)}`,
        `GitHub Projects: token=${mask(ghpt || undefined)} org=${ghpo || '—'} proj=${ghpp || '—'} statusField=${ghpsf || '—'} notesField=${ghpnf || '—'}`,
        `Status options: ${ghpso ? (ghpso.length > 60 ? ghpso.slice(0,60)+'…' : ghpso) : '—'}`,
        `Atoms: key=${mask(atomsKey || undefined)} endpoint=${atomsEp || '—'}`,
        `Sync: jira=${sJ || '—'} linear=${sL || '—'} projects=${sG || '—'} coda=${sC || '—'} atoms=${sA || '—'}`,
      ].join('\n');
      return interaction.reply({ content: lines, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'import-projects-status') {
      try {
        const token = await secretsStore.get('gh_projects_token') || process.env.GH_PROJECTS_TOKEN || process.env.GITHUB_TOKEN || process.env.GITHUB_ACCESS_TOKEN;
        const projectId = await secretsStore.get('gh_projects_project_id') || process.env.GH_PROJECTS_PROJECT_ID;
        const fieldId = await secretsStore.get('gh_projects_status_field_id') || process.env.GH_PROJECTS_STATUS_FIELD_ID;
        if (!token || !projectId || !fieldId) return interaction.reply({ content: '❌ Missing token/project/status field id', flags: MessageFlags.Ephemeral });
        const res = await fetch('https://api.github.com/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ query: `query($pid:ID!, $fid:ID!){ node(id:$pid){ ... on ProjectV2 { field(id:$fid){ __typename ... on ProjectV2SingleSelectField { options { id name } } } } } }`, variables: { pid: projectId, fid: fieldId } }) });
        if (!res.ok) return interaction.reply({ content: `❌ GraphQL error ${res.status}`, flags: MessageFlags.Ephemeral });
        const json = await res.json();
        const opts = json?.data?.node?.field?.options || [];
        const mapping: Record<string,string> = {};
        for (const o of opts) { if (o?.name && o?.id) mapping[o.name] = o.id; }
        await secretsStore.set('gh_projects_status_options_json', JSON.stringify(mapping));
        return interaction.reply({ content: `✅ Imported ${Object.keys(mapping).length} options`, flags: MessageFlags.Ephemeral });
      } catch (e: any) {
        return interaction.reply({ content: `❌ Failed: ${e?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }
  } else if (subGroup === 'vercel') {
    const sub = interaction.options.getSubcommand(true);
    if (sub === 'set') {
      const entries: Array<[string,string]> = [];
      const token = interaction.options.getString('token'); if (token) entries.push(['vercel_token', token]);
      const teamId = interaction.options.getString('team_id'); if (teamId) entries.push(['vercel_team_id', teamId]);
      const projectId = interaction.options.getString('project_id'); if (projectId) entries.push(['vercel_project_id', projectId]);
      const preferApi = interaction.options.getBoolean('prefer_api');
      if (preferApi !== null && preferApi !== undefined) entries.push(['vercel_prefer_api', preferApi ? 'true' : 'false']);
      const autoUnprotect = interaction.options.getBoolean('auto_unprotect');
      if (autoUnprotect !== null && autoUnprotect !== undefined) entries.push(['vercel_auto_unprotect', autoUnprotect ? 'true' : 'false']);
      const mode = (interaction.options.getString('unprotect_mode') || '').toLowerCase();
      if (mode === 'link' || mode === 'password') entries.push(['vercel_unprotect_mode', mode]);
      for (const [k, v] of entries) await secretsStore.set(k, v);
      return interaction.reply({ content: `✅ Saved: ${entries.map(([k]) => k).join(', ') || 'no changes'}`, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'test') {
      try {
        const token = await secretsStore.get('vercel_token');
        if (!token) return interaction.reply({ content: '❌ No vercel_token set', flags: MessageFlags.Ephemeral });
        const res = await fetch('https://api.vercel.com/v2/user', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) return interaction.reply({ content: `❌ API error ${res.status}`, flags: MessageFlags.Ephemeral });
        const user = await res.json();
        return interaction.reply({ content: `👤 Vercel token valid for ${user?.user?.username || user?.user?.name || 'unknown'}` , flags: MessageFlags.Ephemeral });
      } catch (e: any) {
        return interaction.reply({ content: `❌ Test failed: ${e?.message || e}`, flags: MessageFlags.Ephemeral });
      }
    }
    if (interaction.options.getSubcommandGroup(false) === 'group') {
      const sub2 = interaction.options.getSubcommand(true);
      if (sub2 === 'set') {
        const name = interaction.options.getString('name', true);
        const projectIdsCsv = interaction.options.getString('project_ids', true);
        const teamId = interaction.options.getString('team_id') || undefined;
        const projectIds = projectIdsCsv.split(',').map(s => s.trim()).filter(Boolean);
        const labelsCsv = interaction.options.getString('labels') || '';
        const labels: Record<string,string> = {};
        for (const pair of labelsCsv.split(',').map(s => s.trim()).filter(Boolean)) {
          const [id, label] = pair.split('=').map(s => s?.trim());
          if (id && label) labels[id] = label;
        }
        const pathsCsv = interaction.options.getString('paths') || '';
        const paths: Record<string,string[]> = {};
        for (const pair of pathsCsv.split(',').map(s => s.trim()).filter(Boolean)) {
          const [id, raw] = pair.split('=').map(s => s?.trim());
          if (id && raw) paths[id] = raw.split('|').map(s => s.trim()).filter(Boolean);
        }
        const providersCsv = interaction.options.getString('providers') || '';
        const providers: Record<string,'api'|'cli'> = {} as any;
        for (const pair of providersCsv.split(',').map(s => s.trim()).filter(Boolean)) {
          const [id, pref] = pair.split('=').map(s => s?.trim().toLowerCase());
          if (id && (pref === 'api' || pref === 'cli')) providers[id] = pref as any;
        }
        if (!projectIds.length) return interaction.reply({ content: '❌ No project ids provided.', flags: MessageFlags.Ephemeral });
        await secretsStore.set(`vercel_group_${name}`, JSON.stringify({ projectIds, teamId, labels, paths, providers }));
        return interaction.reply({ content: `✅ Saved group '${name}' with ${projectIds.length} project(s).`, flags: MessageFlags.Ephemeral });
      }
      if (sub2 === 'remove') {
        const name = interaction.options.getString('name', true);
        await secretsStore.set(`vercel_group_${name}`, '');
        return interaction.reply({ content: `🗑️ Removed group '${name}'.`, flags: MessageFlags.Ephemeral });
      }
      if (sub2 === 'list') {
        const keys = await secretsStore.list();
        const rows = keys.filter(k => k.startsWith('vercel_group_'));
        if (!rows.length) return interaction.reply({ content: 'No groups defined.', flags: MessageFlags.Ephemeral });
        const out: string[] = [];
        for (const k of rows) {
          try { const v = await secretsStore.get(k); if (!v) continue; const o = JSON.parse(v); out.push(`• ${k.replace('vercel_group_', '')} → ${o.projectIds?.length || 0} projects${o.teamId?` (team:${o.teamId})`:''}`); } catch {}
        }
        return interaction.reply({ content: `Groups:\n${out.join('\n') || '—'}` , flags: MessageFlags.Ephemeral });
      }
    }
    if (interaction.options.getSubcommand(false) === 'lookup-project' && interaction.options.getSubcommandGroup(false) === null) {
      const q = interaction.options.getString('name', true);
      const teamIdOpt = interaction.options.getString('team_id') || undefined;
      const token = await secretsStore.get('vercel_token');
      if (!token) return interaction.reply({ content: '❌ No vercel token set. Run /setup vercel set token:<token>', flags: MessageFlags.Ephemeral });
      const teamId = teamIdOpt || (await secretsStore.get('vercel_team_id') || undefined);
      const qs = teamId ? `?limit=100&teamId=${encodeURIComponent(teamId)}` : '?limit=100';
      const res = await fetch(`https://api.vercel.com/v9/projects${qs}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return interaction.reply({ content: `❌ API error ${res.status}`, flags: MessageFlags.Ephemeral });
      const data: any = await res.json();
      const list: any[] = Array.isArray(data?.projects) ? data.projects : Array.isArray(data) ? data : [];
      const lower = q.toLowerCase();
      const match = list.find(p => (p?.id === q) || (p?.name?.toLowerCase?.() === lower) || (p?.slug?.toLowerCase?.() === lower));
      if (!match) return interaction.reply({ content: `No project found for '${q}'${teamId?` in team ${teamId}`:''}.`, flags: MessageFlags.Ephemeral });
      const id = match.id || '(unknown)';
      const name = match.name || match.slug || '(unnamed)';
      return interaction.reply({ content: `🔎 Found: ${name} → ${id}`, flags: MessageFlags.Ephemeral });
    }
    if (interaction.options.getSubcommandGroup(false) === 'map') {
      const sub2 = interaction.options.getSubcommand(true);
      if (sub2 === 'set') {
        const owner = interaction.options.getString('owner', true);
        const repo = interaction.options.getString('repo', true);
        let projectId = interaction.options.getString('project_id', true);
        const teamId = interaction.options.getString('team_id') || undefined;
        const preferRaw = (interaction.options.getString('prefer') || '').toLowerCase();
        const prefer: 'api'|'cli'|undefined = preferRaw === 'api' ? 'api' : preferRaw === 'cli' ? 'cli' : undefined;
        const envOpt = interaction.options.getString('env') || undefined;
        // Resolve projectId if a name/slug was provided instead of prj_ id
        if (!/^prj_/.test(projectId)) {
          try {
            const token = await secretsStore.get('vercel_token');
            if (token) {
              const resolvedTeam = teamId || (await secretsStore.get('vercel_team_id') || undefined);
              const qs = resolvedTeam ? `?limit=100&teamId=${encodeURIComponent(resolvedTeam)}` : '?limit=100';
              const res = await fetch(`https://api.vercel.com/v9/projects${qs}`, { headers: { Authorization: `Bearer ${token}` } });
              if (res.ok) {
                const data: any = await res.json();
                const list: any[] = Array.isArray(data?.projects) ? data.projects : Array.isArray(data) ? data : [];
                const lower = projectId.toLowerCase();
                const match = list.find(p => (p?.id === projectId) || (p?.name?.toLowerCase?.() === lower) || (p?.slug?.toLowerCase?.() === lower));
                if (match?.id) projectId = match.id;
              }
            }
          } catch {}
        }
        const key = envOpt ? `vercel_map_${owner}_${repo}_${envOpt}` : `vercel_map_${owner}_${repo}`;
        await secretsStore.set(key, JSON.stringify({ projectId, teamId, ...(prefer ? { prefer } : {}) }));
        return interaction.reply({ content: `✅ Mapped ${owner}/${repo}${envOpt?` (${envOpt})`:''} → project:${projectId}${teamId ? ` team:${teamId}`:''}${prefer?` prefer:${prefer}`:''}`, flags: MessageFlags.Ephemeral });
      }
      if (sub2 === 'remove') {
        const owner = interaction.options.getString('owner', true);
        const repo = interaction.options.getString('repo', true);
        const key = `vercel_map_${owner}_${repo}`;
        await secretsStore.set(key, '');
        return interaction.reply({ content: `🗑️ Removed mapping for ${owner}/${repo}`, flags: MessageFlags.Ephemeral });
      }
      if (sub2 === 'list') {
        const keys = await secretsStore.list();
        const rows = keys.filter(k => k.startsWith('vercel_map_'));
        if (!rows.length) return interaction.reply({ content: 'No repo→project mappings.', flags: MessageFlags.Ephemeral });
        const out: string[] = [];
        for (const k of rows) {
          try {
            const v = await secretsStore.get(k); if (!v) continue; const o = JSON.parse(v);
            const tail = k.replace('vercel_map_', '');
            const parts = tail.split('_');
            let label: string;
            if (parts.length >= 3 && ['Production','Staging','Development'].includes(parts[2])) {
              label = `${parts[0]}/${parts[1]} (${parts[2]})`;
            } else {
              label = tail.replace('_','/');
            }
            out.push(`• ${label} → project:${o.projectId}${o.teamId?` team:${o.teamId}`:''}${o.prefer?` prefer:${o.prefer}`:''}`);
          } catch {}
        }
        return interaction.reply({ content: `Mappings:\n${out.join('\n') || '—'}`, flags: MessageFlags.Ephemeral });
      }
    }
    if (interaction.options.getSubcommandGroup(false) === 'map-group') {
      const sub2 = interaction.options.getSubcommand(true);
      if (sub2 === 'set') {
        const owner = interaction.options.getString('owner', true);
        const repo = interaction.options.getString('repo', true);
        const group = interaction.options.getString('group', true);
        const key = `vercel_groupmap_${owner}_${repo}`;
        await secretsStore.set(key, group);
        return interaction.reply({ content: `✅ Mapped ${owner}/${repo} → group:${group}`, flags: MessageFlags.Ephemeral });
      }
      if (sub2 === 'remove') {
        const owner = interaction.options.getString('owner', true);
        const repo = interaction.options.getString('repo', true);
        const key = `vercel_groupmap_${owner}_${repo}`;
        await secretsStore.set(key, '');
        return interaction.reply({ content: `🗑️ Removed group mapping for ${owner}/${repo}`, flags: MessageFlags.Ephemeral });
      }
      if (sub2 === 'list') {
        const keys = await secretsStore.list();
        const rows = keys.filter(k => k.startsWith('vercel_groupmap_'));
        if (!rows.length) return interaction.reply({ content: 'No repo→group mappings.', flags: MessageFlags.Ephemeral });
        const out: string[] = [];
        for (const k of rows) {
          const v = await secretsStore.get(k);
          if (!v) continue;
          out.push(`• ${k.replace('vercel_groupmap_', '').replace('_','/')} → group:${v}`);
        }
        return interaction.reply({ content: `Mappings:\n${out.join('\n') || '—'}`, flags: MessageFlags.Ephemeral });
      }
    }
  } else if (subGroup === 'forums') {
    const sub = interaction.options.getSubcommand(true);
    if (sub === 'set') {
      const forumId = interaction.options.getString('forum_id', true);
      const channel = interaction.options.getChannel('channel', true);
      await settingsService.setForumChannelId(guildId, forumId, channel.id);
      // Reflect into in-memory forum config if it exists
      const f = forumManager.getForum(forumId) as any;
      if (f) f.channelId = channel.id;
      // Auto-create/update a minimal team derived from forumId if absent
      try {
        const m = forumId.match(/^(.*?)-(bugs|features)$/i);
        if (m) {
          const teamId = m[1];
          const kind = m[2];
          const existing = await settingsService.getTeamSettings(teamId);
          const toTitle = (s: string) => s.split(/[-_]/g).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
          const patch: any = { name: existing?.name || toTitle(teamId) };
          if (kind.toLowerCase() === 'bugs') patch.bugForumId = forumId; else patch.featureForumId = forumId;
          await settingsService.upsertTeamSettings(teamId, patch);
        }
      } catch {}
      try { await forumManager.syncFromDb(guildId); } catch {}
      return interaction.reply({ content: `✅ Mapped forum '${forumId}' to <#${channel.id}> (synced)`, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'list') {
      const mappings = await settingsService.listForumMappings(guildId);
      const lines = mappings.length ? mappings.map(m => `• ${m.forumId} → <#${m.channelId}>`).join('\n') : 'No mappings yet.';
      return interaction.reply({ content: `Forum mappings for this guild:\n${lines}`, flags: MessageFlags.Ephemeral });
    }
  }

  if (subGroup === 'sync' || topSub === 'verify' || topSub === 'cache') {
    const sub = topSub || interaction.options.getSubcommand(true);
    const guild = interaction.guild!;
    const guildIdSync = guild.id;

    const reply = async (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

    if (sub === 'cache') {
      try { await forumManager.syncFromDb(guildIdSync); } catch {}
      return reply('🔄 Cache refreshed from DB.');
    }

    if (sub === 'teams' || sub === 'all') {
      const createRoles = sub === 'all' ? (interaction.options.getBoolean('create') ?? false) : (interaction.options.getBoolean('create_roles') ?? false);
      const teams = await settingsService.listTeamSettings();
      let created = 0, linked = 0, ok = 0;
      for (const t of teams) {
        let roleId = (t as any).roleId || null;
        let role = roleId ? await guild.roles.fetch(roleId).catch(() => null) : null;
        if (!role && createRoles) {
          role = await guild.roles.create({ name: t.name || t.id, color: t.color || null as any, reason: `Sync role for team ${t.id}` });
          if (role) { await settingsService.setTeamRoleId(t.id, role.id); created++; roleId = role.id; }
        } else if (!role && !createRoles) {
          // skip
        } else if (role) {
          ok++;
        }
        if (role && !((t as any).roleId)) { linked++; }
      }
      try { await forumManager.syncFromDb(guildIdSync); } catch {}
      if (sub !== 'all') {
        return reply(`👥 Teams synced • ok:${ok} created:${created} linked:${linked}`);
      }
    }

    if (sub === 'forums' || sub === 'all') {
      const createMissing = sub === 'all' ? (interaction.options.getBoolean('create') ?? false) : (interaction.options.getBoolean('create_missing') ?? false);
      const teams = await settingsService.listTeamSettings();
      let mapped = 0, created = 0, missing = 0;
      for (const t of teams) {
        const spec: Array<{ id: string | null | undefined; category: 'bug-reports'|'feature-requests' }>= [
          { id: (t as any).bugForumId, category: 'bug-reports' },
          { id: (t as any).featureForumId, category: 'feature-requests' },
        ];
        for (const s of spec) {
          if (!s.id) continue;
          const chId = await settingsService.getForumChannelId(guildIdSync, s.id);
          let channel = chId ? await guild.channels.fetch(chId).catch(()=>null) : null;
          if (!channel && createMissing) {
            const fc: any = {
              id: s.id,
              name: `${s.category === 'bug-reports' ? '🧰' : '💡'} ${(t as any).name || t.id} ${s.category === 'bug-reports' ? 'Bug Reports' : 'Feature Requests'}`,
              description: `${(t as any).name || t.id} ${s.category === 'bug-reports' ? 'bugs' : 'features'} forum`,
              category: s.category,
              team: t.id,
              priority: 100,
              tags: s.category === 'bug-reports' ? [ { name: 'bug', emoji: '🐛' } ] : [ { name: 'enhancement', emoji: '✨' } ],
              permissions: { allowedRoles: ['@everyone'], restrictedToTeam: false },
              autoAssign: [],
              labels: s.category === 'bug-reports' ? ['bug'] : ['enhancement'],
            };
            try {
              forumManager.registerForum(fc);
              const createdForum = await forumManager.createDiscordForum(guild, fc);
              if (createdForum) {
                await settingsService.setForumChannelId(guildIdSync, s.id, createdForum.id);
                created++;
                channel = createdForum;
              }
            } catch {}
          }
          if (channel) mapped++; else missing++;
        }
      }
      try { await forumManager.syncFromDb(guildIdSync); } catch {}
      return reply(`📁 Forums synced • mapped:${mapped} created:${created} missing:${missing}`);
    }

    if (sub === 'verify') {
      const teams = await settingsService.listTeamSettings();
      const guild = interaction.guild!;
      const lines: string[] = [];
      const jsonReport: any[] = [];
      for (const t of teams) {
        const roleId = (t as any).roleId || null;
        const roleOk = roleId ? !!(await guild.roles.fetch(roleId).catch(()=>null)) : false;
        const bugId = (t as any).bugForumId || null;
        const featId = (t as any).featureForumId || null;
        let bugStatus = '—';
        let featStatus = '—';
        if (bugId) {
          const ch = await settingsService.getForumChannelId(guild.id, bugId);
          bugStatus = ch ? `<#${ch}>` : '⛔ unmapped';
        }
        if (featId) {
          const ch = await settingsService.getForumChannelId(guild.id, featId);
          featStatus = ch ? `<#${ch}>` : '⛔ unmapped';
        }
        lines.push(`• ${t.name || t.id} • role: ${roleId ? (roleOk ? `<@&${roleId}>` : `⚠️ missing <@&${roleId}>`) : '—'} • bugs: ${bugStatus} • features: ${featStatus}`);
        jsonReport.push({
          id: t.id,
          name: (t as any).name || t.id,
          roleId: roleId || null,
          roleExists: roleOk,
          bugForumId: bugId || null,
          bugChannelId: bugId ? (await settingsService.getForumChannelId(guild.id, bugId)) || null : null,
          featureForumId: featId || null,
          featureChannelId: featId ? (await settingsService.getForumChannelId(guild.id, featId)) || null : null,
        });
      }
      const summary = lines.join('\n') || 'No teams in DB.';
      try { await forumManager.syncFromDb(guild.id); } catch {}
      const asJson = interaction.options.getBoolean('json') || false;
      if (asJson) {
        const payload = '```json\n' + JSON.stringify({ guildId: guild.id, teams: jsonReport }, null, 2) + '\n```';
        return reply(payload);
      }
      return reply(`🔎 Verify\n${summary}`);
    }

    return reply('❌ Unknown sync subcommand');
  }

  if (subGroup === 'secrets') {
    const sub = interaction.options.getSubcommand(true);
    if (sub === 'set') {
      const entries: Array<[string,string]> = [];
      const keys = [
        'github_access_token','github_username','github_repository',
        'jira_host','jira_email','jira_api_token','jira_project_key',
      ];
      for (const k of keys) {
        const val = interaction.options.getString(k as any);
        if (val) entries.push([k, val]);
      }
      for (const [k, v] of entries) await secretsStore.set(k, v);
      const setList = entries.length ? entries.map(([k]) => k).join(', ') : 'nothing';
      return interaction.reply({ content: `🔐 Secrets updated: ${setList}. These override env when used by updated components.`, flags: MessageFlags.Ephemeral });
    }
  }

  if (subGroup === 'atoms') {
    const sub = interaction.options.getSubcommand(true);
    const reply = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

    if (sub === 'set') {
      const entries: Array<[string,string]> = [];
      const supabaseUrl = interaction.options.getString('supabase_url') || undefined;
      const serviceRoleKey = interaction.options.getString('service_role_key') || undefined;
      const anonKey = interaction.options.getString('anon_key') || undefined;
      const webUrl = interaction.options.getString('web_url') || undefined;
      const orgId = interaction.options.getString('org_id') || undefined;
      const projectId = interaction.options.getString('project_id') || undefined;
      const reqDocId = interaction.options.getString('requirements_document_id') || undefined;
      const reqBlockId = interaction.options.getString('requirements_block_id') || undefined;
      const accessToken = interaction.options.getString('access_token') || undefined;
      const refreshToken = interaction.options.getString('refresh_token') || undefined;
      if (supabaseUrl) entries.push(['atoms_supabase_url', supabaseUrl]);
      if (serviceRoleKey) entries.push(['atoms_supabase_service_role_key', serviceRoleKey]);
      if (anonKey) entries.push(['atoms_supabase_anon_key', anonKey]);
      if (webUrl) entries.push(['atoms_web_url', webUrl]);
      if (orgId) entries.push(['atoms_org_id', orgId]);
      if (projectId) entries.push(['atoms_project_id', projectId]);
      if (reqDocId) entries.push(['atoms_requirements_document_id', reqDocId]);
      if (reqBlockId) entries.push(['atoms_requirements_block_id', reqBlockId]);
      if (accessToken) entries.push(['atoms_access_token', accessToken]);
      if (refreshToken) entries.push(['atoms_refresh_token', refreshToken]);
      for (const [k, v] of entries) await secretsStore.set(k, v);
      const setList = entries.length ? entries.map(([k]) => k).join(', ') : 'nothing';
      return reply(`🔐 Atoms config updated: ${setList}.`);
    }

    if (sub === 'select') {
      const { atomsService } = await import('../../atoms/atomsClient');
      const projects = await atomsService.listProjects();
      const existingProject = await secretsStore.get('atoms_project_id');
      const existingOrg = await secretsStore.get('atoms_org_id');
      const existingDoc = await secretsStore.get('atoms_requirements_document_id');

      const projOptions = (projects || []).slice(0, 25).map((p: any) => ({ label: p.name, value: String(p.id) }));
      const projectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('atoms_sel_project')
          .setPlaceholder('Select Atoms project')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(projOptions as any)
      );

      // Document list depends on project; if we have existing, prefetch docs for it
      let docRow: any | null = null;
      try {
        const pid = existingProject || (projects?.[0]?.id ? String(projects[0].id) : undefined);
        if (pid) {
          const docs = await atomsService.listDocuments(pid);
          const docOptions = (docs || []).slice(0, 25).map((d: any) => ({ label: d.name, value: String(d.id) }));
          docRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('atoms_sel_document')
              .setPlaceholder('Select requirements document (optional)')
              .setMinValues(1)
              .setMaxValues(1)
              .addOptions(docOptions as any)
          );
        }
      } catch {}

      const saveRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('atoms_sel_save').setLabel('Save').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('atoms_sel_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
      );

      const parts = [
        `Configure Atoms linkables:`,
        existingOrg ? `• Current org: ${existingOrg}` : null,
        existingProject ? `• Current project: ${existingProject}` : null,
        existingDoc ? `• Current document: ${existingDoc}` : null,
      ].filter(Boolean);

      return await interaction.reply({
        content: parts.join('\n') || 'Configure Atoms linkables:',
        components: [projectRow, ...(docRow ? [docRow] : []), saveRow] as any,
        flags: MessageFlags.Ephemeral,
      });
    } else if (sub === 'test') {
      const { atomsService } = await import('../../atoms/atomsClient');
      const ok = await atomsService.testConnection();
      if (!ok) return reply('❌ Atoms connection failed. Ensure supabase URL and service role key are set via /setup atoms set.');
      // Attempt ensure Issues doc/block if project is provided
      try {
        const ensured = await atomsService.ensureIssuesDocAndBlock();
        if (ensured) {
          return reply(`✅ Atoms connected. Issues doc/block ready (doc=${ensured.documentId}, block=${ensured.blockId}).`);
        }
      } catch {}
      return reply('✅ Atoms connected. Provide org/project and optional document/block to finalize.');
    }

    if (sub === 'show') {
      const keys = ['atoms_supabase_url','atoms_web_url','atoms_org_id','atoms_project_id','atoms_requirements_document_id','atoms_requirements_block_id'];
      const values: Record<string, string | undefined> = {};
      for (const k of keys) values[k] = await secretsStore.get(k);
      const hasSrv = await secretsStore.has('atoms_supabase_service_role_key');
      const maskedKey = hasSrv ? '•••' : '—';
      const lines = [
        `supabase_url: ${values['atoms_supabase_url'] || '—'}`,
        `service_role_key: ${maskedKey}`,
        `web_url: ${values['atoms_web_url'] || '—'}`,
        `org_id: ${values['atoms_org_id'] || '—'}`,
        `project_id: ${values['atoms_project_id'] || '—'}`,
        `requirements_document_id: ${values['atoms_requirements_document_id'] || '—'}`,
        `requirements_block_id: ${values['atoms_requirements_block_id'] || '—'}`,
      ];
      return reply('🧪 Atoms config\n' + lines.join('\n'));
    }

    if (sub === 'login') {
      const email = interaction.options.getString('email', true);
      const password = interaction.options.getString('password', true);
      const { atomsService } = await import('../../atoms/atomsClient');
      const ok = await atomsService.login(email, password);
      return reply(ok ? '✅ Logged in. Access/refresh tokens saved.' : '❌ Login failed. Check credentials and RLS policies.');
    }

    if (sub === 'whoami') {
      const { atomsService } = await import('../../atoms/atomsClient');
      const me = await atomsService.whoami();
      if (!me) return reply('❌ No active JWT. Use /setup atoms login or set access_token.');
      const out = '```json\n' + JSON.stringify(me, null, 2) + '\n```';
      return reply(out);
    }

    if (sub === 'status') {
      const access = await secretsStore.get('atoms_access_token');
      const refresh = await secretsStore.get('atoms_refresh_token');
      if (!access) return reply('❌ No access token stored. Use /setup atoms login or set access_token.');
      let exp = 0, secondsLeft = -1;
      try {
        const parts = access.split('.')
        if (parts.length >= 2) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8')) as { exp?: number };
          exp = payload?.exp || 0;
          const now = Math.floor(Date.now()/1000);
          secondsLeft = exp ? (exp - now) : -1;
        }
      } catch {}
      const lines = [
        `access_token: ${access ? '•••' : '—'}`,
        `refresh_token: ${refresh ? '•••' : '—'}`,
        `expires_in: ${secondsLeft >= 0 ? secondsLeft + 's' : 'unknown'}`,
        secondsLeft >= 0 ? (secondsLeft < 300 ? '⚠️ Token expiring soon (<5m). Auto-refresh enabled.' : '✅ Token valid (>5m).') : 'ℹ️ Could not determine expiry.'
      ];
      return reply('🔎 Atoms token status\n' + lines.join('\n'));
    }

    return reply('❌ Unknown atoms subcommand');
  }

  if (subGroup === 'linear') {
    const sub = interaction.options.getSubcommand(true);
    if (sub === 'select') {
      const { handleLinearSelect } = await import('../handlers/linearSetupHandlers');
      // Build initial UI
      try {
        // Reuse handler by constructing components via a small helper
        const { default: _ } = await import('url'); // noop to keep bundlers happy
      } catch {}
      // Mimic initial render by calling the builder indirectly via a temp select
      const { linearService } = await import('../../linear/linearClient');
      const teams = await linearService.listTeams();
      const opts = (teams || []).slice(0,25).map((t: any) => ({ label: `${t.name}${t.id ? ' • ' + t.id : ''}`, value: String(t.id) }));
      const { StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
      const teamRow = new (ActionRowBuilder as any)().addComponents(
        new (StringSelectMenuBuilder as any)()
          .setCustomId('linear_sel_team')
          .setPlaceholder('Select Linear team')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(opts)
      );
      const saveRow = new (ActionRowBuilder as any)().addComponents(
        new (ButtonBuilder as any)().setCustomId('linear_sel_save').setLabel('Save').setStyle((ButtonStyle as any).Success),
        new (ButtonBuilder as any)().setCustomId('linear_sel_cancel').setLabel('Cancel').setStyle((ButtonStyle as any).Secondary),
      );
      return await interaction.reply({ content: 'Configure Linear:', components: [teamRow, saveRow] as any, flags: MessageFlags.Ephemeral });
    }
  }

  if (subGroup === 'coda') {
    const sub = interaction.options.getSubcommand(true);
    if (sub === 'bind') {
      const url = interaction.options.getString('url', true);
      const { codaService } = await import('../../coda/codaClient');
      const parsed = codaService.parseCodaUrl(url);
      if (!parsed.docId) return await interaction.reply({ content: '❌ Could not extract Coda doc id from URL.', flags: MessageFlags.Ephemeral });
      await secretsStore.set('coda_doc_id', parsed.docId);
      let boundUsers = false;
      if (parsed.anchorId) {
        try {
          const cols = await codaService.listColumns(parsed.anchorId);
          const hasEmail = cols.some(c => /email/i.test(c.name));
          const hasName = cols.some(c => /name|full\s*name/i.test(c.name));
          if (hasEmail || hasName) {
            await secretsStore.set('coda_users_table_id', parsed.anchorId);
            boundUsers = true;
          }
        } catch {}
      }
      const msg = `✅ Bound Coda doc: ${parsed.docId}${boundUsers ? ` (users table: ${parsed.anchorId})` : ''}. This doc will scope user-link Coda candidates.`;
      return await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'select') {
      try {
        const { codaService } = await import('../../coda/codaClient');
        const docs = await codaService.listDocs(100).then(r => r.items);
        const opts = (docs || []).slice(0,25).map(d => ({ label: d.name, value: String(d.id) }));
        const { StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
        const docRow = new (ActionRowBuilder as any)().addComponents(
          new (StringSelectMenuBuilder as any)()
            .setCustomId('coda_sel_doc')
            .setPlaceholder('Select Coda document')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(opts)
        );
        const saveRow = new (ActionRowBuilder as any)().addComponents(
          new (ButtonBuilder as any)().setCustomId('coda_sel_save').setLabel('Save').setStyle((ButtonStyle as any).Success),
          new (ButtonBuilder as any)().setCustomId('coda_sel_cancel').setLabel('Cancel').setStyle((ButtonStyle as any).Secondary),
        );
        return await interaction.reply({ content: 'Configure Coda:', components: [docRow, saveRow] as any, flags: MessageFlags.Ephemeral });
      } catch (e: any) {
        return await interaction.reply({ content: `❌ Coda setup failed: ${e?.message || e}. Ensure CODA_API_TOKEN is set.`, flags: MessageFlags.Ephemeral });
      }
    }
  }

  if (subGroup === 'github') {
    const sub = interaction.options.getSubcommand(true);
    if (sub === 'select') {
      const { StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
      const { default: _ } = await import('url');
      const { octokit } = await import('../../github/githubActions');
      const me = await octokit.rest.users.getAuthenticated();
      const mine = [{ label: me.data.login, value: me.data.login }];
      const orgs = await octokit.rest.orgs.listForAuthenticatedUser({ per_page: 100 });
      const owners = [...mine, ...(orgs.data || []).map(o => ({ label: o.login, value: o.login }))].slice(0, 25);
      const ownerRow = new (ActionRowBuilder as any)().addComponents(
        new (StringSelectMenuBuilder as any)()
          .setCustomId('gh_sel_owner')
          .setPlaceholder('Select GitHub owner')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(owners)
      );
      const saveRow = new (ActionRowBuilder as any)().addComponents(
        new (ButtonBuilder as any)().setCustomId('gh_sel_save').setLabel('Save').setStyle((ButtonStyle as any).Success),
        new (ButtonBuilder as any)().setCustomId('gh_sel_cancel').setLabel('Cancel').setStyle((ButtonStyle as any).Secondary),
      );
      return await interaction.reply({ content: 'Configure GitHub:', components: [ownerRow, saveRow] as any, flags: MessageFlags.Ephemeral });
    }
  }
  if (subGroup === 'team') {
    const sub = interaction.options.getSubcommand(true);
    if (sub === 'list') {
      const staticTeams = forumManager.getAllTeams();
      const dbTeams = await (await import('../../settings/SettingsService')).settingsService.listTeamSettings();
      const s1 = staticTeams.map(t => `• ${t.id} (${t.name})`).join('\n');
      const s2 = dbTeams.map(t => `• ${t.id} (${t.name})${t.githubOwner && t.githubRepo ? ` GH:${t.githubOwner}/${t.githubRepo}`: ''}${t.jiraProjectKey? ` Jira:${t.jiraProjectKey}`:''}`).join('\n');
      return interaction.reply({ content: `Static teams:\n${s1 || '—'}\n\nDB teams:\n${s2 || '—'}`, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'add') {
      const id = interaction.options.getString('id', true);
      const payload = {
        name: interaction.options.getString('name') || undefined,
        description: interaction.options.getString('description') || undefined,
        color: interaction.options.getInteger('color') || undefined,
        emoji: interaction.options.getString('emoji') || undefined,
        bugForumId: interaction.options.getString('bug_forum_id') || undefined,
        featureForumId: interaction.options.getString('feature_forum_id') || undefined,
        githubOwner: interaction.options.getString('github_owner') || undefined,
        githubRepo: interaction.options.getString('github_repo') || undefined,
        pmProvider: interaction.options.getString('pm_provider') || undefined,
        pmSync: interaction.options.getBoolean('pm_sync') ?? undefined,
        linearTeamId: interaction.options.getString('linear_team_id') || undefined,
        linearProjectId: interaction.options.getString('linear_project_id') || undefined,
        ghProjectsOrg: interaction.options.getString('gh_projects_org') || undefined,
        ghProjectsId: interaction.options.getString('gh_projects_id') || undefined,
        ghProjectsNumber: interaction.options.getString('gh_projects_number') || undefined,
        codaDocId: interaction.options.getString('coda_doc_id') || undefined,
        codaIssuesTableId: interaction.options.getString('coda_issues_table_id') || undefined,
        codaIssueKeyColumn: interaction.options.getString('coda_issue_key_column') || undefined,
        codaIssueTitleColumn: interaction.options.getString('coda_issue_title_column') || undefined,
        codaIssueStatusColumn: interaction.options.getString('coda_issue_status_column') || undefined,
        codaIssuePriorityColumn: interaction.options.getString('coda_issue_priority_column') || undefined,
        codaIssueAssigneeColumn: interaction.options.getString('coda_issue_assignee_column') || undefined,
        jiraProjectKey: interaction.options.getString('jira_project_key') || undefined,
        jiraBoardId: interaction.options.getString('jira_board_id') || undefined,
      };
      await settingsService.upsertTeamSettings(id, payload);
      // Auto-create role if not exists
      try {
        const team = await settingsService.getTeamSettings(id);
        let roleId = team?.roleId || null;
        if (!roleId) {
          const role = await interaction.guild?.roles.create({
            name: team?.name || id,
            color: team?.color || null as any,
            reason: `Auto-created for team ${id}`,
          });
          if (role) {
            roleId = role.id;
            await settingsService.setTeamRoleId(id, role.id);
          }
        }
        try { await forumManager.syncFromDb(guildId); } catch {}
        return interaction.reply({ content: `✅ Team saved '${id}'${roleId ? ` • role <@&${roleId}> linked` : ''} (synced)`, flags: MessageFlags.Ephemeral });
      } catch {
        return interaction.reply({ content: `✅ Team settings saved for '${id}' (role creation skipped)`, flags: MessageFlags.Ephemeral });
      }
    }
    if (sub === 'remove') {
      const id = interaction.options.getString('id', true);
      // Attempt to delete linked role if exists
      try {
        const team = await settingsService.getTeamSettings(id);
        const roleId = team?.roleId;
        if (roleId) {
          const role = await interaction.guild?.roles.fetch(roleId).catch(() => null);
          if (role) await role.delete('Team deleted via /setup');
        }
      } catch {}
      await settingsService.removeTeamSettings(id);
      try { await forumManager.syncFromDb(guildId); } catch {}
      return interaction.reply({ content: `🗑️ Removed team settings '${id}'`, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'role-create') {
      const id = interaction.options.getString('id', true);
      const name = interaction.options.getString('name') || undefined;
      const color = interaction.options.getInteger('color') || undefined;
      const team = await settingsService.getTeamSettings(id);
      if (!team) return interaction.reply({ content: '❌ Unknown team', flags: MessageFlags.Ephemeral });
      const role = await interaction.guild?.roles.create({
        name: name || team.name,
        color: color || team.color || null as any,
        reason: `Role for team ${id}`,
      });
      if (!role) return interaction.reply({ content: '❌ Failed to create role', flags: MessageFlags.Ephemeral });
      await settingsService.setTeamRoleId(id, role.id);
      try { await forumManager.syncFromDb(guildId); } catch {}
      return interaction.reply({ content: `✅ Created role <@&${role.id}> and linked to team '${id}' (synced)`, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'role-set') {
      const id = interaction.options.getString('id', true);
      const role = interaction.options.getRole('role', true);
      await settingsService.setTeamRoleId(id, role.id);
      try { await forumManager.syncFromDb(guildId); } catch {}
      return interaction.reply({ content: `🔗 Linked role <@&${role.id}> to team '${id}' (synced)`, flags: MessageFlags.Ephemeral });
    }
    if (sub === 'members-add' || sub === 'members-remove') {
      const id = interaction.options.getString('id', true);
      const action = sub === 'members-add' ? 'add' : 'remove';
      const { UserSelectMenuBuilder, ActionRowBuilder } = await import('discord.js');
      const menu = new (UserSelectMenuBuilder as any)()
        .setCustomId(`team_members_${action}_${id}_${interaction.user.id}`)
        .setPlaceholder(action === 'add' ? 'Select users to add…' : 'Select users to remove…')
        .setMinValues(1)
        .setMaxValues(25);
      const row = new (ActionRowBuilder as any)().addComponents(menu);
      return interaction.reply({ content: `Select users to ${action} for team '${id}'`, components: [row], flags: MessageFlags.Ephemeral });
    }
  }

  return interaction.reply({ content: '❌ Unknown setup command', flags: MessageFlags.Ephemeral });
}
