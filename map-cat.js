const { chromium } = require('playwright');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os');
const osUtils = require('os-utils'); const axios = require('axios'); const { config, console_color, Advanced_options } = require(`./config.js`);
function readFile(filePath) {
    const fileContent = XLSX.readFile(filePath);     const name = fileContent.SheetNames[0];     const sheet = fileContent.Sheets[name];     const jsonData = XLSX.utils.sheet_to_json(sheet); 
        const cleanedData = jsonData.map(item => {
                const cleanedItem = {};
        for (const [key, value] of Object.entries(item)) {
                        
            cleanedItem[key.trim()] = value;
        }
        return cleanedItem;
    });

    return cleanedData;
}

async function clickSearchButton(page) {
        const selector = `${Advanced_options.searchBtn_id}`;     await page.waitForSelector(selector);     await page.click(selector);     await page.waitForTimeout(300); }

async function searchAddress(page, address) {
    const searchInputSelector = `${Advanced_options.searchInput_id}`;     await page.waitForSelector(searchInputSelector);     await page.fill(searchInputSelector, address);     await clickSearchButton(page);     await page.waitForTimeout(config.wait_time); }

async function hideElement(page) {
    if (map_type == "baidu") {
        await page.evaluate(() => {
            const element = document.querySelector('#cards-level1');
            if (element) {
                                element.remove();
            }
        });
    } else if (map_type == "amap") {
        await page.evaluate(() => {
            const login_window = document.querySelector('.mask--jss-0-16');
            const element = document.querySelector('.serp-box-con');
            const app_download_panel = document.querySelector('.app-download-panel');
            if (login_window) {
                                login_window.remove();
            }
            if (element) {
                                element.remove();
            }
            if (app_download_panel) {
                                app_download_panel.remove();
            }
        });
    }
}

async function captureMapScreenshot(page, searchQuery, folderPath, fileName) {
    try {
        const uuid = genUUID();
        let retries = 0;
        let screenshotFolderPath = folderPath;

        while (retries < config.retry_times) {
                        await hideElement(page);

                        const isBMapNoprintVisible = await isElementVisible(page, '.BMap_noprint');
            const viewportSize = await page.viewportSize();

            if (isBMapNoprintVisible) {
                console.log(`.BMap_noprint is visible for ${searchQuery}`);
                break;
            }

                        console.log(`尝试第 ${retries + 1} 次缩放和重新搜索...`);

                        await clickElement(page, `${Advanced_options.map_outOrin_father_id} ${Advanced_options.map_out_class}`);             await page.waitForTimeout(config.map_options.mapOut_timeonce);             await clickElement(page, `${Advanced_options.map_outOrin_father_id} ${Advanced_options.map_out_class}`);             await page.waitForTimeout(config.map_options.mapOut_timetwice);             await clickElement(page, `${Advanced_options.map_outOrin_father_id} ${Advanced_options.map_in_class}`);             await page.waitForTimeout(config.map_options.mapIn_timeonce); 

                        await clickSearchButton(page);
            console.log("等待页面更新...");
            await page.waitForTimeout(config.map_options.search_wait_time);             retries++;
        }

                if (retries >= config.retry_times) {
            screenshotFolderPath = path.join(folderPath, `${config.invisible_BMap_noprint}`);
        }

                if (!fs.existsSync(screenshotFolderPath)) {
            fs.mkdirSync(screenshotFolderPath, { recursive: true });
        }

                const clip = config.browser_options.clip_;

                await dragElementToCenter(page);

                await page.screenshot({ path: path.join(screenshotFolderPath, `${uuid}.png`), clip });
        console.log(`Screenshot saved for ${searchQuery} as ${uuid}.png`);

                const txtFileName = config.txt_;         const filePath = path.join(screenshotFolderPath, txtFileName);
        const currentUrl = await page.url();         const content = `${uuid}\t${fileName}\t${currentUrl}\n`;         fs.appendFileSync(filePath, content, 'utf-8');         console.log(`Text file with UUID, filename, and URL appended for ${searchQuery} as ${txtFileName}`);

                const excelFilePath = path.join(folderPath, config.excel_);

        let workbook;
        if (!fs.existsSync(excelFilePath)) {
            workbook = XLSX.utils.book_new();         } else {
            workbook = XLSX.readFile(excelFilePath);         }

        const sheetName = config.sheetName;

                let worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
            worksheet = XLSX.utils.json_to_sheet([]);             workbook.Sheets[sheetName] = worksheet;             workbook.SheetNames.push(sheetName);         }

                const newRow = [uuid, fileName, currentUrl];

                XLSX.utils.sheet_add_aoa(worksheet, [newRow], { origin: -1 });

                XLSX.writeFile(workbook, excelFilePath);

    } catch (error) {
        console.error(console_color.red, `Error capturing screenshot for ${searchQuery}:`, error.message, console_color.white);
    }
}

