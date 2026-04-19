import type { Router } from 'express';
import { registerLLMRoutes } from './admin-llm';
import { registerPlatformRoutes } from './admin-platforms';
import { registerChannelRoutes } from './admin-channels';
import { registerTemplateRoutes } from './admin-template';
import { registerHandoverRoutes } from './admin-handovers';
import { registerMonitoringRoutes } from './admin-monitoring';

export function registerAdminRoutes(router: Router): void {
  const prefix = '/api/admin';

  registerLLMRoutes(router, prefix);
  registerPlatformRoutes(router, prefix);
  registerChannelRoutes(router, prefix);
  registerTemplateRoutes(router, prefix);
  registerHandoverRoutes(router, prefix);
  registerMonitoringRoutes(router, prefix);
}