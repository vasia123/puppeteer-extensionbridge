"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decorateBrowser = exports.mergeLaunchOptions = exports.NullExtensionBridge = exports.ExtensionBridge = void 0;
const path_1 = __importDefault(require("path"));
const find_root_1 = __importDefault(require("find-root"));
const debug_1 = __importDefault(require("debug"));
const debug = debug_1.default('puppeteer:extensionbridge');
const extensionId = require(path_1.default.join(find_root_1.default(__dirname), 'extension', 'manifest.json')).key;
class ExtensionBridge {
    constructor(page) {
        this.exposedFunctionIndex = 0;
        this.exposedFunctionMap = new WeakMap();
        this.exposedFunctionPrefix = 'extensionBridge_';
        if (!page)
            debug('ExtensionBridge instantiated with invalid page object');
        else {
            this.page = page;
            page.on('console', async (consoleMessage) => {
                debug(consoleMessage.args());
            });
        }
    }
    async sendMessage(expression) {
        if (!this.page)
            throw new Error('puppeteer-extensionbridge does not have access to a valid Page object');
        const session = await this.page.target().createCDPSession();
        const context = await this.page.mainFrame().executionContext();
        try {
            const message = {
                expression: expression,
                // @ts-ignore I effing hate private fields.
                contextId: context._contextId,
                returnByValue: true,
                userGesture: true,
                awaitPromise: true,
                matchAboutBlank: true,
            };
            debug('sending message to extension %o', message);
            const rv = (await session.send('Runtime.evaluate', message));
            return rv.result.value;
        }
        catch (e) {
            debug('ExtensionBridge: send failed %o', e.message);
            throw e;
        }
    }
    getConfig() {
        debug(`extensionBridge.getConfig()`);
        return this.sendMessage(`bridge.getConfig()`).then((response) => response.value[0]);
    }
    setConfig(obj) {
        debug(`extensionBridge.setConfig({...})`);
        let json = '';
        try {
            json = JSON.stringify(obj);
        }
        catch (e) {
            console.log(`puppeteer-extensionbridge could not stringify payload for ${obj}.`);
            throw e;
        }
        return this.sendMessage(`bridge.setConfig(${json})`);
    }
    send(endpoint, ...payload) {
        debug(`extensionBridge.send(${endpoint}, ...)`);
        let json = '';
        try {
            json = JSON.stringify(payload);
        }
        catch (e) {
            console.log(`puppeteer-extensionbridge could not stringify payload ${payload}.`);
            throw e;
        }
        return this.sendMessage(`bridge.handle("${endpoint}", ${json})`);
    }
    async addListener(event, cb) {
        debug(`extensionBridge.addListener(${event}, ...)`);
        const fnName = this.exposedFunctionPrefix + this.exposedFunctionIndex++;
        this.exposedFunctionMap.set(cb, fnName);
        if (!this.page)
            throw new Error('puppeteer-extensionbridge does not have access to a valid Page object');
        await this.page.exposeFunction(fnName, cb);
        return this.sendMessage(`bridge.addListener("${event}", "${fnName}")`);
    }
    async removeListener(event, cb) {
        debug(`extensionBridge.addListener(${event}, ...)`);
        const fnName = this.exposedFunctionMap.get(cb);
        return this.sendMessage(`bridge.removeListener("${event}", "${fnName}")`);
    }
}
exports.ExtensionBridge = ExtensionBridge;
class NullExtensionBridge extends ExtensionBridge {
    async getConfig() { }
    async setConfig() {
        return { value: [] };
    }
    async send() {
        return { value: [] };
    }
    async addListener() {
        return { value: [] };
    }
    async removeListener() {
        return { value: [] };
    }
}
exports.NullExtensionBridge = NullExtensionBridge;
function mergeLaunchOptions(options) {
    const extensionPath = path_1.default.join(find_root_1.default(__dirname), 'extension');
    if (!('headless' in options) || options.headless) {
        // Throw on this, adding it magically causes confusion.
        throw new Error("puppeteer-extensionbridge has to run in GUI (non-headless) mode. Add `headless:false` puppeteer's launch options");
    }
    if (options.ignoreDefaultArgs) {
        if (Array.isArray(options.ignoreDefaultArgs)) {
            const ignoreArg_disableExtensions = options.ignoreDefaultArgs.includes('--disable-extensions');
            if (!ignoreArg_disableExtensions) {
                debug('Adding --disable-extensions to ignoreDefaultArgs');
                options.ignoreDefaultArgs.push('--disable-extensions');
            }
        }
    }
    else {
        debug('Setting ignoreDefaultArgs to ["--disable-extensions"]');
        options.ignoreDefaultArgs = [`--disable-extensions`];
    }
    if (options.args) {
        const loadExtensionIndex = options.args.findIndex((a) => a.startsWith('--load-extension'));
        if (loadExtensionIndex > -1) {
            debug(`Appending ${extensionPath} to --load-extension arg`);
            options.args[loadExtensionIndex] += `,${extensionPath}`;
        }
        else {
            debug(`Adding arg '--load-extension=${extensionPath}`);
            options.args.push(`--load-extension=${extensionPath}`);
        }
        const whitelistExtensionIndex = options.args.findIndex((a) => a.startsWith('--whitelisted-extension-id'));
        if (whitelistExtensionIndex > -1) {
            debug(`Appending extensionbridge id (${extensionId}) to --whitelisted-extension-id`);
            options.args[whitelistExtensionIndex] += `,${extensionId}`;
        }
        else {
            debug(`Adding arg --whitelisted-extension-id=${extensionId}`);
            options.args.push(`--whitelisted-extension-id=${extensionId}`);
        }
    }
    else {
        debug(`Adding args --whitelisted-extension-id=${extensionId} and --load-extension=${extensionPath}`);
        options.args = [`--load-extension=${extensionPath}`, `--whitelisted-extension-id=${extensionId}`];
    }
    return options;
}
exports.mergeLaunchOptions = mergeLaunchOptions;
async function decorateBrowser(browser, config) {
    debug(`waiting for extension's background page`);
    const extTarget = await browser.waitForTarget((t) => {
        // @ts-ignore
        return t.type() === 'background_page' && t._targetInfo.title === 'Puppeteer Extension Controller';
    });
    debug(`background page found, id: ${extTarget._targetId}`);
    const extPage = await extTarget.page();
    if (!extPage)
        throw new Error(`puppeteer-extensionbridge failed to find the extension's background page. If this happened during normal use, it is a bug and should be reported.`);
    const bridge = new ExtensionBridge(extPage);
    debug(`passed config: %o`, config);
    if (config) {
        await bridge.setConfig(config);
    }
    return Object.assign(browser, { extension: bridge });
}
exports.decorateBrowser = decorateBrowser;
//# sourceMappingURL=index.js.map