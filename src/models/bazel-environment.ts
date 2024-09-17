import { BazelTarget } from './bazel-target';
import { ConfigurationManager } from '../services/configuration-manager';
import { EnvironmentService } from '../services/environment-service';
import { ExtensionUtils } from '../services/extension-utils';
import * as vscode from 'vscode';


export class BazelEnvironment {
    private runTargets: BazelTarget[] = [];
    private envVars: string[] = [];
    private selectedRunTarget: BazelTarget;
    private selectedBuildTarget: BazelTarget;
    private selectedTestTarget: BazelTarget;

    private constructor(private readonly context: vscode.ExtensionContext
    ) {
        this.refreshWorkspaceState();
        this.loadRunTargets();
        const runTarget = this.context.workspaceState.get<BazelTarget>('selectedRunTarget', new BazelTarget(context, '', '', ''));
        this.selectedRunTarget = runTarget;
        const buildTarget = this.context.workspaceState.get<BazelTarget>('selectedBuildTarget', new BazelTarget(context, '', '', ''));
        this.selectedBuildTarget = buildTarget;
        const testTarget = this.context.workspaceState.get<BazelTarget>('selectedTestTarget', new BazelTarget(context, '', '', ''));
        this.selectedTestTarget = testTarget;
    }

    private refreshWorkspaceState() {
        const version = ExtensionUtils.getExtensionVersion(this.context);
        const oldVersion = this.context.workspaceState.get<string>('version', '');
        if (oldVersion !== version) {
            this.clearWorkspaceState();
            this.context.workspaceState.update('version', version);
        }
    }

    private clearWorkspaceState() {
        // Iterate through all keys in workspaceState and clear them
        const keys = this.context.workspaceState.keys();
        for (const key of keys) {
            this.context.workspaceState.update(key, undefined);
        }
        console.log('Workspace state has been cleared due to version bump.');
    }

    public static async create(context: vscode.ExtensionContext,
        configurationManager: ConfigurationManager
    ): Promise<BazelEnvironment> {
        const instance = new BazelEnvironment(context);
        instance.envVars = await this.loadEnvVars(context, configurationManager);
        return instance;
    }

    // Load run targets from storage
    private loadRunTargets() {
        // Retrieve stored BazelTarget objects from workspace state (as plain objects)
        const storedTargets = this.context.workspaceState.get<BazelTarget[]>('bazelRunTargets', []);
        // Deserialize each stored target into an instance of BazelTarget
        this.runTargets = storedTargets.map(item => BazelTarget.fromJSON(this.context, item));
    }

    private static async loadEnvVars(context: vscode.ExtensionContext,
        configurationManager: ConfigurationManager
    ): Promise<string[]> {
        const result = EnvironmentService.fetchSetupEnvironment(context, configurationManager.getSetupEnvironmentCommand());
        context.workspaceState.update('setupEnvVars', result);
        return result;
    }

    // Methods to manage run targets
    public getRunTargets(): BazelTarget[] {
        return this.runTargets;
    }

    public updateRunTargets(targets: BazelTarget[]) {
        this.runTargets = targets;
        this.context.workspaceState.update('bazelRunTargets', this.runTargets);
    }

    // Methods to manage environment variables
    public getEnvVars(): string[] {
        return this.envVars;
    }

    public getSelectedRunTarget(): BazelTarget {
        return this.selectedRunTarget;
    }

    public updateSelectedRunTarget(target: BazelTarget) {
        this.selectedRunTarget = target;
        this.context.workspaceState.update('selectedRunTarget', this.selectedRunTarget);
    }

    public getSelectedBuildTarget(): BazelTarget {
        return this.selectedBuildTarget;
    }

    public updateSelectedBuildTarget(target: BazelTarget) {
        this.selectedBuildTarget = target;
        this.context.workspaceState.update('selectedBuildTarget', this.selectedBuildTarget);
    }


    public getSelectedTestTarget(): BazelTarget {
        return this.selectedTestTarget;
    }

    public updateSelectedTestTarget(target: BazelTarget) {
        this.selectedTestTarget = target;
        this.context.workspaceState.update('selectedTestTarget', this.selectedTestTarget);
    }


}