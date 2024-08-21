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
import { TreeItem } from 'vscode';
import { BazelController } from './controller';
import { BazelModel } from './model';
import { ConfigurationManager } from './configurationManager';
import * as common from './common';
import { MultiPropTreeItem } from './multiPropTreeItem';
import { SinglePropTreeItem } from './singlePropTreeItem';

export class BazelTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    _onDidChangeTreeData: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    onDidChangeTreeData?: vscode.Event<void> = this._onDidChangeTreeData.event;

    context: vscode.ExtensionContext;

    m_bazelController: BazelController;
    m_configuration: ConfigurationManager;

    constructor(context: vscode.ExtensionContext,
        configuration: ConfigurationManager,
        private readonly bazelModel: BazelModel,
        bazelController: BazelController) {
        this.context = context;
        this.m_bazelController = bazelController;
        this.m_configuration = configuration;
    }

    getSections(): vscode.ProviderResult<vscode.TreeItem[]> {
        const customSections = this.m_configuration.getCustomButtons();
        const sectionTitles = Object.values(common.CONFIG_SECTIONS);

        const sectionMap: Map<string, number> =  new Map(sectionTitles.map((key, index) => [key, index]));

        const sections = sectionTitles.map(title => new TreeItem(title, vscode.TreeItemCollapsibleState.Collapsed));
        for (const section of sections) {
            section.contextValue = section.label?.toString();
            if (section.contextValue === common.CONFIG_SECTIONS.build) {
                section.label = common.CONFIG_SECTIONS.build + ` ${this.bazelModel.getTarget(common.TargetType.BUILD).value}`;
            } else if (section.contextValue === common.CONFIG_SECTIONS.run) {
                section.label = common.CONFIG_SECTIONS.run + ` ${this.bazelModel.getTarget(common.TargetType.RUN).label}`;
            } else if (section.contextValue === common.CONFIG_SECTIONS.test) {
                section.label = common.CONFIG_SECTIONS.test + ` ${this.bazelModel.getTarget(common.TargetType.TEST).label}`;
            }
        }
        customSections.forEach(element => {
            const sectionTitle = element.title;
            if (!sectionTitles.includes(sectionTitle)) {
                const collapse = element.collapsed ? vscode.TreeItemCollapsibleState.Collapsed :
                    vscode.TreeItemCollapsibleState.Expanded;
                const item = new TreeItem(sectionTitle, collapse);
                item.contextValue = sectionTitle;

                sections.push(item);
            } else {
                // This is one of the existing sessions.
                const idx = sectionMap.get(sectionTitle);
                if (idx !== undefined) {
                    sections[idx].collapsibleState = element.collapsed ? vscode.TreeItemCollapsibleState.Collapsed :
                        vscode.TreeItemCollapsibleState.Expanded;
                }
            }
        });

        return sections;
    }

    createButton(label: string, command: string, args: string[] | undefined = undefined, tooltip: string | undefined = undefined) {
        const treeItem = new TreeItem(label);
        treeItem.contextValue = 'CustomButton';

        if (tooltip !== undefined) {
            treeItem.tooltip = tooltip;
        }
        treeItem.command = { command: command, title: label, arguments: args };


        return treeItem;
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    private getChildrenForSection(workspaceKeyConfig: string,
        workspaceKeyBazelArgs: string,
        workspaceKeyEnvVars: string,
        configType: string
    ):vscode.TreeItem[] {
        const envvar = new MultiPropTreeItem('Environment',
            workspaceKeyEnvVars,
            this.bazelModel,
            () => { this.refresh(); }
        );

        const config = new MultiPropTreeItem('Config',
            workspaceKeyConfig,
            this.bazelModel,
            () => { this.refresh(); },
            () => {
                return this.m_bazelController.getConfigs(configType);
            }
        );

        const buildArgs = new MultiPropTreeItem('Args',
            workspaceKeyBazelArgs,
            this.bazelModel,
            () => { this.refresh(); }
        );

        return [config,
            buildArgs,
            envvar
        ];
    }

    getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
        if (element === undefined) {
            // Refreshing the list. Make sure the custom buttons are updated.
            const sections = this.getSections();
            return sections;
        }
        else {

            if (element.contextValue === common.CONFIG_SECTIONS.build) {

                const buildSectionItems = this.getChildrenForSection(
                    common.WORKSPACE_KEYS.buildConfigs,
                    common.WORKSPACE_KEYS.bazelBuildArgs,
                    common.WORKSPACE_KEYS.buildEnvVars,
                    'build');

                const clean = new TreeItem('Clean');
                clean.contextValue = 'BuildClean';
                const format = new TreeItem('Format');
                format.contextValue = 'BuildFormat';
                buildSectionItems.push(...[
                    clean,
                    format
                ]);
                return buildSectionItems.concat(this.getCustomButtonsForSection(element.contextValue));
            }
            else if (element.contextValue === common.CONFIG_SECTIONS.run) {
                const runSectionItems = this.getChildrenForSection(
                    common.WORKSPACE_KEYS.runConfigs,
                    common.WORKSPACE_KEYS.bazelRunArgs,
                    common.WORKSPACE_KEYS.runEnvVars,
                    'run');
                const target = this.bazelModel.getTarget(common.TargetType.RUN).value;
                const runArgs = new SinglePropTreeItem('Run Args',
                    common.getWorkspaceKeyUniqueToTarget(common.WORKSPACE_KEYS.runArgs, target),
                    this.bazelModel,
                    () => { this.refresh(); }
                );

                const refreshRunTargets = new TreeItem('Refresh Run Targets');
                refreshRunTargets.contextValue = 'RefreshRunTargets';
                runSectionItems.push(...[ runArgs,
                    refreshRunTargets]);
                return runSectionItems.concat(this.getCustomButtonsForSection(element.contextValue));
            } else if (element.contextValue === common.CONFIG_SECTIONS.test) {
                const testSectionItems = this.getChildrenForSection(
                    common.WORKSPACE_KEYS.testConfigs,
                    common.WORKSPACE_KEYS.bazelTestArgs,
                    common.WORKSPACE_KEYS.testEnvVars,
                    'test');
                const target = this.bazelModel.getTarget(common.TargetType.TEST).value;
                const runArgs = new SinglePropTreeItem('Test Args',
                    common.getWorkspaceKeyUniqueToTarget(common.WORKSPACE_KEYS.testArgs, target),
                    this.bazelModel,
                    () => { this.refresh(); }
                );

                testSectionItems.push(runArgs);
                return testSectionItems.concat(this.getCustomButtonsForSection(element.contextValue));
            } else if (element.contextValue?.includes('MultiPropTreeItem')) {
                return (element as MultiPropTreeItem).getChildren();
            } else {
                if (element.label !== undefined) {
                    return this.getCustomButtonsForSection(element.label.toString());
                }
            }
        }
    }

    public refresh() {
        this._onDidChangeTreeData.fire();
    }

    private getCustomButtonsForSection(sectionName: string): Array<vscode.TreeItem> {
        const result: Array<vscode.TreeItem> = [];
        const customSections = this.m_configuration.getCustomButtons();
        customSections.forEach(section => {
            if (section.title == sectionName && section.buttons !== undefined) {
                // Create the buttons and return the list for this section
                section.buttons.forEach(customButton => {
                    result.push(this.createButton(customButton.title, customButton.methodName, [customButton.command], customButton.tooltip));
                });
            }
        });
        return result;
    }

}

