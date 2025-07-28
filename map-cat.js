const { chromium } = require('playwright');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os');
const osUtils = require('os-utils');
const axios = require('axios');
const { config, console_color, Advanced_options } = require('./config.js');

// 根据配置文件中的地图URL确定地图类型
const map_type = config.map_url.includes('baidu') ? 'baidu' :
    config.map_url.includes('amap') ? 'amap' : 'baidu';

function readFile(filePath) {
    try {
        const fileContent = XLSX.readFile(filePath);
        const name = fileContent.SheetNames[0];
        const sheet = fileContent.Sheets[name];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        const cleanedData = jsonData.map(item => {
            const cleanedItem = {};
            for (const [key, value] of Object.entries(item)) {
                cleanedItem[key.trim()] = value;
            }
            return cleanedItem;
        });

        return cleanedData;
    } catch (error) {
        console.error(console_color.red, `读取Excel文件失败: ${error.message}`, console_color.white);
        throw error;
    }
}

async function clickSearchButton(page) {
    try {
        const selector = Advanced_options.searchBtn_id;
        await page.waitForSelector(selector, { timeout: 10000 });
        await page.click(selector);
        await page.waitForTimeout(300);
    } catch (error) {
        console.error(console_color.red, `点击搜索按钮失败: ${error.message}`, console_color.white);
        throw error;
    }
}

async function searchAddress(page, address) {
    try {
        const searchInputSelector = Advanced_options.searchInput_id;
        await page.waitForSelector(searchInputSelector, { timeout: 10000 });
        await page.fill(searchInputSelector, address);
        await clickSearchButton(page);
        await page.waitForTimeout(config.wait_time);
    } catch (error) {
        console.error(console_color.red, `搜索地址失败: ${error.message}`, console_color.white);
        throw error;
    }
}

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

// 新增：等待地图标点加载的函数
async function waitForMapMarker(page, timeout = 15000) {
    try {
        await page.waitForSelector(Advanced_options.map_print_class, {
            timeout: timeout,
            state: 'visible'
        });

        // 额外等待确保标点完全加载
        await page.waitForTimeout(2000);

        // 验证标点是否真的可见
        const isVisible = await isElementVisible(page, Advanced_options.map_print_class);
        return isVisible;
    } catch (error) {
        console.log(console_color.yellow, `等待地图标点超时: ${error.message}`, console_color.white);
        return false;
    }
}

async function captureMapScreenshot(page, searchQuery, folderPath, fileName) {
    let screenshotFolderPath = folderPath;
    const uuid = genUUID();
    let success = false;

    try {
        let retries = 0;

        while (retries < config.retry_times) {
            await hideElement(page);

            // 等待地图标点加载
            const markerLoaded = await waitForMapMarker(page);

            if (markerLoaded) {
                const isBMapNoprintVisible = await isElementVisible(page, '.BMap_noprint');

                if (isBMapNoprintVisible) {
                    console.log(console_color.green, `.BMap_noprint is visible for ${searchQuery}`, console_color.white);
                    success = true;
                    break;
                }
            }

            console.log(`尝试第 ${retries + 1} 次缩放和重新搜索...`);

            // 地图缩小操作
            await clickElement(page, `${Advanced_options.map_outOrin_father_id} ${Advanced_options.map_out_class}`);
            await page.waitForTimeout(config.map_options.mapOut_timeonce);
            await clickElement(page, `${Advanced_options.map_outOrin_father_id} ${Advanced_options.map_out_class}`);
            await page.waitForTimeout(config.map_options.mapOut_timetwice);
            // 地图放大操作
            await clickElement(page, `${Advanced_options.map_outOrin_father_id} ${Advanced_options.map_in_class}`);
            await page.waitForTimeout(config.map_options.mapIn_timeonce);

            await clickSearchButton(page);
            console.log("等待页面更新...");
            await page.waitForTimeout(config.map_options.search_wait_time);
            retries++;
        }

        // 如果重试后仍然失败，将截图保存到失败文件夹
        if (!success) {
            console.log(console_color.yellow, `无法找到有效的地图标点，将保存到失败文件夹: ${searchQuery}`, console_color.white);
            screenshotFolderPath = path.join(folderPath, config.invisible_BMap_noprint);
        }

        if (!fs.existsSync(screenshotFolderPath)) {
            fs.mkdirSync(screenshotFolderPath, { recursive: true });
        }

        const clip = config.browser_options.clip_;

        // 尝试调整标点位置（如果存在的话）
        if (success) {
            await dragElementToCenter(page);
        }

        await page.screenshot({ path: path.join(screenshotFolderPath, `${uuid}.png`), clip });
        console.log(console_color.green, `Screenshot saved for ${searchQuery} as ${uuid}.png`, console_color.white);

        // 保存文本文件
        const txtFileName = config.txt_;
        const filePath = path.join(screenshotFolderPath, txtFileName);
        const currentUrl = await page.url();
        const content = `${uuid}\t${fileName}\t${currentUrl}\n`;
        fs.appendFileSync(filePath, content, 'utf-8');
        console.log(`Text file with UUID, filename, and URL appended for ${searchQuery} as ${txtFileName}`);

        // 保存到Excel
        await saveToExcel(folderPath, uuid, fileName, currentUrl);

    } catch (error) {
        console.error(console_color.red, `Error capturing screenshot for ${searchQuery}:`, error.message, console_color.white);

        // 错误情况下也要保存到失败文件夹
        try {
            screenshotFolderPath = path.join(folderPath, config.invisible_BMap_noprint);
            if (!fs.existsSync(screenshotFolderPath)) {
                fs.mkdirSync(screenshotFolderPath, { recursive: true });
            }

            // 尝试截图（即使有错误）
            const clip = config.browser_options.clip_;
            await page.screenshot({ path: path.join(screenshotFolderPath, `${uuid}.png`), clip });

            // 保存错误信息到文本文件
            const txtFileName = config.txt_;
            const filePath = path.join(screenshotFolderPath, txtFileName);
            const currentUrl = await page.url();
            const content = `${uuid}\t${fileName}\t${currentUrl}\t[ERROR: ${error.message}]\n`;
            fs.appendFileSync(filePath, content, 'utf-8');

            // 保存到Excel
            await saveToExcel(folderPath, uuid, fileName, currentUrl);

            console.log(console_color.yellow, `Error screenshot saved for ${searchQuery}`, console_color.white);
        } catch (saveError) {
            console.error(console_color.red, `Failed to save error screenshot: ${saveError.message}`, console_color.white);
        }
    }
}

