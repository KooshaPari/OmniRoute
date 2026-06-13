// Central services bridge so tests can vi.mock this single module
// and SUTs always resolve the same mocked singletons.

export async function getServices() {
  const dbMod: any = await import('./database/DatabaseService');
  const cacheMod: any = await import('./cache/redis');
  const natsMod: any = await import('./messaging/nats');
  return {
    databaseService: dbMod?.databaseService,
    cacheService: cacheMod?.cacheService,
    eventPublisher: natsMod?.eventPublisher,
    eventSubscriber: natsMod?.eventSubscriber,
    defaultExecutionTTL: 3600,
  } as const;
}

export async function getDatabase() {
  const s = await getServices();
  return s.databaseService;
}

export async function getCache() {
  const s = await getServices();
  return s.cacheService;
}

export async function getPublisher() {
  const s = await getServices();
  return s.eventPublisher;
}

export async function getSubscriber() {
  const s = await getServices();
  return s.eventSubscriber;
}

