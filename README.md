# Map Screenshot Tool Instructions

<div align="center">
  <img src="./mapcat.png" style="border-radius: 50%;" width="300" />
  <br>
  <h2>MAP-CAT</h2>

   [![Release](https://img.shields.io/badge/release-v1.2.0-blue.svg)](https://github.com/MakotoArai-CN/MAP-CAT/releases)
   [![Bun](https://img.shields.io/badge/Bun-1.2.0-brightgreen.svg)](https://bun.sh/)
   [![Node](https://img.shields.io/badge/Node-14+-brightgreen.svg)](https://nodejs.org/)
   [![Playwright](https://img.shields.io/badge/Playwright-1.46.0-brightgreen.svg)](https://playwright.dev/)
   [![XLSX](https://img.shields.io/badge/XLSX-0.18.5-brightgreen.svg)](https://github.com/SheetJS/sheetjs)
   [![OS](https://img.shields.io/badge/OS-Windows%20|%20Linux%20|%20MacOS-brightgreen.svg)](https://github.com/MakotoArai-CN/MAP-CAT)
   [![javascript](https://img.shields.io/badge/javascript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=darkgreen)](Javascript)
   [![License](https://img.shields.io/badge/License-AGPLv3-yellow.svg)](LICENSE)
   [![GitHub stars](https://img.shields.io/github/stars/MakotoArai-CN/MAP-CAT.svg?style=social)](https://github.com/MakotoArai-CN/MAP-CAT)


</div>


## Usage Notes

1. **This is a personal automated screenshot tool.** Before using it, test with small batches, for example, a table with 100 rows of data.
2. **Automation Assumptions:** The first column in the data is assumed to be the name, and the last column is the map address. Please adjust the data as needed.
3. **Excel Customization:** If you're not familiar with the tool, you only need to modify the Excel part. Default configurations are already set up.

---

<font color=red size=5>**⚠️WARNING: Once started, do not interrupt! Do not interact with the automatically opened browser! Serious issues may occur.**</font>

## File Resource Locations

1. **Excel file should be placed in the root directory.**
2. **Output Directory:** Screenshots are saved by default in the `screenshots` folder.

### Code Modifications

1. **Modify the path in `config.js` to point to your Excel file.** If the file is in the root directory, just change the filename.
2. **Change the output directory from `screenshots` to your desired path,** preferably an absolute path.
3. **Adjust the waiting time in `config.js` (default is 6000 milliseconds).** Increase this if you have slow internet or want more manual control.

### Installation & Running

⚠️Make sure to configure the Excel file path in `config.js`！

#### For Regular Users

**Option 1: Node.js (推荐)**
- Double-click `start.bat` to launch the program. It will guide you through the installation and configuration process.
- Or run `npm i` in the root directory to install dependencies, and then run `node index.js` to start the program.

**Option 2: Bunjs**
- Install Bunjs globally by running `npm i -g bun` in the terminal.
- Or run `Powershell -c "irm https://bun.sh/install | iex"` in the terminal.
- Run `bun install` in the root directory to install dependencies.
- Run `bun run start` to start the program.

#### For Developers

**Using Node.js:**
1. **Install Node.js:** Ensure your version is greater than 14, and use the latest available version.
2. **Install dependencies:** In the root directory, run `npm i`.
3. **Run the script:** Execute `npm start`.

**Using Bun.js (NEW!):**
1. **Install Bun.js:** Visit https://bun.sh/ or run `curl -fsSL https://bun.sh/install | bash`
2. **Install dependencies:** In the root directory, run `bun install`.
3. **Run the script:** Execute `bun run index.js` or `npm run bun`.

---

### <font color=red>⚠️WARNING: Once started, do not interrupt!! Serious issues may occur. </font>

## Troubleshooting

### Common Issues and Solutions

1. **Error: `map_type is not defined`**
   - ✅ **FIXED in v1.1.3** - This error has been resolved
   - The map type is now automatically detected based on the URL in config.js

2. **Screenshots failing or incomplete**
   - Check your internet connection
   - Increase the `wait_time` in config.js (default: 6000ms)
   - Ensure the Excel file path is correct

3. **Browser automation issues**
   - Make sure you don't interact with the browser while the script is running
   - Close other browser instances before starting
   - Check if Playwright is properly installed: `npm install playwright`

4. **Excel file not found**
   - Verify the file path in config.js
   - Ensure the Excel file exists in the specified location
   - Check file permissions


This will check:
- Configuration file loading
- Map type detection
- Advanced options setup

## Changelog

### MPA-CAT1.2.0
- Optimize drag-and-drop detection  
- Enhance screenshot correction  
- Expand search range  
- Optimize progress tracking  
- Clean up interface elements

### MPA-CAT1.1.4
- Added support for advanced options

### MPA-CAT1.1.3
- **🔧 Fixed critical bug:** Resolved `map_type is not defined` error that was causing screenshot failures
- **📝 Code optimization:** Improved code formatting and readability

### MPA-CAT1.1.2
- Added one-click run functionality.

### MPA-CAT1.1.1
- Added customizable features.

### MPA-CAT1.1.0
- Added automatic landmark detection.
- Updated Excel data format.
- Added self-check function.
- Fixed known bugs.
