OpenAPI Specs for .NET Backend

This folder contains domain-scoped OpenAPI 3.0 specs to bootstrap the .NET backend. Each file is focused and easy to iterate on. You can generate server controller stubs and typed clients using NSwag or Swashbuckle.

Files

- auth.yaml – Auth + Profiles (register/login/refresh, profile CRUD, approval)
- organizations.yaml – Orgs CRUD and membership
- projects.yaml – Projects CRUD and membership
- documents.yaml – Documents, Blocks, Columns
- requirements.yaml – Requirements CRUD + bulk positions
- properties.yaml – Properties batch create/update/delete + positions
- testing.yaml – Tests CRUD, requirement-test relations, matrix views
- tracelinks.yaml – Trace links CRUD
- files-diagrams.yaml – External docs (upload/delete), Storage public URL, Diagrams CRUD
- chat.yaml – Agent Chat (sessions/messages/stream)
- workflows.yaml – Workflows CRUD + runs

Generate Server Controller Stubs (NSwag)

The examples below generate ASP.NET Core controller stubs per spec file. Run each to create controllers you can fill in.

1. Install NSwag CLI

- dotnet tool install --global NSwag.ConsoleCore

2. Use the template nswag.server.json (update input & output as needed)

- See docs/openapi/nswag.server.json
- Example (auth):
  nswag run /variables:Input=docs/openapi/auth.yaml;Output=../server/App.Api/Generated/Auth

3. Repeat for each YAML (organizations, projects, etc.)

Generate Typed C# Clients (optional)

Use openApiToCSharpClient to generate strongly-typed API clients for integration tests or service-to-service calls.

- See docs/openapi/nswag.client.json
- Example:
  nswag run docs/openapi/nswag.client.json /variables:Input=docs/openapi/projects.yaml;Output=../server/App.Clients/Generated/ProjectsClient.cs;Namespace=App.Clients

Swashbuckle

If you prefer code-first, you can implement controllers and annotate them with attributes; Swashbuckle will emit OpenAPI at /swagger/v1/swagger.json. You can then generate clients from that single combined spec.

Combining Specs

Most generators take a single OpenAPI document. You can:

- Run NSwag per file (recommended per-domain generation), or
- Concatenate/merge YAMLs with a tool (e.g., openapi-merge-cli) if you want a single combined spec for client generation.

Suggested Namespaces & Output

- Server controllers: App.Api.Controllers.{Domain}
- DTOs/Models: App.Contracts.{Domain}
- Clients: App.Clients.{Domain}

Security & Policies

- Add JWT bearer auth to all controllers; decorate with [Authorize] and policy/role requirements.
- Tie resource access to Organization/Project membership via custom authorization handlers.

Realtime & Background

- Replace Supabase realtime with SignalR hubs (e.g., /hubs/documents, /hubs/requirements) and publish events on creates/updates/deletes.
- Use Hangfire/MassTransit for background jobs (e.g., workflow runs, async file processing).

Tip for Incremental Delivery

- Stand up core domains first (auth, orgs, projects, documents/blocks/columns, requirements), point the frontend atoms-api adapters to the new endpoints, then continue with properties/testing/trace/workflows.
