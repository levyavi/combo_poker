declare module "@appdeploy/client" {
  export const api: {
    get(url: string, options?: { headers?: Record<string, string> }): Promise<Response>;
    post(url: string, body?: Record<string, unknown> | { body?: string; headers?: Record<string, string> }): Promise<Response>;
    put(url: string, body?: Record<string, unknown> | { body?: string; headers?: Record<string, string> }): Promise<Response>;
  };
}
