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
    try {
        const elementsToHide = Advanced_options.hide_elements[map_type] || [];

        if (elementsToHide.length > 0) {
            console.log(console_color.blue, `正在隐藏${map_type}地图的干扰元素...`, console_color.white);

            await page.evaluate((selectors) => {
                selectors.forEach(selector => {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(element => {
                        if (element) {
                            element.remove();
                            console.log(`已移除元素: ${selector}`);
                        }
                    });
                });
            }, elementsToHide);

            console.log(console_color.green, `成功隐藏${elementsToHide.length}个干扰元素`, console_color.white);
        }
    } catch (error) {
        console.error(console_color.red, `隐藏元素失败: ${error.message}`, console_color.white);
    }
}

// 等待地图标点加载的函数
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

// 获取当前缩放级别的函数
async function getCurrentScale(page) {
    try {
        const scaleText = await page.evaluate((selector) => {
            const scaleElement = document.querySelector(selector);
            return scaleElement ? scaleElement.innerText : null;
        }, Advanced_options.scale_text_selector);

        if (!scaleText) return null;

        let scaleValue = 0;
        if (scaleText.includes('公里') || scaleText.includes('km')) {
            const match = scaleText.match(/(\d+(?:\.\d+)?)/);
            if (match) {
                scaleValue = parseFloat(match[1]) * 1000;
            }
        } else if (scaleText.includes('米') || scaleText.includes('m')) {
            const match = scaleText.match(/(\d+(?:\.\d+)?)/);
            if (match) {
                scaleValue = parseFloat(match[1]);
            }
        }

        return scaleValue;
    } catch (error) {
        console.error(console_color.red, `获取缩放级别失败: ${error.message}`, console_color.white);
        return null;
    }
}

// 检查标点是否在安全位置
async function isMarkerInSafePosition(page) {
    try {
        const element = await page.$(Advanced_options.map_print_class);
        if (!element) return false;

        const box = await element.boundingBox();
        if (!box) return false;

        const viewportSize = await page.viewportSize();
        const safeMargin = 100; // 安全边距

        return box.x > safeMargin &&
            box.y > safeMargin &&
            box.x + box.width < viewportSize.width - safeMargin &&
            box.y + box.height < viewportSize.height - safeMargin;
    } catch (error) {
        return false;
    }
}

// 使用鼠标滚轮在标点位置进行缩放
async function zoomAtMarkerPosition(page, zoomIn = true) {
    try {
        if (!config.marker_options.marker_check_enabled) {
            console.log(console_color.yellow, '标点检测已禁用', console_color.white);
            return false;
        }

        const element = await page.$(Advanced_options.map_print_class);
        if (!element) {
            console.log(console_color.yellow, "未找到地图标点元素，无法在标点位置缩放", console_color.white);
            return false;
        }

        const box = await element.boundingBox();
        if (!box) {
            console.log(console_color.yellow, "无法获取标点位置信息", console_color.white);
            return false;
        }

        // 计算标点中心位置
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;

        console.log(console_color.blue, `在标点位置 (${centerX}, ${centerY}) 进行${zoomIn ? '放大' : '缩小'}`, console_color.white);

        // 移动鼠标到标点位置
        await page.mouse.move(centerX, centerY);
        await page.waitForTimeout(200);

        // 使用鼠标滚轮缩放（使用配置化参数）
        const scrollDelta = zoomIn ? -config.marker_options.mouse_wheel_zoom_delta : config.marker_options.mouse_wheel_zoom_delta;
        await page.mouse.wheel(0, scrollDelta);
        await page.waitForTimeout(config.marker_options.wheel_zoom_wait_time);

        console.log(console_color.green, `鼠标滚轮${zoomIn ? '放大' : '缩小'}操作完成`, console_color.white);
        return true;
    } catch (error) {
        console.error(console_color.red, `鼠标滚轮缩放失败: ${error.message}`, console_color.white);
        return false;
    }
}