async function clickElement(page, selector) {
    try {
        const element = await page.$(selector);
        if (element) {
            await element.click();
        } else {
            console.error(console_color.red, `Element not found: ${selector}`, console_color.white);
        }
    } catch (error) {
        console.error(console_color.red, `Error clicking element ${selector}:`, error.message, console_color.white);
    }
}

async function isElementVisible(page, selector) {
    const element = await page.$(selector);
    if (!element) return false;

    const box = await element.boundingBox();
    const viewportSize = await page.viewportSize();

    return box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= viewportSize.width &&
        box.y + box.height <= viewportSize.height;
}

async function dragElementToCenter(page) {
        const noprintElements = await page.$$(`${Advanced_options.map_print_class}`);
    if (noprintElements.length > 0) {
        const element = noprintElements[0];

                const isVisible = await isElementVisible(page, `${Advanced_options.map_print_class}`);
        if (!isVisible) {
            console.log("标点不可见，无法调整");
            return;
        }

                const box = await element.boundingBox();
        if (box) {
                        const viewportSize = await page.viewportSize();

                        const centerX = viewportSize.width / 2;
            const centerY = viewportSize.height / 2;

                        let offsetX, offsetY;

                        if (box.y < 200) {
                offsetX = box.x + box.width;
                offsetY = box.y + box.height / 2 + 100;
            } else if (viewportSize.height - box.y - box.height < 200) {
                offsetX = box.x + box.width;
                offsetY = box.y + box.height / 2 - 100;
            } else {
                                if (viewportSize.width - box.x - box.width < 100) {
                                        offsetX = box.x - 30;
                } else {
                                        offsetX = box.x + box.width + 30;
                }
                offsetY = box.y + box.height / 2;             }

                        await page.mouse.move(offsetX, offsetY);
            await page.mouse.down();
            console.log("鼠标按下");
            await page.waitForTimeout(1000); 
                        if (box.y < 200) {
                await page.mouse.move((centerX - 100), (centerY + 100));
            } else if (viewportSize.height - box.y - box.height < 200) {
                await page.mouse.move((centerX - 100), (centerY - 100));
            } else {
                                if (viewportSize.width - box.x - box.width < 100) {
                                        await page.mouse.move((centerX - 100), (centerY - 50));
                } else {
                                        await page.mouse.move((centerX - 100), (centerY - 50));
                }
                offsetY = box.y + box.height / 2;             }

            console.log("开始移动");
            await page.waitForTimeout(1000); 
                        await page.mouse.up();
        }
    }
}
function genUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0,
            v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
