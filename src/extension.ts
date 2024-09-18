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
import { BazelController } from './controllers/bazel-controller';
import { registerCommands } from './controllers/command-controller';
import { BazelTargetControllerManager } from './controllers/target-controllers/bazel-target-controller-manager';
import { UserCommandsController } from './controllers/user-commands-controller';
import { WorkspaceEventsController } from './controllers/workspace-events-controller';
import { BazelActionManager } from './models/bazel-action-manager';
import { BazelEnvironment } from './models/bazel-environment';
import { BazelTargetManager } from './models/bazel-target-manager';
import { BazelService } from './services/bazel-service';
import { ConfigurationManager } from './services/configuration-manager';
import { EnvVarsUtils } from './services/env-vars-utils';
import { ExtensionUtils } from './services/extension-utils';
import { LaunchConfigService } from './services/launch-config-service';
import { ShellService } from './services/shell-service';
import { TaskService } from './services/task-service';
import { WorkspaceService } from './services/workspace-service';
import { BazelTargetTreeProvider } from './ui/bazel-target-tree-provider';
import * as vscode from 'vscode';


// Services
let configurationManager: ConfigurationManager;
let bazelService: BazelService;
let launchConfigService: LaunchConfigService;
let shellService: ShellService;
let taskService: TaskService;

// Models
let bazelEnvironment: BazelEnvironment;
let bazelActionManager: BazelActionManager;
let bazelTargetManager: BazelTargetManager;

// UI
let bazelTargetTreeProvider: BazelTargetTreeProvider;
let outputChannel: vscode.OutputChannel;

// Controllers
let bazelController: BazelController;
let userCommandsController: UserCommandsController;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let workspaceEventsController: WorkspaceEventsController;
let bazelTargetControllerManager: BazelTargetControllerManager;

function getActivateWhenClause(context: vscode.ExtensionContext): string {
    const publisherName = ExtensionUtils.getPublisherName(context);
    const extensionName = ExtensionUtils.getExtensionName(context);
    const extensionActiveWhenClause = publisherName + '.' + extensionName + '.active';
    return extensionActiveWhenClause;
}

function makeExtensionVisible(context: vscode.ExtensionContext) {
    // This makes the contribution points in package.json visible
    // based on their when clause.
    const setting = getActivateWhenClause(context);
    vscode.commands.executeCommand('setContext', setting, true);
}

function attachTreeDataProviderToView(context: vscode.ExtensionContext,
    treeDataProvider: BazelTargetTreeProvider) {

    const extensionName = ExtensionUtils.getExtensionName(context);

    // Create the TreeView and register the data provider
    const treeView = vscode.window.createTreeView(`${extensionName}View`, {
        treeDataProvider: treeDataProvider
    });

    // Attach listeners for expand/collapse events
    treeDataProvider.registerTreeViewListeners(treeView);

    // Add the TreeView to the subscriptions so it is properly disposed when the extension is deactivated
    context.subscriptions.push(treeView);
}

async function initExtension(context: vscode.ExtensionContext) {
    // The configuration manager holds the settings for the extension.
    configurationManager = new ConfigurationManager(context);

    // The bazel environment is the model for environment variables as well as
    // other extension specific model information (run targets, setup environment variables, etc.).
    bazelEnvironment = await BazelEnvironment.create(context, configurationManager);

    // Create an output channel specific to the extension.
    outputChannel = vscode.window.createOutputChannel(ExtensionUtils.getExtensionDisplayName(context));

    /******
     * SERVICES
     ******/
    // The shell service runs any shell commands that are needed by the extension and
    // can run said commands with the appropriate environment variables.
    shellService = new ShellService(WorkspaceService.getInstance().getWorkspaceFolder(),
        outputChannel,
        EnvVarsUtils.listToObject(bazelEnvironment.getEnvVars()));

    // The task service runs any tasks that are needed by the extension and
    // can run said tasks with the appropriate environment vairables.
    taskService = new TaskService(context,
        WorkspaceService.getInstance().getWorkspaceFolder(),
        EnvVarsUtils.listToObject(bazelEnvironment.getEnvVars())
    );

    // The bazel service interacts with the bazel command line tool to retrieve
    // information from the cli about bazel. This information includes things like
    // the fetching run targets or configs.
    bazelService = new BazelService(configurationManager, shellService);

    // The launch config service interacts with the vscode launch configs.
    launchConfigService = new LaunchConfigService(context,
        bazelService,  EnvVarsUtils.listToArrayOfObjects(bazelEnvironment.getEnvVars()));

    /******
     * MODELS
     ******/

    // The bazel action manager stores all the possible bazel actions
    // (which are retrieved by the bazel service at load time). These
    // include but are not limited to 'build', 'run', 'clean', 'test', etc.
    bazelActionManager = new BazelActionManager(context, bazelService);

    // This manager holds all the bazel targets for the project.
    // These items will appear in the tree view and each target
    // has associated details about it including its action and label.
    bazelTargetManager = new BazelTargetManager(context, bazelService);

    /******
     * UI
     ******/
    bazelTargetTreeProvider = new BazelTargetTreeProvider(context, configurationManager, bazelTargetManager);
    attachTreeDataProviderToView(context, bazelTargetTreeProvider);

    /******
     * CONTROLLERS
     ******/
    // The bazel controller runs general extension tasks, such as formatting, cleaning, refreshing run targets, etc.
    bazelController = new BazelController(context, configurationManager, taskService, bazelService, bazelTargetManager);

    // The user commands controller runs user dynamic tasks added through configuration settings.
    userCommandsController = new UserCommandsController(configurationManager, shellService, taskService, bazelTargetManager);

    // The workspace events controller monitors for workspace events and triggers appropriate logic
    // when those events fire.
    workspaceEventsController = new WorkspaceEventsController(context, bazelTargetTreeProvider);

    // The bazel target controller manager manages all of the bazel target controllers (all the bazel action controllers).
    bazelTargetControllerManager = new BazelTargetControllerManager(context,
        configurationManager,
        taskService,
        shellService,
        bazelService,
        launchConfigService,
        bazelController,
        bazelEnvironment,
        bazelTargetManager,
        bazelTargetTreeProvider);

    /******
     * COMMANDS
     ******/
    registerCommands(context,
        configurationManager,
        bazelService,
        userCommandsController,
        bazelController,
        bazelTargetControllerManager,
        bazelTargetManager,
        bazelActionManager,
        bazelTargetTreeProvider);

}

export function activate(context: vscode.ExtensionContext) {
    initExtension(context).then(() => {
        makeExtensionVisible(context);
    });
}