// 智能缩放到目标范围
async function smartZoomToTarget(page) {
    try {
        let scaleValue = await getCurrentScale(page);
        if (scaleValue === null) return false;

        let adjustCount = 0;
        const maxAttempts = 15;

        while (adjustCount < maxAttempts) {
            // 每次缩放都要检测标点是否在视口内
            const markerExists = await page.$(Advanced_options.map_print_class);
            if (markerExists) {
                const isVisible = await isElementVisible(page, Advanced_options.map_print_class);
                if (isVisible) {
                    console.log(console_color.green, `标点已出现在视口内，进行地图拖拽实现`, console_color.white);
                    // 拖拽地图使标点到设定位置
                    await dragElementToCenter(page);

                    // 重新获取缩放级别，因为拖拽可能改变了视图
                    scaleValue = await getCurrentScale(page);
                    if (scaleValue === null) return true; // 如果无法获取缩放级别，认为操作成功

                    // 检查是否在目标范围内
                    if (scaleValue >= config.scale_options.min_scale_meters &&
                        scaleValue <= config.scale_options.max_scale_meters) {
                        console.log(console_color.green, `拖拽后缩放级别已在目标范围: ${scaleValue}米`, console_color.white);
                        return true;
                    }

                    // 如果还需要调整缩放，使用鼠标滚轮在标点位置缩放
                    if (scaleValue > config.scale_options.max_scale_meters) {
                        console.log(console_color.blue, `使用鼠标滚轮在标点位置放大`, console_color.white);
                        await zoomAtMarkerPosition(page, true);
                    } else if (scaleValue < config.scale_options.min_scale_meters) {
                        console.log(console_color.blue, `使用鼠标滚轮在标点位置缩小`, console_color.white);
                        await zoomAtMarkerPosition(page, false);
                    }

                    // 检查滚轮缩放后的效果
                    const newScaleValue = await getCurrentScale(page);
                    if (newScaleValue !== null && newScaleValue !== scaleValue) {
                        scaleValue = newScaleValue;
                        console.log(console_color.blue, `滚轮缩放后的缩放值: ${scaleValue}米`, console_color.white);

                        // 如果达到目标范围，返回成功
                        if (scaleValue >= config.scale_options.min_scale_meters &&
                            scaleValue <= config.scale_options.max_scale_meters) {
                            console.log(console_color.green, `滚轮缩放后达到目标范围: ${scaleValue}米`, console_color.white);
                            return true;
                        }
                    }

                    adjustCount++;
                    continue;
                }
            }

            // 检查是否在目标范围内
            if (scaleValue >= config.scale_options.min_scale_meters &&
                scaleValue <= config.scale_options.max_scale_meters) {
                console.log(console_color.green, `缩放级别已达到目标范围: ${scaleValue}米`, console_color.white);
                return true;
            }

            // 根据当前缩放级别决定放大还是缩小
            if (scaleValue > config.scale_options.max_scale_meters) {
                await clickElement(page, `${Advanced_options.map_outOrin_father_id} ${Advanced_options.map_in_class}`);
                console.log(console_color.blue, '执行放大操作', console_color.white);
            } else if (scaleValue < config.scale_options.min_scale_meters) {
                await clickElement(page, `${Advanced_options.map_outOrin_father_id} ${Advanced_options.map_out_class}`);
                console.log(console_color.blue, '执行缩小操作', console_color.white);
            }

            await page.waitForTimeout(config.scale_options.scale_adjust_timeout * 2); // 增加等待时间

            // 获取新的缩放级别
            const newScaleValue = await getCurrentScale(page);
            if (newScaleValue === null || newScaleValue === scaleValue) {
                console.log(console_color.yellow, '缩放级别无变化，停止调整', console_color.white);
                break;
            }

            scaleValue = newScaleValue;
            console.log(console_color.blue, `当前缩放值: ${scaleValue}米`, console_color.white);
            adjustCount++;
        }

        return scaleValue >= config.scale_options.min_scale_meters &&
            scaleValue <= config.scale_options.max_scale_meters;
    } catch (error) {
        console.error(console_color.red, `智能缩放失败: ${error.message}`, console_color.white);
        return false;
    }
}

