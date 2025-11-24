declare type OptionString = string | undefined;
export interface IncludeOptions {
    marker: string;
}
export declare function extractParam(name: string, input: string): OptionString;
export declare const transform: (options: IncludeOptions) => (tree: any, file?: {
    path?: string | undefined;
    history?: string[] | undefined;
} | undefined) => Promise<void>;
export {};
