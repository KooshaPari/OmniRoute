/**
 * Test Fixtures and Sample Data
 * 
 * Centralized location for test data, fixtures, and sample objects
 * used throughout the test suite.
 */

// Discord Fixtures
export const discordFixtures = {
  users: {
    testUser: {
      id: "123456789",
      username: "testuser",
      discriminator: "0000",
      avatar: null,
      bot: false,
      tag: "testuser#0000",
    },
    botUser: {
      id: "987654321",
      username: "TestBot",
      discriminator: "0000",
      avatar: null,
      bot: true,
      tag: "TestBot#0000",
    },
    adminUser: {
      id: "111111111",
      username: "admin",
      discriminator: "0001",
      avatar: "admin_avatar_hash",
      bot: false,
      tag: "admin#0001",
    },
  },

  guilds: {
    testGuild: {
      id: "555555555",
      name: "Test Guild",
      ownerId: "111111111",
      memberCount: 100,
      channels: ["666666666", "777777777"],
    },
  },

  channels: {
    textChannel: {
      id: "666666666",
      name: "general",
      type: 0, // GUILD_TEXT
      guildId: "555555555",
    },
    forumChannel: {
      id: "777777777",
      name: "bug-reports",
      type: 15, // GUILD_FORUM
      guildId: "555555555",
      availableTags: [
        {
          id: "tag_bug",
          name: "bug",
          emoji: { name: "🐛" },
          moderated: false,
        },
        {
          id: "tag_feature",
          name: "feature",
          emoji: { name: "✨" },
          moderated: false,
        },
      ],
    },
  },

  interactions: {
    slashCommand: {
      id: "interaction_123",
      applicationId: "app_123",
      type: 2, // CHAT_INPUT
      data: {
        id: "command_123",
        name: "test-command",
        type: 1,
        options: [],
      },
      guildId: "555555555",
      channelId: "666666666",
      user: {
        id: "123456789",
        username: "testuser",
        discriminator: "0000",
      },
      token: "interaction_token",
      version: 1,
    },
    
    buttonClick: {
      id: "interaction_456",
      applicationId: "app_123",
      type: 3, // MESSAGE_COMPONENT
      data: {
        custom_id: "test_button",
        component_type: 2,
      },
      guildId: "555555555",
      channelId: "666666666",
      user: {
        id: "123456789",
        username: "testuser",
        discriminator: "0000",
      },
      message: {
        id: "message_123",
        content: "Test message",
      },
      token: "interaction_token",
      version: 1,
    },

    modalSubmit: {
      id: "interaction_789",
      applicationId: "app_123",
      type: 5, // MODAL_SUBMIT
      data: {
        custom_id: "test_modal",
        components: [
          {
            type: 1, // ACTION_ROW
            components: [
              {
                type: 4, // TEXT_INPUT
                custom_id: "test_input",
                value: "Test input value",
              },
            ],
          },
        ],
      },
      guildId: "555555555",
      channelId: "666666666",
      user: {
        id: "123456789",
        username: "testuser",
        discriminator: "0000",
      },
      token: "interaction_token",
      version: 1,
    },
  },

  embeds: {
    basic: {
      title: "Test Embed",
      description: "This is a test embed",
      color: 0x00ff00,
      timestamp: "2024-01-01T00:00:00.000Z",
    },

    withFields: {
      title: "Issue Report",
      description: "Bug report details",
      color: 0xff0000,
      fields: [
        {
          name: "Issue Number",
          value: "#123",
          inline: true,
        },
        {
          name: "Status",
          value: "Open",
          inline: true,
        },
        {
          name: "Description",
          value: "There is a bug in the system",
          inline: false,
        },
      ],
      timestamp: "2024-01-01T00:00:00.000Z",
    },

    withAuthorAndFooter: {
      title: "System Status",
      description: "All systems operational",
      color: 0x00ff00,
      author: {
        name: "System Bot",
        iconURL: "https://example.com/bot-avatar.png",
      },
      footer: {
        text: "Last updated",
        iconURL: "https://example.com/footer-icon.png",
      },
      timestamp: "2024-01-01T00:00:00.000Z",
    },
  },

  components: {
    actionRow: {
      type: 1, // ACTION_ROW
      components: [
        {
          type: 2, // BUTTON
          style: 1, // PRIMARY
          custom_id: "test_button",
          label: "Click Me",
        },
      ],
    },

    selectMenu: {
      type: 1, // ACTION_ROW
      components: [
        {
          type: 3, // STRING_SELECT
          custom_id: "test_select",
          placeholder: "Choose an option",
          options: [
            {
              label: "Option 1",
              value: "option_1",
              description: "First option",
              emoji: { name: "1️⃣" },
            },
            {
              label: "Option 2",
              value: "option_2",
              description: "Second option",
              emoji: { name: "2️⃣" },
            },
          ],
        },
      ],
    },

    modal: {
      custom_id: "test_modal",
      title: "Test Modal",
      components: [
        {
          type: 1, // ACTION_ROW
          components: [
            {
              type: 4, // TEXT_INPUT
              custom_id: "title_input",
              label: "Title",
              style: 1, // SHORT
              placeholder: "Enter a title",
              required: true,
              max_length: 100,
            },
          ],
        },
        {
          type: 1, // ACTION_ROW
          components: [
            {
              type: 4, // TEXT_INPUT
              custom_id: "description_input",
              label: "Description",
              style: 2, // PARAGRAPH
              placeholder: "Enter a description",
              required: false,
              max_length: 1000,
            },
          ],
        },
      ],
    },
  },
};