// 修改：checkAndAdjustMapScale 函数
async function checkAndAdjustMapScale(page) {
    try {
        if (!config.scale_options.scale_detection_enabled) {
            console.log(console_color.yellow, '缩放级别检测已禁用', console_color.white);
            return;
        }

        // 检测恢复按钮并点击
        if (config.scale_options.restore_button_enabled) {
            const restoreButtons = await page.$$(Advanced_options.restore_button_selector);
            if (restoreButtons.length > Advanced_options.restore_button_index) {
                const restoreButton = restoreButtons[Advanced_options.restore_button_index];
                const title = await restoreButton.getAttribute('title');
                if (title === '恢复') {
                    console.log(console_color.yellow, '检测到恢复按钮，正在点击...', console_color.white);
                    await restoreButton.click();
                    await page.waitForTimeout(config.scale_options.restore_button_wait);
                }
            }
        }

        // 获取当前缩放级别
        let scaleValue = await getCurrentScale(page);
        if (scaleValue === null) {
            console.log(console_color.yellow, '无法获取地图缩放级别', console_color.white);
            return;
        }

        console.log(console_color.blue, `当前地图缩放级别: ${scaleValue}米`, console_color.white);

        // 根据当前缩放级别决定放大还是缩小（参照smartZoomToTarget函数的逻辑）
        let adjustCount = 0;
        while (adjustCount < config.scale_options.max_adjust_attempts) {
            // 每次缩放操作前后都检测标点是否在视口内
            const markerExists = await page.$(Advanced_options.map_print_class);
            if (markerExists) {
                const isVisible = await isElementVisible(page, Advanced_options.map_print_class);
                if (isVisible) {
                    console.log(console_color.green, `缩放过程中检测到标点在视口内，进行地图拖拽`, console_color.white);
                    await dragElementToCenter(page);

                    // 重新获取缩放级别
                    scaleValue = await getCurrentScale(page);
                    if (scaleValue === null) return;
                }
            }

            // 检查是否在目标范围内
            if (scaleValue >= config.scale_options.min_scale_meters &&
                scaleValue <= config.scale_options.max_scale_meters) {
                console.log(console_color.green, `缩放级别已在目标范围内: ${scaleValue}米`, console_color.white);
                break;
            }

            // 根据当前缩放级别决定放大还是缩小
            if (scaleValue > config.scale_options.max_scale_meters) {
                console.log(console_color.yellow, `地图缩放级别过大（${scaleValue}米 > ${config.scale_options.max_scale_meters}米），正在放大...`, console_color.white);
                await clickElement(page, `${Advanced_options.map_outOrin_father_id} ${Advanced_options.map_in_class}`);
                console.log(console_color.blue, '执行放大操作', console_color.white);
            } else if (scaleValue < config.scale_options.min_scale_meters) {
                console.log(console_color.yellow, `地图缩放级别过小（${scaleValue}米 < ${config.scale_options.min_scale_meters}米），正在缩小...`, console_color.white);
                await clickElement(page, `${Advanced_options.map_outOrin_father_id} ${Advanced_options.map_out_class}`);
                console.log(console_color.blue, '执行缩小操作', console_color.white);
            }

            await page.waitForTimeout(config.scale_options.scale_adjust_timeout * 2); // 增加等待时间

            // 缩放操作后再次检测标点
            const markerExistsAfter = await page.$(Advanced_options.map_print_class);
            if (markerExistsAfter) {
                const isVisibleAfter = await isElementVisible(page, Advanced_options.map_print_class);
                if (isVisibleAfter) {
                    console.log(console_color.green, `缩放后检测到标点在视口内，进行地图拖拽`, console_color.white);
                    await dragElementToCenter(page);
                }
            }

            // 获取新的缩放级别
            const newScaleValue = await getCurrentScale(page);
            if (newScaleValue === null || newScaleValue === scaleValue) {
                console.log(console_color.yellow, '缩放级别无变化，停止调整', console_color.white);
                break;
            }

            scaleValue = newScaleValue;
            console.log(console_color.blue, `调整后的缩放值: ${scaleValue}米`, console_color.white);
            adjustCount++;
        }

    } catch (error) {
        console.error(console_color.red, `调整地图缩放级别失败: ${error.message}`, console_color.white);
    }
}

// 修改：dragElementToCenter 函数名改为 adjustMarkerPosition
async function adjustMarkerPosition(page) {
    try {
        const element = await page.$(Advanced_options.map_print_class);
        if (!element) {
            console.log(console_color.yellow, "未找到地图标点元素", console_color.white);
            return false;
        }

        const box = await element.boundingBox();
        if (!box) {
            console.log(console_color.yellow, "无法获取标点位置信息", console_color.white);
            return false;
        }

        const viewportSize = await page.viewportSize();
        const targetX = viewportSize.width * 0.3; // 目标位置：左侧30%处
        const targetY = viewportSize.height * 0.4; // 目标位置：上方40%处

        // 计算拖拽起点和终点
        const startX = box.x + box.width / 2;
        const startY = box.y + box.height / 2;

        console.log(console_color.blue, `正在调整标点位置: (${startX}, ${startY}) -> (${targetX}, ${targetY})`, console_color.white);

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.waitForTimeout(500);
        await page.mouse.move(targetX, targetY, { steps: 10 });
        await page.waitForTimeout(500);
        await page.mouse.up();
        await page.waitForTimeout(1000);

        console.log(console_color.green, "标点位置调整完成", console_color.white);
        return true;
    } catch (error) {
        console.error(console_color.red, `调整标点位置失败: ${error.message}`, console_color.white);
        return false;
    }
}

