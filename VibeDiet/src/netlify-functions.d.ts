declare module '@netlify/functions' {
  export interface Config {
    path?: string | string[];
    preferStatic?: boolean;
    rateLimit?: any;
    method?: string | string[];
    [key: string]: any;
  }
  export interface Context {
    [key: string]: any;
  }
}
