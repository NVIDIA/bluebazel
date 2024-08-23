/////////////////////////////////////////////////////////////////////////////////////////
// MIT License
//
// Copyright (c) 2021-2024 NVIDIA Corporation
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
/////////////////////////////////////////////////////////////////////////////////////////
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

/**
 * Service for reading configuration files.
 */
export class FileService {
    public static getExtensionDefaultSettings(extensionName: string): JSON {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            console.error('No workspace folder found.');
            return JSON.parse('{}');
        }

        const defaultSettings = [];
        for (const folder of workspaceFolders) {
            const rootPath = folder.uri.fsPath;

            // Construct the path to the .vscode directory
            const defaultSettingsPath = path.join(rootPath, '.vscode', `${extensionName}.json`);

            // If this default settings file does not exist,
            // skip this workspace folder.
            if (!fs.existsSync(defaultSettingsPath)) {
                continue;
            }

            try {
                const fileContent = fs.readFileSync(defaultSettingsPath, 'utf8');
                defaultSettings.push(JSON.parse(fileContent));
            } catch (error) {
                console.log('Failed to parse default settings', error);
            }
        }


        // Assign the array to a dictionary
        const contents = Object.assign({}, ...defaultSettings);
        const keyPrefix = `${extensionName}.`;
        // Remove the extension name from the front of every key
        Object.keys(contents).forEach((oldKey) => {
            // Remove the extension name from the prefix of the settings
            if (oldKey.includes(keyPrefix)) {
                const newKey = oldKey.replace(keyPrefix, '');
                contents[newKey] = contents[oldKey];
            }
            delete contents[oldKey];
        });

        // Return the settings as a key-value paired object
        return contents;
    }
}