async function main() {
    const excelFilePath = config.excel_url;
    const data = readFile(excelFilePath);

    console.log("开始读取Excel文件");

    if (data.length === 0) {
        console.error('Excel 文件中没有数据。请检查文件内容和格式。');
        return;
    }
        const browser = await chromium.launch({
        headless: false,             });

    const context = await browser.newContext();
    const page = await context.newPage();

        const folderPath = path.join(config.screenshots_url);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
    console.log(`Folder created at: ${folderPath}`);

    const map_url = config.map_url;
    await page.goto(map_url, { waitUntil: 'networkidle' });
    
    for (const item of data) {
                const fileNameKey = Object.entries(item).slice(-1)[0][0];         const searchQuery = item[fileNameKey];
        console.log(`截图( ${data.indexOf(item) + 1}` + "/" + `${data.length} )`);
        console.log(`Address to search: ${searchQuery}`);
                await searchAddress(page, searchQuery);

                await captureMapScreenshot(page, searchQuery, folderPath, searchQuery);
    }

    await browser.close();
    MAKOTO_SIGN();
    console.log(`\n感谢使用自动截图系统，正在为您结束程序\n`);

}

async function MAKOTO_SIGN() {
    console.log(console_color.red, String.raw`  __  __          _____  ` + console_color.blue, String.raw`     ` + console_color.green, String.raw`  _____       _______ `);
    console.log(console_color.red, String.raw` |  \/  |   /\   |  __ \ ` + console_color.blue, String.raw`     ` + console_color.green, String.raw` / ____|   /\|__   __|`);
    console.log(console_color.red, String.raw` | \  / |  /  \  | |__) |` + console_color.blue, String.raw`_____` + console_color.green, String.raw`| |       /  \  | |   `);
    console.log(console_color.red, String.raw` | |\/| | / /\ \ |  ___/ ` + console_color.blue, String.raw`_____` + console_color.green, String.raw`| |      / /\ \ | |   `);
    console.log(console_color.red, String.raw` | |  | |/ ____ \| |     ` + console_color.blue, String.raw`     ` + console_color.green, String.raw`| |____ / ____ \| |   `);
    console.log(console_color.red, String.raw` |_|  |_/_/    \_\_|     ` + console_color.blue, String.raw`     ` + console_color.green, String.raw` \_____/_/    \_\_|   `, console_color.white);
}

