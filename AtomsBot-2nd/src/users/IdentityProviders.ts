import { integrations } from "../env";
import { userDirectory } from "./UserDirectory";

export type IdentityProviderId = 'github' | 'jira' | 'linear' | 'coda' | 'atoms';

export interface IdentityProviderDef {
  id: IdentityProviderId;
  label: string;
  isEnabled?(): boolean; // optional; if omitted, treated as enabled
  fetchCandidates(query?: string): Promise<Array<{ label: string; value: string }>>;
}

export const identityProviders: IdentityProviderDef[] = [
  {
    id: 'github',
    label: 'GitHub',
    isEnabled: () => true,
    fetchCandidates: async () => {
      try {
        const list = await userDirectory.getGithubCandidates();
        return (list || []).map(i => ({ label: i.login, value: i.login }));
      } catch {
        return [];
      }
    }
  },
  {
    id: 'jira',
    label: 'Jira',
    // Show Jira selector even if not fully configured to allow manual mapping
    isEnabled: () => true,
    fetchCandidates: async (q?: string) => {
      try {
        const list = await userDirectory.getJiraCandidates(q || 'a');
        return (list || []).map(i => ({ label: i.label, value: i.key }));
      } catch {
        return [];
      }
    }
  },
  {
    id: 'linear',
    label: 'Linear',
    isEnabled: () => true,
    fetchCandidates: async (q?: string) => {
      try {
        const list = await userDirectory.getLinearCandidates(q || 'a');
        return (list || []).map(i => ({ label: i.label, value: i.id }));
      } catch {
        return [];
      }
    }
  },
  {
    id: 'coda',
    label: 'Coda',
    isEnabled: () => true,
    fetchCandidates: async (q?: string) => {
      try {
        const list = await userDirectory.getCodaCandidates(q || 'a');
        return (list || []).map(i => ({ label: i.label, value: i.id }));
      } catch {
        return [];
      }
    }
  },
  {
    id: 'atoms',
    label: 'Atoms',
    isEnabled: () => true,
    fetchCandidates: async (q?: string) => {
      try {
        const list = await userDirectory.getAtomsCandidates(q || 'a');
        return (list || []).map(i => ({ label: i.label, value: i.id }));
      } catch {
        return [];
      }
    }
  }
];
