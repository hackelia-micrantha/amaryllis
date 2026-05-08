"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLineDiff = getLineDiff;
function getLineDiff(oldContent, newContent) {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const matches = getCommonLineMatrix(oldLines, newLines);
    const result = [];
    let i = oldLines.length;
    let j = newLines.length;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            result.push(`  ${oldLines[i - 1]}`);
            i--;
            j--;
        }
        else if (j > 0 &&
            (i === 0 || matches[i][j - 1] >= matches[i - 1][j])) {
            result.push(`\x1b[32m+ ${newLines[j - 1]}\x1b[0m`);
            j--;
        }
        else if (i > 0) {
            result.push(`\x1b[31m- ${oldLines[i - 1]}\x1b[0m`);
            i--;
        }
    }
    return result.reverse().join('\n');
}
function getCommonLineMatrix(oldLines, newLines) {
    const matrix = Array.from({ length: oldLines.length + 1 }, () => Array(newLines.length + 1).fill(0));
    for (let i = 1; i <= oldLines.length; i++) {
        for (let j = 1; j <= newLines.length; j++) {
            if (oldLines[i - 1] === newLines[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1] + 1;
            }
            else {
                matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
            }
        }
    }
    return matrix;
}