// 修改：captureMapScreenshot 函数的主要逻辑部分
async function captureMapScreenshot(page, searchQuery, folderPath, fileName) {
    let screenshotFolderPath = folderPath;
    const uuid = genUUID();
    let success = false;

    try {
        let retries = 0;

        while (retries < config.retry_times) {
            await hideElement(page);

            // 初始缩放调整
            await checkAndAdjustMapScale(page);

            // 等待地图标点加载
            const markerLoaded = await waitForMapMarker(page);

            if (markerLoaded) {
                console.log(console_color.green, `找到地图标点，开始智能缩放调整...`, console_color.white);

                // 智能缩放到目标范围（内部会检查标点并调用拖拽）
                const scaleAdjusted = await smartZoomToTarget(page);

                if (scaleAdjusted) {
                    // 检查所有条件是否满足
                    const isMapPrintVisible = await isElementVisible(page, Advanced_options.map_print_class);
                    const isBMapNoprintVisible = await isElementVisible(page, '.BMap_noprint');

                    if (isMapPrintVisible && isBMapNoprintVisible) {
                        console.log(console_color.green, `所有条件满足，准备截图: ${searchQuery}`, console_color.white);
                        success = true;
                        break;
                    }
                }
            }

            console.log(`尝试第 ${retries + 1} 次检查标点...`);

            // 检查map_print_class是否出现在视口内
            const markerInViewport = await checkMarkerInViewport(page);
            if (markerInViewport) {
                console.log(console_color.green, `检测到标点在视口内，开始拖拽到设定位置`, console_color.white);

                // 隐藏干扰元素
                await hideElement(page);

                // 拖拽标点到截图区域中心
                await dragElementToCenter(page);

                // 检查标点是否在截图区域中心（允许误差）
                const isInCenter = await checkMarkerInScreenshotCenter(page);

                if (!isInCenter) {
                    console.log(console_color.yellow, `标点不在截图中心，尝试再次调整...`, console_color.white);
                    // 再次尝试拖拽
                    await dragElementToCenter(page);
                    await page.waitForTimeout(500);
                }

                // 检查条件是否满足
                const isMapPrintVisible = await isElementVisible(page, Advanced_options.map_print_class);
                const isBMapNoprintVisible = await isElementVisible(page, '.BMap_noprint');
                const finalCenterCheck = await checkMarkerInScreenshotCenter(page);

                if (isMapPrintVisible && isBMapNoprintVisible && finalCenterCheck) {
                    console.log(console_color.green, `标点已在截图中心，所有条件满足: ${searchQuery}`, console_color.white);
                    success = true;
                    break;
                } else if (isMapPrintVisible && isBMapNoprintVisible) {
                    console.log(console_color.yellow, `标点可见但不在中心，继续尝试: ${searchQuery}`, console_color.white);
                } else {
                    console.log(console_color.red, `标点或BMap_noprint不可见: ${searchQuery}`, console_color.white);
                }
            } else {
                // 如果标点不在视口内，重新搜索
                console.log(console_color.yellow, `标点不在视口内，重新搜索...`, console_color.white);
                await clickSearchButton(page);
                console.log("等待页面更新...");
                await page.waitForTimeout(config.map_options.search_wait_time);
            }

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

        // 截图前对map_print_class进行矫正（无论success状态如何都要检查）
        console.log(console_color.blue, `截图前进行标点位置检查和矫正...`, console_color.white);

        // 隐藏干扰元素
        await hideElement(page);

        // 检查标点是否存在并可见
        const markerExists = await page.$(Advanced_options.map_print_class);
        if (markerExists) {
            const isVisible = await isElementVisible(page, Advanced_options.map_print_class);
            if (isVisible) {
                console.log(console_color.green, `检测到标点，进行位置矫正...`, console_color.white);

                // 矫正标点位置到截图中心
                await dragElementToCenter(page);

                // 验证标点是否在截图中心
                const isInCenter = await checkMarkerInScreenshotCenter(page);
                if (!isInCenter) {
                    console.log(console_color.yellow, `标点不在截图中心，再次矫正...`, console_color.white);
                    await dragElementToCenter(page);
                    await page.waitForTimeout(500);

                    // 最终验证
                    const finalCheck = await checkMarkerInScreenshotCenter(page);
                    if (finalCheck) {
                        console.log(console_color.green, `标点位置矫正成功`, console_color.white);
                    } else {
                        console.log(console_color.yellow, `标点位置矫正后仍不在中心，但继续截图`, console_color.white);
                    }
                }

                console.log(console_color.green, `标点位置矫正完成，准备截图`, console_color.white);
            } else {
                console.log(console_color.yellow, `标点存在但不可见，直接截图`, console_color.white);
            }
        } else {
            console.log(console_color.yellow, `未检测到标点，直接截图`, console_color.white);
        }

        // 设置截图超时
        await page.screenshot({
            path: path.join(screenshotFolderPath, `${uuid}.png`),
            clip,
            timeout: 10000 // 10秒超时
        });
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

        // 返回成功状态
        return success;

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
            await page.screenshot({
                path: path.join(screenshotFolderPath, `${uuid}.png`),
                clip,
                timeout: 5000 // 5秒超时
            });

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

        // 错误情况返回false
        return false;
    }
}



// 保存到Excel的独立函数
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
        console.log(console_color.blue, `尝试点击元素: ${selector}`, console_color.white);
        const element = await page.$(selector);
        if (element) {
            await element.click();
            console.log(console_color.green, `成功点击元素: ${selector}`, console_color.white);
        } else {
            console.error(console_color.red, `Element not found: ${selector}`, console_color.white);
            // 尝试查找父元素和子元素
            const [fatherSelector, childSelector] = selector.split(' ');
            console.log(console_color.yellow, `尝试分别查找父元素: ${fatherSelector} 和子元素: ${childSelector}`, console_color.white);

            const fatherElement = await page.$(fatherSelector);
            if (fatherElement) {
                console.log(console_color.green, `找到父元素: ${fatherSelector}`, console_color.white);
                const childElement = await fatherElement.$(childSelector);
                if (childElement) {
                    console.log(console_color.green, `找到子元素: ${childSelector}`, console_color.white);
                    await childElement.click();
                    console.log(console_color.green, `成功点击子元素: ${childSelector}`, console_color.white);
                } else {
                    console.error(console_color.red, `子元素未找到: ${childSelector}`, console_color.white);
                }
            } else {
                console.error(console_color.red, `父元素未找到: ${fatherSelector}`, console_color.white);
            }
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
        const margin = config.marker_options.visibility_margin || 30;

        // 计算元素中心点
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;

        // 检查元素是否在视口内（考虑边距）
        const isInViewport = box.x >= -box.width / 2 &&
            box.y >= -box.height / 2 &&
            box.x + box.width <= viewportSize.width + box.width / 2 &&
            box.y + box.height <= viewportSize.height + box.height / 2;

        // 检查元素是否接近边框
        const nearLeftEdge = box.x < margin;
        const nearRightEdge = box.x + box.width > viewportSize.width - margin;
        const nearTopEdge = box.y < margin;
        const nearBottomEdge = box.y + box.height > viewportSize.height - margin;
        const nearEdge = nearLeftEdge || nearRightEdge || nearTopEdge || nearBottomEdge;

        if (isInViewport) {
            if (nearEdge) {
                console.log(console_color.yellow, `标点在视口内但接近边框: 位置(${centerX}, ${centerY})`, console_color.white);
                if (nearLeftEdge) console.log(console_color.yellow, `接近左边框`, console_color.white);
                if (nearRightEdge) console.log(console_color.yellow, `接近右边框`, console_color.white);
                if (nearTopEdge) console.log(console_color.yellow, `接近上边框`, console_color.white);
                if (nearBottomEdge) console.log(console_color.yellow, `接近下边框`, console_color.white);
            } else {
                console.log(console_color.green, `标点在视口内且位置良好: 位置(${centerX}, ${centerY})`, console_color.white);
            }
            return true;
        } else {
            console.log(console_color.red, `标点不在视口内: 位置(${centerX}, ${centerY})`, console_color.white);
            return false;
        }
    } catch (error) {
        console.error(console_color.red, `检查元素可见性失败: ${error.message}`, console_color.white);
        return false;
    }
}

