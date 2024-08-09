const { chromium } = require('playwright');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 读取Excel文件并返回JSON数据
function readFile(filePath) {
    const fileContent = XLSX.readFile(filePath); // 读取excel文件
    const name = fileContent.SheetNames[0]; // 获取excel第一张sheet的名字
    const sheet = fileContent.Sheets[name]; // 获取excel第一张sheet中的数据
    const jsonData = XLSX.utils.sheet_to_json(sheet); // 将数据转成 json 格式

    // 清理和标准化数据
    const cleanedData = jsonData.map(item => {
        // 清理和标准化每一项数据
        const cleanedItem = {};
        for (const [key, value] of Object.entries(item)) {
            // 去除前后空白字符
            cleanedItem[key.trim()] = value.trim();
        }
        return cleanedItem;
    });

    return cleanedData;
}

// 模拟点击搜索按钮
async function clickSearchButton(page) {
    // 这里假设搜索按钮有一个包含“search”字样的类名
    const selector = '#search-button'; // 你需要根据实际情况替换这个选择器
    await page.waitForSelector(selector); // 确保元素可见
    await page.click(selector); // 点击搜索按钮
    await page.waitForTimeout(300); // 等待一段时间确保页面更新
}

// 输入地址并搜索
async function searchAddress(page, address) {
    const searchInputSelector = '#sole-input'; // 搜索输入框的选择器
    await page.waitForSelector(searchInputSelector); // 等待输入框加载完成
    await page.fill(searchInputSelector, address); // 清空并输入地址
    await clickSearchButton(page); // 点击搜索按钮
    await page.waitForTimeout(5000); // 等待页面加载完成
}

// 隐藏 id 为 cards-level1 的元素
async function hideElement(page) {
    await page.evaluate(() => {
        const element = document.querySelector('#cards-level1');
        if (element) {
            // element.style.display = 'none';
            element.remove();
        }
    });
}

// 捕获地图截图
async function captureMapScreenshot(page, searchQuery, folderPath, fileName) {
    try {
        // 定义截图区域
        const clip = {
            x: 200,
            y: 120,
            width: 1000, // 宽度
            height: 500  // 高度
        };

        const uuid = genUUID();

        // 隐藏 id 为 cards-level1 的元素
        await hideElement(page);

        // 截图
        await page.screenshot({ path: path.join(folderPath, `${uuid}.png`), clip });
        console.log(`Screenshot saved for ${searchQuery} as ${uuid}.png`);

        // 创建同名文本文件，并写入UUID, filename, 当前URL, 和URL
        const txtFileName = `url.txt`; // 保证文件名与截图文件一致
        const filePath = path.join(folderPath, txtFileName);
        const currentUrl = await page.url(); // 获取当前页面的URL
        const content = `${uuid}\n${fileName}\n${currentUrl}\n\n`; // 每一项后面加换行符
        fs.appendFileSync(filePath, content, 'utf-8'); // 追加内容到文件
        console.log(`Text file with UUID, filename, and URL appended for ${searchQuery} as ${txtFileName}`);
    } catch (error) {
        console.error(`Error capturing screenshot for ${searchQuery}:`, error.message);
    }
}

function genUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0,
            v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// 主函数
async function main() {
    const excelFilePath = '数据.xlsx';
    const data = readFile(excelFilePath);

    console.log("开始读取");
    console.log(data);

    if (data.length === 0) {
        console.error('Excel 文件中没有数据。请检查文件内容和格式。');
        return;
    }

    const browser = await chromium.launch({ headless: false }); // 设置为非headless模式以查看浏览器
    const context = await browser.newContext();
    const page = await context.newPage();

    // 创建文件夹
    const folderPath = path.join('screenshots');
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
    console.log(`Folder created at: ${folderPath}`);

    // 访问百度地图主页
    await page.goto('https://map.baidu.com/', { waitUntil: 'networkidle' });

    for (const item of data) {
        // 获取地址（最后一条数据的键），并用作文件名
        const fileNameKey = Object.entries(item).slice(-1)[0][0]; // 获取最后一个键
        const searchQuery = item[fileNameKey];
        console.log(`Address to search: ${searchQuery}`);

        // 搜索地址
        await searchAddress(page, searchQuery);

        // 捕获地图截图
        await captureMapScreenshot(page, searchQuery, folderPath, searchQuery);
    }

    await browser.close();
}

main().catch(error => {
    console.error('An error occurred:', error);
});