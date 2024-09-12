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
import { ExtensionUtils } from './extension-utils';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { workspace, WorkspaceConfiguration } from 'vscode';

export function getExtensionDefaultSettings(extensionName: string): JSON {
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
            console.error('Failed to parse default settings', error);
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

export class MergedConfiguration implements WorkspaceConfiguration {
    private defaultConfig: any;
    constructor(private readonly context: vscode.ExtensionContext,
        defaultConfig: JSON) {
        // Additional initialization if needed
        this.defaultConfig = defaultConfig;
    }

    readonly [key: string]: any;

    has(section: string): boolean {
        return this.getUserSettings().has(section) || section in this.defaultConfig;
    }

    inspect<T>(section: string): { key: string; defaultValue?: T | undefined; globalValue?: T | undefined; workspaceValue?: T | undefined; workspaceFolderValue?: T | undefined; defaultLanguageValue?: T | undefined; globalLanguageValue?: T | undefined; workspaceLanguageValue?: T | undefined; workspaceFolderLanguageValue?: T | undefined; languageIds?: string[] | undefined; } | undefined {
        return this.getUserSettings().inspect<T>(section);
    }

    update(section: string, value: any, configurationTarget?: boolean | vscode.ConfigurationTarget | undefined, overrideInLanguage?: boolean | undefined): Thenable<void> {
        return this.getUserSettings().update(section, value, configurationTarget, overrideInLanguage);
    }

    get<T>(section: string, defaultValue?: T): T | undefined {
        const settingValue = this.getUserSettings().get<T>(section);
        const settingsInspection = this.getUserSettings().inspect(section);
        const isModifiedByUser = settingValue !== undefined &&
            (settingsInspection?.globalValue !== undefined ||
                settingsInspection?.workspaceFolderValue !== undefined ||
                settingsInspection?.workspaceValue !== undefined);
        if (isModifiedByUser) {
            return settingValue;
        } else if (section in this.defaultConfig) {
            return this.defaultConfig[section] as T;
        } else if (defaultValue) {
            return defaultValue;
        } else {
            return settingValue;
        }
    }

    getUserSettings(): WorkspaceConfiguration {
        const extensionName = ExtensionUtils.getExtensionName(this.context);
        return workspace.getConfiguration(extensionName);
    }
}