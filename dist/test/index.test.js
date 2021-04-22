"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const puppeteer_1 = __importDefault(require("./puppeteer"));
const src_1 = require("../src");
const test_server_1 = require("@jsoverson/test-server");
describe('Extension Bridge', function () {
    let browser;
    let server;
    before(async () => {
        server = await test_server_1.start(__dirname, 'server_root');
    });
    after(async () => {
        await server.stop();
    });
    beforeEach(async () => {
        const vanillaBrowser = await puppeteer_1.default.launch(src_1.mergeLaunchOptions({ headless: false }));
        browser = await src_1.decorateBrowser(vanillaBrowser, { newtab: server.url(`newtab.html`) });
    });
    afterEach(async () => {
        await browser.close();
    });
    it('should execute arbitary commands', async function () {
        await browser.extension.send('chrome.storage.sync.set', { myKey: 'myValue' });
        const { value: [items], } = await browser.extension.send('chrome.storage.sync.get', ['myKey']);
        assert_1.default.equal(items.myKey, 'myValue');
    });
    it('should pass arbitary number of arguments', async function () {
        const [page] = await browser.pages();
        await page.goto(server.url('index.html'), {});
        const response = await browser.extension.send('chrome.tabs.query', { active: true });
        const [results] = response.value;
        const activeTab = results[0];
        const tabId = activeTab.id;
        const details = {
            code: `(function(){return "inpage" + "-result" }())`,
            matchAboutBlank: true,
        };
        const executeResponse = await browser.extension.send('chrome.tabs.executeScript', tabId, details);
        const [result] = executeResponse.value;
        assert_1.default.equal(result, 'inpage-result');
    });
    it('should receive arbitrary events', async function () {
        let receivedChange = false;
        await browser.extension.send('chrome.storage.sync.set', { myKey: 'myValue' });
        await browser.extension.addListener('chrome.storage.onChanged', (changes, areaName) => {
            receivedChange = true;
        });
        await browser.extension.send('chrome.storage.sync.set', { myKey: 'changedValue' });
        assert_1.default(receivedChange);
    });
    it('should set and receive configuration', async function () {
        await browser.extension.setConfig({ myKey: 'myVal' });
        const get = await browser.extension.getConfig();
        assert_1.default.equal(get.myKey, 'myVal');
    });
    it('should set and receive configuration', async function () {
        await browser.extension.setConfig({ myKey: 'myVal' });
        const get = await browser.extension.getConfig();
        assert_1.default.equal(get.myKey, 'myVal');
    });
    it('should remove event listeners', async function () {
        let eventFired = false;
        let cb = (changes, areaName) => {
            eventFired = true;
        };
        await browser.extension.addListener('chrome.storage.onChanged', cb);
        await browser.extension.removeListener('chrome.storage.onChanged', cb);
        await browser.extension.send('chrome.storage.sync.set', { myKey: 'changedValue' });
        assert_1.default(eventFired === false);
    });
});
//# sourceMappingURL=index.test.js.map