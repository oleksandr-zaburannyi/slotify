export type IFetcher = ([query, variables]: [string, any]) => Promise<any>;
