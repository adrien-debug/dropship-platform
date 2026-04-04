export class CoolifyClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl?: string, token?: string) {
    this.baseUrl = baseUrl || process.env.COOLIFY_URL || 'http://100.110.74.114:8000';
    this.token = token || process.env.COOLIFY_API_TOKEN || '';
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api/v1${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Coolify API error ${res.status}: ${text}`);
    }
    return res.json() as T;
  }

  async listProjects() {
    return this.request<unknown[]>('GET', '/projects');
  }

  async createProject(name: string) {
    return this.request<{ uuid: string }>('POST', '/projects', { name });
  }

  async createApplication(projectUuid: string, opts: {
    name: string;
    gitRepository?: string;
    dockerImage?: string;
    buildPack?: string;
    envVars?: Record<string, string>;
  }) {
    return this.request<{ uuid: string }>('POST', `/projects/${projectUuid}/applications`, {
      name: opts.name,
      git_repository: opts.gitRepository,
      docker_image: opts.dockerImage,
      build_pack: opts.buildPack || 'dockerfile',
    });
  }

  async setEnvVars(appUuid: string, vars: Record<string, string>) {
    const promises = Object.entries(vars).map(([key, value]) =>
      this.request('POST', `/applications/${appUuid}/envs`, { key, value, is_build_time: false })
    );
    return Promise.all(promises);
  }

  async deploy(appUuid: string) {
    return this.request<{ deployment_uuid: string }>('POST', `/applications/${appUuid}/deploy`);
  }

  async getDeploymentStatus(appUuid: string, deploymentUuid: string) {
    return this.request<{ status: string }>('GET', `/applications/${appUuid}/deployments/${deploymentUuid}`);
  }

  async setDomain(appUuid: string, domain: string) {
    return this.request('PATCH', `/applications/${appUuid}`, { fqdn: `https://${domain}` });
  }
}