// 新增：保存到Excel的独立函数
async function saveToExcel(folderPath, uuid, fileName, currentUrl) {
    try {
        const excelFilePath = path.join(folderPath, config.excel_);

        let workbook;
        if (!fs.existsSync(excelFilePath)) {
            workbook = XLSX.utils.book_new();
        } else {
            workbook = XLSX.readFile(excelFilePath);
        }

        const sheetName = config.sheetName;

        let worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
            worksheet = XLSX.utils.json_to_sheet([]);
            workbook.Sheets[sheetName] = worksheet;
            workbook.SheetNames.push(sheetName);
        }

        const newRow = [uuid, fileName, currentUrl];
        XLSX.utils.sheet_add_aoa(worksheet, [newRow], { origin: -1 });
        XLSX.writeFile(workbook, excelFilePath);
    } catch (error) {
        console.error(console_color.red, `保存Excel失败: ${error.message}`, console_color.white);
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
    try {
        const element = await page.$(selector);
        if (!element) return false;

        const box = await element.boundingBox();
        if (!box) return false;

        const viewportSize = await page.viewportSize();

        return box.x >= 0 &&
            box.y >= 0 &&
            box.x + box.width <= viewportSize.width &&
            box.y + box.height <= viewportSize.height;
    } catch (error) {
        console.error(console_color.red, `检查元素可见性失败: ${error.message}`, console_color.white);
        return false;
    }
}

async function dragElementToCenter(page) {
    try {
        const noprintElements = await page.$$(Advanced_options.map_print_class);
        if (noprintElements.length === 0) {
            console.log(console_color.yellow, "未找到地图标点元素", console_color.white);
            return;
        }

        const element = noprintElements[0];

        const isVisible = await isElementVisible(page, Advanced_options.map_print_class);
        if (!isVisible) {
            console.log(console_color.yellow, "标点不可见，无法调整", console_color.white);
            return;
        }

        const box = await element.boundingBox();
        if (!box) {
            console.log(console_color.yellow, "无法获取标点位置信息", console_color.white);
            return;
        }

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
            offsetY = box.y + box.height / 2;
        }

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
        }

        console.log("开始移动");
        await page.waitForTimeout(1000);
        await page.mouse.up();
        console.log(console_color.green, "标点位置调整完成", console_color.white);

    } catch (error) {
        console.error(console_color.red, `调整标点位置失败: ${error.message}`, console_color.white);
        // 不抛出错误，继续执行
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
        headless: false,
    });

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
        const fileNameKey = Object.entries(item).slice(-1)[0][0];
        const searchQuery = item[fileNameKey];
        console.log(`截图( ${data.indexOf(item) + 1}/${data.length} )`);
        console.log(`Address to search: ${searchQuery}`);

        try {
            await searchAddress(page, searchQuery);
            await captureMapScreenshot(page, searchQuery, folderPath, searchQuery);
        } catch (error) {
            console.error(console_color.red, `处理地址 ${searchQuery} 时发生错误: ${error.message}`, console_color.white);

            // 即使出错也要记录到失败文件夹
            try {
                const uuid = genUUID();
                const screenshotFolderPath = path.join(folderPath, config.invisible_BMap_noprint);
                if (!fs.existsSync(screenshotFolderPath)) {
                    fs.mkdirSync(screenshotFolderPath, { recursive: true });
                }

                // 尝试截图当前页面状态
                const clip = config.browser_options.clip_;
                await page.screenshot({ path: path.join(screenshotFolderPath, `${uuid}.png`), clip });

                // 保存错误信息
                const txtFileName = config.txt_;
                const filePath = path.join(screenshotFolderPath, txtFileName);
                const currentUrl = await page.url();
                const content = `${uuid}\t${searchQuery}\t${currentUrl}\t[CRITICAL ERROR: ${error.message}]\n`;
                fs.appendFileSync(filePath, content, 'utf-8');

                // 保存到Excel
                await saveToExcel(folderPath, uuid, searchQuery, currentUrl);

                console.log(console_color.yellow, `错误截图已保存: ${searchQuery}`, console_color.white);
            } catch (saveError) {
                console.error(console_color.red, `保存错误截图失败: ${saveError.message}`, console_color.white);
            }
        }
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

async function MAKOTO_DETECT() {
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
            httpsAgent: new (require('https')).Agent({ rejectUnauthorized: false }),
            responseType: 'arraybuffer'
        });

        const fileSize = response.data.byteLength;
        const end = Date.now();
        const timeTaken = Math.max(end - start, 1);
        const speedMbps = ((fileSize * 8) / (timeTaken * 10000)) / (1 / 8);
        return speedMbps;
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