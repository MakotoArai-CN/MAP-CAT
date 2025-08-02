const fs = require('fs');
const path = require('path');

// 读取JSON配置文件
function loadConfigFromFile() {
    try {
        const configPath = path.join(__dirname, 'config.json');
        if (fs.existsSync(configPath)) {
            const configFile = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(configFile);
        } else {
            console.warn('config.json file not found, using default configuration');
            return null;
        }
    } catch (error) {
        console.error('Error reading config.json:', error);
        return null;
    }
}

// 默认配置（原始配置）
const defaultConfig = {
    config: {                        // 基本配置
        version: "1.2.0",                   // 版本号
        excel_url: "test_data.csv",            // excel文件路径
        screenshots_url: "screenshots",      // 截图保存路径
        invisible_BMap_noprint: "invisible_BMap_noprint",    // 不可见的BMap_noprint
        excel_: "screenshots_data.xlsx",     // excel文件保存路径
        sheetName: "Screenshots_Data",       // excel工作表名
        txt_: "url.txt",                     // url.txt文件路径
        progress_file: "screenshot_progress.json", // 截图进度记录文件
        map_url: "https://map.baidu.com/",   // 地图url (支持百度地图和高德地图)
        checkSystem: true,                   // 是否检查系统
        NetworkLatency_url: "https://www.baidu.com", // 网络延迟url
        // DownloadSpeed_url: "https://dldir1v6.qq.com/qqfile/qq/QQNT/Windows/QQ_9.9.20_250724_x64_01.exe",   // 下载速度urlhttps://dldir1v6.qq.com/weixin/Universal/Windows/WeChatWin.exe
        DownloadSpeed_url: "https://dldir1v6.qq.com/weixin/Universal/Windows/WeChatWin.exe",   // 下载速度urlhttps://dldir1v6.qq.com/weixin/Universal/Windows/WeChatWin.exe
        wait_time: 6000,                     // 等待时间
        retry_times: 6,                      // 重试次数
        map_options: {                       // 地图操作
            mapOut_timeonce: 500,            // 地图缩小一次等待时间
            mapOut_timetwice: 500,           // 地图缩小两次等待时间
            mapIn_timeonce: 500,             // 地图放大一次等待时间
            mapIn_timetwice: 500,            // 地图放大两次等待时间
            search_wait_time: 1000           // 搜索等待时间
        },
        browser_options: {                    // 浏览器配置
            headless: false,                  // 是否无头模式
            clip_: {                          // 截屏配置
                x: 0,
                y: 80,
                width: 1000, // 宽度
                height: 500  // 高度
            }
        },
        scale_options: {                      // 地图缩放配置
            max_scale_meters: 100,           // 最大缩放级别（米），大于此值需要放大地图
            min_scale_meters: 20,            // 最小缩放级别（米），小于此值需要缩小地图
            scale_adjust_timeout: 500,       // 每次缩放调整后的等待时间（毫秒）
            max_adjust_attempts: 10,         // 最大调整次数，防止无限循环
            restore_button_wait: 1000,       // 点击恢复按钮后的等待时间（毫秒）
            scale_detection_enabled: true,   // 是否启用缩放级别检测和调整
            restore_button_enabled: true,    // 是否启用恢复按钮检测和点击
            // 扩大搜索范围配置
            extended_search_scales: [10000, 20000], // 扩大搜索的缩放级别（米）
            extended_search_enabled: true    // 是否启用扩大搜索
        },
        marker_options: {                     // 标点处理配置
            use_screenshot_center: true,     // 是否使用截图区域中心作为目标位置
            drag_target_x_ratio: 0.5,        // 拖拽目标位置X坐标比例（相对于截图区域宽度，0.5=中心）
            drag_target_y_ratio: 0.5,        // 拖拽目标位置Y坐标比例（相对于截图区域高度，0.5=中心）
            center_tolerance: 20,            // 中心位置允许的误差（像素）
            visibility_margin: 30,           // 元素可见性检测的边距（像素），元素距离边框多少像素内认为接近边框
            mouse_wheel_zoom_delta: 120,     // 鼠标滚轮缩放增量
            wheel_zoom_wait_time: 800,       // 滚轮缩放后等待时间（毫秒）
            drag_wait_time: 1000,            // 拖拽操作等待时间（毫秒）
            drag_offset_distance: 50,        // 拖拽起点距离标点的偏移距离（像素）
            drag_steps: 10,                  // 拖拽移动的步数
            drag_safe_distance: 80,          // 拖拽安全距离，避免直接点击到标点（像素）
            drag_retry_attempts: 3,          // 拖拽重试次数
            marker_check_enabled: true       // 是否启用标点检测和处理
        },
        error_handling: {                    // 错误处理配置
            max_retry_attempts: 3,           // 最大重试次数
            retry_delay: 2000,               // 重试延迟时间（毫秒）
            critical_error_retry: true,      // 是否对关键错误进行重试
            screenshot_timeout: 15000,       // 截图超时时间（毫秒）
            startup_retry_enabled: false,    // 系统启动失败是否重试
            startup_errors: [                // 系统启动阶段的错误类型
                'EXCEL_FILE_NOT_FOUND',
                'BROWSER_LAUNCH_FAILED',
                'CONFIG_LOAD_FAILED',
                'DEPENDENCY_MISSING'
            ]
        },
        data_processing: {                   // 数据处理配置
            // 输入文件格式支持
            supported_formats: ["xlsx", "csv", "json"], // 支持的输入文件格式

            // 输入列配置
            input_column: "address",              // 指定搜索字段列名或列索引，null表示使用最后一列策略
                                            // 示例: "address" 或 3 (第4列，从0开始计数)

            // 输出字段配置
            output_fields: ["name","uuid", "address", "url"], // 输出字段列表
                                            // 可选字段: uuid, name, address, url, timestamp, status

            // 输出格式配置
            output_formats: ["excel", "txt"], // 输出格式列表
                                            // 可选格式: excel, txt, sql

            // SQL输出配置
            sql_config: {
                table_name: "screenshot_data", // SQL表名
                database_type: "mysql"        // 数据库类型: mysql, postgresql, sqlite
            },

            // CSV配置
            csv_config: {
                delimiter: ",",               // CSV分隔符
                encoding: "utf-8",           // 文件编码
                has_header: true             // 是否包含表头
            },

            // JSON配置
            json_config: {
                encoding: "utf-8",           // 文件编码
                array_field: null            // 如果JSON是对象格式，指定数组字段名，null表示根级就是数组
            }
        },
    },

    Advanced_options: {              // 高级配置
        searchBtn_id: '#search-button',      // 搜索按钮
        searchInput_id: '#sole-input',       // 搜索框
        mapSelectInfo_id: '#cards-level1',   // 地图提示信息 ==>没有用
        map_print_class: '.BMap_noprint',    // 地图红色或蓝色标点
        map_outOrin_father_id: "#map-operate",// 地图放大缩小按钮
        map_out_class: ".BMap_stdMpZoomOut", // 地图缩小按钮
        map_in_class: ".BMap_stdMpZoomIn",   // 地图放大按钮
        scale_text_selector: ".BMap_scaleTxt", // 地图缩放级别文本选择器
        restore_button_selector: "#map-operate button", // 恢复按钮选择器
        restore_button_index: 3,            // 恢复按钮在按钮组中的索引（从0开始）
        // 需要隐藏的元素选择器
        hide_elements: {
            baidu: ['#cards-level1', '#cards-level0', '#cards-level2', '.BMap_simple_bubble_pop', '#app-right-top', '#mapType-wrapper', '.poilist-widget-container', '#map-bottom-tip', '.BMap_cpyCtrl', '.BMap_bubble_pop', '.shadow'], // 百度地图需要隐藏的元素
            amap: ['.mask--jss-0-16', '.serp-box-con', '.app-download-panel'] // 高德地图需要隐藏的元素
        }
    },

    console_color: {    // 控制台颜色
        bright: '\x1B[1m', // 亮色
        grey: '\x1B[2m', // 灰色
        italic: '\x1B[3m', // 斜体
        underline: '\x1B[4m', // 下划线
        reverse: '\x1B[7m', // 反向
        hidden: '\x1B[8m', // 隐藏
        black: '\x1B[30m', // 黑色
        red: '\x1B[31m', // 红色
        green: '\x1B[32m', // 绿色
        yellow: '\x1B[33m', // 黄色
        blue: '\x1B[34m', // 蓝色
        magenta: '\x1B[35m', // 品红
        cyan: '\x1B[36m', // 青色
        white: '\x1B[37m', // 白色
        blackBG: '\x1B[40m', // 背景色为黑色
        redBG: '\x1B[41m', // 背景色为红色
        greenBG: '\x1B[42m', // 背景色为绿色
        yellowBG: '\x1B[43m', // 背景色为黄色
        blueBG: '\x1B[44m', // 背景色为蓝色
        magentaBG: '\x1B[45m', // 背景色为品红
        cyanBG: '\x1B[46m', // 背景色为青色
        whiteBG: '\x1B[47m' // 背景色为白色
    }
};

// 从文件加载配置，如果失败则使用默认配置
const fileConfig = loadConfigFromFile();
const configData = fileConfig || defaultConfig;

// 保持原有的导出结构
exports.config = configData.config || defaultConfig.config;
exports.Advanced_options = configData.Advanced_options || defaultConfig.Advanced_options;
exports.console_color = configData.console_color || defaultConfig.console_color;