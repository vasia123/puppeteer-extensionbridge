import { Page } from 'puppeteer/lib/cjs/puppeteer/common/Page';
import { Browser } from 'puppeteer/lib/cjs/puppeteer/common/Browser';
import { BrowserLaunchArgumentOptions, LaunchOptions, PuppeteerNodeLaunchOptions } from 'puppeteer/lib/cjs/puppeteer/node/LaunchOptions';
declare type PuppeteerLaunchOptions = LaunchOptions & BrowserLaunchArgumentOptions & PuppeteerNodeLaunchOptions;
export interface BrowserExtensionBridge {
    extension: ExtensionBridge;
}
export interface PluginConfig {
    newtab?: string;
}
export interface BridgeResponse {
    value: any[];
    error?: Error;
}
export declare class ExtensionBridge {
    page?: Page;
    private exposedFunctionIndex;
    private exposedFunctionMap;
    private exposedFunctionPrefix;
    constructor(page?: Page);
    private sendMessage;
    getConfig(): Promise<any>;
    setConfig(obj: any): Promise<BridgeResponse>;
    send(endpoint: string, ...payload: any): Promise<BridgeResponse>;
    addListener(event: string, cb: (...args: any[]) => any): Promise<BridgeResponse>;
    removeListener(event: string, cb: (...args: any[]) => any): Promise<BridgeResponse>;
}
export declare class NullExtensionBridge extends ExtensionBridge {
    getConfig(): Promise<any>;
    setConfig(): Promise<{
        value: never[];
    }>;
    send(): Promise<{
        value: never[];
    }>;
    addListener(): Promise<{
        value: never[];
    }>;
    removeListener(): Promise<{
        value: never[];
    }>;
}
export declare function mergeLaunchOptions(options: PuppeteerLaunchOptions): PuppeteerLaunchOptions;
export declare function decorateBrowser(browser: Browser, config?: PluginConfig): Promise<Browser & BrowserExtensionBridge>;
export {};