// 检查标点是否在视口内
async function checkMarkerInViewport(page) {
    try {
        if (!config.marker_options.marker_check_enabled) {
            return false;
        }

        const element = await page.$(Advanced_options.map_print_class);
        if (!element) {
            console.log(console_color.yellow, `未找到标点元素: ${Advanced_options.map_print_class}`, console_color.white);
            return false;
        }

        const isVisible = await isElementVisible(page, Advanced_options.map_print_class);
        if (isVisible) {
            console.log(console_color.green, `标点在视口内可见`, console_color.white);
            return true;
        } else {
            console.log(console_color.yellow, `标点不在视口内或不可见`, console_color.white);
            return false;
        }
    } catch (error) {
        console.error(console_color.red, `检查标点是否在视口内失败: ${error.message}`, console_color.white);
        return false;
    }
}

// 检查标点是否在截图区域中心（允许误差）
async function checkMarkerInScreenshotCenter(page) {
    try {
        if (!config.marker_options.marker_check_enabled) {
            return false;
        }

        const element = await page.$(Advanced_options.map_print_class);
        if (!element) {
            return false;
        }

        const box = await element.boundingBox();
        if (!box) {
            return false;
        }

        // 计算标点中心位置
        const markerCenterX = box.x + box.width / 2;
        const markerCenterY = box.y + box.height / 2;

        // 计算截图区域中心位置
        const clip = config.browser_options.clip_;
        const screenshotCenterX = clip.x + clip.width / 2;
        const screenshotCenterY = clip.y + clip.height / 2;

        // 计算距离
        const distanceX = Math.abs(markerCenterX - screenshotCenterX);
        const distanceY = Math.abs(markerCenterY - screenshotCenterY);
        const tolerance = config.marker_options.center_tolerance;

        console.log(console_color.blue, `标点中心: (${markerCenterX}, ${markerCenterY})`, console_color.white);
        console.log(console_color.blue, `截图中心: (${screenshotCenterX}, ${screenshotCenterY})`, console_color.white);
        console.log(console_color.blue, `距离偏差: X=${distanceX}px, Y=${distanceY}px (允许误差: ${tolerance}px)`, console_color.white);

        if (distanceX <= tolerance && distanceY <= tolerance) {
            console.log(console_color.green, `标点已在截图区域中心（误差范围内）`, console_color.white);
            return true;
        } else {
            console.log(console_color.yellow, `标点不在截图区域中心，需要调整`, console_color.white);
            return false;
        }
    } catch (error) {
        console.error(console_color.red, `检查标点是否在截图中心失败: ${error.message}`, console_color.white);
        return false;
    }
}

