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
import { getExtensionDefaultSettings as getDefaultConfiguration, MergedConfiguration } from './configuration-utils';
import { ExtensionUtils } from './extension-utils';
import { WorkspaceConfiguration } from 'vscode';
import * as vscode from 'vscode';

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



export class ConfigurationManager {

    private config: WorkspaceConfiguration;
    constructor(private context: vscode.ExtensionContext) {
        const defaultConfig = getDefaultConfiguration(ExtensionUtils.getExtensionName(context));
        this.config = new MergedConfiguration(context, defaultConfig);
    }

    public getExtensionDisplayName(): string {
        if (this.context === undefined) {
            throw new Error('Error: context must be defined before calling getExtensionDisplayName');
        }
        return ExtensionUtils.getExtensionDisplayName(this.context);
    }

    private getConfig(): WorkspaceConfiguration {
        return this.config;
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