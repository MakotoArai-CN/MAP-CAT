async function checkNode() {
        const requiredNodeVersion = [14, 0, 0];

        checkNodeVersion(...requiredNodeVersion);

    require("./map-cat.js").MAKOTO_DETECT();
    }
function checkNodeVersion(requiredMajor, requiredMinor = 0, requiredPatch = 0) {
    const [major, minor, patch] = process.versions.node.split('.').map(Number);

    if (major < requiredMajor ||
        (major === requiredMajor && minor < requiredMinor) ||
        (major === requiredMajor && minor === requiredMinor && patch < requiredPatch)) {
        console.error(`此应用需要Node.js ${requiredMajor}.${requiredMinor}.${requiredPatch}或更高版本。当前版本: v${major}.${minor}.${patch}`);
        console.log("请手动输入以下命令升级node");
        console.log(require("./config.js").console_color.blue,"n latest",require("./config.js").console_color.white);
        process.exit(1);
    } else {
            }
}
checkNode()