async function dragElementToCenter(page) {
    try {
        if (!config.marker_options.marker_check_enabled) {
            console.log(console_color.yellow, '标点检测已禁用', console_color.white);
            return;
        }

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

        // 计算目标位置（截图区域中心）
        let targetX, targetY;
        if (config.marker_options.use_screenshot_center) {
            // 使用截图区域中心作为目标位置
            const clip = config.browser_options.clip_;
            targetX = clip.x + clip.width * config.marker_options.drag_target_x_ratio;
            targetY = clip.y + clip.height * config.marker_options.drag_target_y_ratio;
            console.log(console_color.blue, `使用截图区域中心作为目标位置`, console_color.white);
        } else {
            // 使用视口比例作为目标位置
            targetX = viewportSize.width * config.marker_options.drag_target_x_ratio;
            targetY = viewportSize.height * config.marker_options.drag_target_y_ratio;
            console.log(console_color.blue, `使用视口比例作为目标位置`, console_color.white);
        }

        // 计算标点当前位置
        const markerX = box.x + box.width / 2;
        const markerY = box.y + box.height / 2;

        // 计算需要拖拽的距离（地图拖拽方向与标点移动方向相同）
        const dragDistanceX = targetX - markerX;
        const dragDistanceY = targetY - markerY;

        // 选择一个在标点附近但不在标点上的拖拽起点
        let dragStartX, dragStartY;
        const offset = config.marker_options.drag_offset_distance;

        // 根据标点位置选择合适的拖拽起点
        if (box.y < 200) {
            // 标点在上方，从标点右下方开始拖拽
            dragStartX = markerX + offset;
            dragStartY = markerY + offset;
        } else if (viewportSize.height - box.y - box.height < 200) {
            // 标点在下方，从标点右上方开始拖拽
            dragStartX = markerX + offset;
            dragStartY = markerY - offset;
        } else {
            if (viewportSize.width - box.x - box.width < 100) {
                // 标点在右侧，从标点左侧开始拖拽
                dragStartX = markerX - offset;
                dragStartY = markerY;
            } else {
                // 标点在左侧或中间，从标点右侧开始拖拽
                dragStartX = markerX + offset;
                dragStartY = markerY;
            }
        }

        // 计算拖拽终点
        const dragEndX = dragStartX + dragDistanceX;
        const dragEndY = dragStartY + dragDistanceY;

        console.log(console_color.blue, `标点当前位置: (${markerX}, ${markerY})`, console_color.white);
        console.log(console_color.blue, `目标位置: (${targetX}, ${targetY})`, console_color.white);
        console.log(console_color.blue, `拖拽起点: (${dragStartX}, ${dragStartY})`, console_color.white);
        console.log(console_color.blue, `拖拽终点: (${dragEndX}, ${dragEndY})`, console_color.white);
        console.log(console_color.blue, `拖拽距离: (${dragDistanceX}, ${dragDistanceY})`, console_color.white);

        // 执行地图拖拽
        await page.mouse.move(dragStartX, dragStartY);
        await page.mouse.down();
        console.log(console_color.blue, "在标点附近按下鼠标，开始拖拽地图", console_color.white);
        await page.waitForTimeout(500);

        await page.mouse.move(dragEndX, dragEndY, { steps: config.marker_options.drag_steps });
        console.log(console_color.blue, "拖拽地图中...", console_color.white);
        await page.waitForTimeout(500);

        await page.mouse.up();
        await page.waitForTimeout(config.marker_options.drag_wait_time);

        console.log(console_color.green, "地图拖拽完成，检查标点位置变化", console_color.white);

        // 检查拖拽后标点位置是否有变化
        await page.waitForTimeout(500); // 等待拖拽动画完成
        const newBox = await element.boundingBox();
        if (newBox) {
            const newMarkerX = newBox.x + newBox.width / 2;
            const newMarkerY = newBox.y + newBox.height / 2;

            const positionChanged = Math.abs(newMarkerX - markerX) > 10 || Math.abs(newMarkerY - markerY) > 10;

            if (positionChanged) {
                console.log(console_color.green, `标点位置已改变: (${markerX}, ${markerY}) -> (${newMarkerX}, ${newMarkerY})`, console_color.white);
                return true;
            } else {
                console.log(console_color.yellow, `标点位置未改变，尝试随机切换拖拽点`, console_color.white);

                // 随机切换半径100px内的任意点
                const randomRadius = Math.random() * 100;
                const randomAngle = Math.random() * 2 * Math.PI;
                const randomOffsetX = Math.cos(randomAngle) * randomRadius;
                const randomOffsetY = Math.sin(randomAngle) * randomRadius;

                const newDragStartX = markerX + randomOffsetX;
                const newDragStartY = markerY + randomOffsetY;

                // 重新计算拖拽距离
                const newDragEndX = newDragStartX + dragDistanceX;
                const newDragEndY = newDragStartY + dragDistanceY;

                console.log(console_color.blue, `随机拖拽点: (${newDragStartX}, ${newDragStartY}) -> (${newDragEndX}, ${newDragEndY})`, console_color.white);

                // 执行随机点拖拽
                await page.mouse.move(newDragStartX, newDragStartY);
                await page.mouse.down();
                await page.waitForTimeout(500);
                await page.mouse.move(newDragEndX, newDragEndY, { steps: config.marker_options.drag_steps });
                await page.waitForTimeout(500);
                await page.mouse.up();
                await page.waitForTimeout(config.marker_options.drag_wait_time);

                console.log(console_color.green, "随机点拖拽完成", console_color.white);
                return true;
            }
        }

        return false;

    } catch (error) {
        console.error(console_color.red, `拖拽地图失败: ${error.message}`, console_color.white);
        // 不抛出错误，继续执行
        return false;
    }
}

function genUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0,
            v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// 读取截图进度记录
function readProgressRecord(folderPath) {
    try {
        // 进度文件保存在截图目录，作为隐藏文件
        const progressFile = path.join(folderPath, `.${config.progress_file}`);
        if (fs.existsSync(progressFile)) {
            const content = fs.readFileSync(progressFile, 'utf-8');
            const progress = JSON.parse(content);
            console.log(console_color.green, `读取到截图进度记录: 已完成 ${progress.completed} 条，从第 ${progress.nextIndex + 1} 条开始`, console_color.white);
            return progress;
        } else {
            console.log(console_color.blue, `未找到进度记录文件，从第1条开始截图`, console_color.white);
            return { completed: 0, nextIndex: 0, totalCount: 0 };
        }
    } catch (error) {
        console.error(console_color.red, `读取进度记录失败: ${error.message}`, console_color.white);
        return { completed: 0, nextIndex: 0, totalCount: 0 };
    }
}

// 保存截图进度记录
function saveProgressRecord(folderPath, completed, nextIndex, totalCount) {
    try {
        // 进度文件保存在截图目录，作为隐藏文件
        const progressFile = path.join(folderPath, `.${config.progress_file}`);
        const progress = {
            completed: completed,
            nextIndex: nextIndex,
            totalCount: totalCount,
            lastUpdate: new Date().toISOString()
        };
        fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2), 'utf-8');
        console.log(console_color.blue, `保存进度记录: 已完成 ${completed}/${totalCount} 条`, console_color.white);
    } catch (error) {
        console.error(console_color.red, `保存进度记录失败: ${error.message}`, console_color.white);
    }
}

// 清除截图进度记录
function clearProgressRecord(folderPath) {
    try {
        // 进度文件保存在截图目录，作为隐藏文件
        const progressFile = path.join(folderPath, `.${config.progress_file}`);
        if (fs.existsSync(progressFile)) {
            fs.unlinkSync(progressFile);
            console.log(console_color.green, `截图进度记录已清除`, console_color.white);
        }
    } catch (error) {
        console.error(console_color.red, `清除进度记录失败: ${error.message}`, console_color.white);
    }
}

// 扩大搜索范围
async function extendedSearch(page, searchQuery) {
    if (!config.scale_options.extended_search_enabled) {
        return false;
    }

    console.log(console_color.yellow, `开始扩大搜索范围: ${searchQuery}`, console_color.white);

    for (const targetScale of config.scale_options.extended_search_scales) {
        console.log(console_color.blue, `尝试缩放到 ${targetScale}米 进行搜索`, console_color.white);

        // 缩放到指定级别
        let currentScale = await getCurrentScale(page);
        if (currentScale === null) continue;

        let attempts = 0;
        const maxAttempts = 20;

        while (Math.abs(currentScale - targetScale) > targetScale * 0.1 && attempts < maxAttempts) {
            if (currentScale < targetScale) {
                // 需要缩小
                await clickElement(page, `${Advanced_options.map_outOrin_father_id} ${Advanced_options.map_out_class}`);
            } else {
                // 需要放大
                await clickElement(page, `${Advanced_options.map_outOrin_father_id} ${Advanced_options.map_in_class}`);
            }

            await page.waitForTimeout(config.scale_options.scale_adjust_timeout);

            const newScale = await getCurrentScale(page);
            if (newScale === null || newScale === currentScale) {
                break;
            }
            currentScale = newScale;
            attempts++;
        }

        console.log(console_color.blue, `当前缩放级别: ${currentScale}米`, console_color.white);

        // 重新搜索
        await clickSearchButton(page);
        await page.waitForTimeout(config.map_options.search_wait_time);

        // 检查是否找到标点
        const markerFound = await waitForMapMarker(page, 10000);
        if (markerFound) {
            console.log(console_color.green, `在 ${currentScale}米 级别找到标点`, console_color.white);
            return true;
        }
    }

    console.log(console_color.red, `扩大搜索后仍未找到标点`, console_color.white);
    return false;
}