// GitHub Fixtures
export const githubFixtures = {
  repositories: {
    testRepo: {
      id: 123456789,
      name: "test-repo",
      full_name: "testuser/test-repo",
      owner: {
        login: "testuser",
        id: 12345,
        avatar_url: "https://github.com/avatars/u/12345",
        type: "User",
      },
      private: false,
      html_url: "https://github.com/testuser/test-repo",
      description: "A test repository for testing",
      fork: false,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T12:00:00Z",
      pushed_at: "2024-01-01T12:00:00Z",
      clone_url: "https://github.com/testuser/test-repo.git",
      ssh_url: "git@github.com:testuser/test-repo.git",
      size: 1024,
      stargazers_count: 10,
      watchers_count: 10,
      language: "TypeScript",
      forks_count: 5,
      archived: false,
      disabled: false,
      open_issues_count: 3,
      license: {
        key: "mit",
        name: "MIT License",
        spdx_id: "MIT",
      },
      allow_forking: true,
      is_template: false,
      topics: ["discord-bot", "typescript", "github-api"],
      visibility: "public",
      default_branch: "main",
    },
  },

  issues: {
    openIssue: {
      id: 987654321,
      number: 1,
      title: "Test Bug Report",
      body: "This is a test bug report\n\n**Steps to reproduce:**\n1. Do something\n2. Observe bug",
      html_url: "https://github.com/testuser/test-repo/issues/1",
      state: "open",
      locked: false,
      node_id: "I_kwDOABCDEF",
      user: {
        id: 12345,
        login: "testuser",
        avatar_url: "https://github.com/avatars/u/12345",
        type: "User",
      },
      assignees: [],
      labels: [
        {
          id: 1,
          node_id: "MDU6TGFiZWwx",
          name: "bug",
          color: "d73a49",
          default: true,
          description: "Something isn't working",
        },
      ],
      milestone: null,
      comments: 0,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      closed_at: null,
      author_association: "OWNER",
      reactions: {
        total_count: 0,
        "+1": 0,
        "-1": 0,
        laugh: 0,
        hooray: 0,
        confused: 0,
        heart: 0,
        rocket: 0,
        eyes: 0,
      },
    },

    closedIssue: {
      id: 987654322,
      number: 2,
      title: "Fixed Bug Report",
      body: "This bug has been fixed",
      html_url: "https://github.com/testuser/test-repo/issues/2",
      state: "closed",
      locked: false,
      node_id: "I_kwDOABCDEG",
      user: {
        id: 12345,
        login: "testuser",
        avatar_url: "https://github.com/avatars/u/12345",
        type: "User",
      },
      assignees: [
        {
          id: 12345,
          login: "testuser",
          avatar_url: "https://github.com/avatars/u/12345",
        },
      ],
      labels: [
        {
          id: 1,
          node_id: "MDU6TGFiZWwx",
          name: "bug",
          color: "d73a49",
          default: true,
          description: "Something isn't working",
        },
        {
          id: 2,
          node_id: "MDU6TGFiZWwy",
          name: "fixed",
          color: "0e8a16",
          default: false,
          description: "Issue has been resolved",
        },
      ],
      milestone: {
        id: 1,
        title: "v1.0.0",
        description: "First major release",
        due_on: "2024-12-31T23:59:59Z",
        state: "open",
      },
      comments: 2,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
      closed_at: "2024-01-02T00:00:00Z",
      author_association: "OWNER",
      reactions: {
        total_count: 3,
        "+1": 2,
        "-1": 0,
        laugh: 0,
        hooray: 1,
        confused: 0,
        heart: 0,
        rocket: 0,
        eyes: 0,
      },
    },
  },

  webhooks: {
    issueOpened: {
      action: "opened",
      issue: {
        id: 987654321,
        number: 1,
        title: "Test Bug Report",
        body: "This is a test bug report",
        html_url: "https://github.com/testuser/test-repo/issues/1",
        state: "open",
        user: { login: "testuser", id: 12345 },
      },
      repository: {
        name: "test-repo",
        full_name: "testuser/test-repo",
        owner: { login: "testuser", id: 12345 },
      },
      sender: {
        login: "testuser",
        id: 12345,
        type: "User",
      },
    },

    issueClosed: {
      action: "closed",
      issue: {
        id: 987654321,
        number: 1,
        title: "Test Bug Report",
        body: "This is a test bug report",
        html_url: "https://github.com/testuser/test-repo/issues/1",
        state: "closed",
        user: { login: "testuser", id: 12345 },
      },
      repository: {
        name: "test-repo",
        full_name: "testuser/test-repo",
        owner: { login: "testuser", id: 12345 },
      },
      sender: {
        login: "testuser",
        id: 12345,
        type: "User",
      },
    },
  },
};

