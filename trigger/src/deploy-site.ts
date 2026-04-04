import { task, logger } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import { SiteDeployer } from '@dropship/deploy';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export const deploySite = task({
  id: 'deploy-site',
  maxDuration: 300,
  run: async (payload: { siteId: string }) => {
    const { siteId } = payload;
    logger.info('Deploying site', { siteId });

    const { data: site } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .single();

    if (!site) throw new Error(`Site ${siteId} not found`);

    await supabase.from('sites').update({ status: 'deploying' }).eq('id', siteId);

    try {
      const deployer = new SiteDeployer();
      const result = await deployer.deploySite({
        siteId: site.id,
        siteName: site.name,
        siteSlug: site.slug,
        domain: site.domain,
        medusaBackendUrl: process.env.MEDUSA_BACKEND_URL!,
        supabaseUrl: process.env.SUPABASE_URL!,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
        gitRepo: process.env.STOREFRONT_GIT_REPO,
      });

      await supabase.from('sites').update({
        status: 'live',
        coolify_app_id: result.appUuid,
      }).eq('id', siteId);

      logger.info('Site deployed', { siteId, appUuid: result.appUuid });
      return result;

    } catch (error) {
      await supabase.from('sites').update({ status: 'draft' }).eq('id', siteId);
      throw error;
    }
  },
});
