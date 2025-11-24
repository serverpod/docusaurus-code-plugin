import { IncludeOptions } from './transform';
declare const plugin: (options: IncludeOptions) => (tree: any, file?: {
    path?: string | undefined;
    history?: string[] | undefined;
} | undefined) => Promise<void>;
export = plugin;
