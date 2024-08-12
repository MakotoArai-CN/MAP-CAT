# Map Screenshot Tool Instructions

## Usage Notes

1. **This is a personal automated screenshot tool.** Before using it, test with small batches, for example, a table with 100 rows of data.
2. **Automation Assumptions:** The first column in the data is assumed to be the name, and the last column is the map address. Please adjust the data as needed.
3. **Excel Customization:** If you're not familiar with the tool, you only need to modify the Excel part. Default configurations are already set up.

---

<font color=red size=5>****⚠️⚠️⚠️⚠️WARNING: Once started, do not interrupt! Do not interact with the automatically opened browser! Serious issues may occur.⚠️⚠️⚠️⚠️****</font>

## File Resource Locations

1. **Excel file should be placed in the root directory.**
2. **Output Directory:** Screenshots are saved by default in the `screenshots` folder.

### Code Modifications

1. **Modify the path in `config.js` to point to your Excel file.** If the file is in the root directory, just change the filename.
2. **Change the output directory from `screenshots` to your desired path,** preferably an absolute path.
3. **Adjust the waiting time in `config.js` (default is 6000 milliseconds).** Increase this if you have slow internet or want more manual control.

### Installation & Running

Make sure to configure the Excel file path in `config.js`！⚠️⚠️⚠️⚠️

#### For Regular Users

Double-click `start.bat` to launch the program. It will guide you through the installation and configuration process.

#### For Developers

1. **Install Node.js:** Ensure your version is greater than 14, and use the latest available version.
2. **Install dependencies:** In the root directory, run `npm i`.
3. **Run the script:** Execute `npm start`.

---

### <font color=red>⚠️⚠️⚠️⚠️WARNING: Once started, do not interrupt!! Serious issues may occur. ⚠️⚠️⚠️⚠️</font>

## Changelog

### MPA-CAT1.1.2
- Added one-click run functionality.

### MPA-CAT1.1.1
- Added customizable features.

### MPA-CAT1.1.0
- Added automatic landmark detection.
- Updated Excel data format.
- Added self-check function.
- Fixed known bugs.

### MPA-CAT1.0.5
- Fixed screenshot bug.
- Added feature to mark entries without landmarks.

### MPA-CAT1.0.4
- Achieved near-perfect automation.
- Fixed known bugs.
- Added automatic centering of main components.

### MPA-CAT1.0.3
- Fixed major bug.

### MPA-CAT1.0.2
- Fixed imprecise screenshot bug.

### MPA-CAT1.0.1
- Changed image filenames to unique UUIDs, with related information stored in the URL folder.

### MPA-CAT1.0.0
- Preview release.
- Screenshots taken based on Excel data and saved locally.
