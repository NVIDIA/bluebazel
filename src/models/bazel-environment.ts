import { ConfigurationManager } from '../services/configuration-manager';
import { EnvironmentService } from '../services/environment-service';
import * as vscode from 'vscode';
export class BazelEnvironment {
    private envVars: string[] = [];

    public static async create(context: vscode.ExtensionContext,
        configurationManager: ConfigurationManager
    ): Promise<BazelEnvironment> {
        const instance = new BazelEnvironment();
        instance.envVars = await this.loadEnvVars(context, configurationManager);
        return instance;
    }

    private static async loadEnvVars(context: vscode.ExtensionContext,
        configurationManager: ConfigurationManager
    ): Promise<string[]> {
        const result = EnvironmentService.fetchSetupEnvironment(context, configurationManager.getSetupEnvironmentCommand());
        context.workspaceState.update('setupEnvVars', result);
        return result;
    }

    // Methods to manage environment variables
    public getEnvVars(): string[] {
        return this.envVars;
    }
}