async function MAKOTO_DETECT(page) {
    MAKOTO_SIGN();
    console.log(`\n欢迎使用自动截图系统。\n`);
    if (config.checkSystem) { await checkNetworkAndSystemResources(); }
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log(`正在检测您的配置文件……`);
    await new Promise(resolve => setTimeout(resolve, 200));
    if (config == undefined) {
        console.log(console_color.red, `您的配置文件不存在`, console_color.white);
        return;
    }
    console.log(console_color.green, `配置文件检测通过`, console_color.white);
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log(`正在检测您的Excel文件……`);
    await new Promise(resolve => setTimeout(resolve, 200));
    if (!fs.existsSync(config.excel_url)) {
        console.log(console_color.red, `您的Excel文件不存在`, console_color.white);
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log(`正在为您退出……`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log(console_color.green, `Excel文件检测通过`, console_color.white);
        const startTime = Date.now();

        await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`自动截取倒计时3:00`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`自动截取倒计时2:00`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`自动截取倒计时1:00`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`开始截取`);

        await main();

        const endTime = Date.now();

        console.log(`执行完毕，耗时: ${(endTime - startTime) / 1000} 秒`);
}
async function checkNetworkAndSystemResources() {
    try {
        console.log(console_color.green, `正在检测系统资源...`, console_color.white);

                const networkLatency = await getNetworkLatency();

                const downloadSpeed = await getDownloadSpeed();

                const memoryInfo = os.totalmem() - os.freemem();
        const totalMemory = os.totalmem();

                const cpuUsage = await getCpuUsage();

                const network_color = (networkLatency.toFixed(2)) > 500 ? console_color.red : ((networkLatency.toFixed(2)) > 150 ? console_color.yellow : console_color.green);
        const download_color = (downloadSpeed.toFixed(2)) < 10 ? console_color.red : ((downloadSpeed.toFixed(2)) < 30 ? console_color.yellow : console_color.green);
        const memory_color = (memoryInfo / totalMemory * 100).toFixed(2) > 90 ? console_color.red : ((memoryInfo / totalMemory * 100).toFixed(2) > 70 ? console_color.yellow : console_color.green);
        const cpu_color = (cpuUsage.toFixed(2)) > 90 ? console_color.red : ((cpuUsage.toFixed(2)) > 0 ? console_color.yellow : console_color.green);
        console.log('╔═════════════╦════════════════════╗');
        console.log(`║`, console_color.blue, `网络延迟:`, console_color.white, `║`, network_color, `${networkLatency.toFixed(2)} ms      `, console_color.white, `  `);
        console.log('╠═════════════╬════════════════════╣');
        console.log(`║`, console_color.blue, `下载速度:`, console_color.white, `║`, download_color, `${downloadSpeed.toFixed(2)} Mbps    `, console_color.white, `  `);
        console.log('╠═════════════╬════════════════════╣');
        console.log(`║`, console_color.blue, `内存剩余:`, console_color.white, `║`, memory_color, `${((totalMemory - memoryInfo) / (1024 * 1024 * 1024)).toFixed(2)} GB/${(totalMemory / (1024 * 1024 * 1024)).toFixed(2)} GB`, console_color.white, ``);
        console.log('╠═════════════╬════════════════════╣');
        console.log(`║`, console_color.blue, `CPU 占用:`, console_color.white, `║`, cpu_color, `${cpuUsage.toFixed(2)}%         `, console_color.white, `  `);
        console.log('╚═════════════╩════════════════════╝');
        if (networkLatency.toFixed(2) > 3000 || downloadSpeed.toFixed(2) < 10 || (memoryInfo / totalMemory * 100).toFixed(2) > 95 || (cpuUsage.toFixed(2)) > 95) {
            console.log(console_color.red, `您的系统资源不足，请检查您的网络连接、下载速度、内存剩余和 CPU 占用情况。`, console_color.white);
            process.exit(1);
        } else if (networkLatency.toFixed(2) > 1000 || downloadSpeed.toFixed(2) < 20 || (memoryInfo / totalMemory * 100).toFixed(2) > 90 || (cpuUsage.toFixed(2)) > 80) {
            console.log(console_color.yellow, `系统资源占用较高，运行程序可能会出现一些问题。`, console_color.white);
            console.log("按下ESC 键退出程序");
            await new Promise(resolve => setTimeout(resolve, 1000));

        } else {
            console.log(console_color.green, `您的系统资源充足，可以继续运行程序。`, console_color.white);
        }
    } catch (error) {
        console.log(console_color.red, `检测失败:`, console_color.white, error.message);
        process.exit(1);
    }
}

async function getNetworkLatency() {
    const url = config.NetworkLatency_url;
    const start = Date.now();
    try {
        const response = await axios.head(url);
        if (!response.status >= 200 && response.status < 300) {
            throw new Error('Failed to fetch the URL');
        }
    } catch (error) {
        console.log(console_color.red, `网络延迟检测失败:`, console_color.white, error.message);
        throw error;
    }
    const end = Date.now();
    return (end - start) / 5;
}

async function getDownloadSpeed() {
    const testFileUrl = config.DownloadSpeed_url;
    const start = Date.now();

    try {
        const response = await axios({
            url: testFileUrl,
            method: 'GET',
            httpsAgent: new (require('https')).Agent({ rejectUnauthorized: false }),             responseType: 'arraybuffer'
        });

        const fileSize = response.data.byteLength;
        const end = Date.now();
        const timeTaken = Math.max(end - start, 1);         const speedMbps = ((fileSize * 8) / (timeTaken * 10000)) / (1 / 8);         return speedMbps;
    } catch (error) {
        console.log(console_color.red, `下载速度检测失败:`, console_color.white, error.message);
        throw error;
    }
}

async function getCpuUsage() {
    return new Promise((resolve, reject) => {
        osUtils.cpuUsage(function (v) {
            if (v === null) {
                reject(new Error('Failed to get CPU usage'));
            } else {
                resolve(v * 100);
            }
        });
    });
}
module.exports = {
    MAKOTO_DETECT: MAKOTO_DETECT
};