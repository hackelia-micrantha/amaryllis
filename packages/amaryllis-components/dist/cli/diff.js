"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLineDiff = getLineDiff;
function getLineDiff(oldContent, newContent) {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const result = [];
    let i = 0;
    let j = 0;
    while (i < oldLines.length || j < newLines.length) {
        const oldLine = oldLines[i];
        const newLine = newLines[j];
        if (oldLine !== undefined && newLine !== undefined && oldLine === newLine) {
            result.push(`  ${oldLine}`);
            i++;
            j++;
        }
        else {
            // Very naive diff logic - just for demonstration/basic use
            if (oldLine !== undefined && !newLines.includes(oldLine)) {
                result.push(`\x1b[31m- ${oldLine}\x1b[0m`);
                i++;
            }
            else if (newLine !== undefined && !oldLines.includes(newLine)) {
                result.push(`\x1b[32m+ ${newLine}\x1b[0m`);
                j++;
            }
            else {
                // Fallback for when both lines changed at same index
                if (oldLine !== undefined) {
                    result.push(`\x1b[31m- ${oldLine}\x1b[0m`);
                }
                if (newLine !== undefined) {
                    result.push(`\x1b[32m+ ${newLine}\x1b[0m`);
                }
                i++;
                j++;
            }
        }
    }
    return result.join('\n');
}