// Jira Fixtures
export const jiraFixtures = {
  projects: {
    testProject: {
      id: "10000",
      key: "TEST",
      name: "Test Project",
      description: "A test project for development",
      lead: {
        accountId: "test-account-id",
        displayName: "Test User",
        emailAddress: "test@example.com",
      },
      projectCategory: {
        id: "10001",
        name: "Development",
        description: "Development projects",
      },
      avatarUrls: {
        "16x16": "https://test.atlassian.net/secure/projectavatar?size=xsmall&pid=10000",
        "24x24": "https://test.atlassian.net/secure/projectavatar?size=small&pid=10000",
        "32x32": "https://test.atlassian.net/secure/projectavatar?size=medium&pid=10000",
        "48x48": "https://test.atlassian.net/secure/projectavatar?pid=10000",
      },
      issueTypes: [
        {
          id: "10001",
          name: "Bug",
          iconUrl: "https://test.atlassian.net/images/icons/issuetypes/bug.png",
          subtask: false,
        },
        {
          id: "10002",
          name: "Task",
          iconUrl: "https://test.atlassian.net/images/icons/issuetypes/task.png",
          subtask: false,
        },
      ],
      versions: [],
      components: [],
      projectTypeKey: "software",
      simplified: false,
      style: "next-gen",
      isPrivate: false,
    },
  },

  issues: {
    bugIssue: {
      id: "10001",
      key: "TEST-1",
      self: "https://test.atlassian.net/rest/api/3/issue/10001",
      fields: {
        summary: "Test Bug Issue",
        description: "This is a test bug issue in Jira",
        status: {
          id: "1",
          name: "To Do",
          statusCategory: {
            id: 2,
            key: "new",
            colorName: "blue-gray",
            name: "To Do",
          },
        },
        priority: {
          id: "3",
          name: "Medium",
          iconUrl: "https://test.atlassian.net/images/icons/priorities/medium.svg",
        },
        assignee: null,
        reporter: {
          accountId: "test-account-id",
          displayName: "Test User",
          emailAddress: "test@example.com",
          avatarUrls: {
            "16x16": "https://test.atlassian.net/secure/useravatar?size=xsmall&avatarId=10338",
            "24x24": "https://test.atlassian.net/secure/useravatar?size=small&avatarId=10338",
            "32x32": "https://test.atlassian.net/secure/useravatar?size=medium&avatarId=10338",
            "48x48": "https://test.atlassian.net/secure/useravatar?avatarId=10338",
          },
        },
        created: "2024-01-01T00:00:00.000Z",
        updated: "2024-01-01T00:00:00.000Z",
        labels: ["bug", "high-priority"],
        components: [],
        issueType: {
          id: "10001",
          name: "Bug",
          iconUrl: "https://test.atlassian.net/images/icons/issuetypes/bug.png",
          subtask: false,
        },
        project: {
          id: "10000",
          key: "TEST",
          name: "Test Project",
          avatarUrls: {
            "16x16": "https://test.atlassian.net/secure/projectavatar?size=xsmall&pid=10000",
            "24x24": "https://test.atlassian.net/secure/projectavatar?size=small&pid=10000",
            "32x32": "https://test.atlassian.net/secure/projectavatar?size=medium&pid=10000",
            "48x48": "https://test.atlassian.net/secure/projectavatar?pid=10000",
          },
        },
        versions: [],
        fixVersions: [],
      },
    },

    taskIssue: {
      id: "10002",
      key: "TEST-2",
      self: "https://test.atlassian.net/rest/api/3/issue/10002",
      fields: {
        summary: "Test Task Issue",
        description: "This is a test task issue in Jira",
        status: {
          id: "2",
          name: "In Progress",
          statusCategory: {
            id: 4,
            key: "indeterminate",
            colorName: "yellow",
            name: "In Progress",
          },
        },
        priority: {
          id: "2",
          name: "High",
          iconUrl: "https://test.atlassian.net/images/icons/priorities/high.svg",
        },
        assignee: {
          accountId: "test-account-id",
          displayName: "Test User",
          emailAddress: "test@example.com",
          avatarUrls: {
            "16x16": "https://test.atlassian.net/secure/useravatar?size=xsmall&avatarId=10338",
            "24x24": "https://test.atlassian.net/secure/useravatar?size=small&avatarId=10338",
            "32x32": "https://test.atlassian.net/secure/useravatar?size=medium&avatarId=10338",
            "48x48": "https://test.atlassian.net/secure/useravatar?avatarId=10338",
          },
        },
        reporter: {
          accountId: "test-account-id",
          displayName: "Test User",
          emailAddress: "test@example.com",
          avatarUrls: {
            "16x16": "https://test.atlassian.net/secure/useravatar?size=xsmall&avatarId=10338",
            "24x24": "https://test.atlassian.net/secure/useravatar?size=small&avatarId=10338",
            "32x32": "https://test.atlassian.net/secure/useravatar?size=medium&avatarId=10338",
            "48x48": "https://test.atlassian.net/secure/useravatar?avatarId=10338",
          },
        },
        created: "2024-01-01T00:00:00.000Z",
        updated: "2024-01-01T12:00:00.000Z",
        labels: ["task", "sprint-1"],
        components: [
          {
            id: "10001",
            name: "Backend",
            description: "Backend components",
          },
        ],
        issueType: {
          id: "10002",
          name: "Task",
          iconUrl: "https://test.atlassian.net/images/icons/issuetypes/task.png",
          subtask: false,
        },
        project: {
          id: "10000",
          key: "TEST",
          name: "Test Project",
          avatarUrls: {
            "16x16": "https://test.atlassian.net/secure/projectavatar?size=xsmall&pid=10000",
            "24x24": "https://test.atlassian.net/secure/projectavatar?size=small&pid=10000",
            "32x32": "https://test.atlassian.net/secure/projectavatar?size=medium&pid=10000",
            "48x48": "https://test.atlassian.net/secure/projectavatar?pid=10000",
          },
        },
        versions: [],
        fixVersions: [
          {
            id: "10001",
            name: "1.0.0",
            archived: false,
            released: false,
          },
        ],
      },
    },
  },

  webhooks: {
    issueCreated: {
      timestamp: Date.now(),
      webhookEvent: "jira:issue_created",
      user: {
        accountId: "test-account-id",
        displayName: "Test User",
        emailAddress: "test@example.com",
      },
      issue: {
        id: "10001",
        key: "TEST-1",
        fields: {
          summary: "New Issue Created",
          description: "A new issue was created via webhook",
          status: { name: "To Do" },
          priority: { name: "Medium" },
          issueType: { name: "Bug" },
        },
      },
    },

    issueUpdated: {
      timestamp: Date.now(),
      webhookEvent: "jira:issue_updated",
      user: {
        accountId: "test-account-id",
        displayName: "Test User",
        emailAddress: "test@example.com",
      },
      issue: {
        id: "10001",
        key: "TEST-1",
        fields: {
          summary: "Updated Issue",
          description: "This issue was updated",
          status: { name: "In Progress" },
          priority: { name: "High" },
          issueType: { name: "Bug" },
        },
      },
      changelog: {
        id: "10001",
        items: [
          {
            field: "status",
            fieldtype: "jira",
            fieldId: "status",
            from: "1",
            fromString: "To Do",
            to: "2",
            toString: "In Progress",
          },
          {
            field: "priority",
            fieldtype: "jira",
            fieldId: "priority",
            from: "3",
            fromString: "Medium",
            to: "2",
            toString: "High",
          },
        ],
      },
    },
  },
};

// Environment Variables for Testing
export const testEnv = {
  DISCORD_TOKEN: "test_discord_token",
  DISCORD_CLIENT_ID: "test_client_id",
  GITHUB_ACCESS_TOKEN: "test_github_token",
  GITHUB_USERNAME: "testuser",
  GITHUB_REPOSITORY: "test-repo",
  DISCORD_CHANNEL_ID: "666666666",
  JIRA_HOST: "https://test.atlassian.net",
  JIRA_EMAIL: "test@example.com",
  JIRA_API_TOKEN: "test_jira_token",
  JIRA_PROJECT_KEY: "TEST",
  DISCORD_DEV_GUILD_ID: "555555555",
  NODE_ENV: "test",
};

// Export all fixtures
export default {
  discord: discordFixtures,
  github: githubFixtures,
  jira: jiraFixtures,
  env: testEnv,
};