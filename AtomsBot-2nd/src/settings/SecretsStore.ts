import { PrismaClient } from '@prisma/client';

// Lightweight SecretsStore: stores secrets in DB. Designed to be swappable with keytar later.
export class SecretsStore {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  async get(key: string): Promise<string | undefined> {
    try {
      const row = await this.prisma.secret.findUnique({ where: { key } });
      return row?.value || undefined;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: string): Promise<void> {
    await this.prisma.secret.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== undefined;
  }

  async list(): Promise<string[]> {
    const rows = await this.prisma.secret.findMany({ select: { key: true } });
    return rows.map((r) => r.key);
  }
}

export const secretsStore = new SecretsStore();

