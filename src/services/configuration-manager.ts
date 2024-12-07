////////////////////////////////////////////////////////////////////////////////////
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
////////////////////////////////////////////////////////////////////////////////////
import { getExtensionDefaultSettings as getDefaultConfiguration, MergedConfiguration } from './configuration-utils';
import { ExtensionUtils } from './extension-utils';
import { createHashFromIds } from './string-utils';
import { WorkspaceConfiguration } from 'vscode';
import * as vscode from 'vscode';

export class UserCustomButton {
    title: string;
    command: string;
    icon: string;
    description: string;
    tooltip: string;
    methodName: string;
    public readonly id: string;

    // Constructor for inflating from configuration (deserialization)
    constructor(data: { title: string, command: string, icon: string, description: string, tooltip: string, methodName: string }) {
        this.title = data.title;
        this.command = data.command;
        this.icon = data.icon;
        this.description = data.description;
        this.tooltip = data.tooltip;
        this.methodName = data.methodName;
        this.id = this.methodName;
    }

    // Method for deflating the object to configuration (serialization)
    toJSON(): { title: string, command: string, icon: string, description: string, tooltip: string, methodName: string } {
        return {
            title: this.title,
            command: this.command,
            icon: this.icon,
            description: this.description,
            tooltip: this.tooltip,
            methodName: this.methodName
        };
    }
}

export class UserCustomCategory {
    title: string;
    icon: string;
    buttons: Array<UserCustomButton>;
    public readonly id: string;

    // Constructor for inflating the object from configuration (deserialization)
    constructor(data: { title: string, icon: string, buttons: Array<UserCustomButton> }) {
        this.title = data.title;
        this.buttons = data.buttons.map(buttonData => new UserCustomButton(buttonData));
        this.icon = data.icon;
        const buttonHash = createHashFromIds(this.buttons);
        this.id = `${this.title}-${buttonHash}`;
    }

    // Method for deflating the object to configuration (serialization)
    toJSON(): { title: string, icon: string, buttons: Array<UserCustomButton> } {
        return {
            title: this.title,
            icon: this.icon,
            buttons: this.buttons,
        };
    }
}

export interface ShellCommand {
    'name': string,
    'command': string
}

export class ConfigurationManager {

    private config: WorkspaceConfiguration;
    constructor(private context: vscode.ExtensionContext) {
        const defaultConfig = getDefaultConfiguration(ExtensionUtils.getExtensionName(context));
        this.config = new MergedConfiguration(context, defaultConfig);
    }

    public getExtensionDisplayName(): string {
        if (this.context === undefined) {
            throw new Error('Context must be defined before calling getExtensionDisplayName');
        }
        return ExtensionUtils.getExtensionDisplayName(this.context);
    }

    private getConfig(): WorkspaceConfiguration {
        return this.config;
    }

    public getCustomButtons(): Array<UserCustomCategory> {
        const config = this.getConfig();

        // Look for custom buttons
        const customButtons = config.get<Array<UserCustomCategory>>('customButtons');
        if (customButtons === undefined) {
            return [];
        }
        return customButtons.map(buttonData => new UserCustomCategory(buttonData));
    }

    public getShellCommands(): Array<ShellCommand> {
        const result = this.getConfig().get<Array<ShellCommand>>('shellCommands');
        if (result !== undefined) {
            return result;
        }
        return [];
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

    public shouldBuildBeforeLaunch(): boolean
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

    public shouldRefreshTargetsOnFileChange(): boolean
    {
        const config = this.getConfig();
        const res = config.get<boolean>('refreshTargetsOnFileChange');
        if (res === undefined)
            return false;
        else
            return res;
    }

    public shouldRefreshTargetsOnWorkspaceOpen(): boolean
    {
        const config = this.getConfig();
        const res = config.get<boolean>('refreshTargetsOnWorkspaceOpen');
        if (res === undefined)
            return false;
        else
            return res;
    }

    public getRefreshTargetsTimeoutMs(): number {
        const result = this.getConfig().get<number>('refreshTargetsTimeoutMs');
        if (result !== undefined) {
            return result;
        }
        return 0;
    }

    public shouldFetchTargetsUsingQuery(): boolean
    {
        const config = this.getConfig();
        const res = config.get<boolean>('fetchTargetsUsingQuery');
        if (res === undefined)
            return false;
        else
            return res;
    }

}