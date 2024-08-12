exports.config={                        // 基本配置
    excel_url : "data.xlsx",            // excel文件路径
    screenshots_url:"screenshots",      // 截图保存路径
    invisible_BMap_noprint:"invisible_BMap_noprint",    // 不可见的BMap_noprint
    excel_:"screenshots_data.xlsx",     // excel文件保存路径
    sheetName:"Screenshots_Data",       // excel工作表名
    txt_:"url.txt",                     // url.txt文件路径
    map_url:"https://map.baidu.com/",   // 百度地图url
    checkSystem:true,                   // 是否检查系统
    NetworkLatency_url:"https://www.baidu.com", // 网络延迟url
    DownloadSpeed_url:"https://cdn.cnbj1.fds.api.mi-img.com/mibook-drivers/BIOS/M59A/20240617/RMARP4B1P0202.zip",   // 下载速度url
    wait_time:6000,                     // 等待时间
    retry_times:3,                      // 重试次数
    map_options:{                       // 地图操作
        mapOut_timeonce:500,            // 地图缩小一次等待时间
        mapOut_timetwice:500,           // 地图缩小两次等待时间
        mapIn_timeonce:500,             // 地图放大一次等待时间
        mapIn_timetwice:500,            // 地图放大两次等待时间
        search_wait_time:1000           // 搜索等待时间
    },
    browser_options:{                    // 浏览器配置
        headless:false,                  // 是否无头模式
        clip_:{                          // 截屏配置
            x: 0,
            y: 80,
            width: 1000, // 宽度
            height: 500  // 高度
        }
    },
}

exports.Advanced_options={              // 高级配置
    searchBtn_id:'#search-button',      // 搜索按钮
    searchInput_id:'#sole-input',       // 搜索框
    mapSelectInfo_id:'#cards-level1',   // 地图提示信息 ==>没有用
    map_print_class:'.BMap_noprint',    // 地图红色或蓝色标点
    map_outOrin_father_id:"#map-operate",// 地图放大缩小按钮
    map_out_class:".BMap_stdMpZoomOut", // 地图缩小按钮
    map_in_class:".BMap_stdMpZoomIn",   // 地图放大按钮
}

exports.console_color={    // 控制台颜色
    bright    : '\x1B[1m', // 亮色
    grey      : '\x1B[2m', // 灰色
    italic    : '\x1B[3m', // 斜体
    underline : '\x1B[4m', // 下划线
    reverse   : '\x1B[7m', // 反向
    hidden    : '\x1B[8m', // 隐藏
    black     : '\x1B[30m', // 黑色
    red       : '\x1B[31m', // 红色
    green     : '\x1B[32m', // 绿色
    yellow    : '\x1B[33m', // 黄色
    blue      : '\x1B[34m', // 蓝色
    magenta   : '\x1B[35m', // 品红
    cyan      : '\x1B[36m', // 青色
    white     : '\x1B[37m', // 白色
    blackBG   : '\x1B[40m', // 背景色为黑色
    redBG     : '\x1B[41m', // 背景色为红色
    greenBG   : '\x1B[42m', // 背景色为绿色
    yellowBG  : '\x1B[43m', // 背景色为黄色
    blueBG    : '\x1B[44m', // 背景色为蓝色
    magentaBG : '\x1B[45m', // 背景色为品红
    cyanBG    : '\x1B[46m', // 背景色为青色
    whiteBG   : '\x1B[47m' // 背景色为白色
}

