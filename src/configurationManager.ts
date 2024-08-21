/////////////////////////////////////////////////////////////////////////////////////////
// MIT License
//
// Copyright (c) 2021-2023 NVIDIA Corporation
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
import * as vscode from 'vscode';
import { workspace, WorkspaceConfiguration } from 'vscode';
import { BazelController } from './controller';
import * as path from 'path';
import * as fs from 'fs';
export interface CustomButton {
    'title': string,
    'command': string,
    'icon': string,
    'description': string,
    'tooltip': string,
    'methodName': string
}

export interface CustomSection {
    'title': string,
    'collapsed': boolean,
    'buttons': Array<CustomButton>
}

export interface ShellCommand {
    'name': string,
    'command': string
}

class MergedConfiguration implements WorkspaceConfiguration {
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

export class ConfigurationManager {

    private m_config: WorkspaceConfiguration;
    constructor() {
        const defaultSettings = this.getDefaultSettings();
        this.m_config = new MergedConfiguration(defaultSettings);
    }

    private getDefaultSettings(): JSON {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            console.error('No workspace folder found.');
            return JSON.parse('{}');
        }

        const defaultSettings = [];
        for (const folder of workspaceFolders) {
            const rootPath = folder.uri.fsPath;

            // Construct the path to the .vscode directory
            const defaultSettingsPath = path.join(rootPath, '.vscode', 'bluebazel.json');

            try {
                const fileContent = fs.readFileSync(defaultSettingsPath, 'utf8');
                defaultSettings.push(JSON.parse(fileContent));
            } catch (error) {
                console.log('Failed to parse default settings', error);
            }
        }

        const contents = Object.assign({}, ...defaultSettings);
        Object.keys(contents).forEach((oldKey) => {
            if (oldKey.includes('bluebazel.')) {
                const newKey = oldKey.replace('bluebazel.', '');
                contents[newKey] = contents[oldKey];
            }
            delete contents[oldKey];
        });
        return contents;
    }

    private getConfig(): WorkspaceConfiguration {
        return this.m_config;
    }

    public getCustomButtons(): Array<CustomSection> {
        const config = this.getConfig();

        // Look for custom buttons
        const customButtons = config.get<Array<CustomSection>>('customButtons');
        if (customButtons === undefined) {
            return [];
        }
        return customButtons;
    }

    public getShellCommands(): Array<ShellCommand> {
        const result = this.getConfig().get<Array<ShellCommand>>('shellCommands');
        if (result !== undefined) {
            return result;
        }
        return [];
    }

    public getGenerateRunTargetsCommand(): string {
        const result = this.getConfig().get<string>('generateRunTargets');
        if (result !== undefined) {
            return result;
        }

        return 'query \'kind(cc_binary, //src/... )\'';
    }

    public getSetupEnvironmentCommand(): string {
        const result = this.getConfig().get<string>('setupEnvironmentCommand');
        if (result !== undefined) {
            return result;
        }
        return '';
    }

    public getExecutableCommand(): string {
        const result = this.getConfig().get<string>('executableCommand');
        if (result !== undefined) {
            return result;
        }
        return 'bazel';
    }

    public getFormatCommand(): string {
        const result = this.getConfig().get<string>('formatCommand');

        if (result !== undefined) {
            return result;
        }
        return 'run //:format';
    }

    public registerCommands(targetSelector: BazelController,
        context: vscode.ExtensionContext): void {
        // Traverses through the configuration and registers commands with method names.
        const config = this.getConfig();
        const customButtons = config.get<Array<CustomSection>>('customButtons');
        if (customButtons === undefined) {
            return;
        }

        customButtons.forEach(section => {
            const buttons = section.buttons;
            if (buttons !== undefined) {
                buttons.forEach(button => {
                    const disposableCommand = vscode.commands.registerCommand(button.methodName, async (command: string) => {
                        await targetSelector.runCustomTask(button.command);
                    });
                    context.subscriptions.push(disposableCommand);
                });
            }
        });
    }

    public isShowShellCommandOutput(): boolean
    {
        const config = this.getConfig();
        const res = config.get<boolean>('showShellCommandOutput');
        if (res === undefined) {
            return false;
        } else {
            return res;
        }
    }

    public isClearTerminalBeforeAction(): boolean
    {
        const config = this.getConfig();
        const res = config.get<boolean>('clearTerminalBeforeAction');
        if (res === undefined) {
            return false;
        } else {
            return res;
        }
    }

    public isBuildBeforeLaunch(): boolean
    {
        const config = this.getConfig();
        const res = config.get<boolean>('buildAtRun');
        if (res === undefined) {
            return true;
        } else {
            return res;
        }
    }

    public shouldRunBinariesDirect(): boolean
    {
        const config = this.getConfig();
        const res = config.get<boolean>('runBinariesDirect');
        if (res === undefined) {
            return true;
        } else {
            return res;
        }
    }

    public isDebugEngineLogging(): boolean
    {
        const config = this.getConfig();
        const res = config.get<boolean>('engineLogging');
        if (res === undefined)
            return false;
        else
            return res;
    }
}