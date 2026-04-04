import { CoolifyClient } from './coolify-client';

export class SiteDeployer {
  private coolify: CoolifyClient;

  constructor(coolify?: CoolifyClient) {
    this.coolify = coolify || new CoolifyClient();
  }

  async deploySite(opts: {
    siteId: string;
    siteName: string;
    siteSlug: string;
    domain?: string;
    medusaBackendUrl: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
    gitRepo?: string;
  }) {
    const project = await this.coolify.createProject(`site-${opts.siteSlug}`);
    
    const app = await this.coolify.createApplication(project.uuid, {
      name: opts.siteName,
      gitRepository: opts.gitRepo,
      buildPack: 'dockerfile',
    });

    await this.coolify.setEnvVars(app.uuid, {
      SITE_ID: opts.siteId,
      SITE_SLUG: opts.siteSlug,
      NEXT_PUBLIC_SITE_NAME: opts.siteName,
      MEDUSA_BACKEND_URL: opts.medusaBackendUrl,
      NEXT_PUBLIC_SUPABASE_URL: opts.supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: opts.supabaseAnonKey,
    });

    if (opts.domain) {
      await this.coolify.setDomain(app.uuid, opts.domain);
    }

    const deployment = await this.coolify.deploy(app.uuid);
    return { appUuid: app.uuid, deploymentUuid: deployment.deployment_uuid };
  }
}
