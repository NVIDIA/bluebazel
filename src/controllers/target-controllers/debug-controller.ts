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

import { BazelTargetController } from './bazel-target-controller';
import { BuildController } from './build-controller';
import { BazelEnvironment } from '../../models/bazel-environment';
import { BazelTarget } from '../../models/bazel-target';
import { BazelTargetState, BazelTargetStateManager } from '../../models/bazel-target-state-manager';
import { BazelService } from '../../services/bazel-service';
import { ConfigurationManager } from '../../services/configuration-manager';
import { Console } from '../../services/console';
import { EnvVarsUtils } from '../../services/env-vars-utils';
import { LaunchConfigService } from '../../services/launch-config-service';
import { ShellService } from '../../services/shell-service';
import { WorkspaceService } from '../../services/workspace-service';
import { showProgress } from '../../ui/progress';
import * as vscode from 'vscode';


export class DebugController implements BazelTargetController {
    private debugConfigService: LaunchConfigService;

    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        bazelService: BazelService,
        private readonly shellService: ShellService,
        private readonly buildController: BuildController,
        bazelEnvironment: BazelEnvironment,
        private readonly bazelTargetStateManager: BazelTargetStateManager
    ) {
        this.debugConfigService = new LaunchConfigService(context,
            bazelService,
            bazelEnvironment.getEnvVars());
    }

    public async execute(target: BazelTarget): Promise<void> {
        try {
            this.bazelTargetStateManager.setTargetState(target, BazelTargetState.Debugging);
            if (!this.configurationManager.shouldRunBinariesDirect()) {
                await this.debugInBazel(target);
            } else {
                await this.debugDirect(target);
            }
        } catch (error) {
            return Promise.reject(error);
        } finally {
            // End debug
            this.bazelTargetStateManager.setTargetState(target, BazelTargetState.Idle);
        }
    }

    public async getExecuteCommand(target: BazelTarget): Promise<string | undefined> {
        throw Error(`Unsupported operation for debug controller to get execute command for target ${target.buildPath}`);
    }

    private async debugInBazel(target: BazelTarget): Promise<boolean> {
        try {
            await this.createLocalDebugScript(target);
            const debugConf = await showProgress(`creating ${target.label} launch config...`, (cancellationToken) => {
                return this.debugConfigService.createRunUnderLaunchConfig(target, cancellationToken);
            });
            return await this.debug(target, debugConf);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    private async debugDirect(target: BazelTarget): Promise<boolean> {
        try {
            const debugConf = await showProgress(`creating ${target.label} launch config...`, (cancellationToken) => {
                return this.debugConfigService.createDirectLaunchConfig(target, cancellationToken);
            });
            return await this.debug(target, debugConf);
        } catch (error) {
            return Promise.reject(error);
        }
    }

    private async debug(target: BazelTarget, debugConf: vscode.DebugConfiguration): Promise<boolean> {
        try {
            if (this.configurationManager.isBuildBeforeLaunch()) {
                await this.buildController.execute(target);
            }
            const success = await vscode.debug.startDebugging(WorkspaceService.getInstance().getWorkspaceFolder(), debugConf);
            return success;
        } catch (error) {
            return Promise.reject(error);
        }
    }

    private async createLocalDebugScript(target: BazelTarget): Promise<void> {
        try {
            // Fetch the executable command and environment variables
            const executable = this.configurationManager.getExecutableCommand();
            const envVars = EnvVarsUtils.toRunEnvVars(target.getEnvVars().toStringArray());
            const envSetupCommand = this.configurationManager.getSetupEnvironmentCommand();

            // Construct the shell command to create the debug script
            const scriptContent = `#!/bin/bash\nset -x\n${envSetupCommand}\n${envVars} ${executable} "$@"\n`;
            const scriptPath = `${WorkspaceService.getInstance().getWorkspaceFolder().uri.path}/.vscode/bazel_debug.sh`;
            const createScriptCmd = `echo '${scriptContent}' > ${scriptPath} && chmod +x ${scriptPath}`;

            // Run the shell command using ShellService
            await this.shellService.runShellCommand(createScriptCmd);

        } catch (error) {
            Console.error('Error creating local debug script:', error);
            throw new Error(`Could not create debug script. ${error}`);
        }
    }
}