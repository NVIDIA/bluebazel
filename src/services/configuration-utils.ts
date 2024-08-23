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
import { workspace, WorkspaceConfiguration } from 'vscode';
import * as vscode from 'vscode';

export class MergedConfiguration implements WorkspaceConfiguration {
    defaultSettings: any;
    constructor(defaultSettings: JSON) {
        // Additional initialization if needed
        this.defaultSettings = defaultSettings;
    }

    readonly [key: string]: any;

    has(section: string): boolean {
        return this.getUserSettings().has(section) || section in this.defaultSettings;
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
        } else if (section in this.defaultSettings) {
            return this.defaultSettings[section] as T;
        } else if (defaultValue) {
            return defaultValue;
        } else {
            return settingValue;
        }
    }

    getUserSettings(): WorkspaceConfiguration {
        return workspace.getConfiguration('bluebazel');
    }
}