// 保存无标点记录到invisible_BMap_noprint文件夹
async function saveInvisibleRecord(folderPath, searchQuery, fileName, page) {
    try {
        const uuid = genUUID();
        const invisibleFolderPath = path.join(folderPath, config.invisible_BMap_noprint);

        if (!fs.existsSync(invisibleFolderPath)) {
            fs.mkdirSync(invisibleFolderPath, { recursive: true });
        }

        // 截图当前状态
        const clip = config.browser_options.clip_;
        await page.screenshot({
            path: path.join(invisibleFolderPath, `${uuid}.png`),
            clip,
            timeout: 10000
        });

        // 保存文本记录
        const txtFileName = config.txt_;
        const txtFilePath = path.join(invisibleFolderPath, txtFileName);
        const currentUrl = await page.url();
        const content = `${uuid}\t${fileName}\t${currentUrl}\t[NO_MARKER_FOUND]\n`;
        fs.appendFileSync(txtFilePath, content, 'utf-8');

        // 保存到Excel（和原excel一样的格式）
        await saveToExcel(folderPath, uuid, fileName, currentUrl);

        console.log(console_color.yellow, `无标点记录已保存: ${searchQuery}`, console_color.white);
        return true;
    } catch (error) {
        console.error(console_color.red, `保存无标点记录失败: ${error.message}`, console_color.white);
        return false;
    }
}

async function main() {
    console.log(console_color.blue, "开始读取Excel文件", console_color.white);

    const excelFilePath = config.excel_url;
    const data = readFile(excelFilePath);

    if (data.length === 0) {
        console.error('Excel 文件中没有数据。请检查文件内容和格式。');
        return;
    }

    const folderPath = path.join(config.screenshots_url);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
    console.log(`Folder created at: ${folderPath}`);

    // 读取截图进度记录（从截图目录读取）
    const progress = readProgressRecord(folderPath);
    const startIndex = progress.nextIndex;
    const totalCount = data.length;

    // 更新总数量
    progress.totalCount = totalCount;

    if (startIndex >= totalCount) {
        console.log(console_color.green, `所有截图已完成！总共 ${totalCount} 条`, console_color.white);
        clearProgressRecord(folderPath);
        return;
    }

    console.log(console_color.blue, `准备从第 ${startIndex + 1} 条开始截图，共 ${totalCount} 条`, console_color.white);

    const browser = await chromium.launch({
        headless: false,
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    const map_url = config.map_url;
    await page.goto(map_url, { waitUntil: 'networkidle' });

    // 从记录的位置开始截图
    for (let i = startIndex; i < data.length; i++) {
        const item = data[i];
        const fileNameKey = Object.entries(item).slice(-1)[0][0];
        const searchQuery = item[fileNameKey];
        console.log(`截图( ${i + 1}/${data.length} )`);
        console.log(`Address to search: ${searchQuery}`);

        try {
            await searchAddress(page, searchQuery);
            const captureResult = await captureMapScreenshot(page, searchQuery, folderPath, searchQuery);

            // 如果常规截图失败，尝试扩大搜索
            if (!captureResult) {
                console.log(console_color.yellow, `常规搜索失败，尝试扩大搜索范围: ${searchQuery}`, console_color.white);
                const extendedResult = await extendedSearch(page, searchQuery);

                if (extendedResult) {
                    // 扩大搜索成功，再次尝试截图
                    const extendedCaptureResult = await captureMapScreenshot(page, searchQuery, folderPath, searchQuery);
                    if (!extendedCaptureResult) {
                        // 扩大搜索后仍然失败，保存无标点记录
                        await saveInvisibleRecord(folderPath, searchQuery, searchQuery, page);
                    }
                } else {
                    // 扩大搜索也失败，保存无标点记录
                    await saveInvisibleRecord(folderPath, searchQuery, searchQuery, page);
                }
            }

            // 保存进度记录
            saveProgressRecord(folderPath, i + 1, i + 1, totalCount);

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

                // 即使出错也要保存进度
                saveProgressRecord(folderPath, i + 1, i + 1, totalCount);

            } catch (saveError) {
                console.error(console_color.red, `保存错误截图失败: ${saveError.message}`, console_color.white);
            }
        }
    }

    await browser.close();

    // 所有截图完成，清除进度记录
    console.log(console_color.green, `所有截图已完成！总共处理 ${totalCount} 条`, console_color.white);
    clearProgressRecord(folderPath);

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