async function checkRuntime() {
    // 检查是否在 Bun 环境中运行
    if (typeof Bun === 'undefined') {
        console.error('此应用需要在 Bun.js 环境中运行');
        console.log('请访问 https://bun.sh 获取安装信息');
        process.exit(1);
    }

    const requiredBunVersion = '1.2.0';
    const currentVersion = Bun.version;

    // 比较版本号
    if (compareVersions(currentVersion, requiredBunVersion) < 0) {
        console.error(`此应用需要 Bun.js ${requiredBunVersion} 或更高版本。当前版本: ${currentVersion}`);
        console.log('请访问 https://bun.sh 获取最新版本');
        process.exit(1);
    }

    require("./map-cat.js").MAKOTO_DETECT();
}

// 版本号比较函数
function compareVersions(a, b) {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
        const valueA = partsA[i] || 0;
        const valueB = partsB[i] || 0;
        
        if (valueA > valueB) return 1;
        if (valueA < valueB) return -1;
    }
    
    return 0;
}

checkRuntime()